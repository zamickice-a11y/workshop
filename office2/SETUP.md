# SIAM AUTOWORKS Office — Setup Guide

ระบบหลังบ้านสำหรับออกเอกสาร: **ใบแจ้งหนี้ + Job Sheet (งานซ่อม)** และ **รายงานตรวจสภาพรถ (PPI)**
มี login จริง เก็บงานบน cloud sync ทุกเครื่อง ออกได้ทั้ง **PDF (ปริ้น)** และ **Word (.docx)**

---

## ภาพรวมระบบ

- **Frontend** = ไฟล์ static (HTML/CSS/JS) — deploy บน GitHub Pages ได้เลย ไม่ต้อง build
- **Auth + Database** = Supabase (ฟรี)
- **PDF** = กดปุ่ม Preview → Print → Save as PDF (Chrome render format เป๊ะ)
- **Word** = กดปุ่ม Download Word → ได้ .docx แก้ต่อได้

ค่าใช้จ่าย: **$0/เดือน** (Supabase free tier: 500MB database, 50,000 monthly active users — เกินพอ)

---

## ขั้นตอน Setup (ทำครั้งเดียว ~15 นาที)

### 1. สร้าง Supabase project
- ไปที่ https://supabase.com → Sign up (ใช้ Gmail/GitHub ได้)
- กด **New project**
- Name: `siam-autoworks` / ตั้ง database password (เก็บไว้ดีๆ) / region: **Sydney** (ใกล้ที่สุด)
- รอ ~2 นาทีให้ project พร้อม

### 2. สร้างตารางฐานข้อมูล
- เมนูซ้าย → **SQL Editor** → **New query**
- เปิดไฟล์ `schema.sql` → copy ทั้งหมด → paste → กด **Run**
- ควรขึ้น "Success. No rows returned" = เสร็จ

### 3. เอา API keys มาใส่
- เมนูซ้าย → **Project Settings** (รูปเฟือง) → **API**
- copy 2 ค่า:
  - **Project URL** (เช่น `https://abcdxyz.supabase.co`)
  - **anon / public** key (ยาวๆ ขึ้นต้น `eyJ...`) — อันนี้ปลอดภัยใส่ใน browser ได้
- เปิดไฟล์ `config.js` แก้:
  ```javascript
  SUPABASE_URL: "https://abcdxyz.supabase.co",
  SUPABASE_ANON_KEY: "eyJ...",
  ```

### 4. (ตั้งค่า Auth) เปิดให้สมัคร + ปิด email confirmation สำหรับใช้ส่วนตัว
- เมนูซ้าย → **Authentication** → **Sign In / Providers** → ดูว่า **Email** เปิดอยู่
- ถ้าอยากให้สมัครแล้วใช้ได้เลยไม่ต้องยืนยันอีเมล (สะดวกสำหรับใช้คนเดียว):
  → **Authentication** → **Sign In / Providers** → Email → ปิด **Confirm email**
- (ถ้าเปิด confirm email ไว้ ตอนสมัครต้องไปกดยืนยันในอีเมลก่อน)

### 5. Deploy
ทางเลือก (เลือกอันใดอันหนึ่ง):

**ก. ใช้ subdomain แยก** (แนะนำ) — `app.siamautoworks.com.au`
- สร้าง GitHub repo ใหม่ เช่น `siam-office`
- อัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้
- เปิด GitHub Pages (Settings → Pages → branch main)
- ตั้ง custom domain `app.siamautoworks.com.au` + เพิ่ม CNAME record ที่ DNS

**ข. ใส่เป็น subfolder ในเว็บเดิม** — `siamautoworks.com.au/office/`
- ก๊อปไฟล์ทั้งหมดไปไว้ใน folder `office/` ของ repo เว็บหลัก
- เข้าผ่าน `siamautoworks.com.au/office/`

### 6. สมัคร account แรก
- เปิดแอป → กด "Create an account" → ใส่อีเมล + password (6+ ตัว)
- (ถ้าปิด confirm email ไว้) → กลับมา Sign in ได้เลย

---

## วิธีใช้งานประจำวัน

1. Login
2. กด **+ Repair job** หรือ **+ Inspection**
3. กรอกข้อมูล — ช่อง inspection ส่วนใหญ่มี dropdown ค่าที่ใช้บ่อย (แตะแทนพิมพ์ หรือพิมพ์เองก็ได้)
4. Line items: กด "+ Add line" → ใส่ qty/รายการ/ราคา → total คำนวณอัตโนมัติ
5. กด **Save** (เก็บบน cloud)
6. กด **Preview / PDF** → ดู format → **Print / Save as PDF** → ปริ้นจากเครื่องในรถ
7. หรือกด **Download Word** → ได้ .docx แก้ต่อใน Word ได้

งานที่ save ไว้จะเห็นในหน้า Jobs ทุกเครื่องที่ login บัญชีเดียวกัน — แก้/reprint/ลบได้

---

## หมายเหตุเรื่อง format

v1 นี้ออกแบบให้ format ใกล้เคียง template เดิมมากที่สุด แต่อาจต่างจาก Word เดิมเล็กน้อยในรายละเอียด (ระยะห่าง ฟอนต์ การเรียงช่อง) เพราะ render คนละ engine กัน

**PDF** (ผ่าน Chrome print) จะใกล้เคียงที่สุด — แนะนำใช้อันนี้เป็นหลักสำหรับปริ้น
**Word** ใช้เมื่ออยากแก้ข้อความเพิ่มก่อนส่ง

ถ้าเจอจุดที่อยากปรับ format — บอกได้ จะ iterate ให้

---

## เปลี่ยนข้อมูลธุรกิจบนเอกสาร

แก้ใน `config.js` ส่วน `BUSINESS` — ชื่อ, ABN, เบอร์, email, ที่อยู่, ชื่อช่าง
(เช่นถ้าอยากเอาเบอร์ Chris ออก ก็แก้บรรทัด `phone` ได้เลย)
