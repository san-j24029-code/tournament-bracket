const PARTICIPANT_SHEET = '参加者';
const ADMIN_PASSWORD = 'admin';

function doGet(e) {
  try {
    const mode = e?.parameter?.mode || 'list';
    if (mode === 'list') return jsonResponse_({ participants: getParticipants_(e.parameter.tournamentId) });
    if (mode === 'login') return login_(e.parameter);
    requireAdmin_(e.parameter.password);
    if (mode === 'register') return registerParticipant_(e.parameter);
    if (mode === 'delete') return deleteParticipant_(e.parameter);
    if (mode === 'reset') return resetTournament_(e.parameter);
    throw new Error(`未対応のmodeです: ${mode}`);
  } catch (error) {
    return jsonResponse_({ error: error.message });
  }
}

function login_(parameter) {
  if (String(parameter.password || '') !== ADMIN_PASSWORD) throw new Error('パスワードが違います');
  return jsonResponse_({ authenticated: true });
}

function requireAdmin_(password) {
  if (String(password || '') !== ADMIN_PASSWORD) throw new Error('管理者ログインが必要です');
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

function resetTournament_(parameter) {
  const tournamentId = String(parameter.tournamentId || '').trim();
  if (!tournamentId) throw new Error('大会IDは必須です');
  const sheet = getParticipantSheet_();
  const values = sheet.getDataRange().getValues();
  for (let i = values.length - 1; i >= 1; i--) {
    if (String(values[i][4]) === tournamentId) sheet.deleteRow(i + 1);
  }
  return jsonResponse_({ reset: true });
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
