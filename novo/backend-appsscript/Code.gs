/**
 * Backend do módulo CRC (Inteligência Comercial) — Rede Exclusive Odontologia
 * Google Apps Script Web App sobre uma planilha Google Sheets própria,
 * independente da planilha do Laboratório de Alinhadores.
 *
 * ETAPA 1: login + estrutura de abas + salvar relatório diário da CRC.
 * As abas Indicadores/Ranking/Configurações/Dashboard/Histórico já são criadas
 * agora (todas as 10 abas do módulo), mas só ganham lógica nas próximas etapas.
 *
 * INSTALAÇÃO
 * 1. Crie uma planilha Google Sheets nova (separada da do Laboratório).
 * 2. Extensões > Apps Script. Apague o conteúdo padrão e cole este arquivo inteiro.
 * 3. Rode a função "setup" uma vez (menu Executar > setup). Autorize o script.
 *    Isso cria as 10 abas do módulo com seus cabeçalhos.
 * 4. Implantar > Nova implantação > tipo "App da Web".
 *    - Executar como: Eu
 *    - Quem pode acessar: Qualquer pessoa
 * 5. Copie a URL do Web App gerada (termina em /exec) e cole em CONFIG.API_URL
 *    no index.html.
 * 6. Crie um OAuth Client ID em https://console.cloud.google.com/apis/credentials
 *    (tipo "Aplicativo da Web", com a origem do GitHub Pages e localhost de
 *    teste nas origens autorizadas) e cole o Client ID abaixo em EXPECTED_AUD,
 *    e também em CONFIG.GOOGLE_CLIENT_ID no index.html.
 * 7. Cadastre manualmente as linhas iniciais na aba "Usuários" da planilha
 *    (id, nomeCompleto, nomeCurto, email, perfil ["Administrador" ou "CRC"],
 *    ativo=TRUE) — não há tela de cadastro nesta etapa, isso chega na Etapa 3.
 *
 * MODELO DE DADOS
 * Cada linha guarda o objeto completo serializado em JSON na coluna
 * "dadosJSON" (fonte da verdade). As demais colunas existem só para permitir
 * leitura rápida direto na planilha.
 */

var SHEET_USUARIOS = 'Usuários';
var SHEET_RELATORIOS = 'Relatórios';
var SHEET_OPORTUNIDADES = 'Oportunidades';
var SHEET_PACIENTES_FALTANTES = 'Pacientes Faltantes';
var SHEET_METAS = 'Metas';
var SHEET_LOGS = 'Logs';
var OUTRAS_ABAS_RESERVADAS = ['Indicadores', 'Ranking', 'Configurações', 'Dashboard', 'Histórico'];

