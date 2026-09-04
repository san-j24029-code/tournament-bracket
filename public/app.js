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

document.querySelector("#participant-form").addEventListener("submit", event => {
  event.preventDefault();
  const input = document.querySelector("#participant-name");
  const name = input.value.trim();
  if (!name) return;
  participants.push({ id: `P${String(participants.length + 1).padStart(3, "0")}`, name, seed: participants.length + 1 });
  input.value = "";
  render();
});
