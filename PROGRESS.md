# Card Battle Infinity — PROGRESS

## 📑 งานแต่ละแบบอ่านส่วนไหน (ไม่ต้องอ่านทั้งไฟล์)
ทุกงานอ่าน **กฎทำงาน + ▶️ ขั้นถัดไป** ก่อน แล้วอ่านเฉพาะส่วนในตาราง
| งาน | อ่าน |
|---|---|
| **เพิ่มการ์ด / support** (งาน A, C) | §5.1 · §5.2 · §5.4 · §7 A/C |
| **วิเคราะห์ / จัดอันดับ** (งาน B) | §5 · §7 B · §8 · §10.5 (field ที่คะแนนทีมใช้) |
| **แก้หน้าตา** (CSS, การ์ด, อนิเมชั่น) | §3 · §3.2 · §3.3 "ของกลางธีม" · §4 + §4.1 |
| **แก้ระบบ / โค้ด** (route, Tier Maker, Deck, แชร์, เกรด) | §3.3 (เฉพาะไฟล์ที่เกี่ยว) · §3.4 · §4.1 · §11.3 ถ้าต้องวัดความเร็ว |
| ปรับคะแนนทีม / น้ำหนักโหมด | §8 · §10.5 |
| หน้ารายละเอียดการ์ด (Black Sun) | §3.3 `detail.js` · §4 · HISTORY §13.1 + §14 (layout, เกณฑ์ความเร็ว) |

> **ประวัติอยู่ใน `HISTORY.md` อ่านเฉพาะเมื่อจำเป็น** (บันทึกการเปลี่ยนแปลง §9, ผลวัด/ผลทดสอบเก่า, รายละเอียดขั้นที่เสร็จแล้ว §6 §10–§14, ข้อความเดิมก่อนย่อ §0) · หาหัวข้อด้วย `grep -n "^## \|^### " HISTORY.md` แล้วอ่านแค่ช่วงนั้น

## กฎทำงาน
1. ทำเฉพาะขั้นที่เจ้าของสั่ง ถ้ามีไอเดียที่ดีกว่า ให้**ถามก่อน**ทำ
2. เมื่อให้ prompt ต้องบอก**โมเดล + effort**ทุกครั้ง
3. ทำเสร็จแล้ว: (ก) **PROGRESS.md** แก้ "▶️ ขั้นถัดไป" + สเปกที่เปลี่ยนจริง (เช่น ของกลางใหม่ใน §3.3) **เขียนสั้น ไม่ใส่ประวัติ/ผลทดสอบ/ผลวัด** (ข) **HISTORY.md** ต่อท้าย §9: สิ่งที่เปลี่ยน, ผลทดสอบ, ผลวัด, รายการไฟล์ (ค) บอกว่า**ต้องอัปไฟล์ไหนไปโฟลเดอร์ไหน**บน GitHub
4. ทุกครั้งที่เพิ่มปุ่มหรือการกดแบบใหม่ ให้อ่านและทำตาม **§4 Motion Guide**
5. เจ้าของใช้มือถือเป็นหลัก ต้องออกแบบแบบ mobile-first ทุกหน้า
6. **ทุกหน้าต้องได้มาตรฐานเดียวกัน** ก่อนบอกว่าเสร็จ ต้องผ่าน **§4.1 Definition of Done** ทุกข้อ ถึงเจ้าของจะพิมพ์มาไม่ครบก็ต้องทำ (เช่น ต้องมีอนิเมชั่นทุกหน้า)
7. **1 งาน = 1 แชทใหม่** ใช้ prompt สั้นจาก ▶️ / §7 · **แนบ `PROGRESS.md` ไปในแชทเสมอ (หรืออัปเดตใน Project knowledge) · ห้ามให้ Claude อ่านไฟล์จากลิงก์ GitHub** (ได้ฉบับเก่าค้างแคช · เช็ค 2026-10-25 ได้ฉบับขั้น 2) · ไฟล์โค้ดที่ต้องใช้ให้ Claude บอกรายชื่อแล้วเจ้าของแนบให้ · เจ้าของต้องอัป `PROGRESS.md` (+ `HISTORY.md`) ขึ้น GitHub ทุกครั้งหลังจบงาน ไม่งั้นแชทถัดไปอ่านของเก่า · **อย่ารัน 2 แชทที่แก้ PROGRESS.md พร้อมกัน** (เคยทับกันมาแล้ว)
8. ห้ามอ่านโค้ดทั้ง repo โดยไม่จำเป็น อ่านเฉพาะไฟล์ที่งานนั้นใช้
9. **เลขเวอร์ชันท้ายไฟล์:** `index.html` โหลด CSS/JS แบบ `css/base.css?v=13` (กันมือถือใช้ไฟล์เก่าค้าง "Loading…") · แก้ CSS/JS ไฟล์ไหนก็ตาม → เปลี่ยน `?v=` **ทุกบรรทัด**เป็นเลขใหม่ (ตอนนี้ `14` · ครั้งถัดไป `15`) ไฟล์ใหม่ก็ใส่เลขด้วย แล้วบอกให้อัป `index.html` ด้วยทุกครั้ง · ไอคอนเว็บใช้เลขแยก (`?v=2`, §3)
10. **ห้ามใช้ของจริงจากเกม** (รูป ไอคอน โลโก้ ฟอนต์เฉพาะของเกม ภาพหน้าจอ เพลงประกอบเกม) — ติดลิขสิทธิ์ · วาดเองด้วย SVG/CSS/canvas
11. ระบบเดิมห้ามเปลี่ยนโดยไม่ถาม: route, localStorage keys (§3.4), ลิงก์แชร์, ไฟล์สำรอง, เกรด, Tier Maker · หน้าใหม่ใช้ของกลางธีมใน §3.3 ห้ามใช้สีฟ้า/ม่วงแบบธีมเก่า

## ▶️ ขั้นถัดไป (เจ้าของ copy ไปวางในแชทใหม่)
**สถานะ (2026-10-25):** แผนขั้น 0–12 เสร็จครบ + เพิ่ม Tier GOD + ปรับหน้ารายละเอียดการ์ดรอบ 2 (`?v=14` · HISTORY §9 2026-10-25) · `data/cards.json` = การ์ดจริง 4 ใบ จัดอันดับแล้ว (BE **S** 83.6 · DEM **A** 78.9 · MEG **B** 62.0 · ASL **C** 58.7 · ยังไม่มีใบไหนถึง 90 = ยังไม่มีการ์ด Meta) · `data/support.json` = `[]` (รองาน C) · `data/teams.json` = ทีมจริง 1 ทีม "Emperor Wall" (4 ใบ ช่อง 5 ว่าง) · `team.bestSupport` ทุกใบว่างจนกว่าจะมี support

**ค้าง (เจ้าของทำเอง):**
- 📱 **ลองหน้ารายละเอียดการ์ดบน iPhone** (งาน 2026-10-25): ลากบนป้าย/แถบล่างแรงๆ การ์ดต้องไม่เลื่อนลง (บั๊กนี้ Chromium จำลองไม่ขึ้น) · ยังเป็น = แชทใหม่ Opus 5.5 / high + คลิป/บอกว่าลากตรงไหน
- ⚠️ **รูปเล็กอยู่ผิดโฟลเดอร์ (เช็ก repo 2026-10-24 ยังผิด · ทำแล้วให้ลบบรรทัดนี้):** อยู่ที่ `images/thumb/` แต่เว็บหาที่ `images/cards/thumb/` (หาไม่เจอใช้รูปใหญ่แทน เว็บไม่พังแต่ช้ากว่า) → อัป 4 ไฟล์ไป `images/cards/thumb/` แล้ว**ลบโฟลเดอร์ `images/thumb/`** และไฟล์ว่าง `images/cards/s`
- เพลง: อัป `audio/bgm.mp3` เอง (เพลงฟรีที่ไม่ต้องให้เครดิต เช่น Pixabay Music · ≤ ~3MB · ยังไม่มีไฟล์ = ปุ่มเพลงซ่อน · รายละเอียด HISTORY §12.5)
- สีเกรดจริง: แคปรูปมา → แชทใหม่ **Sonnet 5.5 / low** แก้แค่ `--g-*` ใน `css/tokens.css`

**งานต่อไป (prompt อยู่ใน §7 ทุกอัน ต่อท้าย "ทำเสร็จให้อัปเดต PROGRESS.md และ HISTORY.md และบอกว่าต้องอัปไฟล์ไหนไปโฟลเดอร์ไหน ทำเป็นไฟล์ zip"):**
1. เพิ่มการ์ด (ไม่เกิน ~10 ใบ/แชท) → **งาน A** · **Sonnet 5.5 / medium**
2. เพิ่ม support → **งาน C** · **Sonnet 5.5 / medium**
3. หลังเพิ่มการ์ด/support แต่ละรอบ → **งาน B** · **Opus 5.5 / high** (ต้องใส่ `tags`, `weakTo`, `modes`, `beats`, `team.bestWith/position/bestSupport` คะแนนทีมถึงครบ · ส่วนที่ไม่มีข้อมูลขึ้น "Not enough data yet" และได้แค่ครึ่ง · **+ `tierNote` ทุกใบ**)
4. ตอบคำถามโหมดใน §8 แล้ว → **Sonnet 5.5 / low** แก้แค่ `data/meta.json` (ไม่ต้องแก้โค้ด):
```
ใช้ PROGRESS.md ที่แนบ (ห้ามอ่านจากลิงก์ GitHub: ได้ไฟล์เก่าค้างแคช) แล้วปรับน้ำหนักคะแนนทีมแต่ละโหมด (§10.5) ตามคำตอบนี้: <คำตอบ §8>
ทำเสร็จให้อัปเดต PROGRESS.md และ HISTORY.md และบอกว่าต้องอัปไฟล์ไหนไปโฟลเดอร์ไหน ทำเป็นไฟล์ zip
```
5. แก้หน้าตา → **Sonnet 5.5 / medium** · แก้สูตรคะแนนทีม → **Opus 5.5 / high** · แก้หน้ารายละเอียดการ์ด → **Opus 5.5 / high**:
```
ใช้ PROGRESS.md ที่แนบ (ห้ามอ่านจากลิงก์ GitHub: ได้ไฟล์เก่าค้างแคช) แล้วแก้ <หน้า/ส่วน> ตามนี้: <สิ่งที่อยากแก้>
ต้องผ่าน §4.1 (+ วัดแบบ §11.3 ถ้าแตะหน้ารายละเอียด) ทำเสร็จให้อัปเดต PROGRESS.md และ HISTORY.md และบอกว่าต้องอัปไฟล์ไหนไปโฟลเดอร์ไหน ทำเป็นไฟล์ zip
```

## 1. ภาพรวม
- เว็บ Tier list + คลังการ์ดของเกม card battle บน Roblox ให้ความรู้สึกเหมือน "เข้าไปอยู่ในโลกเกมอีกใบ" กลุ่มเป้าหมายคือ Gen Y ถึง Gen Alpha
- ชื่อเว็บ: **Card Battle Infinity** · หน้าเว็บเป็นภาษาอังกฤษ
- Repo: `sunhoaass/Card_Ascension` (ใช้ตัวเดิม) · **เว็บ (ลิงก์ใหม่ตั้งแต่ 2026-10-24): https://card-battle-infinity.pages.dev/** (Cloudflare Pages ดึงไฟล์จาก repo นี้อัตโนมัติ)
  - ลิงก์เก่า `https://sunhoaass.github.io/Card_Ascension/` ยังเปิดได้ แต่มีสคริปต์ใน `<head>` ของ `index.html` พาไปลิงก์ใหม่ (รักษา `#hash` และ `?query` ไว้ ลิงก์แชร์เก่าจึงยังใช้ได้) · **สคริปต์ทำงานเฉพาะเมื่อ hostname ลงท้าย `github.io` เท่านั้น ห้ามแก้ให้ทำงานบน `pages.dev` (จะวนไม่จบ)**
  - ทุกที่ที่เป็นลิงก์เว็บ (`canonical`, `og:url`, `og:image`, `twitter:image`, JSON-LD ใน `index.html`, `robots.txt`, `sitemap.xml`) ใช้ลิงก์ใหม่แล้ว · ขั้นต่อไปถ้าเพิ่มลิงก์เต็ม ให้ใช้ `https://card-battle-infinity.pages.dev/`
  - `googleac6eef435a8d1c66.html` (ไฟล์ยืนยัน Google) **ห้ามลบ**
  - **ไม่เปลี่ยนชื่อ repo** เพราะ Cloudflare Pages เชื่อมกับ repo นี้อยู่ (ถ้าจะเปลี่ยนให้ถามเจ้าของก่อน)
- เงื่อนไข: **ฟรีทั้งหมด** · ไม่มีฐานข้อมูล · **ไม่มีหน้าแอดมิน ไม่ใช้ AI** (Claude เป็นคนเพิ่มการ์ดและวิเคราะห์ในแชท แล้วเขียนผลลงไฟล์ JSON)
  - ยกเว้น (เจ้าของสั่ง 2026-10-23): **คะแนนทีมในหน้า Deck** คำนวณด้วยสูตรในเบราว์เซอร์ โดยใช้ข้อมูลที่ Claude วิเคราะห์ไว้แล้ว คะแนนจะอัปเดตเองทันทีที่เปลี่ยนการ์ด ไม่มีปุ่มกดวิเคราะห์ และไม่ใช้ AI
