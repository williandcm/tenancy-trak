import { useState, useEffect, useRef } from "react";
import { addMonths, format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

const fieldLabels: Record<string, string> = {
  unit_id: "Selecione a unidade",
  tenant_id: "Selecione o inquilino",
  landlord_id: "Selecione o locador",
  start_date: "Preencha a data de início",
  duration_months: "Preencha a duração",
  monthly_rent: "Preencha o valor do aluguel",
};

function FieldHint({ field, errors }: { field: string; errors: Record<string, boolean> }) {
  if (!errors[field]) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-destructive mt-1">
      <AlertCircle className="h-3 w-3" />
      {fieldLabels[field]}
    </p>
  );
}

interface ContractForm {
  unit_id: string;
  tenant_id: string;
  landlord_id: string;
  second_landlord_id: string;
  start_date: string;
  duration_months: string;
  monthly_rent: string;
  payment_day: string;
  deposit_amount: string;
  late_fee_percent: string;
  late_fee_max_percent: string;
  adjustment_index: string;
  rescission_penalty_months: string;
  cleaning_fee: string;
  status: string;
  notes: string;
}

const emptyForm: ContractForm = {
  unit_id: "",
  tenant_id: "",
  landlord_id: "",
  second_landlord_id: "",
  start_date: "",
  duration_months: "36",
  monthly_rent: "",
  payment_day: "20",
  deposit_amount: "",
  late_fee_percent: "0.33",
  late_fee_max_percent: "20",
  adjustment_index: "IGPM",
  rescission_penalty_months: "3",
  cleaning_fee: "",
  status: "pending",
  notes: "",
};

function calcEndDate(startDate: string, months: string): string {
  if (!startDate || !months) return "";
  try {
    const d = new Date(startDate + "T12:00:00");
    const end = addMonths(d, parseInt(months) || 0);
    return format(end, "yyyy-MM-dd");
  } catch {
    return "";
  }
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract?: any; // existing contract for editing
  prefill?: Partial<ContractForm>; // pre-fill values for new contract request
  units?: Tables<"units">[];
  tenants?: Tables<"tenants">[];
  landlords?: Tables<"landlords">[];
  onSave: (data: any, isEdit: boolean) => void;
  saving: boolean;
}

