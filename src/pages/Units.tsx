import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  DoorOpen, Plus, MoreHorizontal, Pencil, Trash2, MapPin, Zap,
  Droplets, Building2, Search, User, CalendarDays, AlertTriangle,
  CheckCircle2, Clock, TrendingUp, Receipt, Eye, ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { format, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";

type Unit = Tables<"units">;

const statusMap = {
  available: { label: "Disponível", variant: "default" as const, color: "bg-emerald-500", icon: CheckCircle2 },
  occupied: { label: "Ocupado", variant: "secondary" as const, color: "bg-blue-500", icon: User },
  maintenance: { label: "Manutenção", variant: "destructive" as const, color: "bg-orange-500", icon: AlertTriangle },
};

const emptyForm = {
  name: "", identifier: "", address_number: "", area_sqm: "",
  floor: "", description: "", status: "available",
  electricity_connection: "", water_connection: "", monthly_rent: "",
};

const R$ = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const Units = () => {
  const { hasPermission } = useAuth();
  const isAdmin = hasPermission("admin");

  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailUnit, setDetailUnit] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [form, setForm] = useState(emptyForm);

  const today = new Date();

  // ── Queries ──────────────────────────────────────────────
  const { data: units, isLoading } = useQuery({
    queryKey: ["units"],
    queryFn: async () => {
      const { data, error } = await supabase.from("units").select("*").order("address_number").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: contracts } = useQuery({
    queryKey: ["contracts-for-units"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("id, unit_id, tenant_id, status, monthly_rent, payment_day, start_date, end_date, tenants(full_name, phone, email)")
        .eq("status", "active");
      if (error) throw error;
      return data;
    },
  });

  const { data: payments } = useQuery({
    queryKey: ["payments-for-units"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, contract_id, amount, due_date, is_paid, paid_date, late_fee")
        .order("due_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: utilityReadings } = useQuery({
    queryKey: ["utility-readings-for-units"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("utility_readings")
        .select("*")
        .order("reading_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // ── Derived data per unit ────────────────────────────────
  const unitData = useMemo(() => {
    if (!units) return {};
    const map: Record<string, {
      contract: any | null;
      tenantName: string | null;
      tenantPhone: string | null;
      paymentDay: number | null;
      monthlyRent: number;
      nextPayment: any | null;
      lastPayment: any | null;
      overduePayments: any[];
      totalOverdue: number;
      electricityLast: number | null;
      electricityConsumption: number | null;
      electricityTotal: number | null;
      electricityShareCount: number;
      waterLast: number | null;
      waterConsumption: number | null;
      waterTotal: number | null;
      waterShareCount: number;
    }> = {};

    for (const unit of units) {
      const contract = contracts?.find((c) => c.unit_id === unit.id) ?? null;
      const contractIds = contracts?.filter((c) => c.unit_id === unit.id).map((c) => c.id) ?? [];
      const unitPayments = payments?.filter((p) => contractIds.includes(p.contract_id)) ?? [];

      const overduePayments = unitPayments.filter((p) => !p.is_paid && isBefore(new Date(p.due_date + "T12:00:00"), today));
      const pendingPayments = unitPayments.filter((p) => !p.is_paid);
      const nextPayment = pendingPayments.sort((a, b) => a.due_date.localeCompare(b.due_date))[0] ?? null;
      const paidPayments = unitPayments.filter((p) => p.is_paid);
      const lastPayment = paidPayments.sort((a, b) => b.due_date.localeCompare(a.due_date))[0] ?? null;
      const totalOverdue = overduePayments.reduce((s, p) => s + Number(p.amount), 0);

      // Utility readings — last 2 to compute consumption, split by shared units
      const getConsumption = (connId: string | null, type: string) => {
        if (!connId || !utilityReadings) return { last: null, consumption: null, totalConsumption: null, shareCount: 1 };
        // Count how many units share this same connection
        const shareCount = units.filter((u) => {
          if (type === "electricity") return u.electricity_connection === connId;
          return u.water_connection === connId;
        }).length || 1;
        const readings = utilityReadings
          .filter((r) => r.connection_identifier === connId && r.connection_type === type)
          .sort((a, b) => b.reading_date.localeCompare(a.reading_date));
        const last = readings[0]?.reading_value ?? null;
        const prev = readings[1]?.reading_value ?? null;
        const totalConsumption = last !== null && prev !== null ? Math.max(0, Number(last) - Number(prev)) : null;
        const consumption = totalConsumption !== null ? Math.round((totalConsumption / shareCount) * 100) / 100 : null;
        return { last, consumption, totalConsumption, shareCount };
      };

      const elec = getConsumption(unit.electricity_connection, "electricity");
      const water = getConsumption(unit.water_connection, "water");

      map[unit.id] = {
        contract,
        tenantName: contract ? (contract as any).tenants?.full_name ?? null : null,
        tenantPhone: contract ? (contract as any).tenants?.phone ?? null : null,
        paymentDay: contract?.payment_day ?? null,
        monthlyRent: contract ? Number(contract.monthly_rent) : (unit.monthly_rent ? Number(unit.monthly_rent) : 0),
        nextPayment,
        lastPayment,
        overduePayments,
        totalOverdue,
        electricityLast: elec.last,
        electricityConsumption: elec.consumption,
        electricityTotal: elec.totalConsumption,
        electricityShareCount: elec.shareCount,
        waterLast: water.last,
        waterConsumption: water.consumption,
        waterTotal: water.totalConsumption,
        waterShareCount: water.shareCount,
      };
    }
    return map;
  }, [units, contracts, payments, utilityReadings, today]);

  // ── Mutations ────────────────────────────────────────────
  const saveUnit = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        identifier: form.identifier,
        address_number: form.address_number,
        area_sqm: parseFloat(form.area_sqm),
        floor: form.floor || null,
        description: form.description || null,
        status: form.status as Unit["status"],
        electricity_connection: form.electricity_connection || null,
        water_connection: form.water_connection || null,
        monthly_rent: form.monthly_rent ? parseFloat(form.monthly_rent) : null,
      };
      if (editId) {
        const { error } = await supabase.from("units").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("units").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units"] });
      setDialogOpen(false);
      resetForm();
      toast.success(editId ? "Unidade atualizada!" : "Unidade criada!");
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });

  const deleteUnit = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("units").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units"] });
      toast.success("Unidade removida!");
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });

  const resetForm = () => { setEditId(null); setForm(emptyForm); };
  const handleNew = () => { resetForm(); setDialogOpen(true); };
  const handleEdit = (unit: Unit) => {
    if (!isAdmin) {
      toast.error("Apenas administradores podem editar unidades.");
      return;
    }
    setEditId(unit.id);
    setForm({
      name: unit.name, identifier: unit.identifier, address_number: unit.address_number,
      area_sqm: String(unit.area_sqm), floor: unit.floor || "", description: unit.description || "",
      status: unit.status, electricity_connection: unit.electricity_connection || "",
      water_connection: unit.water_connection || "", monthly_rent: unit.monthly_rent ? String(unit.monthly_rent) : "",
    });
    setDialogOpen(true);
  };
  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const filtered = units?.filter((u) => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.address_number.includes(search) ||
      u.identifier.toLowerCase().includes(search.toLowerCase()) ||
      (unitData[u.id]?.tenantName?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchStatus = statusFilter === "all" || u.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalUnits = units?.length ?? 0;
  const occupiedCount = units?.filter((u) => u.status === "occupied").length ?? 0;
  const availableCount = units?.filter((u) => u.status === "available").length ?? 0;
  const maintenanceCount = units?.filter((u) => u.status === "maintenance").length ?? 0;
  const unitsWithOverdue = Object.values(unitData).filter((d) => d.overduePayments.length > 0).length;

  // Detail dialog unit
  const detailUnitObj = detailUnit ? units?.find((u) => u.id === detailUnit) : null;
  const detailData = detailUnit ? unitData[detailUnit] : null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Unidades</h1>
          <p className="mt-1 text-muted-foreground">
            Visão completa das {totalUnits} unidades — inquilinos, pagamentos e consumos
          </p>
        </div>
        <Button onClick={handleNew}><Plus className="mr-2 h-4 w-4" /> Nova Unidade</Button>
      </div>

      {!isAdmin && (
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <ShieldAlert className="h-4 w-4 flex-shrink-0" />
          <span>
            Você pode visualizar e cadastrar unidades. Para editar ou excluir,
            solicite a um administrador.
          </span>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-card cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter(statusFilter === "occupied" ? "all" : "occupied")}>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <User className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{occupiedCount}</p>
              <p className="text-xs text-muted-foreground">Ocupadas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter(statusFilter === "available" ? "all" : "available")}>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{availableCount}</p>
              <p className="text-xs text-muted-foreground">Disponíveis</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter(statusFilter === "maintenance" ? "all" : "maintenance")}>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-900/30">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{maintenanceCount}</p>
              <p className="text-xs text-muted-foreground">Manutenção</p>
            </div>
          </CardContent>
        </Card>
        <Card className={`glass-card ${unitsWithOverdue > 0 ? "border-red-500/50" : ""}`}>
          <CardContent className="flex items-center gap-4 p-4">
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${unitsWithOverdue > 0 ? "bg-red-100 dark:bg-red-900/30" : "bg-gray-100 dark:bg-gray-900/30"}`}>
              <Receipt className={`h-5 w-5 ${unitsWithOverdue > 0 ? "text-red-600" : "text-gray-500"}`} />
            </div>
            <div>
              <p className="text-2xl font-bold">{unitsWithOverdue}</p>
              <p className="text-xs text-muted-foreground">Com Atraso</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[250px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar unidade ou inquilino..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1 border rounded-lg p-1">
          {[
            { key: "all", label: "Todas" },
            { key: "occupied", label: "Ocupadas" },
            { key: "available", label: "Livres" },
            { key: "maintenance", label: "Manut." },
          ].map((f) => (
            <Button key={f.key} variant={statusFilter === f.key ? "default" : "ghost"} size="sm" onClick={() => setStatusFilter(f.key)}>
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Unit Cards */}
      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : filtered?.length === 0 ? (
        <Card className="glass-card"><CardContent className="py-12 text-center"><p className="text-muted-foreground">Nenhuma unidade encontrada</p></CardContent></Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered?.map((unit) => {
            const data = unitData[unit.id];
            const hasOverdue = data?.overduePayments.length > 0;
            const StatusIcon = statusMap[unit.status].icon;

            return (
              <Card
                key={unit.id}
                className={`glass-card group transition-all hover:shadow-lg cursor-pointer ${hasOverdue ? "ring-2 ring-red-500/30" : ""}`}
                onClick={() => setDetailUnit(unit.id)}
              >
                <CardContent className="p-0">
                  {/* Top bar with status color */}
                  <div className={`h-1.5 rounded-t-xl ${statusMap[unit.status].color}`} />

                  <div className="p-5 space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${
                          unit.status === "occupied" ? "bg-blue-100 dark:bg-blue-900/30" :
                          unit.status === "available" ? "bg-emerald-100 dark:bg-emerald-900/30" :
                          "bg-orange-100 dark:bg-orange-900/30"
                        }`}>
                          <StatusIcon className={`h-5 w-5 ${
                            unit.status === "occupied" ? "text-blue-600" :
                            unit.status === "available" ? "text-emerald-600" :
                            "text-orange-600"
                          }`} />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-foreground leading-tight">{unit.name}</h3>
                          <p className="text-xs text-muted-foreground">Nº {unit.address_number} · {unit.floor || "—"} · {unit.area_sqm}m²</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant={statusMap[unit.status].variant}>{statusMap[unit.status].label}</Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setDetailUnit(unit.id); }}><Eye className="mr-2 h-4 w-4" /> Detalhes</DropdownMenuItem>
                            {isAdmin && (
                              <>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(unit); }}><Pencil className="mr-2 h-4 w-4" /> Editar</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); if (confirm("Excluir esta unidade?")) deleteUnit.mutate(unit.id); }}>
                                  <Trash2 className="mr-2 h-4 w-4" /> Excluir
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Tenant Info (if occupied) */}
                    {data?.tenantName ? (
                      <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-blue-600" />
                          <span className="font-semibold text-sm text-blue-900 dark:text-blue-100">{data.tenantName}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-blue-700 dark:text-blue-300">
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            Dia {data.paymentDay} · {R$(data.monthlyRent)}/mês
                          </span>
                        </div>
                      </div>
                    ) : unit.status === "available" ? (
                      <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-3 text-center">
                        <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">Disponível para locação</span>
                      </div>
                    ) : unit.status === "maintenance" ? (
                      <div className="rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 p-3 text-center">
                        <span className="text-xs text-orange-700 dark:text-orange-300 font-medium">Em manutenção</span>
                      </div>
                    ) : null}

                    {/* Payment status */}
                    {data?.tenantName && (
                      <div className="space-y-1.5">
                        {hasOverdue ? (
                          <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-2.5">
                            <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-red-700 dark:text-red-300">
                                {data.overduePayments.length} pagamento{data.overduePayments.length > 1 ? "s" : ""} em atraso
                              </p>
                              <p className="text-xs text-red-600 dark:text-red-400">Total: {R$(data.totalOverdue)}</p>
                            </div>
                          </div>
                        ) : data.nextPayment ? (
                          <div className="flex items-center gap-2 rounded-lg bg-muted p-2.5">
                            <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <div className="text-xs text-muted-foreground">
                              Próx. vencimento: <span className="font-medium text-foreground">{format(new Date(data.nextPayment.due_date + "T12:00:00"), "dd/MM/yyyy")}</span> · {R$(Number(data.nextPayment.amount))}
                            </div>
                          </div>
                        ) : data.lastPayment ? (
                          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-2.5">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                            <div className="text-xs text-emerald-700 dark:text-emerald-300">
                              Último pgto: {format(new Date(data.lastPayment.paid_date + "T12:00:00"), "dd/MM/yyyy")} · {R$(Number(data.lastPayment.amount))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* Utility & Rent footer */}
                    <Separator />
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="rounded-lg bg-muted/50 p-2">
                            <Zap className="h-3.5 w-3.5 mx-auto text-yellow-600 mb-0.5" />
                            <p className="text-[10px] text-muted-foreground">Energia{(data?.electricityShareCount ?? 1) > 1 ? " (÷" + data?.electricityShareCount + ")" : ""}</p>
                            <p className="text-xs font-semibold">
                              {data?.electricityConsumption !== null ? data?.electricityConsumption?.toLocaleString("pt-BR") : "—"}
                            </p>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {data?.electricityLast !== null
                            ? (data?.electricityShareCount ?? 1) > 1
                              ? `Total: ${data?.electricityTotal?.toLocaleString("pt-BR")} ÷ ${data?.electricityShareCount} salas = ${data?.electricityConsumption?.toLocaleString("pt-BR")} por sala`
                              : `Última leitura: ${Number(data?.electricityLast).toLocaleString("pt-BR")} · Consumo: ${data?.electricityConsumption?.toLocaleString("pt-BR") ?? "—"}`
                            : "Sem leituras registradas"}
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="rounded-lg bg-muted/50 p-2">
                            <Droplets className="h-3.5 w-3.5 mx-auto text-blue-500 mb-0.5" />
                            <p className="text-[10px] text-muted-foreground">Água{(data?.waterShareCount ?? 1) > 1 ? " (÷" + data?.waterShareCount + ")" : ""}</p>
                            <p className="text-xs font-semibold">
                              {data?.waterConsumption !== null ? data?.waterConsumption?.toLocaleString("pt-BR") : "—"}
                            </p>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {data?.waterLast !== null
                            ? (data?.waterShareCount ?? 1) > 1
                              ? `Total: ${data?.waterTotal?.toLocaleString("pt-BR")} ÷ ${data?.waterShareCount} salas = ${data?.waterConsumption?.toLocaleString("pt-BR")} por sala`
                              : `Última leitura: ${Number(data?.waterLast).toLocaleString("pt-BR")} · Consumo: ${data?.waterConsumption?.toLocaleString("pt-BR") ?? "—"}`
                            : "Sem leituras registradas"}
                        </TooltipContent>
                      </Tooltip>
                      <div className="rounded-lg bg-muted/50 p-2">
                        <TrendingUp className="h-3.5 w-3.5 mx-auto text-primary mb-0.5" />
                        <p className="text-[10px] text-muted-foreground">Aluguel</p>
                        <p className="text-xs font-semibold">{data?.monthlyRent ? R$(data.monthlyRent) : "—"}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Detail Dialog ─────────────────────────────────── */}
      <Dialog open={!!detailUnit} onOpenChange={(open) => { if (!open) setDetailUnit(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {detailUnitObj && detailData && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${statusMap[detailUnitObj.status].color}`}>
                    <Building2 className="h-4 w-4 text-white" />
                  </div>
                  {detailUnitObj.name}
                  <Badge variant={statusMap[detailUnitObj.status].variant} className="ml-auto">{statusMap[detailUnitObj.status].label}</Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-5">
                {/* Unit info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Nº Endereço:</span> <span className="font-medium">{detailUnitObj.address_number}</span></div>
                  <div><span className="text-muted-foreground">Andar:</span> <span className="font-medium">{detailUnitObj.floor || "—"}</span></div>
                  <div><span className="text-muted-foreground">Área:</span> <span className="font-medium">{detailUnitObj.area_sqm}m²</span></div>
                  <div><span className="text-muted-foreground">Identificador:</span> <span className="font-medium">{detailUnitObj.identifier}</span></div>
                  {detailUnitObj.description && (
                    <div className="col-span-2"><span className="text-muted-foreground">Descrição:</span> <span className="font-medium">{detailUnitObj.description}</span></div>
                  )}
                </div>

                <Separator />

                {/* Tenant */}
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><User className="h-4 w-4" /> Inquilino</h4>
                  {detailData.tenantName ? (
                    <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 space-y-1">
                      <p className="font-semibold text-blue-900 dark:text-blue-100">{detailData.tenantName}</p>
                      {detailData.tenantPhone && <p className="text-xs text-blue-700 dark:text-blue-300">Tel: {detailData.tenantPhone}</p>}
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        Contrato: {format(new Date(detailData.contract.start_date + "T12:00:00"), "dd/MM/yyyy")} até {format(new Date(detailData.contract.end_date + "T12:00:00"), "dd/MM/yyyy")}
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        Dia de pagamento: <span className="font-bold">{detailData.paymentDay}</span> · Aluguel: <span className="font-bold">{R$(detailData.monthlyRent)}</span>
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum inquilino vinculado</p>
                  )}
                </div>

                <Separator />

                {/* Payment status */}
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><Receipt className="h-4 w-4" /> Pagamentos</h4>
                  {detailData.overduePayments.length > 0 ? (
                    <div className="space-y-2">
                      <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
                        <p className="text-sm font-semibold text-red-700 dark:text-red-300 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          {detailData.overduePayments.length} pagamento{detailData.overduePayments.length > 1 ? "s" : ""} em atraso — Total: {R$(detailData.totalOverdue)}
                        </p>
                      </div>
                      {detailData.overduePayments.map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between text-sm rounded-lg border border-red-200 dark:border-red-800 p-2.5">
                          <div>
                            <p className="text-red-600 font-medium">Vencimento: {format(new Date(p.due_date + "T12:00:00"), "dd/MM/yyyy")}</p>
                          </div>
                          <Badge variant="destructive">{R$(Number(p.amount))}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : detailData.nextPayment ? (
                    <div className="rounded-lg bg-muted p-3 text-sm">
                      <p><span className="text-muted-foreground">Próximo vencimento:</span> <span className="font-medium">{format(new Date(detailData.nextPayment.due_date + "T12:00:00"), "dd/MM/yyyy")}</span></p>
                      <p><span className="text-muted-foreground">Valor:</span> <span className="font-medium">{R$(Number(detailData.nextPayment.amount))}</span></p>
                    </div>
                  ) : detailData.lastPayment ? (
                    <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-3 text-sm flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>Todos os pagamentos em dia. Último: {format(new Date(detailData.lastPayment.paid_date + "T12:00:00"), "dd/MM/yyyy")}</span>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum pagamento registrado</p>
                  )}
                </div>

                <Separator />

                {/* Utilities */}
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><Zap className="h-4 w-4" /> Consumos</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border p-3 text-center">
                      <Zap className="h-5 w-5 mx-auto text-yellow-600 mb-1" />
                      <p className="text-xs text-muted-foreground">Energia ({detailUnitObj.electricity_connection || "—"})</p>
                      <p className="text-lg font-bold">{detailData.electricityConsumption !== null ? detailData.electricityConsumption.toLocaleString("pt-BR") : "—"}</p>
                      {(detailData.electricityShareCount ?? 1) > 1 ? (
                        <p className="text-[10px] text-muted-foreground">
                          Total: {detailData.electricityTotal?.toLocaleString("pt-BR")} ÷ {detailData.electricityShareCount} salas
                        </p>
                      ) : (
                        <p className="text-[10px] text-muted-foreground">Último consumo (kWh)</p>
                      )}
                    </div>
                    <div className="rounded-lg border p-3 text-center">
                      <Droplets className="h-5 w-5 mx-auto text-blue-500 mb-1" />
                      <p className="text-xs text-muted-foreground">Água ({detailUnitObj.water_connection || "—"})</p>
                      <p className="text-lg font-bold">{detailData.waterConsumption !== null ? detailData.waterConsumption.toLocaleString("pt-BR") : "—"}</p>
                      {(detailData.waterShareCount ?? 1) > 1 ? (
                        <p className="text-[10px] text-muted-foreground">
                          Total: {detailData.waterTotal?.toLocaleString("pt-BR")} ÷ {detailData.waterShareCount} salas
                        </p>
                      ) : (
                        <p className="text-[10px] text-muted-foreground">Último consumo (m³)</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  {isAdmin && (
                    <Button variant="outline" className="flex-1" onClick={() => { setDetailUnit(null); handleEdit(detailUnitObj); }}>
                      <Pencil className="mr-2 h-4 w-4" /> Editar Unidade
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Create/Edit Dialog ────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Unidade" : "Nova Unidade"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveUnit.mutate(); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input value={form.name} onChange={(e) => update("name", e.target.value)} required placeholder="Sala 1" />
              </div>
              <div className="space-y-2">
                <Label>Identificador *</Label>
                <Input value={form.identifier} onChange={(e) => update("identifier", e.target.value)} required placeholder="sala-1" />
              </div>
              <div className="space-y-2">
                <Label>Nº Endereço *</Label>
                <Input value={form.address_number} onChange={(e) => update("address_number", e.target.value)} required placeholder="422A" />
              </div>
              <div className="space-y-2">
                <Label>Área (m²) *</Label>
                <Input type="number" step="0.01" value={form.area_sqm} onChange={(e) => update("area_sqm", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Andar</Label>
                <Input value={form.floor} onChange={(e) => update("floor", e.target.value)} placeholder="Superior / Térreo" />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => update("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Disponível</SelectItem>
                    <SelectItem value="occupied">Ocupado</SelectItem>
                    <SelectItem value="maintenance">Manutenção</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ligação Energia</Label>
                <Input value={form.electricity_connection} onChange={(e) => update("electricity_connection", e.target.value)} placeholder="422A" />
              </div>
              <div className="space-y-2">
                <Label>Ligação Água</Label>
                <Input value={form.water_connection} onChange={(e) => update("water_connection", e.target.value)} placeholder="422A" />
              </div>
              <div className="space-y-2">
                <Label>Aluguel Mensal (R$)</Label>
                <Input type="number" step="0.01" value={form.monthly_rent} onChange={(e) => update("monthly_rent", e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => update("description", e.target.value)} rows={2} />
            </div>
            <Button type="submit" className="w-full" disabled={saveUnit.isPending}>
              {saveUnit.isPending ? "Salvando..." : editId ? "Salvar Alterações" : "Criar Unidade"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Units;
