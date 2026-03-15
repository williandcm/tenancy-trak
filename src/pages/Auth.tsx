import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Building2,
  KeyRound,
  Mail,
  Lock,
  ArrowRight,
  Home,
  Shield,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";

const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message === "Invalid login credentials") {
        toast.error("E-mail ou senha incorretos.");
      } else {
        toast.error(error.message);
      }
    }
    setLoading(false);
  };

  const features = [
    { icon: Home, title: "Gestão de Imóveis", desc: "Controle total das suas unidades" },
    { icon: Shield, title: "Contratos Seguros", desc: "Gerenciamento completo de locações" },
    { icon: BarChart3, title: "Relatórios", desc: "Acompanhe receitas e despesas" },
  ];

  return (
    <div className="flex min-h-screen">
      {/* Left Panel — Branding */}
      <div className="relative hidden w-1/2 overflow-hidden lg:flex lg:flex-col lg:justify-between gradient-primary p-12">
        <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-32 -right-32 h-[500px] w-[500px] rounded-full bg-white/5" />
        <div className="pointer-events-none absolute right-20 top-1/3 h-64 w-64 rounded-full bg-white/[0.03]" />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
              LocaGest
            </h1>
          </div>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-4xl font-bold leading-tight text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
              Simplifique a gestão
              <br />
              dos seus imóveis
            </h2>
            <p className="mt-4 max-w-md text-lg text-white/70">
              Gerencie contratos, inquilinos e pagamentos em um único lugar, com segurança e praticidade.
            </p>
          </div>

          <div className="space-y-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="flex items-center gap-4 rounded-xl bg-white/[0.07] p-4 backdrop-blur-sm transition-colors hover:bg-white/10"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <f.icon className="h-5 w-5 text-amber-300" />
                </div>
                <div>
                  <p className="font-semibold text-white">{f.title}</p>
                  <p className="text-sm text-white/60">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-sm text-white/40">
          © {new Date().getFullYear()} LocaGest. Todos os direitos reservados.
        </p>
      </div>

      {/* Right Panel — Login Form */}
      <div className="flex w-full flex-col items-center justify-center bg-background px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-[420px]">
          {/* Mobile logo */}
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl gradient-primary">
              <Building2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
              LocaGest
            </span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
              Bem-vindo de volta
            </h2>
            <p className="mt-2 text-muted-foreground">
              Entre com suas credenciais para acessar o painel
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="animate-fade-in space-y-5">
            <div className="space-y-2">
              <Label htmlFor="login-email" className="text-sm font-medium">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="seu@email.com"
                  className="h-11 pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-password" className="text-sm font-medium">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="h-11 pl-10"
                />
              </div>
            </div>

            <Button type="submit" className="group h-11 w-full gap-2 text-sm font-semibold" disabled={loading}>
              <KeyRound className="h-4 w-4" />
              {loading ? "Entrando..." : "Entrar"}
              {!loading && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Acesso restrito. Solicite suas credenciais ao administrador.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
