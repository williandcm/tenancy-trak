import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign, Download,
  Calendar, Building2, Users, AlertTriangle, CheckCircle2,
  Printer, FileSpreadsheet, PieChart, ArrowUpRight, ArrowDownRight,
  Percent, Receipt,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, Legend,
} from "recharts";
import { format, startOfMonth, endOfMonth, subMonths, isBefore, parse, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

/* ── Types ──────────────────────────────────────────── */
interface UtilityBill {
  id: string;
  billType: "electricity" | "water" | "iptu";
  referenceMonth: string;
  totalAmount: number;
  dueDate: string;
  shares: { unitId: string; unitName: string; amount: number; paid?: boolean }[];
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
const MONTHS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const money = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const Reports = () => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedUnit, setSelectedUnit] = useState("all");
  const [activeTab, setActiveTab] = useState("resumo");

  /* ── Queries ─────────────────────────────────── */
  const { data: units } = useQuery({
    queryKey: ["units"],
    queryFn: async () => {
      const { data, error } = await supabase.from("units").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: payments } = useQuery({
    queryKey: ["payments-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*, contracts(monthly_rent, units(id, name), tenants(full_name))")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: contracts } = useQuery({
    queryKey: ["contracts-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("*, units(id, name), tenants(full_name)")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const utilityBills: UtilityBill[] = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("locagest-utility-bills") || "[]");
    } catch { return []; }
  }, [activeTab]); // re-read when tab changes

  const year = parseInt(selectedYear);

  /* ── Derived data ─────────────────────────────── */

  // Monthly revenue data (rent)
  const monthlyRentData = useMemo(() => {
    if (!payments) return [];
    return Array.from({ length: 12 }, (_, i) => {
      const monthStr = `${year}-${String(i + 1).padStart(2, "0")}`;
      const monthPayments = payments.filter((p: any) => {
        const unitMatch = selectedUnit === "all" || p.contracts?.units?.id === selectedUnit;
        return p.due_date?.startsWith(monthStr) && unitMatch;
      });

      const esperado = monthPayments.reduce((s: number, p: any) => s + Number(p.amount), 0);
      const recebido = monthPayments
        .filter((p: any) => p.is_paid)
        .reduce((s: number, p: any) => s + Number(p.amount) + Number(p.late_fee || 0), 0);
      const atrasado = monthPayments
        .filter((p: any) => !p.is_paid && isBefore(new Date(p.due_date), new Date()))
        .reduce((s: number, p: any) => s + Number(p.amount), 0);

      return {
        month: MONTHS_PT[i],
        monthNum: i + 1,
        esperado,
        recebido,
        atrasado,
        pendente: Math.max(0, esperado - recebido - atrasado),
      };
    });
  }, [payments, year, selectedUnit]);

  // Monthly utility costs
  const monthlyUtilityData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const monthStr = `${year}-${String(i + 1).padStart(2, "0")}`;
      const monthBills = utilityBills.filter((b) => {
        if (!b.referenceMonth?.startsWith(monthStr)) return false;
        if (selectedUnit !== "all") {
          return b.shares?.some((s) => s.unitId === selectedUnit);
        }
        return true;
      });

      let energia = 0, agua = 0, iptu = 0;
      monthBills.forEach((b) => {
        const shares = selectedUnit !== "all"
          ? b.shares?.filter((s) => s.unitId === selectedUnit) ?? []
          : b.shares ?? [];
        const total = shares.reduce((s, sh) => s + sh.amount, 0);
        if (b.billType === "electricity") energia += total;
        else if (b.billType === "water") agua += total;
        else if (b.billType === "iptu") iptu += total;
      });

      return {
        month: MONTHS_PT[i],
        monthNum: i + 1,
        energia,
        agua,
        iptu,
        total: energia + agua + iptu,
      };
    });
  }, [utilityBills, year, selectedUnit]);

  // Per-unit summary
  const unitSummary = useMemo(() => {
    if (!units || !payments) return [];
    return units.map((u: any) => {
      const unitPayments = payments.filter((p: any) => p.contracts?.units?.id === u.id);
      const yearPayments = unitPayments.filter((p: any) => p.due_date?.startsWith(String(year)));

      const esperado = yearPayments.reduce((s: number, p: any) => s + Number(p.amount), 0);
      const recebido = yearPayments
        .filter((p: any) => p.is_paid)
        .reduce((s: number, p: any) => s + Number(p.amount) + Number(p.late_fee || 0), 0);
      const atrasado = yearPayments
        .filter((p: any) => !p.is_paid && isBefore(new Date(p.due_date), new Date()))
        .reduce((s: number, p: any) => s + Number(p.amount), 0);

      // Utility costs
      const unitBills = utilityBills.filter((b) =>
        b.referenceMonth?.startsWith(String(year)) &&
        b.shares?.some((s) => s.unitId === u.id)
      );
      let utilTotal = 0;
      unitBills.forEach((b) => {
        const sh = b.shares?.find((s) => s.unitId === u.id);
        if (sh) utilTotal += sh.amount;
      });

      const inadimplencia = esperado > 0 ? (atrasado / esperado) * 100 : 0;

      return {
        id: u.id,
        name: u.name,
        area: u.area_sqm,
        status: u.status,
        aluguel: Number(u.monthly_rent || 0),
        esperado,
        recebido,
        atrasado,
        utilidades: utilTotal,
        inadimplencia,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [units, payments, utilityBills, year]);

  // Grand totals
  const totals = useMemo(() => {
    const rentEsperado = monthlyRentData.reduce((s, m) => s + m.esperado, 0);
    const rentRecebido = monthlyRentData.reduce((s, m) => s + m.recebido, 0);
    const rentAtrasado = monthlyRentData.reduce((s, m) => s + m.atrasado, 0);
    const utilTotal = monthlyUtilityData.reduce((s, m) => s + m.total, 0);
    const utilEnergia = monthlyUtilityData.reduce((s, m) => s + m.energia, 0);
    const utilAgua = monthlyUtilityData.reduce((s, m) => s + m.agua, 0);
    const utilIptu = monthlyUtilityData.reduce((s, m) => s + m.iptu, 0);
    const inadimplencia = rentEsperado > 0 ? (rentAtrasado / rentEsperado) * 100 : 0;

    return {
      rentEsperado, rentRecebido, rentAtrasado, rentPendente: Math.max(0, rentEsperado - rentRecebido - rentAtrasado),
      utilTotal, utilEnergia, utilAgua, utilIptu,
      inadimplencia,
      totalGeral: rentRecebido + utilTotal,
    };
  }, [monthlyRentData, monthlyUtilityData]);

  // Combined chart data
  const combinedChartData = useMemo(() => {
    return monthlyRentData.map((r, i) => ({
      month: r.month,
      aluguel: r.recebido,
      consumos: monthlyUtilityData[i].total,
      total: r.recebido + monthlyUtilityData[i].total,
    }));
  }, [monthlyRentData, monthlyUtilityData]);

  // Pie data for revenue breakdown
  const revenuePie = useMemo(() => {
    const data = [
      { name: "Aluguéis", value: totals.rentRecebido, color: "#3b82f6" },
      { name: "Energia", value: totals.utilEnergia, color: "#f59e0b" },
      { name: "Água", value: totals.utilAgua, color: "#06b6d4" },
      { name: "IPTU", value: totals.utilIptu, color: "#8b5cf6" },
    ].filter((d) => d.value > 0);
    return data;
  }, [totals]);

  /* ── Export CSV ────────────────────────────── */
  const exportCSV = (data: Record<string, any>[], filename: string) => {
    if (data.length === 0) return;
    const keys = Object.keys(data[0]);
    const header = keys.join(";");
    const rows = data.map((r) =>
      keys.map((k) => {
        const v = r[k];
        if (typeof v === "number") return v.toFixed(2).replace(".", ",");
        return String(v ?? "");
      }).join(";")
    );
    const csv = "\uFEFF" + [header, ...rows].join("\n"); // BOM for Excel
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportResumoMensal = () => {
    const data = monthlyRentData.map((r, i) => ({
      Mês: `${r.month}/${selectedYear}`,
      "Aluguel Esperado": r.esperado,
      "Aluguel Recebido": r.recebido,
      "Aluguel Atrasado": r.atrasado,
      "Energia": monthlyUtilityData[i].energia,
      "Água": monthlyUtilityData[i].agua,
      "IPTU": monthlyUtilityData[i].iptu,
      "Total Consumos": monthlyUtilityData[i].total,
      "Receita Total": r.recebido + monthlyUtilityData[i].total,
    }));
    exportCSV(data, `relatorio-mensal-${selectedYear}`);
  };

  const exportPorUnidade = () => {
    const data = unitSummary.map((u) => ({
      Unidade: u.name,
      "Área (m²)": u.area,
      "Aluguel/Mês": u.aluguel,
      "Esperado Ano": u.esperado,
      "Recebido": u.recebido,
      "Atrasado": u.atrasado,
      "Consumos": u.utilidades,
      "Inadimplência (%)": u.inadimplencia,
    }));
    exportCSV(data, `relatorio-unidades-${selectedYear}`);
  };

  /* ── Print ─────────────────────────────────── */
  const printReport = () => {
    const w = window.open("", "_blank");
    if (!w) return;

    const tableRows = unitSummary.map((u) => `
      <tr>
        <td>${u.name}</td>
        <td style="text-align:right">${money(u.aluguel)}</td>
        <td style="text-align:right">${money(u.esperado)}</td>
        <td style="text-align:right">${money(u.recebido)}</td>
        <td style="text-align:right;color:${u.atrasado > 0 ? '#dc2626' : '#16a34a'}">${money(u.atrasado)}</td>
        <td style="text-align:right">${money(u.utilidades)}</td>
        <td style="text-align:right">${u.inadimplencia.toFixed(1)}%</td>
      </tr>
    `).join("");

    w.document.write(`<!DOCTYPE html><html><head><title>Relatório ${selectedYear}</title>
      <style>
        @page{margin:1.5cm;size:A4 landscape}
        body{font-family:'Segoe UI',sans-serif;font-size:10pt;color:#1a1a1a}
        h1{text-align:center;margin-bottom:4px;font-size:16pt}
        h2{margin-top:20px;font-size:12pt;border-bottom:1px solid #ccc;padding-bottom:4px}
        .subtitle{text-align:center;color:#666;margin-bottom:16px;font-size:10pt}
        table{width:100%;border-collapse:collapse;margin-top:8px}
        th,td{border:1px solid #ddd;padding:6px 8px;font-size:9pt}
        th{background:#f3f4f6;font-weight:600;text-align:left}
        .summary{display:flex;gap:16px;flex-wrap:wrap;margin:12px 0}
        .summary-card{border:1px solid #ddd;border-radius:6px;padding:10px 14px;min-width:160px}
        .summary-card .label{font-size:8pt;color:#888;text-transform:uppercase}
        .summary-card .value{font-size:14pt;font-weight:700;margin-top:2px}
        tfoot td{font-weight:700;background:#f9fafb}
      </style></head><body>
      <h1>LocaGest — Relatório Financeiro</h1>
      <p class="subtitle">Ano: ${selectedYear} | Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}</p>

      <div class="summary">
        <div class="summary-card"><div class="label">Aluguel Esperado</div><div class="value">${money(totals.rentEsperado)}</div></div>
        <div class="summary-card"><div class="label">Aluguel Recebido</div><div class="value" style="color:#16a34a">${money(totals.rentRecebido)}</div></div>
        <div class="summary-card"><div class="label">Aluguel Atrasado</div><div class="value" style="color:#dc2626">${money(totals.rentAtrasado)}</div></div>
        <div class="summary-card"><div class="label">Consumos Cobrados</div><div class="value">${money(totals.utilTotal)}</div></div>
        <div class="summary-card"><div class="label">Inadimplência</div><div class="value">${totals.inadimplencia.toFixed(1)}%</div></div>
      </div>

      <h2>Resumo por Unidade</h2>
      <table>
        <thead><tr><th>Unidade</th><th>Aluguel/Mês</th><th>Esperado Ano</th><th>Recebido</th><th>Atrasado</th><th>Consumos</th><th>Inadimplência</th></tr></thead>
        <tbody>${tableRows}</tbody>
        <tfoot><tr>
          <td>TOTAL</td>
          <td style="text-align:right">${money(unitSummary.reduce((s, u) => s + u.aluguel, 0))}</td>
          <td style="text-align:right">${money(totals.rentEsperado)}</td>
          <td style="text-align:right">${money(totals.rentRecebido)}</td>
          <td style="text-align:right">${money(totals.rentAtrasado)}</td>
          <td style="text-align:right">${money(totals.utilTotal)}</td>
          <td style="text-align:right">${totals.inadimplencia.toFixed(1)}%</td>
        </tr></tfoot>
      </table>

      <h2>Receita Mensal</h2>
      <table>
        <thead><tr><th>Mês</th><th>Aluguel Esperado</th><th>Recebido</th><th>Atrasado</th><th>Energia</th><th>Água</th><th>IPTU</th><th>Total Consumos</th></tr></thead>
        <tbody>${monthlyRentData.map((r, i) => `
          <tr>
            <td>${r.month}/${selectedYear}</td>
            <td style="text-align:right">${money(r.esperado)}</td>
            <td style="text-align:right">${money(r.recebido)}</td>
            <td style="text-align:right;color:${r.atrasado > 0 ? '#dc2626' : 'inherit'}">${money(r.atrasado)}</td>
            <td style="text-align:right">${money(monthlyUtilityData[i].energia)}</td>
            <td style="text-align:right">${money(monthlyUtilityData[i].agua)}</td>
            <td style="text-align:right">${money(monthlyUtilityData[i].iptu)}</td>
            <td style="text-align:right">${money(monthlyUtilityData[i].total)}</td>
          </tr>
        `).join("")}</tbody>
      </table>

      <script>window.print()</script></body></html>`);
    w.document.close();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-primary" /> Relatórios Financeiros
          </h1>
          <p className="mt-1 text-muted-foreground">Análise consolidada de receitas e despesas</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedUnit} onValueChange={setSelectedUnit}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Todas unidades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Unidades</SelectItem>
              {units?.map((u: any) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={printReport}>
            <Printer className="mr-2 h-4 w-4" /> Imprimir
          </Button>
          <Button variant="outline" size="sm" onClick={exportResumoMensal}>
            <Download className="mr-2 h-4 w-4" /> CSV Mensal
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="glass-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 dark:bg-blue-900/30 p-2.5">
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Aluguel Esperado</p>
              <p className="text-lg font-bold">{money(totals.rentEsperado)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-green-100 dark:bg-green-900/30 p-2.5">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Recebido</p>
              <p className="text-lg font-bold text-green-600">{money(totals.rentRecebido)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-red-100 dark:bg-red-900/30 p-2.5">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Atrasado</p>
              <p className="text-lg font-bold text-red-600">{money(totals.rentAtrasado)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-amber-100 dark:bg-amber-900/30 p-2.5">
              <Receipt className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Consumos</p>
              <p className="text-lg font-bold text-amber-600">{money(totals.utilTotal)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 dark:bg-purple-900/30 p-2.5">
              <Percent className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Inadimplência</p>
              <p className={`text-lg font-bold ${totals.inadimplencia > 10 ? "text-red-600" : totals.inadimplencia > 0 ? "text-amber-600" : "text-green-600"}`}>
                {totals.inadimplencia.toFixed(1)}%
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="resumo">📊 Resumo Anual</TabsTrigger>
          <TabsTrigger value="unidades">🏢 Por Unidade</TabsTrigger>
          <TabsTrigger value="mensal">📅 Detalhamento Mensal</TabsTrigger>
        </TabsList>

        {/* TAB: Resumo Anual */}
        <TabsContent value="resumo" className="space-y-6 mt-4">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Revenue Evolution Chart */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" /> Receita Mensal
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={combinedChartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="month" fontSize={12} />
                    <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(v: number) => money(v)}
                      labelStyle={{ fontWeight: "bold" }}
                    />
                    <Area type="monotone" dataKey="aluguel" name="Aluguéis" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} stackId="1" />
                    <Area type="monotone" dataKey="consumos" name="Consumos" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} stackId="1" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Revenue Breakdown Pie */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-secondary" /> Composição da Receita
                </CardTitle>
              </CardHeader>
              <CardContent>
                {revenuePie.length === 0 ? (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    Sem dados para o período
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <RePieChart>
                      <Pie
                        data={revenuePie}
                        cx="50%" cy="50%"
                        innerRadius={60} outerRadius={100}
                        paddingAngle={4}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {revenuePie.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => money(v)} />
                      <Legend />
                    </RePieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Utilities Bar Chart */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-amber-600" /> Consumos Mensais
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyUtilityData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => money(v)} />
                  <Legend />
                  <Bar dataKey="energia" name="Energia" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="agua" name="Água" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="iptu" name="IPTU" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Inadimplência Evolution */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" /> Evolução da Inadimplência
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={monthlyRentData.map((r) => ({
                  month: r.month,
                  taxa: r.esperado > 0 ? (r.atrasado / r.esperado) * 100 : 0,
                  valor: r.atrasado,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                  <Tooltip
                    formatter={(v: number, name: string) =>
                      name === "taxa" ? `${v.toFixed(1)}%` : money(v)
                    }
                  />
                  <Area type="monotone" dataKey="taxa" name="Taxa" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: Por Unidade */}
        <TabsContent value="unidades" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={exportPorUnidade}>
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Exportar CSV
            </Button>
          </div>

          <Card className="glass-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Área</TableHead>
                    <TableHead>Aluguel/Mês</TableHead>
                    <TableHead>Esperado ({selectedYear})</TableHead>
                    <TableHead>Recebido</TableHead>
                    <TableHead>Atrasado</TableHead>
                    <TableHead>Consumos</TableHead>
                    <TableHead>Inadimplência</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unitSummary.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        Nenhuma unidade cadastrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    unitSummary.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            {u.name}
                          </div>
                        </TableCell>
                        <TableCell>{u.area}m²</TableCell>
                        <TableCell>{money(u.aluguel)}</TableCell>
                        <TableCell>{money(u.esperado)}</TableCell>
                        <TableCell className="text-green-600 font-medium">{money(u.recebido)}</TableCell>
                        <TableCell className={u.atrasado > 0 ? "text-red-600 font-medium" : ""}>
                          {money(u.atrasado)}
                        </TableCell>
                        <TableCell>{money(u.utilidades)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={u.inadimplencia > 10 ? "destructive" : u.inadimplencia > 0 ? "secondary" : "default"}
                            className={u.inadimplencia === 0 ? "bg-green-500 text-white" : ""}
                          >
                            {u.inadimplencia.toFixed(1)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {unitSummary.length > 0 && (
                  <tfoot>
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell>TOTAL</TableCell>
                      <TableCell>{unitSummary.reduce((s, u) => s + u.area, 0)}m²</TableCell>
                      <TableCell>{money(unitSummary.reduce((s, u) => s + u.aluguel, 0))}</TableCell>
                      <TableCell>{money(totals.rentEsperado)}</TableCell>
                      <TableCell className="text-green-600">{money(totals.rentRecebido)}</TableCell>
                      <TableCell className={totals.rentAtrasado > 0 ? "text-red-600" : ""}>{money(totals.rentAtrasado)}</TableCell>
                      <TableCell>{money(totals.utilTotal)}</TableCell>
                      <TableCell>
                        <Badge variant={totals.inadimplencia > 10 ? "destructive" : "secondary"}>
                          {totals.inadimplencia.toFixed(1)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  </tfoot>
                )}
              </Table>
            </CardContent>
          </Card>

          {/* Per-unit bar chart */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg">Comparativo por Unidade</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={unitSummary}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => money(v)} />
                  <Legend />
                  <Bar dataKey="recebido" name="Recebido" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="atrasado" name="Atrasado" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="utilidades" name="Consumos" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: Detalhamento Mensal */}
        <TabsContent value="mensal" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={exportResumoMensal}>
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Exportar CSV
            </Button>
          </div>

          <Card className="glass-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead>Aluguel Esperado</TableHead>
                    <TableHead>Recebido</TableHead>
                    <TableHead>Atrasado</TableHead>
                    <TableHead>Pendente</TableHead>
                    <TableHead>Energia</TableHead>
                    <TableHead>Água</TableHead>
                    <TableHead>IPTU</TableHead>
                    <TableHead>Total Consumos</TableHead>
                    <TableHead>Receita Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyRentData.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r.month}/{selectedYear}</TableCell>
                      <TableCell>{money(r.esperado)}</TableCell>
                      <TableCell className="text-green-600 font-medium">{money(r.recebido)}</TableCell>
                      <TableCell className={r.atrasado > 0 ? "text-red-600 font-medium" : ""}>
                        {money(r.atrasado)}
                      </TableCell>
                      <TableCell className="text-amber-600">{money(r.pendente)}</TableCell>
                      <TableCell>{money(monthlyUtilityData[i].energia)}</TableCell>
                      <TableCell>{money(monthlyUtilityData[i].agua)}</TableCell>
                      <TableCell>{money(monthlyUtilityData[i].iptu)}</TableCell>
                      <TableCell className="font-medium">{money(monthlyUtilityData[i].total)}</TableCell>
                      <TableCell className="font-bold">{money(r.recebido + monthlyUtilityData[i].total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <tfoot>
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>TOTAL</TableCell>
                    <TableCell>{money(totals.rentEsperado)}</TableCell>
                    <TableCell className="text-green-600">{money(totals.rentRecebido)}</TableCell>
                    <TableCell className={totals.rentAtrasado > 0 ? "text-red-600" : ""}>{money(totals.rentAtrasado)}</TableCell>
                    <TableCell className="text-amber-600">{money(totals.rentPendente)}</TableCell>
                    <TableCell>{money(totals.utilEnergia)}</TableCell>
                    <TableCell>{money(totals.utilAgua)}</TableCell>
                    <TableCell>{money(totals.utilIptu)}</TableCell>
                    <TableCell className="font-bold">{money(totals.utilTotal)}</TableCell>
                    <TableCell className="font-bold">{money(totals.rentRecebido + totals.utilTotal)}</TableCell>
                  </TableRow>
                </tfoot>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;
