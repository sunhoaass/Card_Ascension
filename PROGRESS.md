# Card Battle Infinity — PROGRESS

> **สำหรับ Claude:** อ่านไฟล์นี้ก่อนเริ่มงานทุกครั้ง แล้ว **ถามเจ้าของก่อนเริ่มเฟสใหม่**
> ทุกครั้งที่ให้ prompt ต้องบอกโมเดล + effort และพอทำเสร็จต้องบอกว่าอัปโหลดไฟล์ไหนไปโฟลเดอร์ไหนบน GitHub

## ภาพรวม
- เว็บ Tier list + ฐานข้อมูลการ์ด แบบ **template ย้ายเกมได้** (แก้ `js/config.js` ไฟล์เดียว)
- ต่อจากเว็บเก่า Anime Card Ascension (repo `sunhoaass/Card_Ascension`) ใช้ repo เดิม `sunhoaass/Card_Ascension` (ไฟล์ใหม่ทับของเดิม)
- เงื่อนไข: **ฟรีทั้งหมด** (ไม่ใช้ AI API แบบเสียเงิน) · หน้าเว็บภาษาอังกฤษ · เจ้าของใช้มือถือเป็นหลัก
- Stack: HTML/CSS/JS ล้วน (ไม่มี build) บน GitHub Pages อย่างเดียว — **ไม่มีฐานข้อมูล** ข้อมูลอยู่ใน `data/db.json` และรูปอยู่ใน `images/`
- แอดมิน login ด้วย GitHub fine-grained token (Contents: read/write) เก็บใน localStorage ของเครื่องเจ้าของ แล้วบันทึกผ่าน GitHub API

## โครงไฟล์
| ไฟล์ | หน้าที่ |
|---|---|
| `js/config.js` | ชื่อเว็บ, GITHUB (owner/repo/branch), ขนาดรูป, STATS, TIERS, TAG_GROUPS |
| `js/data.js` | loadAll (อ่าน db.json), normalize, statRanks, applyMutation, esc/fmt/uid |
| `js/github.js` | token, readDb/writeDb, uploadFile/deleteFile ผ่าน GitHub API |
| `js/app.js` | หน้าสาธารณะ: Tier List, Cards, หน้ารายละเอียดการ์ด |
| `js/admin.js` | Login ด้วย token, เพิ่ม/แก้/ลบการ์ด, จัดการ Rarities/Mutations |
| `js/cropper.js` | ตัดรูปให้ขนาดเท่ากัน 600×840 (ลาก/จีบนิ้ว) |
| `data/db.json` | `{updated, rarities[], mutations[], cards[]}` |

card: `{id, name, image_url (images/…), rarity_id, stats{atk,hp}, passive, skill, tags["group:Option"], tier, notes, extra{}, created_at, updated_at}` · id เป็น string 12 ตัว

## ✅ ทำแล้ว
- **เฟส 1 (22 ต.ค. 2026)** — โครง template, login แอดมิน, เพิ่มการ์ด + ตัดรูป, Rarity/โอกาสออกแบบพิมพ์เอง, Mutation ตัวคูณแบบตั้งเอง (คูณทุก stat หรือเฉพาะตัว), จัดอันดับ ATK/HP อัตโนมัติ, หน้า Tier List แบบดูอย่างเดียว, หน้า Cards + ค้นหา/กรอง, หน้ารายละเอียดเลือก Mutation แล้วตัวเลขเปลี่ยน, จำหน้าล่าสุด, แสดงวันที่อัปเดต
- **22 ต.ค. 2026** — เจ้าของขอแบบง่าย: ตัด Supabase ออก เปลี่ยนไปเก็บข้อมูลใน GitHub repo แทน (ทดสอบหน้าเว็บด้วยข้อมูลตัวอย่างผ่านแล้ว)
- สถานะ: **รอเจ้าของสร้าง repo + token ตาม INSTALL.md และทดสอบหน้าแอดมินจริง**

## ⏭️ เฟสถัดไป (ต้องถามเจ้าของก่อนเริ่ม)
| เฟส | งาน | โมเดล / effort |
|---|---|---|
| 2 | Tier List ลากวางได้ (ต่อยอดจากเว็บเก่า) + Global tier ที่แอดมินแก้ | Sonnet 5.5 / medium |
| 3 | หน้าการ์ดแบบเว็บเก่า + คลิปสกิล (Passive · Attack · Ultimate) | Sonnet 5.5 / medium |
| 4 | วิเคราะห์ทีมแบบใช้กฎจาก tag (จุดเด่น/จุดอ่อน, ตำแหน่งใน 5 ใบ, แพ้ทาง) | Opus 5.5 / high |
| 5 | OCR ฟรี (Tesseract.js) อ่านตัวเลข/ข้อความจากรูป → เติมฟอร์มเป็นร่าง | Sonnet 5.5 / high |
| 6 | Deck builder, Card Grader, SEO/Google search | ถามก่อน |

## 📝 หมายเหตุ
- Save แล้วเว็บอัปเดตหลัง Pages build ~1 นาที · ถ้า sha ชน (409) ให้รีเฟรชหน้าแอดมิน
- ยังไม่ได้ย้ายข้อมูล/คลิปจากเว็บเก่า เพราะเป็นเกมใหม่
