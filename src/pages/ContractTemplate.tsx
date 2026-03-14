import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  FileText, Save, RotateCcw, Eye, Printer, Bold, Italic, Underline,
  AlignLeft, AlignCenter, AlignJustify, List, Undo2, Redo2, Type,
  ShieldAlert, Plus, Trash2, Pencil, Users, Copy,
} from "lucide-react";
import { toast } from "sonner";

/* ── Constants ─────────────────────────────────────── */
const TEMPLATE_KEY = "locagest-contract-template";
const TENANT_TEMPLATE_PREFIX = "locagest-contract-template-tenant-";

const getTenantTemplateKey = (tenantId: string) => TENANT_TEMPLATE_PREFIX + tenantId;

/** Returns all tenant IDs that have a custom template in localStorage */
const getCustomTenantIds = (): string[] => {
  const ids: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(TENANT_TEMPLATE_PREFIX)) {
      ids.push(key.replace(TENANT_TEMPLATE_PREFIX, ""));
    }
  }
  return ids;
};

const VARIABLES = [
  { key: "{{LOCADOR_NOME}}", label: "Nome do Locador", example: "ILMA BARBOSA DO CARMO MORAIS" },
  { key: "{{LOCADOR_NACIONALIDADE}}", label: "Nacionalidade do Locador", example: "brasileiro(a)" },
  { key: "{{LOCADOR_ESTADO_CIVIL}}", label: "Estado Civil do Locador", example: "casado(a)" },
  { key: "{{LOCADOR_RG}}", label: "RG do Locador", example: "17731022-4" },
  { key: "{{LOCADOR_RG_EMISSOR}}", label: "Emissor RG do Locador", example: "SSP/SP" },
  { key: "{{LOCADOR_CPF}}", label: "CPF do Locador", example: "052.404.088-58" },
  { key: "{{LOCADOR_ENDERECO}}", label: "Endere\u00e7o do Locador", example: "Rua Orlando Signorelli, n\u00b0425" },
  { key: "{{LOCADOR_BAIRRO}}", label: "Bairro do Locador", example: "Jardim Adelaide" },
  { key: "{{LOCADOR_CIDADE}}", label: "Cidade do Locador", example: "Hortol\u00e2ndia" },
  { key: "{{LOCADOR_ESTADO}}", label: "Estado do Locador", example: "S\u00e3o Paulo" },
  { key: "{{LOCADOR_CEP}}", label: "CEP do Locador", example: "13.185-340" },
  { key: "{{LOCATARIO_NOME}}", label: "Nome do Locat\u00e1rio", example: "ROSEANE FATIMA..." },
  { key: "{{LOCATARIO_NACIONALIDADE}}", label: "Nacionalidade do Locat\u00e1rio", example: "brasileiro(a)" },
  { key: "{{LOCATARIO_RG}}", label: "RG do Locat\u00e1rio", example: "41809021" },
  { key: "{{LOCATARIO_RG_EMISSOR}}", label: "Emissor RG do Locat\u00e1rio", example: "SSP/SP" },
  { key: "{{LOCATARIO_CPF}}", label: "CPF do Locat\u00e1rio", example: "346.863.728-44" },
  { key: "{{LOCATARIO_ENDERECO}}", label: "Endere\u00e7o do Locat\u00e1rio", example: "Rua Ant\u00f4nio Fernandes..." },
  { key: "{{LOCATARIO_BAIRRO}}", label: "Bairro do Locat\u00e1rio", example: "Jardim Adelaide" },
  { key: "{{LOCATARIO_CIDADE}}", label: "Cidade do Locat\u00e1rio", example: "Hortol\u00e2ndia" },
  { key: "{{LOCATARIO_ESTADO}}", label: "Estado do Locat\u00e1rio", example: "S\u00e3o Paulo" },
  { key: "{{LOCATARIO_CEP}}", label: "CEP do Locat\u00e1rio", example: "13.185-230" },
  { key: "{{IMOVEL_NOME}}", label: "Nome da Unidade", example: "Sala 1" },
  { key: "{{IMOVEL_ENDERECO}}", label: "Endere\u00e7o do Im\u00f3vel", example: "Rua Orlando Pavan, n\u00b0 422 A" },
  { key: "{{IMOVEL_BAIRRO}}", label: "Bairro do Im\u00f3vel", example: "Jardim Rosol\u00e9m" },
  { key: "{{IMOVEL_CIDADE}}", label: "Cidade do Im\u00f3vel", example: "Hortol\u00e2ndia" },
  { key: "{{IMOVEL_ESTADO}}", label: "Estado do Im\u00f3vel", example: "S\u00e3o Paulo" },
  { key: "{{IMOVEL_CEP}}", label: "CEP do Im\u00f3vel", example: "13185-3000" },
  { key: "{{IMOVEL_AREA}}", label: "\u00c1rea (m\u00b2)", example: "30" },
  { key: "{{IMOVEL_ANDAR}}", label: "Andar", example: "T\u00e9rreo" },
  { key: "{{CONTRATO_DURACAO}}", label: "Dura\u00e7\u00e3o (meses)", example: "24" },
  { key: "{{CONTRATO_DURACAO_EXTENSO}}", label: "Dura\u00e7\u00e3o por extenso", example: "Vinte e Quatro meses" },
  { key: "{{CONTRATO_INICIO}}", label: "Data de In\u00edcio", example: "01 de Fevereiro de 2026" },
  { key: "{{CONTRATO_FIM}}", label: "Data de T\u00e9rmino", example: "01 de Fevereiro de 2028" },
  { key: "{{ALUGUEL_VALOR}}", label: "Valor do Aluguel", example: "R$ 2.000,00" },
  { key: "{{ALUGUEL_EXTENSO}}", label: "Aluguel por extenso", example: "DOIS MIL REAIS" },
  { key: "{{PAGAMENTO_DIA}}", label: "Dia do Pagamento", example: "01" },
  { key: "{{MULTA_DIARIA}}", label: "Multa Di\u00e1ria (%)", example: "0,33" },
  { key: "{{MULTA_MAXIMA}}", label: "Multa M\u00e1xima (%)", example: "20" },
  { key: "{{INDICE_REAJUSTE}}", label: "\u00cdndice de Reajuste", example: "IGPM" },
  { key: "{{CAUCAO_MESES}}", label: "Meses de Cau\u00e7\u00e3o", example: "3" },
  { key: "{{CAUCAO_VALOR}}", label: "Valor da Cau\u00e7\u00e3o", example: "R$ 6.000,00" },
  { key: "{{DATA_ASSINATURA}}", label: "Data de Assinatura", example: "01 de fevereiro de 2026" },
  { key: "{{FORO}}", label: "Foro", example: "Hortol\u00e2ndia/SP" },
];

