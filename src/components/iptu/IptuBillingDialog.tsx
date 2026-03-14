import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Landmark,
  Building2,
  DollarSign,
  Banknote,
  AlertTriangle,
  Calculator,
  FileCheck,
  Recycle,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

/* ── IPTU types (must match IPTU.tsx) ─────────────────── */
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
  fracaoIdeal: number;
  iptuShare: number;
  trashFeeShare: number;
  installmentTotal: number;
  numInstallments: number;
  monthlyAmount: number;
  lumpSumTotal: number;
  paymentMode: PaymentMode;
  installments: IptuInstallment[];
  lumpSumPaid: boolean;
  lumpSumPaidDate: string | null;
}

interface IptuRecord {
  id: string;
  year: number;
  totalAvista: number;
  totalAprazo: number;
  lixoAvista: number;
  lixoAprazo: number;
  descontoAvista: number;
  firstDueDate: string;
  notes: string;
  shares: IptuUnitShare[];
  createdAt: string;
  /* legacy */
  numInstallments?: number;
  iptuAmount?: number;
  trashFee?: number;
  baseAreaSqm?: number;
  totalInstallment?: number;
  totalLumpSum?: number;
  tenantDiscountPercent?: number;
}

/* ── localStorage helpers ─────────────────────────────── */
const IPTU_KEY = "locagest-iptu";
const BILLS_KEY = "locagest-utility-bills";

