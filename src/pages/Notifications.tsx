import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bell, Check, CheckCheck, Trash2, AlertTriangle, FileWarning,
  CreditCard, Calendar, Info, RefreshCw,
} from "lucide-react";
import { formatDistanceToNow, format, addDays, isBefore, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const Notifications = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("all");

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch contracts expiring within 30 days
  const { data: expiringContracts } = useQuery({
    queryKey: ["expiring-contracts-alerts"],
    queryFn: async () => {
      const now = new Date();
      const in30 = addDays(now, 30);
      const { data, error } = await supabase
        .from("contracts")
        .select("*, units(name), tenants(full_name)")
        .gte("end_date", format(now, "yyyy-MM-dd"))
        .lte("end_date", format(in30, "yyyy-MM-dd"))
        .eq("status", "active");
      if (error) throw error;
      return data;
    },
  });

  // Fetch overdue payments
  const { data: overduePayments } = useQuery({
    queryKey: ["overdue-payments-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*, contracts(*, units(name), tenants(full_name))")
        .eq("is_paid", false)
        .lt("due_date", format(new Date(), "yyyy-MM-dd"));
      if (error) throw error;
      return data;
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("notifications").update({ is_read: true }).eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Todas marcadas como lidas!");
    },
  });

  const deleteNotification = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Notificação removida!");
    },
  });

  const generateAlerts = useMutation({
    mutationFn: async () => {
      const alerts: { user_id: string; title: string; message: string; type: string }[] = [];

      // Generate alerts for expiring contracts
      if (expiringContracts) {
        for (const c of expiringContracts) {
          const daysLeft = Math.ceil((new Date(c.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          alerts.push({
            user_id: user!.id,
            title: "Contrato Vencendo",
            message: `Contrato da unidade ${(c as any).units?.name || "?"} com ${(c as any).tenants?.full_name || "?"} vence em ${daysLeft} dias (${format(new Date(c.end_date + "T12:00:00"), "dd/MM/yyyy")})`,
            type: "contract_expiring",
          });
        }
      }

      // Generate alerts for overdue payments
      if (overduePayments) {
        for (const p of overduePayments) {
          const daysOverdue = Math.ceil((Date.now() - new Date(p.due_date).getTime()) / (1000 * 60 * 60 * 24));
          alerts.push({
            user_id: user!.id,
            title: "Pagamento em Atraso",
            message: `Pagamento de R$ ${Number(p.amount).toFixed(2)} vencido há ${daysOverdue} dias — Unidade ${(p as any).contracts?.units?.name || "?"}, Inquilino ${(p as any).contracts?.tenants?.full_name || "?"}`,
            type: "payment_overdue",
          });
        }
      }

      if (alerts.length === 0) {
        toast.info("Nenhum alerta novo para gerar.");
        return;
      }

      const { error } = await supabase.from("notifications").insert(alerts);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Alertas gerados com sucesso!");
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });

  const unreadCount = notifications?.filter((n) => !n.is_read).length ?? 0;
  const filteredNotifications = notifications?.filter((n) => {
    if (filter === "unread") return !n.is_read;
    if (filter === "read") return n.is_read;
    return true;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "payment_overdue": return <CreditCard className="h-5 w-5 text-red-500" />;
      case "contract_expiring": return <Calendar className="h-5 w-5 text-yellow-500" />;
      case "warning": return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      default: return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "payment_overdue": return <Badge variant="destructive" className="text-xs">Pagamento</Badge>;
      case "contract_expiring": return <Badge className="text-xs bg-yellow-500">Contrato</Badge>;
      case "warning": return <Badge className="text-xs bg-orange-500">Aviso</Badge>;
      default: return <Badge variant="secondary" className="text-xs">Info</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Alertas</h1>
          <p className="mt-1 text-muted-foreground">
            Notificações e alertas do sistema
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">{unreadCount} não lidas</Badge>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => generateAlerts.mutate()} disabled={generateAlerts.isPending}>
            <RefreshCw className={`mr-2 h-4 w-4 ${generateAlerts.isPending ? "animate-spin" : ""}`} />
            Gerar Alertas
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" onClick={() => markAllRead.mutate()}>
              <CheckCheck className="mr-2 h-4 w-4" /> Marcar Todas Lidas
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="glass-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-red-100 dark:bg-red-900/30 p-3">
              <CreditCard className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{overduePayments?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Pagamentos em Atraso</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-yellow-100 dark:bg-yellow-900/30 p-3">
              <Calendar className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{expiringContracts?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Contratos Vencendo (30d)</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 dark:bg-blue-900/30 p-3">
              <Bell className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{unreadCount}</p>
              <p className="text-xs text-muted-foreground">Notificações Não Lidas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">Todas ({notifications?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="unread">Não Lidas ({unreadCount})</TabsTrigger>
          <TabsTrigger value="read">Lidas ({(notifications?.length ?? 0) - unreadCount})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Notification list */}
      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : filteredNotifications?.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="py-12 text-center">
            <Bell className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">
              {filter === "unread" ? "Nenhuma notificação não lida" : filter === "read" ? "Nenhuma notificação lida" : "Nenhuma notificação"}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Use o botão "Gerar Alertas" para criar alertas automáticos de pagamentos em atraso e contratos vencendo.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredNotifications?.map((n) => (
            <Card key={n.id} className={`glass-card transition-all hover:shadow-md ${!n.is_read ? "border-l-4 border-l-secondary" : "opacity-80"}`}>
              <CardContent className="flex items-start gap-4 p-4">
                <div className="mt-0.5">{getTypeIcon((n as any).type || "info")}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`font-semibold text-foreground ${!n.is_read ? "" : "text-muted-foreground"}`}>{n.title}</h3>
                    {getTypeBadge((n as any).type || "info")}
                    {!n.is_read && <Badge className="text-[10px] bg-secondary">Nova</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {!n.is_read && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => markRead.mutate(n.id)} title="Marcar como lida">
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteNotification.mutate(n.id)} title="Excluir">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Notifications;
