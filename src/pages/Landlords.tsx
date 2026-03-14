import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { UserCheck, Plus, MoreHorizontal, Pencil, Trash2, Search, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useCep } from "@/hooks/useCep";
import { maskCpf, maskRg, maskCep } from "@/lib/masks";
import { useAuth } from "@/hooks/useAuth";

const emptyForm = {
  full_name: "", nationality: "brasileiro(a)", marital_status: "casado(a)",
  rg: "", rg_issuer: "SSP/SP", cpf: "", address: "",
  address_number: "", neighborhood: "", complement: "",
  city: "Hortolândia", state: "São Paulo", cep: "",
};

const Landlords = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const isAdmin = hasPermission("admin");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const { fetchCep, loading: cepLoading } = useCep();

  const handleCepChange = (cep: string) => {
    const masked = maskCep(cep);
    update("cep", masked);
    fetchCep(masked, (result) => {
      setForm((prev) => ({
        ...prev,
        address: result.address || prev.address,
        neighborhood: result.neighborhood || prev.neighborhood,
        complement: result.complement || prev.complement,
        city: result.city || prev.city,
        state: result.state || prev.state,
      }));
    });
  };

  const { data: landlords, isLoading } = useQuery({
    queryKey: ["landlords-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("landlords").select("*").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const saveLandlord = useMutation({
    mutationFn: async () => {
      const tryPayload = async (payload: Record<string, any>) => {
        if (editId) {
          const { error } = await supabase.from("landlords").update(payload).eq("id", editId);
          return error;
        } else {
          const { error } = await supabase.from("landlords").insert(payload);
          return error;
        }
      };

      let error = await tryPayload(form);
      if (error && error.code === "42703") {
        // Column not found — strip new columns and retry
        const { address_number, neighborhood, complement, ...rest } = form;
        error = await tryPayload(rest);
      }
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landlords-all"] });
      queryClient.invalidateQueries({ queryKey: ["landlords"] });
      setDialogOpen(false);
      resetForm();
      toast.success(editId ? "Locador atualizado!" : "Locador cadastrado!");
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("landlords").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landlords-all"] });
      queryClient.invalidateQueries({ queryKey: ["landlords"] });
      toast.success("Status atualizado!");
    },
  });

  const deleteLandlord = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("landlords").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landlords-all"] });
      queryClient.invalidateQueries({ queryKey: ["landlords"] });
      toast.success("Locador removido!");
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });

  const resetForm = () => { setEditId(null); setForm(emptyForm); };

  const handleNew = () => { resetForm(); setDialogOpen(true); };

  const handleEdit = (l: any) => {
    if (!isAdmin) {
      toast.error("Apenas administradores podem editar locadores.");
      return;
    }
    setEditId(l.id);
    setForm({
      full_name: l.full_name || "", nationality: l.nationality || "brasileiro(a)",
      marital_status: l.marital_status || "", rg: l.rg || "", rg_issuer: l.rg_issuer || "SSP/SP",
      cpf: l.cpf || "", address: l.address || "",
      address_number: l.address_number || "", neighborhood: l.neighborhood || "",
      complement: l.complement || "",
      city: l.city || "", state: l.state || "", cep: l.cep || "",
    });
    setDialogOpen(true);
  };

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const filtered = landlords?.filter((l) =>
    l.full_name.toLowerCase().includes(search.toLowerCase()) ||
    l.cpf.includes(search)
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Locadores</h1>
          <p className="mt-1 text-muted-foreground">Gerencie os proprietários dos imóveis</p>
        </div>
        <Button onClick={handleNew}><Plus className="mr-2 h-4 w-4" /> Novo Locador</Button>
      </div>

      {!isAdmin && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>Modo visualização — Você pode visualizar e cadastrar locadores. Para editar ou excluir, solicite a um administrador.</span>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar locador..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card className="glass-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>RG</TableHead>
                <TableHead>Estado Civil</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
              ) : filtered?.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum locador cadastrado</TableCell></TableRow>
              ) : (
                filtered?.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.full_name}</TableCell>
                    <TableCell>{l.cpf}</TableCell>
                    <TableCell>{l.rg} ({l.rg_issuer})</TableCell>
                    <TableCell className="capitalize">{l.marital_status}</TableCell>
                    <TableCell>{l.city}/{l.state}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch checked={l.is_active ?? true} onCheckedChange={(checked) => { if (!isAdmin) { toast.error("Apenas administradores podem alterar o status."); return; } toggleActive.mutate({ id: l.id, is_active: checked }); }} disabled={!isAdmin} />
                        <span className={`text-xs ${l.is_active ? "text-green-600" : "text-red-500"}`}>
                          {l.is_active ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {isAdmin && (
                          <>
                          <DropdownMenuItem onClick={() => handleEdit(l)}><Pencil className="mr-2 h-4 w-4" /> Editar</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm("Excluir este locador?")) deleteLandlord.mutate(l.id); }}>
                            <Trash2 className="mr-2 h-4 w-4" /> Excluir
                          </DropdownMenuItem>
                          </>
                          )}
                          {!isAdmin && (
                            <DropdownMenuItem disabled className="text-muted-foreground text-xs">Sem ações disponíveis</DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Locador" : "Novo Locador"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveLandlord.mutate(); }} className="grid grid-cols-2 gap-4" autoComplete="off">
            <div className="col-span-2 space-y-2">
              <Label>Nome Completo *</Label>
              <Input value={form.full_name} onChange={(e) => update("full_name", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>CPF *</Label>
              <Input value={form.cpf} onChange={(e) => update("cpf", maskCpf(e.target.value))} required placeholder="000.000.000-00" />
            </div>
            <div className="space-y-2">
              <Label>RG *</Label>
              <Input value={form.rg} onChange={(e) => update("rg", maskRg(e.target.value))} required placeholder="00.000.000-0" />
            </div>
            <div className="space-y-2">
              <Label>Órgão Emissor</Label>
              <Input value={form.rg_issuer} onChange={(e) => update("rg_issuer", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Nacionalidade</Label>
              <Input value={form.nationality} onChange={(e) => update("nationality", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Estado Civil</Label>
              <Input value={form.marital_status} onChange={(e) => update("marital_status", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>CEP</Label>
              <div className="relative">
                <Input value={form.cep} onChange={(e) => handleCepChange(e.target.value)} maxLength={9} autoComplete="off" />
                {cepLoading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input value={form.city} onChange={(e) => update("city", e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label>Endereço (Rua) *</Label>
              <Input value={form.address} onChange={(e) => update("address", e.target.value)} required autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label>Número</Label>
              <Input value={form.address_number} onChange={(e) => update("address_number", e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label>Bairro</Label>
              <Input value={form.neighborhood} onChange={(e) => update("neighborhood", e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label>Complemento</Label>
              <Input value={form.complement} onChange={(e) => update("complement", e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Input value={form.state} onChange={(e) => update("state", e.target.value)} autoComplete="off" />
            </div>
            <div className="col-span-2">
              <Button type="submit" className="w-full" disabled={saveLandlord.isPending}>
                {saveLandlord.isPending ? "Salvando..." : editId ? "Salvar Alterações" : "Cadastrar Locador"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Landlords;
