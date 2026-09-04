// GASのWebアプリURLを設定すると、GASから参加者データを取得できます。
const API_URL = "https://script.google.com/macros/s/AKfycbz0HCH0S-yDo3HCVMLgSVZjcVXJrqGsTlldbS_wefz9q7Mzx9coswzwsSt6EBhpHDOPJg/exec";
let participants = [];
let tournamentId = localStorage.getItem("tournamentId") || crypto.randomUUID();
localStorage.setItem("tournamentId", tournamentId);
const pageRole = location.pathname.endsWith("/admin.html") ? "admin" : location.pathname.endsWith("/user.html") ? "user" : "select";
// user.htmlでは、管理者のセッションが残っていても必ず閲覧専用にする。
let adminPassword = pageRole === "user" ? "" : sessionStorage.getItem("adminPassword") || "";

function enterAsUser_() {
  document.body.classList.add("viewer-mode");
  document.querySelector("#login-screen")?.classList.add("hidden");
  document.querySelector("main")?.classList.remove("hidden");
}

function normalizeParticipants_(items) {
  return (items || []).map((item, index) => typeof item === "string"
    ? { id: `P${String(index + 1).padStart(3, "0")}`, name: item, seed: index + 1 }
    : { ...item, id: item.id || `P${String(index + 1).padStart(3, "0")}`, name: item.name || item["参加者名"] || "名前未設定", seed: item.seed || index + 1 });
}

function createRounds(participants) {
  if (!participants.length) throw new Error("参加者がいません");

  const size = 2 ** Math.ceil(Math.log2(participants.length));
  const slots = [...participants].sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999));
  const byes = size - slots.length;

  // シード順に空き枠を配置し、空き枠の相手を不戦勝にする。
  for (let i = 0; i < byes; i++) slots.splice(i * 2 + 1, 0, null);

  const rounds = [slots];
  while (rounds.at(-1).length > 1) {
    rounds.push(Array.from({ length: rounds.at(-1).length / 2 }, () => null));
  }
  return { rounds, byes };
}

function render() {
  if (!participants.length) return;
  const { rounds, byes } = createRounds(participants);
  const bracket = document.querySelector("#bracket");
  bracket.style.setProperty("--rounds", rounds.length);

  bracket.innerHTML = rounds.map((matches, roundIndex) => {
    const title = roundIndex === rounds.length - 1 ? "決勝" : `${roundIndex + 1}回戦`;
    const matchCount = matches.length / 2;
    return `<div class="round"><h2>${title}</h2>${Array.from({ length: matchCount }, (_, i) => {
      const a = matches[i * 2];
      const b = matches[i * 2 + 1];
      return `<div class="match">
        <div class="team ${a && !b ? "winner" : ""}">${a?.name ?? "不戦勝"}</div>
        <div class="team">${b?.name ?? "—"}</div>
      </div>`;
    }).join("")}</div>`;
  }).join("");

  document.querySelector("#status").textContent =
    `${participants.length}人の対戦表（不戦勝 ${byes}枠）`;
}

async function request_(mode, params = {}) {
  const query = new URLSearchParams({ mode, ...params, ...(adminPassword ? { password: adminPassword } : {}) });
  const response = await fetch(`${API_URL}?${query}`, { cache: "no-store" });
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data;
}

document.querySelector("#participant-form").addEventListener("submit", async event => {
  event.preventDefault();
  const input = document.querySelector("#participant-name");
  const name = input.value.trim();
  if (!name) return;
  try {
    document.querySelector("#status").textContent = "登録しています…";
    await request_("register", { name, tournamentId });
    input.value = "";
    const data = await request_("list", { tournamentId });
    participants = normalizeParticipants_(data.participants);
    render();
  } catch (error) { document.querySelector("#status").textContent = error.message; }
});

document.querySelector("#admin-login")?.addEventListener("click", async () => {
  const password = prompt("管理者パスワードを入力してください");
  if (password === null) return;
  try {
    await request_("login", { password });
    adminPassword = password;
    sessionStorage.setItem("adminPassword", password);
    document.body.classList.remove("viewer-mode");
    document.querySelectorAll(".admin-only").forEach(element => { element.style.display = "block"; });
    document.querySelector("#admin-login").textContent = "管理者ログイン済み";
  } catch (error) { alert(error.message); }
});

document.querySelector("#user-login-start")?.addEventListener("click", () => { location.href = "./user.html"; });
document.querySelector("#admin-login-start")?.addEventListener("click", async () => {
  const password = prompt("管理者パスワードを入力してください");
  if (password === null) return;
  try {
    await request_("login", { password });
    adminPassword = password;
    sessionStorage.setItem("adminPassword", password);
    location.href = "./admin.html";
  } catch (error) { alert(error.message); }
});

if (pageRole === "user") enterAsUser_();
if (pageRole === "admin") {
  document.body.classList.add("admin-mode");
  document.querySelector("main")?.classList.remove("hidden");
  document.querySelector("#login-screen")?.classList.add("hidden");
  document.querySelectorAll(".admin-only").forEach(element => { element.style.display = "block"; });
}

request_("list", { tournamentId })
  .then(data => { participants = normalizeParticipants_(data.participants); render(); return syncWinners_(); })
  .catch(error => { document.querySelector("#status").textContent = error.message; });

// 利用者画面は5秒ごとに最新の参加者情報を取得する。
setInterval(async () => {
  if (adminPassword) return;
  try {
    const data = await request_("list", { tournamentId });
    participants = normalizeParticipants_(data.participants);
    render();
    await syncWinners_();
  } catch (error) {
    document.querySelector("#status").textContent = error.message;
  }
}, 5000);

