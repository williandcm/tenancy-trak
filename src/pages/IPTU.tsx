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
  Percent,
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
  /** IPTU rateado por m² (parcelado) */
  iptuShare: number;
  /** Taxa do lixo dividida igualmente */
  trashFeeShare: number;
  /** Total parcelado = iptuShare + trashFeeShare */
  installmentTotal: number;
  /** Parcela mensal (installmentTotal / numInstallments) */
  monthlyAmount: number;
  /** Total à vista com desconto */
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
  /** Valor total do IPTU (sem taxa do lixo) */
  iptuAmount: number;
  /** Valor total da taxa do lixo */
  trashFee: number;
  /** Área base (m²) usada como divisor do IPTU — conforme boleto */
  baseAreaSqm: number;
  /** Valor total do carnê PARCELADO (iptuAmount + trashFee) */
  totalInstallment: number;
  /** Valor total do carnê À VISTA */
  totalLumpSum: number;
  /** Desconto % ao inquilino que pagar à vista */
  tenantDiscountPercent: number;
  numInstallments: number;
  notes: string;
  shares: IptuUnitShare[];
  createdAt: string;
}

const IPTU_KEY = "locagest-iptu";

const loadRecords = (): IptuRecord[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(IPTU_KEY) || "[]") as any[];
    return raw.map((r) => {
      const iptuAmount = r.iptuAmount ?? r.totalInstallment ?? r.totalAmount ?? 0;
      const trashFee = r.trashFee ?? 0;
      const totalInstallment = r.totalInstallment ?? r.totalAmount ?? 0;
      return {
        ...r,
        iptuAmount,
        trashFee,
        totalInstallment,
        baseAreaSqm: r.baseAreaSqm ?? 0,
        totalLumpSum: r.totalLumpSum ?? totalInstallment,
        tenantDiscountPercent: r.tenantDiscountPercent ?? 0,
        shares: (r.shares ?? []).map((sh: any) => ({
          ...sh,
          iptuShare: sh.iptuShare ?? sh.installmentTotal ?? sh.monthlyAmount * (r.numInstallments ?? 1),
          trashFeeShare: sh.trashFeeShare ?? 0,
          installmentTotal:
            sh.installmentTotal ?? sh.monthlyAmount * (r.numInstallments ?? 1),
          lumpSumTotal:
            sh.lumpSumTotal ?? sh.installmentTotal ?? sh.monthlyAmount * (r.numInstallments ?? 1),
          paymentMode: sh.paymentMode ?? "installment",
          lumpSumPaid: sh.lumpSumPaid ?? false,
          lumpSumPaidDate: sh.lumpSumPaidDate ?? null,
        })),
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
  try { return JSON.parse(localStorage.getItem(BILLS_KEY) || "[]"); }
  catch { return []; }
};

const saveUtilityBills = (bills: any[]) => {
  localStorage.setItem(BILLS_KEY, JSON.stringify(bills));
};

/** Remove all utility bills linked to a given IPTU record */
const removeIptuBills = (iptuRecordId: string) => {
  const bills = loadUtilityBills();
  saveUtilityBills(bills.filter((b) => b.iptuRecordId !== iptuRecordId));
};

/** Generate utility bills from an IPTU record.
 *  - Parcelado: one bill per installment (monthlyAmount per unit).
 *  - À vista: one single bill (lumpSumTotal per unit, due on 1st installment date).
 */
const generateIptuBills = (record: IptuRecord) => {
  const bills = loadUtilityBills();

  // Remove previous bills for this record
  const filtered = bills.filter((b: any) => b.iptuRecordId !== record.id);

  const numInstallments = record.numInstallments;

  // Separate units by payment mode
  const installmentShares = record.shares.filter((sh) => sh.paymentMode === "installment");
  const lumpSumShares = record.shares.filter((sh) => sh.paymentMode === "lump_sum");

  // ── Parcelado bills: one bill per installment ──
  for (let i = 0; i < numInstallments; i++) {
    const shares = installmentShares.map((sh) => {
      const inst = sh.installments[i];
      return {
        unitId: sh.unitId,
        unitName: sh.unitName,
        amount: sh.monthlyAmount,
        isPaid: inst?.isPaid ?? false,
        paidDate: inst?.paidDate ?? null,
      };
    });

    // Also include lump_sum units with amount=0 so cobranças can still track them
    // (they won't add cost but won't break the view)
    // Actually, lump_sum units get their own separate bill below, so skip them here.

    if (shares.length === 0) continue; // No installment units for this record

    const totalAmount = shares.reduce((sum, s) => sum + s.amount, 0);
    const dueDate = record.shares[0]?.installments[i]?.dueDate || "";
    const [dueYear, dueMonth] = dueDate ? dueDate.split("-") : [String(record.year), "01"];

    filtered.push({
      id: crypto.randomUUID(),
      connectionId: "IPTU",
      billType: "iptu",
      referenceMonth: `${dueYear}-${dueMonth}`,
      totalAmount: Math.round(totalAmount * 100) / 100,
      dueDate,
      billDate: format(new Date(), "yyyy-MM-dd"),
      notes: `IPTU ${record.year} — Parcela ${i + 1}/${numInstallments}`,
      shares,
      createdAt: new Date().toISOString(),
      iptuRecordId: record.id,
      iptuInstallmentNumber: i + 1,
    });
  }

  // ── À Vista bill: single bill for lump_sum units ──
  if (lumpSumShares.length > 0) {
    const firstDueDate = record.shares[0]?.installments[0]?.dueDate || "";
    const [dueYear, dueMonth] = firstDueDate ? firstDueDate.split("-") : [String(record.year), "01"];

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
      iptuInstallmentNumber: 0, // 0 = à vista
    });
  }

  saveUtilityBills(filtered);
};

