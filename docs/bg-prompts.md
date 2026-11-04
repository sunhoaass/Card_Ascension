# พื้นหลังเว็บใหม่ (โทนมืดไม่ดำ) — prompt สร้างรูป

เจ้าของสั่ง 2026-11-04: ธีมสว่าง 5 แบบยังไม่ถูกใจ → อยากได้**โทนมืดแต่ไม่ดำ** สีใกล้ฉากหน้าดูการ์ด (น้ำเงินหลวง คราม ม่วง แสงขาวลาเวนเดอร์ วงทอง-ส้ม) หรือต่างนิดหน่อย · **รอเจ้าของส่งรูปก่อน แล้วค่อยทำ artifact** (ใน artifact มีปุ่มระดับ Normal…Godly แบบใหม่ + หน้าจอคอมทุกขนาดด้วย)

## ส่งรูปยังไง
- ทำ **3 แบบ (A, B, C)** หรือเฉพาะแบบที่ชอบ · แต่ละแบบมี **2 รูป: มือถือ (แนวตั้ง) + คอม (แนวนอนกว้าง)**
- ใช้ prompt ภาษาอังกฤษด้านล่าง**ทั้งก้อน** (ตัวสร้างรูปเข้าใจภาษาอังกฤษดีกว่า) · วางทีละก้อนในตัวสร้างรูป (ChatGPT / Gemini / Midjourney ฯลฯ)
- **อย่าแนบรูปจากเกมเป็นรูปอ้างอิง** (กันรูปออกมาเหมือนเกมจนติดลิขสิทธิ์ · กฎทำงานข้อ 10) · prompt ทำให้โทนใกล้กันอยู่แล้ว
- ขนาด: **มือถือ 9:16 (หรือ 9:20 ถ้าเลือกได้) ≥ 1440×2560** · **คอม 21:9 ≥ 5040×2160** (ถ้าไม่มี 21:9 ใช้ 16:9 ≥ 3840×2160) · ไฟล์ PNG หรือ JPG คุณภาพสูงสุด
- ตั้งชื่อ `A-mobile.png` `A-desktop.png` `B-…` `C-…` แล้ว**อัปไปที่ `inbox/bg/`** (ไฟล์เต็ม ไม่โดนบีบ) หรือแนบในแชท
- ถ้ารูปออกมามีตัวหนังสือ / คน / การ์ดมีลาย → สร้างใหม่ (หรือส่งมาได้ Claude ตัดออกให้ถ้าเป็นจุดเล็ก)
- ไม่ชัวร์ว่าแบบไหน: ส่ง 2–3 รูปต่อแบบมาให้เลือกได้

## ทำไมต้องวางองค์ประกอบแบบนี้ (Claude ใช้ตอนทำเว็บ)
- **กลางจอเงียบ + มืดกว่าขอบนิดหน่อย** = ที่วางกล่องข่าว / ตารางการ์ด ตัวหนังสืออ่านง่าย
- มือถือ: **บน 12% เรียบ** (หัวเว็บ) · **ล่าง 10% เรียบ** (เมนูล่าง) · ของเด่น (วงแสง) อยู่ช่วง 15–30% จากบน
- คอม: **ซ้าย 15% เรียบ** (เมนูซ้าย 252px) · ของเด่นอยู่**กลาง 16:9** → จอ 1366×768 / 1440×1080 / 1920×1080 / 2560×1440 ตัดขอบได้ไม่เสียของ · ขอบซ้ายขวาสุดของรูป 21:9 = ฟ้าเรียบ (จอ ultrawide 3440×1440 เห็นเต็ม)
- อนิเมชั่นทำด้วยโค้ดทับรูป (ดาววิบ หมอกเลื่อน วงแสงเต้น ละอองลอย) → **รูปต้องนิ่ง ไม่ต้องใส่ motion blur** · ใช้แค่ transform / opacity = ไม่แลค
- ไม่มีสีดำ: เงาเข้มสุด = น้ำเงินกรมท่า / ม่วงเข้ม (`#141a3d` ประมาณนี้)

---