document.querySelector("#new-tournament").addEventListener("click", () => {
  tournamentId = crypto.randomUUID();
  localStorage.setItem("tournamentId", tournamentId);
  participants = [];
  bracketRounds = [];
  bracketParticipantKey = "";
  render();
});

document.querySelector("#reset-tournament").addEventListener("click", async () => {
  if (!participants.length || !confirm("現在の大会の参加者をすべて削除しますか？")) return;
  try {
    document.querySelector("#status").textContent = "リセットしています…";
    await request_("reset", { tournamentId });
    participants = [];
    bracketRounds = [];
    bracketParticipantKey = "";
    document.querySelector("#bracket").innerHTML = "";
    document.querySelector("#status").textContent = "参加者を登録してください";
  } catch (error) { document.querySelector("#status").textContent = error.message; }
});

// 対戦者をクリックして勝者を次ラウンドへ進める。
let bracketRounds = [];
let bracketParticipantKey = "";
function render() {
  if (!participants.length) return;
  const size = 2 ** Math.ceil(Math.log2(participants.length));
  const participantKey = participants.map(p => p.id).join(",");
  const byes = size - participants.length;
  // 勝者クリック後は既存の状態を保持し、参加者が変わった時だけ初期化する。
  if (!bracketRounds.length || bracketParticipantKey !== participantKey) {
    const slots = [...participants].sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999));
    for (let i = 0; i < byes; i++) slots.splice(i * 2 + 1, 0, null);
    bracketRounds = [Array.from({ length: size / 2 }, (_, i) => ({ a: slots[i * 2], b: slots[i * 2 + 1], winner: null }))];
    while (bracketRounds.at(-1).length > 1) bracketRounds.push(Array.from({ length: bracketRounds.at(-1).length / 2 }, () => ({ a: null, b: null, winner: null })));
    bracketRounds[0].forEach((m, i) => { if (m.a && !m.b) selectWinner_(0, i, m.a); if (!m.a && m.b) selectWinner_(0, i, m.b); });
    bracketParticipantKey = participantKey;
  }
  const bracket = document.querySelector("#bracket");
  bracket.style.setProperty("--rounds", bracketRounds.length);
  bracket.innerHTML = bracketRounds.map((round, r) => `<div class="round"><h2>${r === bracketRounds.length - 1 ? "決勝" : `${r + 1}回戦`}</h2>${round.map((m, i) => `<div class="match">${["a", "b"].map(side => m[side] ? `<button class="team ${m.winner?.id === m[side].id ? "winner" : ""}" data-round="${r}" data-match="${i}" data-side="${side}">${m[side].name}</button><button class="delete" data-delete-id="${m[side].id}">削除</button>` : `<div class="team">—</div>`).join("")}</div>`).join("")}</div>`).join("");
  document.querySelector("#status").textContent = `${participants.length}人（不戦勝 ${byes}枠）※勝者をクリック`;
}

function selectWinner_(r, i, winner) {
  const match = bracketRounds[r][i];
  const nextIndex = Math.floor(i / 2);
  const side = i % 2 ? "b" : "a";
  if (r < bracketRounds.length - 1 && match.winner && match.winner.id !== winner.id) {
    const next = bracketRounds[r + 1][nextIndex];
    if (next.winner?.id === match.winner.id) resetAfter_(r + 1, nextIndex);
    next[side] = null;
  }
  match.winner = winner;
  if (r < bracketRounds.length - 1) bracketRounds[r + 1][nextIndex][side] = winner;
}

async function syncWinners_() {
  const data = await request_("get_winners", { tournamentId });
  data.winners.forEach(item => {
    const r = Number(item.round) - 1, i = Number(item.order) - 1;
    const match = bracketRounds[r]?.[i];
    const winner = match && [match.a, match.b].find(team => team?.name === item.winner);
    if (winner) selectWinner_(r, i, winner);
  });
  render();
}

function resetAfter_(r, i) {
  const match = bracketRounds[r][i];
  match.winner = null;
  if (r < bracketRounds.length - 1) {
    const next = bracketRounds[r + 1][Math.floor(i / 2)];
    next[i % 2 ? "b" : "a"] = null;
    if (next.winner) resetAfter_(r + 1, Math.floor(i / 2));
  }
}

document.querySelector("#bracket").addEventListener("click", event => {
  const deleteButton = event.target.closest("[data-delete-id]");
  if (deleteButton && !adminPassword) return;
  if (deleteButton) {
    if (!confirm("この参加者を削除しますか？")) return;
    request_("delete", { id: deleteButton.dataset.deleteId })
      .then(() => request_("list"))
      .then(data => { participants = normalizeParticipants_(data.participants); bracketRounds = []; bracketParticipantKey = ""; render(); })
      .catch(error => { document.querySelector("#status").textContent = error.message; });
    return;
  }
  const button = event.target.closest("button[data-round]");
  if (!button) return;
  if (pageRole === "admin") return;
  const r = Number(button.dataset.round), i = Number(button.dataset.match);
  const match = bracketRounds[r][i];
  if (match[button.dataset.side]) {
    const winner = match[button.dataset.side];
    selectWinner_(r, i, winner); render();
    request_("save_winner", { tournamentId, round: r + 1, order: i + 1, winner: winner.name }).catch(error => { document.querySelector("#status").textContent = error.message; });
  }
});
