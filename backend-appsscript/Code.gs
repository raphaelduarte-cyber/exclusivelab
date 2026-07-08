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
 *
 * MODELO DE DADOS
 * Cada linha da aba "Casos" guarda o objeto Caso inteiro serializado em JSON
 * na coluna "dadosJSON" (fonte da verdade). As demais colunas só existem para
 * permitir uma leitura rápida/manual direto na planilha (não são recalculadas
 * automaticamente se você editar a célula à mão — edite via painel sempre
 * que possível).
 */

var SHEET_NAME = 'Casos';
var HEADERS = ['id', 'numeroCaso', 'paciente', 'tipoCaso', 'statusAtual', 'prioridade', 'dentistaPlanejador', 'atualizadoEm', 'dadosJSON'];

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

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** GET => devolve todos os casos em JSON: { ok: true, casos: [...] } */
function doGet(e) {
  var sheet = getSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return jsonResponse_({ ok: true, casos: [] });
  }
  var rows = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  var casos = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var raw = row[HEADERS.indexOf('dadosJSON')];
    if (!raw) continue;
    try {
      casos.push(JSON.parse(raw));
    } catch (err) {
      // linha corrompida/editada manualmente de forma inválida: ignora
    }
  }
  return jsonResponse_({ ok: true, casos: casos });
}

/**
 * POST => cria ou atualiza um caso.
 * Body esperado (texto simples, para evitar preflight de CORS):
 *   { "action": "upsert", "caso": { ...objeto Caso completo... } }
 *   { "action": "delete", "id": "..." }
 */
function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse_({ ok: false, error: 'JSON inválido no corpo da requisição' });
  }

  var sheet = getSheet_();

  if (body.action === 'delete') {
    removeCaso_(sheet, body.id);
    return jsonResponse_({ ok: true });
  }

  if (body.action === 'upsert') {
    upsertCaso_(sheet, body.caso);
    return jsonResponse_({ ok: true, caso: body.caso });
  }

  return jsonResponse_({ ok: false, error: 'Ação desconhecida: ' + body.action });
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
