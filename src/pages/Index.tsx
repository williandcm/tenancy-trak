import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2, DoorOpen, Users, FileText, TrendingUp,
  Droplets, Zap, MapPin,
} from "lucide-react";
import PropertyMap from "@/components/PropertyMap";

const statusMap = {
  available: { label: "Disponível", variant: "default" as const },
  occupied: { label: "Ocupado", variant: "secondary" as const },
  maintenance: { label: "Manutenção", variant: "destructive" as const },
};

const Dashboard = () => {
  const { data: units } = useQuery({
    queryKey: ["units"],
    queryFn: async () => {
      const { data, error } = await supabase.from("units").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: contracts } = useQuery({
    queryKey: ["contracts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contracts").select("*").eq("status", "active");
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

  const totalUnits = units?.length ?? 0;
  const occupiedUnits = units?.filter((u) => u.status === "occupied").length ?? 0;
  const totalArea = units?.reduce((sum, u) => sum + Number(u.area_sqm), 0) ?? 0;
  const activeContracts = contracts?.length ?? 0;
  const monthlyRevenue = contracts?.reduce((sum, c) => sum + Number(c.monthly_rent), 0) ?? 0;

  const stats = [
    { label: "Unidades", value: totalUnits, icon: DoorOpen, color: "text-info" },
    { label: "Ocupadas", value: occupiedUnits, icon: Building2, color: "text-success" },
    { label: "Área Total", value: `${totalArea}m²`, icon: MapPin, color: "text-secondary" },
    { label: "Contratos Ativos", value: activeContracts, icon: FileText, color: "text-warning" },
    { label: "Receita Mensal", value: `R$ ${monthlyRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: TrendingUp, color: "text-success" },
    { label: "Inquilinos", value: tenants?.length ?? 0, icon: Users, color: "text-info" },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Rua Orlando Pavan, 422 – Jardim Rosolém, Hortolândia/SP
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((stat) => (
          <Card key={stat.label} className="glass-card animate-slide-up">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Property Map */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-xl">
            <MapPin className="h-5 w-5 text-secondary" />
            Mapa do Imóvel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PropertyMap units={units ?? []} />
        </CardContent>
      </Card>

      {/* Units overview */}
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
                  <Badge variant={statusMap[unit.status].variant}>
                    {statusMap[unit.status].label}
                  </Badge>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    {unit.area_sqm}m²
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5" />
                    {unit.floor}
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Zap className="h-3.5 w-3.5" />
                    Energia: {unit.electricity_connection}
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Droplets className="h-3.5 w-3.5" />
                    Água: {unit.water_connection}
                  </div>
                </div>
                {unit.monthly_rent && (
                  <div className="mt-3 rounded-lg bg-muted p-2 text-center">
                    <p className="text-xs text-muted-foreground">Aluguel</p>
                    <p className="font-semibold text-foreground">
                      R$ {Number(unit.monthly_rent).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
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