- Tier list และ deck ที่ผู้ใช้จัดเอง **เก็บในเครื่องของผู้ใช้คนนั้น (localStorage)** คนอื่นจะไม่เห็น เว้นแต่ผู้ใช้กดแชร์ลิงก์ให้เอง
- Stack: HTML / CSS / JS ล้วน (โฮสต์บน Cloudflare Pages ดึงจาก GitHub repo · เดิมอยู่บน GitHub Pages) · ฟอนต์ Google Fonts · ไอคอน SVG ฝังในโค้ด (เช่น Lucide) · ไม่ใช้ framework

## 3. Design direction
- ธีม (ตั้งแต่ขั้น 9.6b): **"Gilded Nocturne"** แนวเกม PC Silver Palace — เมืองวิกตอเรียนยามค่ำ แสงตะเกียงแก๊ส นักสืบ + เทพนิยาย หรูแต่อ่านง่าย (รายละเอียด HISTORY §12.2) · ธีมเดิม "Infinity Rift" (อวกาศ, กระจกฟ้า-ม่วง) เลิกใช้แล้ว
- พื้นหลัง: ท้องฟ้ายามค่ำ + ดาวจาง + พระจันทร์ + เงาเมือง 2 ชั้น (โดมวัง, หอนาฬิกาหน้าปัดเรืองแสง, หน้าต่างไฟติด) + แสงตะเกียง + หมอกเลื่อน + ละอองไฟลอยขึ้น (`FX.backdrop`) · กล่องเป็นพื้นทึบ + เส้นทองบาง + มุมตัดเฉียง + ลายมุมวิกตอเรียน · blur เฉพาะหัวเว็บกับเมนู
- ฟอนต์: หัวข้อ/ตัวเลข **Cinzel** (Google Fonts) · เนื้อหา **Inter**
- เมนู: มือถือ/แท็บเล็ต (< 1100px) = **แถบล่าง 5 ปุ่มแผ่นทองเหลือง** · คอม (≥ 1100px) = **เมนูแนวตั้งด้านซ้าย** (ตรา + ชื่อเว็บด้านบน, ปุ่มเพลง + วันที่ด้านล่าง) · ไอคอนวาดเอง: Tier = มงกุฎ · Cards = พัดไพ่ · Support = ขวดยา · Deck = หนังสือ · Grade = แว่นขยาย
- ไอคอนเว็บ (favicon / ไอคอนหน้าจอโฮม): การ์ด 2 ใบ ฟ้า (`--t-c`) + ม่วง (`--flux`) ไขว้กันเป็น ∞ สีทอง ขอบทอง · ไฟล์อยู่ใน `images/` + `site.webmanifest` ที่ root (รายละเอียด HISTORY §9 รายการ 2026-10-24 ย้ายเว็บ) · ทุกลิงก์ไอคอนต่อท้าย `?v=2` · แก้ไอคอนอีก = เปลี่ยนเป็น `?v=3` ทุกลิงก์ไอคอนใน `index.html` และใน `site.webmanifest`
- จำหน้าล่าสุดของผู้ใช้ไว้ใน localStorage · เข้าเว็บครั้งแรกให้เปิดหน้า Tier List
- แสดงวันที่อัปเดตข้อมูลล่าสุดที่หัวเว็บ (คอม: ท้ายเมนูซ้าย)
- หน้าโหลด: ตราวงกลม + นาฬิกาพกเข็มหมุน + "Loading…" (หายเมื่อข้อมูลมา, หายเองหลัง 8 วิเสมอ)
- หัวข้อแต่ละหน้า: คำเล็กด้านบน (The Gallery / The Archive / The Apothecary / The Casebook / The Appraiser) + ชื่อหน้าตัวทองไล่เฉด + เส้นลายกลาง
- **กรอบการ์ด = กรอบรูปทองประดับ** มีลายที่ 4 มุม · ป้ายระดับ = ริบบิ้นมุมซ้ายบน · tier = **ตราครั่งกลม** มุมขวาบน · ชื่อการ์ดอยู่กลางมีเส้นใต้:

| ระดับ | สี / เอฟเฟกต์ |
|---|---|
| Normal | เงินเรียบ ไม่มีแสง |
| Shiny | ทอง + แสงวิ่งผ่าน |
| Rainbow | กรอบรุ้งหมุน (หมุนจริงแล้ว) |
| Secret | ดำ-แดงไวน์ เรืองแดงเต้น |
| Divine | ขาว-ทอง มีวงแสงรอบการ์ด |
| Cosmic | ม่วง-น้ำเงิน หมุนช้า มีดาวในกรอบ |
| Ascended | prismatic หมุน + ละอองแสงลอย (**เฉพาะการ์ดใหญ่** · การ์ดเล็กไม่มีละออง) |


### 3.2 Design tokens (อยู่ใน `css/tokens.css` — ห้าม hard-code สีในไฟล์อื่น ให้ใช้ตัวแปร) · ชุด "Gilded Nocturne" ขั้น 9.6b
ชื่อตัวแปรเดิมยังอยู่ครบ (หน้าเก่าไม่พัง) แต่ค่าเปลี่ยน: **`--rift` = ทองแล้ว** · `--flux` = ม่วงอเมทิสต์
| กลุ่ม | ตัวแปร | ค่า |
|---|---|---|
| พื้นหลัง | `--void` / `--void-2` / `--nebula` / `--haze` | `#0b1020` น้ำเงินหมึก / `#131a2e` / `#1a2238` / `#2a1528` ม่วงไวน์จาง |
| กล่อง | `--glass` / `--glass-strong` / `--glass-line` / `--glass-under` / `--panel-fill` | ทองโปร่ง 5% / 11% / เส้นทอง 30% / พื้นทึบ 93% ใต้ `.glass` / ไล่เฉดพื้นของกล่องทอง · blur 14px (เฉพาะหัวเว็บ + เมนู) |
| โลหะ | `--gold` `--gold-hi` `--gold-lo` · `--silver` · `--wine` `--wine-hi` · `--brass` `--brass-gold` `--brass-wine` · `--on-gold` | ทองเก่า `#d8b46a` / สว่าง / เข้ม · เงิน · แดงไวน์ (ปุ่มอันตราย) · แผ่นทองเหลือง 3 แบบ (ปุ่มธรรมดา / ปุ่มหลัก / ปุ่มลบ) · สีตัวหนังสือบนแผ่นทอง |
| ตัวอักษร | `--ink` / `--ink-dim` / `--ink-faint` | งาช้าง `#efe6d2` / `#b3a88f` / `#7d7563` |
| แสง | `--rift` (= `--gold`) / `--flux` / `--lamp` / `--rift-glow` | ทอง / อเมทิสต์ `#9b86d6` / แสงตะเกียง `#ffd48a` / เงาเรืองทอง |
| สีสัญญาณ | `--atk` `--hp` `--def` `--status` `--good` `--bad` | โทนอุ่นอ่อนลงให้เข้ากับทอง |
| สีระดับการ์ด | `--r-normal(-2)` `--r-shiny(-2)` `--r-secret(-2)` `--r-divine(-2)` `--r-cosmic(-2)` + `--r-rainbow` `--r-ascended` (conic) | ตามตาราง §3 |
| สี Tier (โทนอัญมณี) | `--t-god` `--t-ss` `--t-s` `--t-a` `--t-b` `--t-c` `--t-d` + `--t-x-*` 6 สี (Tier Maker) | แดงเปลวไฟ `#e2453c` / ชมพูทับทิม / อำพัน / ทอง / หยก / ไพลิน / ดีบุก |
| เกรด | `--g-bronze(-2)` `--g-silver(-2)` `--g-gold(-2)` `--g-rainbow` `--g-rainbow-line` `--g-empty` | เหรียญตรา |
| คะแนนทีม (ขั้น 11) | `--score-bad` `--score-mid` `--score-good` `--score-perfect` (= `--r-rainbow`) | แดง / เหลือง / เขียว / รุ้ง |
| ฟอนต์ | `--font-display` = Cinzel 500–700 · `--font-body` = Inter 400–600 | |
| ขนาดตัวอักษร | `--fs-xs`…`--fs-3xl` (สเกล 1.25: 12 / 14 / 16 / 20 / 25 / 31 / 39px) | |
| ระยะ | `--s-1`…`--s-12` (ตาราง 4px) · `--gutter` 16px / 32px (≥ 1100px) | |
| รูปทรง | `--r-chip` 6 · `--r-card` 8 · `--r-panel` 12 · `--r-pill` · `--cut` 10px + `--chamfer` (มุมตัดเฉียง) | มุมเล็กแบบกรอบรูป/แผ่นโลหะ |
| ลายมุม | `--orn-tl` `--orn-tr` `--orn-bl` `--orn-br` (SVG ใช้เป็น `mask`, สีมาจาก background) · `--orn-s` ขนาด 22px (24px ≥ 1100px) | |
| Layout | `--nav-h` 70 · `--header-h` 58 · `--side-w` 252 (เมนูซ้ายบนคอม) · `--max-w` 1180 | |
| Motion | `--ease` · `--t-fast` 150 · `--t-med` 250 · `--t-slow` 400ms | |

### 3.3 โครงไฟล์และของกลางที่มีแล้ว (ฉบับเต็มก่อนย่อ: HISTORY §0.3)
**หน้า + route**
- `index.html` — หน้าเดียว 5 section (`#page-tier`, `#page-cards`, `#page-support`, `#page-deck`, `#page-grade`) + หน้ารายละเอียดการ์ด `#detail` (วางทับทุกหน้า) · เปลี่ยนหน้าด้วย hash · จำหน้าล่าสุด `cbi:lastPage` · ครั้งแรกเปิด Tier List · SVG sprite ไอคอนต้น `<body>` (`#i-crown #i-fan #i-potion #i-book #i-lens #i-note #i-flourish #i-crest`) ใช้ `<svg><use href="#i-…"/></svg>`
- **Route:** `#tier #cards #support #deck #grade` = แท็บ (ไม่เพิ่มประวัติ · แตะแท็บที่เมนูล่าง = กลับหน้าหลักของแท็บ เช่น Tier → Global, Deck → `#deck`) · `#tier/my` = My Lists · `#tier/my/<list id>` = editor (เปิดจากหน้ารวม = เพิ่มประวัติ 1 รายการ · id ไม่มี = กลับหน้ารวม) · `#tier/s/<data>` = list ที่แชร์ (ดูอย่างเดียว ในแท็บ My Lists) · `#deck` = My Decks · `#deck/meta` · `#deck/my/<id>` = editor (เพิ่มประวัติ `{dkl:1}` · id ไม่มี = `#deck`) · `#deck/s/<data>` = deck ที่แชร์ (ดูอย่างเดียว + Save a copy) · `#support/<id>` · `#grade/<id>/<atk>-<def>-<status>-<hp>` · `#card/<id>` = รายละเอียดการ์ด · `app.js` เรียก `CBI.deck.show()` ทุก `route()`
- **`#card/<id>`:** เปิดแต่ละครั้งเพิ่มประวัติ 1 รายการ `{depth, cl}` (`cl` = รายการ id ที่ใช้ปัดซ้ายขวา) · **ปัดไปใบอื่น = `replaceState` (`C.swapCard`) ไม่เพิ่มประวัติ** · ‹ Back บนจอ / Esc / Back ของมือถือ ปิดทั้งหมดในครั้งเดียว · ไม่รู้ว่าเปิดจากไหน (ลิงก์ตรง) = ใช้รายการหน้า Cards · id ไม่มี = กลับหน้าเดิม
- **Back กลับที่เดิมสภาพเดิม:** ก่อนเปิด `#card/…` / `#support/…` เก็บตำแหน่งเลื่อนใน `history.state.tierY` → `showPage` เลื่อนกลับและไม่เล่นอนิเมชั่นเข้าซ้ำ (ใช้ได้ทั้ง tier และ deck · แท็บเมนูล่างล้างค่าเอง)

**CSS:** `tokens.css` (ตัวแปร §3.2 + `--bs-*` ของฉากรายละเอียด + `--t-spin` 900ms) · `base.css` (`#backdrop`, `#boot`, header, เมนู, `.music`, หน้า + หัวข้อ, ชิป, `.seg`, กล่องทอง `.panel`, empty state) · `fx.css` (อนิเมชั่นกลาง + การ์ด + aura 7 ระดับ) · `cards.css` (แถบเครื่องมือ Cards + ชิ้นส่วนรายละเอียดที่ใช้ร่วม `.detail__*` `.dstat` `.dpanel` `.score` `.badge` — หน้า Support, Grade, แผ่น Details ใช้) · `tier.css` (แถว tier + ไทล์ support + `tier-row__name--long`) · `deck.css` · `support.css` · `grade.css` · `tiermaker.css` · `detail.css`

