import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Building2, LayoutDashboard, DoorOpen, Users, FileText,
  CreditCard, Zap, Bell, LogOut, ChevronLeft, ChevronRight,
  Shield, UserCheck, BookOpen, FileEdit, Landmark, BarChart3,
  User, Home, Lock, Eye, EyeOff, Loader2, ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Sheet,
  SheetContent,
  SheetOverlay,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const adminNavItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/units", icon: DoorOpen, label: "Unidades" },
  { to: "/tenants", icon: Users, label: "Inquilinos" },
  { to: "/landlords", icon: UserCheck, label: "Locadores" },
  { to: "/contracts", icon: FileText, label: "Contratos" },
  { to: "/payments", icon: CreditCard, label: "Pagamentos" },
  { to: "/iptu", icon: Landmark, label: "IPTU" },
  { to: "/utilities", icon: Zap, label: "Consumos" },
  { to: "/reports", icon: BarChart3, label: "Relatórios" },
  { to: "/notifications", icon: Bell, label: "Alertas" },
  { to: "/users", icon: Shield, label: "Usuários" },
  { to: "/contract-template", icon: FileEdit, label: "Modelo Contrato", adminOnly: true },
  { to: "/help", icon: BookOpen, label: "Ajuda" },
];

const tenantNavItems = [
  { to: "/portal", icon: Home, label: "Minha Sala" },
];

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { signOut, hasPermission, profile, mustChangePassword, refreshProfile } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  // Password change state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setChangingPassword(true);
    try {
      const { error: pwError } = await supabase.auth.updateUser({ password: newPassword });
      if (pwError) throw pwError;

      const { error: metaError } = await supabase.auth.updateUser({
        data: { must_change_password: false },
      });
      if (metaError) throw metaError;

      toast.success("Senha alterada com sucesso!");
      setNewPassword("");
      setConfirmPassword("");
      await refreshProfile();
    } catch (err: any) {
      console.error("Error changing password:", err);
      toast.error(err?.message || "Erro ao alterar a senha. Tente novamente.");
    } finally {
      setChangingPassword(false);
    }
  };

  const isTenant = profile?.role === "tenant";

  const navItems = isTenant ? tenantNavItems : adminNavItems;

  const visibleNavItems = navItems.filter(
    (item) => !(item as any).adminOnly || hasPermission("admin")
  );

  const roleLabels: Record<string, string> = {
    admin: "Administrador",
    manager: "Gerente",
    operator: "Operador",
    viewer: "Visualizador",
    tenant: "Inquilino",
  };

  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((n) => n[0].toUpperCase())
        .join("")
    : "?";

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border/50 px-4 bg-sidebar/50 backdrop-blur-sm">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-inner">
          <Building2 className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="animate-fade-in">
          <h1 className="text-lg font-bold leading-none tracking-tight">LocaGest</h1>
          <p className="text-[11px] font-medium opacity-70 mt-0.5" style={{ display: collapsed ? 'none' : 'block' }}>Gestão de Locações</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
        {visibleNavItems.map((item) => {
          const active = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => isMobile && setMobileMenuOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 group relative",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              {active && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-md" />
              )}
              <item.icon className={cn(
                "h-5 w-5 flex-shrink-0 transition-transform duration-200",
                active ? "text-primary scale-110" : "group-hover:scale-110"
              )} />
              <span className={cn("transition-opacity duration-200", collapsed && !isMobile ? "opacity-0 hidden" : "opacity-100")}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer - User Info + Logout */}
      <div className="border-t border-sidebar-border p-3 space-y-2">
        {/* User info */}
        {profile && (
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-accent-foreground text-xs font-bold">
              {initials}
            </div>
            <div className="min-w-0 animate-fade-in">
              <p className="text-sm font-medium leading-tight truncate text-sidebar-foreground">
                {profile.full_name}
              </p>
              <p className="text-[10px] opacity-70 truncate">
                {roleLabels[profile.role] || profile.role}
              </p>
            </div>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          <span>Sair</span>
        </button>
      </div>
    </>
  );

  if (isMobile) {
    const bottomNavItems = isTenant
      ? [{ to: "/portal", icon: Home, label: "Minha Sala" }]
      : [
          { to: "/", icon: LayoutDashboard, label: "Início" },
          { to: "/contracts", icon: FileText, label: "Contratos" },
          { to: "/payments", icon: CreditCard, label: "Recibos" },
        ];

    return (
      <div className="min-h-screen bg-muted/20 pb-20">
        {/* Mobile Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/70 backdrop-blur-lg px-4 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Building2 className="h-4 w-4" />
            </div>
            <h1 className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
              LocaGest
            </h1>
          </div>
          {profile && (
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
              {initials}
            </div>
          )}
        </header>

        {/* Modal/Drawer de Menu */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent
            side="left"
            className="flex h-full w-[280px] p-0 flex-col gradient-primary text-primary-foreground outline-none border-none"
          >
            <SidebarContent />
          </SheetContent>
        </Sheet>

        {/* Content */}
        <main className="p-4 space-y-4 animate-fade-in">{children}</main>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-[68px] items-center justify-around border-t bg-background/80 backdrop-blur-xl px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_24px_rgba(0,0,0,0.04)]">
          {bottomNavItems.map((item) => {
            const active = location.pathname === item.to || (item.to !== "/" && location.pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 w-16 h-full transition-all flex-1",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full transition-all duration-300",
                  active ? "bg-primary/10" : "bg-transparent"
                )}>
                  <item.icon className={cn("h-5 w-5 transition-transform", active ? "scale-110" : "scale-100")} />
                </div>
                <span className={cn("text-[10px] font-medium", active ? "font-bold" : "font-normal")}>
                  {item.label}
                </span>
              </Link>
            );
          })}
          
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center gap-1 w-16 h-full transition-all flex-1 text-muted-foreground hover:text-foreground"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full transition-all duration-300 bg-transparent">
              <Menu className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-medium">Mais</span>
          </button>
        </nav>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen flex-col transition-all duration-300",
          "bg-card border-r border-border shadow-sm text-card-foreground",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-border/50 px-4 bg-background/50 backdrop-blur-sm">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-blue-600 shadow-inner">
            <Building2 className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="animate-fade-in flex flex-col justify-center">
              <h1 className="text-[17px] font-extrabold tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent leading-none mt-1">LocaGest</h1>
              <p className="text-[10px] font-medium opacity-70 tracking-wide mt-0.5">GESTÃO DE LOCAÇÕES</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <TooltipProvider key={item.to} delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      to={item.to}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 group relative",
                        active
                          ? "bg-primary/10 text-primary shadow-sm"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                        collapsed && "justify-center"
                      )}
                    >
                      {active && !collapsed && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-md" />
                      )}
                      <item.icon className={cn("h-[18px] w-[18px] flex-shrink-0 transition-transform duration-200", active ? "scale-110" : "group-hover:scale-110")} />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  </TooltipTrigger>
                  {collapsed && (
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </nav>

        {/* Footer - User Info + Logout */}
        <div className="border-t border-border/50 p-3 space-y-2 bg-background/30 backdrop-blur-sm">
          {/* User info */}
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors cursor-pointer hover:bg-muted/50",
                  collapsed ? "justify-center" : ""
                )}>
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/10 text-primary text-xs font-bold border border-primary/20 shadow-sm">
                    {initials}
                  </div>
                  {!collapsed && profile && (
                    <div className="min-w-0 animate-fade-in text-left">
                      <p className="text-sm font-semibold leading-tight truncate text-foreground">
                        {profile.full_name}
                      </p>
                      <p className="text-[10px] font-medium opacity-70 truncate px-1.5 py-0.5 bg-muted rounded-md mt-1 inline-block">
                        {roleLabels[profile.role] || profile.role}
                      </p>
                    </div>
                  )}
                </div>
              </TooltipTrigger>
              {collapsed && profile && (
                <TooltipContent side="right" className="text-xs">
                  <p className="font-semibold">{profile.full_name}</p>
                  <p className="text-muted-foreground">{roleLabels[profile.role] || profile.role}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

          {/* Logout */}
          <button
            onClick={signOut}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors group",
              collapsed ? "justify-center" : ""
            )}
          >
            <LogOut className="h-[18px] w-[18px] flex-shrink-0 group-hover:scale-110 transition-transform" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full bg-white border border-border shadow-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors z-50"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </aside>

      {/* Main content */}
      <main
        className={cn(
          "flex-1 transition-all duration-300 bg-background min-h-screen",
          collapsed ? "ml-16" : "ml-64"
        )}
      >
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">{children}</div>
      </main>

      {/* Mandatory Password Change Modal */}
      <Dialog open={mustChangePassword} onOpenChange={() => {}}>
        <DialogContent
          className="sm:max-w-md [&>button]:hidden"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/10">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <DialogTitle className="text-xl">Alteração de Senha Obrigatória</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Por segurança, é necessário alterar sua senha no primeiro acesso.
              Escolha uma nova senha com pelo menos 6 caracteres.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova Senha</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Digite sua nova senha"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={changingPassword}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
              <Input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Confirme sua nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={changingPassword}
              />
            </div>
            {newPassword.length > 0 && newPassword.length < 6 && (
              <p className="text-xs text-destructive">A senha deve ter pelo menos 6 caracteres.</p>
            )}
            {confirmPassword.length > 0 && newPassword !== confirmPassword && (
              <p className="text-xs text-destructive">As senhas não coincidem.</p>
            )}
            <Button
              className="w-full"
              onClick={handleChangePassword}
              disabled={changingPassword || newPassword.length < 6 || newPassword !== confirmPassword}
            >
              {changingPassword ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Alterando...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Alterar Senha
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AppLayout;
