import { Zap } from "lucide-react";

const Utilities = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Consumos</h1>
        <p className="mt-1 text-muted-foreground">Acompanhe as leituras de energia e água das 3 ligações</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {["422A (4 Salas)", "422 (Salão)", "422B (Fundo)"].map((conn) => (
          <div key={conn} className="glass-card rounded-xl p-6 text-center">
            <Zap className="mx-auto h-8 w-8 text-secondary mb-2" />
            <h3 className="font-semibold text-foreground">{conn}</h3>
            <p className="text-sm text-muted-foreground mt-1">Energia + Água</p>
            <p className="text-xs text-muted-foreground mt-3">Registre as leituras mensais para controle de consumo</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Utilities;