var HEADERS_USUARIOS = ['id', 'nomeCompleto', 'nomeCurto', 'email', 'perfil', 'ativo', 'dadosJSON'];
var HEADERS_RELATORIOS = [
  'id', 'data', 'crcEmail', 'crcNome',
  // Controle de leads - dia
  'leadsEntraram', 'leadsTrabalhados', 'leadsAgendados',
  'leadsRetornoContato', 'leadsSemInteresse', 'leadsSemRetorno',
  // Controle de comparecimento - dia
  'pacientesAgendadosDia', 'compareceram', 'faltaram', 'reagendaram', 'semRetornoConfirmacao',
  // Controle de resgate - leads antigos
  'resgateTrabalhados', 'resgateAgendados', 'resgateRetornoComunicacao', 'resgateSemInteresse', 'resgateSemRetorno',
  'principalObjecao', 'qualidadeLead', 'motivoQualidadeLead', 'criadoEm', 'dadosJSON'
];
var HEADERS_OPORTUNIDADES = [
  'id', 'relatorioId', 'data', 'crcEmail', 'crcNome',
  'paciente', 'telefone', 'procedimento', 'temperatura', 'proximaAcao', 'melhorHorario',
  'observacao', 'criadoEm', 'dadosJSON'
];
// Status possíveis da fila de reativação — nasce sempre como 'Não agendado'.
// 'Reagendado' não fica salvo: quando o status vira esse, a linha é excluída
// da planilha (ver atualizarStatusFaltante_).
var STATUS_FALTANTES = ['Não agendado', 'Reagendado', 'Não deseja reagendar'];
var HEADERS_PACIENTES_FALTANTES = [
  'id', 'relatorioId', 'data', 'crcEmail', 'crcNome', 'nome', 'telefone',
  'procedimento', 'profissional', 'status', 'tentativasContato', 'ultimoContato',
  'observacao', 'novaData', 'novoHorario', 'novoLocal', 'criadoEm', 'atualizadoEm', 'dadosJSON'
];
var HEADERS_LOGS = ['id', 'data', 'hora', 'usuarioEmail', 'usuarioNome', 'acao', 'detalhes', 'criadoEm'];
// Uma linha por CRC/mês — chave é crcEmail + anoMes (upsert, nunca duplica).
// 3 patamares crescentes do mesmo indicador (agendamentos no mês): Meta é o
// mínimo esperado, Mega Meta é o ótimo, Super Meta é o excelente.
var HEADERS_METAS = ['crcEmail', 'anoMes', 'metaAgendamentos', 'metaMegaAgendamentos', 'metaSuperAgendamentos', 'atualizadoEm', 'dadosJSON'];

// Cole aqui o Client ID gerado no Google Cloud Console (Client ID OAuth, tipo
// "Aplicativo da Web") — usado para validar o token de login com o Google.
// Formato: "xxxxxxxxxxxx.apps.googleusercontent.com"
var EXPECTED_AUD = '668827078020-k0cujbre0poh5la5elvtp0u7a13i12e4.apps.googleusercontent.com';

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  criarAbaComHeaders_(ss, SHEET_USUARIOS, HEADERS_USUARIOS);
  criarAbaComHeaders_(ss, SHEET_RELATORIOS, HEADERS_RELATORIOS);
  criarAbaComHeaders_(ss, SHEET_OPORTUNIDADES, HEADERS_OPORTUNIDADES);
  criarAbaComHeaders_(ss, SHEET_PACIENTES_FALTANTES, HEADERS_PACIENTES_FALTANTES);
  criarAbaComHeaders_(ss, SHEET_METAS, HEADERS_METAS);
  criarAbaComHeaders_(ss, SHEET_LOGS, HEADERS_LOGS);
  OUTRAS_ABAS_RESERVADAS.forEach(function (nome) {
    criarAbaComHeaders_(ss, nome, ['Reservado para uma próxima etapa do módulo CRC — sem dados ainda.']);
  });
}

function criarAbaComHeaders_(ss, nome, headers) {
  var sheet = ss.getSheetByName(nome);
  if (!sheet) sheet = ss.insertSheet(nome);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
}

function getSheet_(nome) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(nome);
  if (!sheet) {
    setup();
    sheet = ss.getSheetByName(nome);
  }
  return sheet;
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** GET => devolve usuários, relatórios de hoje, relatórios do mês (para o IE-CRC e o Dashboard Executivo), oportunidades do mês, e a fila de pacientes faltantes ATIVOS (todas as CRCs — o front-end filtra pela própria).
 *  A fila de faltantes só devolve os ativos (não reagendados ainda) por padrão
 *  — os já resolvidos ficam de fora da resposta para a leitura não crescer
 *  sem limite conforme o histórico acumula; eles continuam existindo na
 *  planilha normalmente. */
function doGet(e) {
  var hoje = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var mesAtual = hoje.slice(0, 7);
  return jsonResponse_({
    ok: true,
    usuarios: lerUsuarios_(),
    relatoriosHoje: lerRelatoriosPorData_(hoje),
    relatoriosMes: lerRelatoriosPorMes_(mesAtual),
    oportunidadesMes: lerOportunidadesPorMes_(mesAtual),
    pacientesFaltantes: lerPacientesFaltantesAtivos_(),
    metas: lerMetasDoMes_(mesAtual)
  });
}

