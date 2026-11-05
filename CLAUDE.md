# Card_Ascension — Claude Code

- Start every task by reading `PROGRESS.md` (กฎทำงาน + ▶️ ขั้นถัดไป) and only the sections its 📑 table names for the job.
- **"ทำรอบถัดไป"** (or "next round") = one batch round of routine A/C from `inbox/`: follow `PROGRESS.md` §7 "โหมด batch" exactly.
- **"ทำรอบแคปใหม่"** (or "recapture round") = replace existing card/support pictures with the owner's sharper screenshots from `inbox/`: follow `PROGRESS.md` §7 "โหมดแคปใหม่" exactly (step 0 calibration first if `inbox/recapture.json` does not exist).
- **"อัปเดตข่าว"** (or "update news") = put the game news / codes from the owner's attached screenshots into `data/news.json`: follow `PROGRESS.md` §7 "E. อัปเดตข่าว" exactly.
- **"ครอบการ์ด"** (or "crop cards") = crop the owner's attached game screenshots down to just the card and save them in `cropped_cards/`. This task does NOT need `PROGRESS.md`; follow these rules exactly:
  1. `git fetch origin main` and work from the latest `main` (never delete or edit existing files in `cropped_cards/`).
  2. Every screenshot must be 2400×1080 (check `im.size`; if not, stop and ask — never guess the box). Crop box = `(886, 108, 1514, 972)` → 628×864 px PNG. If an image is shown at 2000×900, multiply coordinates by 1.2.
  3. File name = the card name printed at the top-left of the card (next to the green HP number), NOT the purple skill title and NOT the random upload file name. Lowercase, spaces → `_`, drop `- ' :` etc., add `.png` (e.g. `NO-LIFE KING` → `no_life_king.png`). Read it from the picture; if unreadable, ask. Same name as an existing file but a different mutation → append the mutation shown on the badge (`storm_dragon_ascended.png`); same card again → ask before overwriting.
  4. Build one contact sheet of the batch and look at it (edges, name, numbers not cut) before sending.
  5. Send this batch's files to the owner with `SendUserFile` (display: attach), always, followed by the list of card names.
  6. When the batch is done: commit, push to the session branch, then **merge into `main` immediately and push `main`** (no PR, no waiting for the owner to say so).
  7. Do not add the cards to the website, `data/`, or `PROGRESS.md` unless the owner asks separately.
  8. **Support cards** ("ครอบการ์ด Support" / "crop support cards"): same rules, but save into `cropped_cards/support/` (never mix with the character cards, so names cannot collide). Name = the support card's own name as printed on the card. The 2400×1080 check still applies; the box `(886, 108, 1514, 972)` was set for character cards, so on the first Support batch check it fits the picture and, if edges/name/numbers get cut, stop and ask the owner before using any other box. Same steps 4–6 (contact sheet, `SendUserFile`, commit/push, merge into `main`).
