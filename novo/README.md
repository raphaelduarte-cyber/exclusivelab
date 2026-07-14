# Exclusive CRC — Inteligência Comercial (Etapa 1)

Primeiro módulo do futuro ERP da Rede Exclusive Odontologia. Este módulo é
**independente** do painel de Alinhadores que vive na raiz deste repositório:
tem sua própria planilha Google Sheets, seu próprio Apps Script e seu próprio
login — só reaproveita o mesmo padrão técnico e a mesma identidade visual.

Escopo desta etapa: login, estrutura de dados no Google Sheets, tela da CRC e
"Salvar Relatório". Dashboard Executivo, Ranking, IE-CRC, Central de
Oportunidades e Painel de Inteligência chegam nas próximas etapas.

## Estrutura de arquivos

```
novo/
  index.html                 # front-end (login + tela da CRC + placeholder do admin)
  logo-exclusive.png         # logomarca (mesma do painel de Alinhadores)
  backend-appsscript/Code.gs # backend em Google Apps Script
```

## Como publicar (grátis: GitHub Pages + Google Sheets)

1. **Planilha**: crie uma Google Sheet nova, vazia — **não** reaproveite a
   planilha do Laboratório de Alinhadores, este módulo tem a sua própria.
2. **Apps Script**: na planilha, vá em Extensões → Apps Script. Apague o
   conteúdo padrão e cole o arquivo [`backend-appsscript/Code.gs`](backend-appsscript/Code.gs)
   inteiro. Rode a função `setup` uma vez (menu Executar → `setup`) e autorize
   o script quando pedido. Isso cria as 10 abas do módulo
   (`Usuários, Relatórios, Indicadores, Ranking, Oportunidades, Pacientes
   Faltantes, Configurações, Logs, Dashboard, Histórico`) — só `Usuários`,
   `Relatórios`, `Oportunidades`, `Pacientes Faltantes` e `Logs` recebem dados
   nesta etapa. `Pacientes Faltantes` acumula, de todos os dias e todas as
   CRCs, quem faltou e não reagendou — é o banco para a gestão sempre
   conseguir resgatar esses contatos (ainda sem tela própria, só a planilha).
3. **Publicar como Web App**: Implantar → Nova implantação → tipo "App da
   Web" → Executar como "Eu" → Quem pode acessar "Qualquer pessoa". Copie a
   URL gerada (termina em `/exec`).
4. **OAuth Client ID**: crie um em
   [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials),
   tipo "Aplicativo da Web", com as origens autorizadas:
   - `https://<seu-usuario>.github.io` (o domínio do GitHub Pages)
   - `http://localhost:5500` (para testar localmente antes de publicar)
5. **Preencher configuração**:
   - Em `backend-appsscript/Code.gs`, na variável `EXPECTED_AUD`, cole o
     Client ID criado no passo anterior. Salve e implante novamente (Nova
     implantação, ou "Gerenciar implantações" → editar).
   - Em `index.html`, no objeto `CONFIG` (perto do fim do arquivo), preencha:
     ```js
     const CONFIG = {
       API_URL: "https://script.google.com/macros/s/SEU_ID/exec",
       GOOGLE_CLIENT_ID: "SEU_CLIENT_ID.apps.googleusercontent.com"
     };
     ```
   Enquanto esses dois campos ficarem vazios, o sistema roda em **modo de
   teste local** (sem planilha real) — útil para conferir a tela antes de
   publicar de verdade.
6. **Cadastrar os usuários iniciais**: ainda não existe tela de cadastro
   (chega na Etapa 3). Abra a aba "Usuários" da planilha direto e adicione as
   linhas manualmente. Cada linha precisa também de uma coluna `dadosJSON`
   com o mesmo objeto em JSON (é a fonte de verdade lida pelo backend). Exemplo
   de linha para a Larissa:
   - `id`: `usr-larissa`
   - `nomeCompleto`: `Larissa ...`
   - `nomeCurto`: `Larissa`
   - `email`: e-mail Google real dela
   - `perfil`: `CRC`
   - `ativo`: `TRUE`
   - `dadosJSON`: `{"id":"usr-larissa","nomeCompleto":"Larissa ...","nomeCurto":"Larissa","email":"...","perfil":"CRC","ativo":true}`

   Repita para a Suzani (`perfil: CRC`) e para quem for administrador
   (`perfil: Administrador`).
7. **Publicar o front-end**: dê commit/push de `index.html`, `logo-exclusive.png`
   e `backend-appsscript/Code.gs` para este repositório (branch `main`) — o
   GitHub Pages já configurado na raiz do repositório serve esta pasta
   automaticamente em `https://<seu-usuario>.github.io/<repo>/novo/`.
8. Abra essa URL, entre com a conta Google de cada usuário cadastrado e teste
   o fluxo: login → dashboard → "Preencher relatório de hoje" → salvar.

## Notas de segurança e comportamento

- Sessão fica em `sessionStorage` (não `localStorage`): fechar a aba encerra
  a sessão — proposital para computadores compartilhados.
- Ao salvar um relatório, o backend revalida o token do Google e usa o e-mail
  validado para preencher `crcEmail`/`crcNome` — o campo enviado pelo
  front-end é ignorado, então uma CRC não consegue enviar relatório em nome
  de outra.
- Como o token de login do Google Identity Services expira depois de um
  tempo, se aparecer o erro "Token inválido" ao salvar, peça para a pessoa
  clicar em "sair" e entrar de novo antes de tentar salvar.
- Toda ação de login e de salvar relatório é registrada na aba "Logs" (quem,
  quando, o quê).
- `doGet` (leitura de usuários/relatórios do dia) não exige login — mesmo
  modelo já usado no painel de Alinhadores. É uma limitação aceita para uma
  ferramenta interna de equipe pequena; não exponha a URL publicamente.