**JS (แต่ละไฟล์บอกว่าโหลดหลังใคร)**
- `js/fx.js` → `FX.press()`, `FX.tilt(card)` (นิ้วลากขึ้นลงเกิน 10px = scroll → ปล่อยการ์ด), `FX.countTo(el, n)`, `FX.stagger(list, gap, {cls, max, limit, cleanup})`, `FX.flip(el, rect, {reverse})` (shared element), `FX.fade(el, 1|0)`, `FX.toast(text, {action:{label, fn}, duration, bottom})` (`.fx-toast`), `FX.flash(el)`, `FX.backdrop(el)`, `FX.reduced`, `FX.lite`, `FX.probe()`
- `js/app.js` (แกน: router, โหลดข้อมูล, การ์ด) → `window.CBI`: `rarityChipsHTML()` (ใส่ใน `.rarity-picker` ได้เลย การคลิกจัดการโดย cards.js), `renderCard(card, rarity, {mini, tilt})` (`tilt:false` = ไม่เอียงตามนิ้ว), `setCardRarity(el, card, rarity, {animate})`, `statAt / oddsAt / fmtOdds / fmtStat`, `isRanked(card)`, **`esc()`** (escape ข้อความจากข้อมูลทุกครั้ง), `openCard(id, originEl, {list})`, `closeCard()`, `swapCard(id)`, `state` (`meta`, `cards`, `support`, `teams`, `rarity`), `hash`, `route()`, `placeholderArt()`, `lazy()`, `watchLive()`, `livePause(on)` (เก็บการ์ดที่ watch แบบ WeakRef แล้ว observe ใหม่ตอน resume), `artImg()`, `bindArt()`, `hideBoot()`, `TIER_COLOR` · boot เรียก `CBI.detail.init()` และ `prewarm()` 3.6 วิหลังโหลด (lite ไม่วาดล่วงหน้า)
- `js/cards.js` (หลัง app.js) `CBI.cards = { init, setRarity(name), order() }` · **`setRarity` = ที่เดียวที่เปลี่ยนระดับทั้งเว็บ** (บันทึก `cbi:rarity` + ยิง event `cbi:rarity`) · `order()` = id ตามลำดับที่หน้า Cards แสดงอยู่
- `js/tier.js` (หลัง cards.js) `CBI.tier = { init, enter({restore}), show("global"|"my") }` · แท็บย่อย Global | My Lists (`#tier-tabs`, `.seg`) · Global มีสวิตช์ **Cards | Support** (`#tier-kind`, `cbi:tierKind`) แยกรายการ ไม่รวมกัน · Cards = แถว GOD–D ตาม Overall + ปุ่มระดับ (event `cbi:rarity`) · Support = แถวตาม `scores.value` ไทล์ `.stile` (`CBI.support.card()`) กดแล้วเปิด `#support/<id>` · สร้างใน `buildGlobal()` เมื่อแท็บ Global แสดงจริง · Global ดูอย่างเดียว (Claude แก้ผ่านงาน B)
- `js/tiermaker.js` + `tiermaker.css` (My Lists · โหลดหลังสุด) `C.tm = { init, show(listId|null, sharedData?), mode() }` (`"index"|"editor"|"shared"`) · ทุกอย่างอยู่ใน `#tm` (`data-no-detail`: แตะการ์ด = เลือก) · `#tm-index` / `#tm-editor` / `#tm-shared`
  - ข้อมูล `cbi:tierlists` (§3.4) บันทึกทุกครั้งที่แก้ (ไม่มีปุ่ม Save) · ข้อมูลเสียซ่อมเอง (สี/ระดับที่ไม่รู้จัก → `--t-d` / Normal, uid ซ้ำ → สร้างใหม่) · `cbi:tmPrefs` = `{ compare, poolOpen, hidePlaced }` · เก็บไม่ได้ = แถบ `#tm-warn` แต่ใช้งานได้
  - **แก้ข้อมูลผ่าน `commit(fn)` เท่านั้น** (undo + บันทึก + วาดใหม่แบบ FLIP) · `renderRows()` ใช้ node เดิมตาม uid · undo/redo 50 ครั้ง/list ใน memory (Ctrl+Z / Ctrl+Shift+Z) · กล่องแก้แถวเปลี่ยนสดแต่นับ undo 1 ครั้ง · ลบแถว/ล้างแถว/เอาการ์ดออก ไม่ถาม แต่มี toast Undo · ลบ list ถามยืนยันเสมอ
  - **ลาก:** Pointer Events เขียนเอง (ไม่ใช้ HTML5 drag) · เมาส์ขยับ > 6px = ยก · นิ้ว**กดค้าง 0.26 วิ** (ขยับเกิน 10px ก่อนนั้น = scroll) · ยกแล้วกัน scroll (`touchmove` preventDefault) · ใกล้ขอบ/เหนือ pool เลื่อนเอง · ตัวที่ถือ = สำเนาใน `.tm-layer` (fixed บน body) ขยับด้วย paused animation (`ghostAxis()`) · ช่องวาง `.tm-ph` · แตะวาง: แตะเลือก แล้วแตะแถว · คีย์บอร์ด: Enter/Space เลือก, Tab ไปป้ายแถวแล้ว Enter = วาง, Esc ยกเลิก, Delete เอาออก
  - pool `.tm-dock` = แถบเลื่อนข้าง sticky ติดล่างจอ มีการ์ดทั้งคลังเสมอ (ลากออก = สร้างสำเนา จึงใส่ซ้ำได้) + ค้นหา + กรอง Tier (+ Unranked) / Role / Series + "Hide placed" · แถบคำสั่ง `.tm-act` (Details · Duplicate · Remove · Cancel) ลอยเหนือ pool
  - list ใหม่: Blank หรือ Start from Global (7 แถว GOD–D) · ระดับเริ่ม = ระดับทั้งเว็บ · ระดับของ list ใช้ `data-tm-rarity` (**ห้ามใช้ `data-rarity`** เพราะ cards.js จะเปลี่ยนระดับทั้งเว็บ) · การ์ดใน tm ซ่อนป้ายระดับ, ในแถวซ่อนป้าย tier Global · สีแถว 12 สี (`--t-*` 6 + `--t-x-*` 6)
  - **Compare with Global** (เฉพาะ list Card): แถวที่ชื่อตรง tier (GOD, SS…D ไม่สนตัวพิมพ์) = tier นั้น · ชื่ออื่นนับตามลำดับ (แถว 1 = GOD …) · ป้าย ↑n = วางสูงกว่า Global n ขั้น · Unranked ไม่มีป้าย
  - `C.dialog({title, html, actions, onMount})` → Promise · `<dialog class="tm-dlg">` มี scrim ของตัวเอง (`::backdrop` อ่านตัวแปร CSS ไม่ได้ในเบราว์เซอร์เก่า) · ปุ่มกลาง `.tm-btn` / `--primary` / `--danger` · **ห้ามใช้ alert/confirm**
  - `boardSpec(l)` / `toPayload(l)` / `fromPayload(p)` · เมนู ⋯ ของ list: Save as image / Share link (ปิดใช้ + บอกเหตุผลถ้า list ว่าง) · มุมมองแชร์ (Save a copy / Save image · `shCopies` กันสำเนาซ้ำ) · `importLists(data, how)` · ปุ่ม Backup บนหัวหน้ารวม + "Restore from backup" ในหน้าว่าง · `LIST_MAX=200` / `ITEM_MAX=600` ตอนรับข้อมูลภายนอก · Details ของ support เก็บ `tierY` แล้วเปิด `#support/<id>`
- `js/share.js` (รูป / ลิงก์ / สำรอง · หลัง app.js ก่อน tiermaker.js) `C.share = { imageDialog, previewDialog, tierImage, deckImage, deckImageDialog, makeLink, readLink, linkDialog, backupDialog, provide, copyText, icons, slug }`
  - **รูป:** Canvas 2D (ไม่แคป DOM) กว้างตรรกะ 1200px scale ≤ 2 (ลดเองถ้าเกิน 16M พิกเซล / 16000px) → `{blob, width, height, filename}` · `tierImage({ id, title, type:"card"|"support", rarity, rows:[{ label, color:"--t-ss", items:[id…] }] })` · `deckImage({id, title, mode, rarity, cards:[5], support:[5]})` · ส่วนร่วม `paintBackdrop` / `paintRibbon` / `paintFooter` / `drawOrnaments` · **ถ้าแก้สีกรอบใน fx.css ต้องแก้ `frameSpec` ด้วย** · `drawPlaceholder` ต้องตรงกับ `C.placeholderArt` · การ์ดหาไม่เจอ = ช่องเส้นประ · รอฟอนต์ `document.fonts.load` · ลายน้ำอ่านจาก canonical · มือถือ `navigator.share` พร้อมไฟล์ / คอม ดาวน์โหลด `.png` · ลิงก์ยาวเกิน 6000 ตัวอักษรมีคำเตือน
  - **ลิงก์:** `makeLink(route, obj)` → `location.origin + pathname + "#<route>/s/<data>"` · JSON → `CompressionStream("deflate-raw")` → base64url นำหน้า `z` (หรือ `p` = ไม่บีบ) · `readLink` async + กันบวม (≤ 24000 ตัวอักษร, JSON ≤ 200000 ไบต์) · payload ต้อง `clean()` ก่อนใช้เสมอ · **สีเก็บเป็นลำดับใน array `COLORS` ของ tiermaker.js → ห้ามสลับ/แทรกกลาง (เพิ่มท้ายได้)**
  - **สำรอง:** `C.share.provide(id, { label, kind:"array"|"object", get, count, noun, apply(data, "merge"|"replace") → จำนวนที่เปลี่ยน })` · มี `tierlists`, `grades`, `decks` · ไฟล์ `{ app:"card-battle-infinity", type:"backup", version:1, exported, data:{…} }` · Import ตรวจ (≤ 5MB, app/type/version) → Merge / Replace → toast Undo (snapshot) · Merge ไม่ทับของเดิม · Replace ไม่แตะส่วนที่ไฟล์ไม่มี
  - ปุ่ม share/copy อยู่ในกล่องและกดใหม่หลังวาดเสร็จ (กฎ user-gesture ของ iOS) · toast/flash เล่นหลังกล่องปิด
- `js/deck.js` + `deck.css` (หลัง tier.js) `CBI.deck = { init, enter({restore}), show, paintScore }` · สร้างใน `C.lazy("deck", build)` · แท็บย่อย My Decks | Meta Decks (`#deck-tabs`, `.seg`)
  - **Meta Decks** จาก `teams.json` + ปุ่ม Copy to My Decks (โหมด Tower, ระดับ = ระดับทั้งเว็บ, support ของ slot เข้าช่องเดียวกัน ที่เหลือเติมช่องว่าง, ชื่อซ้ำต่อท้าย `(copy)`)
  - ข้อมูล `cbi:decks` (§3.4) บันทึกทุกครั้งที่แก้ · `clean()` ซ่อมข้อมูลเสีย (โหมด/ระดับไม่รู้จัก, การ์ดซ้ำ, ช่องเกิน 5, id ยาวเกิน) · สูงสุด 200 deck · เขียนไม่ได้ = `#dk-warn`
  - **แก้ผ่าน `commit(fn, {animate, land})` เท่านั้น** · undo 50/deck · `step(±1)` + Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y · `paintKind()` ใช้ node เดิมตาม id
  - board `buildBoard()` (editor `#dk-board` + shared `#dk-sh-board`) · `.dk-row[data-kind="cards"|"support"]` แถวละ 5 `.dk-slot` · การ์ด `.dk-item` · ช่องว่าง `.dk-add` · × `.dk-x` (44px)
  - ตัวเลือก `openPicker(kind, i)` = `C.dialog` + ค้นหา + ชิป Tier/Role + Series + สร้างทีละ 40 ใบ (IntersectionObserver) · **การ์ดซ้ำใน deck ไม่ได้** (จาง + ป้าย `Slot n`) · **support ซ้ำได้** (§8)
  - ลาก/แตะเหมือน Tier Maker (ghost = paused animation `ghostAxis`, `GHOST_R`) · วางช่องชนิดเดียวกัน = ย้าย/สลับ · วางที่อื่น = บินกลับ · แตะ = เลือก (แถบ `.tm-act` ใน `#dk-dock`: Details / Replace / Remove / Cancel) · แตะช่องว่างชนิดอื่นตอนเลือก = ยกเลิกแล้วเปิดตัวเลือกช่องนั้น · dock เว้นที่ใต้ board ให้เลื่อนแถว support ขึ้นเหนือแถบได้
  - ระดับต่อ deck `data-dk-rarity` (**ห้าม `data-rarity`**) · โหมด `data-dk-mode` ใน `#dk-mode` · `MODES` ใน deck.js override ชื่อ/enabled จาก `data/meta.json → modes` (Boss `enabled:false` = ป้าย Soon)
  - **คะแนน:** `scoreHTML()` / `paintScore(el, {score, band, label}, {animate, note})` (`band` = `none|bad|mid|good|perfect` · สี `[data-band]` จาก `--score-*`) · `refresh()` ท้าย `commit()` / `step()` / `setRarity()` / `openEditor()` / import → วง + `paintAnalysis()` (`#dk-analysis`: Score breakdown / Strengths & weaknesses / Fits modes) + `scheduleSuggest()` (Fill the gaps หลังวาด 90ms, `sugCache`) · หน้าแชร์ `#dk-sh-score` + `#dk-sh-analysis` (ไม่มี Fill the gaps) · หน้ารวม `.dkl__score` · `compareDialog(id)` (`#dk-compare`, ปุ่มใต้ analysis, เมนู ⋯) · ชิปการ์ด `data-open-card` + `data-id` · แตะโหมดใน Fits modes = `setMode` · 100 = `.dk-score__halo` (`.is-live`) + `.dk-spark`
  - **แชร์:** เมนู ⋯ → Save as image (`deckImageDialog`) · Share link payload `{v:1,n,m,r,c:[5],s:[5]}` (`fromPayload()` ตรวจ) · Rename / Duplicate / Delete · `openShared(data)` · Save a copy 1 ชุด/ลิงก์ (`shCopies`) · สำรอง `provide("decks")` ใน `init()` (merge = เพิ่ม id ที่ไม่มี, id ซ้ำเอาอันที่แก้ล่าสุด)
  - หน้ารวม `.dkl` (ใช้ `.tml`) · id หาไม่เจอ = ช่องเส้นประ ("Not in the library" / Meta Decks "Not added yet")
