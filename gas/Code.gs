const PARTICIPANT_SHEET = '参加者';

function doGet(e) {
  try {
    const mode = e?.parameter?.mode || 'list';
    if (mode === 'list') return jsonResponse_({ participants: getParticipants_(e.parameter.tournamentId) });
    if (mode === 'register') return registerParticipant_(e.parameter);
    if (mode === 'delete') return deleteParticipant_(e.parameter);
    throw new Error(`未対応のmodeです: ${mode}`);
  } catch (error) {
    return jsonResponse_({ error: error.message });
  }
}

function deleteParticipant_(parameter) {
  const id = String(parameter.id || '').trim();
  if (!id) throw new Error('削除対象のIDがありません');
  const sheet = getParticipantSheet_();
  const ids = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 1), 1).getValues();
  const index = ids.findIndex(row => String(row[0]) === id);
  if (index < 0) throw new Error('参加者が見つかりません');
  sheet.deleteRow(index + 2);
  return jsonResponse_({ deleted: id });
}

function registerParticipant_(parameter) {
  const name = String(parameter.name || '').trim();
  const tournamentId = String(parameter.tournamentId || '').trim();
  if (!name) throw new Error('名前は必須です');
  if (!tournamentId) throw new Error('大会IDは必須です');
  const sheet = getParticipantSheet_();
  const row = sheet.getLastRow() + 1;
  const id = `P${String(row - 1).padStart(3, '0')}`;
  const seed = Number(parameter.seed) || row - 1;
  sheet.getRange(row, 1, 1, 5).setValues([[id, name, seed, '参加', tournamentId]]);
  return jsonResponse_({ participant: { id, name, seed } });
}

function getParticipants_(tournamentId) {
  if (!tournamentId) throw new Error('大会IDは必須です');
  return getParticipantSheet_().getDataRange().getValues().slice(1)
    .filter(row => row[1] && String(row[3] || '参加') === '参加' && String(row[4]) === tournamentId)
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