/* ── Default Template ──────────────────────────────── */
const DEFAULT_TEMPLATE = `<h1 style="text-align:center; font-size:18pt; text-transform:uppercase; letter-spacing:2px; margin-bottom:4px;">Contrato de loca\u00e7\u00e3o</h1>

<p style="text-align:justify; margin-top:24px;"><strong>IDENTIFICA\u00c7\u00c3O DAS PARTES CONTRATANTES.</strong></p>

<p style="text-align:justify;"><strong>LOCADOR:</strong> {{LOCADOR_NOME}}, {{LOCADOR_NACIONALIDADE}}, {{LOCADOR_ESTADO_CIVIL}}, portador da C\u00e9dula de Identidade RG sob o n\u00b0 {{LOCADOR_RG}} {{LOCADOR_RG_EMISSOR}} e do CPF (MF) sob o n\u00b0 {{LOCADOR_CPF}}, residente e domic\u00edlio \u00e0 {{LOCADOR_ENDERECO}} \u2013 {{LOCADOR_BAIRRO}}, no munic\u00edpio de {{LOCADOR_CIDADE}}, Estado de {{LOCADOR_ESTADO}}, CEP {{LOCADOR_CEP}}.</p>

<p style="text-align:justify;"><strong>LOCAT\u00c1RIO(A):</strong> {{LOCATARIO_NOME}}, {{LOCATARIO_NACIONALIDADE}}, Portador da C\u00e9dula de Identidade RG sob o n\u00b0 {{LOCATARIO_RG}} {{LOCATARIO_RG_EMISSOR}} e do CPF (MF) sob o n\u00b0 {{LOCATARIO_CPF}}, domiciliado(a) a {{LOCATARIO_ENDERECO}}, no munic\u00edpio de {{LOCATARIO_CIDADE}}, Estado de {{LOCATARIO_ESTADO}}, CEP {{LOCATARIO_CEP}}.</p>

<p style="text-align:justify; margin-top:24px;"><strong>1 IM\u00d3VEL DO CONTRATO.</strong></p>

<p style="text-align:justify; margin-left:40px;">1.1 O IM\u00d3VEL de propriedade do LOCADOR, sito a {{IMOVEL_ENDERECO}}, {{IMOVEL_BAIRRO}}, no munic\u00edpio de {{IMOVEL_CIDADE}}, Estado de {{IMOVEL_ESTADO}}, CEP {{IMOVEL_CEP}}. As partes acima identificadas t\u00eam, entre si, justas e acertadas o presente Contrato de Loca\u00e7\u00e3o Comercial, que se reger\u00e1 pelas cl\u00e1usulas seguintes e pelas condi\u00e7\u00f5es descritas no presente.</p>

<p style="text-align:justify; margin-top:24px;"><strong>2 PER\u00cdODO DE LOCA\u00c7\u00c3O / RESCIS\u00c3O.</strong></p>

<p style="text-align:justify; margin-left:40px;">2.1 O Prazo de loca\u00e7\u00e3o \u00e9 de {{CONTRATO_DURACAO}} ({{CONTRATO_DURACAO_EXTENSO}}) a iniciar em {{CONTRATO_INICIO}} e a terminar em {{CONTRATO_FIM}}, data que o LOCAT\u00c1RIO(A) se obriga a restituir o im\u00f3vel.</p>

<p style="text-align:justify; margin-left:40px;">2.2 Caso uma das partes decida RESCINDIR o contrato, no per\u00edodo do primeiro ano (12 doze meses) a outra dever\u00e1 ser informada com anteced\u00eancia de 30 (trinta) dias; a qual ser\u00e1 paga pela parte respons\u00e1vel pela rescis\u00e3o do mesmo uma multa no valor de {{CAUCAO_MESES}} (tr\u00eas) alugueis, que dever\u00e1 ser pago na vistoria da entrega das chaves conforme referido na cl\u00e1usula 8.2.</p>

<p style="text-align:justify; margin-top:24px;"><strong>3 VALOR DO ALUGUEL, DESPESAS E TRIBUTOS.</strong></p>

<p style="text-align:justify; margin-left:40px;">3.1 O valor do aluguel mensal \u00e9 de {{ALUGUEL_VALOR}} ({{ALUGUEL_EXTENSO}}), e o LOCAT\u00c1RIO(A) se compromete a pagar pontualmente todo dia {{PAGAMENTO_DIA}} de cada m\u00eas, ap\u00f3s o vencimento ter\u00e1 multa de {{MULTA_DIARIA}} % ao dia limitado a {{MULTA_MAXIMA}} % , e juros corrigidos pela taxa SELIC;</p>

<p style="text-align:justify; margin-left:40px;">3.2 O RECIBO do valor pago ser\u00e1 emitido pelo LOCADOR, e dever\u00e1 ser entregue no ato do pagamento;</p>

<p style="text-align:justify; margin-left:40px;">3.3 Ficam estabelecidos que o aluguel sofra reajuste a cada 12 (doze) meses de loca\u00e7\u00e3o, atrav\u00e9s da legisla\u00e7\u00e3o espec\u00edfica pelo governo Federal, sendo o \u00edndice utilizado para reajuste o {{INDICE_REAJUSTE}}, ou na extin\u00e7\u00e3o deste, outro que venha substitu\u00ed-lo, podendo tamb\u00e9m haver negocia\u00e7\u00e3o entre as partes (LOCADOR e LOCAT\u00c1RIO(A)).</p>

<p style="text-align:justify; margin-left:40px;">3.4 Todas as despesas diretamente ligadas \u00e1 conserva\u00e7\u00e3o do im\u00f3vel, tais como, \u00e1gua, esgoto, luz, g\u00e1s, telefone, assim como todos os encargos e tributos que incidam ou venham a incidir sobre o im\u00f3vel, conserva\u00e7\u00e3o, seguro e outras decorrentes de Lei, assim como de suas respectivas majora\u00e7\u00f5es, ficam a cargo do LOCAT\u00c1RIO(A), ressalvando-se quanto \u00e0 contribui\u00e7\u00e3o de melhorias, e seu n\u00e3o pagamento na \u00e9poca determinada acarretar\u00e3o a rescis\u00e3o do presente contrato;</p>

<p style="text-align:justify; margin-left:40px;">3.5 O pagamento do IPTU ser\u00e1 efetuado pelo LOCAT\u00c1RIO(A). A mesma far\u00e1 o pagamento em dep\u00f3sito no banco Bradesco, na ag\u00eancia 2387 \u2013 Conta-Corrente: 0012921-6.</p>

<p style="text-align:justify; margin-top:24px;"><strong>4 FIAN\u00c7A</strong></p>

<p style="text-align:justify; margin-left:40px;">4.1 Em caso de morte, incapacidade, insolv\u00eancia, mudan\u00e7a de resid\u00eancia, da FIADORA dever\u00e1 o LOCAT\u00c1RIO(A) dar substituto id\u00f4neo, a ju\u00edzo do LOCADOR, dentro de 30 (trinta) dias da comunica\u00e7\u00e3o ou notifica\u00e7\u00e3o que este lhe fizer por carta registrada ou expedida por interm\u00e9dio do Oficial de registro de t\u00edtulos e documentos. A recusa do LOCAT\u00c1RIO(A) em dar substituto, assim como simples omiss\u00e3o ou in\u00e9rcia dele, constitui infra\u00e7\u00e3o grave para fins de rescis\u00e3o do contrato. \u00c9 de exclusivo arb\u00edtrio do LOCADOR a exig\u00eancia de substitui\u00e7\u00e3o prevista nesta cl\u00e1usula.</p>

<p style="text-align:justify; margin-top:24px;"><strong>5 DA UTILIZA\u00c7\u00c3O DO IM\u00d3VEL</strong></p>

<p style="text-align:justify; margin-left:40px;">5.1 A presente loca\u00e7\u00e3o destina-se exclusivamente ao uso do im\u00f3vel para fins comerciais. N\u00e3o poder\u00e1 a LOCAT\u00c1RIO(A) transferir este contrato ou ceder \u00e0 loca\u00e7\u00e3o, sublocar ou emprestar o im\u00f3vel locado, no todo ou em parte. N\u00e3o poder\u00e1 usar o im\u00f3vel para fim diverso do que se destina, salvo autoriza\u00e7\u00e3o do LOCADOR, atrav\u00e9s de uma declara\u00e7\u00e3o reconhecida.</p>

<p style="text-align:justify; margin-top:24px;"><strong>6 DAS CONDI\u00c7\u00d5ES DO IM\u00d3VEL / CONSERVA\u00c7\u00c3O</strong></p>

<p style="text-align:justify; margin-left:40px;">6.1 O LOCAT\u00c1RIO(A), declara neste ato que recebeu o im\u00f3vel em perfeitas condi\u00e7\u00f5es de conserva\u00e7\u00e3o e uso conforme as finalidades, obrigando-se, ainda, a devolver o im\u00f3vel quando findar ou rescindir a loca\u00e7\u00e3o nas mesmas condi\u00e7\u00f5es em que recebeu.</p>

<p style="text-align:justify; margin-left:40px;">6.2 O LOCAT\u00c1RIO(A) obriga-se a manter os aparelhos sanit\u00e1rios, encanamentos, ralos, chuveiros, ilumina\u00e7\u00e3o, pinturas, pisos, azulejos, telhado, vidra\u00e7as fechaduras, fechos, portas, torneiras, pias e os demais acess\u00f3rios e pertences em perfeito estado de conserva\u00e7\u00e3o e funcionamento, para assim os restituir quando findar ou rescindir a loca\u00e7\u00e3o;</p>

<p style="text-align:justify; margin-left:40px;">6.3 Ficam proibidos o LOCAT\u00c1RIO(A) o uso de pregos ou quaisquer perfurantes nas paredes e azulejos, portas e janelas;</p>

<p style="text-align:justify; margin-left:40px;">6.4 Ficam a cargo do LOCAT\u00c1RIO(A) a higieniza\u00e7\u00e3o do ar-condicionado uma vez por ano, e dever\u00e1 ser entregue higienizado.</p>

<p style="text-align:justify; margin-left:40px;">6.5 Cabe ao LOCADOR ficar respons\u00e1vel pelos problemas, e defeitos que incidirem sobre o im\u00f3vel que N\u00c3O seja de responsabilidade ou causados pelo mau uso do LOCAT\u00c1RIO(A), e que vier por em risco a estrutura do im\u00f3vel ou conforto, dentre esses, limpeza da fossa (caso necess\u00e1rio), infiltra\u00e7\u00e3o, assim como outros que constarem dentre do termo referido; caso o LOCADOR n\u00e3o vier a solucionar os problemas, no prazo de 30 (trinta) dias a contar da data em que o LOCAT\u00c1RIO(A) informou, haver\u00e1 rescis\u00e3o imediata do contrato e pagamento de indeniza\u00e7\u00e3o pelo LOCADOR ao LOCAT\u00c1RIO(A), no valor de 02 (dois) alugueis.</p>

<p style="text-align:justify; margin-left:40px;">6.6 Em caso de desastres naturais que venham, a comprometer parcial ou todo o im\u00f3vel, o contrato pode ser rescindido caso ambas as partes estejam de acordo.</p>

<p style="text-align:justify; margin-left:40px;">6.7 Ser\u00e1 responsabilidade do LOCAT\u00c1RIO(A) em caso de acidentes que porventura venha a ocorrer no im\u00f3vel que comprovado por culpa do LOCAT\u00c1RIO(A), assim como em caso de inc\u00eandio em que constarem e comprovarem que a propaga\u00e7\u00e3o do fogo tenha ocorrido por descuido, como irregularidade nas instala\u00e7\u00f5es el\u00e9tricas (feita pelo LOCAT\u00c1RIO(A)), brincadeiras com fogo, descuidos com f\u00f3sforos e pontas de cigarros; dentre outras que constarem no termo referido o mesmo ficar\u00e1 obrigado a pagar todas as despesas por danos causados ao im\u00f3vel, devendo restitu\u00ed-lo no estado em que recebeu.</p>

<p style="text-align:justify; margin-left:40px;">6.8 Nenhuma intima\u00e7\u00e3o do servi\u00e7o sanit\u00e1rio ser\u00e1 motivo para o LOCAT\u00c1RIO(A), abandonar o im\u00f3vel ou pedir a rescis\u00e3o deste contrato, salvo procedendo vistoria judicial, que apure estar \u00e0 constru\u00e7\u00e3o amea\u00e7ada de ruir.</p>

<p style="text-align:justify; margin-left:40px;">6.9 \u00c9 vedada o LOCAT\u00c1RIO(A) a troca das fechaduras. A ocorr\u00eancia de qualquer evento que torne necess\u00e1ria a troca de tal segredo dever\u00e1 ser imediatamente comunicado ao LOCADOR, cuja autoriza\u00e7\u00e3o expressa \u00e9 imprescind\u00edvel para que se efetue aludida troca de segredo.</p>

<p style="text-align:justify; margin-top:24px;"><strong>7 BENFEITORIAS E CONSTRU\u00c7\u00d5ES</strong></p>

<p style="text-align:justify; margin-left:40px;">7.1 Qualquer benfeitoria ou constru\u00e7\u00e3o que seja destinada ao im\u00f3vel, dever\u00e1 de imediato, ser submetida \u00e0 autoriza\u00e7\u00e3o expressa do LOCADOR. Vindo a ser feita benfeitoria, faculta \u00e1 LOCADOR n\u00e3o a aceitar, modificar o im\u00f3vel da maneira que lhe foi entregue, as benfeitorias necess\u00e1rias ou \u00fateis, como consertos ou reparos far\u00e3o parte integrante do im\u00f3vel, n\u00e3o assistido o LOCAT\u00c1RIO o direito de reten\u00e7\u00e3o ou indeniza\u00e7\u00e3o sobre a mesma.</p>

<p style="text-align:justify; margin-top:24px;"><strong>8 VISTORIAS</strong></p>

<p style="text-align:justify; margin-left:40px;">8.1 Por ocasi\u00e3o do in\u00edcio da loca\u00e7\u00e3o do im\u00f3vel ser\u00e1 procedida uma vistoria pelo LOCADOR e LOCAT\u00c1RIO(A) onde juntos far\u00e3o a constata\u00e7\u00e3o do estado geral do im\u00f3vel, no qual constar\u00e1, pormenorizadamente, a qualidade e esp\u00e9cies e utens\u00edlios existentes;</p>

<p style="text-align:justify; margin-left:40px;">8.2 Por ocasi\u00e3o da desocupa\u00e7\u00e3o do im\u00f3vel, ser\u00e1 procedida outra vistoria pela LOCADOR e LOCAT\u00c1RIO(A) onde juntos far\u00e3o novamente a constata\u00e7\u00e3o do estado geral do im\u00f3vel e sendo constatados danos pela m\u00e1 conserva\u00e7\u00e3o, ficar\u00e1 o LOCAT\u00c1RIO(A), obrigado a pagar as despesas referentes aos danos causados;</p>

<p style="text-align:justify; margin-left:40px;">8.3 Executados os reparos o LOCADOR apresentar\u00e1 os recibos dos valores gastos, e devolver\u00e1, ser for o caso, os valores dados em cau\u00e7\u00e3o e que n\u00e3o foram despendidos nos reparos;</p>

<p style="text-align:justify; margin-left:40px;">8.4 Cabe ao LOCADOR o direito de examinar o im\u00f3vel locado, e o LOCAT\u00c1RIO obriga-se a permitir que o LOCADOR ou seu representante, mostre eventual pretendente \u00e0 compra do im\u00f3vel locado que desde j\u00e1 autorizado a venda e abre a m\u00e3o do direito de prefer\u00eancia. O hor\u00e1rio e data para isso poder\u00e1 ser combinado entre as partes (LOCADOR e LOCAT\u00c1RIO(A)). A recusa dessa permiss\u00e3o constitui grave infra\u00e7\u00e3o contratual motivadora de despejo, a qual o contrato poder\u00e1 ser rescindido pelo LOCADOR n\u00e3o havendo multa de rescis\u00e3o de contrato.</p>

<p style="text-align:justify; margin-top:24px;"><strong>9 CONDI\u00c7\u00d5ES GERAIS</strong></p>

<p style="text-align:justify; margin-left:40px;">9.1 Tudo quanto for devido em raz\u00e3o do presente contrato e que n\u00e3o comportem processo executivo ser\u00e1 cobrado em a\u00e7\u00e3o competente, ficando a cargo de devedor, em qualquer caso, os honor\u00e1rios advocat\u00edcios que o credor constitui para ressalvar de seus direitos.</p>

<p style="text-align:justify; margin-left:40px;">9.2 \u00c9 competente o foro de {{FORO}} todas as quest\u00f5es oriundas do presente contrato e loca\u00e7\u00e3o, seja qual for o domic\u00edlio dos contratantes, mesmo para as a\u00e7\u00f5es de cobran\u00e7as posteriores ao t\u00e9rmino deste contrato, ainda que o LOCAT\u00c1RIO(A) ou FIADORA tenham mudado ou j\u00e1 residam em outras comarcas.</p>

<p style="text-align:justify; margin-left:40px;">9.3 Em caso de morte, incapacidade, insolv\u00eancia do LOCAT\u00c1RIO(A) o contrato ser\u00e1 imediatamente rescindido.</p>

<div style="page-break-inside:avoid; break-inside:avoid;">
<p style="text-align:justify; margin-top:40px;">E por estarem assim justos e contratados, assim o presente contrato em 02 (duas) vias de igual teor, na forma da lei.</p>

<p style="text-align:center; margin-top:32px;">{{IMOVEL_CIDADE}}, {{DATA_ASSINATURA}}</p>

<div style="margin-top:60px; display:flex; justify-content:space-between; gap:48px;">
<div style="text-align:center; flex:1;">
<div style="border-top:1px solid #333; padding-top:4px; font-size:11pt;">{{LOCADOR_NOME}}</div>
<div style="font-size:10pt; color:#555;">LOCADOR(A)</div>
</div>
<div style="text-align:center; flex:1;">
<div style="border-top:1px solid #333; padding-top:4px; font-size:11pt;">{{LOCATARIO_NOME}}</div>
<div style="font-size:10pt; color:#555;">LOCAT\u00c1RIO(A)</div>
</div>
</div>
</div>`;

