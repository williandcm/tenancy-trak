import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Building2,
  DollarSign,
  CalendarDays,
  MapPin,
  AlertTriangle,
  Loader2,
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  Ruler,
  Layers,
  CreditCard,
  TrendingUp,
  Zap,
  Droplets,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  CalendarClock,
  ShieldCheck,
  Info,
} from "lucide-react";
import { format, isBefore, differenceInDays, differenceInMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UnitInfo {
  id: string;
  name: string;
  address_number: string;
  floor: string | null;
  area_sqm: number | null;
  description: string | null;
  electricity_connection: string | null;
  water_connection: string | null;
}

interface ContractInfo {
  id: string;
  monthly_rent: number;
  start_date: string;
  end_date: string;
  status: string;
  payment_day: number;
  deposit_amount: number | null;
  notes: string | null;
  unit: UnitInfo | null;
}

interface PaymentInfo {
  id: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  is_paid: boolean | null;
  late_fee: number | null;
  notes: string | null;
}

const TenantPortal = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState<ContractInfo | null>(null);
  const [payments, setPayments] = useState<PaymentInfo[]>([]);

  useEffect(() => {
    if (!profile?.tenant_id) {
      setLoading(false);
      return;
    }
    loadTenantData();
  }, [profile?.tenant_id]);

  const loadTenantData = async () => {
    setLoading(true);
    try {
      const { data: contractData } = await supabase
        .from("contracts")
        .select(`
          id, monthly_rent, start_date, end_date, status, payment_day, deposit_amount, notes,
          unit:units(id, name, address_number, floor, area_sqm, description, electricity_connection, water_connection)
        `)
        .eq("tenant_id", profile!.tenant_id!)
        .eq("status", "active")
        .maybeSingle();

      if (contractData) {
        setContract(contractData as unknown as ContractInfo);

        const { data: paymentData } = await supabase
          .from("payments")
          .select("id, amount, due_date, paid_date, is_paid, late_fee, notes")
          .eq("contract_id", contractData.id)
          .order("due_date", { ascending: false })
          .limit(36);

        if (paymentData) {
          setPayments(paymentData as PaymentInfo[]);
        }
      }
    } catch (err) {
      console.error("Error loading tenant data:", err);
    }
    setLoading(false);
  };

  const today = useMemo(() => new Date(), []);

  const paidPayments = useMemo(() => payments.filter((p) => p.is_paid), [payments]);
  const overduePayments = useMemo(
    () => payments.filter((p) => !p.is_paid && isBefore(new Date(p.due_date), today)),
    [payments, today]
  );
  const pendingPayments = useMemo(
    () => payments.filter((p) => !p.is_paid && !isBefore(new Date(p.due_date), today)),
    [payments, today]
  );

  const totalPaid = useMemo(
    () => paidPayments.reduce((s, p) => s + Number(p.amount) + Number(p.late_fee || 0), 0),
    [paidPayments]
  );
  const totalOverdue = useMemo(
    () => overduePayments.reduce((s, p) => s + Number(p.amount), 0),
    [overduePayments]
  );
  const totalPending = useMemo(
    () => pendingPayments.reduce((s, p) => s + Number(p.amount), 0),
    [pendingPayments]
  );

  const nextPayment = useMemo(() => {
    const upcoming = payments
      .filter((p) => !p.is_paid)
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    return upcoming[0] || null;
  }, [payments]);

  const contractProgress = useMemo(() => {
    if (!contract) return 0;
    const start = new Date(contract.start_date).getTime();
    const end = new Date(contract.end_date).getTime();
    const now = today.getTime();
    if (now >= end) return 100;
    if (now <= start) return 0;
    return Math.round(((now - start) / (end - start)) * 100);
  }, [contract, today]);

  const contractRemainingDays = useMemo(() => {
    if (!contract) return 0;
    return Math.max(0, differenceInDays(new Date(contract.end_date), today));
  }, [contract, today]);

  const contractRemainingMonths = useMemo(() => {
    if (!contract) return 0;
    return Math.max(0, differenceInMonths(new Date(contract.end_date), today));
  }, [contract, today]);

  const daysUntilPayment = useMemo(() => {
    if (!nextPayment) return null;
    return differenceInDays(new Date(nextPayment.due_date), today);
  }, [nextPayment, today]);

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="h-16 w-16 rounded-full border-4 border-primary/20" />
            <Loader2 className="absolute inset-0 m-auto h-8 w-8 animate-spin text-primary" />
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">Carregando suas informações...</p>
        </div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center px-4">
        <div className="relative">
          <div className="h-24 w-24 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center shadow-lg shadow-amber-100/50">
            <AlertTriangle className="h-10 w-10 text-amber-600" />
          </div>
          <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-white shadow-md flex items-center justify-center">
            <Info className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">Nenhum Contrato Ativo</h2>
          <p className="max-w-md text-muted-foreground leading-relaxed">
            Não encontramos um contrato ativo vinculado à sua conta.
            Entre em contato com o administrador para mais informações.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[hsl(220,60%,22%)] via-[hsl(220,55%,28%)] to-[hsl(220,50%,35%)] p-6 md:p-8 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-white/60 text-sm font-medium mb-1">Bem-vindo(a) de volta</p>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                {profile?.full_name || "Inquilino"}
              </h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge className="bg-white/15 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm">
                  <Building2 className="h-3 w-3 mr-1" />
                  {contract.unit?.name || "Unidade"}
                </Badge>
                <Badge className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border-emerald-400/20">
                  <ShieldCheck className="h-3 w-3 mr-1" />
                  Contrato Ativo
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div className="h-12 w-12 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
                <CalendarClock className="h-6 w-6 text-amber-300" />
              </div>
              <div>
                <p className="text-white/60 text-xs">Próximo Vencimento</p>
                {nextPayment ? (
                  <>
                    <p className="text-lg font-bold">
                      {format(new Date(nextPayment.due_date), "dd/MM/yyyy")}
                    </p>
                    <p className="text-xs text-white/50">
                      {daysUntilPayment !== null && daysUntilPayment >= 0
                        ? daysUntilPayment === 0
                          ? "Vence hoje!"
                          : `em \${daysUntilPayment} dia\${daysUntilPayment > 1 ? "s" : ""}`
                        : `\${Math.abs(daysUntilPayment!)} dia\${Math.abs(daysUntilPayment!) > 1 ? "s" : ""} em atraso`}
                    </p>
                  </>
                ) : (
                  <p className="text-lg font-bold">Tudo em dia ✓</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alert: Overdue Payments */}
      {overduePayments.length > 0 && (
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-red-50 to-orange-50 border border-red-200/60 p-4 shadow-sm">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-100/50 rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="relative flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-red-800">
                Você tem {overduePayments.length} pagamento{overduePayments.length > 1 ? "s" : ""} em atraso
              </h3>
              <p className="text-sm text-red-600/80 mt-0.5">
                Total em atraso: {formatCurrency(totalOverdue)}. Entre em contato com a administração para regularizar.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="group relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-blue-600/10 group-hover:from-blue-500/10 group-hover:to-blue-600/15 transition-colors" />
          <CardContent className="relative p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Aluguel Mensal</p>
                <p className="text-xl md:text-2xl font-bold text-foreground">
                  {formatCurrency(contract.monthly_rent)}
                </p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Wallet className="h-5 w-5 text-blue-600" />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Vencimento todo dia <span className="font-semibold text-foreground">{contract.payment_day}</span>
            </p>
          </CardContent>
        </Card>

        <Card className="group relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-emerald-600/10 group-hover:from-emerald-500/10 group-hover:to-emerald-600/15 transition-colors" />
          <CardContent className="relative p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Pago</p>
                <p className="text-xl md:text-2xl font-bold text-foreground">
                  {formatCurrency(totalPaid)}
                </p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2">
              <ArrowUpRight className="h-3 w-3 text-emerald-500" />
              <p className="text-[11px] text-emerald-600 font-medium">{paidPayments.length} pagamento{paidPayments.length !== 1 ? "s" : ""}</p>
            </div>
          </CardContent>
        </Card>

        <Card className={`group relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300 \${overduePayments.length > 0 ? "ring-1 ring-red-200" : ""}`}>
          <div className={`absolute inset-0 bg-gradient-to-br \${overduePayments.length > 0 ? "from-red-500/5 to-red-600/10 group-hover:from-red-500/10 group-hover:to-red-600/15" : "from-amber-500/5 to-amber-600/10 group-hover:from-amber-500/10 group-hover:to-amber-600/15"} transition-colors`} />
          <CardContent className="relative p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {overduePayments.length > 0 ? "Em Atraso" : "Pendente"}
                </p>
                <p className={`text-xl md:text-2xl font-bold \${overduePayments.length > 0 ? "text-red-600" : "text-foreground"}`}>
                  {overduePayments.length > 0 ? formatCurrency(totalOverdue) : formatCurrency(totalPending)}
                </p>
              </div>
              <div className={`h-11 w-11 rounded-xl \${overduePayments.length > 0 ? "bg-red-500/10" : "bg-amber-500/10"} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                {overduePayments.length > 0 ? (
                  <ArrowDownRight className="h-5 w-5 text-red-600" />
                ) : (
                  <Clock className="h-5 w-5 text-amber-600" />
                )}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              {overduePayments.length > 0
                ? `\${overduePayments.length} parcela\${overduePayments.length > 1 ? "s" : ""} vencida\${overduePayments.length > 1 ? "s" : ""}`
                : `\${pendingPayments.length} parcela\${pendingPayments.length > 1 ? "s" : ""} futura\${pendingPayments.length > 1 ? "s" : ""}`}
            </p>
          </CardContent>
        </Card>

        <Card className="group relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-violet-600/10 group-hover:from-violet-500/10 group-hover:to-violet-600/15 transition-colors" />
          <CardContent className="relative p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Contrato</p>
                <p className="text-xl md:text-2xl font-bold text-foreground">
                  {contractRemainingMonths > 0 ? `\${contractRemainingMonths}m` : `\${contractRemainingDays}d`}
                </p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-violet-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileText className="h-5 w-5 text-violet-600" />
              </div>
            </div>
            <div className="mt-2 space-y-1">
              <Progress value={contractProgress} className="h-1.5" />
              <p className="text-[11px] text-muted-foreground">{contractProgress}% · {contractRemainingDays} dias</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left Column - Payments */}
        <div className="lg:col-span-3 space-y-6">
          {/* Contas a Pagar */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Receipt className="h-4 w-4 text-amber-600" />
                  </div>
                  Contas a Pagar
                </CardTitle>
                <Badge variant="secondary" className="font-mono">
                  {overduePayments.length + pendingPayments.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {overduePayments.length === 0 && pendingPayments.length === 0 ? (
                <div className="text-center py-8">
                  <div className="h-16 w-16 mx-auto rounded-full bg-emerald-50 flex items-center justify-center mb-3">
                    <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                  </div>
                  <p className="font-medium text-emerald-700">Tudo em dia!</p>
                  <p className="text-sm text-muted-foreground mt-1">Nenhuma conta pendente no momento.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {overduePayments
                    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
                    .map((p) => {
                      const daysLate = differenceInDays(today, new Date(p.due_date));
                      return (
                        <div
                          key={p.id}
                          className="group flex items-center justify-between rounded-xl border border-red-200/60 bg-gradient-to-r from-red-50/80 to-transparent p-4 hover:shadow-sm transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                              <XCircle className="h-5 w-5 text-red-500" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-red-800 capitalize">
                                {format(new Date(p.due_date), "MMMM 'de' yyyy", { locale: ptBR })}
                              </p>
                              <p className="text-xs text-red-500">
                                Venceu em {format(new Date(p.due_date), "dd/MM/yyyy")} · {daysLate} dia{daysLate > 1 ? "s" : ""} atrás
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-base font-bold text-red-700">{formatCurrency(Number(p.amount))}</p>
                            {p.late_fee && Number(p.late_fee) > 0 && (
                              <p className="text-[10px] text-red-500 font-medium">
                                + {formatCurrency(Number(p.late_fee))} multa
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}

                  {pendingPayments
                    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
                    .map((p) => {
                      const daysLeft = differenceInDays(new Date(p.due_date), today);
                      return (
                        <div
                          key={p.id}
                          className="group flex items-center justify-between rounded-xl border p-4 hover:bg-muted/30 hover:shadow-sm transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 \${daysLeft <= 5 ? "bg-amber-100" : "bg-blue-50"}`}>
                              <Clock className={`h-5 w-5 \${daysLeft <= 5 ? "text-amber-500" : "text-blue-400"}`} />
                            </div>
                            <div>
                              <p className="text-sm font-semibold capitalize">
                                {format(new Date(p.due_date), "MMMM 'de' yyyy", { locale: ptBR })}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Vence em {format(new Date(p.due_date), "dd/MM/yyyy")}
                                {daysLeft <= 5 && (
                                  <span className="text-amber-600 font-medium"> · {daysLeft === 0 ? "Vence hoje!" : `em \${daysLeft} dia\${daysLeft > 1 ? "s" : ""}`}</span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-base font-bold">{formatCurrency(Number(p.amount))}</p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment History */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <CreditCard className="h-4 w-4 text-emerald-600" />
                  </div>
                  Histórico de Pagamentos
                </CardTitle>
                <div className="flex gap-1.5">
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                    <CheckCircle2 className="h-3 w-3 mr-1" />{paidPayments.length}
                  </Badge>
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                    <Clock className="h-3 w-3 mr-1" />{pendingPayments.length}
                  </Badge>
                  {overduePayments.length > 0 && (
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                      <XCircle className="h-3 w-3 mr-1" />{overduePayments.length}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum pagamento registrado.</p>
              ) : (
                <div className="space-y-1.5">
                  {payments.map((p) => {
                    const isPaid = p.is_paid;
                    const isOverdue = !isPaid && isBefore(new Date(p.due_date), today);
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 \${
                            isPaid ? "bg-emerald-100" : isOverdue ? "bg-red-100" : "bg-amber-100"
                          }`}>
                            {isPaid ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            ) : isOverdue ? (
                              <XCircle className="h-4 w-4 text-red-600" />
                            ) : (
                              <Clock className="h-4 w-4 text-amber-600" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium capitalize">
                              {format(new Date(p.due_date), "MMMM/yyyy", { locale: ptBR })}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Venc: {format(new Date(p.due_date), "dd/MM/yyyy")}
                              {p.paid_date && (
                                <span className="text-emerald-600"> · Pago em {format(new Date(p.paid_date), "dd/MM/yyyy")}</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-0.5">
                          <p className="text-sm font-bold">{formatCurrency(Number(p.amount))}</p>
                          {p.late_fee && Number(p.late_fee) > 0 && (
                            <p className="text-[10px] text-red-500 font-medium">
                              + {formatCurrency(Number(p.late_fee))} multa
                            </p>
                          )}
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 \${
                              isPaid
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : isOverdue
                                ? "bg-red-50 text-red-700 border-red-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}
                          >
                            {isPaid ? "Pago" : isOverdue ? "Atrasado" : "Pendente"}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Unit & Contract Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Unit Card */}
          <Card className="border-0 shadow-md overflow-hidden">
            <div className="bg-gradient-to-br from-primary/5 via-primary/3 to-transparent p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center shadow-sm">
                  <Building2 className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">{contract.unit?.name || "Unidade"}</h3>
                  {contract.unit && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      Nº {contract.unit.address_number}
                      {contract.unit.floor && ` · \${contract.unit.floor}º andar`}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {contract.unit?.area_sqm && (
                  <div className="rounded-xl bg-white/80 backdrop-blur-sm border p-3 shadow-sm">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Ruler className="h-3.5 w-3.5" />
                      <span className="text-[11px] font-medium uppercase tracking-wider">Área</span>
                    </div>
                    <p className="text-base font-bold">{Number(contract.unit.area_sqm).toLocaleString("pt-BR")} m²</p>
                  </div>
                )}
                {contract.unit?.floor && (
                  <div className="rounded-xl bg-white/80 backdrop-blur-sm border p-3 shadow-sm">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Layers className="h-3.5 w-3.5" />
                      <span className="text-[11px] font-medium uppercase tracking-wider">Andar</span>
                    </div>
                    <p className="text-base font-bold">{contract.unit.floor}º andar</p>
                  </div>
                )}
                {contract.unit?.electricity_connection && (
                  <div className="rounded-xl bg-white/80 backdrop-blur-sm border p-3 shadow-sm">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Zap className="h-3.5 w-3.5" />
                      <span className="text-[11px] font-medium uppercase tracking-wider">Energia</span>
                    </div>
                    <p className="text-sm font-bold truncate">{contract.unit.electricity_connection}</p>
                  </div>
                )}
                {contract.unit?.water_connection && (
                  <div className="rounded-xl bg-white/80 backdrop-blur-sm border p-3 shadow-sm">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Droplets className="h-3.5 w-3.5" />
                      <span className="text-[11px] font-medium uppercase tracking-wider">Água</span>
                    </div>
                    <p className="text-sm font-bold truncate">{contract.unit.water_connection}</p>
                  </div>
                )}
              </div>

              {contract.unit?.description && (
                <div className="mt-4 rounded-xl bg-white/80 backdrop-blur-sm border p-3 shadow-sm">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Descrição</p>
                  <p className="text-sm text-foreground leading-relaxed">{contract.unit.description}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Contract Details */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-violet-600" />
                </div>
                Detalhes do Contrato
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className="font-semibold">{contractProgress}%</span>
                </div>
                <Progress value={contractProgress} className="h-2" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{format(new Date(contract.start_date), "dd/MM/yy")}</span>
                  <span>{format(new Date(contract.end_date), "dd/MM/yy")}</span>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <CalendarDays className="h-3.5 w-3.5" /> Início
                  </span>
                  <span className="text-sm font-semibold">{format(new Date(contract.start_date), "dd/MM/yyyy")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <CalendarDays className="h-3.5 w-3.5" /> Término
                  </span>
                  <span className="text-sm font-semibold">{format(new Date(contract.end_date), "dd/MM/yyyy")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <CalendarClock className="h-3.5 w-3.5" /> Dia Vencimento
                  </span>
                  <span className="text-sm font-semibold">Todo dia {contract.payment_day}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <DollarSign className="h-3.5 w-3.5" /> Valor Mensal
                  </span>
                  <span className="text-sm font-bold text-primary">{formatCurrency(contract.monthly_rent)}</span>
                </div>
                {contract.deposit_amount && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <ShieldCheck className="h-3.5 w-3.5" /> Caução
                    </span>
                    <span className="text-sm font-semibold">
                      {formatCurrency(Number(contract.deposit_amount))}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5" /> Restante
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {contractRemainingDays} dias ({contractRemainingMonths} meses)
                  </Badge>
                </div>
              </div>

              {contract.notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Observações</p>
                    <p className="text-sm text-foreground bg-muted/50 rounded-lg p-3 leading-relaxed">{contract.notes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Payment Summary */}
          <Card className="border-0 shadow-md bg-gradient-to-br from-emerald-50/50 to-blue-50/50">
            <CardContent className="p-5">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                Resumo Financeiro
              </h4>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-sm text-muted-foreground">Total Pago</span>
                  </div>
                  <span className="text-sm font-bold text-emerald-700">{formatCurrency(totalPaid)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-amber-500" />
                    <span className="text-sm text-muted-foreground">Pendente</span>
                  </div>
                  <span className="text-sm font-bold text-amber-700">{formatCurrency(totalPending)}</span>
                </div>
                {totalOverdue > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-red-500" />
                      <span className="text-sm text-muted-foreground">Em Atraso</span>
                    </div>
                    <span className="text-sm font-bold text-red-700">{formatCurrency(totalOverdue)}</span>
                  </div>
                )}
                <Separator className="my-1" />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total Geral</span>
                  <span className="text-sm font-bold">{formatCurrency(totalPaid + totalPending + totalOverdue)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TenantPortal;
