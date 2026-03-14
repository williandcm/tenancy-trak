import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Landmark,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  DollarSign,
  Calculator,
  Building2,
  Printer,
  Eye,
  Banknote,
  Recycle,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { format, isBefore } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

/* ── Types & localStorage ──────────────────────────────── */
interface IptuInstallment {
  number: number;
  dueDate: string;
  isPaid: boolean;
  paidDate: string | null;
  notes: string;
}

type PaymentMode = "installment" | "lump_sum";

interface IptuUnitShare {
  unitId: string;
  unitName: string;
  areaSqm: number;
  /** Fração ideal (0..1) */
  fracaoIdeal: number;
  /** IPTU proporcional (sem lixo) conforme modalidade */
  iptuShare: number;
  /** Taxa de lixo proporcional conforme modalidade */
  trashFeeShare: number;
  /** Total a prazo da unidade (fração × totalAprazo) */
  installmentTotal: number;
  /** Número de parcelas desta unidade (1-12) */
  numInstallments: number;
  /** Parcela mensal (installmentTotal / numInstallments) */
  monthlyAmount: number;
  /** Total à vista da unidade (fração × totalAvista) */
  lumpSumTotal: number;
  /** Modalidade escolhida pelo inquilino */
  paymentMode: PaymentMode;
  /** Parcelas (usadas se paymentMode === "installment") */
  installments: IptuInstallment[];
  /** Pagamento à vista realizado? */
  lumpSumPaid: boolean;
  lumpSumPaidDate: string | null;
}

interface IptuRecord {
  id: string;
  year: number;
  /** Total do IPTU à vista do prédio (já inclui taxa de lixo) */
  totalAvista: number;
  /** Total do IPTU a prazo do prédio (já inclui taxa de lixo) */
  totalAprazo: number;
  /** Taxa de lixo contida no valor à vista */
  lixoAvista: number;
  /** Taxa de lixo contida no valor a prazo */
  lixoAprazo: number;
  /** Percentual de desconto para pagamento à vista */
  descontoAvista: number;
  /** Data do primeiro vencimento */
  firstDueDate: string;
  notes: string;
  shares: IptuUnitShare[];
  createdAt: string;

  /* ── Campos legados (mantidos para retrocompatibilidade de leitura) ── */
  numInstallments?: number;
  iptuAmount?: number;
  trashFee?: number;
  baseAreaSqm?: number;
  totalInstallment?: number;
  totalLumpSum?: number;
  tenantDiscountPercent?: number;
}

const IPTU_KEY = "locagest-iptu";

const loadRecords = (): IptuRecord[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(IPTU_KEY) || "[]") as any[];
    return raw.map((r) => {
      // ── Migração de dados legados ──
      const totalAprazo =
        r.totalAprazo ??
        r.totalInstallment ??
        (((r.iptuAmount ?? 0) + (r.trashFee ?? 0)) || 0);
      const totalAvista = r.totalAvista ?? r.totalLumpSum ?? totalAprazo;
      const lixoAprazo = r.lixoAprazo ?? r.trashFee ?? 0;
      const lixoAvista = lixoAprazo; // Lixo não tem desconto à vista

      // Calcular desconto à vista legado (baseado apenas no IPTU, sem lixo)
      const iptuSemLixoAprazo = totalAprazo - lixoAprazo;
      const iptuSemLixoAvista = totalAvista - lixoAvista;
      const descontoAvista = r.descontoAvista ??
        (iptuSemLixoAprazo > 0 && iptuSemLixoAvista < iptuSemLixoAprazo
          ? Math.round((1 - iptuSemLixoAvista / iptuSemLixoAprazo) * 10000) / 100
          : 0);

      return {
        ...r,
        totalAprazo,
        totalAvista,
        lixoAprazo,
        lixoAvista,
        descontoAvista,
        firstDueDate: r.firstDueDate ?? r.shares?.[0]?.installments?.[0]?.dueDate ?? "",
        shares: (r.shares ?? []).map((sh: any) => {
          const legacyNumInst = sh.numInstallments ?? r.numInstallments ?? 10;
          return {
            ...sh,
            fracaoIdeal: sh.fracaoIdeal ?? 0,
            numInstallments: legacyNumInst,
            iptuShare:
              sh.iptuShare ??
              sh.installmentTotal ??
              sh.monthlyAmount * legacyNumInst,
            trashFeeShare: sh.trashFeeShare ?? 0,
            installmentTotal:
              sh.installmentTotal ??
              sh.monthlyAmount * legacyNumInst,
            lumpSumTotal:
              sh.lumpSumTotal ??
              sh.installmentTotal ??
              sh.monthlyAmount * legacyNumInst,
            paymentMode: sh.paymentMode ?? "installment",
            lumpSumPaid: sh.lumpSumPaid ?? false,
            lumpSumPaidDate: sh.lumpSumPaidDate ?? null,
          };
        }),
      };
    });
  } catch {
    return [];
  }
};

const saveRecords = (records: IptuRecord[]) => {
  localStorage.setItem(IPTU_KEY, JSON.stringify(records));
};

/* ── Sync IPTU → Utility Bills ─────────────────────────── */
const BILLS_KEY = "locagest-utility-bills";

const loadUtilityBills = (): any[] => {
  try {
    return JSON.parse(localStorage.getItem(BILLS_KEY) || "[]");
  } catch {
    return [];
  }
};

const saveUtilityBills = (bills: any[]) => {
  localStorage.setItem(BILLS_KEY, JSON.stringify(bills));
};

/** Remove all utility bills linked to a given IPTU record */
const removeIptuBills = (iptuRecordId: string) => {
  const bills = loadUtilityBills();
  saveUtilityBills(bills.filter((b) => b.iptuRecordId !== iptuRecordId));
};