- `js/teamscore.js` (ไม่มี DOM · หลัง app.js ก่อน deck.js) `CBI.teamScore = { score(deck, mode?), analyze(deck), suggest(deck, kind, n), band(score), modeConfig(id), modes(), PARTS, K }` · ค่าปรับทั้งหมดใน `K` ต้นไฟล์ (`K.threatTiers = ["GOD","SS"]`) · `lib()` สร้างใหม่เมื่อ array ข้อมูลเปลี่ยน · สูตร §10.5
- `js/support.js` + `support.css` (หลัง tier.js) `CBI.support = { init, show, card(s), open(id, originEl) }` · รายละเอียดอยู่**ในหน้า Support เอง** (`#support/<id>`) ไม่ใช่ overlay · แตะแท็บ Support = กลับรายการ · Back/Esc กลับรายการ จำตำแหน่งเลื่อน · id ไม่มี = กลับรายการ
- `js/grade.js` + `grade.css` (หลัง support.js) `CBI.grade = { init, show, panelHTML, overall, band, get }` · หน้าเลือกการ์ด (mini, ค้นหา, "My graded cards") + หน้าตั้งเกรดในหน้าเอง · `cbi:grades` = `{ id: [4 ตัวเลข] }` · ลิงก์ที่มีเกรดคนอื่น = แถบ "Shared grades" (Keep these / Use my grades) ไม่ทับจนกว่าจะกด · `.gorb` (`data-band` none/bronze/silver/gold/rainbow) + `.card__grade` · ปุ่ม **Card details** (`data-act="details"`) ปัดตามลำดับหน้าเลือก · **สูตร:** 4 ค่า (ATK, DEF, Status DMG, HP) เลือก 1–10 เอง (ไม่สุ่ม) · +2.5%/เกรด · เกรดรวม = เฉลี่ย 4 ค่าปัด .5 ขึ้น · **ไม่มีผลกับ Overall / Tier** · สีเกรดจริงยังรอ (HISTORY §6.1)
- `js/detail.js` + `detail.css` (หน้ารายละเอียด "Black Sun" · หลัง cards.js) `CBI.detail = { init, open(id), close(), prewarm(), listFor(originEl, id) }` · markup `#detail.bs` · layout/ป้าย/ผลวัด: HISTORY §14
  - **กดการ์ดที่ไหนก็เปิด:** ตัวดัก click/Enter ของ `.card[data-id]` ใน `<main>` ทั้งเว็บอยู่ที่นี่ (หน้าอื่นไม่ต้องเขียนเอง · `[data-no-detail]` = ไม่เปิด · ปุ่ม/ชิปที่ไม่ใช่การ์ดใช้ `data-open-card="<id>"` + `C.openCard(id, el)`) · การ์ดใบเดียวกันอยู่ได้หลายที่ ปิดแล้วบินกลับใบที่กดมา
  - **รายการปัด** (`listFor`): หากล่องตาม `LIST_SCOPE` = `[data-card-list], #card-grid, #tier-list, #tm-rows, #tm-sh-rows, #tm-pool, .dk-row, .deck, .mini-row` (ไม่เจอ + เป็นชิป = กล่องแม่ของชิป) เก็บ id ตามลำดับบนจอ · **หน้าใหม่ที่มีรายการการ์ด ใส่ `data-card-list` ที่กล่อง** หรือส่ง `C.openCard(id, el, { list })` · ปัดวนจากใบสุดท้ายไปใบแรก · ใบก่อน/ถัดไปสร้างล่วงหน้า
  - ปิด = การ์ดบินกลับช่อง (ช่องนอกจอ = จางหาย **ไม่เลื่อนหน้า**) · หน้าข้างใต้ไม่ถูก render ใหม่ · ตอนฉากเต็มจอ (`html.is-detail-settled`) ซ่อน `.main` + หยุดอนิเมชั่นข้างใต้ + ซ่อนพื้นหลัง (< 1100px) + `C.livePause(true)` · ปิดแล้วคืนก่อนการ์ดบินกลับ
  - แผ่น Details มีกล่อง Grade (`CBI.grade.panelHTML`) · DEF / Status DMG ขึ้นเฉพาะการ์ดที่มี `base.def` / `base.status` · ข้อความแนะนำ 2 ครั้งแรก (`cbi:bsHint`) · **ไม่มีปุ่ม Tilt / Replay** (เอาออก 2026-10-25)
  - **เปิดการ์ด = intro ผงรวมเป็นการ์ดทุกครั้ง** (`runIntro()` · ไม่บินจากช่องแล้ว · รอภาพวาดฉากไม่เกิน 1.2 วิ) · ปัดเปลี่ยนใบ = การ์ดเลื่อนออก 170ms แล้ว `runIntro(true)` (เวลา ×0.75) · ปัดต่อได้ระหว่าง intro · ปิด = บินกลับช่องเหมือนเดิม
  - **การ์ด 3D:** มุมที่แสดง = นิ้ว (`R3.ang/tx`) + เอียงตามเมาส์ (`R3.ly/lx`, คอมเท่านั้น) · **มือถือ: เอียงเครื่องแล้วไม่มีอะไรขยับ** (เอา `deviceorientation` ออกทั้งการ์ดและ parallax ฉาก · เจ้าของสั่ง 2026-10-25) · คอม: หันตามเมาส์ · จำกัดมุมด้วย `soft()` (ลาก ±36°/±18°, รวม ±42°/±24° · ค่าใน `MAX_YAW` ฯลฯ) ไม่ตะแคงเป็นเส้น ยกเว้นแตะหมุน 360° / สะบัด (`R3.spin`) · ตรงแล้ว = กลับเป็น 2D (`exit3D`) · ยังเอียงค้าง = อยู่ 3D นิ่งๆ ไม่มี rAF · `.is-busy` (ละอองหมุนวน) เฉพาะตอนหมุน/ลาก ไม่ใช่ตอนเอียง
  - **holo แสดงตลอด:** `.bs-holo` (กล่องตัด อยู่นิ่ง) > `b` (ขึ้นลงตาม pitch) > `i` (ซ้ายขวาตาม yaw) · ตอนพักใช้ `commitStyles()` ค้างตำแหน่งล่าสุด ไม่วนอนิเมชั่น
  - **ป้าย 4 ป้าย:** Tier (`tier` + `tierNote` · ไม่มี note = "Overall x / 100") · Passive / Skill (รวม `passive` + `skill`) · Strongest · Weakness · แสดงตลอด (ไม่จางตอนหมุน) · **จุดบนการ์ดตามการ์ด:** `placeCo()` คำนวณตำแหน่งที่ฉายแล้วล่วงหน้าเป็น paused Web Animation (yaw 37 ขั้น + pitch 13 ขั้น) · `apply3D()` → `poseCallouts()` ตั้งแค่ currentTime · โครง `.bs-line/.bs-dot` > `b` > `i` (`i` = ตัวที่เห็น + อนิเมชั่นตอนป้ายขึ้น)
  - แผ่น Details: แถวคะแนน **Passive / Skill 30%** (= ค่าเฉลี่ย `scores.passive` กับ `scores.skill` · Overall ไม่เปลี่ยน) · กล่อง "Passive / Skill" · `tierNote` ใต้คะแนน Overall
  - `.bs` = `touch-action: none` ทั้งฉาก (กันหน้าเว็บข้างใต้เลื่อน → แถบเบราว์เซอร์ยุบ → ฉากเปลี่ยนขนาด → การ์ดเลื่อนลง) · ที่เลื่อนได้ใส่ `pan-y` (แผ่น Details, กล่องป้าย, ป้ายจอกว้าง)
- `js/music.js`: ปุ่ม `.js-music` (หัวเว็บ + ท้ายเมนูซ้าย) ซ่อนจนเจอ `audio/bgm.mp3` (HEAD 1 ครั้ง · 404 1 บรรทัดใน console = ตั้งใจ) · เริ่มแบบปิด · เปิด/ปิด fade 0.6 วิ · `cbi:music` / `cbi:musicVol` (0.35) · `preload="none"` · หยุดเมื่อสลับแท็บ/ล็อกจอ · สเปกเต็ม HISTORY §12.5

**ของกลางธีม Gilded Nocturne — หน้าใหม่ต้องใช้**
- **กล่องทอง:** `.panel` (หรือ `.dpanel` ในหน้ารายละเอียด) = เส้นทอง 1px + มุมตัดเฉียง + ลายมุม 4 มุม · selector รวม `.panel, .dpanel, .dstat, .deck, .tier-row, .goverall, .tm-dlg__sheet` (ตัวกล่อง = เส้นทอง, `::before` = พื้น, `::after` = ลายมุม) · **ห้ามใช้กับกล่องที่มีเงาด้านนอกหรือขยับ/ลาก** (clip-path ตัดเงา) → ใช้ `.glass` · ปรับด้วย `--cut` / `--orn-s`
- **หัวข้อหน้า:** `<p class="page__eyebrow">The …</p>` + `<h1 class="page__title">` + `<div class="page__rule" aria-hidden="true"><svg><use href="#i-flourish"/></svg></div>` + `.page__lead` · เส้นทองกวาดอัตโนมัติจาก `.page.fx-page-in`
- **ปุ่ม/ชิป:** `.tm-btn` / `--primary` / `--danger` · `.iconbtn.glass` · `.chip` (เลือกแล้วเป็นแผ่นทอง) · `.badge--tier` · สวิตช์ `.seg` (+ `.seg__ind`, `--i`)
- **การ์ด:** ใส่ `data-rarity` บน `.card` แล้ว CSS ทำ aura เอง · `renderCard` มี `.card__orn` ต่อท้าย `.card__body` ใน `.card__frame` · support `.scard__orn` (เฉพาะใบใหญ่) · สีลายมุม `--orn` ตามระดับ · การ์ด mini ไม่มีละอองลอย · ป้าย 3 ตัวอักษร (GOD) ใช้ `card__tier--long` / `scard__tier--long` · `@keyframes fx-spin` มี `translate(-50%,-50%)` → **ใช้กับชั้นที่จัดกลางด้วย left/top 50% เท่านั้น** ตัวหมุนอื่น (เช่น `.fx-loader`) ใช้ keyframe ของตัวเอง · การ์ดมี `role="button"` กด Enter/Space ได้ · เหรียญเกรด 10 = แผ่นรุ้งหมุน (`::before` จัดกลาง)
- **Unranked** = `scores.overall` 0 หรือ `tier` ว่าง → ป้าย Unranked ไม่มีป้าย tier ไม่ขึ้นแถว Tier List เรียงท้ายสุด · `image` ว่าง/โหลดไม่ได้ = รูปวาดแทน (ซุ้มประตูโค้ง `C.placeholderArt`) · `"mock": true` = ป้าย mock
- **พื้นหลัง** `FX.backdrop($("#backdrop"))` วาดครั้งเดียว · ชั้นที่ขยับตลอด = หมอก + ละอองไฟ (CSS transform) · เมืองขยับตอน scroll ด้วย **Web Animation ที่ pause แล้วตั้ง currentTime** (CSS animation ที่ pause ไม่อยู่บน fast path) · `#backdrop` z-index -1 → **`body` ต้องไม่มีสีพื้น** (สีอยู่ที่ `html` · ห้ามสีพื้นแบบ `fixed` ที่ body) · lite = ละอองน้อยลง · reduced = ภาพนิ่ง
- `#boot` ซ่อนด้วย `hideBoot()` (หรือ CSS หลัง 8 วิ) · วันที่อัปเดต = ทุก element ที่มี `data-updated` (+ `#updated`)
- **Breakpoint:** < 1100px = หัวเว็บ + เมนูล่าง · ≥ 1100px = เมนูซ้ายกว้าง `--side-w` ซ่อนหัวเว็บ `.main` / `.detail` / toast เลื่อนขวา · ของที่ติดล่างจอต้องอยู่เหนือเมนูล่างจนถึง 1099px

