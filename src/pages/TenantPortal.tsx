import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  DollarSign,
  CalendarDays,
  MapPin,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ContractInfo {
  id: string;
  monthly_rent: number;
  start_date: string;
  end_date: string;
  status: string;
  payment_day: number;
  unit: {
    id: string;
    name: string;
    address_number: string;
    floor: string | null;
  } | null;
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
  }, [profile]);

  const loadTenantData = async () => {
    setLoading(true);
    try {
      // Load active contract
      const { data: contractData } = await supabase
        .from("contracts")
        .select(`
          id, monthly_rent, start_date, end_date, status, payment_day,
          unit:units(id, name, address_number, floor)
        `)
        .eq("tenant_id", profile!.tenant_id!)
        .eq("status", "active")
        .maybeSingle();

      if (contractData) {
        setContract(contractData as unknown as ContractInfo);

        // Load recent payments for this contract
        const { data: paymentData } = await supabase
          .from("payments")
          .select("id, amount, due_date, paid_date, is_paid, late_fee, notes")
          .eq("contract_id", contractData.id)
          .order("due_date", { ascending: false })
          .limit(12);

        if (paymentData) {
          setPayments(paymentData as PaymentInfo[]);
        }
      }
    } catch (err) {
      console.error("Error loading tenant data:", err);
    }
    setLoading(false);
  };

  const paymentStatusBadge = (payment: PaymentInfo) => {
    if (payment.is_paid) {
      return <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/20">Pago</Badge>;
    }
    const isOverdue = new Date(payment.due_date) < new Date();
    if (isOverdue) {
      return <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-500/20">Atrasado</Badge>;
    }
    return <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/20">Pendente</Badge>;
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ─── Tenant with active contract ───
  if (contract) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Minha Sala</h1>
          <p className="text-muted-foreground">Informações da sua unidade e pagamentos</p>
        </div>

        {/* Unit Info */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">{contract.unit?.name || "Unidade"}</CardTitle>
                {contract.unit && (
                  <CardDescription className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Nº {contract.unit.address_number}{contract.unit.floor ? ` · ${contract.unit.floor}º andar` : ""}
                  </CardDescription>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Aluguel</p>
                <p className="text-lg font-bold">
                  R$ {contract.monthly_rent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Vencimento</p>
                <p className="text-lg font-bold">Dia {contract.payment_day}</p>
              </div>
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
            </div>
          </CardContent>
        </Card>

        {/* Payments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <DollarSign className="h-5 w-5" />
              Pagamentos
            </CardTitle>
            <CardDescription>Histórico dos seus pagamentos</CardDescription>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhum pagamento registrado.
              </p>
            ) : (
              <div className="space-y-3">
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {format(new Date(p.due_date), "MMMM/yyyy", { locale: ptBR })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Vencimento: {format(new Date(p.due_date), "dd/MM/yyyy")}
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
      </div>
    );
  }

  // ─── No contract found ───
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
};

export default TenantPortal;
