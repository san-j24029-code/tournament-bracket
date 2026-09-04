// GASのWebアプリURLを設定すると、GASから参加者データを取得できます。
const API_URL = "https://script.google.com/macros/s/AKfycbz0HCH0S-yDo3HCVMLgSVZjcVXJrqGsTlldbS_wefz9q7Mzx9coswzwsSt6EBhpHDOPJg/exec";
let participants = [];

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
  const query = new URLSearchParams({ mode, ...params });
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
    await request_("register", { name });
    input.value = "";
    const data = await request_("list");
    participants = data.participants;
    render();
  } catch (error) { document.querySelector("#status").textContent = error.message; }
});

request_("list")
  .then(data => { participants = data.participants; render(); })
  .catch(error => { document.querySelector("#status").textContent = error.message; });

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
  bracket.innerHTML = bracketRounds.map((round, r) => `<div class="round"><h2>${r === bracketRounds.length - 1 ? "決勝" : `${r + 1}回戦`}</h2>${round.map((m, i) => `<div class="match">${["a", "b"].map(side => m[side] ? `<button class="team ${m.winner?.id === m[side].id ? "winner" : ""}" data-round="${r}" data-match="${i}" data-side="${side}">${m[side].name}</button>` : `<div class="team">—</div>`).join("")}</div>`).join("")}</div>`).join("");
  document.querySelector("#status").textContent = `${participants.length}人（不戦勝 ${byes}枠）※勝者をクリック`;
}

function selectWinner_(r, i, winner) {
  const match = bracketRounds[r][i]; match.winner = winner;
  if (r < bracketRounds.length - 1) bracketRounds[r + 1][Math.floor(i / 2)][i % 2 ? "b" : "a"] = winner;
}

document.querySelector("#bracket").addEventListener("click", event => {
  const button = event.target.closest("button[data-round]");
  if (!button) return;
  const r = Number(button.dataset.round), i = Number(button.dataset.match);
  const match = bracketRounds[r][i];
  if (!match.winner && match[button.dataset.side]) { selectWinner_(r, i, match[button.dataset.side]); render(); }
});