**ของกลางด้านความเร็ว — หน้าใหม่ต้องใช้**
- `C.lazy(page, fn)` = เรียก `fn` ครั้งแรกที่แท็บแสดง · **สร้างการ์ดของหน้าใน fn นี้เสมอ** ไม่ใช่ตอน `init()` (Cards / Grade / Support / Deck ใช้แล้ว มีตัวแปร `built` · Tier ใช้ `buildGlobal()`)
- **aura เล่นเฉพาะการ์ดบนจอ:** `renderCard` เรียก `C.watchLive(el)` (IntersectionObserver rootMargin 24px) → `.is-live` · อนิเมชั่นวนใน fx.css เขียนเป็น `.card[data-rarity=…].is-live …` · **เอฟเฟกต์วนแบบใหม่ต้องผูก `.is-live` แบบเดียวกัน**
- **การ์ดพักเป็น transform 2D** (`.card` / `.scard` = `translateY(var(--lift))`) · 3D เฉพาะ `.is-tilting` / `:hover` · ห้าม 3D ตอนพัก และห้าม `transform: none` (hit-test ช้า 5 เท่า)
- **ห้ามเขียน `style.transform` ทุกครั้งที่ scroll / ขยับนิ้ว** → ใช้ animation ที่ pause แล้วตั้ง `currentTime` (ตัวอย่าง `FX.backdrop`, `ghostAxis()`)
- **Lite mode:** `FX.lite` + `html.lite` เปิดเองเมื่อ `deviceMemory ≤ 4` หรือ `hardwareConcurrency ≤ 4` หรือ `FX.probe()` (0.8 วิหลังโหลด นับเฟรม 2 วิ) < 45 fps · ลดแค่ละอองไฟพื้นหลัง + อนุภาค Ascended 3 จาก 5 · ไม่มีปุ่ม
- **Blur:** `backdrop-filter` เฉพาะ `.topbar.glass` กับ `.nav.glass` · `.glass` อื่น = `background-color: var(--glass-under)` + `background-image: linear-gradient(var(--glass), var(--glass))` · เปลี่ยนพื้นให้ตั้ง `background-image` (ไม่ใช่ `background:` ทั้งก้อน)
- **รูปการ์ด:** `C.artImg(src, small)` + `C.bindArt(root, item)` · การ์ด mini ขอ `images/cards/thumb/<id>.webp` (300×420) → รูปใหญ่ → รูปวาด · `loading="lazy"` `decoding="async"` `width/height` ทุกรูป · support ใช้รูปใหญ่

### 3.4 ข้อมูลในเครื่องผู้ใช้ (localStorage · อ่าน/เขียนใน try/catch เสมอ)
- `cbi:lastPage` · `cbi:rarity` · `cbi:tierKind` · `cbi:tmPrefs` · `cbi:grades` · `cbi:music` · `cbi:musicVol` · `cbi:bsHint` · `cbi:tierlists` · `cbi:decks`
- `cbi:tierlists` = `[{ "id":"tl_x1", "name", "type":"card"|"support", "rarity", "rows":[{ "id":"r1", "label":"SS", "color":"--t-ss", "items":[{ "uid":"i1", "id":"bald-cadet" }] }], "created", "updated" }]` · ใช้ uid เพราะการ์ดใบเดียวกันอยู่ได้หลายช่อง · id ที่ไม่มีในคลัง = ช่องเส้นประ ไม่ลบเอง · จำกัด 20 แถว (เหลือ ≥ 1) · ชื่อแถว 24 · ชื่อ list 40 ตัวอักษร
- `cbi:decks` = `[{ "id":"dk_x1", "name", "mode":"tower", "rarity", "cards":[id|null ×5], "support":[id|null ×5], "created", "updated" }]`
## 4. Motion Guide (อ่านทุกครั้งที่เพิ่มปุ่มหรือการกดแบบใหม่)
หลักการ: มีอนิเมชั่นเพื่อให้รู้สึกเหมือนเกม แต่ต้องลื่นบนมือถือและไม่ทำให้ช้า
- ใช้แค่ `transform` และ `opacity` · ความยาว 150–400ms · easing `cubic-bezier(.2,.8,.2,1)`
  - **ข้อยกเว้น (เจ้าของอนุมัติ 2026-10-24, HISTORY §13.1 ข้อ 4):** การ์ดในหน้ารายละเอียด **แตะ = หมุน 360° 1 รอบ ยาว 900ms** (`--t-spin`) · สะบัด = หมุนหลายรอบแล้วค่อยๆ ช้าลง (ยาวตามแรงสะบัด) · intro ผงรวมเป็นการ์ด ~2.6 วิ (เล่นทุกครั้งที่เปิด · ปัดเปลี่ยนใบ ~2 วิ) · ทั้ง 3 อย่างผู้ใช้กดอย่างอื่นต่อได้ระหว่างเล่น
  - **ข้อยกเว้นเรื่องความเร็ว (เจ้าของอนุมัติ 2026-10-24, HISTORY §13.1 ข้อ 1–2 · หน้ารายละเอียดทั้งหน้า §14.5 = ยอมรับความเร็วตามที่วัด):** ตอนหมุน/สะบัดการ์ดและตอน intro ยอมให้ fps ต่ำกว่า 55 ได้ **ห้ามลดเอฟเฟกต์เหล่านี้** (แสงวิ่งบนเส้นพลังไม่หยุด, ผงใน intro เต็มจำนวน) · กรณีอื่นถ้าไม่ถึงเกณฑ์ต้องถามเจ้าของก่อนลดเอฟเฟกต์
- รองรับ `prefers-reduced-motion` (ถ้าผู้ใช้ปิดอนิเมชั่นไว้ ให้เหลือแค่ fade)
- อนิเมชั่นต้องไม่บังการกด ผู้ใช้กดต่อได้ทันที · เอฟเฟกต์หนักมีได้ไม่เกิน 1 อย่างต่อจอ
- ทำเป็นคลาสหรือฟังก์ชันกลางใน `css/fx.css` / `js/fx.js` ปุ่มใหม่ให้เรียกใช้ของเดิม ไม่เขียนใหม่

**การกระทำ → อนิเมชั่น** (ตารางเดิมแบบแถวละ 1 อย่าง: HISTORY §0.4 · การกดแบบใหม่ที่ไม่มีในนี้ ให้เพิ่มลงกลุ่มที่ตรง)
- **ทั่วไป:** กดปุ่ม → ย่อเหลือ 0.96 + วงแสงทองสั้นๆ · เปลี่ยนเมนู → แผ่นทองของเมนูเลื่อนไปปุ่มใหม่ (มือถือ = แนวนอน, คอม = แนวตั้ง) + หน้าใหม่ fade/slide เข้า + เส้นทองกวาดผ่านชื่อหน้า 1 ครั้ง · สลับสวิตช์ (Global ⇄ My Lists, Cards ⇄ Support) → `.seg__ind` เลื่อนไปปุ่มใหม่ (transform) + เนื้อหาใหม่ `fx-page-in` หรือแถวไล่เข้า (stagger) · ใช้ `.seg` + `--i` ได้เลย · สวิตช์เปิด/ปิด (Compare with Global) → จุดในสวิตช์เลื่อน + ป้าย ↑/↓/= fade เข้า · กล่องถาม `.tm-dlg` → scrim fade + กล่องเลื่อนขึ้นเล็กน้อยและ fade เข้า (ปิด = ย้อนทาง) · toast `FX.toast` → เลื่อนขึ้นจากด้านล่าง + fade หายเองใน ~3 วิ · กำลังโหลด → การ์ดเปล่าสลับไปมา (skeleton) · หน้าโหลด → ตรา + นาฬิกาพกเข็มหมุน → fade ออกเมื่อข้อมูลมา · พื้นหลัง → หมอกเลื่อนช้า + ละอองไฟลอยขึ้น (CSS ล้วน) · เงาเมือง parallax ตาม scroll (paused Web Animation) · วาดครั้งเดียว ห้ามวาด canvas ทุกเฟรม · ปุ่มเพลง ♪ → กด = ย่อ 0.96 + วงแสง · เปิด = ค่อยๆ ดังขึ้น 0.6 วิ + แท่งคลื่นเสียง 3 แท่งขยับ (transform เฉพาะตอนเล่น) · ปิด = ค่อยๆ เบาลง
- **การ์ด / รายการ:** แตะ/ชี้การ์ด → ยกขึ้น + เอียง 3D ตามนิ้ว + แสง holo วิ่งผ่าน · กรอง/เรียง → เรียงใหม่แล้วไล่เข้าทีละใบ (เฉพาะ 16 ใบแรก) · เปลี่ยนระดับการ์ด → สี aura ค่อยๆ ไล่ + ตัวเลขนับไปค่าใหม่ (เฉพาะการ์ดบนจอ ใบอื่นเปลี่ยนเงียบๆ) · โหลดหน้า Tier List → แถวไล่เข้าทีละแถว (stagger) · แตะไทล์ support บน Tier List → รูปบินไปเป็นรูปใหญ่ในหน้ารายละเอียด Support (shared element) · กลับมาตำแหน่งเลื่อนเดิม
- **หน้ารายละเอียดการ์ด (Black Sun):** เปิด → ฉาก fade เข้า 300ms + ผงรวมเป็นการ์ด ~2.6 วิ → วง Overall นับขึ้น + เส้นชี้ 4 ป้ายวิ่งออกทีละเส้น (จุด → เส้น scaleX → ป้าย fade) · **ทุกครั้ง** = intro ผงรวมเป็นการ์ด (ไม่บินจากช่องแล้ว · 2026-10-25) · ปิด → ฉาก fade ออก 250ms + การ์ดบินกลับช่องของใบที่ดูอยู่ · ช่องอยู่นอกจอ = การ์ดจางหาย **ไม่เลื่อนหน้า** · แตะ / ลาก / สะบัด / แตะ 2 ครั้ง การ์ด → หมุน 360° 900ms · หมุนตามนิ้ว (จำกัดมุม ไม่ตะแคงเป็นเส้น) แล้วสปริงกลับ · หมุนหลายรอบแล้วช้าลงจบด้านหน้า · ซูม (380ms) · ความหนา 3D ตอนขยับ/เอียง ตอนตรงเป็น 2D · แสง holo **แสดงตลอด** (นิ่ง = ค้างตามมุมล่าสุด) · **ขยับเมาส์ (คอม) → การ์ดหันตาม (ease ~120ms)** · เอียงมือถือ = ไม่ขยับอะไร · ป้าย 4 ป้ายไม่จาง จุดปลายเส้นบนการ์ดเคลื่อนตามการ์ด · ละอองรอบการ์ดหมุนวนตอนการ์ดหมุน · สั่นเบาๆ ตอนเด้งเข้าที่ · reduced = แฟลชแทนการหมุน · ปัดซ้าย/ขวานอกการ์ด, ‹ ›, ลูกศรคีย์บอร์ด → การ์ดเลื่อนออก 170ms (ย่อ .94 + จาง) → intro ผงของใบถัดไป (เร็วขึ้น ×0.75 ~2 วิ) · ป้ายวิ่งออกใหม่ · Overall นับไปค่าใหม่ · reduced = fade · จุดระดับ 7 จุด → วงทองเลื่อนไปจุดใหม่ + ชื่อระดับ fade ขึ้น · กรอบ/aura แฟลช + ตัวเลขนับ · วงแสงดวงอาทิตย์สลับ fade 500ms · ละออง/เส้นชี้เปลี่ยนสี · แตะป้าย (มือถือ) → กล่องคำอธิบายเต็ม fade + เลื่อน 6px (200ms) · แตะที่อื่น = ปิด · ≥ 768px แสดงเต็มในป้ายเลย · ปุ่ม Details → แผ่นเลื่อนขึ้นจากล่าง 320ms + scrim fade · ตัวเลขนับ + แถบคะแนนยืด + กล่องไล่ขึ้นทีละกล่อง · ปัดหัวแผ่นลง = แผ่นตามนิ้ว (paused animation) ปล่อยแล้วปิด/เด้งกลับ · ลากนิ้วบนพื้นหลัง / ขยับเมาส์ → ฉาก 4 ชั้นขยับคนละระยะ (parallax, paused Web Animation, rAF หยุดเองเมื่อนิ่ง)
- **Tier Maker:** กดค้างการ์ด (นิ้ว) → ย่อ 0.95 ระหว่างรอ 0.26 วิ → ยกขึ้น + สั่นสั้นๆ (ถ้ามือถือรองรับ) · หยิบการ์ด (ลาก) → ลอยขึ้น ขยาย 1.06 + เงาเข้ม · ช่องที่วางได้เรืองขอบ · วางการ์ด → ลงช่องแล้วเด้งเบาๆ (≤ 250ms) · การ์ดข้างๆ เลื่อนหลบแบบนุ่ม (FLIP) · เลือกการ์ด (แตะ) → ขอบเรือง `--rift` + แถบคำสั่งเลื่อนขึ้นจากด้านล่าง · ลากการ์ดในแถวลง pool → pool เป็นกรอบแดงเส้นประ "Drop here to remove" · ปล่อย = การ์ดย่อจางหาย + toast Undo · ปล่อยนอกแถว → บินกลับที่เดิม · เพิ่ม/ลบแถว, เพิ่ม/ลบการ์ด → เพิ่ม = กางออก/เด้งเข้า · ลบ = ย่อและจางหาย แถวอื่นเลื่อนตามแบบนุ่ม · Undo / Redo → การ์ดที่เปลี่ยนเลื่อนกลับแบบ FLIP (ไม่กระโดด)
- **Deck + คะแนนทีม:** ใส่การ์ดลงช่อง → บินเข้าช่อง (`FX.flip`) · คะแนนนับไปค่าใหม่ วงเปลี่ยนสีแบบไล่ · ใส่จากตัวเลือก → เด้งเข้าช่อง (scale .6 → 1.05 → 1 ≤ 260ms · reduced = fade) · ย้าย/สลับ (แตะหรือลาก) → FLIP · ลาก = ปล่อยแล้วบินจากนิ้วเข้าช่องและเด้งเบาๆ · ช่องปลายทางเรืองขอบ `--rift` · กด × → สำเนาการ์ดย่อจางหาย 220ms + toast Undo · วงคะแนน → ตัวเลขนับ (`FX.countTo`) · เส้นวงสลับ fade ไปความยาว/สีใหม่ (opacity, 320ms) · เปลี่ยนช่วงสี = วงเด้ง 1.08 ครั้งเดียว · ไม่มีการ์ด = "—" · คะแนน 100 → วงรุ้งหมุน (CSS, `.is-live`) + ประกาย 10 จุด 1 ครั้ง (ลบตัวเองเมื่อจบ) · reduced = วงรุ้งนิ่ง ไม่มีประกาย · แถบคะแนนแต่ละส่วน → `scaleX` (400ms · reduced = ทันที) · ข้อดี/ข้อเสีย/Fits modes เปลี่ยน → เฉพาะกล่องที่เปลี่ยน จาง .25 → 1 (220ms) · แตะการ์ดใน Fill the gaps → ย่อ .96 + เด้งเข้าช่อง (popIn) + toast Undo · tile ใหม่ scale .9 → 1 · แตะโหมดใน Fits modes → ตัวชี้ `.seg` เลื่อน + คะแนนนับไปค่าใหม่ · แตะชิปการ์ดใน Strong/Weak vs → การ์ดขยายจากชิป (`FX.flip`) ปิดแล้วบินกลับ · Compare / เปลี่ยน deck ในกล่อง → กล่องถามแบบเดิม · คอลัมน์ `fx-page-in` + ตัวเลขนับ · Copy to My Decks / Save a copy → แสงแฟลชบนกรอบ + toast ปุ่ม Open · ทำสำเนา/ลบ deck ในหน้ารวม → แถวอื่นเลื่อนเติมแบบ FLIP · แถวใหม่เด้งเข้า · แถวที่ลบย่อหาย
- **แชร์ / รูป / สำรอง:** บันทึกรูป / คัดลอกลิงก์ → `FX.flash` บนกรอบที่ถูกบันทึก + toast ยืนยัน · กำลังสร้างรูป → `.fx-loader` หมุน → พรีวิว fade เข้า (reduced = fade) · เปิดลิงก์แชร์ (`#tier/s/…`) → skeleton → แถวไล่เข้าทีละแถว (stagger) · Save a copy / Restore backup → `fx-press` + toast พร้อม Undo