## A · Celestial Eclipse (โทนเดียวกับหน้าดูการ์ด)
น้ำเงินหลวง → คราม → ม่วง · วงสุริยุปราคาขอบทอง-ส้ม แกนกลางม่วงเข้ม (ไม่ดำ) · สายแสงดาวไหลลงเหมือนรากไม้/น้ำตก **ไขว้กันเป็นรูป ∞ จางๆ** (ชื่อเว็บ Infinity) · ยอดวังคริสตัลในหมอกด้านล่าง · การ์ดโปร่งแสงลอยขึ้นเหมือนโคมไฟ (Ascension)

**A-mobile**
```
Vertical 9:16 mobile wallpaper, fantasy celestial night sky for a card battle game website background. Deep royal blue, indigo and violet palette, luminous lavender-white highlights, accents of warm gold and soft orange. Upper area (15 to 30 percent from the top): a large solar eclipse, a glowing gold-to-orange corona ring with a deep indigo-violet core (not pure black), fine golden sparks drifting around it. From the eclipse, rivers of starlight flow downward like glowing tree roots and a soft waterfall of light; two of the streams gently cross to form a faint infinity-symbol loop. Lower third: misty silhouettes of a crystal palace with slender spires, softly lit windows, layered fog. A few small translucent blank rectangular cards float upward like paper lanterns with a faint glow. Thin wispy clouds, scattered small stars. Painterly digital matte painting, soft volumetric light, high detail at the edges, calm and slightly darker in the center where text will sit. Top 12 percent and bottom 10 percent smooth and low detail. Darkest tone is deep navy, never pure black. No text, no logo, no letters, no characters, no people, no UI, no frame, no watermark, no symbols on the cards.
```

**A-desktop**
```
Ultra-wide 21:9 desktop website background, fantasy celestial night sky for a card battle game. Deep royal blue, indigo and violet palette, luminous lavender-white highlights, accents of warm gold and soft orange. Upper center: a large solar eclipse with a glowing gold-to-orange corona ring and a deep indigo-violet core (not pure black), fine golden sparks around it. Rivers of starlight flow down and outward from the eclipse like glowing tree roots and wings of light reaching toward both sides; two streams gently cross to form a faint infinity-symbol loop. Bottom: a wide misty horizon with crystal palace spires and softly lit windows, layered fog. A few small translucent blank rectangular cards float upward like lanterns. Keep all important elements inside the central 16:9 area; the far left and right edges are smooth open sky; the left 15 percent is calm and low detail for a sidebar menu. Center slightly darker and calm where text panels will sit. Painterly digital matte painting, soft volumetric light, high detail. Darkest tone is deep navy, never pure black. No text, no logo, no letters, no characters, no people, no UI, no frame, no watermark, no symbols on the cards.
```

## B · Amethyst Dusk (ต่างนิดหน่อย: ม่วงอุ่นขึ้น)
ม่วงอเมทิสต์ พลัม ชมพูกุหลาบ ตอนพลบค่ำ · พระจันทร์เสี้ยวมีวงรัศมีทอง · แสงออโรราสีฟ้าอมเขียว-ชมพูวนเป็นเส้นโค้ง ∞ · เกาะลอยฟ้ามียอดหอคอย · การ์ดโคมลอยขึ้น

**B-mobile**
```
Vertical 9:16 mobile wallpaper, fantasy twilight sky for a card battle game website background. Amethyst purple, plum and deep indigo palette with rose-pink and soft teal aurora light, warm gold accents. Upper area (15 to 30 percent from the top): a large crescent moon wrapped in a glowing golden halo ring. Ribbons of aurora in teal and rose sweep across the sky in smooth curves that loosely trace an infinity shape. Below: floating sky islands with slender towers and small glowing windows, waterfalls of light falling from their edges into soft violet clouds. A few small translucent blank rectangular cards rise upward like glowing lanterns. Scattered stars, gentle haze. Painterly digital matte painting, soft volumetric light, detailed edges, calm and slightly darker in the center where text will sit. Top 12 percent and bottom 10 percent smooth and low detail. Darkest tone is deep plum-navy, never pure black. No text, no logo, no letters, no characters, no people, no UI, no frame, no watermark, no symbols on the cards.
```