/**
 * POST => login, salvar relatório diário, cadastrar/atualizar usuário,
 * atualizar o status de um paciente na fila de reativação, ou definir a
 * meta mensal de uma CRC.
 * Body esperado (texto simples, para evitar preflight de CORS):
 *   { "action": "login", "idToken": "..." }
 *   { "action": "salvarRelatorio", "idToken": "...", "relatorio": { ...campos do formulário... } }
 *   { "action": "salvarUsuario", "idToken": "...", "usuario": { nomeCompleto, nomeCurto, email, perfil } }
 *   { "action": "atualizarStatusFaltante", "idToken": "...", "id": "...", "mudancas": { status?, incrementarTentativa?, observacao?, novaData?, novoHorario?, novoLocal? } }
 *   { "action": "salvarMeta", "idToken": "...", "crcEmail": "...", "metas": { "meta": 80, "mega": 100, "super": 120 } }
 */
function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse_({ ok: false, error: 'JSON inválido no corpo da requisição.' });
  }

  if (body.action === 'login') return fazerLogin_(body.idToken);
  if (body.action === 'salvarRelatorio') return salvarRelatorio_(body.idToken, body.relatorio);
  if (body.action === 'salvarUsuario') return salvarUsuario_(body.idToken, body.usuario);
  if (body.action === 'atualizarStatusFaltante') return atualizarStatusFaltante_(body.idToken, body.id, body.mudancas);
  if (body.action === 'salvarMeta') return salvarMeta_(body.idToken, body.crcEmail, body.metas);

  return jsonResponse_({ ok: false, error: 'Ação desconhecida: ' + body.action });
}

