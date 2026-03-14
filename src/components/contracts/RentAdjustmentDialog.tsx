import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  TrendingUp, AlertTriangle, CalendarDays, ArrowRight,
  Calculator, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { format, addMonths, differenceInMonths, isAfter, isBefore, addYears } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Contract {
  id: string;
  unit_id: string;
  tenant_id: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  adjustment_index: string;
  status: string;
  units?: { name: string; address_number: string };
  tenants?: { full_name: string };
  last_adjustment_date?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contracts: Contract[];
  onApplyAdjustment: (contractId: string, newRent: number, adjustmentDate: string) => void;
  applying?: boolean;
}

const money = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function RentAdjustmentDialog({ open, onOpenChange, contracts, onApplyAdjustment, applying }: Props) {
  const [adjustmentPercent, setAdjustmentPercent] = useState("4.50");
  const [adjustmentDate, setAdjustmentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedContracts, setSelectedContracts] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"auto" | "manual">("manual");
  const [customPercents, setCustomPercents] = useState<Record<string, string>>({});

  // Filter only active contracts
  const eligibleContracts = useMemo(() => {
    return contracts.filter((c) => c.status === "active").map((c) => {
      const startDate = new Date(c.start_date + "T12:00:00");
      const monthsSinceStart = differenceInMonths(new Date(), startDate);
      const anniversaryDate = addYears(startDate, Math.max(1, Math.floor(monthsSinceStart / 12)));
      const lastAdj = c.last_adjustment_date ? new Date(c.last_adjustment_date + "T12:00:00") : null;
      const monthsSinceAdj = lastAdj ? differenceInMonths(new Date(), lastAdj) : monthsSinceStart;
      const needsAdjustment = monthsSinceAdj >= 12;

      return {
        ...c,
        monthsSinceStart,
        anniversaryDate,
        monthsSinceAdj,
        needsAdjustment,
      };
    }).sort((a, b) => a.units?.name?.localeCompare(b.units?.name ?? "") ?? 0);
  }, [contracts]);

  const toggleContract = (id: string) => {
    setSelectedContracts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedContracts.size === eligibleContracts.length) {
      setSelectedContracts(new Set());
    } else {
      setSelectedContracts(new Set(eligibleContracts.map((c) => c.id)));
    }
  };

  const getPercent = (contractId: string) => {
    if (mode === "manual" && customPercents[contractId]) {
      return parseFloat(customPercents[contractId]) || 0;
    }
    return parseFloat(adjustmentPercent) || 0;
  };

  const handleApply = () => {
    if (selectedContracts.size === 0) {
      toast.error("Selecione ao menos um contrato");
      return;
    }

    let applied = 0;
    selectedContracts.forEach((contractId) => {
      const contract = eligibleContracts.find((c) => c.id === contractId);
      if (!contract) return;
      const percent = getPercent(contractId);
      const newRent = contract.monthly_rent * (1 + percent / 100);
      onApplyAdjustment(contractId, Math.round(newRent * 100) / 100, adjustmentDate);
      applied++;
    });

    if (applied > 0) {
      toast.success(`Reajuste aplicado em ${applied} contrato(s)!`);
      setSelectedContracts(new Set());
    }
  };

  const totalOldRent = eligibleContracts
    .filter((c) => selectedContracts.has(c.id))
    .reduce((s, c) => s + c.monthly_rent, 0);
  const totalNewRent = eligibleContracts
    .filter((c) => selectedContracts.has(c.id))
    .reduce((s, c) => s + c.monthly_rent * (1 + getPercent(c.id) / 100), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90dvh] overflow-y-auto sm:w-full rounded-xl p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <TrendingUp className="h-5 w-5 text-primary" />
            Reajuste de Aluguel
          </DialogTitle>
          <DialogDescription>
            Aplique reajuste anual nos aluguéis dos contratos ativos conforme índice de correção.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Percentual de Reajuste (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={adjustmentPercent}
                onChange={(e) => setAdjustmentPercent(e.target.value)}
                placeholder="Ex: 4.50"
              />
              <p className="text-xs text-muted-foreground">
                Consulte o índice acumulado (IGP-M, IPCA) dos últimos 12 meses
              </p>
            </div>
            <div className="space-y-2">
              <Label>Data do Reajuste</Label>
              <Input
                type="date"
                value={adjustmentDate}
                onChange={(e) => setAdjustmentDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Modo</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as "auto" | "manual")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Mesmo % para todos</SelectItem>
                  <SelectItem value="manual">% individual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Contracts table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Contratos Ativos ({eligibleContracts.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={selectAll}>
                {selectedContracts.size === eligibleContracts.length ? "Desmarcar Todos" : "Selecionar Todos"}
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead>Inquilino</TableHead>
                      <TableHead>Índice</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Meses</TableHead>
                      <TableHead>Aluguel Atual</TableHead>
                      {mode === "manual" && <TableHead>%</TableHead>}
                      <TableHead>Novo Valor</TableHead>
                      <TableHead>Diferença</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eligibleContracts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                          Nenhum contrato ativo encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      eligibleContracts.map((c) => {
                        const pct = getPercent(c.id);
                        const newRent = c.monthly_rent * (1 + pct / 100);
                        const diff = newRent - c.monthly_rent;
                        return (
                          <TableRow key={c.id} className={selectedContracts.has(c.id) ? "bg-primary/5" : ""}>
                            <TableCell>
                              <Checkbox
                                checked={selectedContracts.has(c.id)}
                                onCheckedChange={() => toggleContract(c.id)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{c.units?.name}</TableCell>
                            <TableCell>{c.tenants?.full_name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{c.adjustment_index}</Badge>
                            </TableCell>
                            <TableCell>{format(new Date(c.start_date + "T12:00:00"), "dd/MM/yyyy")}</TableCell>
                            <TableCell>
                              <Badge variant={c.needsAdjustment ? "destructive" : "secondary"}>
                                {c.monthsSinceAdj}m
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">{money(c.monthly_rent)}</TableCell>
                            {mode === "manual" && (
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={customPercents[c.id] ?? adjustmentPercent}
                                  onChange={(e) => setCustomPercents((p) => ({ ...p, [c.id]: e.target.value }))}
                                  className="w-20 h-8"
                                />
                              </TableCell>
                            )}
                            <TableCell className="font-bold text-green-600">
                              {money(newRent)}
                            </TableCell>
                            <TableCell className="text-primary font-medium">
                              +{money(diff)}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Summary */}
          {selectedContracts.size > 0 && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      {selectedContracts.size} contrato(s) selecionado(s)
                    </p>
                    <div className="flex items-center gap-4">
                      <div>
                        <span className="text-xs text-muted-foreground">Atual:</span>
                        <span className="ml-1 font-bold">{money(totalOldRent)}</span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className="text-xs text-muted-foreground">Novo:</span>
                        <span className="ml-1 font-bold text-green-600">{money(totalNewRent)}</span>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Diferença:</span>
                        <span className="ml-1 font-bold text-primary">+{money(totalNewRent - totalOldRent)}/mês</span>
                      </div>
                    </div>
                  </div>
                  <Button onClick={handleApply} disabled={applying} className="min-w-[200px]">
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {applying ? "Aplicando..." : "Aplicar Reajuste"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
