# SIAM AUTOWORKS — Website v2 Changelog

**Date:** May 2026
**Scope:** Conversion + SEO improvements for cold customer acquisition (Google search → website → booking).

---

## 🎨 Theme / Design

- **Preserved entirely.** Dark background (`#181717`) + orange brand (`#ff5e00`) untouched.
- No changes to logo, fonts, image gallery, slider, or color tokens.

---

## 📄 Files modified

### `index.html` — major content update

**`<head>`**
- New page title: `Mobile Mechanic Adelaide | Dealership-Trained | SIAM AUTOWORKS`
- Expanded meta description (target keywords: mobile mechanic Adelaide, pre-purchase inspection, Japanese, European)
- Added Open Graph tags (Facebook/LinkedIn sharing previews)
- Added Twitter card tags
- Added canonical URL
- Added JSON-LD `AutoRepair` schema:
  - Business info (ABN, phone, email, address)
  - Geo coordinates (Adelaide CBD)
  - Service areas (10 suburbs)
  - Opening hours
  - **AggregateRating: 5.0 / 13 reviews** ← *update reviewCount as Google reviews grow*
  - Service catalog with prices
  - Languages: en, th

**Hero section**
- New H1: `Mobile Mechanic in Adelaide. 7,000+ vehicles serviced.` (was: "Mobile Mechanic you can trust.")
- New pill: `★ 5.0 on Google • Dealership-trained • We come to you`
- New specialty pills row: `Japanese specialist • European specialist • Pre-purchase Inspections • English / ภาษาไทย`
- Trust cards updated:
  - Old: Same-day options / Mobile mechanic (Flexible solutions) / ABN
  - New: ★ 5.0 on Google / 7,000+ vehicles / ABN
- Added SMS button alongside Call/Email
- Added "Pre-purchase inspection" to Quick Booking checklist

**Services section**
- Sub-headline mentions Japanese & European specialty
- Pre-purchase Inspection card highlighted with `card-highlight` style + "Most requested" badge
- Pre-purchase card links to dedicated landing page

**Service areas section**
- Renamed to "Service areas — Adelaide metro"
- Expanded from 9 to 18 suburbs
- Norwood, Glenelg, Modbury are clickable links to suburb-specific pages

**About section**
- **Trimmed from 6 cards → 5 cards** (still wanted to keep visual density). Content consolidated:
  - "Owned by Chris & Mick" (combines locally owned + 7,000 vehicles + dealership story)
  - "How we work" (combines Reliable Transparent + Our Goal + Records)
  - "Japanese & European" (NEW — claims niche)
  - "Pre-purchase Inspections" (NEW — drives traffic to landing page)
  - "English / ภาษาไทย" (NEW — Thai community signal)

**FAQ section**
- Expanded from 4 to 8 entries:
  - NEW: "Do you specialise in Japanese cars?"
  - NEW: "Do you do pre-purchase inspections?"
  - NEW: "พูดภาษาไทยได้ไหม / Do you speak Thai?"
  - NEW: "What areas do you cover?"

**Footer**
- Now 4 columns (was 2): Business info / Hours / Contact / Quick links
- Added operating hours (Mon–Fri / Sat / Sun)
- Added "Languages: English / ภาษาไทย"
- Added phone number + SMS link
- Added link to pre-purchase-inspection page
- Added year auto-update script

### `booking.html` — minor enhancement

- Added URL param prefill: links like `booking.html?service=Pre-purchase%20Inspection` will auto-select the service dropdown
- No other changes (Formspree action, fields, validation all preserved)

### `assets/css/style.css` — additions only (no rewrites)

Appended new section at end of file with:
- `.specialty-row` and `.specialty-pill` (orange-tinted pills for hero)
- `.card-highlight` (PPI card glow + "Most requested" badge)
- `.footer-grid` redesign for 4-column layout
- `a.pill2` hover state for clickable suburb pills
- `.ppi-hero`, `.ppi-checklist`, `.steps`, `.step-num` (for Pre-purchase Inspection page)
- `.suburb-hero` (for suburb landing pages)

