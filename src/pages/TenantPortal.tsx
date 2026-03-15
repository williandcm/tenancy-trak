import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  DollarSign,
  CalendarDays,
  MapPin,
  AlertTriangle,
  Loader2,
  FileText,
  Home,
  CheckCircle2,
  Clock,
  XCircle,
  Ruler,
  Layers,
  CreditCard,
} from "lucide-react";
import { format, isBefore } from "date-fns";
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
  security_deposit: number | null;
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
          id, monthly_rent, start_date, end_date, status, payment_day, security_deposit, notes,
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
          .limit(24);

        if (paymentData) {
          setPayments(paymentData as PaymentInfo[]);
        }
      }
    } catch (err) {
      console.error("Error loading tenant data:", err);
    }
    setLoading(false);
  };

  const today = new Date();

  const paymentStatusBadge = (payment: PaymentInfo) => {
    if (payment.is_paid) {
      return (
        <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/20">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Pago
        </Badge>
      );
    }
    const isOverdue = isBefore(new Date(payment.due_date), today);
    if (isOverdue) {
      return (
        <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-500/20">
          <XCircle className="h-3 w-3 mr-1" /> Atrasado
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/20">
        <Clock className="h-3 w-3 mr-1" /> Pendente
      </Badge>
    );
  };

  const paidCount = payments.filter((p) => p.is_paid).length;
  const overdueCount = payments.filter((p) => !p.is_paid && isBefore(new Date(p.due_date), today)).length;
  const pendingCount = payments.filter((p) => !p.is_paid && !isBefore(new Date(p.due_date), today)).length;
  const totalPaid = payments.filter((p) => p.is_paid).reduce((s, p) => s + Number(p.amount) + Number(p.late_fee || 0), 0);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <AlertTriangle className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold">Nenhum Contrato Ativo</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Não encontramos um contrato ativo vinculado à sua conta. Entre em contato com o administrador para mais informações.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Minha Sala</h1>
        <p className="text-muted-foreground">
          Bem-vindo(a), {profile?.full_name}. Aqui estão as informações da sua unidade.
        </p>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dashboard" className="flex items-center gap-1.5">
            <Home className="h-4 w-4" /> Resumo
          </TabsTrigger>
          <TabsTrigger value="unit" className="flex items-center gap-1.5">
            <Building2 className="h-4 w-4" /> Unidade
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center gap-1.5">
            <CreditCard className="h-4 w-4" /> Pagamentos
          </TabsTrigger>
        </TabsList>

        {/* TAB: RESUMO */}
        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Card className="glass-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Unidade</p>
                    <p className="text-lg font-bold">{contract.unit?.name || "—"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                    <DollarSign className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Aluguel</p>
                    <p className="text-lg font-bold">
                      R$ {contract.monthly_rent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                    <CalendarDays className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Vencimento</p>
                    <p className="text-lg font-bold">Dia {contract.payment_day}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${overdueCount > 0 ? "bg-red-500/10" : "bg-green-500/10"}`}>
                    {overdueCount > 0 ? (
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Situação</p>
                    <p className={`text-lg font-bold ${overdueCount > 0 ? "text-red-600" : "text-green-600"}`}>
                      {overdueCount > 0 ? `${overdueCount} em atraso` : "Em dia"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5" /> Contrato
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Início</p>
                  <p className="text-sm font-semibold">
                    {format(new Date(contract.start_date), "dd/MM/yyyy")}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Término</p>
                  <p className="text-sm font-semibold">
                    {format(new Date(contract.end_date), "dd/MM/yyyy")}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/20 mt-1">
                    Ativo
                  </Badge>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Total Pago</p>
                  <p className="text-sm font-semibold">
                    R$ {totalPaid.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CreditCard className="h-5 w-5" /> Últimos Pagamentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum pagamento registrado.</p>
              ) : (
                <div className="space-y-2">
                  {payments.slice(0, 5).map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                          <CalendarDays className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {format(new Date(p.due_date), "MMMM/yyyy", { locale: ptBR })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Venc: {format(new Date(p.due_date), "dd/MM/yyyy")}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <p className="text-sm font-semibold">
                          R$ {p.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                        {paymentStatusBadge(p)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: UNIDADE */}
        <TabsContent value="unit" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">{contract.unit?.name || "Unidade"}</CardTitle>
                  {contract.unit && (
                    <CardDescription className="flex items-center gap-1 mt-1">
                      <MapPin className="h-3 w-3" />
                      Nº {contract.unit.address_number}
                      {contract.unit.floor ? ` · ${contract.unit.floor}º andar` : ""}
                    </CardDescription>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                {contract.unit?.area_sqm && (
                  <div className="flex items-center gap-3 rounded-lg border p-4">
                    <Ruler className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Área</p>
                      <p className="font-semibold">{Number(contract.unit.area_sqm).toLocaleString("pt-BR")} m²</p>
                    </div>
                  </div>
                )}
                {contract.unit?.floor && (
                  <div className="flex items-center gap-3 rounded-lg border p-4">
                    <Layers className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Andar</p>
                      <p className="font-semibold">{contract.unit.floor}º andar</p>
                    </div>
                  </div>
                )}
                {contract.unit?.electricity_connection && (
                  <div className="flex items-center gap-3 rounded-lg border p-4">
                    <span className="text-lg">⚡</span>
                    <div>
                      <p className="text-xs text-muted-foreground">Conexão Elétrica</p>
                      <p className="font-semibold">{contract.unit.electricity_connection}</p>
                    </div>
                  </div>
                )}
                {contract.unit?.water_connection && (
                  <div className="flex items-center gap-3 rounded-lg border p-4">
                    <span className="text-lg">💧</span>
                    <div>
                      <p className="text-xs text-muted-foreground">Conexão Água</p>
                      <p className="font-semibold">{contract.unit.water_connection}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3 rounded-lg border p-4">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Endereço</p>
                    <p className="font-semibold">Nº {contract.unit?.address_number || "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border p-4">
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Aluguel Mensal</p>
                    <p className="font-semibold">
                      R$ {contract.monthly_rent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>

              {contract.unit?.description && (
                <>
                  <Separator className="my-4" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Descrição</p>
                    <p className="text-sm">{contract.unit.description}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5" /> Detalhes do Contrato
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-xs text-muted-foreground">Período</p>
                  <p className="text-sm font-semibold mt-1">
                    {format(new Date(contract.start_date), "dd/MM/yyyy")} a {format(new Date(contract.end_date), "dd/MM/yyyy")}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-xs text-muted-foreground">Dia de Vencimento</p>
                  <p className="text-sm font-semibold mt-1">Todo dia {contract.payment_day}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-xs text-muted-foreground">Valor Mensal</p>
                  <p className="text-sm font-semibold mt-1">
                    R$ {contract.monthly_rent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                {contract.security_deposit && (
                  <div className="rounded-lg bg-muted/50 p-4">
                    <p className="text-xs text-muted-foreground">Caução</p>
                    <p className="text-sm font-semibold mt-1">
                      R$ {Number(contract.security_deposit).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                )}
              </div>
              {contract.notes && (
                <>
                  <Separator className="my-4" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Observações</p>
                    <p className="text-sm">{contract.notes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: PAGAMENTOS */}
        <TabsContent value="payments" className="space-y-4">
          <div className="grid gap-4 grid-cols-3">
            <Card className="glass-card">
              <CardContent className="p-4 text-center">
                <CheckCircle2 className="h-6 w-6 text-green-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-green-600">{paidCount}</p>
                <p className="text-xs text-muted-foreground">Pagos</p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="p-4 text-center">
                <Clock className="h-6 w-6 text-amber-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="p-4 text-center">
                <XCircle className="h-6 w-6 text-red-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-red-600">{overdueCount}</p>
                <p className="text-xs text-muted-foreground">Atrasados</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CreditCard className="h-5 w-5" /> Histórico de Pagamentos
              </CardTitle>
              <CardDescription>Todos os pagamentos do seu contrato</CardDescription>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum pagamento registrado.
                </p>
              ) : (
                <div className="space-y-2">
                  {payments.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-full ${
                          p.is_paid ? "bg-green-500/10" : isBefore(new Date(p.due_date), today) ? "bg-red-500/10" : "bg-amber-500/10"
                        }`}>
                          {p.is_paid ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : isBefore(new Date(p.due_date), today) ? (
                            <XCircle className="h-4 w-4 text-red-600" />
                          ) : (
                            <Clock className="h-4 w-4 text-amber-600" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {format(new Date(p.due_date), "MMMM 'de' yyyy", { locale: ptBR })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Vencimento: {format(new Date(p.due_date), "dd/MM/yyyy")}
                            {p.paid_date && ` · Pago em ${format(new Date(p.paid_date), "dd/MM/yyyy")}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <p className="text-sm font-semibold">
                          R$ {p.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                        {p.late_fee && Number(p.late_fee) > 0 && (
                          <p className="text-[10px] text-red-500">
                            + R$ {Number(p.late_fee).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} multa
                          </p>
                        )}
                        {paymentStatusBadge(p)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TenantPortal;
