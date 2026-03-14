import { useState, useCallback } from "react";
import { toast } from "sonner";

interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

interface BrasilApiResponse {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

interface CepResult {
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  complement: string;
}

const UF_TO_STATE: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas",
  BA: "Bahia", CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo",
  GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul",
  MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná",
  PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia",
  RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe",
  TO: "Tocantins",
};

/** Tenta buscar na ViaCEP */
async function tryViaCep(cep: string): Promise<CepResult | null> {
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data: ViaCepResponse = await res.json();
    if (data.erro) return null;
    return {
      address: data.logradouro || "",
      neighborhood: data.bairro || "",
      city: data.localidade || "",
      state: UF_TO_STATE[data.uf] || data.uf || "",
      complement: data.complemento || "",
    };
  } catch {
    return null;
  }
}

/** Fallback: busca na BrasilAPI */
async function tryBrasilApi(cep: string): Promise<CepResult | null> {
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data: BrasilApiResponse = await res.json();
    return {
      address: data.street || "",
      neighborhood: data.neighborhood || "",
      city: data.city || "",
      state: UF_TO_STATE[data.state] || data.state || "",
      complement: "",
    };
  } catch {
    return null;
  }
}

/**
 * Hook para buscar endereço automaticamente pelo CEP.
 * Tenta primeiro a ViaCEP e, se falhar, usa a BrasilAPI como fallback.
 *
 * Exemplo de uso:
 * ```
 * const { fetchCep, loading } = useCep();
 * const handleCepChange = (cep: string) => {
 *   updateField("cep", cep);
 *   fetchCep(cep, (result) => {
 *     updateField("address", result.address);
 *     updateField("city", result.city);
 *     updateField("state", result.state);
 *   });
 * };
 * ```
 */
export function useCep() {
  const [loading, setLoading] = useState(false);

  const fetchCep = useCallback(
    async (rawCep: string, onResult: (result: CepResult) => void) => {
      const cep = rawCep.replace(/\D/g, "");
      if (cep.length !== 8) return;

      setLoading(true);
      try {
        // Tenta ViaCEP primeiro, depois BrasilAPI como fallback
        const result = await tryViaCep(cep) ?? await tryBrasilApi(cep);

        if (!result) {
          toast.error("CEP não encontrado.");
          return;
        }

        onResult(result);
        toast.success("Endereço preenchido automaticamente!");
      } catch {
        toast.error("Erro ao buscar CEP. Verifique e tente novamente.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { fetchCep, loading };
}
