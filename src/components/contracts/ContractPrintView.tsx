import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer, FileEdit } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { DEFAULT_TEMPLATE, TEMPLATE_KEY, getTenantTemplateKey } from "@/pages/ContractTemplate";
import DOMPurify from "dompurify";

const fmt = (v: string) => format(new Date(v + "T12:00:00"), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
const money = (v: number | null) =>
  v != null ? `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "\u2014";

function numberToWords(n: number): string {
  const units = ["", "um", "dois", "tr\u00eas", "quatro", "cinco", "seis", "sete", "oito", "nove",
    "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const tens = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const hundreds = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

  if (n === 0) return "zero";
  if (n === 100) return "cem";

  const parts: string[] = [];

  if (n >= 1000) {
    const thousands = Math.floor(n / 1000);
    if (thousands === 1) parts.push("mil");
    else parts.push(numberToWords(thousands) + " mil");
    n %= 1000;
  }

  if (n >= 100) {
    parts.push(hundreds[Math.floor(n / 100)]);
    n %= 100;
  }

  if (n >= 20) {
    parts.push(tens[Math.floor(n / 10)]);
    n %= 10;
    if (n > 0) parts.push(units[n]);
  } else if (n > 0) {
    parts.push(units[n]);
  }

  return parts.join(" e ").toUpperCase();
}

function moneyToWords(value: number): string {
  const intPart = Math.floor(value);
  const words = numberToWords(intPart);
  return words + " REAIS";
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: any;
}

export default function ContractPrintView({ open, onOpenChange, contract }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  if (!contract) return null;

  const c = contract;
  const landlord = c.landlords;
  const tenant = c.tenants;
  const unit = c.units;

  const isCustomTemplate = !!c.tenant_id && !!localStorage.getItem(getTenantTemplateKey(c.tenant_id));

  const loadTemplate = (): string => {
    try {
      // First check if there's a custom template for this specific tenant
      if (c.tenant_id) {
        const tenantTemplate = localStorage.getItem(getTenantTemplateKey(c.tenant_id));
        if (tenantTemplate) return tenantTemplate;
      }
      // Fall back to the global custom template, then the default
      return localStorage.getItem(TEMPLATE_KEY) || DEFAULT_TEMPLATE;
    } catch {
      return DEFAULT_TEMPLATE;
    }
  };

  const processTemplate = (): string => {
    let html = loadTemplate();

    const replacements: Record<string, string> = {
      "{{LOCADOR_NOME}}": landlord?.full_name ?? "\u2014",
      "{{LOCADOR_NACIONALIDADE}}": landlord?.nationality ?? "brasileiro(a)",
      "{{LOCADOR_ESTADO_CIVIL}}": landlord?.marital_status ?? "casado(a)",
      "{{LOCADOR_RG}}": landlord?.rg ?? "\u2014",
      "{{LOCADOR_RG_EMISSOR}}": landlord?.rg_issuer ?? "SSP/SP",
      "{{LOCADOR_CPF}}": landlord?.cpf ?? "\u2014",
      "{{LOCADOR_ENDERECO}}": landlord?.address ? `${landlord.address}${landlord.address_number ? ", nº " + landlord.address_number : ""}${landlord.complement ? " - " + landlord.complement : ""}` : "\u2014",
      "{{LOCADOR_BAIRRO}}": landlord?.neighborhood ?? "",
      "{{LOCADOR_CIDADE}}": landlord?.city ?? "Hortol\u00e2ndia",
      "{{LOCADOR_ESTADO}}": landlord?.state ?? "S\u00e3o Paulo",
      "{{LOCADOR_CEP}}": landlord?.cep ?? "\u2014",
      "{{LOCATARIO_NOME}}": tenant?.full_name ?? "\u2014",
      "{{LOCATARIO_NACIONALIDADE}}": tenant?.nationality ?? "brasileiro(a)",
      "{{LOCATARIO_RG}}": tenant?.rg ?? "\u2014",
      "{{LOCATARIO_RG_EMISSOR}}": tenant?.rg_issuer ?? "SSP/SP",
      "{{LOCATARIO_CPF}}": tenant?.cpf ?? "\u2014",
      "{{LOCATARIO_ENDERECO}}": tenant?.address ? `${tenant.address}${tenant.address_number ? ", nº " + tenant.address_number : ""}${tenant.complement ? " - " + tenant.complement : ""}` : "\u2014",
      "{{LOCATARIO_BAIRRO}}": tenant?.neighborhood ?? "",
      "{{LOCATARIO_CIDADE}}": tenant?.city ?? "Hortol\u00e2ndia",
      "{{LOCATARIO_ESTADO}}": tenant?.state ?? "S\u00e3o Paulo",
      "{{LOCATARIO_CEP}}": tenant?.cep ?? "\u2014",
      "{{IMOVEL_NOME}}": unit?.name ?? "\u2014",
      "{{IMOVEL_ENDERECO}}": "Rua Orlando Pavan, n\u00b0 " + (unit?.address_number ?? "\u2014"),
      "{{IMOVEL_BAIRRO}}": "Jardim Rosol\u00e9m",
      "{{IMOVEL_CIDADE}}": "Hortol\u00e2ndia",
      "{{IMOVEL_ESTADO}}": "S\u00e3o Paulo",
      "{{IMOVEL_CEP}}": "13185-300",
      "{{IMOVEL_AREA}}": unit?.area_sqm ? String(unit.area_sqm) : "\u2014",
      "{{IMOVEL_ANDAR}}": unit?.floor ?? "\u2014",
      "{{CONTRATO_DURACAO}}": String(c.duration_months ?? "\u2014"),
      "{{CONTRATO_DURACAO_EXTENSO}}": c.duration_months ? numberToWords(c.duration_months) + " meses" : "\u2014",
      "{{CONTRATO_INICIO}}": c.start_date ? fmt(c.start_date) : "\u2014",
      "{{CONTRATO_FIM}}": c.end_date ? fmt(c.end_date) : "\u2014",
      "{{ALUGUEL_VALOR}}": money(c.monthly_rent),
      "{{ALUGUEL_EXTENSO}}": c.monthly_rent ? moneyToWords(Number(c.monthly_rent)) : "\u2014",
      "{{PAGAMENTO_DIA}}": c.payment_day ? String(c.payment_day).padStart(2, "0") : "\u2014",
      "{{MULTA_DIARIA}}": c.late_fee_percent != null ? String(c.late_fee_percent).replace(".", ",") : "0,33",
      "{{MULTA_MAXIMA}}": c.late_fee_max_percent != null ? String(c.late_fee_max_percent) : "20",
      "{{INDICE_REAJUSTE}}": c.adjustment_index ?? "IGPM",
      "{{CAUCAO_MESES}}": c.rescission_penalty_months ? String(c.rescission_penalty_months) : "3",
      "{{CAUCAO_VALOR}}": c.deposit_amount ? money(c.deposit_amount) : money((c.monthly_rent ?? 0) * (c.rescission_penalty_months ?? 3)),
      "{{DATA_ASSINATURA}}": c.start_date ? fmt(c.start_date) : fmt(new Date().toISOString().split("T")[0]),
      "{{FORO}}": "Hortol\u00e2ndia/SP",
    };

    for (const [key, value] of Object.entries(replacements)) {
      html = html.replaceAll(key, value);
      const escapedKey = key.replace(/[{}]/g, (m) => "\\" + m);
      const spanRegex = new RegExp("<span[^>]*>" + escapedKey + "<\\/span>", "gi");
      html = html.replace(spanRegex, value);
    }

    return html;
  };

  const handlePrint = () => {
    const processedHtml = processTemplate();
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write("<!DOCTYPE html><html><head><title>Contrato de Loca\u00e7\u00e3o - " + (unit?.name ?? "") + "</title><style>@page{margin:2cm 2.5cm;size:A4}body{font-family:'Times New Roman',Times,serif;font-size:12pt;line-height:1.8;color:#1a1a1a;max-width:100%}h1{text-align:center;font-size:16pt;margin-bottom:8px;text-transform:uppercase;letter-spacing:2px}p{text-align:justify;orphans:3;widows:3}div[style*='page-break-inside']{page-break-inside:avoid!important;break-inside:avoid!important}</style></head><body>" + processedHtml + "</body></html>");
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  const processedHtml = DOMPurify.sanitize(processTemplate());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DialogTitle className="text-xl">Pré-visualização para Impressão</DialogTitle>
              {isCustomTemplate && (
                <Badge variant="secondary" className="text-[10px]">Personalizado</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {hasPermission("admin") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onOpenChange(false);
                    navigate("/contract-template");
                  }}
                >
                  <FileEdit className="mr-2 h-4 w-4" /> Editar Modelo
                </Button>
              )}
              <Button onClick={handlePrint} size="sm">
                <Printer className="mr-2 h-4 w-4" /> Imprimir
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div
          ref={printRef}
          className="bg-white text-black p-8 rounded-lg border shadow-inner"
          style={{ fontFamily: "'Times New Roman', Times, serif", lineHeight: 1.8, fontSize: "12pt" }}
          dangerouslySetInnerHTML={{ __html: processedHtml }}
        />
      </DialogContent>
    </Dialog>
  );
}
