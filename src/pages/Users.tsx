import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { useAuth, type UserRole } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Shield, UserPlus, MoreHorizontal, Pencil, Trash2,
  Key, ShieldCheck, ShieldAlert, Eye, UserCog, User,
} from "lucide-react";
import { toast } from "sonner";

const roleConfig: Record<string, { label: string; color: string; icon: React.ElementType; description: string }> = {
  admin: { label: "Administrador", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", icon: ShieldAlert, description: "Acesso total ao sistema" },
  manager: { label: "Gerente", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", icon: ShieldCheck, description: "Gerencia contratos, pagamentos e inquilinos" },
  operator: { label: "Operador", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", icon: UserCog, description: "Registra leituras e pagamentos" },
  viewer: { label: "Visualizador", color: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400", icon: Eye, description: "Apenas visualização" },
  tenant: { label: "Inquilino", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400", icon: User, description: "Visualiza informações da sua sala" },
};

const rolePermissions: Record<string, string[]> = {
  admin: ["Gerenciar usuários", "Gerenciar contratos", "Gerenciar pagamentos", "Gerenciar unidades", "Gerenciar inquilinos", "Gerenciar locadores", "Registrar leituras", "Visualizar relatórios", "Configurar sistema"],
  manager: ["Gerenciar contratos", "Gerenciar pagamentos", "Gerenciar unidades", "Gerenciar inquilinos", "Gerenciar locadores", "Registrar leituras", "Visualizar relatórios"],
  operator: ["Registrar pagamentos", "Registrar leituras", "Visualizar contratos", "Visualizar unidades"],
  viewer: ["Visualizar contratos", "Visualizar unidades", "Visualizar pagamentos"],
  tenant: ["Visualizar sua sala", "Visualizar seus pagamentos", "Visualizar seu contrato"],
};

const Users = () => {
  const { hasPermission, profile: currentProfile } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editProfile, setEditProfile] = useState<any>(null);
  const [resetPwdId, setResetPwdId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    phone: "",
    role: "viewer" as string,
    tenant_id: "" as string,
  });

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: tenants } = useQuery({
    queryKey: ["tenants-for-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, full_name, cpf, email, phone")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const createUser = useMutation({
    mutationFn: async () => {
      const tenantId = form.role === "tenant" && form.tenant_id ? form.tenant_id : null;

      // Create auth user via admin API (store tenant_id in metadata as well)
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: form.email,
        password: form.password,
        email_confirm: true,
        user_metadata: {
          full_name: form.full_name,
          role: form.role,
          tenant_id: tenantId,
          must_change_password: true,
        },
      });
      if (authError) throw authError;

      // Wait for the profile trigger to create the row, then update it
      if (authData.user) {
        // First update without tenant_id (always works)
        const profileBase: Record<string, any> = {
          full_name: form.full_name,
          phone: form.phone || null,
          role: form.role,
        };

        // Retry up to 5 times with 500ms delay to wait for profile trigger
        let retries = 5;
        let profileError: any = null;
        while (retries > 0) {
          const { error } = await supabaseAdmin
            .from("profiles")
            .update(profileBase)
            .eq("user_id", authData.user.id);
          profileError = error;
          if (!error) break;
          retries--;
          if (retries > 0) await new Promise((r) => setTimeout(r, 500));
        }

        // If basic profile update failed, rollback auth user
        if (profileError) {
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id).catch(() => {});
          throw profileError;
        }

        // Now try to set tenant_id separately (column may not exist yet)
        if (tenantId) {
          await supabaseAdmin
            .from("profiles")
            .update({ tenant_id: tenantId } as any)
            .eq("user_id", authData.user.id)
            .then(({ error }) => {
              if (error) console.warn("tenant_id column not available yet:", error.message);
            });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      setDialogOpen(false);
      resetForm();
      toast.success("Usuário criado com sucesso!");
    },
    onError: (e: any) => {
      const msg = e.message || "";
      if (msg.includes("already been registered") || msg.includes("already exists")) {
        toast.error("Este e-mail já está cadastrado no sistema.");
      } else if (msg.includes("tenant_id") && msg.includes("schema cache")) {
        toast.error("A coluna 'tenant_id' não existe na tabela de perfis. Execute a migration no Supabase Dashboard.");
      } else {
        toast.error(`Erro ao criar usuário: ${msg}`);
      }
    },
  });

  const updateUser = useMutation({
    mutationFn: async () => {
      if (!editProfile) return;

      const tenantId = form.role === "tenant" && form.tenant_id ? form.tenant_id : null;

      // If email changed (admin only), update in auth.users first
      const emailChanged = form.email !== editProfile.email;
      if (emailChanged && hasPermission("admin")) {
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
          editProfile.user_id,
          { email: form.email, email_confirm: true }
        );
        if (authError) throw authError;
      }

      // Also update tenant_id in user_metadata
      await supabaseAdmin.auth.admin.updateUserById(
        editProfile.user_id,
        { user_metadata: { full_name: form.full_name, role: form.role, tenant_id: tenantId } }
      ).catch(() => {});

      // Update profile (without tenant_id first)
      const profileUpdate: Record<string, any> = {
        full_name: form.full_name,
        phone: form.phone || null,
        role: form.role,
      };
      if (emailChanged && hasPermission("admin")) {
        profileUpdate.email = form.email;
      }

      const { error } = await supabaseAdmin
        .from("profiles")
        .update(profileUpdate)
        .eq("id", editProfile.id);
      if (error) throw error;

      // Try to set tenant_id separately (column may not exist yet)
      if (tenantId) {
        await supabaseAdmin
          .from("profiles")
          .update({ tenant_id: tenantId } as any)
          .eq("id", editProfile.id)
          .then(({ error }) => {
            if (error) console.warn("tenant_id column not available yet:", error.message);
          });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      setEditProfile(null);
      setDialogOpen(false);
      resetForm();
      toast.success("Usuário atualizado!");
    },
    onError: (e: any) => toast.error(`Erro ao atualizar: ${e.message}`),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Status do usuário atualizado!");
    },
  });

  const resetPassword = useMutation({
    mutationFn: async () => {
      if (!resetPwdId || !newPassword) return;
      const { error } = await supabaseAdmin.auth.admin.updateUserById(resetPwdId, {
        password: newPassword,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setResetPwdId(null);
      setNewPassword("");
      toast.success("Senha alterada com sucesso!");
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Usuário removido!");
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });

  const resetForm = () => {
    setForm({ full_name: "", email: "", password: "", phone: "", role: "viewer", tenant_id: "" });
    setEditProfile(null);
  };

  const handleNew = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleEdit = (p: any) => {
    setEditProfile(p);
    setForm({
      full_name: p.full_name || "",
      email: p.email || "",
      password: "",
      phone: p.phone || "",
      role: p.role || "viewer",
      tenant_id: p.tenant_id || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.role === "tenant" && !form.tenant_id) {
      toast.error("Selecione o inquilino vinculado.");
      return;
    }
    if (form.role === "tenant" && !editProfile && !form.email) {
      toast.error("O inquilino selecionado não possui e-mail cadastrado. Cadastre o e-mail na página de Inquilinos.");
      return;
    }
    if (editProfile) {
      updateUser.mutate();
    } else {
      createUser.mutate();
    }
  };

  if (!hasPermission("admin")) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
        <Shield className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-semibold text-foreground">Acesso Restrito</h2>
        <p className="text-muted-foreground mt-2">Você não tem permissão para acessar esta página.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Usuários</h1>
          <p className="mt-1 text-muted-foreground">Gerencie o acesso e permissões do sistema</p>
        </div>
        <Button onClick={handleNew}>
          <UserPlus className="mr-2 h-4 w-4" /> Novo Usuário
        </Button>
      </div>

      {/* Role Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(roleConfig).map(([key, cfg]) => {
          const count = profiles?.filter((p) => p.role === key).length ?? 0;
          return (
            <Card key={key} className="glass-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${cfg.color}`}>
                    <cfg.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground">{cfg.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Users Table */}
      <Card className="glass-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[60px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Carregando...</TableCell>
                </TableRow>
              ) : profiles?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum usuário cadastrado</TableCell>
                </TableRow>
              ) : (
                profiles?.map((p) => {
                  const cfg = roleConfig[p.role] || roleConfig.viewer;
                  const isSelf = p.user_id === currentProfile?.user_id;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        {p.full_name}
                        {isSelf && <Badge variant="outline" className="ml-2 text-xs">Você</Badge>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.email}</TableCell>
                      <TableCell className="text-muted-foreground">{p.phone || "—"}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.color}`}>
                          <cfg.icon className="h-3 w-3" />
                          {cfg.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={p.is_active}
                            onCheckedChange={(checked) => toggleActive.mutate({ id: p.id, is_active: checked })}
                            disabled={isSelf}
                          />
                          <span className={`text-xs ${p.is_active ? "text-green-600" : "text-red-500"}`}>
                            {p.is_active ? "Ativo" : "Inativo"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(p)}>
                              <Pencil className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setResetPwdId(p.user_id); setNewPassword(""); }}>
                              <Key className="mr-2 h-4 w-4" /> Alterar Senha
                            </DropdownMenuItem>
                            {!isSelf && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => {
                                    if (confirm(`Tem certeza que deseja excluir ${p.full_name}?`)) {
                                      deleteUser.mutate(p.user_id);
                                    }
                                  }}
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

      {/* Permissions Legend */}
      <Card className="glass-card">
        <CardContent className="p-6">
          <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-secondary" /> Permissões por Perfil
          </h3>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(rolePermissions).map(([role, perms]) => {
              const cfg = roleConfig[role];
              return (
                <div key={role} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <cfg.icon className="h-4 w-4" />
                    <span className="font-medium text-sm">{cfg.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{cfg.description}</p>
                  <ul className="space-y-1">
                    {perms.map((perm) => (
                      <li key={perm} className="text-xs text-muted-foreground flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-secondary flex-shrink-0" />
                        {perm}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editProfile ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
            <DialogDescription>
              {editProfile ? "Atualize as informações do usuário." : "Crie uma nova conta de acesso ao sistema."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Perfil de Acesso</Label>
              <Select value={form.role} onValueChange={(v) => {
                if (v === "tenant" && !editProfile) {
                  // Reset fields — will be filled when tenant is selected
                  setForm({ ...form, role: v, tenant_id: "", full_name: "", email: "", phone: "" });
                } else {
                  setForm({ ...form, role: v, tenant_id: v !== "tenant" ? "" : form.tenant_id });
                }
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(roleConfig).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        <cfg.icon className="h-3.5 w-3.5" /> {cfg.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {roleConfig[form.role]?.description}
              </p>
            </div>
            {form.role === "tenant" && (
              <div className="space-y-2">
                <Label>Inquilino Vinculado *</Label>
                <Select value={form.tenant_id} onValueChange={(v) => {
                  const selected = tenants?.find((t) => t.id === v);
                  if (selected && !editProfile) {
                    setForm({
                      ...form,
                      tenant_id: v,
                      full_name: selected.full_name || "",
                      email: selected.email || "",
                      phone: selected.phone || "",
                    });
                  } else {
                    setForm({ ...form, tenant_id: v });
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o inquilino" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants?.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.full_name}{t.cpf ? ` — ${t.cpf}` : ""}
                      </SelectItem>
                    ))}
                    {(!tenants || tenants.length === 0) && (
                      <SelectItem value="_empty" disabled>
                        Nenhum inquilino cadastrado
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {!editProfile
                    ? "Selecione o inquilino para preencher automaticamente nome, e-mail e telefone."
                    : "Vincule este usuário a um inquilino para que ele veja apenas as informações da sua sala."}
                </p>
                {!editProfile && form.tenant_id && (() => {
                  const sel = tenants?.find((t) => t.id === form.tenant_id);
                  return sel && !sel.email ? (
                    <p className="text-xs text-destructive mt-1">
                      ⚠ Este inquilino não possui e-mail cadastrado. Cadastre um e-mail na página de Inquilinos antes de criar o usuário.
                    </p>
                  ) : null;
                })()}
              </div>
            )}
            {/* Show name/email/phone fields: for tenant creation, read-only after selecting tenant */}
            {(form.role !== "tenant" || editProfile) ? (
              <>
                <div className="space-y-2">
                  <Label>Nome Completo *</Label>
                  <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>E-mail *</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required disabled={!!editProfile && !hasPermission("admin")} />
                  {editProfile && !hasPermission("admin") && (
                    <p className="text-xs text-muted-foreground">Somente administradores podem alterar o e-mail.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(19) 99999-9999" />
                </div>
              </>
            ) : (
              form.tenant_id && (
                <div className="space-y-3 rounded-lg border p-3 bg-muted/50">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Dados do Inquilino</p>
                  <div className="space-y-2">
                    <Label>Nome Completo</Label>
                    <Input value={form.full_name} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input value={form.email} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input value={form.phone || "—"} disabled className="bg-muted" />
                  </div>
                </div>
              )
            )}
            {!editProfile && (
              <div className="space-y-2">
                <Label>Senha para Primeiro Acesso *</Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  minLength={6}
                  placeholder="Digite uma senha temporária (mín. 6 caracteres)"
                />
                <p className="text-xs text-muted-foreground">
                  O usuário será obrigado a alterar esta senha no primeiro acesso ao sistema.
                </p>
              </div>
            )}
            <Separator />
            <Button type="submit" className="w-full" disabled={
              createUser.isPending || updateUser.isPending ||
              (form.role === "tenant" && !editProfile && (!form.tenant_id || !form.email))
            }>
              {(createUser.isPending || updateUser.isPending) ? "Salvando..." : editProfile ? "Salvar Alterações" : "Criar Usuário"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetPwdId} onOpenChange={(open) => { if (!open) { setResetPwdId(null); setNewPassword(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Alterar Senha</DialogTitle>
            <DialogDescription>Digite a nova senha para o usuário.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); resetPassword.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label>Nova Senha</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} placeholder="Mínimo 6 caracteres" />
            </div>
            <Button type="submit" className="w-full" disabled={resetPassword.isPending}>
              {resetPassword.isPending ? "Alterando..." : "Alterar Senha"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Users;