**B-desktop**
```
Ultra-wide 21:9 desktop website background, fantasy twilight sky for a card battle game. Amethyst purple, plum and deep indigo palette with rose-pink and soft teal aurora light, warm gold accents. Upper center: a large crescent moon wrapped in a glowing golden halo ring. Wide ribbons of teal and rose aurora sweep across the whole sky in smooth curves that loosely trace an infinity shape. Lower part: floating sky islands with slender towers and small glowing windows spread across the horizon, waterfalls of light falling into soft violet clouds. A few small translucent blank rectangular cards rise like lanterns. Keep all important elements inside the central 16:9 area; the far left and right edges are smooth open sky; the left 15 percent is calm and low detail for a sidebar menu. Center slightly darker and calm where text panels will sit. Painterly digital matte painting, soft volumetric light, high detail. Darkest tone is deep plum-navy, never pure black. No text, no logo, no letters, no characters, no people, no UI, no frame, no watermark, no symbols on the cards.
```

## C · Sapphire Abyss (ต่างนิดหน่อย: น้ำเงินอมเขียว)
ไพลิน น้ำเงินอมเขียวเข้ม ฟ้าครามสว่าง · ประตูมิติวงกลมขอบทองเรืองแสง · เสาแสงพุ่งขึ้นฟ้า · ทะเลเมฆสะท้อนแสง · ดาวต่อเส้นเป็นกลุ่มดาวรูปการ์ด

**C-mobile**
```
Vertical 9:16 mobile wallpaper, fantasy cosmic sky above a sea of clouds for a card battle game website background. Sapphire blue, deep teal and indigo palette with bright cyan and lavender-white light, warm gold accents. Upper area (15 to 30 percent from the top): a huge circular portal gate in the sky with an ornate glowing gold rim and a swirling deep sapphire nebula inside (not black). Thin pillars of light rise from the cloud sea up into the portal. Faint constellation lines connect stars into simple rectangular card shapes and a subtle infinity loop. Bottom third: a calm glowing sea of clouds reflecting the light, distant temple spires peeking through mist. A few small translucent blank cards float upward. Painterly digital matte painting, soft volumetric light, detailed edges, calm and slightly darker in the center where text will sit. Top 12 percent and bottom 10 percent smooth and low detail. Darkest tone is deep teal-navy, never pure black. No text, no logo, no letters, no characters, no people, no UI, no frame, no watermark, no symbols on the cards.
```

**C-desktop**
```
Ultra-wide 21:9 desktop website background, fantasy cosmic sky above a sea of clouds for a card battle game. Sapphire blue, deep teal and indigo palette with bright cyan and lavender-white light, warm gold accents. Upper center: a huge circular portal gate in the sky with an ornate glowing gold rim and a swirling deep sapphire nebula inside (not black). Pillars of light rise from the cloud sea into the portal. Faint constellation lines connect stars into simple rectangular card shapes and a subtle infinity loop. Lower part: a wide calm glowing sea of clouds reflecting the light, distant temple spires through mist across the horizon. A few small translucent blank cards float upward. Keep all important elements inside the central 16:9 area; the far left and right edges are smooth open sky; the left 15 percent is calm and low detail for a sidebar menu. Center slightly darker and calm where text panels will sit. Painterly digital matte painting, soft volumetric light, high detail. Darkest tone is deep teal-navy, never pure black. No text, no logo, no letters, no characters, no people, no UI, no frame, no watermark, no symbols on the cards.
```

## D · Castle Night (เจ้าของขอ 2026-11-04 · ⭐ แบบหลักตอนนี้)
เมืองยามค่ำ **ปราสาทเด่นที่สุด** · ฟ้ากลางคืน + ดาว · มืดไม่ดำ (น้ำเงินกรมท่า คราม ม่วง) · ไฟหน้าต่างสีทองอุ่น · ปราสาทออกแบบเอง ไม่เหมือนปราสาทในเกมไหน

