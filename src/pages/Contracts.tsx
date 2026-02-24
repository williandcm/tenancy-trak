import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Plus, Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

const statusMap = {
  active: { label: "Ativo", variant: "default" as const },
  pending: { label: "Pendente", variant: "secondary" as const },
  expired: { label: "Expirado", variant: "outline" as const },
  terminated: { label: "Rescindido", variant: "destructive" as const },
};

const Contracts = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    unit_id: "", tenant_id: "", landlord_id: "", second_landlord_id: "",
    start_date: "", end_date: "", duration_months: "36",
    monthly_rent: "", payment_day: "20", deposit_amount: "",
    status: "pending" as string,
  });

  const { data: contracts, isLoading } = useQuery({
    queryKey: ["contracts-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("*, units(name, address_number), tenants(full_name), landlords!contracts_landlord_id_fkey(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: units } = useQuery({
    queryKey: ["units"],
    queryFn: async () => {
      const { data, error } = await supabase.from("units").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: tenants } = useQuery({
    queryKey: ["tenants"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tenants").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: landlords } = useQuery({
    queryKey: ["landlords"],
    queryFn: async () => {
      const { data, error } = await supabase.from("landlords").select("*").eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const saveContract = useMutation({
    mutationFn: async () => {
      const payload = {
        unit_id: form.unit_id,
        tenant_id: form.tenant_id,
        landlord_id: form.landlord_id,
        second_landlord_id: form.second_landlord_id || null,
        start_date: form.start_date,
        end_date: form.end_date,
        duration_months: parseInt(form.duration_months),
        monthly_rent: parseFloat(form.monthly_rent),
        payment_day: parseInt(form.payment_day),
        deposit_amount: form.deposit_amount ? parseFloat(form.deposit_amount) : null,
        status: form.status as Tables<"contracts">["status"],
      };
      const { error } = await supabase.from("contracts").insert(payload);
      if (error) throw error;

      // Update unit status to occupied if contract is active
      if (form.status === "active") {
        await supabase.from("units").update({ status: "occupied" as const, monthly_rent: parseFloat(form.monthly_rent) }).eq("id", form.unit_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts-full"] });
      queryClient.invalidateQueries({ queryKey: ["units"] });
      setDialogOpen(false);
      toast.success("Contrato criado!");
    },
    onError: () => toast.error("Erro ao criar contrato."),
  });

  const updateField = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Contratos</h1>
          <p className="mt-1 text-muted-foreground">Gerencie contratos de locação</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Novo Contrato
        </Button>
      </div>

      <Card className="glass-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unidade</TableHead>
                <TableHead>Inquilino</TableHead>
                <TableHead>Locador</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Término</TableHead>
                <TableHead>Aluguel</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : contracts?.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhum contrato cadastrado</TableCell></TableRow>
              ) : (
                contracts?.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.units?.name} ({c.units?.address_number})</TableCell>
                    <TableCell>{c.tenants?.full_name}</TableCell>
                    <TableCell>{c.landlords?.full_name}</TableCell>
                    <TableCell>{format(new Date(c.start_date), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{format(new Date(c.end_date), "dd/MM/yyyy")}</TableCell>
                    <TableCell>R$ {Number(c.monthly_rent).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell>
                      <Badge variant={statusMap[c.status as keyof typeof statusMap]?.variant}>
                        {statusMap[c.status as keyof typeof statusMap]?.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Contrato de Locação</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveContract.mutate(); }} className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Unidade *</Label>
              <Select value={form.unit_id} onValueChange={(v) => updateField("unit_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {units?.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name} ({u.address_number})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Inquilino *</Label>
              <Select value={form.tenant_id} onValueChange={(v) => updateField("tenant_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {tenants?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Locador Principal *</Label>
              <Select value={form.landlord_id} onValueChange={(v) => updateField("landlord_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {landlords?.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Segundo Locador (opcional)</Label>
              <Select value={form.second_landlord_id} onValueChange={(v) => updateField("second_landlord_id", v)}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  {landlords?.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data Início *</Label>
              <Input type="date" value={form.start_date} onChange={(e) => updateField("start_date", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Data Término *</Label>
              <Input type="date" value={form.end_date} onChange={(e) => updateField("end_date", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Duração (meses)</Label>
              <Input type="number" value={form.duration_months} onChange={(e) => updateField("duration_months", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Aluguel Mensal (R$) *</Label>
              <Input type="number" step="0.01" value={form.monthly_rent} onChange={(e) => updateField("monthly_rent", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Dia do Vencimento</Label>
              <Input type="number" min={1} max={31} value={form.payment_day} onChange={(e) => updateField("payment_day", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fiança (R$)</Label>
              <Input type="number" step="0.01" value={form.deposit_amount} onChange={(e) => updateField("deposit_amount", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => updateField("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="active">Ativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Button type="submit" className="w-full" disabled={saveContract.isPending}>
                {saveContract.isPending ? "Salvando..." : "Criar Contrato"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Contracts;
