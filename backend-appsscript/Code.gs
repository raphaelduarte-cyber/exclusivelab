/**
 * Backend do Painel do Laboratório de Alinhadores — Exclusive Odontologia
 * Google Apps Script Web App sobre uma planilha Google Sheets.
 *
 * INSTALAÇÃO
 * 1. Crie uma planilha Google Sheets nova.
 * 2. Extensões > Apps Script. Apague o conteúdo padrão e cole este arquivo inteiro.
 * 3. Rode a função "setup" uma vez (menu Executar > setup). Autorize o script.
 * 4. Implantar > Nova implantação > tipo "App da Web".
 *    - Executar como: Eu
 *    - Quem pode acessar: Qualquer pessoa (ou "Qualquer pessoa com Google Workspace"
 *      se quiser restringir ao domínio da clínica)
 * 5. Copie a URL do Web App gerada e cole em CONFIG.API_URL no index.html.
 * 6. Login com o Google: crie um OAuth Client ID em
 *    https://console.cloud.google.com/apis/credentials (tipo "Aplicativo da
 *    Web", com as origens autorizadas do seu GitHub Pages e localhost de
 *    teste) e cole o Client ID abaixo em EXPECTED_AUD, e também em
 *    CONFIG.GOOGLE_CLIENT_ID no index.html.
 *
 * MODELO DE DADOS
 * Cada linha da aba "Casos" guarda o objeto Caso inteiro serializado em JSON
 * na coluna "dadosJSON" (fonte da verdade). Idem para a aba "Profissionais"
 * (objeto Profissional inteiro em JSON). As demais colunas só existem para
 * permitir uma leitura rápida/manual direto na planilha (não são recalculadas
 * automaticamente se você editar a célula à mão — edite via painel sempre
 * que possível).
 *
 * BOOTSTRAP DO PRIMEIRO ADMINISTRADOR
 * Ninguém começa marcado como administrador. Cadastre seu primeiro
 * profissional pelo painel (com o e-mail Gmail correto) e depois, direto na
 * aba "Profissionais" da planilha, marque a célula da coluna "administrador"
 * dessa linha como TRUE. A partir daí esse administrador pode promover os
 * demais pela própria tela "cadastro de profissionais".
 */

var SHEET_NAME = 'Casos';
var HEADERS = ['id', 'numeroCaso', 'paciente', 'tipoCaso', 'statusAtual', 'prioridade', 'dentistaPlanejador', 'atualizadoEm', 'dadosJSON'];

var SHEET_PROF_NAME = 'Profissionais';
var HEADERS_PROF = ['id', 'nomeCompleto', 'nomeCurto', 'funcao', 'email', 'administrador', 'ativo', 'dadosJSON'];

// Cole aqui o Client ID gerado no Google Cloud Console (Client ID OAuth, tipo
// "Aplicativo da Web") — usado para validar o token de login com o Google.
// Formato: "xxxxxxxxxxxx.apps.googleusercontent.com"
var EXPECTED_AUD = '668827078020-k0cujbre0poh5la5elvtp0u7a13i12e4.apps.googleusercontent.com';

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }
  var sheetProf = ss.getSheetByName(SHEET_PROF_NAME);
  if (!sheetProf) {
    sheetProf = ss.insertSheet(SHEET_PROF_NAME);
  }
  if (sheetProf.getLastRow() === 0) {
    sheetProf.getRange(1, 1, 1, HEADERS_PROF.length).setValues([HEADERS_PROF]);
    sheetProf.setFrozenRows(1);
  }
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    setup();
    sheet = ss.getSheetByName(SHEET_NAME);
  }
  return sheet;
}

function getSheetProf_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_PROF_NAME);
  if (!sheet) {
    setup();
    sheet = ss.getSheetByName(SHEET_PROF_NAME);
  }
  return sheet;
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** GET => devolve casos e profissionais em JSON: { ok:true, casos:[...], profissionais:[...] } */
function doGet(e) {
  return jsonResponse_({ ok: true, casos: lerCasos_(), profissionais: lerProfissionais_() });
}

function lerCasos_() {
  var sheet = getSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var rows = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  var casos = [];
  for (var i = 0; i < rows.length; i++) {
    var raw = rows[i][HEADERS.indexOf('dadosJSON')];
    if (!raw) continue;
    try {
      casos.push(JSON.parse(raw));
    } catch (err) {
      // linha corrompida/editada manualmente de forma inválida: ignora
    }
  }
  return casos;
}

function lerProfissionais_() {
  var sheet = getSheetProf_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var rows = sheet.getRange(2, 1, lastRow - 1, HEADERS_PROF.length).getValues();
  var lista = [];
  for (var i = 0; i < rows.length; i++) {
    var raw = rows[i][HEADERS_PROF.indexOf('dadosJSON')];
    if (!raw) continue;
    try {
      lista.push(JSON.parse(raw));
    } catch (err) {
      // linha corrompida/editada manualmente de forma inválida: ignora
    }
  }
  return lista;
}

