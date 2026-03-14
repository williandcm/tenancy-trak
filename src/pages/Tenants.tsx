import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, Plus, Pencil, Trash2, Search, Phone, Mail, MapPin,
  UserCheck, UserX, Eye, FileText, Download, ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { useCep } from "@/hooks/useCep";
import { maskCpf, maskRg, maskPhone, maskCep } from "@/lib/masks";
import ContractFormDialog from "@/components/contracts/ContractFormDialog";
import { useAuth } from "@/hooks/useAuth";

const Tenants = () => {
  const { hasPermission } = useAuth();
  const isAdmin = hasPermission("admin");

  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewTenant, setViewTenant] = useState<any>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [contractFormOpen, setContractFormOpen] = useState(false);
  const [contractTenantId, setContractTenantId] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: "", cpf: "", rg: "", rg_issuer: "",
    address: "", address_number: "", neighborhood: "", complement: "",
    city: "", state: "", cep: "",
    phone: "", email: "", nationality: "brasileiro(a)",
    marital_status: "solteiro(a)",
  });
  const { fetchCep, loading: cepLoading } = useCep();

  const handleCepChange = (cep: string) => {
    const masked = maskCep(cep);
    updateField("cep", masked);
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

  const { data: tenants, isLoading } = useQuery({
    queryKey: ["tenants"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tenants").select("*").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  // Get active contracts to know which tenants are active
  const { data: contracts } = useQuery({
    queryKey: ["contracts-for-tenants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("tenant_id, status")
        .in("status", ["active", "awaiting_approval"]);
      if (error) throw error;
      return data;
    },
  });

  const activeTenantIds = new Set(
    contracts?.filter((c) => c.status === "active").map((c) => c.tenant_id) ?? []
  );
  const awaitingTenantIds = new Set(
    contracts?.filter((c) => c.status === "awaiting_approval").map((c) => c.tenant_id) ?? []
  );

  // Queries for contract request
  const { data: units } = useQuery({
    queryKey: ["units"],
    queryFn: async () => {
      const { data, error } = await supabase.from("units").select("*");
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

  const saveContractRequest = useMutation({
    mutationFn: async ({ payload }: { payload: any }) => {
      const { error } = await supabase.from("contracts").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts-for-tenants"] });
      queryClient.invalidateQueries({ queryKey: ["contracts-full"] });
      setContractFormOpen(false);
      setContractTenantId(null);
      toast.success("Contrato solicitado! Aguardando aprovação do administrador.");
    },
    onError: () => toast.error("Erro ao solicitar contrato."),
  });

  const handleRequestContract = (tenantId: string) => {
    setContractTenantId(tenantId);
    setViewDialogOpen(false);
    setTimeout(() => setContractFormOpen(true), 0);
  };

  const handleSaveContract = (payload: any, isEdit: boolean) => {
    // Force status to awaiting_approval for contract requests
    saveContractRequest.mutate({ payload: { ...payload, status: "awaiting_approval" } });
  };

  const saveTenant = useMutation({
    mutationFn: async () => {
      // Try saving with all fields; if columns don't exist yet, retry without new columns
      const tryPayload = async (payload: Record<string, any>): Promise<any> => {
        if (editId) {
          const { error } = await supabase.from("tenants").update(payload as any).eq("id", editId);
          return error;
        } else {
          const { error } = await supabase.from("tenants").insert(payload as any);
          return error;
        }
      };

      let error = await tryPayload(form);
      if (error && error.code === "42703") {
        // Column not found — strip new columns and retry
        const { marital_status, address_number, neighborhood, complement, ...rest } = form;
        error = await tryPayload(rest);
      }
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      setDialogOpen(false);
      resetForm();
      toast.success(editId ? "Inquilino atualizado!" : "Inquilino cadastrado!");
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
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
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });

  const resetForm = () => {
    setEditId(null);
    setForm({
      full_name: "", cpf: "", rg: "", rg_issuer: "",
      address: "", address_number: "", neighborhood: "", complement: "",
      city: "", state: "", cep: "",
      phone: "", email: "", nationality: "brasileiro(a)",
      marital_status: "solteiro(a)",
    });
  };

  const handleEdit = (tenant: any) => {
    if (!isAdmin) {
      toast.error("Apenas administradores podem editar inquilinos.");
      return;
    }
    setEditId(tenant.id);
    setForm({
      full_name: tenant.full_name || "",
      cpf: tenant.cpf || "",
      rg: tenant.rg || "",
      rg_issuer: tenant.rg_issuer || "",
      address: tenant.address || "",
      address_number: tenant.address_number || "",
      neighborhood: tenant.neighborhood || "",
      complement: tenant.complement || "",
      city: tenant.city || "",
      state: tenant.state || "",
      cep: tenant.cep || "",
      phone: tenant.phone || "",
      email: tenant.email || "",
      nationality: tenant.nationality || "brasileiro(a)",
      marital_status: tenant.marital_status || "solteiro(a)",
    });
    setDialogOpen(true);
  };

  const handleView = (tenant: any) => {
    setViewTenant(tenant);
    setViewDialogOpen(true);
  };

  const handleNew = () => {
    resetForm();
    setDialogOpen(true);
  };

  const updateField = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const filteredTenants = tenants?.filter((t) =>
    t.full_name.toLowerCase().includes(search.toLowerCase()) ||
    t.cpf?.toLowerCase().includes(search.toLowerCase()) ||
    t.email?.toLowerCase().includes(search.toLowerCase()) ||
    t.phone?.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = tenants?.filter((t) => activeTenantIds.has(t.id)).length ?? 0;
  const awaitingCount = tenants?.filter((t) => awaitingTenantIds.has(t.id)).length ?? 0;
  const inactiveCount = (tenants?.length ?? 0) - activeCount - awaitingCount;

  const exportCSV = () => {
    if (!filteredTenants || filteredTenants.length === 0) return;
    const rows = filteredTenants.map((t) => ({
      Nome: t.full_name,
      CPF: t.cpf || "",
      RG: t.rg || "",
      Telefone: t.phone || "",
      Email: t.email || "",
      Endereço: t.address || "",
      Cidade: t.city || "",
      Estado: t.state || "",
      Status: activeTenantIds.has(t.id) ? "Ativo" : awaitingTenantIds.has(t.id) ? "Aguardando" : "Sem Contrato",
    }));
    const keys = Object.keys(rows[0]);
    const header = keys.join(";");
    const csv = "\uFEFF" + [header, ...rows.map((r) => keys.map((k) => String((r as any)[k])).join(";"))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inquilinos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Inquilinos</h1>
          <p className="mt-1 text-muted-foreground">Gerencie os locatários dos imóveis</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="mr-2 h-4 w-4" /> CSV
          </Button>
          <Button onClick={handleNew}>
            <Plus className="mr-2 h-4 w-4" /> Novo Inquilino
          </Button>
        </div>
      </div>

      {!isAdmin && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>Modo visualização — Você pode visualizar e cadastrar inquilinos. Para editar ou excluir, solicite a um administrador.</span>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="glass-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 dark:bg-blue-900/30 p-3">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{tenants?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Total Cadastrados</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-green-100 dark:bg-green-900/30 p-3">
              <UserCheck className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeCount}</p>
              <p className="text-xs text-muted-foreground">Com Contrato Ativo</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-gray-100 dark:bg-gray-900/30 p-3">
              <UserX className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{inactiveCount}</p>
              <p className="text-xs text-muted-foreground">Sem Contrato</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, CPF, e-mail ou telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
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
                <TableHead>Status</TableHead>
                <TableHead className="w-32">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow>
              ) : filteredTenants?.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhum inquilino encontrado</TableCell></TableRow>
              ) : (
                filteredTenants?.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">{t.cpf || "—"}</TableCell>
                    <TableCell>
                      {t.phone ? (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Phone className="h-3 w-3" /> {t.phone}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {t.email ? (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Mail className="h-3 w-3" /> {t.email}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.city ? `${t.city}/${t.state}` : "—"}
                    </TableCell>
                    <TableCell>
                      {activeTenantIds.has(t.id) ? (
                        <Badge className="bg-green-500 text-white">Ativo</Badge>
                      ) : awaitingTenantIds.has(t.id) ? (
                        <Badge className="bg-yellow-500 text-white">Aguardando Aprovação</Badge>
                      ) : (
                        <Badge variant="secondary">Sem Contrato</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleView(t)} title="Visualizar">
                          <Eye className="h-4 w-4" />
                        </Button>
                        {!activeTenantIds.has(t.id) && !awaitingTenantIds.has(t.id) && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => handleRequestContract(t.id)} title="Solicitar Contrato">
                            <FileText className="h-4 w-4" />
                          </Button>
                        )}
                        {isAdmin && (
                          <>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(t)} title="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                              onClick={() => { if (confirm("Excluir este inquilino?")) deleteTenant.mutate(t.id); }}
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Dados do Inquilino</DialogTitle>
          </DialogHeader>
          {viewTenant && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary text-xl font-bold">
                  {viewTenant.full_name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{viewTenant.full_name}</h3>
                  {activeTenantIds.has(viewTenant.id) ? (
                    <Badge className="bg-green-500 text-white">Contrato Ativo</Badge>
                  ) : awaitingTenantIds.has(viewTenant.id) ? (
                    <Badge className="bg-yellow-500 text-white">Aguardando Aprovação</Badge>
                  ) : (
                    <Badge variant="secondary">Sem Contrato</Badge>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">CPF:</span> <span className="font-medium">{viewTenant.cpf || "—"}</span></div>
                <div><span className="text-muted-foreground">RG:</span> <span className="font-medium">{viewTenant.rg || "—"} {viewTenant.rg_issuer ? `(${viewTenant.rg_issuer})` : ""}</span></div>
                <div><span className="text-muted-foreground">Nacionalidade:</span> <span className="font-medium">{viewTenant.nationality || "—"}</span></div>
                <div><span className="text-muted-foreground">Estado Civil:</span> <span className="font-medium">{viewTenant.marital_status || "—"}</span></div>
                <div><span className="text-muted-foreground">Telefone:</span> <span className="font-medium">{viewTenant.phone || "—"}</span></div>
                <div><span className="text-muted-foreground">E-mail:</span> <span className="font-medium">{viewTenant.email || "—"}</span></div>
                <div className="col-span-2"><span className="text-muted-foreground">Endereço:</span> <span className="font-medium">{viewTenant.address || "—"}{viewTenant.address_number ? `, nº ${viewTenant.address_number}` : ""}{viewTenant.complement ? ` - ${viewTenant.complement}` : ""}</span></div>
                <div><span className="text-muted-foreground">Bairro:</span> <span className="font-medium">{viewTenant.neighborhood || "—"}</span></div>
                <div><span className="text-muted-foreground">Cidade:</span> <span className="font-medium">{viewTenant.city || "—"}</span></div>
                <div><span className="text-muted-foreground">Estado:</span> <span className="font-medium">{viewTenant.state || "—"}</span></div>
                <div><span className="text-muted-foreground">CEP:</span> <span className="font-medium">{viewTenant.cep || "—"}</span></div>
              </div>
              <div className="flex gap-2 pt-2">
                {isAdmin && (
                <Button variant="outline" className="flex-1" onClick={() => { setViewDialogOpen(false); handleEdit(viewTenant); }}>
                  <Pencil className="mr-2 h-4 w-4" /> Editar
                </Button>
                )}
                {!activeTenantIds.has(viewTenant.id) && !awaitingTenantIds.has(viewTenant.id) && (
                  <Button className="flex-1" onClick={() => handleRequestContract(viewTenant.id)}>
                    <FileText className="mr-2 h-4 w-4" /> Solicitar Contrato
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Inquilino" : "Novo Inquilino"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); saveTenant.mutate(); }}
            className="grid grid-cols-2 gap-4"
            autoComplete="off"
          >
            <div className="col-span-2 space-y-2">
              <Label>Nome Completo *</Label>
              <Input value={form.full_name} onChange={(e) => updateField("full_name", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>CPF</Label>
              <Input value={form.cpf} onChange={(e) => updateField("cpf", maskCpf(e.target.value))} placeholder="000.000.000-00" />
            </div>
            <div className="space-y-2">
              <Label>RG</Label>
              <Input value={form.rg} onChange={(e) => updateField("rg", maskRg(e.target.value))} placeholder="00.000.000-0" />
            </div>
            <div className="space-y-2">
              <Label>Órgão Emissor</Label>
              <Input value={form.rg_issuer} onChange={(e) => updateField("rg_issuer", e.target.value)} placeholder="SSP/SP" />
            </div>
            <div className="space-y-2">
              <Label>Nacionalidade</Label>
              <Input value={form.nationality} onChange={(e) => updateField("nationality", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Estado Civil</Label>
              <Select value={form.marital_status} onValueChange={(v) => updateField("marital_status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="solteiro(a)">Solteiro(a)</SelectItem>
                  <SelectItem value="casado(a)">Casado(a)</SelectItem>
                  <SelectItem value="divorciado(a)">Divorciado(a)</SelectItem>
                  <SelectItem value="viúvo(a)">Viúvo(a)</SelectItem>
                  <SelectItem value="separado(a)">Separado(a)</SelectItem>
                  <SelectItem value="união estável">União Estável</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={(e) => updateField("phone", maskPhone(e.target.value))} placeholder="(00) 00000-0000" />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>CEP</Label>
              <div className="relative">
                <Input
                  value={form.cep}
                  onChange={(e) => handleCepChange(e.target.value)}
                  maxLength={9}
                  autoComplete="off"
                />
                {cepLoading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input value={form.city} onChange={(e) => updateField("city", e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label>Endereço (Rua)</Label>
              <Input value={form.address} onChange={(e) => updateField("address", e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label>Número</Label>
              <Input value={form.address_number} onChange={(e) => updateField("address_number", e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label>Bairro</Label>
              <Input value={form.neighborhood} onChange={(e) => updateField("neighborhood", e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label>Complemento</Label>
              <Input value={form.complement} onChange={(e) => updateField("complement", e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Input value={form.state} onChange={(e) => updateField("state", e.target.value)} autoComplete="off" />
            </div>
            <div className="col-span-2">
              <Button type="submit" className="w-full" disabled={saveTenant.isPending}>
                {saveTenant.isPending ? "Salvando..." : editId ? "Salvar Alterações" : "Cadastrar Inquilino"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Contract Request Dialog */}
      <ContractFormDialog
        open={contractFormOpen}
        onOpenChange={(open) => {
          setContractFormOpen(open);
          if (!open) setContractTenantId(null);
        }}
        prefill={contractTenantId ? { tenant_id: contractTenantId, status: "awaiting_approval" } : undefined}
        units={units ?? []}
        tenants={tenants ?? []}
        landlords={landlords ?? []}
        onSave={handleSaveContract}
        saving={saveContractRequest.isPending}
      />
    </div>
  );
};

export default Tenants;