function lerSheetJSON_(sheetName, headers) {
  var sheet = getSheet_(sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var idx = headers.indexOf('dadosJSON');
  var rows = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  var lista = [];
  for (var i = 0; i < rows.length; i++) {
    var raw = rows[i][idx];
    if (!raw) continue;
    try {
      lista.push(JSON.parse(raw));
    } catch (err) {
      // linha corrompida/editada manualmente de forma inválida: ignora
    }
  }
  return lista;
}

function lerUsuarios_() { return lerSheetJSON_(SHEET_USUARIOS, HEADERS_USUARIOS); }
function lerRelatorios_() { return lerSheetJSON_(SHEET_RELATORIOS, HEADERS_RELATORIOS); }
function lerRelatoriosPorData_(dataISO) {
  return lerRelatorios_().filter(function (r) { return r.data === dataISO; });
}
/** Todos os relatórios de um mês (formato 'yyyy-MM'), de todas as CRCs — usado para calcular o IE-CRC do mês atual. */
function lerRelatoriosPorMes_(anoMes) {
  return lerRelatorios_().filter(function (r) { return String(r.data || '').slice(0, 7) === anoMes; });
}
function lerOportunidades_() { return lerSheetJSON_(SHEET_OPORTUNIDADES, HEADERS_OPORTUNIDADES); }
/** Oportunidades de um mês (formato 'yyyy-MM'), de todas as CRCs — usado no Dashboard Executivo (temperatura, procedimentos, oportunidades quentes sem ação). */
function lerOportunidadesPorMes_(anoMes) {
  return lerOportunidades_().filter(function (o) { return String(o.data || '').slice(0, 7) === anoMes; });
}
function lerPacientesFaltantes_() { return lerSheetJSON_(SHEET_PACIENTES_FALTANTES, HEADERS_PACIENTES_FALTANTES); }
/** Reduz o tamanho da resposta conforme o histórico de resolvidos antigos cresce — 'Reagendado' nunca fica salvo (a linha é excluída ao virar esse status). */
function lerPacientesFaltantesAtivos_() {
  // 'Reagendado' nunca fica salvo (a linha é excluída ao virar esse status),
  // então tudo que sobra na planilha já é ativo por definição.
  return lerPacientesFaltantes_();
}

function lerMetas_() { return lerSheetJSON_(SHEET_METAS, HEADERS_METAS); }
function lerMetasDoMes_(anoMes) {
  return lerMetas_().filter(function (m) { return m.anoMes === anoMes; });
}

/** Acha, dentro da carteira de uma CRC, um paciente faltante ainda ativo (não reagendado) com o mesmo telefone (ou nome, se telefone vazio) — evita duplicar quando ele falta de novo antes de ser resgatado. */
function buscarFaltanteAtivoPorContato_(crcEmail, nome, telefone) {
  var lista = lerPacientesFaltantes_();
  var telefoneAlvo = String(telefone || '').replace(/\D/g, '');
  var nomeAlvo = String(nome || '').trim().toLowerCase();
  for (var i = 0; i < lista.length; i++) {
    var f = lista[i];
    if (f.crcEmail !== crcEmail) continue;
    if (f.status === 'Reagendado') continue;
    var mesmoTelefone = telefoneAlvo && String(f.telefone || '').replace(/\D/g, '') === telefoneAlvo;
    var mesmoNome = !telefoneAlvo && nomeAlvo && String(f.nome || '').trim().toLowerCase() === nomeAlvo;
    if (mesmoTelefone || mesmoNome) return f;
  }
  return null;
}

function buscarPacienteFaltantePorId_(id) {
  var lista = lerPacientesFaltantes_();
  for (var i = 0; i < lista.length; i++) {
    if (lista[i].id === id) return lista[i];
  }
  return null;
}

function upsertPacienteFaltante_(registro) {
  var sheet = getSheet_(SHEET_PACIENTES_FALTANTES);
  var rowIndex = findRowByColumnValue_(sheet, HEADERS_PACIENTES_FALTANTES, 'id', registro.id);
  var row = HEADERS_PACIENTES_FALTANTES.map(function (h) {
    if (h === 'dadosJSON') return JSON.stringify(registro);
    var v = registro[h];
    return (v === undefined || v === null) ? '' : v;
  });
  if (rowIndex === -1) {
    sheet.appendRow(row);
  } else {
    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  }
}

function buscarUsuarioPorEmail_(email) {
  var lista = lerUsuarios_();
  for (var i = 0; i < lista.length; i++) {
    if (String(lista[i].email || '').toLowerCase() === email) return lista[i];
  }
  return null;
}

/** Cadastra ou atualiza um usuário (upsert por e-mail).
 *  Bootstrap: enquanto a aba "Usuários" estiver vazia, libera o cadastro sem
 *  exigir login/administrador — senão ninguém jamais conseguiria entrar — e o
 *  primeiro usuário sempre nasce Administrador, ignorando o perfil enviado.
 *  Fora do bootstrap, só um Administrador já autenticado pode cadastrar gente nova. */
function salvarUsuario_(idToken, usuario) {
  if (!usuario || !String(usuario.email || '').trim()) {
    return jsonResponse_({ ok: false, error: 'E-mail é obrigatório.' });
  }
  var bootstrap = lerUsuarios_().length === 0;
  var solicitante = null;
  if (!bootstrap) {
    var v = validarTokenGoogle_(idToken);
    if (!v.ok) return jsonResponse_({ ok: false, error: v.error });
    solicitante = buscarUsuarioPorEmail_(v.email);
    if (!solicitante || solicitante.perfil !== 'Administrador') {
      return jsonResponse_({ ok: false, error: 'Apenas administradores podem cadastrar usuários.' });
    }
  }

  var email = String(usuario.email).toLowerCase().trim();
  var existente = buscarUsuarioPorEmail_(email);
  // Preserva os dados já cadastrados quando não vierem no pedido (ex.: ao
  // só ativar/desativar, não perde nomeCompleto/nomeCurto/perfil já salvos).
  var novo = {
    id: (existente && existente.id) || ('usr-' + new Date().getTime() + '-' + Math.floor(Math.random() * 1e6)),
    nomeCompleto: usuario.nomeCompleto || (existente && existente.nomeCompleto) || '',
    nomeCurto: usuario.nomeCurto || (existente && existente.nomeCurto) || usuario.nomeCompleto || '',
    email: email,
    perfil: bootstrap ? 'Administrador' : (usuario.perfil || (existente && existente.perfil) || 'CRC'),
    ativo: usuario.ativo !== undefined ? !!usuario.ativo : (existente ? existente.ativo !== false : true)
  };
  upsertUsuario_(novo);
  registrarLog_(
    bootstrap ? email : solicitante.email,
    bootstrap ? novo.nomeCurto : solicitante.nomeCurto,
    'salvarUsuario',
    'Cadastrou ' + email + (bootstrap ? ' (bootstrap — primeiro administrador)' : '')
  );
  return jsonResponse_({ ok: true, usuario: novo });
}

function findRowByColumnValue_(sheet, headers, colName, value) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var idx = headers.indexOf(colName);
  var col = sheet.getRange(2, idx + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < col.length; i++) {
    if (String(col[i][0] || '').toLowerCase() === String(value || '').toLowerCase()) return i + 2;
  }
  return -1;
}