**D-mobile**
```
Vertical 9:16 mobile wallpaper, fantasy night city with a grand castle as the clear main focus, for a card battle game website background. The castle stands in the center of the lower half: tall slender spires with blue slate roofs and gold trims, the tallest spire reaching about 25 percent from the top of the image, warm golden light glowing from many arched and stained-glass windows, a soft beam of pale light rising from the highest tower into the sky. Around and below it: a layered medieval-fantasy city on a hillside, rooftops, small towers, a stone bridge over a calm river that reflects the lights, tiny warm street lanterns. Behind the castle: a large full moon with a soft halo, slightly off-center. Night sky full of stars with a faint violet-blue milky way band, a few thin clouds lit by moonlight, one or two small shooting stars. A few small translucent blank rectangular cards float upward from the city like glowing lanterns. Light mist between the city layers. Palette: deep navy, indigo and royal blue with violet shadows, lavender-white moonlight, warm gold window light. Painterly digital matte painting, soft volumetric light, crisp castle silhouette, high detail. Top 12 percent and bottom 10 percent smooth and low detail; the middle area slightly calmer and darker so text panels stay readable. Darkest tone is deep navy, never pure black. No text, no logo, no letters, no characters, no people, no UI, no frame, no watermark, no symbols on the cards.
```

**D-desktop**
```
Ultra-wide 21:9 desktop website background, fantasy night city with a grand castle as the clear main focus, for a card battle game. The castle stands at the horizontal center: tall slender spires with blue slate roofs and gold trims, the tallest spire reaching about 20 percent from the top, warm golden light glowing from many arched and stained-glass windows, a soft beam of pale light rising from the highest tower into the sky. A layered medieval-fantasy city spreads to both sides across rolling hills: rooftops, small towers, a stone bridge over a calm river reflecting the lights, tiny warm street lanterns, the city getting smaller and hazier toward the edges. Behind the castle: a large full moon with a soft halo, slightly off-center. Wide night sky full of stars with a faint violet-blue milky way band arching across, thin moonlit clouds, one or two small shooting stars. A few small translucent blank rectangular cards float upward from the city like glowing lanterns. Light mist between the city layers. Palette: deep navy, indigo and royal blue with violet shadows, lavender-white moonlight, warm gold window light. Keep the castle, the moon and all important elements inside the central 16:9 area; the far left and right edges are open sky and distant hazy hills; the left 15 percent is calm and low detail for a sidebar menu. Painterly digital matte painting, soft volumetric light, crisp castle silhouette, high detail. Darkest tone is deep navy, never pure black. No text, no logo, no letters, no characters, no people, no UI, no frame, no watermark, no symbols on the cards.
```

### D · ของเสริม (เลือกใส่ได้ · วางประโยคอังกฤษต่อท้าย prompt หรือแทนประโยคเดิม)
| ไอเดีย | ทำไมเข้ากับเว็บ | ประโยคที่ใส่ |
|---|---|---|
| แสงจากยอดปราสาทเป็นรูป ∞ | ชื่อเว็บ Infinity | `The light beam from the highest tower curls into a faint glowing infinity-symbol loop in the sky.` |
| การ์ดลอยขึ้นจากเมืองเยอะขึ้น | Ascension · เทศกาลการ์ด | `Dozens of small glowing blank cards rise from the city streets into the sky like a lantern festival.` |
| หอนาฬิกาหน้าปัดเรืองแสง | เคยเป็นของธีมทองเดิม ผู้ใช้จำได้ | `Beside the castle, a tall clock tower with a softly glowing clock face.` |
| พระจันทร์เป็นสุริยุปราคาวงทอง | เชื่อมกับฉากหน้าดูการ์ด | `Replace the full moon with a solar eclipse: a glowing gold-to-orange ring around a deep indigo core.` |
| ออโรราม่วง-ฟ้าอมเขียว | สีสันมากขึ้นแต่ยังมืด | `Soft ribbons of violet and teal aurora drift above the castle.` |
| เกาะลอยฟ้า + น้ำตกแสง | แฟนตาซีมากขึ้น | `Small floating islands with tiny towers hover beside the castle, thin waterfalls of light falling from them.` |
| หิ่งห้อย / ละอองทอง | อนิเมชั่นโค้ดทับได้สวย | `Tiny golden fireflies and sparkles float in the foreground mist.` |
| ประตูปราสาทเปิดมีแสงลอดออกมา | ความรู้สึก "เข้าไปในโลกเกม" | `The great castle gate is open, warm light spilling out onto a grand staircase.` |
| ธงยาวบนยอดหอ | เพิ่มสี (แดงไวน์ / ทอง) | `Long wine-red and gold banners flutter from the castle towers.` |
| กลุ่มดาวเป็นรูปการ์ด | ซ่อนธีมการ์ดแบบเนียน | `A faint constellation in the sky traces the outline of a playing card.` |

