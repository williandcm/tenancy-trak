import { Tables } from "@/integrations/supabase/types";

type Unit = Tables<"units">;

const statusColors = {
  available: "fill-success/20 stroke-success",
  occupied: "fill-secondary/20 stroke-secondary",
  maintenance: "fill-destructive/20 stroke-destructive",
};

const statusLabels = {
  available: "Disponível",
  occupied: "Ocupado",
  maintenance: "Manutenção",
};

const PropertyMap = ({ units }: { units: Unit[] }) => {
  const getUnit = (identifier: string) => units.find((u) => u.identifier === identifier);

  const sala1 = getUnit("sala-1");
  const sala2 = getUnit("sala-2");
  const sala3 = getUnit("sala-3");
  const sala4 = getUnit("sala-4");
  const salao = getUnit("salao");
  const fundo = getUnit("sala-fundo");

  const UnitBox = ({ unit, x, y, w, h }: { unit?: Unit; x: number; y: number; w: number; h: number }) => {
    if (!unit) return null;
    const colorClass = statusColors[unit.status];
    return (
      <g>
        <rect
          x={x} y={y} width={w} height={h} rx={8}
          className={colorClass}
          strokeWidth={2}
        />
        <text x={x + w / 2} y={y + h / 2 - 8} textAnchor="middle" className="fill-foreground text-xs font-semibold">
          {unit.name}
        </text>
        <text x={x + w / 2} y={y + h / 2 + 8} textAnchor="middle" className="fill-muted-foreground text-[10px]">
          {unit.area_sqm}m²
        </text>
        <text x={x + w / 2} y={y + h / 2 + 22} textAnchor="middle" className="fill-muted-foreground text-[9px]">
          {statusLabels[unit.status]}
        </text>
      </g>
    );
  };

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox="0 0 700 400" className="w-full max-w-3xl mx-auto" role="img" aria-label="Mapa do imóvel na Rua Orlando Pavan, 422">
        {/* Property border */}
        <rect x={20} y={20} width={660} height={360} rx={12} className="fill-muted/30 stroke-border" strokeWidth={2} strokeDasharray="6 3" />
        
        {/* Street label */}
        <text x={350} y={14} textAnchor="middle" className="fill-muted-foreground text-[11px] font-medium">
          Rua Orlando Pavan
        </text>

        {/* Address labels */}
        <text x={120} y={50} textAnchor="middle" className="fill-foreground text-xs font-bold">422A (Esquerda)</text>
        <text x={350} y={50} textAnchor="middle" className="fill-foreground text-xs font-bold">422 (Centro)</text>
        <text x={580} y={50} textAnchor="middle" className="fill-foreground text-xs font-bold">422B (Direita)</text>

        {/* Door indicators */}
        <rect x={55} y={56} width={30} height={6} rx={3} className="fill-secondary stroke-secondary" strokeWidth={1} />
        <text x={70} y={75} textAnchor="middle" className="fill-muted-foreground text-[8px]">Porta + Escada</text>
        
        <rect x={560} y={56} width={30} height={6} rx={3} className="fill-secondary stroke-secondary" strokeWidth={1} />
        <text x={575} y={75} textAnchor="middle" className="fill-muted-foreground text-[8px]">Porta</text>

        {/* Upper floor label */}
        <text x={120} y={95} textAnchor="middle" className="fill-muted-foreground text-[10px] italic">Andar Superior ↑</text>

        {/* 422A - 4 rooms upper floor */}
        <UnitBox unit={sala1} x={30} y={105} w={100} h={80} />
        <UnitBox unit={sala2} x={135} y={105} w={90} h={80} />
        <UnitBox unit={sala3} x={30} y={195} w={100} h={80} />
        <UnitBox unit={sala4} x={135} y={195} w={90} h={80} />

        {/* 422 - Main hall below */}
        <UnitBox unit={salao} x={250} y={105} w={200} h={170} />

        {/* 422B - Back room */}
        <UnitBox unit={fundo} x={475} y={105} w={190} h={170} />

        {/* Utility connections */}
        <g>
          <text x={120} y={310} textAnchor="middle" className="fill-muted-foreground text-[9px] font-medium">
            ⚡ Energia: 422A | 💧 Água: 422A
          </text>
          <text x={350} y={310} textAnchor="middle" className="fill-muted-foreground text-[9px] font-medium">
            ⚡ Energia: 422 | 💧 Água: 422
          </text>
          <text x={570} y={310} textAnchor="middle" className="fill-muted-foreground text-[9px] font-medium">
            ⚡ Energia: 422B | 💧 Água: 422B
          </text>
        </g>

        {/* Legend */}
        <g transform="translate(30, 340)">
          <rect x={0} y={0} width={12} height={12} rx={3} className="fill-success/20 stroke-success" strokeWidth={1.5} />
          <text x={18} y={10} className="fill-muted-foreground text-[10px]">Disponível</text>
          <rect x={100} y={0} width={12} height={12} rx={3} className="fill-secondary/20 stroke-secondary" strokeWidth={1.5} />
          <text x={118} y={10} className="fill-muted-foreground text-[10px]">Ocupado</text>
          <rect x={190} y={0} width={12} height={12} rx={3} className="fill-destructive/20 stroke-destructive" strokeWidth={1.5} />
          <text x={208} y={10} className="fill-muted-foreground text-[10px]">Manutenção</text>
        </g>
      </svg>
    </div>
  );
};

export default PropertyMap;