export default function ContractFormDialog({
  open, onOpenChange, contract, prefill, units, tenants, landlords, onSave, saving,
}: Props) {
  const [form, setForm] = useState<ContractForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const isEdit = !!contract && !prefill;

  // Refs for focusing on first invalid field
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (contract && !prefill) {
      setForm({
        unit_id: contract.unit_id ?? "",
        tenant_id: contract.tenant_id ?? "",
        landlord_id: contract.landlord_id ?? "",
        second_landlord_id: contract.second_landlord_id ?? "",
        start_date: contract.start_date ?? "",
        duration_months: String(contract.duration_months ?? "36"),
        monthly_rent: String(contract.monthly_rent ?? ""),
        payment_day: String(contract.payment_day ?? "20"),
        deposit_amount: contract.deposit_amount ? String(contract.deposit_amount) : "",
        late_fee_percent: String(contract.late_fee_percent ?? "0.33"),
        late_fee_max_percent: String(contract.late_fee_max_percent ?? "20"),
        adjustment_index: contract.adjustment_index ?? "IGPM",
        rescission_penalty_months: String(contract.rescission_penalty_months ?? "3"),
        cleaning_fee: contract.cleaning_fee ? String(contract.cleaning_fee) : "",
        status: contract.status ?? "pending",
        notes: contract.notes ?? "",
      });
    } else if (prefill) {
      setForm({ ...emptyForm, ...prefill });
    } else {
      setForm(emptyForm);
    }
    setErrors({});
  }, [contract, prefill, open]);

  const update = (field: keyof ContractForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (value) setErrors((prev) => ({ ...prev, [field]: false }));
  };

  // Ordered list of required fields for focus priority
  const requiredFields: { key: string; check: () => boolean }[] = [
    { key: "unit_id", check: () => !form.unit_id },
    { key: "tenant_id", check: () => !form.tenant_id },
    { key: "landlord_id", check: () => !form.landlord_id },
    { key: "start_date", check: () => !form.start_date },
    { key: "duration_months", check: () => !form.duration_months || parseInt(form.duration_months) < 1 },
    { key: "monthly_rent", check: () => !form.monthly_rent || parseFloat(form.monthly_rent) <= 0 },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    const newErrors: Record<string, boolean> = {};
    let firstInvalidKey: string | null = null;

    for (const { key, check } of requiredFields) {
      if (check()) {
        newErrors[key] = true;
        if (!firstInvalidKey) firstInvalidKey = key;
      }
    }

    setErrors(newErrors);

    if (firstInvalidKey) {
      const el = fieldRefs.current[firstInvalidKey];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        // For Select triggers, click to open; for inputs, focus
        setTimeout(() => {
          if (el.tagName === "BUTTON") {
            el.click();
          } else {
            el.focus();
          }
        }, 300);
      }
      toast.error(`Preencha este campo: ${fieldLabels[firstInvalidKey]}`);
      return;
    }

    const endDate = calcEndDate(form.start_date, form.duration_months);
    const payload = {
      unit_id: form.unit_id,
      tenant_id: form.tenant_id,
      landlord_id: form.landlord_id,
      second_landlord_id: form.second_landlord_id || null,
      start_date: form.start_date,
      end_date: endDate,
      duration_months: parseInt(form.duration_months),
      monthly_rent: parseFloat(form.monthly_rent),
      payment_day: parseInt(form.payment_day),
      deposit_amount: form.deposit_amount ? parseFloat(form.deposit_amount) : null,
      late_fee_percent: parseFloat(form.late_fee_percent),
      late_fee_max_percent: parseFloat(form.late_fee_max_percent),
      adjustment_index: form.adjustment_index,
      rescission_penalty_months: parseInt(form.rescission_penalty_months),
      cleaning_fee: form.cleaning_fee ? parseFloat(form.cleaning_fee) : null,
      status: form.status as Tables<"contracts">["status"],
      notes: form.notes || null,
    };
    onSave(payload, isEdit);
  };

  const computedEndDate = calcEndDate(form.start_date, form.duration_months);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {isEdit ? "Editar Contrato" : prefill ? "Solicitar Contrato" : "Novo Contrato de Locação"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          {/* Partes */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Partes do Contrato
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className={errors.unit_id ? "text-destructive" : ""}>Unidade *</Label>
                <Select value={form.unit_id} onValueChange={(v) => update("unit_id", v)}>
                  <SelectTrigger ref={(el) => { fieldRefs.current.unit_id = el; }} className={errors.unit_id ? "border-destructive ring-1 ring-destructive" : ""}><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                  <SelectContent>
                    {units?.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} ({u.address_number})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldHint field="unit_id" errors={errors} />
              </div>
              <div className="space-y-2">
                <Label className={errors.tenant_id ? "text-destructive" : ""}>Inquilino *</Label>
                <Select value={form.tenant_id} onValueChange={(v) => update("tenant_id", v)}>
                  <SelectTrigger ref={(el) => { fieldRefs.current.tenant_id = el; }} className={errors.tenant_id ? "border-destructive ring-1 ring-destructive" : ""}><SelectValue placeholder="Selecione o inquilino" /></SelectTrigger>
                  <SelectContent>
                    {tenants?.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldHint field="tenant_id" errors={errors} />
              </div>
              <div className="space-y-2">
                <Label className={errors.landlord_id ? "text-destructive" : ""}>Locador Principal *</Label>
                <Select value={form.landlord_id} onValueChange={(v) => update("landlord_id", v)}>
                  <SelectTrigger ref={(el) => { fieldRefs.current.landlord_id = el; }} className={errors.landlord_id ? "border-destructive ring-1 ring-destructive" : ""}><SelectValue placeholder="Selecione o locador" /></SelectTrigger>
                  <SelectContent>
                    {landlords?.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldHint field="landlord_id" errors={errors} />
              </div>
              <div className="space-y-2">
                <Label>Segundo Locador (opcional)</Label>
                <Select value={form.second_landlord_id || "__none__"} onValueChange={(v) => update("second_landlord_id", v === "__none__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhum</SelectItem>
                    {landlords?.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Período */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Período e Valores
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className={errors.start_date ? "text-destructive" : ""}>Data Início *</Label>
                <Input ref={(el) => { fieldRefs.current.start_date = el; }} type="date" value={form.start_date} onChange={(e) => update("start_date", e.target.value)} className={errors.start_date ? "border-destructive ring-1 ring-destructive" : ""} />
                <FieldHint field="start_date" errors={errors} />
              </div>
              <div className="space-y-2">
                <Label className={errors.duration_months ? "text-destructive" : ""}>Duração (meses) *</Label>
                <Input ref={(el) => { fieldRefs.current.duration_months = el; }} type="number" min={1} value={form.duration_months} onChange={(e) => update("duration_months", e.target.value)} className={errors.duration_months ? "border-destructive ring-1 ring-destructive" : ""} />
                <FieldHint field="duration_months" errors={errors} />
              </div>
              <div className="space-y-2">
                <Label>Data Término (calculada)</Label>
                <Input
                  type="date"
                  value={computedEndDate}
                  readOnly
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label className={errors.monthly_rent ? "text-destructive" : ""}>Aluguel Mensal (R$) *</Label>
                <Input ref={(el) => { fieldRefs.current.monthly_rent = el; }} type="number" step="0.01" value={form.monthly_rent} onChange={(e) => update("monthly_rent", e.target.value)} className={errors.monthly_rent ? "border-destructive ring-1 ring-destructive" : ""} />
                <FieldHint field="monthly_rent" errors={errors} />
              </div>
              <div className="space-y-2">
                <Label>Dia do Vencimento</Label>
                <Input type="number" min={1} max={31} value={form.payment_day} onChange={(e) => update("payment_day", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Fiança / Depósito (R$)</Label>
                <Input type="number" step="0.01" value={form.deposit_amount} onChange={(e) => update("deposit_amount", e.target.value)} />
              </div>
            </div>
          </div>

          <Separator />

          {/* Multas e Reajuste */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Multas e Reajuste
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Multa diária (%)</Label>
                <Input type="number" step="0.01" value={form.late_fee_percent} onChange={(e) => update("late_fee_percent", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Multa máx. (%)</Label>
                <Input type="number" step="0.01" value={form.late_fee_max_percent} onChange={(e) => update("late_fee_max_percent", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Índice de Reajuste</Label>
                <Select value={form.adjustment_index} onValueChange={(v) => update("adjustment_index", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IGPM">IGP-M</SelectItem>
                    <SelectItem value="IPCA">IPCA</SelectItem>
                    <SelectItem value="INPC">INPC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Multa rescisão (meses)</Label>
                <Input type="number" value={form.rescission_penalty_months} onChange={(e) => update("rescission_penalty_months", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Taxa de limpeza (R$)</Label>
                <Input type="number" step="0.01" value={form.cleaning_fee} onChange={(e) => update("cleaning_fee", e.target.value)} placeholder="Opcional" />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => update("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="awaiting_approval">Aguardando Aprovação</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="expired">Expirado</SelectItem>
                    <SelectItem value="terminated">Rescindido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Observações */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Anotações adicionais sobre o contrato..."
              rows={3}
            />
          </div>

          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Salvando..." : isEdit ? "Salvar Alterações" : prefill ? "Solicitar Contrato" : "Criar Contrato"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
