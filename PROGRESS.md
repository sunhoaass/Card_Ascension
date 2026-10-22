# Card Battle Infinity — PROGRESS

> **สำหรับ Claude:** อ่านไฟล์นี้ก่อนเริ่มงานทุกครั้ง · ถามเจ้าของก่อนเริ่มงานใหม่หรือก่อนทำตามไอเดียของตัวเอง
> ทุกครั้งที่ให้ prompt ต้องบอกโมเดล + effort · ทำเสร็จต้องบอกว่าอัปไฟล์ไหนไปโฟลเดอร์ไหนบน GitHub
> ก่อนเริ่มสร้างงานใหม่ ให้เขียน prompt สำหรับเปิดแชทใหม่ให้เจ้าของก่อน (ประหยัด token)

## ภาพรวม
- เว็บ Tier list + ฐานข้อมูลการ์ด แบบ template ย้ายเกมได้ (แก้ `js/config.js` ไฟล์เดียว)
- Repo: `sunhoaass/Card_Ascension` (ทับเว็บเก่า Anime Card Ascension) · เว็บ: https://sunhoaass.github.io/Card_Ascension/
- เงื่อนไข: **ฟรีทั้งหมด** · **ไม่มีระบบวิเคราะห์ด้วย AI หรือปุ่มวิเคราะห์ใดๆ** · หน้าเว็บภาษาอังกฤษ · เจ้าของใช้มือถือ
- Stack: HTML/CSS/JS ล้วนบน GitHub Pages ไม่มีฐานข้อมูล ข้อมูลอยู่ใน `data/db.json` รูปอยู่ใน `images/` (ระบบสร้างเอง)

## โครงไฟล์ใน repo
| ไฟล์ | หน้าที่ |
|---|---|
| `index.html` | หน้าเว็บหลัก |
| `admin.html` | หน้าแอดมิน |
| `css/style.css` | หน้าตาทั้งหมด |
| `js/config.js` | ชื่อเว็บ, GITHUB (owner/repo/branch), ขนาดรูป, STATS, TIERS, TAG_GROUPS |
| `js/data.js` | โหลด db.json, statRanks, applyMutation, esc/fmt/uid |
| `js/github.js` | อ่าน/เขียนไฟล์ใน repo ผ่าน GitHub API |
| `js/app.js` | หน้าสาธารณะ: Tier List, Cards, รายละเอียดการ์ด |
| `js/admin.js` | หน้าแอดมิน: เพิ่ม/แก้/ลบการ์ด, Rarities, Mutations |
| `js/cropper.js` | ตัดรูปการ์ดเป็น 600×840 |
| `data/db.json` | `{updated, rarities[], mutations[], cards[]}` |
| ห้ามลบ | `googleac6eef435a8d1c66.html`, `sitemap.xml` (Google Search) |

card: `{id, name, image_url, rarity_id, stats{atk,hp}, passive, skill, tags["group:Option"], tier, notes, extra{}, created_at, updated_at}`

## ✅ ทำแล้ว (22 ต.ค. 2026)
- เพิ่ม/แก้/ลบการ์ด + ตัดรูปขนาดเท่ากัน
- Rarity + โอกาสออกแบบพิมพ์เอง
- Mutation ตั้งชื่อ/ตัวคูณเองได้ ตัวเลขเปลี่ยนตามที่เลือก
- จัดอันดับ ATK/HP อัตโนมัติ
- หน้า Tier List (ดูอย่างเดียว), Cards (ค้นหา/กรอง), จำหน้าล่าสุด, แสดงวันที่อัปเดต
- แอดมิน login ตอนนี้ใช้ **GitHub token** (กำลังจะเปลี่ยน ดูด้านล่าง)

## 🔄 การตัดสินใจล่าสุด (22 ต.ค. 2026)
- **ตัดระบบวิเคราะห์แบบปุ่มกดออกทั้งหมด** (ทั้ง AI, OCR และวิเคราะห์ทีม)
- **เปลี่ยนการ login แอดมินกลับเป็นรหัสผ่านแบบเดิม** (พิมพ์รหัสเอง ไม่ต้องวาง token ยาวๆ)
  - ข้อจำกัด: เว็บ static บันทึกขึ้น GitHub ได้ต้องมี token อยู่เบื้องหลังเสมอ
  - แนวทางที่เสนอ (รอเจ้าของยืนยัน): สร้าง token ครั้งเดียว แล้วเข้ารหัสด้วยรหัสผ่านของเจ้าของ (AES-GCM + PBKDF2) เก็บไว้ใน repo แอดมินพิมพ์แค่รหัสผ่านก็ใช้งานได้ โดยไม่มีใครเห็น token จริง

## ⏭️ งานถัดไป (ถามเจ้าของก่อนเริ่ม)
| ลำดับ | งาน | โมเดล / effort |
|---|---|---|
| 1 | เปลี่ยน login แอดมินเป็นรหัสผ่าน | Opus 5.5 / medium |
| 2 | Tier List ลากวางได้ + แอดมินบันทึกเป็น Global tier | Sonnet 5.5 / medium |
| 3 | หน้าการ์ดแบบเว็บเก่า + คลิปสกิล (Passive · Attack · Ultimate) | Sonnet 5.5 / medium |
| 4 | Deck builder, Card Grader | ถามก่อน |

## 📝 หมายเหตุ
- Save แล้วเว็บอัปเดตหลัง GitHub build ประมาณ 1 นาที · ถ้าขึ้น 409 ให้รีเฟรชหน้าแอดมิน
- ไฟล์ `js/s` เป็นไฟล์เกินที่สร้างผิด ลบได้
