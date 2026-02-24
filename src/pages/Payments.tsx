import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditCard } from "lucide-react";
import { format } from "date-fns";

const Payments = () => {
  const { data: payments, isLoading } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*, contracts(monthly_rent, units(name), tenants(full_name))")
        .order("due_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Pagamentos</h1>
        <p className="mt-1 text-muted-foreground">Controle de recebimentos de aluguéis</p>
      </div>

      <Card className="glass-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Inquilino</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : payments?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhum pagamento registrado. Os pagamentos serão gerados automaticamente a partir dos contratos ativos.
                  </TableCell>
                </TableRow>
              ) : (
                payments?.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.contracts?.tenants?.full_name}</TableCell>
                    <TableCell>{p.contracts?.units?.name}</TableCell>
                    <TableCell>{format(new Date(p.due_date), "dd/MM/yyyy")}</TableCell>
                    <TableCell>R$ {Number(p.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell>
                      <Badge variant={p.is_paid ? "default" : "destructive"}>
                        {p.is_paid ? "Pago" : "Pendente"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Payments;