const R$ = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

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
    iptuAmount: "",
    trashFee: "",
    baseAreaSqm: "",
    totalLumpSum: "",
    tenantDiscountPercent: "5",
    numInstallments: "10",
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
  const unitCount = allUnits.length;

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
  const totalIptu = yearRecords.reduce(
    (s, r) => s + r.totalInstallment,
    0
  );

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
      iptuAmount: "",
      trashFee: "",
      baseAreaSqm: "",
      totalLumpSum: "",
      tenantDiscountPercent: "5",
      numInstallments: "10",
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

    const iptuVal = parseFloat(form.iptuAmount);
    const trashVal = parseFloat(form.trashFee) || 0;
    const totalLump = parseFloat(form.totalLumpSum);

    if (!iptuVal || iptuVal <= 0) {
      toast.error("Informe o valor do IPTU.");
      return;
    }
    if (!totalLump || totalLump <= 0) {
      toast.error("Informe o valor à vista do carnê.");
      return;
    }

    const numInst = parseInt(form.numInstallments);
    if (!numInst || numInst < 1 || numInst > 12) {
      toast.error("Número de parcelas deve ser entre 1 e 12.");
      return;
    }

    const discountPct = parseFloat(form.tenantDiscountPercent) || 0;
    if (discountPct < 0 || discountPct > 100) {
      toast.error("Desconto deve ser entre 0% e 100%.");
      return;
    }

    const baseArea = parseFloat(form.baseAreaSqm) || totalAreaSqm;
    if (baseArea <= 0) {
      toast.error("Informe a área base (m²) do boleto.");
      return;
    }

    const totalInstallment = iptuVal + trashVal;
    const iptuPerSqm = iptuVal / baseArea;
    const trashPerUnit = unitCount > 0 ? trashVal / unitCount : 0;
    const lumpPerSqm = totalLump / baseArea;

    const shares: IptuUnitShare[] = allUnits.map((u) => {
      const area = Number(u.area_sqm);
      const iptuShare = Math.round(iptuPerSqm * area * 100) / 100;
      const trashFeeShare = Math.round(trashPerUnit * 100) / 100;
      const unitInstTotal = iptuShare + trashFeeShare;
      const unitLumpRateio = Math.round(lumpPerSqm * area * 100) / 100;
      const unitLumpWithDiscount =
        Math.round(unitLumpRateio * (1 - discountPct / 100) * 100) / 100;
      const monthlyAmount = Math.round((unitInstTotal / numInst) * 100) / 100;

      const installments: IptuInstallment[] = [];
      const firstDue = new Date(form.firstDueDate + "T12:00:00");
      for (let i = 0; i < numInst; i++) {
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

      let paymentMode: PaymentMode = "installment";
      let lumpSumPaid = false;
      let lumpSumPaidDate: string | null = null;

      if (editId) {
        const existing = records.find((r) => r.id === editId);
        const existingShare = existing?.shares.find(
          (s) => s.unitId === u.id
        );
        if (existingShare) {
          paymentMode = existingShare.paymentMode;
          lumpSumPaid = existingShare.lumpSumPaid;
          lumpSumPaidDate = existingShare.lumpSumPaidDate;
          installments.forEach((inst, idx) => {
            const existInst = existingShare.installments[idx];
            if (existInst) {
              inst.isPaid = existInst.isPaid;
              inst.paidDate = existInst.paidDate;
              inst.notes = existInst.notes;
            }
          });
        }
      }

      return {
        unitId: u.id,
        unitName: u.name,
        areaSqm: area,
        iptuShare,
        trashFeeShare,
        installmentTotal: unitInstTotal,
        monthlyAmount,
        lumpSumTotal: unitLumpWithDiscount,
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
              iptuAmount: iptuVal,
              trashFee: trashVal,
              baseAreaSqm: baseArea,
              totalInstallment,
              totalLumpSum: totalLump,
              tenantDiscountPercent: discountPct,
              numInstallments: numInst,
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
        iptuAmount: iptuVal,
        trashFee: trashVal,
        baseAreaSqm: baseArea,
        totalInstallment,
        totalLumpSum: totalLump,
        tenantDiscountPercent: discountPct,
        numInstallments: numInst,
        notes: form.notes,
        shares,
        createdAt: new Date().toISOString(),
      };
      persist([newRecord, ...records]);
      generateIptuBills(newRecord);
      toast.success(
        "IPTU cadastrado! IPTU rateado por m² + taxa do lixo dividida igualmente."
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
      iptuAmount: String(record.iptuAmount),
      trashFee: String(record.trashFee),
      baseAreaSqm: String(record.baseAreaSqm || ""),
      totalLumpSum: String(record.totalLumpSum),
      tenantDiscountPercent: String(record.tenantDiscountPercent),
      numInstallments: String(record.numInstallments),
      firstDueDate:
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
        if (b.iptuRecordId !== recordId || b.iptuInstallmentNumber !== instNumber) return b;
        return {
          ...b,
          shares: b.shares.map((s: any) => {
            if (s.unitId !== unitId) return s;
            return { ...s, isPaid: nowPaid, paidDate: nowPaid ? format(new Date(), "yyyy-MM-dd") : null };
          }),
        };
      });
      saveUtilityBills(updatedBills);
    } catch { /* ignore sync errors */ }
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

    // Sync to utility bills (à vista bill has iptuInstallmentNumber === 0)
    try {
      const bills = loadUtilityBills();
      const updatedBills = bills.map((b: any) => {
        if (b.iptuRecordId !== recordId || b.iptuInstallmentNumber !== 0) return b;
        return {
          ...b,
          shares: b.shares.map((s: any) => {
            if (s.unitId !== unitId) return s;
            return { ...s, isPaid: nowPaid, paidDate: nowPaid ? format(new Date(), "yyyy-MM-dd") : null };
          }),
        };
      });
      saveUtilityBills(updatedBills);
    } catch { /* ignore sync errors */ }
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
      return {
        ...r,
        shares: r.shares.map((sh) => {
          if (sh.unitId !== unitId) return sh;
          return { ...sh, paymentMode: mode };
        }),
      };
    });
    persist(updated);

    // Regenerate utility bills to reflect the new payment mode
    const updatedRecord = updated.find((r) => r.id === recordId);
    if (updatedRecord) generateIptuBills(updatedRecord);

    toast.success(
      mode === "lump_sum" ? "Alterado para À Vista" : "Alterado para Parcelado"
    );
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
        const economia = isLump ? sh.installmentTotal - sh.lumpSumTotal : 0;
        return `<tr>
        <td>${sh.unitName}</td>
        <td style="text-align:right">${sh.areaSqm.toLocaleString("pt-BR")} m²</td>
        <td style="text-align:right">${R$(sh.iptuShare)}</td>
        <td style="text-align:right">${R$(sh.trashFeeShare)}</td>
        <td style="text-align:center"><span style="background:${isLump ? "#dcfce7" : "#dbeafe"};padding:2px 8px;border-radius:4px;font-size:9pt">${isLump ? "À Vista" : "Parcelado"}</span></td>
        <td style="text-align:right">${R$(valorCobrado)}</td>
        <td style="text-align:right">${isLump ? "\u2014" : R$(sh.monthlyAmount)}</td>
        <td style="text-align:right">${economia > 0 ? R$(economia) : "\u2014"}</td>
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
        .highlight{background:#fef9c3;padding:4px 8px;border-radius:4px;font-weight:bold}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      </style></head><body>
      <h1>Rateio IPTU ${record.year}</h1>
      <div class="info">
        <div class="grid">
          <p><strong>IPTU:</strong> ${R$(record.iptuAmount)} (rateado por m²)</p>
          <p><strong>Taxa do Lixo:</strong> ${R$(record.trashFee)} (÷ ${record.shares.length} salas = ${R$(record.trashFee / record.shares.length)}/sala)</p>
          <p><strong>Total Parcelado:</strong> ${R$(record.totalInstallment)} em ${record.numInstallments}x</p>
          <p><strong>Total À Vista (carnê):</strong> ${R$(record.totalLumpSum)}</p>
          <p><strong>Desconto Inquilino (à vista):</strong> <span class="highlight">${record.tenantDiscountPercent}%</span></p>
          <p><strong>Área Base (boleto):</strong> ${(record.baseAreaSqm || totalAreaSqm).toLocaleString("pt-BR")} m² · <strong>IPTU/m²:</strong> ${R$(record.iptuAmount / (record.baseAreaSqm || totalAreaSqm))}</p>
        </div>
        <p><strong>Resumo:</strong> ${lumpCount} unidade(s) à vista — ${instCount} unidade(s) parcelado</p>
        ${record.notes ? `<p><strong>Observações:</strong> ${record.notes}</p>` : ""}
      </div>
      <table>
        <thead><tr><th>Unidade</th><th>Área</th><th>IPTU (m²)</th><th>Tx Lixo</th><th>Modalidade</th><th>Valor Cobrado</th><th>Parcela</th><th>Economia</th><th>Pago</th></tr></thead>
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
  const previewIptu = parseFloat(form.iptuAmount) || 0;
  const previewTrash = parseFloat(form.trashFee) || 0;
  const previewTotal = previewIptu + previewTrash;
  const previewLump = parseFloat(form.totalLumpSum) || 0;
  const previewDiscount = parseFloat(form.tenantDiscountPercent) || 0;
  const previewNumInst = parseInt(form.numInstallments) || 1;
  const previewBaseArea = parseFloat(form.baseAreaSqm) || totalAreaSqm;
  const showPreview =
    previewIptu > 0 &&
    previewLump > 0 &&
    allUnits.length > 0 &&
    previewBaseArea > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            IPTU
          </h1>
          <p className="mt-1 text-muted-foreground">
            IPTU rateado por m² + Taxa do Lixo dividida igualmente &middot; À
            vista ou parcelado
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
                IPTU + Lixo {currentYear}
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
                <TableHead>IPTU</TableHead>
                <TableHead>Tx Lixo</TableHead>
                <TableHead>Total Parc.</TableHead>
                <TableHead>À Vista</TableHead>
                <TableHead>Desc.</TableHead>
                <TableHead>Parcelas</TableHead>
                <TableHead>Progresso</TableHead>
                <TableHead className="w-16">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
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
                  const pct =
                    totalShares > 0
                      ? Math.round((allPaidCount / totalShares) * 100)
                      : 0;

                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-bold text-lg">
                        {r.year}
                      </TableCell>
                      <TableCell className="font-medium">
                        {R$(r.iptuAmount)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {R$(r.trashFee)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {R$(r.totalInstallment)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {R$(r.totalLumpSum)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        >
                          <Percent className="mr-1 h-3 w-3" />
                          {r.tenantDiscountPercent}%
                        </Badge>
                      </TableCell>
                      <TableCell>{r.numInstallments}x</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
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
                  IPTU {viewRecord.year} — Rateio por Unidade
                </DialogTitle>
                <DialogDescription>
                  IPTU: {R$(viewRecord.iptuAmount)} (por m²) · Taxa Lixo:{" "}
                  {R$(viewRecord.trashFee)} (÷ {viewRecord.shares.length}{" "}
                  salas) · Total Parcelado:{" "}
                  {R$(viewRecord.totalInstallment)} ({viewRecord.numInstallments}
                  x) · À Vista: {R$(viewRecord.totalLumpSum)} · Desc:{" "}
                  {viewRecord.tenantDiscountPercent}% · Área base:{" "}
                  {(viewRecord.baseAreaSqm || totalAreaSqm).toLocaleString("pt-BR")} m²
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
                  const economia = sh.installmentTotal - sh.lumpSumTotal;
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
                              ({sh.areaSqm.toLocaleString("pt-BR")} m²)
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
                            {isLump && economia > 0 && (
                              <Badge
                                variant="outline"
                                className="border-green-500 text-green-700 dark:text-green-400"
                              >
                                <Percent className="mr-1 h-3 w-3" />
                                Economia: {R$(economia)}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        {/* Composição do valor */}
                        <div className="rounded-lg bg-muted/50 p-3 mb-3 grid grid-cols-3 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">
                              IPTU (por m²)
                            </p>
                            <p className="font-medium">{R$(sh.iptuShare)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Recycle className="h-3 w-3" /> Tx Lixo
                            </p>
                            <p className="font-medium">
                              {R$(sh.trashFeeShare)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Total Parcelado
                            </p>
                            <p className="font-bold">
                              {R$(sh.installmentTotal)}
                            </p>
                          </div>
                        </div>

                        {isLump ? (
                          <div className="rounded-lg border p-4 space-y-3">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-muted-foreground">
                                  Valor Parcelado (sem desconto)
                                </p>
                                <p className="font-medium line-through text-muted-foreground">
                                  {R$(sh.installmentTotal)}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">
                                  Valor À Vista (com{" "}
                                  {viewRecord.tenantDiscountPercent}% desc.)
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
                                <TableHead className="w-20">Parcela</TableHead>
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
                                      {viewRecord.numInstallments}
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
                                        <span className="text-xs text-muted-foreground">—</span>
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
              Informe o valor do IPTU e a taxa do lixo separadamente. O IPTU
              será rateado por m² e a taxa do lixo dividida igualmente entre
              as salas.
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
                <Label>Nº de Parcelas *</Label>
                <Select
                  value={form.numInstallments}
                  onValueChange={(v) =>
                    setForm({ ...form, numInstallments: v })
                  }
                >
                  <SelectTrigger>
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
              </div>
            </div>

            <Separator />
            <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Landmark className="h-4 w-4" /> Valores do Carnê
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor do IPTU (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.iptuAmount}
                  onChange={(e) =>
                    setForm({ ...form, iptuAmount: e.target.value })
                  }
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Rateado por m² entre as salas
                </p>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Recycle className="h-4 w-4" /> Taxa do Lixo (R$)
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.trashFee}
                  onChange={(e) =>
                    setForm({ ...form, trashFee: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Dividida igualmente entre as {unitCount} salas
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Área Base para Rateio (m²) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder={totalAreaSqm.toLocaleString("pt-BR")}
                value={form.baseAreaSqm}
                onChange={(e) =>
                  setForm({ ...form, baseAreaSqm: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Área total conforme boleto do IPTU. O IPTU será dividido por
                essa metragem. Salas cadastradas somam{" "}
                {totalAreaSqm.toLocaleString("pt-BR")} m².
              </p>
            </div>

            {previewIptu > 0 && (
              <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3 text-sm">
                <p className="font-medium">
                  Total Parcelado (IPTU + Lixo):{" "}
                  <span className="text-blue-700 dark:text-blue-400">
                    {R$(previewTotal)}
                  </span>
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Valor À Vista do Carnê (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={form.totalLumpSum}
                onChange={(e) =>
                  setForm({ ...form, totalLumpSum: e.target.value })
                }
                required
              />
              <p className="text-xs text-muted-foreground">
                Valor total se pagar à vista (conforme carnê)
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Percent className="h-4 w-4" /> Desconto para Inquilino (à
                vista) *
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={form.tenantDiscountPercent}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      tenantDiscountPercent: e.target.value,
                    })
                  }
                  className="w-24"
                  required
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Desconto adicional sobre o valor à vista rateado para o
                inquilino. Use 0% para repassar o valor à vista integral do
                carnê.
              </p>
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
                    <p className="font-medium text-sm">Prévia do Rateio</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Área base:</span>
                    <span className="font-medium">
                      {previewBaseArea.toLocaleString("pt-BR")} m²
                    </span>
                    <span className="text-muted-foreground">
                      IPTU/m²:
                    </span>
                    <span className="font-medium">
                      {R$(previewIptu / previewBaseArea)}
                    </span>
                    <span className="text-muted-foreground">
                      Tx Lixo/sala:
                    </span>
                    <span className="font-medium">
                      {unitCount > 0
                        ? R$(previewTrash / unitCount)
                        : "—"}
                    </span>
                  </div>
                  <Separator className="my-2" />
                  <div className="space-y-2 text-sm">
                    {allUnits.map((u) => {
                      const area = Number(u.area_sqm);
                      const iptuSh =
                        (previewIptu / previewBaseArea) * area;
                      const trashSh =
                        unitCount > 0 ? previewTrash / unitCount : 0;
                      const unitInst = iptuSh + trashSh;
                      const unitLumpRateio =
                        (previewLump / previewBaseArea) * area;
                      const unitLump =
                        unitLumpRateio * (1 - previewDiscount / 100);
                      const monthly = unitInst / previewNumInst;
                      const economia = unitInst - unitLump;
                      return (
                        <div
                          key={u.id}
                          className="rounded border p-2 space-y-1"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-medium">
                              {u.name} ({area.toLocaleString("pt-BR")} m²)
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-1 text-xs text-muted-foreground">
                            <span>
                              IPTU:{" "}
                              <span className="text-foreground font-medium">
                                {R$(iptuSh)}
                              </span>
                            </span>
                            <span>
                              Lixo:{" "}
                              <span className="text-foreground font-medium">
                                {R$(trashSh)}
                              </span>
                            </span>
                            <span>
                              Total:{" "}
                              <span className="text-foreground font-bold">
                                {R$(unitInst)}
                              </span>
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                            <span>
                              Parcelado:{" "}
                              <span className="text-foreground font-medium">
                                {R$(unitInst)} ({previewNumInst}x{" "}
                                {R$(monthly)})
                              </span>
                            </span>
                            <span>
                              À Vista:{" "}
                              <span className="text-green-700 dark:text-green-400 font-medium">
                                {R$(unitLump)}
                              </span>
                              {economia > 0 && (
                                <span className="text-green-600">
                                  {" "}
                                  (-{R$(economia)})
                                </span>
                              )}
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