/**
 * POST => cria/atualiza/apaga casos, salva a lista de profissionais, ou faz login.
 * Body esperado (texto simples, para evitar preflight de CORS):
 *   { "action": "upsert", "caso": { ...objeto Caso completo... } }
 *   { "action": "delete", "id": "...", "solicitanteEmail": "..." }
 *   { "action": "saveProfissionais", "profissionais": [ ...lista completa... ] }
 *   { "action": "login", "idToken": "..." }
 */
function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse_({ ok: false, error: 'JSON inválido no corpo da requisição' });
  }

  if (body.action === 'login') {
    return fazerLogin_(body.idToken);
  }

  if (body.action === 'saveProfissionais') {
    salvarProfissionais_(body.profissionais || []);
    return jsonResponse_({ ok: true });
  }

  if (body.action === 'delete') {
    if (!solicitanteEhAdministrador_(body.solicitanteEmail)) {
      return jsonResponse_({ ok: false, error: 'Apenas administradores podem excluir.' });
    }
    removeCaso_(getSheet_(), body.id);
    return jsonResponse_({ ok: true });
  }

  if (body.action === 'upsert') {
    upsertCaso_(getSheet_(), body.caso);
    return jsonResponse_({ ok: true, caso: body.caso });
  }

  return jsonResponse_({ ok: false, error: 'Ação desconhecida: ' + body.action });
}

/** Valida o idToken do Google Identity Services e devolve o profissional correspondente. */
function fazerLogin_(idToken) {
  if (!idToken) return jsonResponse_({ ok: false, error: 'Token ausente.' });
  var info;
  try {
    var resp = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), { muteHttpExceptions: true });
    info = JSON.parse(resp.getContentText());
  } catch (err) {
    return jsonResponse_({ ok: false, error: 'Falha ao validar token com o Google.' });
  }
  if (!info || info.error || !info.email || info.email_verified !== 'true') {
    return jsonResponse_({ ok: false, error: 'Token inválido ou e-mail não verificado.' });
  }
  if (EXPECTED_AUD && info.aud !== EXPECTED_AUD) {
    return jsonResponse_({ ok: false, error: 'Token não pertence a este aplicativo.' });
  }
  var email = String(info.email).toLowerCase();
  var lista = lerProfissionais_();
  var perfil = null;
  for (var i = 0; i < lista.length; i++) {
    if (String(lista[i].email || '').toLowerCase() === email) { perfil = lista[i]; break; }
  }
  if (!perfil) {
    return jsonResponse_({ ok: false, error: 'Seu e-mail (' + email + ') não está cadastrado. Peça para um administrador cadastrar você em "cadastro de profissionais".' });
  }
  if (perfil.ativo === false) {
    return jsonResponse_({ ok: false, error: 'Seu cadastro está inativo. Fale com um administrador.' });
  }
  return jsonResponse_({ ok: true, perfil: perfil });
}

function solicitanteEhAdministrador_(email) {
  if (!email) return false;
  var alvo = String(email).toLowerCase();
  var lista = lerProfissionais_();
  for (var i = 0; i < lista.length; i++) {
    if (String(lista[i].email || '').toLowerCase() === alvo) return !!lista[i].administrador;
  }
  return false;
}

function findRowById_(sheet, id) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === id) return i + 2; // linha real na planilha (1-indexed, +1 pelo cabeçalho)
  }
  return -1;
}

function upsertCaso_(sheet, caso) {
  caso.atualizadoEm = new Date().toISOString();
  var rowValues = [
    caso.id,
    caso.numeroCaso || '',
    caso.paciente || '',
    caso.tipoCaso || '',
    caso.statusAtual || '',
    caso.prioridade || '',
    caso.dentistaPlanejador || '',
    caso.atualizadoEm,
    JSON.stringify(caso)
  ];
  var rowIndex = findRowById_(sheet, caso.id);
  if (rowIndex === -1) {
    sheet.appendRow(rowValues);
  } else {
    sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
  }
}

function removeCaso_(sheet, id) {
  var rowIndex = findRowById_(sheet, id);
  if (rowIndex !== -1) {
    sheet.deleteRow(rowIndex);
  }
}

/** Regrava a aba Profissionais inteira a partir da lista recebida (mesmo contrato do modo mysql). */
function salvarProfissionais_(lista) {
  var sheet = getSheetProf_();
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, HEADERS_PROF.length).clearContent();
  }
  if (!lista.length) return;
  var rows = lista.map(function (p) {
    return [
      p.id, p.nomeCompleto || '', p.nomeCurto || '', p.funcao || '',
      String(p.email || '').toLowerCase(), !!p.administrador, p.ativo !== false,
      JSON.stringify(p)
    ];
  });
  sheet.getRange(2, 1, rows.length, HEADERS_PROF.length).setValues(rows);
}