All additions are **additive** — no existing styles overwritten.

---

## 🆕 Files created

### `pre-purchase-inspection.html` (new)

Dedicated landing page for the highest-intent search query: "pre-purchase inspection adelaide"
- Full schema markup (`Service` type)
- Why PPI matters (3-card sales pitch)
- What's included (16-point checklist)
- 3-step "How it works"
- 7 PPI-specific FAQs (incl. Thai)
- All CTAs link to `booking.html?service=Pre-purchase%20Inspection`

### `mobile-mechanic-norwood.html` (new)

Suburb landing page template — east Adelaide
- Localised content for Norwood, Kent Town, Kensington, Maylands, etc.
- Geo schema with Norwood coordinates (-34.9214, 138.6321)
- 12 nearby suburbs listed

### `mobile-mechanic-glenelg.html` (new)

Suburb landing page — beachside south-west
- Geo: -34.9789, 138.5142
- Covers Glenelg, Brighton, Somerton Park, Plympton, etc.

### `mobile-mechanic-modbury.html` (new)

Suburb landing page — north-east
- Geo: -34.8333, 138.6833
- Covers Modbury, Tea Tree Gully, Hope Valley, Para Hills, etc.

### `sitemap.xml` (new)

XML sitemap with all 6 indexable pages. Submit to Google Search Console after deploy.

### `robots.txt` (new)

Allows all crawlers, points to sitemap.

---

## 🔍 Things I didn't change

- `assets/js/main.js` — slider, mobile nav, rego check all working fine
- `thankyou.html` — no changes needed
- `assets/img/*` — all images preserved
- `CNAME` — DNS untouched
- Brand colors, fonts, logo
- Booking form fields, validation, Formspree action
- Elfsight Google Reviews widget integration

---

## ⚠️ Issue I flagged but couldn't fix from source

In your screenshot, the "Why SIAM AUTOWORKS" section appeared to have **"Professional records" duplicated**. The source code in this zip has only **one** "Professional records" card — so either:

1. The deployed live version has an unpushed local edit
2. There's a CSS issue rendering one card twice
3. Browser caching showed an old version

**Action:** After deploying this v2 build, hard-refresh (Cmd+Shift+R / Ctrl+F5) and check. If duplicate persists, send another screenshot — it'll be in the new deployed file then.

---

## 🚀 After deploying — manual steps

1. **Google Search Console** (free): Add `siamautoworks.com.au` and submit `sitemap.xml`. Without this, Google may take weeks to find new pages.
2. **GBP linkage**: In your Google Business Profile, make sure the website link points to `https://www.siamautoworks.com.au/` and add the new pre-purchase-inspection page as a service.
3. **Update aggregateRating in schema** when review count changes (in `index.html` and `pre-purchase-inspection.html` and 3 suburb pages — search for `"reviewCount": "13"`).
4. **Test on mobile** — most cold customers will hit on phone. Quick-check the new specialty pills don't wrap awkwardly.
5. **Consider adding 2-3 more suburb pages** using the Norwood template — high-population suburbs like Salisbury, Mawson Lakes, or Henley Beach are good candidates.

---

## 📊 Expected impact

- **GBP / Map results:** No direct impact (those are managed in your GBP dashboard, not website). But improved schema helps Google verify your business info.
- **Direct search ("mobile mechanic norwood"):** New suburb pages should rank within 2–6 weeks if Google indexes them. Check in Search Console.
- **Pre-purchase inspection traffic:** Strong landing page + schema should rank for "pre purchase inspection adelaide" within 4–8 weeks.
- **Conversion rate from existing traffic:** Hero now leads with social proof + niche, should improve immediately. A/B comparison would be ideal but with low traffic it's hard — just trust the principle.

---

Mick — everything's preserved that worked. Test the v2 build, hard refresh, and check the booking flow still goes through to thankyou.html. If anything looks off, ping me and I'll iterate.
