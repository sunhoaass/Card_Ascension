# วิธีติดตั้ง Card Battle Infinity (แบบง่าย — GitHub อย่างเดียว)

ใช้ของฟรีทั้งหมด ไม่ต้องตั้งฐานข้อมูล ใช้เวลาประมาณ 5 นาที

---

## 1. สร้าง repo (1 นาที)
1. github.com → ปุ่ม **+** มุมขวาบน → **New repository**
2. Repository name: `Card_Ascension` (ต้องตรงกับใน `js/config.js`)
3. เลือก **Public** → ติ๊ก **Add a README file** → **Create repository**

## 2. ใส่ไฟล์ลง repo
**ทางที่ง่ายที่สุด:** บอก Claude ว่า "สร้าง repo แล้ว" Claude จะลองอัปโหลดให้

**ถ้าต้องอัปเอง** ให้ใส่ไฟล์ตามโครงนี้
```
Card_Ascension/
├── index.html
├── admin.html
├── INSTALL.md
├── PROGRESS.md
├── css/style.css
├── data/db.json
└── js/  (admin.js, app.js, config.js, cropper.js, data.js, github.js)
```
- ไฟล์นอกโฟลเดอร์: **Add file → Upload files**
- ไฟล์ในโฟลเดอร์: **Add file → Create new file** → พิมพ์ชื่อเป็น `css/style.css` (พิมพ์ `/` แล้วจะกลายเป็นโฟลเดอร์) → วางเนื้อหา → Commit แล้วเข้าไปในโฟลเดอร์นั้น ไฟล์ที่เหลือใช้ Upload files ได้
- โฟลเดอร์ `images/` ไม่ต้องสร้าง ระบบจะสร้างให้เองตอนเพิ่มการ์ดใบแรก

## 3. เปิดเว็บ (1 นาที)
1. ใน repo → **Settings** → **Pages**
2. Source: **Deploy from a branch** → Branch: `main` / `(root)` → **Save**
3. รอ 1–2 นาที แล้วเปิด
   - เว็บ: `https://sunhoaass.github.io/Card_Ascension/`
   - แอดมิน: `https://sunhoaass.github.io/Card_Ascension/admin.html`

## 4. สร้างรหัสแอดมิน (GitHub token) (2 นาที)
1. github.com → กดรูปโปรไฟล์ → **Settings**
2. เลื่อนลงล่างสุด → **Developer settings**
3. **Personal access tokens** → **Fine-grained tokens** → **Generate new token**
4. ตั้งค่า
   - Token name: `card-admin`
   - Expiration: เลือกนานสุดที่มีให้ (หมดอายุเมื่อไรค่อยสร้างใหม่)
   - Repository access: **Only select repositories** → เลือก `Card_Ascension`
   - Permissions → Repository permissions → **Contents** → **Read and write**
5. **Generate token** → **คัดลอกทันที** (GitHub จะโชว์ให้ดูแค่ครั้งเดียว)
6. เปิดหน้า `admin.html` → วาง token → **Log in** ครั้งต่อไปจะจำไว้ในเครื่อง

⚠️ token ใช้แทนรหัสผ่าน ห้ามส่งให้ใคร ห้ามวางในไฟล์ใน repo ถ้าหลุด ให้กลับไปหน้าเดิมแล้วกด **Delete** token ทิ้งได้ทันที

## 5. ทดสอบ
1. แท็บ **Rarities** → เพิ่ม `Common` / `1 IN 10`
2. แท็บ **Mutations** → เพิ่ม `Gold` / `2` / All stats
3. **+ Add card** → เลือกรูป → ตัด → กรอก → **Save card**
4. รอประมาณ 1 นาที → เปิดหน้าเว็บ → กดการ์ด → ลองเปลี่ยน Mutation ดูว่าตัวเลขเปลี่ยนไหม

---

## ข้อควรรู้
- กด Save แล้ว**ต้องรอประมาณ 1 นาที**กว่าเว็บจะอัปเดต (GitHub ต้อง build ใหม่)
- ถ้าขึ้นว่า *Data changed elsewhere* แปลว่ามีการแก้จากอีกเครื่องหรืออีกแท็บ ให้รีเฟรชหน้าแอดมินแล้วทำใหม่
- repo เป็น Public คนอื่นดูโค้ดได้ แต่แก้ไม่ได้ ถ้าไม่มี token
