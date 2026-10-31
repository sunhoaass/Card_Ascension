# การ์ด / Support ที่โดนปรับ (รอแก้ใน T4)

จดไว้ก่อน **ยังไม่แก้ `data/cards.json` / `data/support.json`** จนกว่าจะเปลี่ยนรูปครบ (PROGRESS ▶️ "แผนข้อความบนการ์ดใหม่" T4)
ที่มา: รูปแคปหน้า Index ในเกมที่เจ้าของส่ง 2026-10-30 (Floor 647–678) · ข้อความด้านล่างพิมพ์ตามเกมทุกตัวอักษร · ค่า Support = ระดับ Normal (ตรงกับ `vals` เดิม เช่น Nine Tails 30)

## Support (ผลเปลี่ยนจริง · บัฟทั้ง 3 ใบ)

| Support (id) | เดิมใน support.json | ในเกมตอนนี้ |
|---|---|---|
| Nine Tails Fox (`nine-tails-fox`) | damage +30% อย่างเดียว | damage +30% **+ max HP +30% + รับดาเมจ −15%** |
| First Master Fairy (`first-master-fairy`) | 8% ของ max HP | **11%** ของ max HP **+ การ์ดสำรองเหลือ 1 HP** |
| Angel Attendant (`angel-attendant`) | หลบ 29% | หลบ **37% + damage +12.5% + max HP +12.5%** |

ข้อความในเกม (ใช้แทน `effect.desc` · ตัวเลขเปลี่ยนเป็น `{0}` `{1}` … ตามลำดับ):
- **Nine Tails Fox · Nine-Tails Chakra Mode:** Nine Tails Fox wraps the supported card in his chakra: it gets 30% more damage and 30% more max HP and takes 15% less damage.
- **First Master Fairy · Fairy Law:** First Master Fairy casts Fairy Law: the supported card blasts every enemy card for 11% of its max HP with its first hit (once per fight; bench cards keep 1 HP).
- **Angel Attendant · Angel's Grace:** Angel Attendant moves like an angel: the supported card dodges 37% of hits and gets 12.5% more damage and 12.5% more max HP.

## การ์ด (ATK / HP / odds ตรงกับ cards.json ทุกใบ · ต่างที่ข้อความ)

**ผลเปลี่ยนจริง:**
- **Pumpkin Sun Pride:** กันสถานะเพิ่ม: เดิม stunned, frozen, paralyzed → ตอนนี้ **+ confused, sealed, weakened** · ไฟไหม้ระบุ 5% ของ max HP ต่อเทิร์น
- **Pirate King:** เดิม "weaker enemy card loses its first turn (not bosses)" → เกม "enemy card with less power than it loses its next turn" (ไม่มี "not bosses")
- **Demon God of Flame / Control Devil:** Confuse = "skips its next turn and hits itself for half damage" (เดิม "hits itself instead") · Demon God ไฟไหม้ระบุ 5% ของ max HP ต่อเทิร์น
- **Soul Magic Father:** copy เฉพาะ "every **new** enemy card"

