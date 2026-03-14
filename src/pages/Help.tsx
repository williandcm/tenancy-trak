import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  LayoutDashboard, DoorOpen, Users, UserCheck, FileText,
  CreditCard, Zap, Bell, Shield, Search, BookOpen,
  CheckCircle2, ArrowRight, AlertTriangle, Lightbulb,
  Receipt, Printer, BarChart3, Landmark, TrendingUp, Download,
} from "lucide-react";

/* ── Section data ──────────────────────────────────── */
interface DocSection {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
  steps: {
    title: string;
    content: string;
    tips?: string[];
  }[];
}

const sections: DocSection[] = [
  {
    id: "dashboard",
    icon: LayoutDashboard,
    title: "Dashboard",
    description: "Visão geral do sistema com indicadores e resumos.",
    color: "bg-blue-100 dark:bg-blue-900/30 text-blue-600",
    steps: [
      {
        title: "O que é o Dashboard?",
        content: "O Dashboard é a tela inicial do LocaGest. Ele apresenta um resumo geral com os principais indicadores do seu negócio: total de unidades, unidades ocupadas, contratos ativos, receita recebida, valores pendentes e valores em atraso.",
      },
      {
        title: "Indicadores disponíveis",
        content: "Os cards no topo mostram 8 indicadores: número de unidades cadastradas, unidades atualmente ocupadas, contratos com status ativo, receita mensal esperada (contratos ativos), pagamentos atrasados (quantidade e valor), taxa de inadimplência (%), total recebido no ano corrente e número de inquilinos cadastrados.",
        tips: [
          "Os valores são atualizados automaticamente conforme você registra pagamentos.",
          "A taxa de inadimplência é calculada como: valor atrasado ÷ total vencido × 100.",
          "Clique nos menus laterais para navegar às páginas de cada módulo.",
        ],
      },
      {
        title: "Gráficos e resumos",
        content: "A parte inferior do Dashboard contém gráfico de receita mensal (últimos 6 meses — recebido vs esperado), gráfico de ocupação (pizza), cards de consumos do mês (energia + água), resumo de IPTU do ano, ações rápidas para as principais tarefas, pagamentos atrasados, contratos próximos ao vencimento, mapa do imóvel e cards detalhados de cada unidade.",
        tips: [
          "A seção 'Ações Rápidas' oferece atalhos diretos para: Registrar Pagamento, Nova Conta de Consumo, Novo Contrato, Relatórios Financeiros e Gerar Alertas.",
          "O card de IPTU mostra o valor total, número de parcelas e desconto do inquilino.",
          "Os consumos do mês mostram os totais de Energia e Água do mês corrente.",
        ],
      },
    ],
  },
  {
    id: "units",
    icon: DoorOpen,
    title: "Unidades",
    description: "Cadastro e gestão das unidades/salas comerciais.",
    color: "bg-purple-100 dark:bg-purple-900/30 text-purple-600",
    steps: [
      {
        title: "Cadastrar nova unidade",
        content: "1. Clique no botão \"Nova Unidade\" no canto superior direito.\n2. Preencha os campos: Nome (ex: Sala 1), Número do endereço, Andar, Área (m²), Descrição, Ligação de Energia e Ligação de Água.\n3. Clique em \"Criar Unidade\" para salvar.",
        tips: [
          "O campo 'Ligação de Energia' e 'Ligação de Água' define qual medidor compartilhado a unidade usa (ex: 422A, 422B).",
          "Salas que compartilham o mesmo medidor terão o consumo dividido igualmente.",
        ],
      },
      {
        title: "Editar uma unidade",
        content: "1. Na tabela de unidades, clique no menu de ações (⋮) ao lado da unidade desejada.\n2. Selecione \"Editar\".\n3. Altere os campos necessários e clique em \"Salvar\".",
      },
      {
        title: "Visualizar detalhes",
        content: "Clique em \"Ver Detalhes\" no menu de ações para abrir uma janela com todas as informações da unidade, incluindo consumo de energia e água, com detalhes de rateio quando aplicável.",
        tips: [
          "Para unidades com medidor compartilhado (ex: 422A), o consumo total é dividido igualmente entre as salas.",
          "O tooltip no card de consumo mostra a fórmula do rateio.",
        ],
      },
      {
        title: "Excluir uma unidade",
        content: "No menu de ações, selecione \"Excluir\". Confirme a exclusão na janela de confirmação. ATENÇÃO: esta ação não pode ser desfeita.",
      },
    ],
  },
  {
    id: "tenants",
    icon: Users,
    title: "Inquilinos",
    description: "Cadastro e gestão dos inquilinos/locatários.",
    color: "bg-green-100 dark:bg-green-900/30 text-green-600",
    steps: [
      {
        title: "Cadastrar novo inquilino",
        content: "1. Clique em \"Novo Inquilino\".\n2. Preencha os dados pessoais: Nome Completo, Nacionalidade, Estado Civil, RG, Órgão Emissor, CPF.\n3. Preencha o endereço: CEP (preenchimento automático), Endereço, Número, Bairro, Complemento, Cidade, Estado.\n4. Preencha os dados de contato: Telefone e E-mail.\n5. Clique em \"Cadastrar Inquilino\".",
        tips: [
          "Todos os campos com * são obrigatórios.",
          "O CPF deve ser único — não é possível cadastrar dois inquilinos com o mesmo CPF.",
          "Ao digitar o CEP, o endereço, bairro, cidade e estado são preenchidos automaticamente.",
          "CPF, RG, Telefone e CEP possuem máscaras de formatação automáticas.",
        ],
      },
      {
        title: "Status do inquilino",
        content: "Na tabela, cada inquilino exibe um status:\n• Ativo (verde) — Possui contrato ativo.\n• Aguardando Aprovação (amarelo) — Solicitou contrato, aguardando aprovação do administrador.\n• Sem Contrato (cinza) — Não possui nenhum contrato vinculado.",
      },
      {
        title: "Solicitar contrato para inquilino",
        content: "1. Na tabela, localize um inquilino com status \"Sem Contrato\".\n2. Clique no ícone de documento (📄) na coluna de ações.\n3. Ou abra os dados do inquilino (ícone 👁️) e clique no botão \"Solicitar Contrato\".\n4. Preencha os dados do contrato: Unidade, Locador, Datas, Valores.\n5. Clique em \"Solicitar Contrato\".\n6. O contrato ficará com status \"Aguardando Aprovação\" até o administrador aprovar.",
        tips: [
          "O botão de solicitar contrato só aparece para inquilinos sem contrato ativo e sem solicitação pendente.",
          "O inquilino já vem pré-selecionado no formulário.",
          "O administrador pode editar os valores antes de aprovar.",
        ],
      },
      {
        title: "Editar inquilino",
        content: "Clique no ícone de lápis (✏️) ao lado do inquilino ou abra os dados e clique em \"Editar\". Altere os dados e salve.",
      },
      {
        title: "Buscar inquilino",
        content: "Use a barra de busca no topo para pesquisar por nome, CPF, telefone ou e-mail. A busca é feita em tempo real.",
      },
      {
        title: "Exportar inquilinos (CSV)",
        content: "Clique no botão \"CSV\" ao lado de \"Novo Inquilino\" para exportar a lista de inquilinos filtrada em formato CSV compatível com Excel, incluindo: Nome, CPF, RG, Telefone, Email, Endereço, Cidade, Estado e Status.",
      },
    ],
  },
  {
    id: "landlords",
    icon: UserCheck,
    title: "Locadores",
    description: "Cadastro dos proprietários dos imóveis.",
    color: "bg-orange-100 dark:bg-orange-900/30 text-orange-600",
    steps: [
      {
        title: "Cadastrar novo locador",
        content: "1. Clique em \"Novo Locador\".\n2. Preencha: Nome Completo, Nacionalidade, Estado Civil, RG, Órgão Emissor, CPF.\n3. Preencha o endereço completo.\n4. Clique em \"Criar Locador\".",
        tips: [
          "Locadores são vinculados aos contratos. Um contrato pode ter até dois locadores.",
          "Para desativar um locador sem excluí-lo, use o switch 'Ativo'.",
        ],
      },
      {
        title: "Editar / Desativar",
        content: "Use o menu de ações para editar ou excluir. Para desativar temporariamente, edite o locador e desmarque o campo 'Ativo'.",
      },
    ],
  },
  {
    id: "contracts",
    icon: FileText,
    title: "Contratos",
    description: "Criação, solicitação e aprovação de contratos de locação.",
    color: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600",
    steps: [
      {
        title: "Criar novo contrato",
        content: "1. Clique em \"Novo Contrato\".\n2. Selecione a Unidade, o Inquilino e o Locador (e opcionalmente um segundo locador).\n3. Defina as datas: Início, Fim.\n4. Defina os valores: Aluguel Mensal, Dia do Pagamento, Multa Diária (%), Multa Máxima (%), Meses de Caução.\n5. Preencha o objetivo da locação e o foro.\n6. Defina o status: Ativo, Pendente, Expirado ou Rescindido.\n7. Clique em \"Criar Contrato\".",
        tips: [
          "Todos os campos obrigatórios são validados. Se algum estiver vazio, o sistema destaca em vermelho e foca automaticamente no primeiro campo faltante.",
          "O status 'Pendente' significa que o contrato foi criado mas ainda não iniciou vigência.",
          "O status 'Ativo' indica contrato em vigor.",
          "A multa diária é aplicada automaticamente nos pagamentos em atraso.",
          "IMPORTANTE: Para que o contrato apareça na página de Pagamentos, o status deve ser 'Ativo' ou 'Pendente'.",
        ],
      },
      {
        title: "Solicitar contrato (a partir de Inquilinos)",
        content: "1. Na página de Inquilinos, localize um inquilino com status \"Sem Contrato\".\n2. Clique no ícone de documento (📄) na coluna de ações, ou abra os dados do inquilino e clique em \"Solicitar Contrato\".\n3. O formulário de contrato será aberto com o inquilino já pré-selecionado.\n4. Preencha a unidade, locador, datas e valores.\n5. Clique em \"Solicitar Contrato\".\n6. O contrato será criado com status \"Aguardando Aprovação\".",
        tips: [
          "Apenas inquilinos sem contrato ativo e sem solicitação pendente podem solicitar um novo contrato.",
          "Após a solicitação, o status do inquilino muda para \"Aguardando Aprovação\" (amarelo).",
          "O contrato só entra em vigor após a aprovação do administrador.",
        ],
      },
      {
        title: "Aprovar ou recusar contrato (Administrador)",
        content: "1. Na página de Contratos, localize contratos com badge \"Aguardando Aprovação\" (amarelo).\n2. Clique no menu de ações (⋮) e selecione \"Aprovar\" ou \"Recusar\".\n3. Ou clique no contrato para visualizar os detalhes e use os botões \"Aprovar\" (verde) ou \"Recusar\" (vermelho).\n4. Um diálogo de confirmação será exibido com os dados do contrato.\n5. Confirme a ação.\n\n• Aprovar: O contrato muda para \"Ativo\" e a unidade fica como \"Ocupada\".\n• Recusar: A solicitação é removida permanentemente.",
        tips: [
          "Apenas usuários com perfil Administrador podem aprovar ou recusar contratos.",
          "Antes de aprovar, você pode clicar em \"Editar\" para modificar valores, cláusulas ou observações do contrato.",
          "Ao aprovar, a unidade é automaticamente marcada como ocupada.",
          "Ao recusar, o inquilino volta ao status \"Sem Contrato\".",
        ],
      },
      {
        title: "Editar contrato antes da aprovação",
        content: "Contratos com status \"Aguardando Aprovação\" podem ser editados antes de aprovar. O administrador pode:\n• Alterar valores (aluguel, depósito, multas)\n• Modificar datas\n• Acrescentar ou modificar cláusulas nas observações\n• Trocar a unidade ou locador\n\nApós as alterações, clique em \"Salvar Alterações\" e depois aprove o contrato.",
      },
      {
        title: "Visualizar contrato",
        content: "Clique na linha do contrato na tabela ou em \"Visualizar\" no menu de ações para abrir o detalhamento completo com todas as informações.",
      },
      {
        title: "Imprimir contrato",
        content: "Clique em \"Imprimir\" no menu de ações. Uma janela abrirá com o contrato formatado para impressão em A4. O navegador exibirá a opção de imprimir ou salvar como PDF.",
        tips: [
          "O contrato impresso inclui todas as cláusulas, dados do locador, locatário e detalhes da unidade.",
          "Recomendamos salvar como PDF para arquivo digital.",
        ],
      },
      {
        title: "Status do contrato",
        content: "Os contratos possuem 5 status:\n• Ativo (verde) — Contrato em vigor, parcelas podem ser geradas.\n• Pendente — Contrato criado, aguardando ativação.\n• Aguardando Aprovação (amarelo) — Solicitado por um operador, aguarda aprovação do administrador.\n• Expirado — Contrato com prazo encerrado.\n• Rescindido (vermelho) — Contrato cancelado antes do prazo.",
      },
      {
        title: "Reajuste de aluguel",
        content: "1. Na página de Contratos, clique no botão \"Reajuste\" no canto superior direito.\n2. Informe o percentual de reajuste (consulte o IGP-M ou IPCA acumulado dos últimos 12 meses).\n3. Defina a data do reajuste.\n4. Escolha o modo: \"Mesmo % para todos\" ou \"% individual\" (para definir um percentual diferente por contrato).\n5. Selecione os contratos que receberão o reajuste (ou \"Selecionar Todos\").\n6. Confira a prévia com valor atual, novo valor e diferença.\n7. Clique em \"Aplicar Reajuste\".",
        tips: [
          "O percentual de reajuste pode ser consultado em sites como Banco Central (IGP-M) ou IBGE (IPCA).",
          "No modo 'individual', cada contrato pode ter um percentual diferente.",
          "O sistema mostra a coluna 'Meses' indicando há quantos meses o contrato não recebe reajuste.",
          "Contratos com mais de 12 meses sem reajuste são destacados em vermelho.",
          "O reajuste atualiza o valor do aluguel no contrato E na unidade vinculada.",
          "A prévia mostra o resumo: valor atual total → novo valor total → diferença mensal.",
        ],
      },
    ],
  },
  {
    id: "payments",
    icon: CreditCard,
    title: "Pagamentos",
    description: "Controle de recebimentos de aluguéis.",
    color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600",
    steps: [
      {
        title: "Gerar parcelas automáticas",
        content: "1. Clique em \"Gerar Parcelas\".\n2. Selecione o contrato desejado (apenas contratos Ativos ou Pendentes são exibidos).\n3. Defina o número de parcelas (ex: 12 para 1 ano).\n4. Clique em \"Gerar Parcelas\".\n\nO sistema criará automaticamente todas as parcelas com base no valor do aluguel e no dia de pagamento definido no contrato.",
        tips: [
          "As parcelas são geradas a partir da data de início do contrato.",
          "O valor de cada parcela é o aluguel mensal definido no contrato.",
          "Você pode gerar parcelas a qualquer momento para estender o período.",
        ],
      },
      {
        title: "Registrar pagamento individual",
        content: "1. Clique em \"Novo Pagamento\".\n2. Selecione o contrato.\n3. Informe o valor e a data de vencimento.\n4. Opcionalmente adicione observações.\n5. Clique em \"Registrar\".",
      },
      {
        title: "Confirmar recebimento",
        content: "1. Na tabela de pagamentos, localize a parcela pendente.\n2. Clique no menu de ações (⋮) e selecione \"Confirmar Pagamento\".\n3. Informe a data do pagamento, multa/juros (se aplicável) e observações.\n4. Clique em \"Confirmar Pagamento\".",
        tips: [
          "Se o pagamento estiver em atraso, o sistema calcula automaticamente a multa com base no percentual definido no contrato.",
          "O valor da multa pode ser ajustado manualmente antes de confirmar.",
        ],
      },
      {
        title: "Estornar pagamento",
        content: "Se um pagamento foi confirmado por engano, clique em \"Estornar\" no menu de ações. O pagamento voltará ao status 'Pendente'.",
      },
      {
        title: "Imprimir recibo",
        content: "Clique em \"Recibo\" no menu de ações para gerar um recibo imprimível com todos os dados do pagamento, incluindo multa e valor total.",
      },
      {
        title: "Filtros e busca",
        content: "Use os botões de filtro (Todos, Pendentes, Pagos, Atrasados) para visualizar apenas os pagamentos desejados. A barra de busca permite pesquisar por nome do inquilino ou unidade.",
      },
      {
        title: "Exportar pagamentos (CSV)",
        content: "Clique em \"Exportar CSV\" no topo da página. O sistema exportará todos os pagamentos filtrados (conforme o filtro ativo) em formato CSV compatível com Excel, incluindo: Inquilino, Unidade, Vencimento, Valor, Multa, Data do Pagamento, Status e Observações.",
        tips: [
          "O arquivo CSV usa ponto-e-vírgula (;) como separador, compatível com Excel em português.",
          "Aplique filtros antes de exportar para gerar um relatório específico (ex: apenas atrasados).",
        ],
      },
    ],
  },
  {
    id: "utilities",
    icon: Zap,
    title: "Consumos & Contas",
    description: "Cobranças consolidadas por sala (Energia + Água + IPTU) com lançamento de contas e confirmação de pagamento. Operações restritas a administradores.",
    color: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600",
    steps: [
      {
        title: "Permissões — Apenas administradores",
        content: "Todas as operações de lançamento, edição, exclusão e confirmação de pagamento são restritas a usuários com perfil Administrador.\n\nUsuários com outros perfis (Gerente, Operador, Visualizador) podem visualizar todas as informações e imprimir boletos, mas não podem modificar dados.\n\nUm aviso amarelo aparece no topo da página para usuários sem permissão de edição.",
        tips: [
          "Os botões \"Lançar Conta\", \"IPTU\", \"Confirmar\", \"Editar\" e \"Excluir\" ficam ocultos para não-administradores.",
          "A impressão de boletos e visualização de dados está disponível para todos os perfis.",
        ],
      },
      {
        title: "Cobranças — Visão consolidada por sala",
        content: "A página mostra todas as cobranças do mês em uma tabela única, reunindo Energia, Água e IPTU por sala.\n\n1. Selecione o mês de referência no seletor de data.\n2. Os 4 cards coloridos no topo mostram os totais de Energia (amarelo), Água (azul), IPTU (roxo) e Total Geral (verde), com indicação de valores pagos e pendentes.\n3. A tabela exibe todas as unidades com colunas para cada tipo de cobrança, total, status e impressão.\n4. Confirme pagamento de cada item individualmente (somente admin).\n5. Uma linha de totais aparece ao final da tabela.\n6. Use \"Imprimir Todos\" para gerar boletos de todas as salas com pendências.\n7. Use \"IPTU\" para lançar cobranças de IPTU com valores preenchidos automaticamente.",
        tips: [
          "O IPTU aparece automaticamente quando houver parcela cadastrada para aquele mês.",
          "Os 4 cards de resumo com gradiente colorido facilitam a visualização rápida dos totais.",
          "As linhas das salas com tudo pago ficam com fundo verde suave e status 'Quitado'.",
          "O boleto consolidado reúne todos os itens em um único documento para impressão.",
          "O botão \"IPTU\" abre um diálogo com valores preenchidos automaticamente do cadastro de IPTU — basta escolher à vista ou parcelado por unidade.",
        ],
      },
      {
        title: "Lançar Cobrança de IPTU",
        content: "1. Clique em \"IPTU\" na barra de controles.\n2. Selecione o registro de IPTU (ano) desejado.\n3. Os valores de cada unidade são preenchidos automaticamente (IPTU por m², taxa do lixo, total parcelado e à vista).\n4. Para cada unidade, alterne entre \"Parcelado\" e \"À Vista\" usando o switch.\n5. Use os botões \"Todas Parcelado\" ou \"Todas À Vista\" para definir todas de uma vez.\n6. Veja o resumo com total a cobrar e economia.\n7. Clique em \"Lançar Cobrança\" para gerar as contas automaticamente.\n\nAs cobranças são geradas como contas de IPTU e aparecem na tabela de cobranças do mês correspondente.",
        tips: [
          "Unidades à vista recebem uma única cobrança com o valor com desconto.",
          "Unidades parceladas recebem uma cobrança por parcela, uma em cada mês.",
          "A economia total é calculada automaticamente para unidades à vista.",
          "Você pode alterar a modalidade a qualquer momento — as cobranças são atualizadas automaticamente.",
          "O registro de IPTU do ano corrente é selecionado automaticamente.",
        ],
      },
      {
        title: "Lançar Conta de energia ou água",
        content: "1. Clique em \"Lançar Conta\" na barra de controles (somente admin).\n2. Selecione o tipo: Energia ou Água.\n3. Selecione a ligação: 422A (4 Salas) ou 422B (Fundo).\n4. Informe o mês de referência, valor total da conta e data de vencimento.\n5. O sistema exibirá a prévia do rateio automaticamente.\n6. Clique em \"Lançar Conta\".\n\nA conta aparecerá na tabela de cobranças e na seção \"Lançamentos do Mês\" abaixo da tabela.",
        tips: [
          "A ligação 422 (Salão) não aparece pois a conta está no nome do inquilino.",
          "Para a ligação 422A, o valor é dividido igualmente entre as 4 salas.",
          "Para a ligação 422B, o valor integral vai para a Sala Fundo.",
          "A prévia do rateio aparece em tempo real conforme você digita o valor.",
          "Contas de IPTU são lançadas automaticamente pelo botão \"IPTU\" — aparecem com ícone roxo e valores individuais por sala.",
          "Contas de IPTU não podem ser editadas ou excluídas diretamente — gerencie pelo menu IPTU.",
        ],
      },
      {
        title: "Lançamentos do Mês — Editar e excluir contas",
        content: "Abaixo da tabela de cobranças, a seção \"Lançamentos do Mês\" exibe cada conta lançada como um card individual.\n\nAdministradores podem:\n- Clicar no ícone de lápis (✏️) para editar o valor, vencimento ou observações.\n- Clicar no ícone de lixeira (�️) para excluir a conta.\n- Confirmar pagamento de cada sala individualmente.\n\nContas de IPTU possuem os botões de edição e exclusão desabilitados — devem ser gerenciadas pelo diálogo de IPTU.",
      },
      {
        title: "Confirmar pagamento por sala",
        content: "Na tabela de cobranças, cada célula de valor possui um botão \"Confirmar\" (somente admin). Clique para marcar como pago. A data do pagamento é registrada automaticamente. Para desfazer, clique em \"✓ Pago\" novamente.\n\nNa seção de Lançamentos, cada sala também possui um botão de confirmação individual.\n\nUsuários sem perfil admin veem apenas badges de status (\"Pago\" ou \"Pendente\") em vez dos botões de ação.",
      },
      {
        title: "Imprimir boleto por sala",
        content: "Clique no ícone de impressora (🖨️) na tabela de cobranças para gerar um boleto consolidado (Energia + Água + IPTU) da sala. Na seção de Lançamentos, cada sala tem seu próprio botão de impressão para gerar um recibo individual da conta.",
      },
    ],
  },
  {
    id: "notifications",
    icon: Bell,
    title: "Alertas / Notificações",
    description: "Gerenciamento de alertas e avisos do sistema.",
    color: "bg-red-100 dark:bg-red-900/30 text-red-600",
    steps: [
      {
        title: "Criar novo alerta",
        content: "1. Clique em \"Novo Alerta\".\n2. Preencha o título e a mensagem.\n3. Selecione o tipo: Informação, Aviso, Urgente ou Sucesso.\n4. Defina a prioridade: Baixa, Normal, Alta ou Urgente.\n5. Opcionalmente vincule a um inquilino ou unidade.\n6. Clique em \"Criar Alerta\".",
        tips: [
          "Use alertas para registrar lembretes de manutenção, comunicados a inquilinos, etc.",
          "Alertas podem ser filtrados por tipo e status (lido/não lido).",
        ],
      },
      {
        title: "Marcar como lido",
        content: "Clique em \"Marcar como lido\" no alerta ou use o menu de ações. Alertas lidos ficam com visual mais suave.",
      },
      {
        title: "Excluir alerta",
        content: "No menu de ações, selecione \"Excluir\" e confirme. Alertas excluídos não podem ser recuperados.",
      },
    ],
  },
  {
    id: "iptu",
    icon: Landmark,
    title: "IPTU",
    description: "IPTU rateado por m² (usando Área Base do carnê) + Taxa do Lixo dividida igualmente, com opção de pagamento à vista ou parcelado e desconto configurável.",
    color: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600",
    steps: [
      {
        title: "Cadastrar IPTU anual",
        content: "1. Clique em \"Novo IPTU\".\n2. Informe o ano, o valor do IPTU, a taxa do lixo, o valor à vista do carnê, a Área Base (m² do carnê/boleto), o desconto % para o inquilino, o número de parcelas e a data do 1º vencimento.\n3. Veja a prévia do rateio com ambas modalidades no formulário.\n4. Clique em \"Cadastrar IPTU\".",
        tips: [
          "O IPTU é rateado proporcionalmente por m². Fórmula: IPTU/m² = Valor IPTU ÷ Área Base.",
          "A Área Base é a metragem informada no carnê/boleto do IPTU. Pode ser diferente da soma das áreas das unidades cadastradas.",
          "Se a Área Base não for informada, o sistema usa a soma das áreas das unidades como padrão.",
          "A Taxa do Lixo é dividida igualmente entre todas as salas (÷ número de unidades).",
          "O total parcelado por unidade = (IPTU rateado por m²) + (Taxa Lixo ÷ nº salas).",
          "O desconto para inquilino (%) é aplicado sobre o valor à vista rateado quando ele opta por pagar à vista. O padrão é 5%.",
          "As parcelas são geradas automaticamente com vencimentos mensais a partir da data informada.",
          "Ao cadastrar ou editar, as parcelas são lançadas automaticamente na tela de Consumos & Contas.",
          "Todas as unidades cadastradas participam do rateio, independente do status de ocupação.",
        ],
      },
      {
        title: "Escolher modalidade por unidade",
        content: "Existem duas formas de escolher a modalidade de pagamento:\n\n**Opção 1 — Lançar Cobrança IPTU (recomendado):**\nNa tela de Consumos & Contas, clique em \"Lançar IPTU\". O diálogo mostra todos os valores preenchidos automaticamente. Basta alternar o switch de cada unidade entre Parcelado e À Vista, e clicar em \"Lançar Cobrança\".\n\n**Opção 2 — Detalhes do IPTU:**\nEm \"Ver Detalhes\" na tela de IPTU, cada unidade possui um seletor para escolher entre \"Parcelado\" e \"À Vista\".",
        tips: [
          "A modalidade pode ser alterada a qualquer momento — basta usar o \"Lançar IPTU\" novamente.",
          "Ao escolher \"À Vista\", o valor exibido já considera o desconto configurado.",
          "A economia (diferença entre parcelado e à vista) é exibida em destaque.",
          "Cada unidade mostra a composição do valor: IPTU (por m²) + Taxa do Lixo (igual para todos).",
          "Os botões \"Todas Parcelado\" e \"Todas À Vista\" permitem definir a modalidade de todas as unidades de uma vez.",
        ],
      },
      {
        title: "Controlar pagamentos por unidade",
        content: "No modo \"Parcelado\", cada unidade mostra suas parcelas com status (Pendente, Pago, Atrasado). Use o switch para marcar/desmarcar. No modo \"À Vista\", use o switch único para confirmar o pagamento integral.",
        tips: [
          "Parcelas atrasadas são destacadas em vermelho automaticamente.",
          "A data de pagamento é registrada ao marcar como pago.",
          "O progresso (barra verde) mostra a porcentagem de unidades quitadas.",
        ],
      },
      {
        title: "Imprimir rateio",
        content: "No menu de ações ou na tela de detalhes, clique em \"Imprimir Rateio\" para gerar um relatório com IPTU por m², taxa do lixo, modalidade, valor cobrado e economia de cada unidade.",
      },
      {
        title: "Editar ou excluir IPTU",
        content: "No menu de ações, selecione \"Editar\" para alterar valores ou \"Excluir\" para remover o registro. Ao editar, os status de pagamento e a modalidade escolhida por cada unidade são preservados.",
      },
      {
        title: "Integração automática com Consumos & Contas",
        content: "Ao cadastrar um IPTU, as parcelas são lançadas automaticamente como contas na tela de Consumos & Contas, com os valores individuais de cada sala já preenchidos.",
        tips: [
          "As contas de IPTU aparecem com ícone e cor diferenciados (roxo) na lista de contas.",
          "Os valores já vêm calculados por m² — não são divididos igualmente como energia e água.",
          "O status de pagamento é sincronizado: marcar como pago no IPTU atualiza a conta, e vice-versa.",
          "Contas de IPTU não podem ser editadas ou excluídas pela tela de Contas — gerencie pelo menu IPTU.",
          "Ao excluir um IPTU, todas as contas correspondentes são removidas automaticamente.",
        ],
      },
    ],
  },
  {
    id: "reports",
    icon: BarChart3,
    title: "Relatórios Financeiros",
    description: "Análise consolidada de receitas, despesas e inadimplência com gráficos, tabelas e exportação.",
    color: "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600",
    steps: [
      {
        title: "Acessar os relatórios",
        content: "Clique em \"Relatórios\" no menu lateral (ícone de gráfico). A página oferece 3 abas: Resumo Anual, Por Unidade e Detalhamento Mensal.",
        tips: [
          "Use o seletor de ano no topo para navegar entre anos.",
          "Use o filtro de unidade para ver dados específicos de uma sala.",
        ],
      },
      {
        title: "Resumo Anual",
        content: "A aba principal mostra:\n• Gráfico de Receita Mensal — Aluguéis + Consumos empilhados.\n• Gráfico de Composição — Pizza mostrando a proporção entre Aluguéis, Energia, Água e IPTU.\n• Gráfico de Consumos Mensais — Barras com Energia, Água e IPTU por mês.\n• Evolução da Inadimplência — Linha mostrando a taxa de inadimplência ao longo do ano.",
      },
      {
        title: "Por Unidade",
        content: "Tabela detalhada com cada unidade mostrando: Área, Aluguel/Mês, Esperado no Ano, Recebido, Atrasado, Consumos e Taxa de Inadimplência. Inclui gráfico comparativo de barras.",
        tips: [
          "A linha de TOTAL no rodapé consolida todos os valores.",
          "Unidades com inadimplência acima de 10% são destacadas em vermelho.",
          "Use \"Exportar CSV\" para baixar esta tabela.",
        ],
      },
      {
        title: "Detalhamento Mensal",
        content: "Tabela mês a mês com: Aluguel Esperado, Recebido, Atrasado, Pendente, Energia, Água, IPTU, Total Consumos e Receita Total (aluguel recebido + consumos).",
      },
      {
        title: "Exportar e imprimir",
        content: "• CSV Mensal: Exporta a tabela mensal em formato CSV.\n• Exportar CSV (aba Por Unidade): Exporta o resumo por unidade.\n• Imprimir: Gera um relatório completo em PDF/impressão com resumo + tabelas.",
        tips: [
          "O relatório impresso inclui cabeçalho \"LocaGest — Relatório Financeiro\" com data de geração.",
          "Os CSVs usam ponto-e-vírgula (;) como separador, compatível com Excel em português.",
          "Os 5 cards KPI no topo mostram: Aluguel Esperado, Recebido, Atrasado, Consumos e Inadimplência.",
        ],
      },
    ],
  },
  {
    id: "users",
    icon: Shield,
    title: "Usuários",
    description: "Gerenciamento de usuários e permissões do sistema.",
    color: "bg-slate-100 dark:bg-slate-900/30 text-slate-600",
    steps: [
      {
        title: "Criar novo usuário",
        content: "1. Clique em \"Novo Usuário\".\n2. Preencha: Nome Completo, E-mail e Senha.\n3. Selecione o perfil de acesso: Administrador, Gerente, Operador ou Visualizador.\n4. Clique em \"Criar Usuário\".",
        tips: [
          "Administrador: Acesso total, pode gerenciar outros usuários.",
          "Gerente: Gerencia contratos, pagamentos, inquilinos e locadores.",
          "Operador: Registra pagamentos.",
          "Visualizador: Apenas visualiza informações, sem poder de edição.",
        ],
      },
      {
        title: "Alterar perfil de acesso",
        content: "Edite o usuário e altere o campo 'Perfil'. As permissões são aplicadas imediatamente.",
      },
      {
        title: "Alterar e-mail de login",
        content: "Somente administradores podem alterar o e-mail de login de um usuário. Edite o usuário, altere o campo 'E-mail' e salve. A alteração é aplicada imediatamente tanto no login quanto no perfil.",
        tips: [
          "Usuários não-administradores verão o campo de e-mail desabilitado durante a edição.",
          "O novo e-mail já pode ser usado para login imediatamente após a alteração.",
        ],
      },
      {
        title: "Redefinir senha",
        content: "No menu de ações, selecione \"Redefinir Senha\". Digite a nova senha e confirme.",
      },
      {
        title: "Ativar / Desativar usuário",
        content: "Edite o usuário e altere o switch 'Ativo'. Usuários desativados não conseguem acessar o sistema.",
      },
    ],
  },
];

