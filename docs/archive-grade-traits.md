# Archive — ระบบ Grade + Traits เดิม (เอาออก 2026-11-03)

เจ้าของสั่ง 2026-11-03: เอาระบบ **Grade** (เกรด 0–10 ต่อ stat + เคสเกรด + โบนัส "เกรด 10 ครบ 4 ค่า") และระบบ **Traits** (Trait Shop 13 แบบ) ออกจากเว็บ เพื่อทำระบบใหม่ภายหลัง · ไฟล์นี้จดของเดิม**ทั้งหมด**ไว้ให้ทำใหม่/กู้คืนได้ · พร้อมกันนั้นเอาระบบแปลภาษาไทย (`js/i18n*.js`) ออกด้วย (หัวข้อ 6)

---

## 0. กู้คืน — commit ที่ยังมีโค้ดเก่าครบ

| commit | อยู่ที่ไหน | มีอะไร |
|---|---|---|
| **`db23c9c`** (Merge pull request #121) | `main` | **จุดกู้คืนหลัก** · เว็บก่อนรอบนี้ทั้งหมด: Grade + Traits + ภาษาไทย ครบ (`?v=75`) |
| `8884a56` | branch `claude/tier-list-ui-grade-traits-a1d1gp` | หน้า Cards แบบใหม่ (ป้ายระดับ, ช่อง 1 IN, ฯลฯ) + Grade/Traits/ภาษาไทยยังอยู่ครบ (`?v=76`) |

commit ถัดจาก `8884a56` บน branch เดียวกัน = commit ที่ลบ (ข้อความขึ้นต้น "Remove Grade + Traits systems")

```bash
# ดูไฟล์เก่าไฟล์เดียว
git show db23c9c:js/grade.js
git show db23c9c:js/traits.js
git show db23c9c:data/traits.json
# เอาไฟล์เก่ากลับมาทั้งชุด (แล้วต้องต่อสายในไฟล์อื่นตามหัวข้อ 4 + 5 เอง)
git checkout db23c9c -- js/grade.js js/traits.js css/grade.css css/traits.css data/traits.json
git checkout db23c9c -- js/i18n.js js/i18n-th-ui.js js/i18n-th-sk1.js js/i18n-th-sk2.js   # ภาษาไทย
# ดูทุกจุดที่ลบในไฟล์อื่น
git diff 8884a56 <commit ที่ลบ> -- js/ css/ index.html
```

**ข้อมูลในเครื่องผู้ใช้ไม่ได้ถูกลบ:** `localStorage` key `cbi:grades`, `cbi:traits`, `cbi:lang` ยังค้างอยู่ในเบราว์เซอร์ของผู้ใช้ (เว็บแค่ไม่อ่านแล้ว) · deck ใน `cbi:decks` ยังเก็บช่อง `grades` ของเดิมไว้ (`clean()` ไม่ลบ) → ระบบใหม่อ่านต่อได้ถ้ารูปแบบเดิม

---

## 1. ระบบ Grade (เดิม)

### 1.1 แนวคิด
- การ์ดแต่ละใบมีเกรด **4 ค่า**: Basic Attack (`atk`) · Defense (`def`) · Status Damage (`status`) · HP (`hp`) · แต่ละค่า **0–10** (0 = ไม่มีเกรด) · ผู้ใช้**ตั้งเองตามที่สุ่มได้ในเกม** (เว็บไม่สุ่ม)
- **+2.5% ต่อเกรด** ที่ stat นั้น (`STEP = 0.025` · เทียบคลิปในเกม · เกรด 10 = +25%)
- **เกรดรวมของการ์ด** = ค่าเฉลี่ย 4 ค่า ปัด .5 ขึ้น: `Math.floor(sum / 4 + 0.5)` (6/4/3/2 → 4 · 1/7/7/7 → 6) · ไม่มีเกรดเลย = 0
- **แถบสี (band):** 10 = `rainbow` · 7–9 = `gold` · 4–6 = `silver` · 1–3 = `bronze` · 0 = `none`
- **คำเกรด:** 0 Ungraded · 1 Fair · 2 Good · 3 Very good · 4 Very good+ · 5 Excellent · 6 Excellent+ · 7 Near mint · 8 Near mint+ · 9 Mint · 10 Gem mint
- **ไม่มีผลกับ Overall / Tier** (ทั้งการ์ดและ Tier List)
- ATK หลังเกรด = `round(statAt(card, "atk", rarity) × (1 + gATK × 0.025))` · HP เหมือนกันด้วย gHP · DEF / Status ขึ้นเฉพาะการ์ดที่มี `base.def` / `base.status` > 0 (`hasStat`)

### 1.2 "เกรด 10 ครบ 4 ค่า" ในหน้า Deck (เกม 2026-11-02)
- `js/deckbuff.js`: ถ้าเกรดของช่องนั้น **ครบ 4 ค่า = 10** → ATK และ HP **× 1.3** (`GRADE_MAX = 10`, `GRADE_BONUS = 1.3`, `fullGrade(g)`) · คูณต่อท้ายหลังบัฟ deck และ Trait
- แถวที่มาของบัฟ (`buffDialog`) มีแถว `kind: "grade"` ชื่อ "Grade 10 (all 4)" ×1.3
- **+2.5% ต่อเกรดแบบหน้า Grade ไม่อยู่ในเลข Deck** (เจ้าของยืนยัน 2026-11-02: ใส่แล้วตัวเลข Witch of Envy ไม่ตรงเกม) → Deck ใช้แค่ ×1.3 ตอนครบ 10
- ข้อความในแผ่นตั้งค่าช่อง: "All four at 10 = +30% ATK and HP. Saved with this deck only: your Grade page stays the same."
- ข้อความในหน้าต่างบัฟ: "Deck buffs multiply: ATK = base × (1 + each %) one after another, then × the trait, then × 1.3 if all 4 grades are 10."

### 1.3 ข้อมูล
- `localStorage` **`cbi:grades`** = `{ "<card id>": [atk, def, status, hp] }` (ตัวเลข 0–10 · ใบที่ทุกค่าเป็น 0 ไม่เก็บ · อ่านผ่าน `clampG` · พังไม่ได้ถ้า storage ถูกปิด)
- deck (`cbi:decks`) มี **`grades: [[atk,def,status,hp] | null × 4]`** ต่อช่องการ์ด (2026-11-02) · deck เก่าที่ไม่มี `grades` → `fillGrades(d)` ดึงจาก `cbi:grades` ครั้งเดียว · ใส่การ์ดใหม่ลงช่อง = ได้เกรดที่บันทึกของการ์ดนั้น · ย้าย/สลับช่อง = เกรดไปด้วย · ลบการ์ด = เกรดช่องนั้น null
- **ไฟล์สำรอง** (`js/share.js` Backup): ส่วน `grades` (`C.share.provide("grades", { label: "Card grades", kind: "object", … })`) · นำเข้าแบบ merge (ของเดิมอยู่ก่อน) / replace · สูงสุด 5000 ใบ · id ตัดที่ 80 ตัวอักษร
- **ลิงก์แชร์เกรด:** `#grade/<card id>/<atk>-<def>-<status>-<hp>` เช่น `#grade/bald-cadet/6-4-3-2` (`parse()` รับ `^\d{1,2}(-\d{1,2}){3}$` ค่า 0–10) · เปิดลิงก์ที่มีเกรดคนอื่น = แถบ "Shared grades" (ปุ่ม Keep these / Use my grades หรือ Clear) ไม่ทับของตัวเองจนกว่าจะกด
- **ลิงก์แชร์ deck** payload มี `g?: [[4] | 0 × 4]` (เกรดต่อช่อง · ใส่เมื่อมี) · ลิงก์ไม่มี `g` = ไม่มีเกรด

### 1.4 หน้าจอ
- **เมนู:** ปุ่ม "Grade" (ไอคอน `#i-lens` แว่นขยาย) ในแถบล่าง/แถบซ้าย · route `#grade` · หัวหน้าต่าง "Card Grader — Card Battle Infinity"
- **หน้า Grade (`#page-grade`)** — หัว: eyebrow "The Appraiser" · title "Card Grader" · lead "Pick a card and set its Basic Attack, Defense, Status Damage and HP grades from 1 to 10. Each grade adds +2.5% to that stat. Your grades are saved on this device and can be shared as a link."
  - **หน้าเลือกการ์ด** (`#grade-list-view`): ค้นหา (`#grade-search` "Search name or series") · ชิป "My graded cards (N)" · ตารางการ์ด mini (`#grade-grid` · `data-no-detail` · 30/หน้า + pager) · การ์ดที่มีเกรดมีเหรียญเกรด `.card__grade` (`.gorb` มุมซ้ายใต้ชื่อ) · ว่าง: "No cards match" / "No cards to grade yet"
  - **หน้าตั้งเกรด** (`#grade-detail-view` · `.gdetail`): ปุ่ม Back "All cards" · การ์ดในเคสเกรด (hero) · ชื่อ + ซีรีส์ · แถบ Shared grades · วงเกรดรวม `.goverall` ("Card grade" / "Set a grade on each stat below") · ชิประดับ (rarity) · 4 แถว `.gstat` (ชื่อ stat · +x% · เหรียญ · ค่าหลังเกรด · แถบ 10 ช่อง `.gbar__seg` แตะช่องเดิมซ้ำ = ล้าง) · ปุ่ม Card details / Reset / Share link (Web Share API หรือคัดลอกลิงก์ · "Link copied") · โน้ต "Each grade adds +2.5% to that stat (grade 10 = +25%). The card grade is the average of all four, rounded. Grades are saved on this device and don't change the Tier List."
- **เคสเกรด `.slab`** (ขั้น 13 · §3.5.2 เดิม): เคสพลาสติกใสวาดด้วย CSS (ไม่มีโลโก้ PSA) · ป้ายกระดาษงาช้างขอบสีตามแถบเกรด · ป้าย: `CBI GRADED · ซีรีส์` / ชื่อ / ระดับ · Tier / โอกาส / Trait ของผู้ใช้ | คำเกรด + เลขเกรดรวมใหญ่ · แถว ATK/HP หลังเกรด · แถวเกรดย่อย ATK · DEF · STS · HP + บาร์โค้ด + เลข cert (`hash(id) % 1e8` 8 หลัก) · แสงสะท้อนวิ่ง 1 ครั้งเมื่อเลื่อนมาเห็น (IntersectionObserver) / เปลี่ยนค่า · เกรด 10 = เลขรุ้ง (`--slab-g10`)
  - Support ในเคส (`.slab--sup`, `supPanelHTML`): ไม่มีเกรด · ป้าย "CBI GRADED · SUPPORT" + ชื่อท่า + ค่าตามระดับ + Value
- **แผ่น Details ของหน้าดูการ์ด** แท็บ **"My card"**: กล่อง "Grade" ("Your grades for this card, saved on this device. They don't change its tier.") = เคส + เหรียญเกรดรวม + 4 เกรดย่อย · ยังไม่มี = "Not graded yet. Set the grades you rolled in game to see the boosted stats." · ปุ่ม "Grade this card" / "Open in Card Grader" (`data-grade-open`) · Support = กล่อง "Case"
- **หน้า Deck — แผ่นตั้งค่าช่อง:** ส่วน "Grade" 4 แถว `.gstat.dk-ss__g` + `.gbar` (0–10) · คำแนะนำ editor "Tap a card to set its rarity, grade and trait…"
- **รูป Save image ของ Deck:** เลข ATK/HP รวม ×1.3 ของเกรดครบ 10

### 1.5 ไฟล์ที่เกี่ยว (ก่อนลบ)
- `js/grade.js` (739 บรรทัด) → `CBI.grade = { init, show, panelHTML, supPanelHTML, mountSlabs, overall, band, get }`
- `css/grade.css` (256 บรรทัด: `.gorb`, `.card__grade`, `.slab*`, `.lab__*`, `.gdetail*`, `.gstat*`, `.gbar*`, `.goverall`, `.gsum*`, `.gshare`, `.gactions`, `.gnote`)
- `css/tokens.css`: `--g-bronze(-2)` `--g-silver(-2)` `--g-gold(-2)` `--g-rainbow` `--g-rainbow-line` `--g-empty` · `--slab-plastic` `--slab-edge` `--slab-label` `--slab-ink(-2,-3)` `--slab-atk` `--slab-hp` `--slab-g10`
- `index.html`: ปุ่มเมนู `data-page="grade"` · `<section id="page-grade">` · `<symbol id="i-lens">` · `css/grade.css` + `js/grade.js`
- `js/app.js`: `PAGES` มี `"grade"` · `TITLES.grade` · route `#grade/<id>/<grades>` → `CBI.grade.show()` · `CBI.grade.init()` ใน boot · stub `grade: {…}`
- `js/deck.js`: `gradeOf`, `gradesOf`, `fillGrades`, `myGradeOf`, `GSTATS`/`gband` ในแผ่นตั้งค่าช่อง, `snap()` มี `g`, payload `g`, `b.gradeOf`
- `js/deckbuff.js`: `GRADE_MAX`, `GRADE_BONUS`, `fullGrade`, `gradeOf` ใน `compute()`
- `js/detail.js`: `C.grade.panelHTML`, `C.grade.supPanelHTML`, `C.grade.mountSlabs` ในแท็บ "mine"
- `js/share.js`: backup text "tier lists, grades and decks"
- `HISTORY.md` §6.1 (สเปกเดิมขั้น 6) · §13 (เคสเกรดขั้น 13)

---

## 2. ระบบ Traits (เดิม)

### 2.1 แนวคิด
- จำลอง **Trait Shop** ในเกม: 13 Trait ใน 8 ระดับ (Common … Secret) · 1 roll = 5 Shards · มีโอกาส % ต่อ roll + pity
- **ในเกมทุกใบที่ซ้ำกันได้ Trait เดียวกัน** → ผู้ใช้เลือก **1 Trait ต่อการ์ด** (ไม่ใช่ต่อใบ/ต่อช่อง)
- เปลี่ยนผ่าน `CBI.traits.set(cardId, traitId|null)` เท่านั้น → ยิง event **`cbi:trait`** `{ id, trait }` (แผ่น Details, เคสเกรด, Deck, หน้า Traits ฟังแล้ววาดใหม่)
- **ไม่มีผลกับ Overall / Tier**

### 2.2 ข้อมูล `data/traits.json` (ทั้งไฟล์ ณ 2026-10-25)
```json
{
  "updated": "2026-10-25",
  "rollShards": 5,
  "sameForCopies": true,
  "tiers": ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic", "Divine", "Secret"],
  "traits": [
    { "id": "ascendant", "name": "Ascendant", "tier": "Secret", "chance": 0.02, "pity": 6000, "dmg": 2, "hp": 2, "crit": { "chance": 20, "mult": 2.5 }, "revive": 50 },
    { "id": "limitless", "name": "Limitless", "tier": "Divine", "chance": 0.07, "pity": 2500, "dmg": 1.7, "hp": 1.7, "dodge": 12, "reduce": 10 },
    { "id": "sage-mode", "name": "Sage Mode", "tier": "Mythic", "chance": 0.2, "pity": 1000, "dmg": 1.5, "hp": 1.5, "lifesteal": 12, "shield": 15 },
    { "id": "awakened", "name": "Awakened", "tier": "Legendary", "chance": 0.5, "pity": 400, "dmg": 1.35, "hp": 1.35, "crit": { "chance": 15, "mult": 2 } },
    { "id": "undying", "name": "Undying", "tier": "Epic", "chance": 1.2, "pity": 150, "hp": 1.25, "revive": 30 },
    { "id": "prodigy", "name": "Prodigy", "tier": "Epic", "chance": 2, "pity": 100, "dmg": 1.25, "hp": 1.25, "firstHit": 30 },
    { "id": "keen-eye", "name": "Keen Eye", "tier": "Rare", "chance": 4, "dmg": 1.12, "crit": { "chance": 12, "mult": 2 } },
    { "id": "bloodlust", "name": "Bloodlust", "tier": "Rare", "chance": 5, "dmg": 1.2, "lifesteal": 8 },
    { "id": "iron-body", "name": "Iron Body", "tier": "Rare", "chance": 6, "hp": 1.2, "reduce": 6 },
    { "id": "spirited", "name": "Spirited", "tier": "Uncommon", "chance": 10, "dmg": 1.12, "hp": 1.12 },
    { "id": "nimble", "name": "Nimble", "tier": "Uncommon", "chance": 15, "dmg": 1.05, "hp": 1.05, "dodge": 5 },
    { "id": "sharp", "name": "Sharp", "tier": "Common", "chance": 26, "dmg": 1.08 },
    { "id": "tough", "name": "Tough", "tier": "Common", "chance": 30, "hp": 1.08 }
  ]
}
```
ความหมาย field: `chance` % ต่อ roll · `pity` roll (ไม่มี = ไม่ใส่) · `dmg` / `hp` ตัวคูณ (ไม่ใส่ = 1) · `crit { chance %, mult }` · `dodge` % · `reduce` % (รับดาเมจลดลง) · `lifesteal` % (ฮีลจากดาเมจที่ทำ) · `shield` % HP ตอนเริ่มสู้ · `revive` % HP (ครั้งเดียว) · `firstHit` % (ตีแรก) · เพิ่ม Trait ใหม่ = เพิ่มแถว (ผลแบบใหม่ต้องแก้โค้ด)

ข้อมูลในการ์ด (งาน B): `bestTrait` (id) + `bestTraitNote` (~120 ตัวอักษร) → กล่อง Recommended · วิธีเลือก (§7 B ข้อ 7 เดิม): จำลอง Matchup ซ้ำโดยใส่ Trait ระดับ Epic ลงมา เลือกตัวที่ Matchup ขึ้นมากสุด · ผล W2: Prodigy ดีสุดทุกใบ · **field นี้ยังอยู่ใน `data/pending/cards.json` (4 ใบ) ไม่ได้ลบ** (`cards.json` ปัจจุบันไม่มีแล้ว)

### 2.3 สูตร
- **ATK/HP สุดท้าย** (หน้า Traits + แผ่น Details) = `round( round(statระดับ × (1 + เกรด × 2.5%)) × ตัวคูณ Trait )` (`apply(card, rarity, grades, traitId)`)
- **Average hit** = ATK × (1 + crit% × (คูณ − 1)) · **Effective HP** = HP × (1 + โล่% + ฟื้น%) ÷ ((1 − หลบ%) × (1 − ลดดาเมจ%))
- **ตัวคูณรวมของ Trait (M)** = √(ดาเมจจริง × HP จริง) · ดาเมจจริง = dmg × (1 + crit% × (คูณ − 1)) × (1 + firstHit% ÷ 100 ÷ 5) · HP จริง = hp × (1 + shield% + revive%) × (1 + lifesteal%) ÷ ((1 − dodge%) × (1 − reduce%))
- **พลัง Trait** (0–1) = ln(M) ÷ ln(M ของ Ascendant)
- **คะแนนทีม** (`js/teamscore.js` §10.5 เดิม): ค่าการ์ด = min(100, ค่าเดิม + `K.traitPts` (20) × พลัง Trait) · ผล: Ascendant +20 · Limitless +12.6 · Sage Mode +10.4 · Awakened +7.2 · Prodigy +4.9 · Undying +4.7 · Bloodlust +2.5 · Iron Body +2.4 · Keen Eye +2.2 · Spirited +2.2 · Nimble +1.4 · Sharp/Tough +0.75 · ทีมตัวเทียบ "แข็งที่สุดในคลัง" ไม่มี Trait · deck ของผู้ใช้ใช้ Trait ของผู้ใช้ (`mine(d)` = deck + `traits: C.traits.map()`) · deck ที่แชร์ / Meta Decks ไม่มี Trait · โน้ต Card power "N with a trait (+x avg)"
- **บัฟ Deck** (`js/deckbuff.js`): ATK = base × Π(1 + %damage) **× trait dmg** · HP = base × Π(1 + %HP) **× trait hp** (เจ้าของ 2026-11-02: เลขบนการ์ดรวม Trait) · แถว `kind: "trait"` ในหน้าต่างบัฟ

### 2.4 ข้อมูลในเครื่อง / ลิงก์
- `localStorage` **`cbi:traits`** = `{ "<card id>": "<trait id>" }` (id ที่ไม่รู้จักถูกทิ้งตอนโหลด · สูงสุด 5000) · **ไม่อยู่ในไฟล์สำรอง** · deck ไม่ได้เก็บ Trait เอง
- **ลิงก์แชร์ deck** payload `t?: [trait id | "" × 4]` (Trait ของคนแชร์ต่อช่อง · ใส่เมื่อมี · เจ้าของ 2026-11-02) · หน้า deck ที่แชร์แสดงป้าย Trait ของคนแชร์
- route **`#traits`** (ไม่เพิ่มประวัติ)

### 2.5 หน้าจอ
- **เมนู:** ปุ่ม "Traits" (ไอคอน `#i-trait` อัญมณี) · หัวหน้าต่าง "Traits — Card Battle Infinity"
- **หน้า Traits (`#page-traits`, W5)** — eyebrow "The Bloodline" · title "Traits" · lead "Pick a card, then tap + to open its Trait Shop: set the trait you rolled and see its final ATK and HP. One roll costs 5 Shards, every copy of a card shares the same trait, and traits never change a card's Overall score or tier."
  - `#trw`: ซ้าย `.trw__pick` (ค้นหา `#trw-search` + ชิป "Cards with a trait" + การ์ด mini `#trw-grid` · การ์ดที่มี Trait มีไอคอน `.card__trait`) | ขวา `.trw__shop` (หัว `#trs-head` = การ์ดที่เลือก + Trait ที่ใส่ + Remove + Final ATK/HP (ระดับ × เกรดที่บันทึก × Trait) + Change card / Card details + ชิประดับ + ผลพิเศษ)
  - ปุ่ม `.trs__eqbtn` → `shopDialog()` = หน้าต่าง "Trait Shop · ชื่อการ์ด" รายการ 13 แถว `.trrow` เรียงหายากก่อน: ไอคอน + ชื่อ + ระดับ + ผลย่อ + % / 1 in X / Pity + ป้าย Recommended / Equipped · **แตะ = ใส่เลย** + toast Undo
  - มือถือ (< 900px): ตาราง หรือ shop อย่างใดอย่างหนึ่ง (ปุ่ม Back "All cards") · ≥ 900px: ซ้าย-ขวา
  - ไอคอน Trait 13 แบบวาดเอง `<symbol id="tri-<trait id>">` ใน sprite ของ `index.html` (สีจาก `currentColor` = สีระดับ) · Trait ที่ไม่มีรูป = `#i-gem`
- **แผ่น Details แท็บ "My card":** กล่อง Trait = Recommended (`bestTrait` + `bestTraitNote` · ไม่มี = Not analyzed yet · แตะป้าย = เลือก) + ชิปเลือก Trait ของฉัน + ATK/HP หลังเกรด × Trait + ผลพิเศษ
- **เคสเกรด:** บรรทัด Trait ของผู้ใช้บนป้าย
- **หน้า Deck:** ป้าย `.dk-trait` ใต้การ์ดแต่ละช่อง (editor แตะ = เปิดแผ่นตั้งค่าช่อง) · แผ่นตั้งค่าช่องส่วน "Trait" (ชิป None + 13 Trait · "Every copy of this card shares one trait, so this changes it everywhere on this device.")
- **รูป Save image ของ Deck:** ป้าย Trait ใต้การ์ด (`drawTrait`, `traitIcon` ใน `js/share.js` · `DECKIMG.TRAIT` 34px, `TRAIT_GAP` 10px)

### 2.6 สี (`css/tokens.css`)
`--tr-common #a9afba / -2 #3b404b` · `--tr-uncommon #7cc98a / #1d4628` · `--tr-rare #64acdf / #173a5c` · `--tr-epic #b58ae6 / #3e2463` · `--tr-legendary #efb54e / #6b4410` · `--tr-mythic #f0704e / #6a1d10` · `--tr-divine #fff2cf / #b58a3c` · `--tr-secret #ff4d68 / #12030a` · `--tr-none #7d7563 / #1a2238` (ใช้ผ่าน `--tc` `--tc2` จาก `colorStyle(t)`)

### 2.7 ไฟล์ที่เกี่ยว (ก่อนลบ)
- `js/traits.js` (699 บรรทัด) → `CBI.traits = { init, list(), byId, of, set, map, power, mult, effects, apply, pillHTML, chipsHTML, panelHTML, mountPanel, pickDialog, colorStyle, iconHTML, TIERS }`
- `css/traits.css` (288 บรรทัด: `.trp`, `.trchip`, `.trw*`, `.trs*`, `.trrow*`, `.card__trait`, `.dk-trait*`, `.tr-gem`)
- `data/traits.json` (หัวข้อ 2.2)
- `index.html`: ปุ่มเมนู `data-page="traits"` · `<section id="page-traits">` · `<symbol id="i-trait">` + `tri-*` 13 อัน · `css/traits.css` + `js/traits.js`
- `js/app.js`: `PAGES` มี `"traits"` · `TITLES.traits` · โหลด `data/traits.json` → `state.traits` · `CBI.traits.init()` (ก่อนทุกหน้าใน boot) · stub `traits: {…}`
- `js/deck.js`: `myTraitOf`, `mine(d)`, `paintTrait`, `onTrait`, `slot._trait`, `traitsOf(p, deck)`, payload `t`, `b.traitOf`, `deckSpec(d, traitOf)`
- `js/deckbuff.js`: `traitOf` ใน `compute()`
- `js/teamscore.js`: `K.traitPts`, `traitOf`, `traitBonus`, `cardValT`, โน้ต "with a trait"
- `js/share.js`: `traitIcon`, `drawTrait`, `spec.traits`, `DECKIMG.TRAIT/TRAIT_GAP`
- `js/detail.js`: `C.traits.panelHTML`, `C.traits.mountPanel`
- `tools/deck_sim.py`, `tools/team_sim.py`, `tools/matchup_sim.py` (ของงาน B ไม่ใช่เว็บ · ไม่ได้แก้)
- `HISTORY.md` §9 W5 (หน้า Traits ใหม่) · W2 (`bestTrait`)

---

## 3. แท็บ "My card" ในแผ่น Details
มีแค่กล่อง Trait + Grade (การ์ด) / Case (Support) → **เอาแท็บออกด้วย** (เหลือ Overview / Score / Team · `TABS` ใน `js/detail.js` + ปุ่ม `#bs-tab-mine` ใน `index.html` + `.bs-tabs { --n: 4 }` → 3)

## 4. เมนูหลัก
เดิม 6 ปุ่ม: Home · Tier List · Cards · Deck · **Grade** · **Traits** (`.nav__list style="--n:6"`) → เหลือ 4 ปุ่ม · ลิงก์เก่า `#grade`, `#grade/<id>/…`, `#traits` → ส่งไปหน้าที่ยังมี (`#grade/<id>/…` = เปิดหน้าดูการ์ด `#card/<id>` · `#grade` / `#traits` = หน้า Cards) แทนที่จะค้าง

## 5. สิ่งที่ระบบใหม่ต้องตัดสินใจ (จดไว้ตอนลบ)
- เกรดจริงในเกม: +2.5%/เกรด (หน้า Grade) ขัดกับ Deck ที่ใช้แค่ ×1.3 ตอนครบ 10 → ต้องเช็กกับเกมใหม่ว่าสูตรไหนถูก
- Trait ต่อการ์ด vs ต่อช่อง deck · จะเก็บในไฟล์สำรอง/ลิงก์แชร์ไหม
- จะอ่าน `cbi:grades` / `cbi:traits` / `deck.grades` เดิมต่อ หรือเริ่มใหม่

## 6. ระบบแปลภาษาไทย (เอาออกพร้อมกัน)
- `js/i18n.js` (`window.I18N = { lang, ui, desc, addUI, addSK, addRules, start }` · MutationObserver แปลข้อความ UI + `aria-label`/`title`/`placeholder`/`alt` · `I18N.desc(text)` แปลคำอธิบายสกิลทีละประโยค · key = ข้อความอังกฤษเลข→`#` · ค่าไทยใช้ `#1 #2`) + พจนานุกรม `js/i18n-th-ui.js` · `js/i18n-th-sk1.js` · `js/i18n-th-sk2.js`
- ปุ่ม `.lang.js-lang` (หัวเว็บมือถือ "ไทย"/"EN" + แถบซ้ายคอม ลูกโลก `#i-globe` "ภาษาไทย") · `localStorage` `cbi:lang` = `"th"|"en"` · กด = บันทึกแล้วรีโหลด · `html.is-th` · ฟอนต์ Noto Sans Thai
- จุดที่เรียก `I18N.desc(...)`: `js/app.js` (supText, ข้อความสกิลบนการ์ด, mutation line) · `js/detail.js` (ability) · `js/share.js` (ข้อความบนรูป) → เปลี่ยนเป็นข้อความอังกฤษตรงๆ
- กู้คืน: `git show db23c9c:js/i18n.js` ฯลฯ (หัวข้อ 0)
