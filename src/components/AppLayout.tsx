import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Building2, LayoutDashboard, DoorOpen, Users, FileText,
  CreditCard, Zap, Bell, LogOut, ChevronLeft, ChevronRight,
  Shield, UserCheck, BookOpen, FileEdit, Landmark, BarChart3,
  User, Home,
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
  const { signOut, hasPermission, profile } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();

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
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-secondary">
          <Building2 className="h-5 w-5 text-secondary-foreground" />
        </div>
        <div className="animate-fade-in">
          <h1 className="text-lg font-bold leading-none">LocaGest</h1>
          <p className="text-xs opacity-70">Gestão de Locações</p>
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
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              <span>{item.label}</span>
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
          "gradient-primary text-primary-foreground",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-secondary">
            <Building2 className="h-5 w-5 text-secondary-foreground" />
          </div>
          {!collapsed && (
            <div className="animate-fade-in">
              <h1 className="text-lg font-bold leading-none">LocaGest</h1>
              <p className="text-xs opacity-70">Gestão de Locações</p>
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
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                        collapsed && "justify-center"
                      )}
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
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
        <div className="border-t border-sidebar-border p-3 space-y-2">
          {/* User info */}
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2",
                  collapsed ? "justify-center" : ""
                )}>
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-accent-foreground text-xs font-bold">
                    {initials}
                  </div>
                  {!collapsed && profile && (
                    <div className="min-w-0 animate-fade-in">
                      <p className="text-sm font-medium leading-tight truncate text-sidebar-foreground">
                        {profile.full_name}
                      </p>
                      <p className="text-[10px] opacity-70 truncate">
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
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full bg-card border border-border shadow-sm text-foreground hover:bg-muted transition-colors"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </aside>

      {/* Main content */}
      <main
        className={cn(
          "flex-1 transition-all duration-300",
          collapsed ? "ml-16" : "ml-64"
        )}
      >
        <div className="p-4 md:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
};

export default AppLayout;