function upsertUsuario_(usuario) {
  var sheet = getSheet_(SHEET_USUARIOS);
  var rowIndex = findRowByColumnValue_(sheet, HEADERS_USUARIOS, 'email', usuario.email);
  var row = HEADERS_USUARIOS.map(function (h) {
    if (h === 'dadosJSON') return JSON.stringify(usuario);
    var v = usuario[h];
    return (v === undefined || v === null) ? '' : v;
  });
  if (rowIndex === -1) {
    sheet.appendRow(row);
  } else {
    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  }
}

/** Só um Administrador define os 3 patamares de meta mensal (nº de agendamentos) de uma CRC: Meta, Mega Meta e Super Meta, sempre crescentes. Upsert por crcEmail+anoMes (mês atual). */
function salvarMeta_(idToken, crcEmail, metas) {
  var v = validarTokenGoogle_(idToken);
  if (!v.ok) return jsonResponse_({ ok: false, error: v.error });
  var solicitante = buscarUsuarioPorEmail_(v.email);
  if (!solicitante || solicitante.perfil !== 'Administrador') {
    return jsonResponse_({ ok: false, error: 'Apenas administradores podem definir metas.' });
  }
  if (!crcEmail) return jsonResponse_({ ok: false, error: 'CRC não informada.' });

  metas = metas || {};
  var meta = Number(metas.meta) || 0;
  var mega = Number(metas.mega) || 0;
  var superMeta = Number(metas.super) || 0;
  if (meta < 0 || mega < 0 || superMeta < 0) {
    return jsonResponse_({ ok: false, error: 'As metas não podem ser negativas.' });
  }
  if (mega < meta || superMeta < mega) {
    return jsonResponse_({ ok: false, error: 'A Mega Meta precisa ser maior ou igual à Meta, e a Super Meta maior ou igual à Mega Meta.' });
  }

  var anoMes = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM');
  var email = String(crcEmail).toLowerCase().trim();
  var sheet = getSheet_(SHEET_METAS);
  var lista = lerMetas_();
  var rowIndex = -1;
  for (var i = 0; i < lista.length; i++) {
    if (lista[i].crcEmail === email && lista[i].anoMes === anoMes) { rowIndex = i + 2; break; }
  }
  var registro = {
    crcEmail: email,
    anoMes: anoMes,
    metaAgendamentos: meta,
    metaMegaAgendamentos: mega,
    metaSuperAgendamentos: superMeta,
    atualizadoEm: new Date().toISOString()
  };
  var row = HEADERS_METAS.map(function (h) {
    if (h === 'dadosJSON') return JSON.stringify(registro);
    var val = registro[h];
    return (val === undefined || val === null) ? '' : val;
  });
  if (rowIndex === -1) {
    sheet.appendRow(row);
  } else {
    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  }
  registrarLog_(solicitante.email, solicitante.nomeCurto || solicitante.nomeCompleto, 'salvarMeta', 'Metas de ' + email + ' em ' + anoMes + ': ' + meta + ' / ' + mega + ' / ' + superMeta);
  return jsonResponse_({ ok: true, meta: registro });
}

