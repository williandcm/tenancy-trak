import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  CreditCard, Plus, MoreHorizontal, CheckCircle2, Search,
  DollarSign, AlertTriangle, Clock, TrendingUp, Printer,
  Pencil, Trash2, CalendarDays, Download, ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { format, isBefore, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";

const Payments = () => {
  const { hasPermission } = useAuth();
  const isAdmin = hasPermission("admin");

  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "pending" | "paid" | "overdue">("all");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [paidDate, setPaidDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [lateFee, setLateFee] = useState("0");
  const [payNotes, setPayNotes] = useState("");
  const [form, setForm] = useState({
    contract_id: "", amount: "", due_date: "", notes: "",
  });
  const [editId, setEditId] = useState<string | null>(null);
  const [genContractId, setGenContractId] = useState("");
  const [genMonths, setGenMonths] = useState("12");

  const { data: payments, isLoading } = useQuery({
    queryKey: ["payments-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*, contracts(monthly_rent, payment_day, late_fee_percent, late_fee_max_percent, units(name), tenants(full_name))")
        .order("due_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: contracts } = useQuery({
    queryKey: ["contracts-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("*, units(name), tenants(full_name)")
        .in("status", ["active", "pending"]);
      if (error) throw error;
      return data;
    },
  });

  const today = new Date();

  const savePayment = useMutation({
    mutationFn: async () => {
      const payload = {
        contract_id: form.contract_id,
        amount: parseFloat(form.amount),
        due_date: form.due_date,
        notes: form.notes || null,
      };
      if (editId) {
        const { error } = await supabase.from("payments").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("payments").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments-full"] });
      setDialogOpen(false);
      setEditId(null);
      setForm({ contract_id: "", amount: "", due_date: "", notes: "" });
      toast.success(editId ? "Pagamento atualizado!" : "Pagamento registrado!");
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });

  const markPaid = useMutation({
    mutationFn: async () => {
      if (!selectedPayment) return;
      const { error } = await supabase.from("payments").update({
        is_paid: true,
        paid_date: paidDate,
        late_fee: parseFloat(lateFee) || 0,
        notes: payNotes || selectedPayment.notes,
      }).eq("id", selectedPayment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments-full"] });
      setPayDialogOpen(false);
      setSelectedPayment(null);
      toast.success("Pagamento confirmado!");
    },
    onError: () => toast.error("Erro ao confirmar pagamento."),
  });

  const undoPaid = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payments").update({
        is_paid: false, paid_date: null, late_fee: 0,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments-full"] });
      toast.success("Pagamento estornado!");
    },
  });

  const deletePayment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments-full"] });
      toast.success("Pagamento removido!");
    },
  });

  const generatePayments = useMutation({
    mutationFn: async () => {
      const contract = contracts?.find((c) => c.id === genContractId);
      if (!contract) throw new Error("Contrato não encontrado");
      const months = parseInt(genMonths);
      const inserts = [];
      for (let i = 0; i < months; i++) {
        const dueDate = addMonths(new Date(contract.start_date + "T12:00:00"), i);
        dueDate.setDate(contract.payment_day);
        inserts.push({
          contract_id: contract.id,
          amount: Number(contract.monthly_rent),
          due_date: format(dueDate, "yyyy-MM-dd"),
        });
      }
      const { error } = await supabase.from("payments").insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments-full"] });
      setGenerateOpen(false);
      toast.success("Parcelas geradas com sucesso!");
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });

  const openPay = (p: any) => {
    setSelectedPayment(p);
    setPaidDate(format(new Date(), "yyyy-MM-dd"));
    const isOverdue = isBefore(new Date(p.due_date), today);
    if (isOverdue && p.contracts) {
      const days = Math.ceil((today.getTime() - new Date(p.due_date).getTime()) / 86400000);
      const feePercent = Number(p.contracts.late_fee_percent || 0.33);
      const maxPercent = Number(p.contracts.late_fee_max_percent || 20);
      const calcFee = Math.min(days * feePercent, maxPercent) / 100 * Number(p.amount);
      setLateFee(calcFee.toFixed(2));
    } else {
      setLateFee("0");
    }
    setPayNotes(p.notes || "");
    setPayDialogOpen(true);
  };

  const handleEdit = (p: any) => {
    if (!isAdmin) {
      toast.error("Apenas administradores podem editar pagamentos.");
      return;
    }
    setEditId(p.id);
    setForm({
      contract_id: p.contract_id,
      amount: String(p.amount),
      due_date: p.due_date,
      notes: p.notes || "",
    });
    setDialogOpen(true);
  };

  const filtered = payments?.filter((p: any) => {
    const isOverdue = !p.is_paid && isBefore(new Date(p.due_date), today);
    if (filter === "paid" && !p.is_paid) return false;
    if (filter === "pending" && (p.is_paid || isOverdue)) return false;
    if (filter === "overdue" && !isOverdue) return false;
    if (search) {
      const s = search.toLowerCase();
      return p.contracts?.tenants?.full_name?.toLowerCase().includes(s) ||
             p.contracts?.units?.name?.toLowerCase().includes(s);
    }
    return true;
  });

  const totalReceived = payments?.filter((p) => p.is_paid).reduce((s, p) => s + Number(p.amount) + Number(p.late_fee || 0), 0) ?? 0;
  const totalPending = payments?.filter((p) => !p.is_paid && !isBefore(new Date(p.due_date), today)).reduce((s, p) => s + Number(p.amount), 0) ?? 0;
  const totalOverdue = payments?.filter((p) => !p.is_paid && isBefore(new Date(p.due_date), today)).reduce((s, p) => s + Number(p.amount), 0) ?? 0;
  const overdueCount = payments?.filter((p) => !p.is_paid && isBefore(new Date(p.due_date), today)).length ?? 0;

  const money = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const exportCSV = () => {
    if (!filtered || filtered.length === 0) return;
    const rows = filtered.map((p: any) => ({
      Inquilino: p.contracts?.tenants?.full_name || "",
      Unidade: p.contracts?.units?.name || "",
      Vencimento: p.due_date,
      Valor: Number(p.amount).toFixed(2).replace(".", ","),
      Multa: Number(p.late_fee || 0).toFixed(2).replace(".", ","),
      "Pago em": p.paid_date || "",
      Status: p.is_paid ? "Pago" : isBefore(new Date(p.due_date), today) ? "Atrasado" : "Pendente",
      Observações: p.notes || "",
    }));
    const keys = Object.keys(rows[0]);
    const header = keys.join(";");
    const csv = "\uFEFF" + [header, ...rows.map((r) => keys.map((k) => String((r as any)[k])).join(";"))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pagamentos-${format(today, "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado com sucesso!");
  };
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Pagamentos</h1>
          <p className="mt-1 text-muted-foreground">Controle de recebimentos de aluguéis</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="mr-2 h-4 w-4" /> Exportar CSV
          </Button>
          <Button variant="outline" onClick={() => setGenerateOpen(true)}>
            <CalendarDays className="mr-2 h-4 w-4" /> Gerar Parcelas
          </Button>
          <Button onClick={() => { setEditId(null); setForm({ contract_id: "", amount: "", due_date: "", notes: "" }); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Novo Pagamento
          </Button>
        </div>
      </div>

      {!isAdmin && (
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <ShieldAlert className="h-4 w-4 flex-shrink-0" />
          <span>
            Você pode visualizar e registrar pagamentos. Para editar, excluir ou
            confirmar, solicite a um administrador.
          </span>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="glass-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-green-100 dark:bg-green-900/30 p-2"><DollarSign className="h-5 w-5 text-green-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Recebido</p>
              <p className="text-lg font-bold text-green-600">{money(totalReceived)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-yellow-100 dark:bg-yellow-900/30 p-2"><Clock className="h-5 w-5 text-yellow-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">A Receber</p>
              <p className="text-lg font-bold text-yellow-600">{money(totalPending)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-red-100 dark:bg-red-900/30 p-2"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Atrasado ({overdueCount})</p>
              <p className="text-lg font-bold text-red-600">{money(totalOverdue)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 dark:bg-blue-900/30 p-2"><TrendingUp className="h-5 w-5 text-blue-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Total Geral</p>
              <p className="text-lg font-bold">{money(totalReceived + totalPending + totalOverdue)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por inquilino ou unidade..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1 border rounded-lg p-1">
          {([["all", "Todos"], ["pending", "Pendentes"], ["paid", "Pagos"], ["overdue", "Atrasados"]] as const).map(([key, label]) => (
            <Button key={key} variant={filter === key ? "default" : "ghost"} size="sm" onClick={() => setFilter(key)}>{label}</Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card className="glass-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Inquilino</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Multa</TableHead>
                <TableHead>Pago em</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
              ) : filtered?.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum pagamento encontrado</TableCell></TableRow>
              ) : (
                filtered?.map((p: any) => {
                  const isOverdue = !p.is_paid && isBefore(new Date(p.due_date), today);
                  return (
                    <TableRow key={p.id} className={isOverdue ? "bg-destructive/5" : ""}>
                      <TableCell className="font-medium">{p.contracts?.tenants?.full_name}</TableCell>
                      <TableCell>{p.contracts?.units?.name}</TableCell>
                      <TableCell>{format(new Date(p.due_date + "T12:00:00"), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="font-medium">{money(Number(p.amount))}</TableCell>
                      <TableCell>{Number(p.late_fee) > 0 ? money(Number(p.late_fee)) : "—"}</TableCell>
                      <TableCell>{p.paid_date ? format(new Date(p.paid_date + "T12:00:00"), "dd/MM/yyyy") : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={p.is_paid ? "default" : isOverdue ? "destructive" : "secondary"}>
                          {p.is_paid ? "Pago" : isOverdue ? "Atrasado" : "Pendente"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {!p.is_paid && isAdmin && (
                              <DropdownMenuItem onClick={() => openPay(p)}>
                                <CheckCircle2 className="mr-2 h-4 w-4" /> Confirmar Pagamento
                              </DropdownMenuItem>
                            )}
                            {p.is_paid && isAdmin && (
                              <DropdownMenuItem onClick={() => undoPaid.mutate(p.id)}>
                                <Clock className="mr-2 h-4 w-4" /> Estornar
                              </DropdownMenuItem>
                            )}
                            {isAdmin && (
                              <DropdownMenuItem onClick={() => handleEdit(p)}>
                                <Pencil className="mr-2 h-4 w-4" /> Editar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => printReceipt(p)}>
                              <Printer className="mr-2 h-4 w-4" /> Recibo
                            </DropdownMenuItem>
                            {isAdmin && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm("Excluir?")) deletePayment.mutate(p.id); }}>
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

      {/* Pay Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={(open) => { if (!open) setSelectedPayment(null); setPayDialogOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Pagamento</DialogTitle>
            <DialogDescription>
              {selectedPayment?.contracts?.tenants?.full_name} · {selectedPayment?.contracts?.units?.name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); markPaid.mutate(); }} className="space-y-4">
            <div className="rounded-lg bg-muted p-4 text-center">
              <p className="text-sm text-muted-foreground">Valor da Parcela</p>
              <p className="text-2xl font-bold">{selectedPayment ? money(Number(selectedPayment.amount)) : ""}</p>
            </div>
            <div className="space-y-2">
              <Label>Data do Pagamento</Label>
              <Input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Multa / Juros (R$)</Label>
              <Input type="number" step="0.01" value={lateFee} onChange={(e) => setLateFee(e.target.value)} />
            </div>
            {Number(lateFee) > 0 && (
              <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 p-3 text-center">
                <p className="text-xs text-muted-foreground">Total com Multa</p>
                <p className="text-xl font-bold text-yellow-700 dark:text-yellow-400">
                  {money(Number(selectedPayment?.amount ?? 0) + Number(lateFee))}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={payNotes} onChange={(e) => setPayNotes(e.target.value)} rows={2} />
            </div>
            <Button type="submit" className="w-full" disabled={markPaid.isPending}>
              {markPaid.isPending ? "Confirmando..." : "Confirmar Pagamento"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setEditId(null); } setDialogOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Pagamento" : "Novo Pagamento"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); savePayment.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label>Contrato *</Label>
              <Select value={form.contract_id} onValueChange={(v) => setForm({ ...form, contract_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o contrato" /></SelectTrigger>
                <SelectContent>
                  {contracts?.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.units?.name} · {c.tenants?.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor (R$) *</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Vencimento *</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
            <Button type="submit" className="w-full" disabled={savePayment.isPending}>
              {savePayment.isPending ? "Salvando..." : editId ? "Salvar" : "Registrar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Generate Payments Dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gerar Parcelas Automáticas</DialogTitle>
            <DialogDescription>Crie várias parcelas de pagamento de uma vez para um contrato ativo.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); generatePayments.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label>Contrato *</Label>
              <Select value={genContractId} onValueChange={setGenContractId}>
                <SelectTrigger><SelectValue placeholder="Selecione o contrato" /></SelectTrigger>
                <SelectContent>
                  {contracts?.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.units?.name} · {c.tenants?.full_name} · R$ {Number(c.monthly_rent).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Número de Parcelas</Label>
              <Input type="number" min={1} max={60} value={genMonths} onChange={(e) => setGenMonths(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={generatePayments.isPending}>
              {generatePayments.isPending ? "Gerando..." : "Gerar Parcelas"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

function printReceipt(p: any) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><title>Recibo</title>
    <style>@page{margin:2cm;size:A4}body{font-family:serif;font-size:12pt;line-height:1.6;color:#1a1a1a}
    h1{text-align:center;border-bottom:2px solid #333;padding-bottom:8px}
    .row{display:flex;justify-content:space-between;margin:8px 0}
    .sig{margin-top:60px;display:flex;justify-content:space-around;text-align:center}
    .sig div{border-top:1px solid #333;padding-top:4px;min-width:200px}
    </style></head><body>
    <h1>RECIBO DE PAGAMENTO</h1>
    <p><strong>Inquilino:</strong> ${p.contracts?.tenants?.full_name || "—"}</p>
    <p><strong>Unidade:</strong> ${p.contracts?.units?.name || "—"}</p>
    <div class="row"><span><strong>Vencimento:</strong> ${format(new Date(p.due_date + "T12:00:00"), "dd/MM/yyyy")}</span>
    <span><strong>Pago em:</strong> ${p.paid_date ? format(new Date(p.paid_date + "T12:00:00"), "dd/MM/yyyy") : "—"}</span></div>
    <div class="row"><span><strong>Valor:</strong> R$ ${Number(p.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
    <span><strong>Multa:</strong> R$ ${Number(p.late_fee || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
    <div class="row"><span><strong>Total:</strong> R$ ${(Number(p.amount) + Number(p.late_fee || 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
    ${p.notes ? `<p><strong>Observações:</strong> ${p.notes}</p>` : ""}
    <div class="sig"><div>Locador</div><div>Locatário</div></div>
    <script>window.print()</script></body></html>`);
  w.document.close();
}

export default Payments;
