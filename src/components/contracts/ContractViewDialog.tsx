import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Pencil, Printer, Building2, User, CalendarDays, DollarSign, FileWarning, CheckCircle, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const statusMap = {
  active: { label: "Ativo", variant: "default" as const, className: "bg-green-500 text-white" },
  pending: { label: "Pendente", variant: "secondary" as const, className: "" },
  awaiting_approval: { label: "Aguardando Aprovação", variant: "secondary" as const, className: "bg-yellow-500 text-white" },
  expired: { label: "Expirado", variant: "outline" as const, className: "" },
  terminated: { label: "Rescindido", variant: "destructive" as const, className: "" },
};

const fmt = (v: string) => format(new Date(v + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR });
const money = (v: number | null) =>
  v != null ? `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: any;
  onEdit: () => void;
  onPrint: () => void;
  onApprove?: (contract: any) => void;
  onReject?: (contract: any) => void;
  approving?: boolean;
}

export default function ContractViewDialog({ open, onOpenChange, contract, onEdit, onPrint, onApprove, onReject, approving }: Props) {
  const { hasPermission } = useAuth();
  if (!contract) return null;

  const c = contract;
  const st = statusMap[c.status as keyof typeof statusMap] ?? statusMap.pending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90dvh] overflow-y-auto sm:w-full rounded-xl">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left">
            <DialogTitle className="text-xl">Detalhes do Contrato</DialogTitle>
            <Badge variant={st.variant} className={`w-fit ${(st as any).className || ""}`}>{st.label}</Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Partes */}
          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              <Building2 className="h-4 w-4" /> Partes
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 text-sm">
              <div>
                <span className="text-muted-foreground block mb-0.5">Unidade</span>
                <p className="font-medium">{c.units?.name} ({c.units?.address_number})</p>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5">Inquilino</span>
                <p className="font-medium">{c.tenants?.full_name}</p>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5">Locador Principal</span>
                <p className="font-medium">{c.landlords?.full_name}</p>
              </div>
              {c.second_landlord && (
                <div>
                  <span className="text-muted-foreground block mb-0.5">Segundo Locador</span>
                  <p className="font-medium">{c.second_landlord?.full_name}</p>
                </div>
              )}
            </div>
          </section>

          <Separator />

          {/* Período */}
          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              <CalendarDays className="h-4 w-4" /> Período
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-4 gap-x-6 text-sm">
              <div>
                <span className="text-muted-foreground block mb-0.5">Início</span>
                <p className="font-medium">{fmt(c.start_date)}</p>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5">Término</span>
                <p className="font-medium">{fmt(c.end_date)}</p>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5">Duração</span>
                <p className="font-medium">{c.duration_months} meses</p>
              </div>
            </div>
          </section>

          <Separator />

          {/* Valores */}
          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              <DollarSign className="h-4 w-4" /> Valores
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-4 gap-x-6 text-sm">
              <div>
                <span className="text-muted-foreground block mb-0.5">Aluguel Mensal</span>
                <p className="font-medium text-lg text-primary">{money(c.monthly_rent)}</p>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5">Dia do Vencimento</span>
                <p className="font-medium">Dia {c.payment_day}</p>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5">Fiança / Depósito</span>
                <p className="font-medium">{money(c.deposit_amount)}</p>
              </div>
            </div>
          </section>

          <Separator />

          {/* Multas e Reajuste */}
          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              <FileWarning className="h-4 w-4" /> Multas e Reajuste
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-4 gap-x-6 text-sm">
              <div>
                <span className="text-muted-foreground block mb-0.5">Multa diária</span>
                <p className="font-medium">{c.late_fee_percent ?? 0.33}%</p>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5">Multa máxima</span>
                <p className="font-medium">{c.late_fee_max_percent ?? 20}%</p>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5">Índice de Reajuste</span>
                <p className="font-medium">{c.adjustment_index ?? "IGP-M"}</p>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5">Multa rescisão</span>
                <p className="font-medium">{c.rescission_penalty_months ?? 3} meses de aluguel</p>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5">Taxa de limpeza</span>
                <p className="font-medium">{money(c.cleaning_fee)}</p>
              </div>
            </div>
          </section>

          {c.notes && (
            <>
              <Separator />
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Observações
                </h3>
                <p className="text-sm whitespace-pre-wrap">{c.notes}</p>
              </section>
            </>
          )}

          {/* Ações */}
          <div className="flex gap-3 pt-2 flex-wrap">
            {c.status === "awaiting_approval" && hasPermission("admin") && (
              <>
                {onApprove && (
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => onApprove(c)}
                    disabled={approving}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    {approving ? "Aprovando..." : "Aprovar"}
                  </Button>
                )}
                {onReject && (
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => onReject(c)}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Recusar
                  </Button>
                )}
              </>
            )}
            {hasPermission("admin") && (
            <Button variant="outline" className="flex-1" onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" /> Editar
            </Button>
            )}
            <Button variant="outline" className="flex-1" onClick={onPrint}>
              <Printer className="mr-2 h-4 w-4" /> Imprimir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
