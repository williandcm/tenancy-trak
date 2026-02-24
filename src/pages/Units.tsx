import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DoorOpen, Pencil, MapPin, Zap, Droplets, Building2 } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Unit = Tables<"units">;

const statusMap = {
  available: { label: "Disponível", variant: "default" as const },
  occupied: { label: "Ocupado", variant: "secondary" as const },
  maintenance: { label: "Manutenção", variant: "destructive" as const },
};

const Units = () => {
  const queryClient = useQueryClient();
  const [editUnit, setEditUnit] = useState<Unit | null>(null);
  const [editRent, setEditRent] = useState("");
  const [editStatus, setEditStatus] = useState<string>("");

  const { data: units, isLoading } = useQuery({
    queryKey: ["units"],
    queryFn: async () => {
      const { data, error } = await supabase.from("units").select("*").order("address_number").order("name");
      if (error) throw error;
      return data;
    },
  });

  const updateUnit = useMutation({
    mutationFn: async ({ id, monthly_rent, status }: { id: string; monthly_rent: number | null; status: string }) => {
      const { error } = await supabase
        .from("units")
        .update({ monthly_rent, status: status as Unit["status"] })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units"] });
      setEditUnit(null);
      toast.success("Unidade atualizada!");
    },
    onError: () => toast.error("Erro ao atualizar unidade."),
  });

  const handleEdit = (unit: Unit) => {
    setEditUnit(unit);
    setEditRent(unit.monthly_rent?.toString() ?? "");
    setEditStatus(unit.status);
  };

  const handleSave = () => {
    if (!editUnit) return;
    updateUnit.mutate({
      id: editUnit.id,
      monthly_rent: editRent ? parseFloat(editRent) : null,
      status: editStatus,
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Unidades</h1>
        <p className="mt-1 text-muted-foreground">Gerencie as salas comerciais e o salão</p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {units?.map((unit) => (
            <Card key={unit.id} className="glass-card group">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{unit.name}</h3>
                    <p className="text-sm text-muted-foreground">Nº {unit.address_number} · {unit.floor}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusMap[unit.status].variant}>
                      {statusMap[unit.status].label}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleEdit(unit)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <p className="mt-2 text-sm text-muted-foreground">{unit.description}</p>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" /> {unit.area_sqm}m²
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5" /> {unit.floor}
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Zap className="h-3.5 w-3.5" /> Energia: {unit.electricity_connection}
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Droplets className="h-3.5 w-3.5" /> Água: {unit.water_connection}
                  </div>
                </div>

                {unit.monthly_rent && (
                  <div className="mt-4 rounded-lg bg-muted p-3 text-center">
                    <p className="text-xs text-muted-foreground">Aluguel Mensal</p>
                    <p className="text-xl font-bold text-foreground">
                      R$ {Number(unit.monthly_rent).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editUnit} onOpenChange={(open) => !open && setEditUnit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar {editUnit?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Disponível</SelectItem>
                  <SelectItem value="occupied">Ocupado</SelectItem>
                  <SelectItem value="maintenance">Manutenção</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Aluguel Mensal (R$)</Label>
              <Input type="number" value={editRent} onChange={(e) => setEditRent(e.target.value)} placeholder="1500.00" />
            </div>
            <Button onClick={handleSave} className="w-full" disabled={updateUnit.isPending}>
              {updateUnit.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Units;
