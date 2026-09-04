const PARTICIPANT_SHEET = '参加者';

function doGet(e) {
  try {
    const mode = e?.parameter?.mode || 'list';
    if (mode === 'list') return jsonResponse_({ participants: getParticipants_() });
    if (mode === 'register') return registerParticipant_(e.parameter);
    throw new Error(`未対応のmodeです: ${mode}`);
  } catch (error) {
    return jsonResponse_({ error: error.message });
  }
}

function registerParticipant_(parameter) {
  const name = String(parameter.name || '').trim();
  if (!name) throw new Error('名前は必須です');
  const sheet = getParticipantSheet_();
  const row = sheet.getLastRow() + 1;
  const id = `P${String(row - 1).padStart(3, '0')}`;
  const seed = Number(parameter.seed) || row - 1;
  sheet.getRange(row, 1, 1, 4).setValues([[id, name, seed, '参加']]);
  return jsonResponse_({ participant: { id, name, seed } });
}

function getParticipants_() {
  return getParticipantSheet_().getDataRange().getValues().slice(1)
    .filter(row => row[1] && String(row[3] || '参加') === '参加')
    .map(row => ({ id: String(row[0]), name: String(row[1]), seed: Number(row[2]) || 999 }));
}

function getParticipantSheet_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PARTICIPANT_SHEET);
  if (!sheet) throw new Error(`「${PARTICIPANT_SHEET}」シートがありません`);
  return sheet;
}

function jsonResponse_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