/** Escreve um objeto como nova linha, usando os nomes dos headers como chaves do objeto + o blob completo em dadosJSON. */
function appendRowFromObj_(sheetName, headers, obj) {
  var sheet = getSheet_(sheetName);
  var row = headers.map(function (h) {
    if (h === 'dadosJSON') return JSON.stringify(obj);
    var v = obj[h];
    return (v === undefined || v === null) ? '' : v;
  });
  sheet.appendRow(row);
}

/** Valida o idToken do Google Identity Services e devolve o e-mail verificado (sem checar cadastro ainda). */
function validarTokenGoogle_(idToken) {
  if (!idToken) return { ok: false, error: 'Token ausente.' };
  var info;
  try {
    var resp = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), { muteHttpExceptions: true });
    info = JSON.parse(resp.getContentText());
  } catch (err) {
    return { ok: false, error: 'Falha ao validar token com o Google.' };
  }
  if (!info || info.error || !info.email || info.email_verified !== 'true') {
    return { ok: false, error: 'Token inválido ou e-mail não verificado.' };
  }
  if (EXPECTED_AUD && info.aud !== EXPECTED_AUD) {
    return { ok: false, error: 'Token não pertence a este aplicativo.' };
  }
  return { ok: true, email: String(info.email).toLowerCase() };
}

function fazerLogin_(idToken) {
  var v = validarTokenGoogle_(idToken);
  if (!v.ok) return jsonResponse_({ ok: false, error: v.error });
  var perfil = buscarUsuarioPorEmail_(v.email);
  if (!perfil) {
    return jsonResponse_({ ok: false, error: 'Seu e-mail (' + v.email + ') não está cadastrado. Peça para um administrador te cadastrar na aba "Usuários" da planilha.' });
  }
  if (perfil.ativo === false) {
    return jsonResponse_({ ok: false, error: 'Seu cadastro está inativo. Fale com um administrador.' });
  }
  registrarLog_(perfil.email, perfil.nomeCurto || perfil.nomeCompleto, 'login', '');
  return jsonResponse_({ ok: true, perfil: perfil });
}

/** Regras de consistência do relatório — nunca dividir por zero, nunca permitir números que não fazem sentido entre si. */
function validarRegrasRelatorio_(r) {
  var n = function (v) { v = Number(v); return isNaN(v) ? 0 : v; };
  if (n(r.leadsTrabalhados) > n(r.leadsEntraram)) return 'Leads trabalhados não podem ser mais que os leads que entraram no dia.';
  if (n(r.leadsAgendados) > n(r.leadsTrabalhados)) return 'Leads agendados não podem ser mais que leads trabalhados.';
  if (n(r.compareceram) > n(r.pacientesAgendadosDia)) return 'Compareceram não pode ser maior que pacientes agendados para o dia.';
  if (n(r.faltaram) > n(r.pacientesAgendadosDia)) return 'Faltaram não pode ser maior que pacientes agendados para o dia.';
  if (n(r.reagendaram) > n(r.pacientesAgendadosDia)) return 'Reagendaram não pode ser maior que pacientes agendados para o dia.';
  if (n(r.resgateAgendados) > n(r.resgateTrabalhados)) return 'Resgates agendados não podem ser mais que resgates trabalhados.';
  return null;
}

