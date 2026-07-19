# Painel do Laboratório de Alinhadores In-House — Exclusive Odontologia

Documentação da v1. Cobre estrutura operacional, fluxos, modelagem de dados,
banco de dados sugerido, e instruções de publicação/uso.

---

## 0. Identidade visual

O layout foi ajustado para refletir a identidade da Exclusive Odontologia —
apenas visual/organização, a lógica dos fluxos, lotes e status das placas
não foi alterada nesse ajuste.

- **Logomarca**: `logo-exclusive.png`, na mesma pasta do `index.html`
  (versão preta sobre fundo transparente, para o cabeçalho claro). Para
  trocar a logo, basta substituir esse arquivo — o `<img>` no cabeçalho
  já aponta para ele. Há um comentário no HTML indicando exatamente onde.
- **Paleta** (variáveis CSS no `:root`, fáceis de reajustar):
  - `--gold` / `--gold-dark` / `--gold-light` — dourado/champagne, usado nos
    destaques (botão principal, seção de detalhes, badge "interno").
  - `--graphite` / `--graphite-light` / `--slate` — grafite e cinza-azulado
    (tom usado nas variações de fundo da própria logomarca), para textos
    principais e bordas de destaque neutro.
  - `--bg` / `--bg-alt` — fundo off-white e cinza muito claro para áreas
    secundárias.
  - As cores **funcionais** de status (branco/verde/vermelho/azul/amarelo/
    cinza das placas, e o verde/amarelo/vermelho do card) continuam
    reservadas exclusivamente para os estados do fluxo — o dourado nunca é
    usado como cor de status, só como destaque decorativo/de marca.
- **Cabeçalho**: fixo no topo, fundo claro, com logo + nome do sistema à
  esquerda, "Operando como" e "+ Novo caso" à direita, e uma segunda linha
  com busca e exportação — sem poluir a tela com muita informação de uma vez.
- **Botões padronizados**: primário (dourado, ações de destaque como salvar/
  confirmar), outline/ghost (consulta e ações secundárias), `ready` verde com
  texto branco (ex.: "Atualizar lote", conforme pedido), `warn`/`danger`
  (alertas, reimpressão, bloqueios) e um estado `disabled` visualmente opaco.
- **Cards**: bordas arredondadas maiores, sombra leve, mais espaçamento
  interno, nome do paciente em destaque, selos (badges) arredondados para
  interno/externo/urgente/atrasado/parcial/refinamento, e a área de "Status
  geral das placas" com caixinhas numeradas compactas (ver seção 2.4).
- **Responsivo**: no celular, o cabeçalho empilha em coluna, os botões ficam
  maiores (melhor para toque) e as colunas do Kanban ocupam a maior parte da
  largura da tela para rolagem horizontal mais natural.

---

## 1. Estrutura operacional sugerida

Quatro papéis interagem com o painel, todos na mesma tela, diferenciados pelo
campo **"Operando como"** (não é login, é identificação de quem está mexendo):

| Papel | O que faz no painel |
|---|---|
| Recepção | Cadastra caso, acompanha prazos, avisa clínica quando caso está pronto |
| Laboratório (produção) | Avança planejamento/impressão, registra reimpressão, conduz a finalização (plastificação/corte/acabamento/conferência) e registra o envio |
| ASB (recebimento na clínica) | Confirma recebimento das placas enviadas — parcial ou total — placa por placa |
| Dentista planejador | Acompanha planejamento, aprova/ajusta casos externos, é alertado quando pronto |

A tela é dividida em 4 áreas fixas (conforme solicitado):

1. **Barra de login** — fixa no topo, obrigatória antes de qualquer ação (ver "Login com o Google" abaixo).
2. **Indicadores gerais** — cartões de KPI (produção, atrasados, urgentes, prontos, parciais pendentes).
3. **Kanban** — colunas macro por fase, cards por caso, com selo Interno/Externo.
4. **Central de alertas** — lista de casos que precisam de atenção imediata.

Cada caso individual tem uma **ficha completa** (modal) com todos os campos,
histórico de movimentações e o controle detalhado de entregas parciais.

### Login com o Google

Desde a v3, "quem está operando" não é mais escolhido num seletor livre — a
pessoa **entra com a própria conta Google (Gmail)** pelo botão no cabeçalho.
O painel valida o token recebido direto no backend (Apps Script, ver
`fazerLogin_` em `backend-appsscript/Code.gs`) e procura esse e-mail na aba
"Profissionais" da planilha para saber o nome, a função e se a pessoa é
**administradora**. Só administradores podem excluir casos e excluir
profissionais do cadastro — qualquer pessoa logada continua podendo cadastrar,
editar, ativar/desativar profissionais normalmente.

A sessão fica em `sessionStorage` (não `localStorage`) de propósito: computadores
de recepção/ASB costumam ser compartilhados por várias pessoas, então fechar a
aba/navegador já encerra a sessão — evita que a próxima pessoa continue
operando com a identidade anterior. Um link "sair" no cabeçalho também encerra
a qualquer momento.