**ชุดที่ Claude แนะนำ (ไม่รกเกิน):** ∞ จากยอดปราสาท + การ์ดลอยแบบเทศกาล + หอนาฬิกา + หิ่งห้อยทอง · ใส่ไม่เกิน 3–4 อย่าง ไม่งั้นรูปรกจนวางตัวหนังสือไม่ได้
**เปลี่ยนบรรยากาศ (แทนประโยค Palette):** ม่วงพลบค่ำ `Palette: deep plum and amethyst with rose-pink highlights, warm gold window light.` · ไพลินเย็น `Palette: deep sapphire and teal with cyan moonlight, warm gold window light.`
**รูปแยกชั้น (ไม่บังคับ · ทำให้อนิเมชั่นลึกขึ้น):** สร้างรูปเดิมอีกรูปแต่ต่อท้าย `Same scene but only the night sky, moon and stars, no castle, no city.` → Claude ทำฟ้าขยับช้ากว่าเมืองได้ (ถ้ารูป 2 รูปไม่ตรงกันพอดีไม่เป็นไร ใช้รูปเดียวก็ได้)

## เสริม (ถ้าตัวสร้างรูปมีช่อง negative prompt)
```
text, letters, words, watermark, signature, logo, UI, buttons, frame, border, people, characters, faces, anime character, symbols on cards, pure black, crushed shadows, oversaturated neon, blurry, low resolution, jpeg artifacts
```
- Midjourney: ต่อท้าย `--ar 9:16` (มือถือ) / `--ar 21:9` (คอม) `--style raw` และใส่คำ negative หลัง `--no`
- ChatGPT: พิมพ์นำว่า "Create an image:" แล้ววาง prompt · ถ้าเลือกขนาดได้ ใช้แนวตั้งสำหรับมือถือ แนวนอนสำหรับคอม
- Gemini: วาง prompt แล้วพิมพ์ต่อว่า "aspect ratio 9:16" หรือ "16:9"

## เมื่อรูปมาแล้ว Claude ทำอะไร (artifact รอบ 2)
1. ธีมมืดใหม่ (ตามรูปที่ส่ง A / B / C) ใส่เพิ่มใน `mockup/bright-themes.html` ข้างธีมสว่าง 5 แบบเดิม (ลิงก์ artifact เดิม)
2. **ปุ่มระดับ Normal → Godly 9 ปุ่มแบบใหม่** (วาดด้วย CSS/SVG เอง · กฎข้อ 10) ให้เลือก 3–4 แบบ เช่น อัญมณีเจียระไน / เหรียญตรา / แคปซูลเรืองแสง / วงแหวนดาว · ใช้ได้ทั้งหน้า Cards และแถบระดับหน้าดูการ์ด
3. **พรีวิวทุกขนาดจอใน PROGRESS:** มือถือ 320×568 · 375×667 · 390×844 · 430×932 · มือถือแนวนอน 844×390 · คอม 1280×800 · 1366×768 · 1440×1080 · 1920×1080 · 2560×1440 (ซูมทั้งหน้า `--zoom`) · ultrawide 3440×1440 · คอม ≥ 1100px = เมนูซ้าย
4. รูปทำเป็น webp (มือถือ ≤ ~150KB · คอม ≤ ~250KB) + อนิเมชั่นโค้ดทับ (transform / opacity เท่านั้น)