/* ── FAQ ───────────────────────────────────────────── */
const faqItems = [
  {
    q: "Como solicitar um contrato para um inquilino?",
    a: "Na página de Inquilinos, localize o inquilino com status \"Sem Contrato\" e clique no ícone de documento (📄) na coluna de ações. Preencha os dados do contrato e clique em \"Solicitar Contrato\". O contrato ficará aguardando aprovação do administrador.",
  },
  {
    q: "Quem pode aprovar ou recusar um contrato?",
    a: "Apenas usuários com perfil \"Administrador\" podem aprovar ou recusar solicitações de contrato. Os botões de aprovação e recusa só são visíveis para administradores. Outros perfis podem visualizar contratos aguardando aprovação, mas não podem alterá-los.",
  },
  {
    q: "Posso editar um contrato antes de aprová-lo?",
    a: "Sim! Contratos com status \"Aguardando Aprovação\" podem ser editados pelo administrador antes da aprovação. Você pode alterar valores, datas, adicionar cláusulas nas observações, trocar unidade ou locador. Após editar, aprove o contrato normalmente.",
  },
  {
    q: "O que acontece quando um contrato é aprovado?",
    a: "Ao aprovar, o contrato muda automaticamente para status \"Ativo\", a unidade vinculada é marcada como \"Ocupada\" e o inquilino passa a ter status \"Ativo\" (verde). A partir daí, parcelas de pagamento podem ser geradas.",
  },
  {
    q: "O que acontece quando um contrato é recusado?",
    a: "Ao recusar, a solicitação é removida permanentemente. O inquilino volta ao status \"Sem Contrato\" e a unidade permanece \"Disponível\". Uma nova solicitação poderá ser feita a qualquer momento.",
  },
  {
    q: "Como alterar o e-mail de login de um usuário?",
    a: "Somente administradores podem alterar o e-mail de login. Vá em Usuários, clique em Editar no usuário desejado, altere o campo \"E-mail\" e salve. O novo e-mail já pode ser usado para login imediatamente. Usuários não-administradores verão o campo de e-mail desabilitado.",
  },
  {
    q: "Como funciona o rateio de IPTU?",
    a: "O valor do IPTU é dividido proporcionalmente pela área (m²) de cada unidade, usando como divisor a Área Base informada no carnê/boleto (que pode diferir da soma das áreas das unidades). Fórmula: IPTU por sala = (IPTU total ÷ Área Base) × m² da sala. A taxa do lixo é dividida igualmente entre todas as salas. O total parcelado = (IPTU por m²) + (Taxa Lixo ÷ nº salas). Para quem paga à vista, aplica-se o desconto configurado sobre o valor à vista rateado.",
  },
  {
    q: "Como cadastrar e controlar o IPTU?",
    a: "Vá em IPTU → clique em \"Novo IPTU\" → informe o ano, valor do IPTU, taxa do lixo, valor à vista do carnê, Área Base (m² do carnê), desconto para inquilino (%), número de parcelas e data do 1º vencimento. O sistema calcula o rateio automaticamente usando a Área Base como divisor. Em \"Ver Detalhes\", selecione a modalidade (À Vista ou Parcelado) para cada unidade e use o switch para confirmar pagamentos.",
  },
  {
    q: "Como a taxa do lixo é cobrada?",
    a: "A taxa do lixo é dividida igualmente entre todas as unidades, independente da área. Exemplo: se a taxa total é R$ 600 e há 6 salas, cada sala paga R$ 100 de taxa do lixo. Esse valor é somado ao IPTU rateado por m² para compor o total de cada unidade.",
  },
  {
    q: "O que é o desconto para inquilino?",
    a: "É o percentual de desconto aplicado ao valor à vista rateado quando o inquilino opta por pagar à vista. O padrão é 5% (como no carnê da prefeitura). Exemplo: se o desconto é 5% e o valor à vista rateado é R$ 1.000, o inquilino paga R$ 950. Esse desconto é configurável ao cadastrar o IPTU e pode variar a cada ano.",
  },
  {
    q: "Os dados de IPTU são salvos onde?",
    a: "Os dados de IPTU são salvos localmente no navegador (localStorage). Recomendamos não limpar os dados do navegador para manter o histórico. Use a função \"Imprimir Rateio\" para manter registros físicos.",
  },
  {
    q: "Por que os contratos não aparecem ao criar um pagamento?",
    a: "Apenas contratos com status \"Ativo\" ou \"Pendente\" são listados. Contratos com status \"Aguardando Aprovação\" precisam ser aprovados pelo administrador antes de gerar parcelas. Verifique na página de Contratos se o contrato desejado possui um desses status.",
  },
  {
    q: "Como funciona o rateio de energia e água?",
    a: "As salas 1, 2, 3 e 4 compartilham a ligação 422A. Quando você lança uma conta para essa ligação, o valor total é dividido igualmente entre as 4 salas. A Sala Fundo (422B) tem conta individual. A ligação 422 (Salão) não aparece pois está no nome do inquilino.",
  },
  {
    q: "Como gerar parcelas de aluguel automaticamente?",
    a: "Vá em Pagamentos → clique em \"Gerar Parcelas\" → selecione o contrato → defina o número de meses → clique em \"Gerar Parcelas\". O sistema criará todas as parcelas com o valor e dia de vencimento do contrato.",
  },
  {
    q: "Como imprimir um contrato ou recibo?",
    a: "Na tabela de contratos ou pagamentos, clique no menu de ações (⋮) e selecione \"Imprimir\" ou \"Recibo\". Uma janela de impressão será aberta. Você pode imprimir ou salvar como PDF.",
  },
  {
    q: "Como confirmar o pagamento de um aluguel?",
    a: "Na página de Pagamentos, localize a parcela na tabela, clique no menu de ações (⋮) e selecione \"Confirmar Pagamento\". Informe a data e possível multa, depois confirme.",
  },
  {
    q: "O que acontece se um pagamento estiver em atraso?",
    a: "Pagamentos vencidos são destacados em vermelho na tabela. Ao confirmar o pagamento, o sistema calcula automaticamente a multa diária com base no percentual definido no contrato, até o limite máximo configurado.",
  },
  {
    q: "Como lançar a conta de energia/água para os inquilinos?",
    a: "Vá em Cobranças → clique em \"Lançar Conta\" → selecione tipo (Energia/Água), ligação, mês de referência, valor total e vencimento. O sistema divide automaticamente entre as salas. As contas de IPTU são lançadas automaticamente pelo botão \"IPTU\". A tabela mostra a visão consolidada de cada sala (Energia + Água + IPTU) com boletos unificados.",
  },
  {
    q: "Os dados de contas de consumo são salvos onde?",
    a: "Os dados de contas e cobranças são salvos localmente no navegador (localStorage). Recomendamos não limpar os dados do navegador para manter o histórico de cobranças.",
  },
  {
    q: "Como criar diferentes níveis de acesso?",
    a: "Na página de Usuários, crie um novo usuário e selecione o perfil adequado: Administrador (acesso total, incluindo aprovação de contratos), Gerente (contratos e pagamentos), Operador (pagamentos) ou Visualizador (apenas leitura).",
  },
  {
    q: "Como fazer o reajuste anual de aluguel?",
    a: "Vá em Contratos → clique em \"Reajuste\" → informe o percentual (consulte IGP-M ou IPCA acumulado) → selecione os contratos → confira a prévia → clique em \"Aplicar Reajuste\". O valor é atualizado no contrato e na unidade. Você pode aplicar um percentual único ou individual por contrato.",
  },
  {
    q: "Onde vejo os relatórios financeiros?",
    a: "Clique em \"Relatórios\" no menu lateral. A página apresenta 3 abas: Resumo Anual (gráficos de receita, composição, consumos e inadimplência), Por Unidade (tabela detalhada) e Detalhamento Mensal (mês a mês). Você pode filtrar por ano e unidade, exportar CSV e imprimir.",
  },
  {
    q: "Como exportar dados para Excel?",
    a: "Várias páginas oferecem exportação CSV: Pagamentos (botão 'Exportar CSV'), Inquilinos (botão 'CSV'), Relatórios (botões 'CSV Mensal' e 'Exportar CSV'). Os arquivos usam ponto-e-vírgula como separador e são compatíveis com Excel em português.",
  },
];