### 4.1 Definition of Done (ทุกขั้นต้องผ่านทุกข้อก่อนบอกว่าเสร็จ)
- [ ] ทุกปุ่มและทุกการกดใหม่มีอนิเมชั่นตาม §4 ใช้ของกลางใน `fx.js` / `fx.css` · การกดแบบใหม่ที่ไม่มีในตาราง ให้เพิ่มแถวลงตาราง §4 ด้วย
- [ ] รองรับ `prefers-reduced-motion`
- [ ] mobile-first: ทดสอบที่จอกว้าง 390px และ 1280px · ปุ่ม ≥ 40px · ไม่มี scroll แนวนอนของทั้งหน้า
- [ ] ใช้สี/ระยะ/ฟอนต์จาก `tokens.css` เท่านั้น · หน้าตาเข้าธีม Gilded Nocturne (ของกลางใน §3.3)
- [ ] แก้ CSS/JS แล้ว**เปลี่ยนเลข `?v=` ใน index.html ทุกบรรทัด**เป็นเลขขั้นนั้น (§2)
- [ ] มีสถานะว่าง (empty state) และสถานะโหลด
- [ ] กดการ์ดที่ไหนก็เปิดรายละเอียดการ์ดได้ และกด Back แล้ว**กลับมาที่เดิม สภาพเดิม** (ไม่รีเฟรช ไม่เสียสิ่งที่จัดไว้ ตำแหน่งเลื่อนเดิม)
- [ ] ระดับการ์ด (Normal…Ascended) แสดง aura ถูกต้อง
- [ ] ข้อความจากข้อมูลผ่าน `CBI.esc()` ทุกครั้ง · ข้อความบนหน้าเว็บเป็นภาษาอังกฤษ
- [ ] ข้อมูลในเครื่องอ่าน/เขียนผ่าน try/catch (โหมดไม่ระบุตัวตนต้องไม่พัง)
- [ ] ทดสอบใน Chromium แล้วไม่มี error ใน console · อัปเดต §3.3 ถ้ามีของกลางใหม่
- [ ] **ความเร็ว (หลังขั้น 9.5):** วัดแบบ §11.3 ที่ CPU ช้าลง 6 เท่า ต้องได้ ≥ 55 fps ตอนว่างและตอนมีการ์ดทดสอบ 60 ใบระดับ Normal · ระดับ Ascended ต้องไม่ต่ำกว่าตาราง HISTORY §11.4 (ผลล่าสุดทั้งเว็บ = HISTORY §12.7 · หน้ารายละเอียดการ์ด = ไม่ช้ากว่า HISTORY §14.3 เมื่อวัดคู่ mockup บนเครื่องเดียวกัน) · ห้ามมี `requestAnimationFrame` วนตลอดเวลา · aura เล่นเฉพาะการ์ดบนจอ (`.is-live`) · สร้างการ์ดใน `C.lazy()` เท่านั้น · ห้ามเพิ่ม `backdrop-filter` นอกจากหัวเว็บกับเมนูล่าง · การ์ดตอนอยู่เฉยๆ ใช้ transform 2D (ยกเว้นการ์ดในหน้ารายละเอียดตอนเมาส์ค้างนอกกลางการ์ด: 3D นิ่ง ไม่มี rAF) · ห้ามเขียน `style.transform` ทุกเฟรมตอน scroll/ลาก (ใช้ paused animation) · ห้ามเพิ่มชั้นเต็มจอที่ขยับตลอด (แต่ละชั้นกินแรงวาดเท่า 1 จอต่อเฟรม)

## 5. ข้อมูลการ์ด

### 5.1 ระดับการ์ด (จากไฟล์ rarity-multipliers ของเจ้าของ อ้างอิงการ์ด Bald Cadet)
การ์ด 1 ใบมี 7 ระดับ · **เก็บแค่ค่าระดับ Normal** ส่วนระดับอื่นให้คำนวณเอา · ความสามารถเท่าเดิมทุกระดับ
```js
const RARITY_MULTIPLIERS = {
  Normal:   { stat: 1,    odds: 1 },
  Shiny:    { stat: 3.5,  odds: 20 },
  Rainbow:  { stat: 7,    odds: 100 },
  Secret:   { stat: 13.5, odds: 500 },
  Divine:   { stat: 26.5, odds: 2500 },
  Cosmic:   { stat: 47,   odds: 10000 },
  Ascended: { stat: 93,   odds: 50000 },
};
// Stat ระดับ X = Stat Normal × stat · โอกาสระดับ X = โอกาส Normal × odds
```
- เกมปัดเศษ ทำให้บางค่าคลาดเคลื่อน 1–2 หน่วย ถ้ามีค่าจริงจากรูป ให้ใส่ใน `exact` แล้วเว็บจะใช้ค่านั้นแทนค่าที่คำนวณ
- แสดงโอกาสแบบย่อ เช่น `1 in 59`, `1 in 29.5K`, `1 in 2.95M`
- ทุกการ์ดใช้ตัวคูณเดียวกัน อันดับ ATK/HP จึงเหมือนกันทุกระดับ เวลาจัดอันดับให้เทียบที่ระดับเดียวกันเสมอ

### 5.2 โครงไฟล์ข้อมูล
- `data/meta.json`: `{ updated, rarities, tiers }`
- `data/cards.json`: รายการการ์ด
- `data/support.json`: รายการการ์ด support
- `data/teams.json`: ทีมแนะนำ (Meta Decks) — ดู schema ด้านล่าง
- รูป: `images/cards/<id>.webp`, `images/support/<id>.webp` (ขนาด 600×840, อัตราส่วน 5:7)
- `id` ใช้ตัวพิมพ์เล็ก ขีดกลาง ไม่ซ้ำกัน (เช่น `bald-cadet`) เพราะใช้ในลิงก์ `#card/<id>` และใน `beats` / `losesTo` / `bestWith` · id ที่หาไม่เจอในรายการจะถูกข้ามเงียบๆ
- `data/support.json` สร้างแล้ว (ตอนนี้ `[]`) เว็บโหลดไฟล์นี้แบบไม่พังถ้าไม่มี · `team.bestSupport` แสดงชื่อจากไฟล์นี้ ถ้าไม่เจอจะแสดง id แปลงเป็นชื่อ
- `team.position` แสดงเป็น `Slot 2` (ตัวเลขเดียว) หรือ `Slots 1–2` (เช่น `"1-2"`) · ช่องที่ว่าง/ไม่มีข้อมูลหน้าเว็บจะขึ้นว่า "Not analyzed yet"

```jsonc
// team (ไฟล์ teams.json = array ของ team) · ตำแหน่งในทีมนับจากลำดับใน slots (ใบแรก = Slot 1 … สูงสุด 5 ใบ)
{
  "id": "frontline-rush", "name": "Frontline Rush",
  "mock": true,                                   // ข้อมูลตัวอย่าง: เว็บแสดงป้าย Sample (เอาออกเมื่อเป็นทีมจริง)
  "slots": [ { "card": "<card id>" }, { "card": "<card id>", "support": "<support id>" } ],   // support รายใบ (ไม่ใส่ก็ได้)
  "support": ["<support id>"],                    // support แนะนำของทั้งทีม (string เดียวก็ได้)
  "notes": "", "updated": "2026-10-23"
}
// card
{
  "id": "bald-cadet", "name": "Bald Cadet", "series": "Attack on Titan",
  "image": "images/cards/bald-cadet.webp",
  "base": { "atk": 382, "hp": 2546, "def": 0, "status": 0, "odds": 59 },   // ค่าระดับ Normal · def = Defense, status = Status Damage (ใส่เมื่อรู้ค่า ไม่ใส่/0 = หน้า Grade แสดงแค่ % โบนัส)
  "exact": { "Divine": { "atk": 10121 } },                // ค่าจริงจากเกม (ถ้ามี)
  "passive": { "name": "ODM Gear", "desc": "15% dodge" },
  "skill":   { "name": "", "desc": "" },
  "scores":  { "atk": 0, "hp": 0, "passive": 0, "skill": 0, "matchup": 0, "team": 0, "overall": 0 },
  "tier": "A", "tierNote": "Short reason for this tier (1–2 sentences, ~120 chars)",   // ป้าย Tier ในหน้ารายละเอียด
  "role": "DPS | Tank | Support | Hybrid",
  "strengths": [], "weaknesses": [],
  "beats": ["<id>"], "losesTo": ["<id>"],                 // ต้องผ่านกฎ stat check (§5.3)
  "team": { "position": "1-5", "bestWith": ["<id>"], "bestSupport": ["<support-id>"] },
  "notes": "", "updated": "2026-10-23"
}
```

### 5.3 สูตรคะแนน Overall (0–100) และ Tier
| ส่วน | น้ำหนัก | วิธีคิด |
|---|---:|---|
| ATK | 12.5 | percentile เทียบกับการ์ดทั้งหมด |
| HP | 12.5 | percentile เทียบกับการ์ดทั้งหมด |
| Passive | 15 | Claude ให้คะแนนตาม rubric: แรงแค่ไหน, ทำงานบ่อยแค่ไหน, หาการ์ดอื่นมาแทนได้ยากไหม |
| Skill | 15 | rubric เดียวกับ Passive · **หน้าเว็บรวม 2 แถวนี้เป็น "Passive / Skill" 30%** (ค่าเฉลี่ย 2 ค่า · Overall เท่าเดิม) |
| Matchup | 25 | อัตราชนะ 1-1 โดยประมาณ เทียบกับการ์ดทุกใบ |
| Team | 20 | เข้าทีมได้กี่แบบ, ช่วยทีมได้แค่ไหน, ตำแหน่งที่เหมาะ |

- **กฎ stat check (สำคัญ):** การ์ด A จะนับว่า "แก้ทาง" B ได้ ก็ต่อเมื่อ (1) ความสามารถของ A แก้กลไกของ B ได้จริง **และ** (2) ค่าพลังของ A พอจะทำงานได้จริง ใช้ `จำนวนครั้งที่ตีตาย = ceil(HP ศัตรู / ATK ตัวเอง)` เทียบกัน แล้วปรับตาม passive/skill · ถ้า ATK/HP ต่ำเกินไป ถึงสกิลจะแก้ทางได้ก็ไม่นับ
- **การ์ด Meta = Tier GOD + SS** (เจ้าของสั่ง 2026-10-24) · ใช้ในคะแนนทีม (Coverage / Weak vs ใน §10.5)
- การ์ดติด meta = Overall สูง + จุดอ่อนน้อย + ไม่ค่อยแพ้การ์ดที่คนใช้เยอะ ไม่ใช่แค่ stat สูง
- Tier: **GOD** ≥ 95 · **SS** 90–94 · **S** 80–89 · **A** 70–79 · **B** 60–69 · **C** 50–59 · **D** < 50
- ทุกครั้งที่เพิ่มการ์ด ต้องคำนวณ percentile และ matchup ของ**ทุกใบ**ใหม่ (§7 งาน B)