**A trava de login também existe no backend, não só na tela.** `doGet`
(leitura de casos/profissionais) e a ação `upsert` exigem `solicitanteEmail`
batendo com um profissional ativo cadastrado — sem isso, o Apps Script devolve
só o mínimo necessário pro bootstrap (`profissionaisVazio`), nunca dados de
caso. Isso existe porque a URL do Web App, uma vez implantada como "Qualquer
pessoa", é tecnicamente pública — sem essa checagem no servidor, qualquer um
com a URL conseguiria ler dados de pacientes ou criar casos direto pela API,
contornando a tela de login por completo. Exclusão e gestão de profissionais
já exigiam administrador (ver `solicitanteEhAdministrador_`); leitura/criação
de caso agora exigem só estar logado (`solicitanteEhProfissionalAtivo_`).

**Configuração necessária** (uma vez só): criar um OAuth Client ID em
[console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
(tipo "Aplicativo da Web", com a URL do GitHub Pages nas origens autorizadas),
colar em `CONFIG.GOOGLE_CLIENT_ID` no `index.html` e em `EXPECTED_AUD` no
`Code.gs`. Sem isso, o botão de login mostra um aviso e ninguém consegue
entrar.

**Bootstrap do primeiro administrador**: ninguém começa marcado como
administrador. Cadastre o primeiro profissional pelo painel (com o e-mail
correto) e depois marque a célula `administrador` dessa linha como `TRUE`
direto na aba "Profissionais" da planilha — a partir daí esse administrador
promove os demais pela própria tela.

No modo `STORAGE_MODE:"local"` (teste offline, sem planilha) o login do Google
não se aplica — aparece um atalho "Entrar (modo local/teste)" que só pede um
nome, pensado para uso solo antes de publicar o backend.

### Cadastro de profissionais

Existe uma tela dedicada — **"cadastro de profissionais"**, link no topo ao
lado da identificação de quem está logado — para cadastrar quem pode operar o
sistema. Cada profissional tem:

- Nome completo
- Nome curto/apelido (o que aparece no painel)
- Função/setor (Recepção, ASB, Laboratório, Dentista planejador, Dentista
  responsável, Administrativo ou Outro)
- **E-mail** — precisa ser o mesmo e-mail Google que a pessoa usa para entrar;
  sem isso ela não consegue logar
- **É administrador?** — controla quem pode excluir casos/profissionais
- Status ativo/inativo

Profissionais **inativos** não conseguem logar e somem dos campos de
responsável em todas as telas (registrar impressão, envio, recebimento,
aprovação externa etc.), mas os nomes já gravados no histórico de casos
antigos continuam lá — desativar não reescreve o passado. Excluir (em vez de
desativar) remove o cadastro por completo — ação restrita a administradores; a
tela avisa que "desativar" é a opção mais segura quando há dúvida.

Na primeira vez que o painel roda numa versão que já tinha a lista simples de
nomes (versão anterior desta funcionalidade), o cadastro de profissionais é
criado automaticamente a partir dela, para não perder o que já estava
configurado no navegador.

### Colunas do Kanban (visual, macro)

Toda a produção (impressão, reimpressão, plastificação, corte, acabamento,
conferência, envio, recebimento) agora acontece **dentro de lotes** (ver
seção 2.1) — não são mais status separados do caso. Isso simplificou o
Kanban para **5 colunas macro**:

1. Recebido
2. Planejamento
3. Aprovação (só externo)
4. Em produção (lotes) — onde o caso passa a maior parte da vida; o detalhe
   fino de cada lote fica na ficha e no resumo do card, não em mais colunas
5. Finalizado — só quando 100% das placas planejadas (todos os lotes) foram recebidas

### Cadastro em duas fases (v2)

O cadastro inicial do caso ficou enxuto de propósito: nome do paciente, tipo
(interno/externo), dentista responsável, dentista planejador, data de
entrada, prazo desejado, prioridade e observações iniciais. **A quantidade de
placas não entra no cadastro** — ela só é conhecida depois que o planejamento
é feito. Por isso existe uma ação separada, **"Definir placas do
planejamento"**, disponível na ficha do caso assim que ele estiver em
qualquer etapa anterior à produção. Essa ação pede apenas 4 campos (qtd.
superior, qtd. inferior, tem placa 0 superior, tem placa 0 inferior) e é
**obrigatória**: o sistema bloqueia a passagem para "Em produção (lotes)"
enquanto ela não estiver preenchida.

---

## 2. Fluxo interno (6 etapas macro) e fluxo externo (10 etapas macro)

```
Interno:  Caso recebido → Planejamento pendente → Planejamento em execução
          → Planejamento concluído → Em produção (lotes) → Finalizado

Externo:  Caso externo recebido → Dados conferidos → Planejamento pendente
          → Planejamento em execução → Planejamento enviado para aprovação
          → Aguardando aprovação do cliente/dentista externo
          → Planejamento aprovado → (Ajustes solicitados no planejamento ↩)
          → Em produção (lotes) → Finalizado
```

Regras aplicadas no código:
- **Salvar o planejamento de placas já conclui essa etapa e avança o caso automaticamente** (`__submitPlanejamento`) — não existe mais um clique manual extra em "Avançar" depois de definir as placas. Interno vai direto para "Em produção (lotes)"; externo vai para "Aguardando aprovação do cliente/dentista externo". Ao aprovar (`aprovarPlanejamento`), o externo também avança automaticamente direto para "Em produção (lotes)" na mesma ação — "Planejamento aprovado" é só um passo transitório registrado no histórico, o caso nunca fica parado nele esperando outro clique.
- Etapa de aprovação é **obrigatória** antes da produção no fluxo externo (bloqueia "Avançar" para "Em produção" sem aprovação registrada, e também se as placas do planejamento ainda não foram definidas em qualquer um dos dois fluxos).
- "Ajustes solicitados" sempre volta automaticamente para "Planejamento em execução".
- Campos exclusivos de caso externo ficam visíveis na ficha (ver seção 4).
- Campo opcional **"É refinamento interno?"** — se sim, pede o número do refinamento e exibe selo "Refinamento nº X" no card.
- **Não existe mais "Erro de impressão" como status separado.** Toda falha é tratada via "Reimpressão necessária", dentro do lote (seção 2.1).
- **"Em produção (lotes)"** é a única etapa em que o caso realmente fica — todo o detalhe fino (impressão, reimpressão, plastificação, corte, acabamento, conferência, envio, recebimento) acontece dentro dos lotes do caso, não em mais transições de status macro. A saída dessa etapa é sempre automática, via `completoTotal()` — nunca um botão manual de "concluir".
- **Contenção/modelo de estudo não têm planejamento** (os itens já são gerados no cadastro, `buildItensProducao`) — mas também não avançam sozinhos de "Caso recebido": o "Avançar" genérico fica bloqueado nessa etapa para esses tipos (`canAdvanceGeneric`), e a ação nomeada **"Pronto para impressão"** (`prontoParaImpressao`) é quem move o caso pra produção, com o mesmo registro de responsável/data/hora/histórico de qualquer `changeStatus`.

### 2.1 Lotes de produção — a peça central desta versão

Um **Lote** é uma unidade fixa de placas (definida na hora da criação) que
percorre sozinha todo o funil de produção:

```
1. Impressão do lote (automática na criação)
2. Conferência da impressão do lote (obrigatória, placa por placa — única
   tela onde toda a lógica de reimpressão acontece)
3. Plastificação
4. Corte
5. Acabamento
6. Conferência final
7. Envio para a clínica / cliente externo
8. Recebimento pela ASB / cliente externo
```

O estágio atual de cada lote (`loteEtapaAtual`) é **sempre calculado**, nunca
guardado como campo solto — evita que a etapa visível fique dessincronizada
do que realmente foi registrado:

- `impressao` — enquanto qualquer placa do lote não estiver **conferida e
  marcada OK** (inclui placas nunca conferidas, marcadas para reimprimir, ou
  já reimpressas mas ainda não reconferidas). Rotulado na tela como
  "Aguardando conferência da impressão".
- `finalizacao` — todas as placas conferidas e OK; faltam os 4 checks
  (plastificação, corte, acabamento, conferência final).
- `envio` — finalização completa, aguardando ser enviado.
- `recebimento` — enviado, aguardando confirmação de recebimento.
- `concluido` — recebido. Sai da lista de **lotes ativos** e passa para o
  **histórico de lotes entregues** do caso.

**Nenhum lote pode ir para confecção de placas sem que todas as suas placas
estejam conferidas e marcadas OK.** Enquanto isso não acontecer, o botão
**Confecção de placas** aparece visível porém desabilitado (cinza, com
tooltip explicando o bloqueio).

**Placas ainda não incluídas em nenhum lote** ficam disponíveis na área
"Placas pendentes para novo lote", com o botão **Criar novo lote**: o
operador marca (checkbox individual, não faixa obrigatória) exatamente quais
placas — superiores e inferiores — vão compor o próximo lote. Um caso pode
ter vários lotes simultâneos em estágios diferentes.

**Criar o lote já registra a impressão.** Não existe um botão separado de
"Registrar modelos impressos": ao confirmar a criação do lote, o sistema
grava automaticamente um evento de impressão cobrindo todas as placas
escolhidas, e elas já aparecem **verdes** no status geral (seção 2.4) — mas
isso é só o registro histórico de que a placa entrou impressa no lote, e
**não conta como conferida**: a confecção continua bloqueada até a placa
passar pela "Conferência da impressão do lote" ao menos uma vez.

**Toda a lógica de reimpressão fica dentro de uma única tela — "Conferir
impressão do lote".** Não existem botões avulsos de "reimpressão
necessária/concluída". Dentro do modal, cada placa do lote tem um seletor de
3 opções:

- **✅ OK** — a placa foi conferida e está correta; fica **verde** e conta
  como liberada para confecção.
- **🔁 Reimprimir** — a placa foi conferida e precisa ser refeita; fica
  **vermelha** e bloqueia a confecção do lote inteiro.
- **🟠 Foi impresso novamente** — a placa (que estava marcada "Reimprimir")
  já foi refeita fisicamente, mas **ainda não foi reconferida**; fica
  **laranja** — um estado intermediário entre vermelho e verde. Continua
  bloqueando a confecção até a responsável abrir a conferência de novo e
  marcá-la como OK.

O fluxo típico de uma placa com problema é: `OK (implícito na criação)` → a
responsável confere e marca **Reimprimir** (vermelha) → depois de refeita,
reabre a conferência e marca **Foi impresso novamente** (laranja) → confere
mais uma vez e marca **OK** (verde) → só então ela deixa de bloquear a
confecção do lote. Cada submissão do modal só grava um evento por placa cujo
valor realmente mudou (evita histórico poluído com "OK → OK" repetido).

Não existe botão de "concluir impressão" ou "avançar como impressão parcial"
separados: o próprio conceito de lote já resolve isso — um lote só avança de
estágio quando realmente está pronto naquele estágio, e o laboratório decide
o tamanho de cada lote (ex.: só produzir 11 de 21 placas por enquanto)
simplesmente escolhendo quais placas colocar nele.

Não existe botão de "concluir impressão" ou "avançar como impressão parcial"
separados: o próprio conceito de lote já resolve isso — um lote só avança de
estágio quando realmente está pronto naquele estágio, e o laboratório decide
o tamanho de cada lote (ex.: só produzir 11 de 21 placas por enquanto)
simplesmente escolhendo quais placas colocar nele.

**Botão verde = ação de confirmação.** "Confecção de placas", "Salvar
confecção do lote", "Entrega do lote à clínica" e "Recebimento pela ASB"
usam a cor verde — reservada para ações positivas de confirmação — em vez de
branco/neutro.

**Toda ação dentro de um lote volta para a ficha do caso ao confirmar** — o
sistema não fecha tudo nem deixa o usuário "perdido"; ao salvar qualquer
ação (criar lote, reimpressão, confecção, entrega, recebimento, aprovação
externa, planejamento), a ficha reabre automaticamente já atualizada,
mostrando o resumo geral e os lotes.

### 2.2 Regra principal: o caso só finaliza quando não sobra nenhuma placa em aberto

```js
function completoTotal(caso){
  // nenhuma placa do planejamento fora de algum lote, e todo lote concluído
}
```

`completoTotal()` exige, ao mesmo tempo: (1) nenhuma placa do planejamento
"pendente para novo lote" (ou seja, toda placa já foi alocada a algum lote em
algum momento) e (2) **todo** lote do caso já está `concluido` (impresso,
finalizado, enviado e recebido). Enquanto isso não for verdade, o card
continua ativo — receber um lote não finaliza o caso sozinho.

Quando um lote é recebido mas ainda existem placas pendentes para um novo
lote (ou outros lotes em produção), a ficha mostra automaticamente o aviso
**"🔄 Continuação do caso"**, e a área "Lotes em produção" / "Placas
pendentes para novo lote" já exibe exatamente o que falta — sem precisar de
nenhuma ação manual para "abrir" essa continuação.

### 2.3 Sistema de cores do card — baseado em prazo (v4)

A cor de fundo do card é **100% controlada pela situação de prazo**
(`situacaoPrazo()`), calculada a partir da **prioridade cadastrada**
(normal/urgente/atrasado, escolhida no cadastro) + **datas** — nunca
guardada, sempre recalculada a cada render. Prioridade cadastrada e situação
de prazo são conceitos separados de propósito: um caso **Normal** pode estar
com situação **Crítico** se estiver perto do vencimento, por exemplo.

- **Branco/neutro** — dentro do prazo.
- **Amarelo** — atenção (caso normal a partir do 10º dia desde a entrada).
- **Vermelho** — crítico (caso normal a partir do 15º dia) **ou** urgente
  (urgente já nasce vermelho desde o dia 0, antes mesmo de vencer).
- **Roxo** — atrasado: prazo automático (20 dias normal / 5 dias urgente)
  ultrapassado, **ou** prioridade marcada manualmente como "Atrasado".
- **Verde** — 100% finalizado (`statusAtual === "Finalizado"`), sempre
  sobrepõe qualquer outra cor.

Prazos e limiares ficam centralizados em `CONFIG_PRAZOS` no `<script>` do
`index.html`, fáceis de ajustar sem mexer no resto do código:
```js
const CONFIG_PRAZOS = {
  normal:  { prazoDias: 20, atencaoDias: 10, criticoDias: 15 },
  urgente: { prazoDias: 5 }
};
```
Ao marcar a prioridade no cadastro, o campo "Prazo desejado" é
**pré-preenchido automaticamente** (`prazoAutomatico()`) com base na data de
entrada + esses dias — mas continua editável manualmente a qualquer momento.

**Reimpressão pendente** e **entrega parcial** (que antes pintavam o card de
vermelho/amarelo) viraram **selos (badges)** próprios no card, para não
competir visualmente com a cor de prazo — a informação continua visível,
só que num canal separado.

### 2.4 Status geral das placas — mapa fixo por placa individual

Além da cor geral do card (que resume o caso inteiro), existe uma área fixa
— **"Status geral das placas"** — no card e na ficha, mostrando **cada placa
planejada** (superior e inferior) como uma etiqueta colorida individual,
independente de a qual lote ela pertence:

- ⚪ **Branco** — pendente: ainda não foi incluída em nenhum lote.
- 🟢 **Verde claro** (`.impresso`) — a placa entrou no lote e foi impressa,
  mas **ainda não passou pela conferência**. Não libera confecção.
- 🟢 **Verde escuro** (`.conferido`) — conferida com evento **OK** explícito.
  Só esse estado conta pra liberar a confecção do lote (`loteFinalizacaoOk`/
  `loteEtapaAtual` já exigiam isso antes; a diferença agora é só que fica
  visível — antes as duas situações eram indistinguíveis no card).
- 🔴 **Vermelho** — precisa reimprimir (conferida e reprovada).
- 🟠 **Laranja** — foi impressa novamente, mas ainda aguarda nova conferência
  antes de poder virar OK. Estado intermediário entre vermelho e verde.
- 🔵 **Azul** — confeccionada (o lote já passou por plastificação, corte,
  acabamento e conferência), mas **ainda não foi entregue à clínica**.
- 🟡 **Amarelo** — entregue à clínica, **aguardando confirmação de
  recebimento pela ASB** (ou pelo cliente externo). Distinto de azul: azul é
  "pronta no laboratório", amarelo é "já saiu do laboratório".
- ⬛ **Cinza** — recebida pela ASB/cliente externo; saiu do fluxo ativo do
  laboratório.

A cor de cada placa (`placaStatus(caso, arco, número)`) é sempre recalculada
a partir do lote que a contém — nunca é um campo salvo separadamente, então
nunca fica dessincronizada do que foi realmente registrado nos lotes. Esse
mapa **não substitui** o histórico (lotes criados, eventos de impressão,
reimpressão, confecção, entrega, recebimento, responsáveis, datas e
observações continuam completos e consultáveis) — ele é só a leitura rápida
"bater o olho" do andamento de cada placa do caso.

### 2.5 Nomes dos botões de cada lote

Dentro de cada lote (na ficha), os botões contextuais mudam conforme o
estágio do lote, com os nomes:

1. **Conferir impressão do lote** (seletor OK/Reimprimir/Foi impresso novamente por placa) — único botão disponível enquanto o lote estiver na etapa `impressao`; concentra toda a lógica de reimpressão, não existem mais botões avulsos de "reimpressão necessária/concluída".
2. **Confecção de placas** (os 4 checks: plastificação, corte, acabamento, conferência) — aparece **desabilitado** enquanto qualquer placa do lote não estiver conferida e marcada OK; habilita assim que todas estiverem.
3. **Entrega do lote à clínica** (ou ao cliente/clínica externa) — aparece após a confecção estar completa.
4. **Recebimento pela ASB** (ou pelo cliente externo) — aparece após a entrega ser registrada.

Não existe botão de "Registrar modelos impressos": criar o lote já registra
a impressão das placas escolhidas (seção 2.1). Cada botão só aparece quando
o lote está no estágio correspondente, e só controla as placas daquele lote
específico.

### 2.6 "Definir placas do planejamento" só na coluna Planejamento — e salvar já avança o caso

Esse botão (ver seção 1, "Cadastro em duas fases") só é oferecido enquanto
`STATUS_TO_COL[caso.statusAtual] === "planejamento"`. Em qualquer outra
coluna — Recebido, Aprovação, Em produção ou Finalizado — ele não aparece
mais na ficha. Isso evita que alguém altere a quantidade de placas depois
que já existem lotes criados a partir delas, o que quebraria a
correspondência entre planejamento e lotes. Como salvar já move o caso pra
fora da coluna Planejamento (ver acima), esse botão some sozinho logo depois
do primeiro salvamento — não precisa de nenhuma lógica extra pra "travar" a
edição das placas depois que os lotes já existem.

---

## 4. Modelagem de dados

### 4.1 Entidade `Caso`

```ts
Caso {
  id: string                    // uuid gerado no cadastro
  numeroCaso: string            // sequencial ou manual
  tipoCaso: "interno" | "externo"
  paciente: string
  dentistaResponsavel: string
  dentistaPlanejador: string
  dataEntrada: date
  dataPrevistaEntrega: date
  dataConclusaoReal: date | null
  prioridade: "normal" | "urgente" | "atrasado"   // atrasado é recalculado, mas pode ser forçado
  statusAtual: string            // uma das strings do fluxo interno/externo
  responsavelEtapaAtual: string       // auto-preenchido pelo "Operando como" a cada mudança de etapa
  setorResponsavelEtapaAtual: string  // auto-derivado da etapa atual (não é mais digitado no cadastro)

  // refinamento (só interno)
  refinamento: { isRefinamento: boolean, numero: number | null }

  // planejamento de placas — preenchido só na etapa de planejamento, NÃO no cadastro
  planejamento: {
    qtdSuperior: number          // placas principais, sem contar a placa 0
    qtdInferior: number
    placa0Superior: boolean      // = attachSuperior — attachment É a placa 0, não são dois campos
    placa0Inferior: boolean      // = attachInferior
    observacaoProducao: string   // recado pra quem vai produzir — só ganha destaque no card quando o caso entra na coluna Produção (ver cardHTML)
    definidoEm: datetime
  } | null
  attachSuperior: boolean
  attachInferior: boolean

  // produção — ver 4.2. Um caso pode ter vários lotes, cada um em um
  // estágio diferente do funil (impressão → finalização → envio → recebimento).
  lotes: Lote[]

  // observações
  obsClinicas: string             // usado também como "observações iniciais" do cadastro
  obsLaboratoriais: string
  motivoErro: string              // preenchido a partir do motivo (opcional) de uma reimpressão

  // exclusivo externo
  externo: {
    dentistaExterno: string
    clinicaExterna: string
    telefone: string
    email: string
    cidade: string
    responsavelAprovacao: string
    dataEnvioPlanejamento: date | null
    dataAprovacaoPlanejamento: datetime | null
    formaEnvio: string
    codigoRastreio: string
    obsComerciais: string
  } | null

  finalizadoPor: string | null     // quem estava "Operando como" quando completoTotal() ficou verdadeiro
  historico: Movimentacao[]        // ver 4.4
  criadoEm: datetime
  atualizadoEm: datetime
}
```

Campos derivados (calculados em tela a partir de `planejamento` + `lotes`,
nunca armazenados em duplicidade):
- `totalRealSuperior/Inferior` = qtd + 1 se houver placa 0 daquele arco.
- `reqSeqSuperior/Inferior` = lista de números realmente exigidos pelo
  planejamento (começa em 0 se houver placa 0, senão em 1, vai até `qtd`).
- `placasAlocadas` = união das placas de **todos** os lotes do caso, não
  importa o estágio. `placasPendentesNovoLote` = `reqSeq*` menos
  `placasAlocadas` — o que ainda pode formar um lote novo.
- `loteEtapaAtual(lote)` — nunca um campo salvo, sempre recalculado a partir
  do `computeLoteImpressaoState` do lote + os 4 checks de finalização + os
  campos `envio`/`recebimento`.
- `completoTotal(caso)` = `placasPendentesNovoLote` vazio **e** todo lote do
  caso está `concluido`. É o único gatilho que muda o status para
  "Finalizado" — não existe ação manual de "marcar como concluído".

### 4.2 Entidade `Lote`

```ts
Lote {
  id: string
  numero: number                  // Lote 1, Lote 2, ... sequencial dentro do caso
  criadoEm: datetime
  responsavelCriacao: string
  superiores: number[]             // fixo desde a criação — não muda depois
  inferiores: number[]

  eventosImpressao: EventoImpressao[]   // ver abaixo — histórico fino de impressão/reimpressão/pendência do lote

  plastificacao: ChecklistItem
  corte: ChecklistItem
  acabamento: ChecklistItem
  conferencia: ChecklistItem
  // ChecklistItem = { concluida: boolean, observacao: string, responsavel: string|null, data: date|null, hora: string|null }

  envio: { enviado: boolean, data: date, responsavel: string, observacao: string } | null
  recebimento: { recebido: boolean, data: date, responsavel: string, observacao: string } | null

  observacoes: string
}

EventoImpressao {
  id: string
  criadoEm: datetime               // ordena os eventos cronologicamente
  tipo: "impresso" | "ok" | "reimprimir" | "reimpresso"
  // "impresso"   — só o registro histórico da criação do lote; NÃO conta
  //                como conferida (ver regra abaixo).
  // "ok"         — placa conferida e aprovada (verde), gerado só pelo modal
  //                "Conferir impressão do lote".
  // "reimprimir" — placa conferida e reprovada, precisa ser refeita (vermelho).
  // "reimpresso" — placa já refeita fisicamente mas ainda não reconferida
  //                (laranja) — estado intermediário entre reimprimir e ok.
  superiores: number[]             // placas individuais (subconjunto de lote.superiores)
  inferiores: number[]
  responsavel: string
  data: date
  observacao: string
}
```

Regra de conferência da impressão dentro do lote (implementada e testada
isoladamente, ver `scratchpad`/testes da sessão): o status de cada placa é
sempre o **tipo do evento mais recente** que a menciona, entre `ok`,
`reimprimir` e `reimpresso` — o evento `impresso` da criação do lote nunca
define esse status, só registra historicamente que a placa entrou impressa
no lote. Uma placa sem nenhum evento `ok`/`reimprimir`/`reimpresso` ainda é
considerada **"não conferida"**: aparece visualmente verde (como se
estivesse OK, já que fisicamente foi impressa), mas **bloqueia** a confecção
do lote da mesma forma que `reimprimir`/`reimpresso` — só um evento `ok`
explícito libera a placa de verdade. Isso garante que toda placa passe pelo
modal "Conferir impressão do lote" ao menos uma vez antes da confecção,
mesmo que a responsável apenas confirme que está tudo certo sem mexer em
nada. O lote só sai do estágio `impressao` quando **toda** placa de
`lote.superiores`/`inferiores` tem `ok` como status mais recente —
`loteEtapaAtual` passa então a apontar para `finalizacao`, depois `envio`,
depois `recebimento`, e por fim `concluido`, sempre recalculado, nunca um
campo que alguém precisa lembrar de atualizar manualmente. Cada submissão do
modal só grava um evento por placa cujo valor realmente mudou em relação ao
estado atual, evitando eventos redundantes no histórico.

### 4.4 Entidade `Movimentacao` (histórico, imutável)

```ts
Movimentacao {
  responsavel: string
  data: date
  hora: string
  etapaAnterior: string
  etapaNova: string
  observacao: string
}
```

Toda mudança de etapa, reimpressão, aprovação/reprovação, finalização, envio
e recebimento gera uma entrada aqui automaticamente — é a auditoria do sistema.

---

## 5. Banco de dados compartilhado

### v2 (atual): Hostinger + PHP + MySQL

Motivo da escolha: o usuário já tem conta ativa na Hostinger; PHP + MySQL é
suportado nativamente em qualquer plano de hospedagem compartilhada, sem
depender de serviços de terceiros (Google) nem de limites de planilha.

**O objeto `Caso` inteiro (com todos os lotes, eventos de impressão e
histórico) é guardado como JSON numa única coluna da tabela `casos`** — a
mesma lógica de negócio que já roda hoje inteiramente no navegador (cores das
placas, `loteEtapaAtual`, `completoTotal` etc.) continua sendo a fonte da
verdade sobre como interpretar esse objeto; o banco só guarda e devolve o
JSON de cada caso, como um HD compartilhado. Isso evita ter que reescrever
toda a lógica em SQL/PHP. Ver `sql/schema.sql` para as tabelas (`casos` e
`profissionais`) e `api/*.php` para os endpoints.

O front-end (`index.html`) já vem pronto com um **adaptador de storage**
(`STORAGE` no `<script>`) com três implementações, trocáveis só mudando
`CONFIG.STORAGE_MODE` — nenhum outro código muda:

- `"local"` (padrão de fábrica, funciona sozinho em `localStorage`, útil para
  testar telas e fluxo antes de publicar o backend, mas **não compartilha
  entre computadores**).
- `"mysql"` — fala com a API PHP própria (pasta `/api`) hospedada junto do
  `index.html` na Hostinger. Alternativa caso um dia troquem de hospedagem.
- `"sheets"` (**modo em uso atualmente** — Google Apps Script + planilha
  Google, `backend-appsscript/Code.gs`) — publicado gratuitamente via GitHub
  Pages (ver seção 9, "Opção grátis"). É o modo com login por e-mail do Google
  implementado (ver "Login com o Google" na seção 1).

### API PHP (pasta `/api`)

Como o front-end já centraliza toda mutação num único `persist(caso)` →
`STORAGE.upsert(caso)` (criar lote, conferir impressão, confecção, entrega,
recebimento — todos terminam nessa mesma chamada), a API não precisa de um
endpoint por ação. Só três arquivos fazem o trabalho:

- `api/casos.php` — `GET` devolve `{ok:true, casos:[...]}` com todos os casos;
  `POST {action:"upsert", caso}` grava um caso inteiro (`INSERT ... ON
  DUPLICATE KEY UPDATE`); `POST {action:"delete", id}` remove um caso.
- `api/profissionais.php` — `GET` devolve a lista de profissionais; `POST
  {profissionais:[...]}` substitui a lista inteira (mesmo padrão que
  `salvarProfissionais()` já usava com `localStorage.setItem`).
- `api/db.php` / `api/config.php` — conexão PDO e credenciais do banco.
  `api/config.php` é o **único** arquivo com a senha do banco; nunca é
  enviado ao navegador. `api/config.example.php` é o modelo a copiar.

Proteção atual: todo endpoint exige o header `X-Api-Key` batendo com a
`API_KEY` de `api/config.php` (`api/_auth.php`) — uma barreira simples
enquanto não existe login de usuário (etapa futura). Todas as consultas usam
*prepared statements* do PDO (nunca concatenação de SQL).

### Evolução: login, Firebase, Supabase

- **Login por usuário**: trocar a proteção por `X-Api-Key` por sessão PHP de
  verdade, com tabela `usuarios` e `password_hash()`/`password_verify()` —
  planejado como etapa separada, depois que o backend compartilhado estiver
  validado.
- **Tempo real de verdade**: se o polling (seção 9, "Atualização entre computadores") não for suficiente, migrar
  a camada de persistência para Firebase (Firestore + `onSnapshot`) ou
  Supabase (Postgres + Realtime). A modelagem da seção 4 não muda — só troca
  de novo a camada de persistência, como já aconteceu de Sheets para MySQL.

---

## 6–8. Código (HTML + CSS + JS integrados)

Ver `index.html` — arquivo único, sem build step. A pasta `api/` (PHP) só é
necessária quando `STORAGE_MODE:"mysql"` (ver seção 5 e 9) — em `"local"` o
`index.html` funciona sozinho em qualquer host estático (GitHub Pages,
Netlify, Vercel, servidor da clínica), sem precisar de PHP.

---

## 9. Como publicar e usar em vários computadores

### Opção rápida para validar o fluxo (sem backend ainda)
1. Abra `index.html` direto no navegador (duplo clique).
2. Funciona sozinho com `localStorage` (`STORAGE_MODE:"local"`) — bom para
   revisar telas e fluxo com a equipe, mas cada computador terá seus próprios
   dados (não compartilha).

### Opção real (compartilhada entre computadores) — Hostinger + MySQL
1. **Banco de dados**: no hPanel da Hostinger, vá em *Bancos de dados MySQL*,
   crie um banco e um usuário (anote nome do banco, usuário e senha).
2. **Criar as tabelas**: abra o phpMyAdmin do banco criado (link no próprio
   hPanel) → aba *Importar* → selecione `sql/schema.sql` (ou cole o conteúdo
   na aba *SQL* e execute).
3. **Subir os arquivos**: pelo Gerenciador de Arquivos da Hostinger (ou FTP),
   envie para a pasta pública do domínio (`public_html`):
   - `index.html`, `logo-exclusive.png`
   - a pasta `api/` inteira (`db.php`, `_auth.php`, `casos.php`,
     `profissionais.php`, `config.example.php`) — **não** suba `config.php`
     com credenciais de teste; crie-o direto no servidor no próximo passo.
4. **Configurar credenciais**: dentro de `api/`, copie `config.example.php`
   para `config.php` e edite com os dados reais do banco (passo 1) e uma
   `API_KEY` nova, aleatória (qualquer string longa serve).
5. **Apontar o front-end para a API**: abra `index.html` (direto no editor de
   arquivos da Hostinger, ou edite antes de subir) e ajuste `CONFIG`:
   ```js
   const CONFIG = {
     STORAGE_MODE: "mysql",       // era "local"
     API_URL: "/api",             // caminho relativo já funciona, mesmo domínio
     API_KEY: "A_MESMA_CHAVE_DO_CONFIG.PHP",
     ...
   };
   ```
6. **Ativar HTTPS**: no hPanel, ative o SSL gratuito do domínio (geralmente
   automático) e force redirecionamento HTTPS.
7. Em cada computador (recepção, laboratório, ASB, dentista), abrir a URL do
   domínio publicado — favoritar no navegador.
8. Cada pessoa, ao abrir, entra com a própria conta Google (ver "Login com o
   Google" na seção 1) antes de mexer em qualquer caso.

### Opção grátis (modo em uso atualmente) — GitHub Pages + Google Sheets
1. **Planilha + Apps Script**: criar uma planilha Google nova, colar
   `backend-appsscript/Code.gs` em Extensões > Apps Script, rodar `setup()`
   uma vez, e publicar como Web App (Implantar > Nova implantação > "App da
   Web", executar como "Eu", acesso "Qualquer pessoa"). Copiar a URL gerada
   (termina em `/exec`).
2. **Login com o Google**: criar um OAuth Client ID em
   [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
   (tipo "Aplicativo da Web", com a URL do GitHub Pages nas origens
   autorizadas) e colar o Client ID em `CONFIG.GOOGLE_CLIENT_ID` (`index.html`)
   e em `EXPECTED_AUD` (`Code.gs`).
3. **Ajustar `CONFIG`** no `index.html`:
   ```js
   const CONFIG = {
     STORAGE_MODE: "sheets",
     API_URL: "URL_DO_WEB_APP_DO_APPS_SCRIPT",
     GOOGLE_CLIENT_ID: "SEU_CLIENT_ID.apps.googleusercontent.com",
     ...
   };
   ```
4. **Subir para o GitHub**: criar um repositório público, enviar `index.html`
   e `logo-exclusive.png` (não precisa da pasta `api/` nem `sql/` nesse modo),
   e ativar GitHub Pages em Settings → Pages (Source: branch `main`, pasta
   `/ (root)`). A URL fica em `https://SEUUSUARIO.github.io/SEUREPO/`.
5. **Bootstrap do primeiro administrador**: cadastrar o primeiro profissional
   pelo painel (com e-mail correto) e marcar `administrador` como `TRUE`
   direto na aba "Profissionais" da planilha.
6. Em cada computador, abrir a URL do GitHub Pages e entrar com a própria
   conta Google.

### Atualização entre computadores
Com `STORAGE_MODE:"mysql"` (ou `"sheets"`), o painel busca os dados mais
recentes automaticamente a cada `CONFIG.POLL_INTERVAL_MS` (padrão: 20s) — ver
`atualizarDados()`/`init()` no `<script>`. Também existe o botão **"🔄
Atualizar dados"** no topo (ao lado de "Exportar CSV") para forçar uma
atualização imediata sem esperar o intervalo.

### Backup
- O `sql/schema.sql` recria a estrutura das tabelas a qualquer momento; o
  conteúdo em si pode ser exportado pelo phpMyAdmin (aba *Exportar*) ou pelas
  ferramentas de backup de banco do plano Hostinger contratado.
- O painel também tem botão "Exportar JSON/CSV" para backup manual local.
- No modo `"sheets"` (Google Sheets + Apps Script, `backend-appsscript/Code.gs`),
  o backup nativo é o histórico de versões do próprio Google Sheets (Arquivo >
  Histórico de versões).

---

## 10. Evolução futura sugerida

- **Notificações reais**: n8n escutando o mesmo banco MySQL e disparando
  WhatsApp (via API oficial ou Twilio) e e-mail quando um caso entra em
  "Pronto para envio" ou fica parado demais numa etapa.
- **Login por usuário**: já implementado no modo `"sheets"` via Login com o
  Google (ver seção 1). Ainda faltam: perfis de acesso granulares por
  função/setor (hoje só existe a distinção administrador/não-administrador,
  restrita a exclusão) e o equivalente no modo `"mysql"` (que ainda usa
  `X-Api-Key` fixa — trocar por sessão PHP de verdade com tabela `usuarios` se
  um dia migrarem pra esse modo).
- **Tempo real de verdade**: migrar do polling para Firebase/Supabase com
  listener (`onSnapshot`/`Realtime`) para os cards atualizarem sozinhos em
  todos os computadores sem precisar dar refresh.
- **App mobile/PWA**: o CSS já é responsivo; adicionar `manifest.json` +
  service worker transforma o painel num PWA instalável no celular da ASB.
- **Dashboard histórico**: relatórios de tempo médio por etapa, gargalos,
  produtividade por planejador, usando o `historico` já registrado.