/** Generate utility bills from an IPTU record. */
const generateIptuBills = (record: IptuRecord) => {
  const bills = loadUtilityBills();
  const filtered = bills.filter((b: any) => b.iptuRecordId !== record.id);

  const installmentShares = record.shares.filter(
    (sh) => sh.paymentMode === "installment"
  );
  const lumpSumShares = record.shares.filter(
    (sh) => sh.paymentMode === "lump_sum"
  );

  // Determinar o máximo de parcelas entre todas as unidades parceladas
  const maxInstallments = installmentShares.reduce(
    (max, sh) => Math.max(max, sh.numInstallments),
    0
  );

  // ── Parcelado bills: one bill per installment number ──
  for (let i = 0; i < maxInstallments; i++) {
    // Apenas unidades que possuem essa parcela
    const sharesForThisInst = installmentShares.filter(
      (sh) => i < sh.numInstallments
    );
    if (sharesForThisInst.length === 0) continue;

    const shares = sharesForThisInst.map((sh) => {
      const inst = sh.installments[i];
      return {
        unitId: sh.unitId,
        unitName: sh.unitName,
        amount: sh.monthlyAmount,
        isPaid: inst?.isPaid ?? false,
        paidDate: inst?.paidDate ?? null,
      };
    });

    const totalAmount = shares.reduce((sum, s) => sum + s.amount, 0);
    const dueDate = sharesForThisInst[0]?.installments[i]?.dueDate || "";
    const [dueYear, dueMonth] = dueDate
      ? dueDate.split("-")
      : [String(record.year), "01"];

    filtered.push({
      id: crypto.randomUUID(),
      connectionId: "IPTU",
      billType: "iptu",
      referenceMonth: `${dueYear}-${dueMonth}`,
      totalAmount: Math.round(totalAmount * 100) / 100,
      dueDate,
      billDate: format(new Date(), "yyyy-MM-dd"),
      notes: `IPTU ${record.year} — Parcela ${i + 1}`,
      shares,
      createdAt: new Date().toISOString(),
      iptuRecordId: record.id,
      iptuInstallmentNumber: i + 1,
    });
  }

  // ── À Vista bill ──
  if (lumpSumShares.length > 0) {
    const firstDueDate = record.firstDueDate || record.shares[0]?.installments[0]?.dueDate || "";
    const [dueYear, dueMonth] = firstDueDate
      ? firstDueDate.split("-")
      : [String(record.year), "01"];

    const shares = lumpSumShares.map((sh) => ({
      unitId: sh.unitId,
      unitName: sh.unitName,
      amount: sh.lumpSumTotal,
      isPaid: sh.lumpSumPaid,
      paidDate: sh.lumpSumPaidDate ?? null,
    }));

    const totalAmount = shares.reduce((sum, s) => sum + s.amount, 0);

    filtered.push({
      id: crypto.randomUUID(),
      connectionId: "IPTU",
      billType: "iptu",
      referenceMonth: `${dueYear}-${dueMonth}`,
      totalAmount: Math.round(totalAmount * 100) / 100,
      dueDate: firstDueDate,
      billDate: format(new Date(), "yyyy-MM-dd"),
      notes: `IPTU ${record.year} — À Vista (${lumpSumShares.length} unidade${lumpSumShares.length > 1 ? "s" : ""})`,
      shares,
      createdAt: new Date().toISOString(),
      iptuRecordId: record.id,
      iptuInstallmentNumber: 0,
    });
  }

  saveUtilityBills(filtered);
};

const R$ = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const fmtPct = (v: number) =>
  `${(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%`;

const currentYear = new Date().getFullYear();