function salvarRelatorio_(idToken, relatorio) {
  var v = validarTokenGoogle_(idToken);
  if (!v.ok) return jsonResponse_({ ok: false, error: v.error });
  var perfil = buscarUsuarioPorEmail_(v.email);
  if (!perfil) return jsonResponse_({ ok: false, error: 'Usuário não cadastrado.' });
  if (perfil.ativo === false) return jsonResponse_({ ok: false, error: 'Seu cadastro está inativo.' });
  if (!relatorio) return jsonResponse_({ ok: false, error: 'Relatório ausente.' });

  var erro = validarRegrasRelatorio_(relatorio);
  if (erro) return jsonResponse_({ ok: false, error: erro });

  var agora = new Date();
  // crcEmail/crcNome vêm do perfil validado no servidor, nunca do que o
  // front-end mandou — evita uma CRC enviar relatório em nome de outra.
  relatorio.id = relatorio.id || ('rel-' + agora.getTime() + '-' + Math.floor(Math.random() * 1e6));
  relatorio.crcEmail = perfil.email;
  relatorio.crcNome = perfil.nomeCurto || perfil.nomeCompleto;
  relatorio.criadoEm = agora.toISOString();
  relatorio.data = relatorio.data || Utilities.formatDate(agora, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  appendRowFromObj_(SHEET_RELATORIOS, HEADERS_RELATORIOS, relatorio);

  // Até 2 oportunidades por relatório — só vira linha na aba se tiver paciente preenchido.
  var oportunidades = relatorio.oportunidades || [];
  oportunidades.forEach(function (oport, idx) {
    if (!oport || !String(oport.paciente || '').trim()) return;
    var oportunidade = {
      id: 'op-' + agora.getTime() + '-' + idx + '-' + Math.floor(Math.random() * 1e6),
      relatorioId: relatorio.id,
      data: relatorio.data,
      crcEmail: relatorio.crcEmail,
      crcNome: relatorio.crcNome,
      paciente: oport.paciente || '',
      telefone: oport.telefone || '',
      procedimento: oport.procedimento || '',
      temperatura: oport.temperatura || '',
      proximaAcao: oport.proximaAcao || '',
      melhorHorario: oport.melhorHorario || '',
      observacao: oport.observacao || '',
      criadoEm: agora.toISOString()
    };
    appendRowFromObj_(SHEET_OPORTUNIDADES, HEADERS_OPORTUNIDADES, oportunidade);
  });

  // Pacientes que faltaram e não reagendaram — banco próprio, acumulado de
  // todos os dias/CRCs, para a gestão sempre conseguir resgatar esses contatos.
  // Se o paciente já estiver ativo na fila (não reagendado ainda), só atualiza
  // a falta mais recente em vez de duplicar; senão entra como um caso novo.
  var faltantes = relatorio.pacientesFaltantesSemRetorno || [];
  faltantes.forEach(function (pf, idx) {
    if (!pf || (!String(pf.nome || '').trim() && !String(pf.telefone || '').trim())) return;
    var existente = buscarFaltanteAtivoPorContato_(relatorio.crcEmail, pf.nome, pf.telefone);
    if (existente) {
      existente.data = relatorio.data;
      existente.atualizadoEm = agora.toISOString();
      upsertPacienteFaltante_(existente);
      return;
    }
    var registroFaltante = {
      id: 'falt-' + agora.getTime() + '-' + idx + '-' + Math.floor(Math.random() * 1e6),
      relatorioId: relatorio.id,
      data: relatorio.data,
      crcEmail: relatorio.crcEmail,
      crcNome: relatorio.crcNome,
      nome: pf.nome || '',
      telefone: pf.telefone || '',
      status: 'Não agendado',
      tentativasContato: 0,
      ultimoContato: '',
      observacao: '',
      criadoEm: agora.toISOString(),
      atualizadoEm: agora.toISOString()
    };
    appendRowFromObj_(SHEET_PACIENTES_FALTANTES, HEADERS_PACIENTES_FALTANTES, registroFaltante);
  });

  registrarLog_(relatorio.crcEmail, relatorio.crcNome, 'salvarRelatorio', 'Relatório do dia ' + relatorio.data);
  return jsonResponse_({ ok: true, relatorio: relatorio });
}

/** Atualiza status/tentativas/reagendamento de um paciente da fila de reativação.
 *  Só a própria CRC dona do paciente (ou um Administrador) pode alterar. */
function atualizarStatusFaltante_(idToken, id, mudancas) {
  var v = validarTokenGoogle_(idToken);
  if (!v.ok) return jsonResponse_({ ok: false, error: v.error });
  var perfil = buscarUsuarioPorEmail_(v.email);
  if (!perfil) return jsonResponse_({ ok: false, error: 'Usuário não cadastrado.' });
  if (perfil.ativo === false) return jsonResponse_({ ok: false, error: 'Seu cadastro está inativo.' });
  if (!id) return jsonResponse_({ ok: false, error: 'Paciente não informado.' });

  var registro = buscarPacienteFaltantePorId_(id);
  if (!registro) return jsonResponse_({ ok: false, error: 'Paciente não encontrado.' });
  if (perfil.perfil !== 'Administrador' && registro.crcEmail !== perfil.email) {
    return jsonResponse_({ ok: false, error: 'Você só pode alterar pacientes da sua carteira.' });
  }

  mudancas = mudancas || {};
  var statusAnterior = registro.status;

  // Reagendado não fica salvo: sai da fila E da planilha (pedido explícito —
  // diferente do resto do sistema, aqui não guarda histórico do resolvido).
  if (mudancas.status === 'Reagendado') {
    var sheet = getSheet_(SHEET_PACIENTES_FALTANTES);
    var rowIndex = findRowByColumnValue_(sheet, HEADERS_PACIENTES_FALTANTES, 'id', id);
    if (rowIndex !== -1) sheet.deleteRow(rowIndex);
    registrarLog_(
      perfil.email, perfil.nomeCurto || perfil.nomeCompleto, 'atualizarStatusFaltante',
      'Paciente ' + registro.nome + ': ' + statusAnterior + ' -> Reagendado (removido da fila)'
    );
    return jsonResponse_({ ok: true, removido: true, id: id });
  }

  if (mudancas.status && STATUS_FALTANTES.indexOf(mudancas.status) !== -1) {
    registro.status = mudancas.status;
  }
  if (mudancas.incrementarTentativa) {
    registro.tentativasContato = (Number(registro.tentativasContato) || 0) + 1;
    registro.ultimoContato = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  if (mudancas.observacao !== undefined) registro.observacao = mudancas.observacao;
  registro.atualizadoEm = new Date().toISOString();

  upsertPacienteFaltante_(registro);
  registrarLog_(
    perfil.email, perfil.nomeCurto || perfil.nomeCompleto, 'atualizarStatusFaltante',
    'Paciente ' + registro.nome + ': ' + statusAnterior + ' -> ' + registro.status
  );
  return jsonResponse_({ ok: true, paciente: registro });
}

function registrarLog_(email, nome, acao, detalhes) {
  try {
    var agora = new Date();
    var log = {
      id: 'log-' + agora.getTime() + '-' + Math.floor(Math.random() * 1e6),
      data: Utilities.formatDate(agora, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      hora: Utilities.formatDate(agora, Session.getScriptTimeZone(), 'HH:mm:ss'),
      usuarioEmail: email || '',
      usuarioNome: nome || '',
      acao: acao || '',
      detalhes: detalhes || '',
      criadoEm: agora.toISOString()
    };
    var sheet = getSheet_(SHEET_LOGS);
    sheet.appendRow(HEADERS_LOGS.map(function (h) { return log[h] !== undefined ? log[h] : ''; }));
  } catch (err) {
    // uma falha ao gravar o log nunca deve quebrar a ação principal
  }
}