/* ── Shared Editor Toolbar ─────────────────────────── */
interface ToolbarProps {
  editorRef: React.RefObject<HTMLDivElement>;
  onSave: () => void;
  onReset: () => void;
  onPrint: () => void;
  saved: boolean;
  setSaved: (v: boolean) => void;
  resetLabel?: string;
}

const EditorToolbar = ({ editorRef, onSave, onReset, onPrint, saved, setSaved, resetLabel }: ToolbarProps) => {
  const [variablesOpen, setVariablesOpen] = useState(false);

  const execCmd = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
    setSaved(false);
  };

  const insertVariable = (varKey: string) => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const span = document.createElement("span");
      span.style.backgroundColor = "#dbeafe";
      span.style.color = "#1e40af";
      span.style.padding = "1px 4px";
      span.style.borderRadius = "3px";
      span.style.fontWeight = "600";
      span.style.fontSize = "11px";
      span.textContent = varKey;
      range.deleteContents();
      range.insertNode(span);
      range.setStartAfter(span);
      range.setEndAfter(span);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    setSaved(false);
    setVariablesOpen(false);
  };

  return (
    <>
      <Card className="glass-card">
        <CardContent className="p-2">
          <div className="flex flex-wrap items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCmd("undo")} title="Desfazer"><Undo2 className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCmd("redo")} title="Refazer"><Redo2 className="h-4 w-4" /></Button>
            <Separator orientation="vertical" className="h-6 mx-1" />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCmd("bold")} title="Negrito"><Bold className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCmd("italic")} title="It\u00e1lico"><Italic className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCmd("underline")} title="Sublinhado"><Underline className="h-4 w-4" /></Button>
            <Separator orientation="vertical" className="h-6 mx-1" />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCmd("justifyLeft")} title="Alinhar \u00e0 esquerda"><AlignLeft className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCmd("justifyCenter")} title="Centralizar"><AlignCenter className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCmd("justifyFull")} title="Justificar"><AlignJustify className="h-4 w-4" /></Button>
            <Separator orientation="vertical" className="h-6 mx-1" />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCmd("insertUnorderedList")} title="Lista"><List className="h-4 w-4" /></Button>
            <select className="h-8 rounded border bg-background px-2 text-xs" onChange={(e) => { if (e.target.value) execCmd("formatBlock", e.target.value); }} defaultValue="">
              <option value="" disabled>Formato</option>
              <option value="p">Par\u00e1grafo</option>
              <option value="h1">T\u00edtulo 1</option>
              <option value="h2">T\u00edtulo 2</option>
              <option value="h3">T\u00edtulo 3</option>
            </select>
            <select className="h-8 rounded border bg-background px-2 text-xs" onChange={(e) => { if (e.target.value) execCmd("fontSize", e.target.value); }} defaultValue="">
              <option value="" disabled>Tamanho</option>
              <option value="1">Pequeno</option>
              <option value="3">Normal</option>
              <option value="4">M\u00e9dio</option>
              <option value="5">Grande</option>
              <option value="6">Muito Grande</option>
            </select>
            <Separator orientation="vertical" className="h-6 mx-1" />
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => setVariablesOpen(true)}>
              <Type className="h-3.5 w-3.5" /> Inserir Vari\u00e1vel
            </Button>
            <div className="flex-1" />
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={onPrint}>
              <Printer className="h-3.5 w-3.5" /> Pr\u00e9-visualizar
            </Button>
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs text-destructive" onClick={onReset}>
              <RotateCcw className="h-3.5 w-3.5" /> {resetLabel || "Restaurar Padr\u00e3o"}
            </Button>
            <Button size="sm" className="h-8 gap-1" onClick={onSave}>
              <Save className="h-3.5 w-3.5" /> Salvar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Variables Dialog */}
      <Dialog open={variablesOpen} onOpenChange={setVariablesOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Type className="h-5 w-5" /> Inserir Vari\u00e1vel</DialogTitle>
            <DialogDescription>Clique em uma vari\u00e1vel para inseri-la na posi\u00e7\u00e3o do cursor.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 mt-2">
            {VARIABLES.map((v) => (
              <button key={v.key} onClick={() => insertVariable(v.key)} className="w-full flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted transition-colors">
                <div>
                  <span className="font-medium">{v.label}</span>
                  <span className="text-xs text-muted-foreground ml-2">Ex: {v.example}</span>
                </div>
                <code className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">{v.key}</code>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

/* ── Component ─────────────────────────────────────── */
const ContractTemplate = () => {
  const { hasPermission } = useAuth();
  const defaultEditorRef = useRef<HTMLDivElement>(null);
  const tenantEditorRef = useRef<HTMLDivElement>(null);

  const [defaultSaved, setDefaultSaved] = useState(true);
  const [tenantSaved, setTenantSaved] = useState(true);
  const [activeTab, setActiveTab] = useState("default");

  // Per-tenant state
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [editingTenantId, setEditingTenantId] = useState<string | null>(null);
  const [customTenantIds, setCustomTenantIds] = useState<string[]>(getCustomTenantIds());

  // Admin-only check
  if (!hasPermission("admin")) {
    return <Navigate to="/" replace />;
  }

  // Fetch tenants from Supabase
  const { data: tenants } = useQuery({
    queryKey: ["tenants-for-template"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tenants").select("id, full_name, cpf").order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const refreshCustomIds = () => setCustomTenantIds(getCustomTenantIds());

  /* ── Default Template Methods ── */
  const loadDefaultTemplate = (): string => {
    try { return localStorage.getItem(TEMPLATE_KEY) || DEFAULT_TEMPLATE; } catch { return DEFAULT_TEMPLATE; }
  };

  const saveDefaultTemplate = () => {
    if (defaultEditorRef.current) {
      localStorage.setItem(TEMPLATE_KEY, defaultEditorRef.current.innerHTML);
      setDefaultSaved(true);
      toast.success("Modelo padr\u00e3o salvo com sucesso!");
    }
  };

  const resetDefaultTemplate = () => {
    if (confirm("Tem certeza que deseja restaurar o modelo padr\u00e3o original? Todas as altera\u00e7\u00f5es ser\u00e3o perdidas.")) {
      localStorage.removeItem(TEMPLATE_KEY);
      if (defaultEditorRef.current) defaultEditorRef.current.innerHTML = DEFAULT_TEMPLATE;
      setDefaultSaved(true);
      toast.success("Modelo restaurado para o padr\u00e3o original!");
    }
  };

  const printDefaultPreview = () => {
    if (!defaultEditorRef.current) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Modelo Padr\u00e3o</title><style>@page{margin:2cm 2.5cm;size:A4}body{font-family:'Times New Roman',Times,serif;font-size:12pt;line-height:1.8;color:#1a1a1a}span[style*="background-color"]{background-color:#fef3c7!important;color:#92400e!important;border:1px dashed #f59e0b;padding:0 2px;border-radius:2px}</style></head><body>${defaultEditorRef.current.innerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  /* ── Per-Tenant Template Methods ── */
  const loadTenantTemplate = (tenantId: string): string => {
    try { return localStorage.getItem(getTenantTemplateKey(tenantId)) || ""; } catch { return ""; }
  };

  const startEditingTenant = (tenantId: string) => {
    // If already editing the same tenant, force reload by toggling off/on
    if (editingTenantId === tenantId) {
      setEditingTenantId(null);
      setTimeout(() => {
        setEditingTenantId(tenantId);
        setTenantSaved(true);
        setTimeout(() => {
          if (tenantEditorRef.current) {
            const existing = loadTenantTemplate(tenantId);
            tenantEditorRef.current.innerHTML = existing || loadDefaultTemplate();
          }
        }, 100);
      }, 50);
      return;
    }
    setEditingTenantId(tenantId);
    setTenantSaved(true);
    // Load after render — use longer delay to ensure ref is mounted
    const loadContent = (attempts = 0) => {
      if (tenantEditorRef.current) {
        const existing = loadTenantTemplate(tenantId);
        tenantEditorRef.current.innerHTML = existing || loadDefaultTemplate();
      } else if (attempts < 10) {
        setTimeout(() => loadContent(attempts + 1), 50);
      }
    };
    setTimeout(() => loadContent(), 50);
  };

  const createNewTenantTemplate = () => {
    if (!selectedTenantId) {
      toast.error("Selecione um inquilino primeiro.");
      return;
    }
    if (customTenantIds.includes(selectedTenantId)) {
      toast.error("Este inquilino j\u00e1 possui um contrato personalizado. Edite o existente.");
      return;
    }
    // Copy from default template
    localStorage.setItem(getTenantTemplateKey(selectedTenantId), loadDefaultTemplate());
    refreshCustomIds();
    startEditingTenant(selectedTenantId);
    toast.success("Contrato personalizado criado a partir do modelo padr\u00e3o!");
  };

  const saveTenantTemplate = () => {
    if (editingTenantId && tenantEditorRef.current) {
      localStorage.setItem(getTenantTemplateKey(editingTenantId), tenantEditorRef.current.innerHTML);
      setTenantSaved(true);
      refreshCustomIds();
      toast.success("Contrato personalizado salvo!");
    }
  };

  const resetTenantToDefault = () => {
    if (editingTenantId && tenantEditorRef.current) {
      if (confirm("Deseja restaurar este contrato para o modelo padr\u00e3o? As altera\u00e7\u00f5es personalizadas ser\u00e3o perdidas.")) {
        tenantEditorRef.current.innerHTML = loadDefaultTemplate();
        setTenantSaved(false);
        toast.info("Conte\u00fado restaurado para o modelo padr\u00e3o. Salve para confirmar.");
      }
    }
  };

  const printTenantPreview = () => {
    if (!tenantEditorRef.current) return;
    const w = window.open("", "_blank");
    if (!w) return;
    const name = tenants?.find((t) => t.id === editingTenantId)?.full_name ?? "";
    w.document.write(`<!DOCTYPE html><html><head><title>Contrato - ${name}</title><style>@page{margin:2cm 2.5cm;size:A4}body{font-family:'Times New Roman',Times,serif;font-size:12pt;line-height:1.8;color:#1a1a1a}span[style*="background-color"]{background-color:#fef3c7!important;color:#92400e!important;border:1px dashed #f59e0b;padding:0 2px;border-radius:2px}</style></head><body>${tenantEditorRef.current.innerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const deleteTenantTemplate = (tenantId: string) => {
    const name = tenants?.find((t) => t.id === tenantId)?.full_name ?? "este inquilino";
    if (confirm(`Excluir o contrato personalizado de "${name}"? O contrato padr\u00e3o ser\u00e1 usado no lugar.`)) {
      localStorage.removeItem(getTenantTemplateKey(tenantId));
      refreshCustomIds();
      if (editingTenantId === tenantId) setEditingTenantId(null);
      toast.success("Contrato personalizado exclu\u00eddo!");
    }
  };

  // Init default editor
  useEffect(() => {
    if (activeTab === "default" && defaultEditorRef.current && defaultEditorRef.current.innerHTML === "") {
      defaultEditorRef.current.innerHTML = loadDefaultTemplate();
    }
  }, [activeTab]);

  const tenantsWithCustom = tenants?.filter((t) => customTenantIds.includes(t.id)) ?? [];
  const tenantsWithoutCustom = tenants?.filter((t) => !customTenantIds.includes(t.id)) ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-8 w-8" /> Modelo de Contrato
          </h1>
          <p className="mt-1 text-muted-foreground">Edite o modelo padr\u00e3o ou crie contratos personalizados por inquilino.</p>
        </div>
      </div>

      {/* Admin badge */}
      <Card className="glass-card bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800">
        <CardContent className="p-3 flex items-center gap-2 text-sm">
          <ShieldAlert className="h-4 w-4 text-red-600 flex-shrink-0" />
          <span className="text-red-700 dark:text-red-400">
            <strong>Acesso Restrito</strong> \u2014 Somente administradores podem editar modelos de contrato.
            Vari\u00e1veis entre <code className="bg-red-100 dark:bg-red-900/30 px-1 rounded text-xs">{"{{...}}"}</code> s\u00e3o substitu\u00eddas automaticamente ao imprimir.
          </span>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="default" className="gap-2"><FileText className="h-4 w-4" /> Modelo Padr\u00e3o</TabsTrigger>
          <TabsTrigger value="per-tenant" className="gap-2"><Users className="h-4 w-4" /> Por Cliente</TabsTrigger>
        </TabsList>

        {/* ── Default Template Tab ── */}
        <TabsContent value="default" className="space-y-4 mt-4">
          <div className="flex items-center gap-2">
            <Badge variant={defaultSaved ? "default" : "destructive"} className="gap-1">
              {defaultSaved ? <><Save className="h-3 w-3" /> Salvo</> : "N\u00e3o salvo"}
            </Badge>
            <span className="text-sm text-muted-foreground">Este \u00e9 o contrato usado para todos os clientes que n\u00e3o possuem um modelo personalizado.</span>
          </div>

          <EditorToolbar
            editorRef={defaultEditorRef}
            onSave={saveDefaultTemplate}
            onReset={resetDefaultTemplate}
            onPrint={printDefaultPreview}
            saved={defaultSaved}
            setSaved={setDefaultSaved}
            resetLabel="Restaurar Original"
          />

          <Card className="glass-card">
            <CardContent className="p-0">
              <div
                ref={defaultEditorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={() => setDefaultSaved(false)}
                className="min-h-[600px] p-8 lg:p-12 outline-none prose prose-sm max-w-none"
                style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: "12pt", lineHeight: 1.8, color: "#1a1a1a", backgroundColor: "white", borderRadius: "0 0 0.5rem 0.5rem" }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Per-Tenant Template Tab ── */}
        <TabsContent value="per-tenant" className="space-y-4 mt-4">
          {/* New custom contract area */}
          <Card className="glass-card">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Plus className="h-4 w-4" /> Criar Contrato Personalizado
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                Selecione um inquilino que ainda n\u00e3o possui contrato personalizado. O modelo padr\u00e3o ser\u00e1 copiado como base.
              </p>
              <div className="flex items-center gap-2">
                <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione o inquilino..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tenantsWithoutCustom.length === 0 ? (
                      <SelectItem value="_none" disabled>Todos os inquilinos j\u00e1 possuem contrato personalizado</SelectItem>
                    ) : (
                      tenantsWithoutCustom.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.full_name} {t.cpf ? `(${t.cpf})` : ""}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button onClick={createNewTenantTemplate} disabled={!selectedTenantId}>
                  <Copy className="mr-2 h-4 w-4" /> Criar a partir do Padr\u00e3o
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* List of tenants with custom templates */}
          <Card className="glass-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Inquilino</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[120px]">A\u00e7\u00f5es</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenantsWithCustom.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        Nenhum contrato personalizado criado. Todos os clientes usam o modelo padr\u00e3o.
                      </TableCell>
                    </TableRow>
                  ) : (
                    tenantsWithCustom.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.full_name}</TableCell>
                        <TableCell className="text-muted-foreground">{t.cpf || "\u2014"}</TableCell>
                        <TableCell><Badge variant="secondary" className="gap-1"><FileText className="h-3 w-3" /> Personalizado</Badge></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEditingTenant(t.id)} title="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteTenantTemplate(t.id)} title="Excluir">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Tenant Editor */}
          {editingTenantId && (
            <div className="space-y-4">
              <Separator />
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Pencil className="h-5 w-5" />
                  Editando contrato de: <span className="text-primary">{tenants?.find((t) => t.id === editingTenantId)?.full_name}</span>
                </h3>
                <Badge variant={tenantSaved ? "default" : "destructive"} className="gap-1">
                  {tenantSaved ? <><Save className="h-3 w-3" /> Salvo</> : "N\u00e3o salvo"}
                </Badge>
                <div className="flex-1" />
                <Button variant="outline" size="sm" onClick={() => setEditingTenantId(null)}>Fechar Editor</Button>
              </div>

              <Card className="glass-card bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800">
                <CardContent className="p-3 flex items-center gap-2 text-sm">
                  <Eye className="h-4 w-4 text-amber-600 flex-shrink-0" />
                  <span className="text-amber-700 dark:text-amber-400">
                    Este contrato personalizado ser\u00e1 usado <strong>apenas</strong> para este inquilino.
                    Os demais clientes continuar\u00e3o usando o modelo padr\u00e3o.
                  </span>
                </CardContent>
              </Card>

              <EditorToolbar
                editorRef={tenantEditorRef}
                onSave={saveTenantTemplate}
                onReset={resetTenantToDefault}
                onPrint={printTenantPreview}
                saved={tenantSaved}
                setSaved={setTenantSaved}
                resetLabel="Restaurar do Padr\u00e3o"
              />

              <Card className="glass-card">
                <CardContent className="p-0">
                  <div
                    ref={tenantEditorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={() => setTenantSaved(false)}
                    className="min-h-[600px] p-8 lg:p-12 outline-none prose prose-sm max-w-none"
                    style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: "12pt", lineHeight: 1.8, color: "#1a1a1a", backgroundColor: "white", borderRadius: "0 0 0.5rem 0.5rem" }}
                  />
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ContractTemplate;

export { DEFAULT_TEMPLATE, TEMPLATE_KEY, TENANT_TEMPLATE_PREFIX, getTenantTemplateKey, VARIABLES };