/* ── Quick Start Steps ────────────────────────────── */
const quickStart = [
  { step: 1, title: "Cadastre os Locadores", desc: "Vá em Locadores e cadastre os proprietários dos imóveis.", link: "/landlords" },
  { step: 2, title: "Cadastre as Unidades", desc: "Vá em Unidades e cadastre cada sala/imóvel com seus dados.", link: "/units" },
  { step: 3, title: "Cadastre os Inquilinos", desc: "Vá em Inquilinos e registre os dados de cada locatário.", link: "/tenants" },
  { step: 4, title: "Crie os Contratos", desc: "Vá em Contratos, vincule unidade + inquilino + locador e defina valores.", link: "/contracts" },
  { step: 5, title: "Gere as Parcelas", desc: "Vá em Pagamentos → Gerar Parcelas e crie as mensalidades.", link: "/payments" },
  { step: 6, title: "Lance as Contas", desc: "Vá em Cobranças e lance as contas de energia/água. O IPTU é lançado pelo botão dedicado.", link: "/utilities" },
];

/* ── Component ─────────────────────────────────────── */
const Help = () => {
  const [search, setSearch] = useState("");

  const filteredSections = sections.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.steps.some((st) =>
        st.title.toLowerCase().includes(q) ||
        st.content.toLowerCase().includes(q) ||
        st.tips?.some((t) => t.toLowerCase().includes(q))
      )
    );
  });

  const filteredFaq = faqItems.filter((f) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center rounded-2xl bg-primary/10 p-4 mb-4">
          <BookOpen className="h-10 w-10 text-primary" />
        </div>
        <h1 className="font-display text-3xl font-bold text-foreground">
          Central de Ajuda
        </h1>
        <p className="mt-2 text-muted-foreground max-w-lg mx-auto">
          Documentação completa do LocaGest. Aprenda a utilizar todas as funcionalidades do sistema de forma clara e objetiva.
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md mx-auto">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar na documentação..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Quick Start */}
      {!search && (
        <Card className="glass-card border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lightbulb className="h-5 w-5 text-primary" />
              Guia Rápido — Primeiros Passos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {quickStart.map((item, i) => (
                <div
                  key={item.step}
                  className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    {item.step}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.desc}
                    </p>
                  </div>
                  {i < quickStart.length - 1 && (
                    <ArrowRight className="h-4 w-4 text-muted-foreground/30 mt-1.5 flex-shrink-0 hidden sm:block" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documentation Sections */}
      <div>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Documentação por Módulo
        </h2>
        <div className="space-y-4">
          {filteredSections.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="py-8 text-center">
                <Search className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">
                  Nenhum resultado encontrado para "{search}"
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredSections.map((section) => (
              <Card key={section.id} className="glass-card">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg p-2.5 ${section.color}`}>
                      <section.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        {section.title}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {section.description}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <Accordion type="multiple" className="w-full">
                    {section.steps.map((step, idx) => (
                      <AccordionItem
                        key={idx}
                        value={`${section.id}-${idx}`}
                      >
                        <AccordionTrigger className="text-sm font-medium hover:no-underline">
                          <span className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-primary/60" />
                            {step.title}
                          </span>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-3 pl-6">
                            <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                              {step.content}
                            </p>
                            {step.tips && step.tips.length > 0 && (
                              <div className="rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 p-3 space-y-1.5">
                                <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1">
                                  <Lightbulb className="h-3.5 w-3.5" />
                                  Dicas
                                </p>
                                {step.tips.map((tip, ti) => (
                                  <p
                                    key={ti}
                                    className="text-xs text-blue-600 dark:text-blue-300 flex items-start gap-1.5"
                                  >
                                    <span className="mt-0.5">•</span>
                                    <span>{tip}</span>
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* FAQ */}
      <div>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Perguntas Frequentes (FAQ)
        </h2>
        {filteredFaq.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground text-sm">
                Nenhuma pergunta encontrada para "{search}"
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="glass-card">
            <CardContent className="pt-4">
              <Accordion type="multiple" className="w-full">
                {filteredFaq.map((faq, i) => (
                  <AccordionItem key={i} value={`faq-${i}`}>
                    <AccordionTrigger className="text-sm font-medium hover:no-underline text-left">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent>
                      <p className="text-sm text-muted-foreground pl-2 leading-relaxed">
                        {faq.a}
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Footer */}
      <Card className="glass-card bg-muted/30">
        <CardContent className="py-6 text-center">
          <p className="text-sm text-muted-foreground">
            <strong>LocaGest</strong> · Gestão de Locações Comerciais
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Dúvidas adicionais? Entre em contato com o administrador do sistema.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Help;