**ข้อความในเกม (passive.desc · ชื่อสกิลตรงกับเดิมทุกใบ):**
- **Hollow Mask Reaper · Getsuga Tensho:** Hollow Mask Reaper: Every 2nd attack also hits the card behind for 50% of its normal hit (no crits or bonuses). Under 38% HP: +66% damage. +9.4% damage every time it is hit. Survives its first killing blow with 1 HP. With Snow White Reaper in your deck, both get +14% damage and HP.
- **Pirate King · Kamusari:** Pirate King: When it comes in, every enemy card with less power than it loses its next turn. Every 2nd attack also hits the card behind for 50% of its normal hit (no crits or bonuses). Ignores the enemy's shields, dodges and barriers. 30% chance to crit for 2x damage.
- **Demon God of Flame · God of Demons:** Demon God of Flame's blue flames consume everything. Each hit sets every enemy card on fire for 2 turns (5% of its max HP per turn). Each hit adds 3 Burn stacks (each stack: 0.9% of the enemy's max HP per turn, max 4 stacks, 3 turns). Every enemy card starts with 4.6% less damage. 6.8% chance per hit to Confuse the enemy (it skips its next turn and hits itself for half damage). Can't be burned.
- **Made in Heaven Priest · Made in Heaven:** Made in Heaven Priest accelerates time. Its hits do 0.8x damage. 76% chance to attack twice. 38% chance to dodge each hit. Its first hit on each new enemy Seals that card's ability for 3 turns. With Time Stop Vampire in your deck: +23% damage and HP.
- **White Hawk Godhand · Eclipse:** White Hawk Godhand: 36% chance per hit to Mark the enemy: it takes 9.1% more damage from every card. Every enemy card starts with 7.1% less damage. Every 2nd attack also hits the card behind for 35% of its normal hit (no crits or bonuses). Comes back once with 36% HP.
- **Homunculus Father · God Within:** Father holds God inside him. Each kill gives it 13% of the defeated card's damage and HP. Its first hit on each new enemy Seals that card's ability for 2 turns. Every hit also hits the whole enemy bench for 20% of its normal hit (no crits or bonuses). Heals 4.5% of its max HP every turn.
- **Black Wizard Brother · Ankhseram's Curse:** Black Wizard Brother's death magic kills everything around him. When it comes in, the strongest enemy card dies after 4 turns unless this card falls first (bosses lose 30% HP instead). Instantly kills enemies under 12% HP (not bosses). Every 2nd attack also hits the card behind for 35% of its normal hit (no crits or bonuses). Comes back once with 40% HP.
- **Pumpkin Sun Pride · The One:** At noon, Pumpkin Sun Pride is the strongest. +5.2% damage every turn. Each hit sets every enemy card on fire for 1 turn (5% of its max HP per turn). Every hit also hits the whole enemy bench for 20% of its normal hit (no crits or bonuses). Can't be stunned, frozen, paralyzed, confused, sealed or weakened.
- **Soul Magic Father · Soul Magic:** Soul Magic Father rewrites souls. Copies the ability of every new enemy card it faces. Each kill gives it 8.4% of the defeated card's damage and HP. Its first hit on each new enemy Seals that card's ability for 2 turns.
- **Undead Overlord King · The Goal of All Life is Death:** Undead Overlord King's super-tier magic. When it comes in, the strongest enemy card dies after 3 turns unless this card falls first (bosses lose 30% HP instead). Every enemy card starts with 6.8% less damage. Instantly kills enemies under 10% HP (not bosses). Great Tomb cards in your deck get +6.8% damage and HP. Takes 6.8% less damage.
- **Golden Gate King · Enuma Elish:** Golden Gate King opens his golden treasury. Its hits do 0.8x damage. 42% chance to attack twice. Every hit also hits the whole enemy bench for 20% of its normal hit (no crits or bonuses). Every 3rd attack does 1.83x damage. Ignores the enemy's shields, dodges and barriers. Every enemy card starts with 6.3% less damage.
- **Storm Dragon · Storm Dragon:** Storm Dragon: Every hit also hits the whole enemy bench for 20% of its normal hit (no crits or bonuses). 28% chance per hit to Paralyze the enemy for 2 turns (50% chance to lose each turn). Every enemy card starts with 15% less damage. Takes 26% less damage. With Slime Demon Lord in your deck, both get +11% damage and HP.
- **Destroyer God · Hakai:** Destroyer God erases anything. 21% chance per hit to instantly kill an enemy under 60% HP (not bosses). Ignores the enemy's shields, dodges and barriers. 30% chance to dodge each hit. Every enemy card starts with 17% less damage.
- **Control Devil · Control:** Control Devil controls everything weaker than her. 17% chance per hit to Confuse the enemy (it skips its next turn and hits itself for half damage). Its first hit on each new enemy Seals that card's ability for 2 turns. Sends 9.1% of the damage it takes back at the attacker. Comes back once with 38% HP.
- **Hero Number One · Blast:** Hero Number One's cubes warp space. Each hit swaps the enemy's front card with a random card from its deck (not bosses). Ignores the enemy's shields, dodges and barriers. 40% chance to dodge each hit. +10% damage every turn (up to 10 times).

**ตรงกับเกมแล้ว (ไม่ต้องแก้):** Witch of Envy
