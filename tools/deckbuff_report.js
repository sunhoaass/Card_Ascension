// Prints the deck-buff check list for the owner (js/deckbuff.js · PROGRESS ▶️ "Deck: รูป Save image สะอาดขึ้น" ข้อ ค):
// every support (counted / skipped buffs) + every card ability that buffs the deck + the names data/buffs.json doesn't know yet.
// Run from the repo root: node tools/deckbuff_report.js            (Markdown, ready for HISTORY.md)
const fs = require("fs");
const path = require("path");
const read = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", f), "utf8"));
globalThis.CBI = { state: { cards: read("data/cards.json"), support: read("data/support.json"), buffs: read("data/buffs.json") } };
require(path.join(__dirname, "..", "js", "deckbuff.js"));
const r = globalThis.CBI.deckBuff.report();

const out = [];
const counted = r.support.filter((s) => s.counted.length), skipped = r.support.filter((s) => !s.counted.length && s.skipped.length);
out.push(`### Support: counted (${counted.length})`, "", "| Support | Buff → target |", "|---|---|");
counted.forEach((s) => out.push(`| ${s.name} | ${s.counted.join(" · ")}${s.skipped.length ? ` (skipped: ${s.skipped.join(" · ")})` : ""} |`));
out.push("", `### Support: skipped, has a condition (${skipped.length})`, "", "| Support | Why |", "|---|---|");
skipped.forEach((s) => out.push(`| ${s.name} | ${s.skipped.join(" · ")} |`));
out.push("", `Other support (${r.support.length - counted.length - skipped.length}): no damage / max HP buff in the text.`);
out.push("", `### Cards (${r.cards.filter((c) => c.rules.length).length} with a deck buff)`, "", "| Card | Buff | Not used |", "|---|---|---|");
r.cards.forEach((c) => out.push(`| ${c.name} | ${c.rules.join(" · ") || "—"} | ${c.other.join(" ") || ""} |`));
out.push("", `### Names data/buffs.json doesn't know yet (${r.missing.length})`, "", r.missing.length ? r.missing.map((m) => `- ${m}`).join("\n") : "- none");
console.log(out.join("\n"));
