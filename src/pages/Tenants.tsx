import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const Tenants = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: "", cpf: "", rg: "", rg_issuer: "",
    address: "", city: "", state: "", cep: "",
    phone: "", email: "", nationality: "brasileiro(a)",
  });

  const { data: tenants, isLoading } = useQuery({
    queryKey: ["tenants"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tenants").select("*").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const saveTenant = useMutation({
    mutationFn: async () => {
      if (editId) {
        const { error } = await supabase.from("tenants").update(form).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tenants").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      setDialogOpen(false);
      resetForm();
      toast.success(editId ? "Inquilino atualizado!" : "Inquilino cadastrado!");
    },
    onError: () => toast.error("Erro ao salvar inquilino."),
  });

  const deleteTenant = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tenants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      toast.success("Inquilino removido!");
    },
  });

  const resetForm = () => {
    setEditId(null);
    setForm({
      full_name: "", cpf: "", rg: "", rg_issuer: "",
      address: "", city: "", state: "", cep: "",
      phone: "", email: "", nationality: "brasileiro(a)",
    });
  };

  const handleEdit = (tenant: any) => {
    setEditId(tenant.id);
    setForm({
      full_name: tenant.full_name || "",
      cpf: tenant.cpf || "",
      rg: tenant.rg || "",
      rg_issuer: tenant.rg_issuer || "",
      address: tenant.address || "",
      city: tenant.city || "",
      state: tenant.state || "",
      cep: tenant.cep || "",
      phone: tenant.phone || "",
      email: tenant.email || "",
      nationality: tenant.nationality || "brasileiro(a)",
    });
    setDialogOpen(true);
  };

  const handleNew = () => {
    resetForm();
    setDialogOpen(true);
  };

  const updateField = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Inquilinos</h1>
          <p className="mt-1 text-muted-foreground">Gerencie os locatários dos imóveis</p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="mr-2 h-4 w-4" /> Novo Inquilino
        </Button>
      </div>

      <Card className="glass-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : tenants?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum inquilino cadastrado</TableCell></TableRow>
              ) : (
                tenants?.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.full_name}</TableCell>
                    <TableCell>{t.cpf}</TableCell>
                    <TableCell>{t.phone}</TableCell>
                    <TableCell>{t.email}</TableCell>
                    <TableCell>{t.city}/{t.state}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(t)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteTenant.mutate(t.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
            <DialogTitle>{editId ? "Editar Inquilino" : "Novo Inquilino"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); saveTenant.mutate(); }}
            className="grid grid-cols-2 gap-4"
          >
            <div className="col-span-2 space-y-2">
              <Label>Nome Completo *</Label>
              <Input value={form.full_name} onChange={(e) => updateField("full_name", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>CPF</Label>
              <Input value={form.cpf} onChange={(e) => updateField("cpf", e.target.value)} placeholder="000.000.000-00" />
            </div>
            <div className="space-y-2">
              <Label>RG</Label>
              <Input value={form.rg} onChange={(e) => updateField("rg", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Órgão Emissor</Label>
              <Input value={form.rg_issuer} onChange={(e) => updateField("rg_issuer", e.target.value)} placeholder="SSP/SP" />
            </div>
            <div className="space-y-2">
              <Label>Nacionalidade</Label>
              <Input value={form.nationality} onChange={(e) => updateField("nationality", e.target.value)} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Endereço</Label>
              <Input value={form.address} onChange={(e) => updateField("address", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input value={form.city} onChange={(e) => updateField("city", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Input value={form.state} onChange={(e) => updateField("state", e.target.value)} placeholder="São Paulo" />
            </div>
            <div className="space-y-2">
              <Label>CEP</Label>
              <Input value={form.cep} onChange={(e) => updateField("cep", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={(e) => updateField("phone", e.target.value)} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} />
            </div>
            <div className="col-span-2">
              <Button type="submit" className="w-full" disabled={saveTenant.isPending}>
                {saveTenant.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Tenants;