/* ── Component ─────────────────────────────────────────── */
const IPTU = () => {
  const { hasPermission } = useAuth();
  const isAdmin = hasPermission("admin");

  const [records, setRecords] = useState<IptuRecord[]>(loadRecords);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [yearFilter, setYearFilter] = useState<string>(String(currentYear));

  const [form, setForm] = useState({
    year: String(currentYear),
    totalAprazo: "",
    lixoAprazo: "",
    cotaUnica: "",
    firstDueDate: format(new Date(currentYear, 0, 15), "yyyy-MM-dd"),
    notes: "",
  });

  const { data: units } = useQuery({
    queryKey: ["units-for-iptu"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("units")
        .select("id, name, identifier, area_sqm, status")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const allUnits = units ?? [];
  const totalAreaSqm = allUnits.reduce((s, u) => s + Number(u.area_sqm), 0);

  const years = useMemo(() => {
    const s = new Set(records.map((r) => r.year));
    s.add(currentYear);
    return Array.from(s).sort((a, b) => b - a);
  }, [records]);

  const filteredRecords = records.filter(
    (r) => yearFilter === "all" || r.year === Number(yearFilter)
  );

  const viewRecord = viewId ? records.find((r) => r.id === viewId) : null;

  const today = new Date();
  const yearRecords = records.filter((r) => r.year === currentYear);
  const totalIptu = yearRecords.reduce((s, r) => s + r.totalAprazo, 0);

  const computePaidFromShare = (sh: IptuUnitShare) => {
    if (sh.paymentMode === "lump_sum")
      return sh.lumpSumPaid ? sh.lumpSumTotal : 0;
    return sh.installments.filter((i) => i.isPaid).length * sh.monthlyAmount;
  };

  const computeExpectedFromShare = (sh: IptuUnitShare) =>
    sh.paymentMode === "lump_sum" ? sh.lumpSumTotal : sh.installmentTotal;

  const computePendingFromShare = (sh: IptuUnitShare) =>
    Math.max(0, computeExpectedFromShare(sh) - computePaidFromShare(sh));

  const computeOverdueFromShare = (sh: IptuUnitShare) => {
    if (sh.paymentMode === "lump_sum") return 0;
    return (
      sh.installments.filter(
        (i) => !i.isPaid && isBefore(new Date(i.dueDate), today)
      ).length * sh.monthlyAmount
    );
  };

  const totalPaid = yearRecords.reduce(
    (s, r) =>
      s + r.shares.reduce((ss, sh) => ss + computePaidFromShare(sh), 0),
    0
  );
  const totalPending = yearRecords.reduce(
    (s, r) =>
      s + r.shares.reduce((ss, sh) => ss + computePendingFromShare(sh), 0),
    0
  );
  const totalOverdue = yearRecords.reduce(
    (s, r) =>
      s + r.shares.reduce((ss, sh) => ss + computeOverdueFromShare(sh), 0),
    0
  );

  const persist = (updated: IptuRecord[]) => {
    setRecords(updated);
    saveRecords(updated);
  };

  const resetForm = () => {
    setForm({
      year: String(currentYear),
      totalAprazo: "",
      lixoAprazo: "",
      cotaUnica: "",
      firstDueDate: format(new Date(currentYear, 0, 15), "yyyy-MM-dd"),
      notes: "",
    });
    setEditId(null);
  };

  /* ── Submit ────────────────────────────────────────── */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (allUnits.length === 0) {
      toast.error("Cadastre unidades antes de criar um IPTU.");
      return;
    }
    if (totalAreaSqm === 0) {
      toast.error("As unidades precisam ter área (m²) cadastrada.");
      return;
    }

    const valAprazo = parseFloat(form.totalAprazo);
    const valLixoAprazo = parseFloat(form.lixoAprazo) || 0;
    const valCotaUnica = parseFloat(form.cotaUnica) || 0;

    if (!valAprazo || valAprazo <= 0) {
      toast.error("Informe o valor total a prazo.");
      return;
    }
    if (valLixoAprazo > valAprazo) {
      toast.error(
        "Taxa de lixo não pode ser maior que o total a prazo."
      );
      return;
    }
    if (valCotaUnica < 0) {
      toast.error("O valor da cota única não pode ser negativo.");
      return;
    }
    if (valCotaUnica > valAprazo) {
      toast.error("A cota única não pode ser maior que o total a prazo.");
      return;
    }

    // Calcular valores à vista a partir da cota única
    // Taxa de lixo NÃO tem desconto à vista — valor é integral
    const valAvista = valCotaUnica > 0 ? valCotaUnica : valAprazo;
    const valLixoAvista = valLixoAprazo; // Lixo é sempre o mesmo valor

    const iptuSemLixoAprazo = valAprazo - valLixoAprazo;
    const iptuSemLixoAvista = valAvista - valLixoAvista;

    const desconto = iptuSemLixoAprazo > 0 && valCotaUnica > 0
      ? Math.round((1 - iptuSemLixoAvista / iptuSemLixoAprazo) * 10000) / 100
      : 0;

    const numInst = 10; // Padrão inicial; parcelas são configuradas por unidade no detalhe

    const firstDueDateStr = form.firstDueDate;

    // ── Cálculo por fração ideal ──

    const shares: IptuUnitShare[] = allUnits.map((u, idx) => {
      const area = Number(u.area_sqm);
      const fracaoIdeal = totalAreaSqm > 0 ? area / totalAreaSqm : 0;

      // Valores a prazo
      let iptuShareAprazo =
        Math.round(fracaoIdeal * iptuSemLixoAprazo * 100) / 100;
      let lixoShareAprazo =
        Math.round(fracaoIdeal * valLixoAprazo * 100) / 100;
      let installmentTotal =
        Math.round(fracaoIdeal * valAprazo * 100) / 100;

      // Valores à vista (lixo NÃO tem desconto, sempre igual ao a prazo)
      let iptuShareAvista =
        Math.round(fracaoIdeal * iptuSemLixoAvista * 100) / 100;
      let lixoShareAvista = lixoShareAprazo; // Lixo sem desconto
      let lumpSumTotal = Math.round((iptuShareAvista + lixoShareAvista) * 100) / 100;

      // Ajuste de centavos na última unidade
      if (idx === allUnits.length - 1) {
        const sumInstOthers = allUnits.slice(0, -1).reduce((s, ou) => {
          const f = Number(ou.area_sqm) / totalAreaSqm;
          return s + Math.round(f * valAprazo * 100) / 100;
        }, 0);
        installmentTotal =
          Math.round((valAprazo - sumInstOthers) * 100) / 100;

        const sumLumpOthers = allUnits.slice(0, -1).reduce((s, ou) => {
          const f = Number(ou.area_sqm) / totalAreaSqm;
          const iptuAv = Math.round(f * iptuSemLixoAvista * 100) / 100;
          const lixoAp = Math.round(f * valLixoAprazo * 100) / 100;
          return s + Math.round((iptuAv + lixoAp) * 100) / 100;
        }, 0);
        lumpSumTotal = Math.round((valAvista - sumLumpOthers) * 100) / 100;

        const sumLixoAprazoOthers = allUnits.slice(0, -1).reduce((s, ou) => {
          const f = Number(ou.area_sqm) / totalAreaSqm;
          return s + Math.round(f * valLixoAprazo * 100) / 100;
        }, 0);
        lixoShareAprazo =
          Math.round((valLixoAprazo - sumLixoAprazoOthers) * 100) / 100;
        iptuShareAprazo =
          Math.round((installmentTotal - lixoShareAprazo) * 100) / 100;

        // Lixo à vista = lixo a prazo (sem desconto)
        lixoShareAvista = lixoShareAprazo;
        iptuShareAvista =
          Math.round((lumpSumTotal - lixoShareAvista) * 100) / 100;
      }

      // Preservar numInstallments existente ao editar, senão usar padrão
      let unitNumInst = numInst;
      let paymentMode: PaymentMode = "installment";
      let lumpSumPaid = false;
      let lumpSumPaidDate: string | null = null;

      if (editId) {
        const existing = records.find((r) => r.id === editId);
        const existingShare = existing?.shares.find(
          (s) => s.unitId === u.id
        );
        if (existingShare) {
          unitNumInst = existingShare.numInstallments || numInst;
          paymentMode = existingShare.paymentMode;
          lumpSumPaid = existingShare.lumpSumPaid;
          lumpSumPaidDate = existingShare.lumpSumPaidDate;
        }
      }

      const monthlyAmount =
        Math.round((installmentTotal / unitNumInst) * 100) / 100;

      // Gerar parcelas
      const installments: IptuInstallment[] = [];
      const firstDue = new Date(firstDueDateStr + "T12:00:00");
      for (let i = 0; i < unitNumInst; i++) {
        const due = new Date(firstDue);
        due.setMonth(due.getMonth() + i);
        installments.push({
          number: i + 1,
          dueDate: format(due, "yyyy-MM-dd"),
          isPaid: false,
          paidDate: null,
          notes: "",
        });
      }

      // Preservar estado de pagamento se editando
      if (editId) {
        const existing = records.find((r) => r.id === editId);
        const existingShare = existing?.shares.find(
          (s) => s.unitId === u.id
        );
        if (existingShare) {
          installments.forEach((inst, instIdx) => {
            const existInst = existingShare.installments[instIdx];
            if (existInst) {
              inst.isPaid = existInst.isPaid;
              inst.paidDate = existInst.paidDate;
              inst.notes = existInst.notes;
            }
          });
        }
      }

      // iptuShare conforme modalidade; trashFeeShare sempre igual (sem desconto)
      const iptuShare =
        paymentMode === "lump_sum" ? iptuShareAvista : iptuShareAprazo;
      const trashFeeShare = lixoShareAprazo; // Lixo não tem desconto à vista

      return {
        unitId: u.id,
        unitName: u.name,
        areaSqm: area,
        fracaoIdeal,
        iptuShare,
        trashFeeShare,
        installmentTotal,
        numInstallments: unitNumInst,
        monthlyAmount,
        lumpSumTotal,
        paymentMode,
        installments,
        lumpSumPaid,
        lumpSumPaidDate,
      };
    });

    if (editId) {
      const updated = records.map((r) =>
        r.id === editId
          ? {
              ...r,
              year: parseInt(form.year),
              totalAvista: valAvista,
              totalAprazo: valAprazo,
              lixoAvista: valLixoAvista,
              lixoAprazo: valLixoAprazo,
              descontoAvista: desconto,
              firstDueDate: firstDueDateStr,
              notes: form.notes,
              shares,
            }
          : r
      );
      persist(updated);
      const updatedRecord = updated.find((r) => r.id === editId);
      if (updatedRecord) generateIptuBills(updatedRecord);
      toast.success("IPTU atualizado!");
    } else {
      const newRecord: IptuRecord = {
        id: crypto.randomUUID(),
        year: parseInt(form.year),
        totalAvista: valAvista,
        totalAprazo: valAprazo,
        lixoAvista: valLixoAvista,
        lixoAprazo: valLixoAprazo,
        descontoAvista: desconto,
        firstDueDate: firstDueDateStr,
        notes: form.notes,
        shares,
        createdAt: new Date().toISOString(),
      };
      persist([newRecord, ...records]);
      generateIptuBills(newRecord);
      toast.success(
        "IPTU cadastrado! Rateio por fração ideal de área bruta."
      );
    }

    setDialogOpen(false);
    resetForm();
  };

  const handleEdit = (record: IptuRecord) => {
    if (!isAdmin) {
      toast.error("Apenas administradores podem editar o IPTU.");
      return;
    }
    setEditId(record.id);
    setForm({
      year: String(record.year),
      totalAprazo: String(record.totalAprazo),
      lixoAprazo: String(record.lixoAprazo),
      cotaUnica: String(record.totalAvista),
      firstDueDate:
        record.firstDueDate ||
        record.shares[0]?.installments[0]?.dueDate ||
        format(new Date(record.year, 0, 15), "yyyy-MM-dd"),
      notes: record.notes,
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (!isAdmin) {
      toast.error("Apenas administradores podem excluir o IPTU.");
      return;
    }
    if (!confirm("Excluir este registro de IPTU?")) return;
    persist(records.filter((r) => r.id !== id));
    removeIptuBills(id);
    if (viewId === id) setViewId(null);
    toast.success("IPTU removido!");
  };

  const toggleInstallmentPaid = (
    recordId: string,
    unitId: string,
    instNumber: number
  ) => {
    if (!isAdmin) {
      toast.error("Apenas administradores podem confirmar pagamentos.");
      return;
    }
    const updated = records.map((r) => {
      if (r.id !== recordId) return r;
      return {
        ...r,
        shares: r.shares.map((sh) => {
          if (sh.unitId !== unitId) return sh;
          return {
            ...sh,
            installments: sh.installments.map((inst) => {
              if (inst.number !== instNumber) return inst;
              return {
                ...inst,
                isPaid: !inst.isPaid,
                paidDate: !inst.isPaid
                  ? format(new Date(), "yyyy-MM-dd")
                  : null,
              };
            }),
          };
        }),
      };
    });
    persist(updated);

    // Sync to utility bills
    try {
      const bills = loadUtilityBills();
      const rec = records.find((r) => r.id === recordId);
      const share = rec?.shares.find((s) => s.unitId === unitId);
      const inst = share?.installments.find((i) => i.number === instNumber);
      const nowPaid = inst ? !inst.isPaid : false;

      const updatedBills = bills.map((b: any) => {
        if (
          b.iptuRecordId !== recordId ||
          b.iptuInstallmentNumber !== instNumber
        )
          return b;
        return {
          ...b,
          shares: b.shares.map((s: any) => {
            if (s.unitId !== unitId) return s;
            return {
              ...s,
              isPaid: nowPaid,
              paidDate: nowPaid
                ? format(new Date(), "yyyy-MM-dd")
                : null,
            };
          }),
        };
      });
      saveUtilityBills(updatedBills);
    } catch {
      /* ignore sync errors */
    }
  };

  const toggleLumpSumPaid = (recordId: string, unitId: string) => {
    if (!isAdmin) {
      toast.error("Apenas administradores podem confirmar pagamentos.");
      return;
    }
    const rec = records.find((r) => r.id === recordId);
    const share = rec?.shares.find((s) => s.unitId === unitId);
    const nowPaid = share ? !share.lumpSumPaid : false;

    const updated = records.map((r) => {
      if (r.id !== recordId) return r;
      return {
        ...r,
        shares: r.shares.map((sh) => {
          if (sh.unitId !== unitId) return sh;
          return {
            ...sh,
            lumpSumPaid: !sh.lumpSumPaid,
            lumpSumPaidDate: !sh.lumpSumPaid
              ? format(new Date(), "yyyy-MM-dd")
              : null,
          };
        }),
      };
    });
    persist(updated);

    // Sync to utility bills
    try {
      const bills = loadUtilityBills();
      const updatedBills = bills.map((b: any) => {
        if (
          b.iptuRecordId !== recordId ||
          b.iptuInstallmentNumber !== 0
        )
          return b;
        return {
          ...b,
          shares: b.shares.map((s: any) => {
            if (s.unitId !== unitId) return s;
            return {
              ...s,
              isPaid: nowPaid,
              paidDate: nowPaid
                ? format(new Date(), "yyyy-MM-dd")
                : null,
            };
          }),
        };
      });
      saveUtilityBills(updatedBills);
    } catch {
      /* ignore sync errors */
    }
  };

  const changePaymentMode = (
    recordId: string,
    unitId: string,
    mode: PaymentMode
  ) => {
    if (!isAdmin) {
      toast.error("Apenas administradores podem alterar a modalidade.");
      return;
    }
    const updated = records.map((r) => {
      if (r.id !== recordId) return r;
      const iptuSemLixoAprazo = r.totalAprazo - r.lixoAprazo;
      const iptuSemLixoAvista = r.totalAvista - r.lixoAvista;

      return {
        ...r,
        shares: r.shares.map((sh) => {
          if (sh.unitId !== unitId) return sh;
          const newIptuShare =
            mode === "lump_sum"
              ? Math.round(sh.fracaoIdeal * iptuSemLixoAvista * 100) / 100
              : Math.round(sh.fracaoIdeal * iptuSemLixoAprazo * 100) / 100;
          // Taxa de lixo não tem desconto — sempre igual
          const newTrashShare =
            Math.round(sh.fracaoIdeal * r.lixoAprazo * 100) / 100;
          return {
            ...sh,
            paymentMode: mode,
            iptuShare: newIptuShare,
            trashFeeShare: newTrashShare,
          };
        }),
      };
    });
    persist(updated);

    const updatedRecord = updated.find((r) => r.id === recordId);
    if (updatedRecord) generateIptuBills(updatedRecord);

    toast.success(
      mode === "lump_sum" ? "Alterado para À Vista" : "Alterado para Parcelado"
    );
  };

  const changeUnitInstallments = (
    recordId: string,
    unitId: string,
    newNumInst: number
  ) => {
    if (!isAdmin) {
      toast.error("Apenas administradores podem alterar o número de parcelas.");
      return;
    }
    const rec = records.find((r) => r.id === recordId);
    if (!rec) return;

    const firstDueDateStr = rec.firstDueDate || rec.shares[0]?.installments[0]?.dueDate || "";

    const updated = records.map((r) => {
      if (r.id !== recordId) return r;
      return {
        ...r,
        shares: r.shares.map((sh) => {
          if (sh.unitId !== unitId) return sh;
          const monthlyAmount =
            Math.round((sh.installmentTotal / newNumInst) * 100) / 100;

          // Regenerar parcelas preservando pagamentos existentes
          const installments: IptuInstallment[] = [];
          const firstDue = firstDueDateStr
            ? new Date(firstDueDateStr + "T12:00:00")
            : new Date(r.year, 0, 15);
          for (let i = 0; i < newNumInst; i++) {
            const due = new Date(firstDue);
            due.setMonth(due.getMonth() + i);
            const existInst = sh.installments[i];
            installments.push({
              number: i + 1,
              dueDate: format(due, "yyyy-MM-dd"),
              isPaid: existInst?.isPaid ?? false,
              paidDate: existInst?.paidDate ?? null,
              notes: existInst?.notes ?? "",
            });
          }

          return {
            ...sh,
            numInstallments: newNumInst,
            monthlyAmount,
            installments,
          };
        }),
      };
    });
    persist(updated);

    const updatedRecord = updated.find((r) => r.id === recordId);
    if (updatedRecord) generateIptuBills(updatedRecord);

    toast.success(`Parcelas alteradas para ${newNumInst}x`);
  };

  /* ── Print ─────────────────────────────────────────── */
  const printIptu = (record: IptuRecord) => {
    const w = window.open("", "_blank");
    if (!w) return;
    const rows = record.shares
      .map((sh) => {
        const isLump = sh.paymentMode === "lump_sum";
        const paid = isLump
          ? sh.lumpSumPaid
            ? "Sim"
            : "Não"
          : `${sh.installments.filter((i) => i.isPaid).length}/${sh.installments.length}`;
        const valorCobrado = isLump ? sh.lumpSumTotal : sh.installmentTotal;
        return `<tr>
        <td>${sh.unitName}</td>
        <td style="text-align:right">${sh.areaSqm.toLocaleString("pt-BR")} m²</td>
        <td style="text-align:right">${(sh.fracaoIdeal * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%</td>
        <td style="text-align:right">${R$(sh.iptuShare)}</td>
        <td style="text-align:right">${R$(sh.trashFeeShare)}</td>
        <td style="text-align:center"><span style="background:${isLump ? "#dcfce7" : "#dbeafe"};padding:2px 8px;border-radius:4px;font-size:9pt">${isLump ? "À Vista" : `Parcelado ${sh.numInstallments}x`}</span></td>
        <td style="text-align:right">${R$(valorCobrado)}</td>
        <td style="text-align:right">${isLump ? "\u2014" : R$(sh.monthlyAmount)}</td>
        <td style="text-align:center">${paid}</td>
      </tr>`;
      })
      .join("");

    const lumpCount = record.shares.filter(
      (s) => s.paymentMode === "lump_sum"
    ).length;
    const instCount = record.shares.filter(
      (s) => s.paymentMode === "installment"
    ).length;

    w.document.write(`<!DOCTYPE html><html><head><title>IPTU ${record.year}</title>
      <style>
        @page{margin:2cm;size:A4 landscape}
        body{font-family:sans-serif;font-size:11pt;color:#1a1a1a}
        h1{text-align:center;border-bottom:2px solid #333;padding-bottom:8px}
        table{width:100%;border-collapse:collapse;margin-top:16px}
        th,td{border:1px solid #ccc;padding:6px 10px;font-size:10pt}
        th{background:#f0f0f0;font-weight:bold}
        .info{margin-top:12px;font-size:10pt}
        .footer{margin-top:30px;font-size:9pt;color:#666;text-align:center}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      </style></head><body>
      <h1>Rateio IPTU ${record.year}</h1>
      <div class="info">
        <div class="grid">
          <p><strong>Total À Vista:</strong> ${R$(record.totalAvista)}</p>
          <p><strong>Total A Prazo:</strong> ${R$(record.totalAprazo)}</p>
          <p><strong>Taxa de Lixo:</strong> ${R$(record.lixoAprazo)} (sem desconto à vista)</p>
          <p><strong>Área Total:</strong> ${totalAreaSqm.toLocaleString("pt-BR")} m² (${record.shares.length} salas)</p>
          <p><strong>Base de Cálculo:</strong> Fração ideal por área bruta</p>
        </div>
        <p><strong>Resumo:</strong> ${lumpCount} unidade(s) à vista — ${instCount} unidade(s) parcelado</p>
        ${record.notes ? `<p><strong>Observações:</strong> ${record.notes}</p>` : ""}
      </div>
      <table>
        <thead><tr><th>Unidade</th><th>Área</th><th>Fração Ideal</th><th>IPTU</th><th>Tx Lixo</th><th>Modalidade</th><th>Valor Cobrado</th><th>Parcela</th><th>Pago</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">LocaGest — Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}</div>
      <script>window.print()<\/script></body></html>`);
    w.document.close();
  };

  const modeLabel = (m: PaymentMode) =>
    m === "lump_sum" ? "À Vista" : "Parcelado";
  const modeBadgeVariant = (m: PaymentMode) =>
    m === "lump_sum" ? ("default" as const) : ("secondary" as const);
  const modeBadgeClass = (m: PaymentMode) =>
    m === "lump_sum" ? "bg-green-600 hover:bg-green-700" : "";

  /* ── Computed for form preview ─────────────────────── */
  const previewAprazo = parseFloat(form.totalAprazo) || 0;
  const previewLixoAprazo = parseFloat(form.lixoAprazo) || 0;
  const previewCotaUnica = parseFloat(form.cotaUnica) || 0;
  const previewAvista = previewCotaUnica > 0 ? previewCotaUnica : previewAprazo;
  // Lixo NÃO tem desconto à vista
  const previewLixoAvista = previewLixoAprazo;
  const previewIptuAprazo = previewAprazo - previewLixoAprazo;
  const previewIptuAvista = previewAvista - previewLixoAvista;
  const previewDesconto = previewIptuAprazo > 0 && previewCotaUnica > 0
    ? Math.round((1 - previewIptuAvista / previewIptuAprazo) * 10000) / 100
    : 0;
  const previewNumInst = 10;
  const showPreview =
    previewAprazo > 0 &&
    allUnits.length > 0 &&
    totalAreaSqm > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            IPTU
          </h1>
          <p className="mt-1 text-muted-foreground">
            Rateio por fração ideal de área bruta &middot; À vista ou a prazo
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Novo IPTU
        </Button>
      </div>

      {!isAdmin && (
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <ShieldAlert className="h-4 w-4 flex-shrink-0" />
          <span>
            Você pode visualizar e cadastrar IPTU. Para editar ou excluir,
            solicite a um administrador.
          </span>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="glass-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 dark:bg-blue-900/30 p-2">
              <Landmark className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                IPTU (a prazo) {currentYear}
              </p>
              <p className="text-lg font-bold">{R$(totalIptu)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-green-100 dark:bg-green-900/30 p-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Recebido</p>
              <p className="text-lg font-bold text-green-600">
                {R$(totalPaid)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-yellow-100 dark:bg-yellow-900/30 p-2">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">A Receber</p>
              <p className="text-lg font-bold text-yellow-600">
                {R$(totalPending)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-red-100 dark:bg-red-900/30 p-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Atrasado</p>
              <p className="text-lg font-bold text-red-600">
                {R$(totalOverdue)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Label className="text-sm text-muted-foreground">Ano:</Label>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="glass-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ano</TableHead>
                <TableHead>À Vista</TableHead>
                <TableHead>A Prazo</TableHead>
                <TableHead>Tx Lixo</TableHead>
                <TableHead>Parcelas</TableHead>
                <TableHead>Progresso</TableHead>
                <TableHead className="w-16">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground py-8"
                  >
                    Nenhum IPTU cadastrado
                    {yearFilter !== "all" ? ` para ${yearFilter}` : ""}.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecords.map((r) => {
                  const totalShares = r.shares.length;
                  const lumpCount = r.shares.filter(
                    (s) => s.paymentMode === "lump_sum"
                  ).length;
                  const allPaidCount = r.shares.filter((sh) => {
                    if (sh.paymentMode === "lump_sum") return sh.lumpSumPaid;
                    return sh.installments.every((i) => i.isPaid);
                  }).length;
                  const pctDone =
                    totalShares > 0
                      ? Math.round((allPaidCount / totalShares) * 100)
                      : 0;

                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-bold text-lg">
                        {r.year}
                      </TableCell>
                      <TableCell className="font-medium">
                        {R$(r.totalAvista)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {R$(r.totalAprazo)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {R$(r.lixoAprazo)}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const instShares = r.shares.filter(s => s.paymentMode === "installment");
                          if (instShares.length === 0) return "À Vista";
                          const nums = instShares.map(s => s.numInstallments);
                          const min = Math.min(...nums);
                          const max = Math.max(...nums);
                          return min === max ? `${min}x` : `${min}-${max}x`;
                        })()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full transition-all"
                              style={{ width: `${pctDone}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground min-w-[60px]">
                            {allPaidCount}/{totalShares} ({lumpCount} av)
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => setViewId(r.id)}
                            >
                              <Eye className="mr-2 h-4 w-4" /> Ver Detalhes
                            </DropdownMenuItem>
                            {isAdmin && (
                              <DropdownMenuItem
                                onClick={() => handleEdit(r)}
                              >
                                <Pencil className="mr-2 h-4 w-4" /> Editar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => printIptu(r)}
                            >
                              <Printer className="mr-2 h-4 w-4" /> Imprimir
                              Rateio
                            </DropdownMenuItem>
                            {isAdmin && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => handleDelete(r.id)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Excluir
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Detail View Dialog ────────────────────────── */}
      <Dialog
        open={!!viewId}
        onOpenChange={(open) => {
          if (!open) setViewId(null);
        }}
      >
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          {viewRecord && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Landmark className="h-5 w-5" />
                  IPTU {viewRecord.year} — Rateio por Fração Ideal
                </DialogTitle>
                <DialogDescription>
                  À Vista: {R$(viewRecord.totalAvista)} · A Prazo:{" "}
                  {R$(viewRecord.totalAprazo)} · Tx Lixo:{" "}
                  {R$(viewRecord.lixoAprazo)} (sem desconto) · Área total:{" "}
                  {totalAreaSqm.toLocaleString("pt-BR")} m²
                </DialogDescription>
              </DialogHeader>

              {viewRecord.notes && (
                <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                  <strong>Observações:</strong> {viewRecord.notes}
                </div>
              )}

              <div className="space-y-4 mt-2">
                {viewRecord.shares.map((sh) => {
                  const isLump = sh.paymentMode === "lump_sum";
                  const valorCobrado = isLump
                    ? sh.lumpSumTotal
                    : sh.installmentTotal;
                  const paidAmount = computePaidFromShare(sh);
                  const pendingAmount = Math.max(0, valorCobrado - paidAmount);

                  return (
                    <Card key={sh.unitId} className="border">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            {sh.unitName}
                            <span className="text-sm font-normal text-muted-foreground">
                              ({sh.areaSqm.toLocaleString("pt-BR")} m² · Fração:{" "}
                              {fmtPct(sh.fracaoIdeal)})
                            </span>
                          </CardTitle>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Select
                              value={sh.paymentMode}
                              onValueChange={(v) =>
                                changePaymentMode(
                                  viewRecord.id,
                                  sh.unitId,
                                  v as PaymentMode
                                )
                              }
                              disabled={!isAdmin}
                            >
                              <SelectTrigger className="w-36 h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="installment">
                                  <span className="flex items-center gap-1">
                                    <Banknote className="h-3 w-3" /> Parcelado
                                  </span>
                                </SelectItem>
                                <SelectItem value="lump_sum">
                                  <span className="flex items-center gap-1">
                                    <DollarSign className="h-3 w-3" /> À Vista
                                  </span>
                                </SelectItem>
                              </SelectContent>
                            </Select>

                            {sh.paymentMode === "installment" && (
                              <Select
                                value={String(sh.numInstallments)}
                                onValueChange={(v) =>
                                  changeUnitInstallments(
                                    viewRecord.id,
                                    sh.unitId,
                                    parseInt(v)
                                  )
                                }
                                disabled={!isAdmin}
                              >
                                <SelectTrigger className="w-20 h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                                    <SelectItem key={n} value={String(n)}>
                                      {n}x
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}

                            <Badge
                              variant={modeBadgeVariant(sh.paymentMode)}
                              className={modeBadgeClass(sh.paymentMode)}
                            >
                              {modeLabel(sh.paymentMode)}
                            </Badge>
                            <Badge variant="outline">
                              Cobrado: {R$(valorCobrado)}
                            </Badge>
                            <Badge variant="default" className="bg-green-600">
                              {R$(paidAmount)} pago
                            </Badge>
                            {pendingAmount > 0 && (
                              <Badge variant="secondary">
                                {R$(pendingAmount)} pendente
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        {/* Composição do valor */}
                        <div className="rounded-lg bg-muted/50 p-3 mb-3 grid grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Fração Ideal
                            </p>
                            <p className="font-medium">
                              {fmtPct(sh.fracaoIdeal)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">
                              IPTU proporcional
                            </p>
                            <p className="font-medium">{R$(sh.iptuShare)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Recycle className="h-3 w-3" /> Tx Lixo
                              proporcional
                            </p>
                            <p className="font-medium">
                              {R$(sh.trashFeeShare)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">
                              {isLump ? "Total À Vista" : "Total A Prazo"}
                            </p>
                            <p className="font-bold">{R$(valorCobrado)}</p>
                          </div>
                        </div>

                        {isLump ? (
                          <div className="rounded-lg border p-4 space-y-3">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-muted-foreground">
                                  Valor A Prazo (referência)
                                </p>
                                <p className="font-medium line-through text-muted-foreground">
                                  {R$(sh.installmentTotal)}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">
                                  Valor À Vista
                                </p>
                                <p className="font-bold text-green-700 dark:text-green-400 text-lg">
                                  {R$(sh.lumpSumTotal)}
                                </p>
                              </div>
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={
                                    sh.lumpSumPaid ? "default" : "secondary"
                                  }
                                >
                                  {sh.lumpSumPaid ? "Pago" : "Pendente"}
                                </Badge>
                                {sh.lumpSumPaidDate && (
                                  <span className="text-sm text-muted-foreground">
                                    em{" "}
                                    {format(
                                      new Date(
                                        sh.lumpSumPaidDate + "T12:00:00"
                                      ),
                                      "dd/MM/yyyy"
                                    )}
                                  </span>
                                )}
                              </div>
                              {isAdmin && (
                                <div className="flex items-center gap-2">
                                  <Label className="text-sm">Pago:</Label>
                                  <Switch
                                    checked={sh.lumpSumPaid}
                                    onCheckedChange={() =>
                                      toggleLumpSumPaid(
                                        viewRecord.id,
                                        sh.unitId
                                      )
                                    }
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-20">
                                  Parcela
                                </TableHead>
                                <TableHead>Vencimento</TableHead>
                                <TableHead>Valor</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Pago em</TableHead>
                                <TableHead className="w-20">Ação</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sh.installments.map((inst) => {
                                const isOverdue =
                                  !inst.isPaid &&
                                  isBefore(new Date(inst.dueDate), today);
                                return (
                                  <TableRow
                                    key={inst.number}
                                    className={
                                      isOverdue ? "bg-destructive/5" : ""
                                    }
                                  >
                                    <TableCell className="font-medium">
                                      {inst.number}/
                                      {sh.numInstallments}
                                    </TableCell>
                                    <TableCell>
                                      {format(
                                        new Date(inst.dueDate + "T12:00:00"),
                                        "dd/MM/yyyy"
                                      )}
                                    </TableCell>
                                    <TableCell className="font-medium">
                                      {R$(sh.monthlyAmount)}
                                    </TableCell>
                                    <TableCell>
                                      <Badge
                                        variant={
                                          inst.isPaid
                                            ? "default"
                                            : isOverdue
                                              ? "destructive"
                                              : "secondary"
                                        }
                                      >
                                        {inst.isPaid
                                          ? "Pago"
                                          : isOverdue
                                            ? "Atrasado"
                                            : "Pendente"}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      {inst.paidDate
                                        ? format(
                                            new Date(
                                              inst.paidDate + "T12:00:00"
                                            ),
                                            "dd/MM/yyyy"
                                          )
                                        : "\u2014"}
                                    </TableCell>
                                    <TableCell>
                                      {isAdmin ? (
                                        <Switch
                                          checked={inst.isPaid}
                                          onCheckedChange={() =>
                                            toggleInstallmentPaid(
                                              viewRecord.id,
                                              sh.unitId,
                                              inst.number
                                            )
                                          }
                                        />
                                      ) : (
                                        <span className="text-xs text-muted-foreground">
                                          —
                                        </span>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <Separator />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => printIptu(viewRecord)}
                >
                  <Printer className="mr-2 h-4 w-4" /> Imprimir Rateio
                </Button>
                <Button variant="outline" onClick={() => setViewId(null)}>
                  Fechar
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Create/Edit Dialog ────────────────────────── */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) resetForm();
          setDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editId ? "Editar IPTU" : "Novo IPTU"}
            </DialogTitle>
            <DialogDescription>
              Informe os valores conforme o carnê do IPTU. O rateio é feito
              automaticamente por fração ideal de área bruta entre as salas.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ano *</Label>
                <Input
                  type="number"
                  min={2020}
                  max={2050}
                  value={form.year}
                  onChange={(e) =>
                    setForm({ ...form, year: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>1º Vencimento *</Label>
                <Input
                  type="date"
                  value={form.firstDueDate}
                  onChange={(e) =>
                    setForm({ ...form, firstDueDate: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <Separator />
            <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Landmark className="h-4 w-4" /> Valores do Carnê
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Banknote className="h-4 w-4" /> Valor Total / A Prazo (R$) *
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.totalAprazo}
                  onChange={(e) =>
                    setForm({ ...form, totalAprazo: e.target.value })
                  }
                  required
                />
                <p className="text-xs text-muted-foreground">
                  IPTU + Taxa de Lixo (valor total parcelado)
                </p>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Recycle className="h-4 w-4" /> Taxa de Lixo (R$)
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.lixoAprazo}
                  onChange={(e) =>
                    setForm({ ...form, lixoAprazo: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Parcela de lixo contida no valor total (sem desconto à vista)
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <DollarSign className="h-4 w-4" /> Valor Cota Única / À Vista (R$)
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.cotaUnica}
                onChange={(e) =>
                  setForm({ ...form, cotaUnica: e.target.value })
                }
                placeholder="Se vazio, à vista = a prazo"
              />
              <p className="text-xs text-muted-foreground">
                Valor para pagamento em cota única. Se vazio, considera o mesmo valor a prazo.
              </p>
            </div>

            {/* Resumo calculado */}
            {previewAprazo > 0 && (
              <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3 text-sm space-y-1">
                <p className="font-medium flex items-center gap-1">
                  <Calculator className="h-4 w-4" /> Valores Calculados
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <span className="text-muted-foreground">Total a prazo:</span>
                  <span className="font-medium">{R$(previewAprazo)}</span>

                  <span className="text-muted-foreground">Cota única (à vista):</span>
                  <span className="font-bold text-green-700 dark:text-green-400">
                    {R$(previewAvista)}
                  </span>

                  {previewDesconto > 0 && (
                    <>
                      <span className="text-muted-foreground">Desconto à vista (só IPTU):</span>
                      <span className="font-medium text-green-700 dark:text-green-400">
                        {previewDesconto}% (economia: {R$(previewAprazo - previewAvista)})
                      </span>
                    </>
                  )}

                  {previewLixoAprazo > 0 && (
                    <>
                      <span className="text-muted-foreground">Taxa de Lixo (sem desconto):</span>
                      <span className="font-medium">{R$(previewLixoAprazo)}</span>

                      <span className="text-muted-foreground">IPTU sem lixo (a prazo):</span>
                      <span className="font-medium">{R$(previewIptuAprazo)}</span>

                      <span className="text-muted-foreground">IPTU sem lixo (à vista):</span>
                      <span className="font-medium text-green-700 dark:text-green-400">{R$(previewIptuAvista)}</span>
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={form.notes}
                onChange={(e) =>
                  setForm({ ...form, notes: e.target.value })
                }
                rows={2}
              />
            </div>

            {/* Preview */}
            {showPreview && (
              <>
                <Separator />
                <div className="rounded-lg bg-muted p-4 space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Calculator className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium text-sm">
                      Prévia do Rateio por Fração Ideal
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">
                      Área total (todas as salas):
                    </span>
                    <span className="font-medium">
                      {totalAreaSqm.toLocaleString("pt-BR")} m² (
                      {allUnits.length} salas)
                    </span>
                  </div>
                  <Separator className="my-2" />
                  <div className="space-y-2 text-sm">
                    {allUnits.map((u) => {
                      const area = Number(u.area_sqm);
                      const fracao =
                        totalAreaSqm > 0 ? area / totalAreaSqm : 0;
                      const unitAprazo = fracao * previewAprazo;
                      const unitAvista = fracao * previewAvista;
                      const unitLixo = fracao * previewLixoAprazo; // Lixo sem desconto
                      const unitIptuAprazo = unitAprazo - unitLixo;
                      const unitIptuAvista = unitAvista - unitLixo;
                      const monthly = unitAprazo / previewNumInst;
                      return (
                        <div
                          key={u.id}
                          className="rounded border p-2 space-y-1"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-medium">
                              {u.name} (
                              {area.toLocaleString("pt-BR")} m²)
                            </span>
                            <Badge variant="outline" className="text-xs">
                              Fração:{" "}
                              {(fracao * 100).toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                              })}
                              %
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>
                              A Prazo:{" "}
                              <span className="text-foreground font-bold">
                                {R$(unitAprazo)}
                              </span>{" "}
                              ({previewNumInst}x {R$(monthly)})
                            </span>
                            <span>
                              À Vista:{" "}
                              <span className="text-green-700 dark:text-green-400 font-bold">
                                {R$(unitAvista)}
                              </span>
                            </span>
                            <span>
                              IPTU (a prazo):{" "}
                              <span className="text-foreground font-medium">
                                {R$(unitIptuAprazo)}
                              </span>
                            </span>
                            <span>
                              IPTU (à vista):{" "}
                              <span className="text-foreground font-medium">
                                {R$(unitIptuAvista)}
                              </span>
                            </span>
                            <span>
                              Lixo (sem desconto):{" "}
                              <span className="text-foreground font-medium">
                                {R$(unitLixo)}
                              </span>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            <Button type="submit" className="w-full">
              {editId ? "Salvar Alterações" : "Cadastrar IPTU"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IPTU;