### 5.4 การ์ด Support (ไม่มี stat)
| ส่วน | น้ำหนัก | วิธีคิด |
|---|---:|---|
| Effect power | 40 | เอฟเฟกต์แรงแค่ไหน (heal / buff / revive / ดูดพลัง) |
| Reliability | 20 | ทำงานแน่นอนหรือต้องลุ้น, ใช้ได้บ่อยแค่ไหน |
| Flexibility | 20 | ใส่ได้กับกี่ทีม/กี่การ์ด |
| Peak synergy | 20 | ถ้าคู่กับการ์ดที่เข้ากันที่สุดจะแรงแค่ไหน |

- field: `{ id, name, image, effect, odds, scores{effect, reliability, flexibility, synergy, value}, tier, bestWith[card ids], bestDeck[team ids], avoidWith[card ids], notes, updated }`
  - `effect` เป็นข้อความ หรือ `{ "name": "", "desc": "" }` ก็ได้ · `odds` = ตัวเลข N ของ "1 in N" (ไม่มีระดับ Normal–Ascended) · `image` ว่างได้ (เว็บวาดรูปแทน) · `mock: true` = ป้าย Sample
  - `scores.value` = effect×0.4 + reliability×0.2 + flexibility×0.2 + synergy×0.2 (0–100, ทศนิยมได้ เว็บแสดง 1 ตำแหน่ง) · `tier` ตามเกณฑ์เดียวกับการ์ด (§5.3)
  - **Unranked:** `scores.value` เป็น 0 หรือ `tier` ว่าง = ยังไม่ได้ให้คะแนน (งานประจำ C ใส่แบบนี้) → ขึ้นท้ายรายการ ป้าย Unranked ไม่มีอันดับ
  - อันดับ = เรียง `value` มากไปน้อย ค่าเท่ากันได้อันดับเดียวกัน (1, 2, 3, 3, 5)
  - id ใน `bestWith` / `avoidWith` / `bestDeck` ที่หาไม่เจอถูกข้ามเงียบๆ · ช่องใน deck ที่ใส่ `"support": "<id>"` ตรงกับ support นี้ จะมีป้าย "+ This support" ในหน้ารายละเอียด
- หน้า Support จัดอันดับตาม `value` และบอกว่าควรใส่กับการ์ดใบไหนหรือทีมไหนถึงคุ้มที่สุด

## 7. งานประจำ (ทำหลังเว็บเสร็จ แต่ละงานเปิดแชทใหม่)

**A. เพิ่ม/แก้การ์ด** · **Sonnet 5.5 / medium** · ส่งรูปได้ไม่เกิน ~10 ใบต่อแชท
```
ใช้ PROGRESS.md ที่แนบ (ห้ามอ่านจากลิงก์ GitHub: ได้ไฟล์เก่าค้างแคช) แล้วทำ "งานประจำ A" กับรูปที่แนบ
ทำเสร็จให้อัปเดต PROGRESS.md และ HISTORY.md และบอกว่าต้องอัปไฟล์ไหนไปโฟลเดอร์ไหน ทำเป็นไฟล์ zip
```
1. ตัดรูปด้วย Python: หาขอบการ์ด, ตัดพื้นหลังและหน้าจอเกมออก, ปรับให้เป็น 600×840 แล้วบันทึกเป็น `.webp` ชื่อตาม id ใน `images/cards/` · **และทำรูปเล็ก 300×420 `.webp` ชื่อเดียวกันใน `images/cards/thumb/` ทุกครั้ง** (ขั้น 9.5: การ์ดเล็กโหลดรูปนี้ ไม่มี = โหลดรูปใหญ่แทน ช้าและเปลือง RAM) · บอกเจ้าของให้อัปทั้ง 2 โฟลเดอร์
2. อ่านทุกอย่างที่เห็นในรูป: ชื่อ, ATK, HP, Passive, Skill, ระดับ, โอกาส · ถ้ารูปเป็นระดับอื่นที่ไม่ใช่ Normal ให้หารด้วยตัวคูณเพื่อหาค่า Normal แล้วเก็บค่าจริงไว้ใน `exact`
3. อ่านไม่ชัดตรงไหนให้ถาม ห้ามเดา
4. ใส่ข้อมูลลง `cards.json` (ยังไม่ต้องให้คะแนน: ตั้ง `scores.overall` เป็น `0` และ `tier` เป็น `""` เว็บจะแสดงเป็น Unranked ให้เอง) แล้วบอกว่าต้องอัปไฟล์ไหน

**B. วิเคราะห์และจัดอันดับใหม่ทั้งคลัง** · **Opus 5.5 / high** · ทำหลังเพิ่มการ์ดเสร็จแต่ละรอบ ไม่ต้องทำทุกใบ
```
ใช้ PROGRESS.md ที่แนบ (ห้ามอ่านจากลิงก์ GitHub: ได้ไฟล์เก่าค้างแคช) แล้วทำ "งานประจำ B"
ทำเสร็จให้อัปเดต PROGRESS.md และ HISTORY.md และบอกว่าต้องอัปไฟล์ไหนไปโฟลเดอร์ไหน ทำเป็นไฟล์ zip
```
คำนวณ `scores`, `tier`, จุดเด่น, จุดอ่อน, ชนะ/แพ้ใคร ตามกฎใน §5.3 ของ**ทุกใบ** · จัด `teams.json` ใหม่ (ทีม 5 ใบ, ตำแหน่ง, support ที่ดีที่สุด) · ให้คะแนน support ตาม §5.4 · **(ขั้น 11 ทำแล้ว → ต้องใส่ทุกครั้ง)** field สำหรับคะแนนทีม: การ์ด `tags`, `weakTo`, `modes{tower,pvp,story,boss}`, `beats`, `team.bestWith`, `team.bestSupport`, `team.position`, `role` (ค่าเดียว: `DPS` / `Tank` / `Support` / `Hybrid`) · support `bestWith`, `avoidWith`, `modes` (ไม่บังคับ) · ไม่มี field ไหน = ส่วนนั้นขึ้น "Not enough data yet" (ดู §10.5) · tag ใช้คำเดียวกันทั้งคลัง (ตัวพิมพ์เล็ก เช่น `burst`) · **`tierNote` ทุกใบ (ต้องเขียนทุกครั้ง)** = เหตุผลสั้นๆ ภาษาอังกฤษว่าทำไมได้ tier นี้ (1–2 ประโยค ~120 ตัวอักษร: จุดที่ดันขึ้น + จุดที่ฉุดไว้ อิงตัวเลขจริง) แสดงเป็นป้าย Tier ในหน้ารายละเอียด

**วิธีที่ใช้ในงาน B (รอบ 2026-10-24) — รอบต่อไปใช้แบบเดียวกัน คะแนนจะเทียบกันได้:**
1. **ATK / HP percentile** = จำนวนการ์ดที่ค่า ≤ ใบนี้ ÷ การ์ดทั้งหมด × 100 (ใบสูงสุด = 100 · ใบต่ำสุด = 100/N) · เทียบที่ระดับ Normal
2. **Matchup** = จำลอง 1-1 ด้วย Python (ทำ 2 แบบ: ใบนี้ตีก่อน / อีกใบตีก่อน แล้วเฉลี่ย · สุ่ม 4,000 รอบ เพราะมี dodge) · คิดแต่ละคู่: ผู้ชนะได้ 50 + ครึ่งของ % HP ที่เหลือ ผู้แพ้ได้ 50 − ค่าเดียวกัน · Matchup = ค่าเฉลี่ยทุกคู่ · `beats` / `losesTo` = ผลชนะ/แพ้ของการจำลองนี้ (ผ่านกฎ stat check เพราะใช้ ATK/HP จริง)
   - สมมติฐานการต่อสู้ (§8 ยังไม่ได้ตอบ): ตีสลับกันทีละตา · การ์ดในทีมสู้ทีละใบ ใบอื่นอยู่ "bench" (ดูจากคำว่า bench ในความสามารถ) → ช่อง 1 ลงก่อน · ดีบัฟลดดาเมจ "ทั้ง deck" คูณซ้อนกัน · ลดดาเมจ % ใช้ก่อน execute · execute = นับเป็นการโจมตีที่ฆ่า (Kaido รอดได้ 1 ครั้ง) · "ignore every defense" = ข้ามการลดดาเมจและการบล็อก · Limbo clones "hit 2x" = ตี 2 ครั้งต่อตา · burn ไม่รู้ค่า → ทดสอบทั้ง 0% และ 10% ATK/ตา ผลไม่เปลี่ยน
3. **Passive / Skill:** การ์ดในเกมมีความสามารถ**ช่องเดียว** ทำงานเองตลอด (เจ้าของยืนยัน 2026-10-24) → ใส่ใน `passive` เว้น `skill` ว่าง แล้วให้คะแนนความสามารถนั้นตาม rubric และ**ใส่ค่าเดียวกันทั้ง `scores.passive` และ `scores.skill`** (ช่องเดียวนับทั้ง 30%)
4. **Team** = rubric (ช่วยทั้งทีมได้แค่ไหน: ดีบัฟทั้ง deck / ตีทั้ง bench / ไม่มีผลกับทีม) · **modes** = คะแนน 0–100 ต่อโหมด ประเมินจากความสามารถ (Tower = อึด/รอดยาว · PvP = แก้ทาง tank · Story = ตีหมู่ · Boss = ตีเดี่ยว ไม่มี execute) ใส่ boss ไว้ด้วยแม้ยังปิด
5. **tag ที่ใช้แล้ว (ใช้คำเดิม):** `aoe` `debuff` `burn` `execute` `damage-reduction` `multi-hit` `block` `revive` `burst` `ignore-defense` `dodge` `shadow-garden` `undying` `cc-immune` `scaling` · `weakTo` ใช้คำจากรายการเดียวกัน
6. ข้อความ `strengths` / `weaknesses` / `notes` / ทีม เป็นภาษาอังกฤษ (หน้าเว็บอังกฤษ)

**C. เพิ่ม support** · **Sonnet 5.5 / medium** · ทำแบบงาน A แต่ลง `support.json` + รูป `images/support/` (คะแนนให้ทำในงาน B)
```
ใช้ PROGRESS.md ที่แนบ (ห้ามอ่านจากลิงก์ GitHub: ได้ไฟล์เก่าค้างแคช) แล้วทำ "งานประจำ C" กับรูปที่แนบ
ทำเสร็จให้อัปเดต PROGRESS.md และ HISTORY.md และบอกว่าต้องอัปไฟล์ไหนไปโฟลเดอร์ไหน ทำเป็นไฟล์ zip
```

**D. แก้เล็กน้อย** (พิมพ์ผิด, เปลี่ยนสี, ข้อความ) · **Haiku 5.5 / low** · ถ้าแก้เกิน 1–2 ไฟล์ให้ใช้ Sonnet 5.5 / low

> ถ้าเพิ่มการ์ดแค่ 1–3 ใบ จะรวม A + B ในแชทเดียวก็ได้ ใช้ **Opus 5.5 / medium**

## 8. คำถามที่เจ้าของต้องตอบก่อนเริ่มงาน B (ใส่คำตอบไว้ที่นี่)
- [ ] ระบบต่อสู้เป็นแบบไหน: ใครตีก่อน, ใช้ Skill ตอนไหน (ต้องใช้พลัง/คูลดาวน์?), ตำแหน่ง 1–5 ใน deck มีผลอะไร
- [ ] deck ใส่การ์ด support ได้กี่ใบ, support มีระดับ (Normal–Ascended) ด้วยไหม
- [ ] (ค้างจากขั้น 10) deck เดียวกันใส่ **support ใบเดียวกันซ้ำ** ได้ไหม · ตอนนี้ **อนุญาตให้ซ้ำได้** (สเปกห้ามซ้ำเฉพาะ "การ์ด") ถ้าเกมห้ามซ้ำ ให้แก้ `slotsOf(arr, unique)` ใน deck.js เรียก `slotsOf(d.support, true)` ทุกที่ + ทำ support ใน picker ให้ขึ้นป้ายเหมือนการ์ด
- [ ] การ์ดแต่ละใบมีโอกาสออกระดับ Normal ไม่เท่ากันใช่ไหม (เช่น Bald Cadet = 1 in 59)
- [x] ชื่อ tier: **GOD / SS / S / A / B / C / D** (เจ้าของสั่ง 2026-10-24 · GOD + SS = Meta)
- [x] การ์ดมีความสามารถกี่อัน: **ช่องเดียว** ทำงานเองตลอด (2026-10-24)
- [ ] (สำหรับขั้น 11 · **ยังไม่ได้ตอบ → ตอนนี้ทุกโหมดใช้น้ำหนักเท่ากัน รอปรับ** ดู §10.5) แต่ละโหมดต่างกันอย่างไร: **Ascended Tower** (สู้ต่อเนื่องหลายชั้นไหม HP ฟื้นไหม) · **PvP** (สู้กับทีมผู้เล่น) · **Story** · **Boss** (ยังไม่เปิด แต่ทำระบบรอไว้) · ทีม 5 ใบ + support 5 ใบใช้ได้ทุกโหมดไหม
- [x] intro ผง: **เล่นทุกครั้งที่เปิดการ์ด** · ปัดเปลี่ยนใบก็เล่นแต่เร็วขึ้นเล็กน้อย (เจ้าของตอบ 2026-10-25 · ทำแล้ว) · ข้ออื่นใน HISTORY §14.4 ใช้ตามเดิม: ปิดแล้วช่องนอกจอ = จาง ไม่เลื่อนหน้า · ปัดวนใบสุดท้าย→แรก · มือถือป้าย 2 บรรทัดแตะดูเต็ม · ปุ่ม Card details ในหน้า Grade
- [ ] ข้อสังเกตที่ยังไม่แก้ (ถามก่อนแก้): (1) วงแสงตอนกดขึ้นแม้นิ้วแค่เริ่มเลื่อนหน้าบนปุ่ม → แก้ `FX.press` ให้รอจนรู้ว่าเป็นการกด (2) `.dk-pick-sheet { max-width: 560px }` โดน `max-width: 420px` ของ `.tm-dlg__sheet` ทับ (บนคอมกล่องเลือกการ์ดแคบกว่าที่ตั้งใจ) → แก้ด้วย `.tm-dlg__sheet.dk-pick-sheet` (3) เสียงเอฟเฟกต์ตอนกดปุ่ม ยังไม่ทำ (4) ถ้าเพลงต้องให้เครดิต ยังไม่มีที่ใส่

