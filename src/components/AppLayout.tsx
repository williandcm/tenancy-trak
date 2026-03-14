import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Building2, LayoutDashboard, DoorOpen, Users, FileText,
  CreditCard, Zap, Bell, LogOut, ChevronLeft, ChevronRight,
  Shield, UserCheck, BookOpen, FileEdit, Landmark, BarChart3,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const navItems = [
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

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { signOut, hasPermission, profile } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const visibleNavItems = navItems.filter(
    (item) => !(item as any).adminOnly || hasPermission("admin")
  );

  const roleLabels: Record<string, string> = {
    admin: "Administrador",
    manager: "Gerente",
    operator: "Operador",
    viewer: "Visualizador",
  };

  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((n) => n[0].toUpperCase())
        .join("")
    : "?";

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
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
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
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
};

export default AppLayout;