const loadIptuRecords = (): IptuRecord[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(IPTU_KEY) || "[]");
    return raw.map((r: any) => {
      const totalAprazo =
        r.totalAprazo ??
        r.totalInstallment ??
        (((r.iptuAmount ?? 0) + (r.trashFee ?? 0)) || 0);
      const totalAvista = r.totalAvista ?? r.totalLumpSum ?? totalAprazo;
      const lixoAprazo = r.lixoAprazo ?? r.trashFee ?? 0;
      const lixoAvista = lixoAprazo; // Lixo não tem desconto à vista

      // Desconto à vista baseado apenas no IPTU (sem lixo)
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
        shares: (r.shares || []).map((sh: any) => {
          const legacyNumInst = sh.numInstallments ?? r.numInstallments ?? 10;
          return {
            ...sh,
            fracaoIdeal: sh.fracaoIdeal ?? 0,
            numInstallments: legacyNumInst,
            paymentMode: sh.paymentMode ?? "installment",
            installments: sh.installments ?? [],
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

const saveIptuRecords = (records: IptuRecord[]) => {
  localStorage.setItem(IPTU_KEY, JSON.stringify(records));
};

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

const R$ = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const fmtPct = (v: number) =>
  `${(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%`;

/** Regenerate utility bills from IPTU record */
const regenerateBills = (record: IptuRecord) => {
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

  // Parcelado bills
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

  // À Vista bill
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

/* ── Component ──────────────────────────────────────────── */
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBillsGenerated: () => void;
}

const IptuBillingDialog = ({
  open,
  onOpenChange,
  onBillsGenerated,
}: Props) => {
  const currentYear = new Date().getFullYear();
  const [records, setRecords] = useState<IptuRecord[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<string>("");
  const [modes, setModes] = useState<Record<string, PaymentMode>>({});

  useEffect(() => {
    if (open) {
      const loaded = loadIptuRecords();
      setRecords(loaded);

      const currentYearRecord = loaded.find((r) => r.year === currentYear);
      if (currentYearRecord) {
        setSelectedRecordId(currentYearRecord.id);
        const m: Record<string, PaymentMode> = {};
        currentYearRecord.shares.forEach((sh) => {
          m[sh.unitId] = sh.paymentMode;
        });
        setModes(m);
      } else if (loaded.length > 0) {
        setSelectedRecordId(loaded[0].id);
        const m: Record<string, PaymentMode> = {};
        loaded[0].shares.forEach((sh) => {
          m[sh.unitId] = sh.paymentMode;
        });
        setModes(m);
      }
    }
  }, [open, currentYear]);

  const selectedRecord = records.find((r) => r.id === selectedRecordId);

  const handleRecordChange = (id: string) => {
    setSelectedRecordId(id);
    const rec = records.find((r) => r.id === id);
    if (rec) {
      const m: Record<string, PaymentMode> = {};
      rec.shares.forEach((sh) => {
        m[sh.unitId] = sh.paymentMode;
      });
      setModes(m);
    }
  };

  const toggleMode = (unitId: string) => {
    setModes((prev) => ({
      ...prev,
      [unitId]: prev[unitId] === "lump_sum" ? "installment" : "lump_sum",
    }));
  };

  const setAllMode = (mode: PaymentMode) => {
    if (!selectedRecord) return;
    const m: Record<string, PaymentMode> = {};
    selectedRecord.shares.forEach((sh) => {
      m[sh.unitId] = mode;
    });
    setModes(m);
  };

  const summary = useMemo(() => {
    if (!selectedRecord)
      return {
        totalCobranca: 0,
        totalEconomia: 0,
        lumpCount: 0,
        installmentCount: 0,
        shares: [],
      };

    const iptuSemLixoAprazo = selectedRecord.totalAprazo - selectedRecord.lixoAprazo;
    const iptuSemLixoAvista = selectedRecord.totalAvista - selectedRecord.lixoAvista;

    const shares = selectedRecord.shares.map((sh) => {
      const mode = modes[sh.unitId] || "installment";
      const valorCobrado =
        mode === "lump_sum" ? sh.lumpSumTotal : sh.installmentTotal;
      const economia =
        mode === "lump_sum"
          ? sh.installmentTotal - sh.lumpSumTotal
          : 0;
      const iptuShare =
        mode === "lump_sum"
          ? Math.round(sh.fracaoIdeal * iptuSemLixoAvista * 100) / 100
          : Math.round(sh.fracaoIdeal * iptuSemLixoAprazo * 100) / 100;
      // Taxa de lixo não tem desconto — sempre igual
      const trashFeeShare =
        Math.round(sh.fracaoIdeal * selectedRecord.lixoAprazo * 100) / 100;
      return {
        ...sh,
        selectedMode: mode,
        valorCobrado,
        economia,
        iptuShare,
        trashFeeShare,
      };
    });

    const totalCobranca = shares.reduce((sum, s) => sum + s.valorCobrado, 0);
    const totalEconomia = shares.reduce((sum, s) => sum + s.economia, 0);
    const lumpCount = shares.filter(
      (s) => s.selectedMode === "lump_sum"
    ).length;
    const installmentCount = shares.filter(
      (s) => s.selectedMode === "installment"
    ).length;

    return { totalCobranca, totalEconomia, lumpCount, installmentCount, shares };
  }, [selectedRecord, modes]);

  const handleLancarCobranca = () => {
    if (!selectedRecord) return;

    const iptuSemLixoAprazo = selectedRecord.totalAprazo - selectedRecord.lixoAprazo;
    const iptuSemLixoAvista = selectedRecord.totalAvista - selectedRecord.lixoAvista;

    const updatedRecords = records.map((r) => {
      if (r.id !== selectedRecord.id) return r;
      return {
        ...r,
        shares: r.shares.map((sh) => {
          const mode = modes[sh.unitId] || sh.paymentMode;
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

    saveIptuRecords(updatedRecords);

    const updatedRecord = updatedRecords.find(
      (r) => r.id === selectedRecord.id
    );
    if (updatedRecord) {
      regenerateBills(updatedRecord);
    }

    toast.success(
      `Cobrança de IPTU ${selectedRecord.year} lançada! ${summary.lumpCount} à vista, ${summary.installmentCount} parcelado.`
    );

    onBillsGenerated();
    onOpenChange(false);
  };

  const hasChanges = useMemo(() => {
    if (!selectedRecord) return false;
    return selectedRecord.shares.some(
      (sh) => (modes[sh.unitId] || sh.paymentMode) !== sh.paymentMode
    );
  }, [selectedRecord, modes]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90dvh] overflow-y-auto sm:w-full rounded-xl p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5" />
            Lançar Cobrança de IPTU
          </DialogTitle>
          <DialogDescription>
            Os valores são preenchidos automaticamente com base no lançamento do
            IPTU. Selecione a modalidade (à vista ou a prazo) para cada
            unidade.
          </DialogDescription>
        </DialogHeader>

        {records.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground font-medium">
                Nenhum IPTU cadastrado
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Cadastre o IPTU na página de IPTU antes de lançar cobranças.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-5">
            {/* Year / Record selector */}
            <div className="flex items-center gap-3">
              <Label className="text-sm font-medium whitespace-nowrap">
                IPTU:
              </Label>
              <Select
                value={selectedRecordId}
                onValueChange={handleRecordChange}
              >
                <SelectTrigger className="w-60">
                  <SelectValue placeholder="Selecione o IPTU" />
                </SelectTrigger>
                <SelectContent>
                  {records.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      IPTU {r.year} — {R$(r.totalAprazo)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedRecord && (
              <>
                {/* Record summary */}
                <Card className="glass-card bg-muted/30">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Total À Vista
                        </p>
                        <p className="font-bold text-green-700 dark:text-green-400">
                          {R$(selectedRecord.totalAvista)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Total A Prazo
                        </p>
                        <p className="font-bold">
                          {R$(selectedRecord.totalAprazo)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Recycle className="h-3 w-3" /> Taxa de Lixo (sem desconto)
                        </p>
                        <p className="font-bold">
                          {R$(selectedRecord.lixoAprazo)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">
                    Definir todas:
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAllMode("installment")}
                  >
                    <Banknote className="mr-1.5 h-3.5 w-3.5" />
                    Todas Parcelado
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAllMode("lump_sum")}
                  >
                    <DollarSign className="mr-1.5 h-3.5 w-3.5" />
                    Todas À Vista
                  </Button>
                </div>

                {/* Per-unit table */}
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Unidade</TableHead>
                          <TableHead className="text-right">Área</TableHead>
                          <TableHead className="text-right">
                            Fração Ideal
                          </TableHead>
                          <TableHead className="text-right">IPTU</TableHead>
                          <TableHead className="text-right">
                            Tx Lixo
                          </TableHead>
                          <TableHead className="text-right">
                            A Prazo
                          </TableHead>
                          <TableHead className="text-right">
                            À Vista
                          </TableHead>
                          <TableHead className="text-center">
                            Modalidade
                          </TableHead>
                          <TableHead className="text-right">
                            Valor Cobrado
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summary.shares.map((sh) => {
                          const isLump = sh.selectedMode === "lump_sum";
                          return (
                            <TableRow key={sh.unitId}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4 text-muted-foreground" />
                                  {sh.unitName}
                                </div>
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {sh.areaSqm.toLocaleString("pt-BR")} m²
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {fmtPct(sh.fracaoIdeal)}
                              </TableCell>
                              <TableCell className="text-right">
                                {R$(sh.iptuShare)}
                              </TableCell>
                              <TableCell className="text-right">
                                {R$(sh.trashFeeShare)}
                              </TableCell>
                              <TableCell className="text-right">
                                <span
                                  className={
                                    !isLump
                                      ? "font-bold"
                                      : "text-muted-foreground"
                                  }
                                >
                                  {R$(sh.installmentTotal)}
                                </span>
                                {!isLump && (
                                  <p className="text-[10px] text-muted-foreground">
                                    {sh.numInstallments}x de{" "}
                                    {R$(sh.monthlyAmount)}
                                  </p>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <span
                                  className={
                                    isLump
                                      ? "font-bold text-green-700 dark:text-green-400"
                                      : "text-muted-foreground"
                                  }
                                >
                                  {R$(sh.lumpSumTotal)}
                                </span>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <span
                                    className={`text-xs ${!isLump ? "font-semibold" : "text-muted-foreground"}`}
                                  >
                                    Parc.
                                  </span>
                                  <Switch
                                    checked={isLump}
                                    onCheckedChange={() =>
                                      toggleMode(sh.unitId)
                                    }
                                  />
                                  <span
                                    className={`text-xs ${isLump ? "font-semibold text-green-700 dark:text-green-400" : "text-muted-foreground"}`}
                                  >
                                    À Vista
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="font-bold text-base">
                                  {R$(sh.valorCobrado)}
                                </span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Summary footer */}
                <Card className="border-2 border-primary/20">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Calculator className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {summary.installmentCount} parcelado
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-green-600" />
                          <span className="text-sm text-muted-foreground">
                            {summary.lumpCount} à vista
                          </span>
                        </div>
                        {summary.totalEconomia > 0 && (
                          <Badge
                            variant="outline"
                            className="border-green-500 text-green-700 dark:text-green-400"
                          >
                            Economia total: {R$(summary.totalEconomia)}
                          </Badge>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          Total a Cobrar
                        </p>
                        <p className="text-2xl font-bold">
                          {R$(summary.totalCobranca)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {hasChanges
                      ? "⚠️ A modalidade de pagamento foi alterada. Ao confirmar, as cobranças serão atualizadas."
                      : "As cobranças serão geradas/atualizadas nas Contas e Cobranças."}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => onOpenChange(false)}
                    >
                      Cancelar
                    </Button>
                    <Button onClick={handleLancarCobranca}>
                      <FileCheck className="mr-2 h-4 w-4" />
                      Lançar Cobrança
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default IptuBillingDialog;