## 10.5 สูตรคะแนนทีม (ใช้อยู่ · `js/teamscore.js` · ผลทดสอบ/ผลวัด: HISTORY §10.5)
- **โค้ด:** สูตรอยู่ใน `js/teamscore.js` (ไม่มี DOM, ค่าปรับอยู่ใน `K` ต้นไฟล์) · หน้าตาอยู่ใน `js/deck.js` + `css/deck.css` · น้ำหนัก/บทบาทของแต่ละโหมดอยู่ใน `data/meta.json → modes` (**แก้ที่ไฟล์นี้ได้เลย ไม่ต้องแก้โค้ด**)
- **คะแนน 1–100 + สี** (token `--score-*`): 1–49 แดง "Needs work" · 50–79 เหลือง "Decent" · 80–99 เขียว "Strong" · **100 รุ้ง "Perfect"** = ได้เต็มทุกส่วนจริงเท่านั้น · นอกนั้น**ปัดลง**และสูงสุด 99 · deck ไม่มีการ์ดเลย = "—"

**สูตรสุดท้าย** (คะแนน = Σ น้ำหนัก × ค่าส่วนนั้น 0–1 · น้ำหนักตั้งต้น 30/25/20/15/10 · ถ้าใน meta.json รวมไม่ถึง 100 จะถูกย่อ/ขยายให้รวมเป็น 100 · ค่าที่ไม่ใช่ตัวเลข/ติดลบ = ใช้ค่าตั้งต้น):

| ส่วน | น้ำหนัก | วิธีคิด (ค่า 0–1) | ไม่มีข้อมูลทั้งคลัง |
|---|---:|---|---|
| Card power | 30 | **0.8 × การ์ด + 0.2 × support** · การ์ด = (ค่าเฉลี่ย 5 ช่อง ช่องว่าง = 0) ÷ (ค่าเฉลี่ยของการ์ด 5 ใบที่ดีที่สุดในคลัง) · ค่าการ์ด = Overall (Unranked = 50) ถ้าการ์ดมี `modes[โหมด]` ใช้ (Overall + modes) ÷ 2 · การ์ดที่จัดอันดับแล้วไม่ถึง 5 ใบ = ช่องที่ขาดคิดเป็น 50 · support = (ค่าเฉลี่ย Value 5 ช่อง) ÷ (Value ของ support ที่ดีที่สุด เพราะ support ใส่ซ้ำได้) · คลังไม่มี support = ใช้การ์ดอย่างเดียว | — (มีเสมอ) |
| Synergy | 25 | **0.6 × คู่การ์ด + 0.4 × support เข้ากัน − 0.2 ต่อคู่ที่ขัดกัน** · คู่การ์ด = จำนวนการ์ดที่มีคู่หูใน deck (อยู่ใน `team.bestWith` ของกันและกัน ทางใดทางหนึ่ง) ÷ 5 · support เข้ากัน = ต่อช่อง: ตรงกับการ์ดที่อยู่เหนือมัน (`bestSupport` ของการ์ด หรือ `bestWith` ของ support) = 1 · ตรงกับการ์ดใบอื่นใน deck = 0.5 · ไม่ตรง/ว่าง = 0 แล้ว ÷ 5 · ขัดกัน = support ที่มีการ์ดใน deck อยู่ใน `avoidWith` | ส่วนย่อยนั้น = 0.5 × (ช่องที่มีของ ÷ 5) |
| Coverage | 20 | **ทีมชนะการ์ด Meta (GOD/SS) ได้กี่ % − 0.25 ต่อ tag ที่แพ้ทางซ้ำ** · ชนะ = การ์ด Meta ที่อยู่ใน `beats` ของการ์ดใบใดใบหนึ่งในทีม ÷ จำนวนการ์ด Meta ทั้งคลัง (เดิม SS/S · เปลี่ยน 2026-10-24) · ยังไม่มีการ์ด Meta ในคลัง = ได้ครึ่ง + ป้าย Not enough data · แพ้ทางซ้ำ = tag ใน `weakTo` ที่การ์ด ≥ 3 ใบมีเหมือนกัน | 0.5 × (การ์ด ÷ 5) |
| Roles | 15 | **0.8 × บทบาทครบตามโหมด + 0.2 × (การ์ดที่มี role ÷ 5)** · ความต้องการตั้งต้นทุกโหมด: **Tank ≥ 1, DPS ≥ 2** (`modes[].roles`) · `Hybrid` เติมบทบาทที่ขาดได้ 1 อย่างต่อใบ · role ที่เป็นข้อความตัวอย่าง `"DPS \| Tank \| …"` = ไม่มี role | 0.5 × (การ์ด ÷ 5) |
| Position | 10 | ต่อช่อง: การ์ดอยู่ในช่องตาม `team.position` = 1 · ห่าง 1 ช่อง = 0.5 · ห่างกว่า = 0 · การ์ดที่ไม่มี position = 0.5 · แล้ว ÷ 5 | 0.5 × (การ์ด ÷ 5) |

  - ช่องว่าง = ได้ 0 ในส่วนนั้น · การ์ด/support Unranked คิดเป็น 50 และขึ้นคำเตือน · การ์ดที่ไม่มีในคลัง (id หาไม่เจอ) ไม่ถูกนับ และขึ้นคำเตือน
  - ส่วนที่ "ไม่มีข้อมูลทั้งคลัง" ขึ้นป้าย **Not enough data yet** (มีข้อมูลบางส่วนย่อย = "Partly estimated") และได้แค่ครึ่ง → ไม่มีทางได้ 100 จนกว่างานประจำ B จะใส่ข้อมูลครบ
  - **ความหายากของการ์ด (Normal…Ascended) ไม่มีผลกับคะแนน** (stat คูณเท่ากันทุกใบ อันดับไม่เปลี่ยน) · เกรดก็ไม่มีผล
  - **โหมด:** `data/meta.json → modes: [{ id, name, enabled, weights{power,synergy,coverage,roles,position}, roles{Tank:1,DPS:2} }]` · §8 ยังไม่ได้ตอบ จึง**ทุกโหมดใช้น้ำหนักและบทบาทเท่ากัน (รอปรับ)** · ที่คะแนนต่างกันระหว่างโหมดได้ตอนนี้มาจาก `modes` ของการ์ด/support เท่านั้น · Boss `enabled: false`
  - **สิ่งที่ Claude ปรับจากสูตรตั้งต้น (เจ้าของค้านได้ แก้แค่ค่าใน `K`):** (1) Card power เทียบกับ "ทีมที่แข็งที่สุดในคลัง" แทน Overall ÷ 100 ตรงๆ เพราะไม่มีการ์ดใบไหน Overall 100 ทั้ง 5 ใบ ถ้าเทียบกับ 100 จะไม่มีทางได้ Perfect (2) **ใส่ Value ของ support 20% ใน Card power** เพราะสูตรเดิมไม่สนเลยว่า support เก่งไหม (3) ใช้ `modes` ของการ์ดใน Card power เพื่อให้ "Fits modes" มีความหมายตั้งแต่ตอนนี้
- **ข้อดี/ข้อเสีย** (สร้างจากข้อมูล): **Strong vs** = tag ที่การ์ดในทีม ≥ 2 ใบชนะการ์ดที่มี tag นั้น (×จำนวนใบ) + การ์ดที่ ≥ 2 ใบชนะ (แตะเปิดรายละเอียด) + Meta Deck ที่ทีมชนะการ์ดในนั้น ≥ 2 ใบ · **Weak vs** = tag ที่ ≥ 3 ใบแพ้ทาง + การ์ด Meta (GOD/SS) ที่ไม่มีใครในทีมชนะ (แสดง 4 ใบ + "+N more") · **Fits modes** = คะแนนของ deck นี้ในทุกโหมดที่เปิด เรียงมากไปน้อย แตะ = เปลี่ยนโหมด
- **Fill the gaps:** ลองการ์ดทุกใบที่ยังไม่อยู่ใน deck ในทุกช่องว่าง (เลือกช่องที่ได้คะแนนสูงสุด) แสดง 3 ใบที่เพิ่มคะแนนมากที่สุด + "+N" (เพิ่มไม่ถึง 1 = "+<1") · support ก็ทำแบบเดียวกัน (ใส่ซ้ำได้) · แตะ = ใส่ช่องนั้น + toast Undo · ไม่มีใบไหนเพิ่มคะแนน = บอกตรงๆ
- **เทียบ 2 ทีม:** ปุ่ม Compare (หน้ารวม, ใต้ analysis, เมนู ⋯) → กล่องเลือก Deck A / Deck B → คะแนน + 5 ส่วน (▲ ▼ ส่วนที่นำ/ตาม) + Strong/Weak vs + Fits modes · มือถือเรียงบนล่าง · จอ ≥ 720px ซ้ายขวา · มีข้อความสรุปว่าใครนำกี่คะแนน

## 11.3 วิธีวัดความเร็ว (ใช้ใน §4.1 · ผลวัดทุกรอบ: HISTORY §11 §12.7 §14.3)
- Playwright + Chromium: viewport 390×844, `device_scale_factor` 2.75, `is_mobile`, CDP `Emulation.setCPUThrottlingRate` = 6
- วัด 3 วินาที ระหว่างเลื่อนหน้าจอ: นับเฟรมด้วย rAF (fps + เฟรมที่ช้าที่สุด) และดู `TaskDuration` จาก `Performance.getMetrics`
- กรณีทดสอบ: `#tier`, `#tier/my` (มี list), `#cards`, `#support`, `#grade`, หน้ารายละเอียดการ์ด · ข้อมูลว่าง และการ์ดทดสอบ 60 ใบ (ดักโหลด `data/cards.json`) ที่ระดับ Normal และ Ascended
- **เกณฑ์ผ่าน:** ≥ 55 fps ทุกกรณี และเฟรมช้าสุด ≤ 50ms · แคปหน้าจอก่อน/หลังเทียบทุกหน้า หน้าตาต้องเหมือนเดิม · เขียนตารางผลลง HISTORY §9 (ไม่ใช่ที่นี่)
- **วิธีวัดที่ใช้จริงในขั้น 9.5 (ใช้แบบนี้ต่อไป ตัวเลขจะเทียบกันได้):** เลื่อนหน้าด้วยนิ้วจำลอง CDP `Input.synthesizeScrollGesture` (`gestureSourceType: "touch"`, `yDistance` ±700, `speed` 900) วนลง-ขึ้นตลอด 3 วิ (เหมือนนิ้วจริง: compositor เลื่อน ไม่ใช่ `scrollTo` ทุกเฟรม) · โหลดหน้า รอ 3.6 วิ แล้วค่อยตั้ง CPU ×6 อีก 2.5 วิก่อนวัด · โหมดปกติ: บังคับ `navigator.hardwareConcurrency = 8`, `deviceMemory = 8` และปิด `FX.probe` (เครื่องทดสอบมี 2 core) · โหมด lite: `deviceMemory = 4` · วัด 3 รอบ ใช้ค่ามัธยฐาน (เครื่องทดสอบแกว่ง ±5 fps) · list ทดสอบใน `cbi:tierlists` มี 6 แถว 30 ใบ · เครื่องทดสอบ (คลาวด์) **ไม่มี GPU**: งานวาดภาพทั้งหมดของ compositor ไปตกที่ CPU ตัวเลขจึงโหดกว่ามือถือจริง
- **วิธีวัดเพิ่ม (ใช้ต่อไป):** ซ่อน `.fx-ring` ระหว่างวัด เพราะนิ้วจำลองเริ่มที่จุดเดิมกลางจอ ถ้าจุดนั้นตกบนปุ่ม (เช่นแถวชิป) วงแสงตอนกดจะทำให้ Chrome วาดใหม่ทุกเฟรมและตัวเลขต่ำผิดจริง (หน้าใหม่หัวข้อสูงขึ้น จุดนั้นเลยตกบนชิป) · วัดก่อน/หลังด้วยวิธีเดียวกันแล้ว

