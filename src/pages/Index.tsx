import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  Building2, DoorOpen, Users, FileText, TrendingUp,
  Droplets, Zap, MapPin, AlertTriangle, CalendarDays,
  CheckCircle2, Clock, Percent, Receipt, BarChart3,
  ArrowRight, Landmark, CreditCard,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend,
} from "recharts";
import { format, subMonths, isAfter, isBefore, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import PropertyMap from "@/components/PropertyMap";

const statusMap = {
  available: { label: "Disponível", variant: "default" as const },
  occupied: { label: "Ocupado", variant: "secondary" as const },
  maintenance: { label: "Manutenção", variant: "destructive" as const },
};

const CHART_COLORS = ["hsl(220, 60%, 22%)", "hsl(42, 80%, 55%)", "hsl(152, 60%, 42%)", "hsl(210, 80%, 52%)", "hsl(0, 72%, 51%)"];

const Dashboard = () => {
  const { profile } = useAuth();

  const { data: units } = useQuery({
    queryKey: ["units"],
    queryFn: async () => {
      const { data, error } = await supabase.from("units").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: contracts } = useQuery({
    queryKey: ["contracts-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contracts").select("*, units(name), tenants(full_name)");
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

  const { data: payments } = useQuery({
    queryKey: ["payments-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*, contracts(units(name), tenants(full_name))")
        .order("due_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const today = new Date();
  const totalUnits = units?.length ?? 0;
  const occupiedUnits = units?.filter((u) => u.status === "occupied").length ?? 0;
  const availableUnits = units?.filter((u) => u.status === "available").length ?? 0;
  const maintenanceUnits = units?.filter((u) => u.status === "maintenance").length ?? 0;
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

  const activeContracts = contracts?.filter((c) => c.status === "active") ?? [];
  const monthlyRevenue = activeContracts.reduce((sum, c) => sum + Number(c.monthly_rent), 0);

  const overduePayments = payments?.filter((p) => !p.is_paid && isBefore(new Date(p.due_date), today)) ?? [];
  const totalOverdue = overduePayments.reduce((s, p) => s + Number(p.amount), 0);

  // Total received this year
  const yearStr = String(today.getFullYear());
  const totalReceivedYear = payments?.filter((p) => p.is_paid && p.paid_date?.startsWith(yearStr))
    .reduce((s, p) => s + Number(p.amount) + Number(p.late_fee || 0), 0) ?? 0;

  // Inadimplência rate
  const allDuePayments = payments?.filter((p) => p.due_date && isBefore(new Date(p.due_date), today)) ?? [];
  const totalDue = allDuePayments.reduce((s, p) => s + Number(p.amount), 0);
  const inadimplenciaRate = totalDue > 0 ? (totalOverdue / totalDue) * 100 : 0;

  // Utility bills summary (current month)
  const utilityBills = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("locagest-utility-bills") || "[]");
    } catch { return []; }
  }, []);

  const currentMonth = format(today, "yyyy-MM");
  const currentMonthBills = utilityBills.filter((b: any) => b.referenceMonth?.startsWith(currentMonth));
  const monthElectricity = currentMonthBills.filter((b: any) => b.billType === "electricity")
    .reduce((s: number, b: any) => s + Number(b.totalAmount || 0), 0);
  const monthWater = currentMonthBills.filter((b: any) => b.billType === "water")
    .reduce((s: number, b: any) => s + Number(b.totalAmount || 0), 0);

  // IPTU summary
  const iptuRecords = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("locagest-iptu") || "[]");
    } catch { return []; }
  }, []);
  const currentYearIptu = iptuRecords.find((r: any) => r.year === today.getFullYear());
  const iptuTotal = currentYearIptu ? Number(currentYearIptu.iptuAmount || 0) + Number(currentYearIptu.trashFee || 0) : 0;

  const expiringContracts = contracts?.filter((c) => {
    if (c.status !== "active") return false;
    const endDate = new Date(c.end_date);
    return isBefore(endDate, addDays(today, 90)) && isAfter(endDate, today);
  }) ?? [];

  const revenueByMonth = Array.from({ length: 6 }, (_, i) => {
    const month = subMonths(today, 5 - i);
    const monthStr = format(month, "yyyy-MM");
    const monthLabel = format(month, "MMM", { locale: ptBR });
    const monthPayments = payments?.filter((p) => p.paid_date && p.paid_date.startsWith(monthStr)) ?? [];
    const received = monthPayments.reduce((s, p) => s + Number(p.amount) + Number(p.late_fee || 0), 0);
    const expected = monthlyRevenue;
    return { name: monthLabel, recebido: received, esperado: expected };
  });

  const occupancyData = [
    { name: "Ocupadas", value: occupiedUnits, color: CHART_COLORS[0] },
    { name: "Disponíveis", value: availableUnits, color: CHART_COLORS[2] },
    { name: "Manutenção", value: maintenanceUnits, color: CHART_COLORS[4] },
  ].filter((d) => d.value > 0);

  const money = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const stats = [
    { label: "Unidades", value: totalUnits, icon: DoorOpen, color: "text-blue-600", bg: "bg-blue-100/50", sub: `${occupancyRate}% ocupação` },
    { label: "Ocupadas", value: occupiedUnits, icon: Building2, color: "text-emerald-600", bg: "bg-emerald-100/50", sub: `${availableUnits} disponíveis` },
    { label: "Contratos", value: activeContracts.length, icon: FileText, color: "text-amber-600", bg: "bg-amber-100/50", sub: `${contracts?.length ?? 0} total` },
    { label: "Receita Mês", value: money(monthlyRevenue), icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-100/50", sub: "contratos ativos" },
    { label: "Inadimplência", value: `${inadimplenciaRate.toFixed(1)}%`, icon: Percent, color: inadimplenciaRate > 10 ? "text-red-600" : "text-emerald-600", bg: inadimplenciaRate > 10 ? "bg-red-100/50" : "bg-emerald-100/50", sub: inadimplenciaRate === 0 ? "Excelente!" : "Atenção!" },
    { label: "Pag. Atrasados", value: overduePayments.length, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-100/50", sub: money(totalOverdue) },
    { label: "Total no Ano", value: money(totalReceivedYear), icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-100/50", sub: yearStr },
    { label: "Inquilinos", value: tenants?.length ?? 0, icon: Users, color: "text-blue-600", bg: "bg-blue-100/50", sub: "cadastrados" },
  ];

  return (
    <div className="space-y-8 animate-fade-in pb-8">
      {/* Premium Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[hsl(220,60%,22%)] via-[hsl(220,55%,28%)] to-[hsl(220,50%,35%)] p-6 md:p-8 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-white">
              Olá, {profile?.full_name || "Administrador"} 👋
            </h1>
            <div className="mt-2 flex items-center gap-2 text-white/80 text-sm">
              <MapPin className="h-4 w-4" />
              <span>Rua Orlando Pavan, 422 – Jd. Rosolém, Hortolândia/SP</span>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-white/10 rounded-xl p-4 backdrop-blur-sm border border-white/20 shadow-inner">
             <div className="text-right">
                <p className="text-xs text-white/60 uppercase tracking-wider font-semibold mb-0.5">Visão Geral de Hoje</p>
                <p className="text-sm font-medium">{format(today, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
             </div>
             <div className="h-12 w-12 flex items-center justify-center rounded-full bg-white/20">
               <CalendarDays className="h-6 w-6 text-white" />
             </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
        {stats.map((stat, i) => (
          <Card 
            key={stat.label} 
            className="group relative overflow-hidden glass-card hover:shadow-lg transition-all duration-300 animate-slide-up hover:-translate-y-1 border-muted"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className={`absolute top-0 right-0 w-24 h-24 rounded-full -translate-y-1/2 translate-x-1/2 opacity-20 ${stat.bg}`} />
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold text-foreground mt-2 tracking-tight">{stat.value}</p>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg} ${stat.color} shadow-sm group-hover:scale-110 transition-transform`}>
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-[11px] font-medium text-muted-foreground/80">
                <span className="truncate">{stat.sub}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="glass-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-secondary" /> Receita Mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={revenueByMonth}>
                <defs>
                  <linearGradient id="colorRecebido" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(152, 60%, 42%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(152, 60%, 42%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorEsperado" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(220, 60%, 22%)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="hsl(220, 60%, 22%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                <Legend />
                <Area type="monotone" dataKey="esperado" stroke="hsl(220, 60%, 22%)" fill="url(#colorEsperado)" name="Esperado" strokeDasharray="5 5" />
                <Area type="monotone" dataKey="recebido" stroke="hsl(152, 60%, 42%)" fill="url(#colorRecebido)" name="Recebido" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5 text-secondary" /> Ocupação
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={occupancyData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                  {occupancyData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2">
              {occupancyData.map((d) => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  {d.name} ({d.value})
                </div>
              ))}
            </div>
            <p className="text-3xl font-bold mt-3 text-foreground">{occupancyRate}%</p>
            <p className="text-xs text-muted-foreground">Taxa de Ocupação</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Pagamentos Atrasados
              {overduePayments.length > 0 && <Badge variant="destructive" className="ml-auto">{overduePayments.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overduePayments.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="mx-auto h-10 w-10 text-success/50 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum pagamento atrasado!</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {overduePayments.slice(0, 10).map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                    <div>
                      <p className="text-sm font-medium">{p.contracts?.tenants?.full_name}</p>
                      <p className="text-xs text-muted-foreground">{p.contracts?.units?.name} · Venc: {format(new Date(p.due_date), "dd/MM/yyyy")}</p>
                    </div>
                    <p className="text-sm font-bold text-destructive">R$ {Number(p.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-warning" /> Contratos Próximos ao Vencimento
              {expiringContracts.length > 0 && <Badge variant="secondary" className="ml-auto">{expiringContracts.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expiringContracts.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="mx-auto h-10 w-10 text-success/50 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum contrato próximo ao vencimento</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {expiringContracts.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg border border-warning/20 bg-warning/5 p-3">
                    <div>
                      <p className="text-sm font-medium">{c.units?.name} · {c.tenants?.full_name}</p>
                      <p className="text-xs text-muted-foreground">Termina em {format(new Date(c.end_date), "dd/MM/yyyy")}</p>
                    </div>
                    <Badge variant="outline">
                      <Clock className="mr-1 h-3 w-3" />
                      {Math.ceil((new Date(c.end_date).getTime() - today.getTime()) / 86400000)} dias
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Consumos do Mês + IPTU + Ações Rápidas */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" /> Consumos do Mês
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                <span className="text-sm">Energia</span>
              </div>
              <span className="font-bold">{money(monthElectricity)}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Droplets className="h-4 w-4 text-cyan-500" />
                <span className="text-sm">Água</span>
              </div>
              <span className="font-bold">{money(monthWater)}</span>
            </div>
            <div className="border-t pt-3 flex items-center justify-between">
              <span className="text-sm font-medium">Total</span>
              <span className="text-lg font-bold text-primary">{money(monthElectricity + monthWater)}</span>
            </div>
            <Link to="/utilities">
              <Button variant="outline" size="sm" className="w-full mt-2">
                <ArrowRight className="mr-2 h-4 w-4" /> Ver Consumos
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Landmark className="h-5 w-5 text-purple-600" /> IPTU {today.getFullYear()}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentYearIptu ? (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <span className="text-sm">IPTU + Taxa Lixo</span>
                  <span className="font-bold">{money(iptuTotal)}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <span className="text-sm">Parcelas</span>
                  <span className="text-sm text-muted-foreground">{currentYearIptu.numInstallments}x</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <span className="text-sm">Desconto Inquilino</span>
                  <Badge variant="secondary">{currentYearIptu.tenantDiscountPercent}%</Badge>
                </div>
                <Link to="/iptu">
                  <Button variant="outline" size="sm" className="w-full mt-2">
                    <ArrowRight className="mr-2 h-4 w-4" /> Gerenciar IPTU
                  </Button>
                </Link>
              </>
            ) : (
              <div className="text-center py-4">
                <Landmark className="mx-auto h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">IPTU ainda não cadastrado</p>
                <Link to="/iptu">
                  <Button variant="outline" size="sm" className="mt-3">
                    Cadastrar IPTU
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" /> Ações Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link to="/payments" className="block">
              <Button variant="outline" size="sm" className="w-full justify-start">
                <CreditCard className="mr-2 h-4 w-4" /> Registrar Pagamento
              </Button>
            </Link>
            <Link to="/utilities" className="block">
              <Button variant="outline" size="sm" className="w-full justify-start">
                <Receipt className="mr-2 h-4 w-4" /> Nova Conta de Consumo
              </Button>
            </Link>
            <Link to="/contracts" className="block">
              <Button variant="outline" size="sm" className="w-full justify-start">
                <FileText className="mr-2 h-4 w-4" /> Novo Contrato
              </Button>
            </Link>
            <Link to="/reports" className="block">
              <Button variant="outline" size="sm" className="w-full justify-start">
                <BarChart3 className="mr-2 h-4 w-4" /> Relatórios Financeiros
              </Button>
            </Link>
            <Link to="/notifications" className="block">
              <Button variant="outline" size="sm" className="w-full justify-start">
                <AlertTriangle className="mr-2 h-4 w-4" /> Gerar Alertas
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-xl">
            <MapPin className="h-5 w-5 text-secondary" /> Mapa do Imóvel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PropertyMap units={units ?? []} />
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-4 font-display text-xl font-bold text-foreground">Unidades</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {units?.map((unit) => (
            <Card key={unit.id} className="glass-card">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">{unit.name}</h3>
                    <p className="text-sm text-muted-foreground">Nº {unit.address_number}</p>
                  </div>
                  <Badge variant={statusMap[unit.status].variant}>{statusMap[unit.status].label}</Badge>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{unit.area_sqm}m²</div>
                  <div className="flex items-center gap-1.5 text-muted-foreground"><Building2 className="h-3.5 w-3.5" />{unit.floor}</div>
                  <div className="flex items-center gap-1.5 text-muted-foreground"><Zap className="h-3.5 w-3.5" />Energia: {unit.electricity_connection}</div>
                  <div className="flex items-center gap-1.5 text-muted-foreground"><Droplets className="h-3.5 w-3.5" />Água: {unit.water_connection}</div>
                </div>
                {unit.monthly_rent && (
                  <div className="mt-3 rounded-lg bg-muted p-2 text-center">
                    <p className="text-xs text-muted-foreground">Aluguel</p>
                    <p className="font-semibold text-foreground">R$ {Number(unit.monthly_rent).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
