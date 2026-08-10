# ExcelR Placement Drive — Registration Page (Figma → Implementation Spec)

Complete, self-contained handoff spec extracted from Figma via the Figma MCP.
Everything needed to build the page lives in this document + `public/reg/`.

---

## 0. Source & decisions

- **Figma file:** `Reg Page` — fileKey `rK65fxnztDnrX2IIDmk2oM` (owner: Vishal Aravind B)
- **Desktop frame:** node `8:527` "Desktop Version" — 1920 × 2725
- **Mobile frame:** node `1:697` "Mobile Version" — 390 × 3035
- **Pages in file:** `Mobile`, `Desktop` (same page, two breakpoints — ONE responsive page)

**Confirmed build decisions:**
1. **Pixel-match** the ExcelR design (blue/indigo palette, Poppins + Inter, navy hero). Standalone — does not reuse any other product's theme.
2. Route **`/reg`**, **public** and **no app chrome** (no nav/sidebar, no auth gate).
3. Form submit → **append row to Google Sheets** + **send email via Nodemailer** (server-side route handler).
4. **Mobile hides the inline form card** and shows a "Register Now" CTA instead (per Figma). Desktop shows the inline 2-column form.

---

## 1. Recommended tech stack (target: /Users/seeramsandeep/Excelr)

- **Next.js (App Router) + React + TypeScript**
- **Tailwind CSS** for styling
- **react-hook-form + zod** for the form
- **lucide-react** for icons (calendar, clock, map-pin, users, arrow-right); ₹ is a text glyph
- Server route handler `app/api/reg/route.ts` using **googleapis** (Sheets) + **nodemailer** (email)

> If Excelr is a fresh project: `npx create-next-app@latest` (TS + Tailwind + App Router), then add `react-hook-form zod @hookform/resolvers lucide-react googleapis nodemailer @types/nodemailer`.

---

## 2. Design tokens

### Fonts
- **Poppins** — all headings & buttons. Weights: 700 (Bold), 600 (SemiBold), 500 (Medium).
- **Inter** — body text, form labels/values. Weights: 400 (Regular), 600 (SemiBold).
- Load via `next/font/google` (Poppins + Inter).

### Type scale (desktop → mobile)
| Element | Desktop | Mobile | Font / weight | Notes |
|---|---|---|---|---|
| H1 "ExcelR's Placement Drive" | 72px | ~40–44px | Poppins 700 | letter-spacing ≈ −1.8; white on hero |
| "For Java Full Stack" badge | 48px | ~34px | Poppins 700 | in a rounded pill/highlight |
| Section H2 (Event Details / FAQ) | 36px | 36px | Poppins 700 | line-height 40–45; color `#0F172B` |
| Card H2 "Register Now" | 24px | 24px | Poppins 600 | |
| Body paragraph | 18px | 18px | Inter 400 | line-height ~26–29; slate |
| Form label (uppercase) | 14px | 14px | Inter 600 | letter-spacing +0.6, uppercase, slate |
| Field value / placeholder | 14–17px | 14–17px | Inter 400 | |
| Detail label (xs, uppercase) | 12px | 12px | Inter 600 | letter-spacing +0.6 |

### Colors
| Token | Hex | Usage |
|---|---|---|
| Dodger Blue | `#3B82F6` | primary accent, button gradient start, underline bar |
| Blue (bright) | `#2B7FFF` | accent |
| Cerulean | `#0EA5E9` | secondary accent / gradient |
| Cornflower/Indigo | `#6366F1` | button gradient end, glow |
| Indigo light | `#818CF8` | glow |
| Violet | `#8B5CF6` | glow accent |
| Navy 900 | `#0F172B` / `#0F172A` | hero bg base, heading text |
| Navy 800 | `#0F2050` | hero gradient stop |
| Slate 800 | `#1D293D` | dark text / hero gradient |
| Slate 500 | `#62748E` | secondary/body text |
| Slate 400 | `#90A1B9` | muted text |
| Page bg | `#F0F4FF` | section background |
| Bg tint 2 | `#EEF2FF` | alt section bg |
| Bg tint 3 | `#E8EDFF` | icon chip bg / borders |
| White | `#FFFFFF` | cards, nav, form |

Decorative glow blobs use low-alpha versions of the blues/indigos, e.g. `#3B82F61A` (10%), `#6366F138` (22%), `#3B82F62E` (18%) — rendered as large `blur`-ed absolutely-positioned rounded rects behind content.

### Radii
- Base `16px`, plus `20px`, `24px`. Form card = `rounded-3xl` (~24px). Buttons & 48×48 icon chips = fully rounded (pill/circle).

### Shadows
- Soft elevation on the white form card and FAQ items (e.g. `0 10px 30px rgba(2,6,23,0.08)` — tune to match).

### Spacing
- 8px-based. Section vertical padding ≈ 80px desktop / 40–60px mobile. Content max-width: hero/details grid ≈ 1152–1280px; FAQ ≈ 768px.

---

## 3. Section-by-section structure

### 3.1 Navbar  (desktop `8:531`, 1920×109 · mobile header `1:664`, 390×60)
- White bar, **centered** ExcelR logo.
- Asset: `public/reg/excelr-logo.png` (desktop render ~232×60; mobile ~141×44).

### 3.2 Hero / Banner  (desktop `8:889`, 1920×620 · mobile `1:508`, 390×718)
- **Background:** dark navy gradient (`#0F172B` → `#0F2050` / `#1D293D`) with several **blurred glow circles** (absolute, low-alpha blue/indigo) and 2 small solid accent dots.
- **Desktop:** 2-column. LEFT (`8:896`):
  - H1 "ExcelR's Placement Drive" (72px Poppins 700, white)
  - "For Java Full Stack" (48px) inside a highlighted pill/badge
  - **Accent underline bar** 260×4, blue gradient (`8:903`)
  - Paragraph (`8:905`): *"Connect with top tech companies, ace your interviews, and launch your career — all in one day at ExcelR's Marathalli Campus."* (18px Inter, light slate)
  - **"Register Now" gradient pill button** with arrow icon (`47:1423`, ~228×84)
  - RIGHT (`8:910`): hero **photo** of student w/ laptop (540×580) — `public/reg/hero-student.png` (transparent). A soft blue glow circle sits behind it. **"Absolutely FREE for All" badge** overlaps near the image — `public/reg/free-badge.png`.
- **Mobile:** same content stacked; H1 smaller; button full-width-ish (260×56); "Note: Candidates are requested to bring their own laptops…" appears under the button; FREE badge below.

### 3.3 Event Details + Register  (desktop `8:590`, 1920×874 · mobile `1:412`, 390×989)
Two-column grid on desktop (1152 wide), single column on mobile.

**LEFT — Event Details (`8:594`)**
- H2 "Event Details" (36px)
- Sub: *"An intensive placement drive designed to connect Java Full Stack talent with the Industry."*
- **5 detail rows** — each = 48×48 rounded icon chip (light-blue bg `#E8EDFF`, colored icon) + xs uppercase label + value:
  | Icon (lucide) | Label | Value |
  |---|---|---|
  | `Calendar` | DATE | 22nd August 2026 |
  | `Clock` | TIME | 9:00 AM Onwards |
  | `MapPin` | VENUE | ExcelR Marathahalli Campus — T-2 4th Floor, Raja Ikon Sy, No.89/1 Munnekolala, Village, Marathahalli – Sarjapur Outer Ring Rd, above Yes Bank, Marathahalli, Bengaluru, Karnataka 560037 |
  | `₹` (text glyph) | SALARY RANGE | Salary upto 10 LPA |
  | `Users` | WHO CAN APPLY | Freshers With Java Full Stack Knowledge |
- **Mobile only:** a "Register Now" CTA button appears at the bottom of this column (`39:1315`, 260×56) — because the form card is hidden on mobile.

**RIGHT — Registration form card (`8:641`, desktop only; mobile node `1:464` is `hidden`)**
- White `rounded-3xl` card, padding ~41px, soft shadow.
- Header: H2 "Register Now" (24px) + sub "To Secure Your Career" (slate).
- **Form fields** (label + input, each ~46px tall, rounded, 1px slate border, placeholder slate):
  1. **Full Name** — text — placeholder "Name" (mobile "Arjun Sharma")
  2. **Email Address** — email — placeholder "xyz@example.com"
  3. **Phone Number** — tel — placeholder "+91 00000 00000"
  4. **College / University** — text — placeholder "College Name"
  5. **Highest Qualification** — **select** — placeholder "Select qualification"
- **Submit:** full-width gradient pill button "Register for Free" + arrow icon (56px tall).
- Footer note: *"Note: Candidates are requested to bring their own laptops to complete the technical round."*

> Suggested qualification options (not explicit in Figma — confirm): B.E/B.Tech, B.Sc, BCA, M.E/M.Tech, M.Sc, MCA, Other.

### 3.4 FAQ  (desktop `8:685` · mobile `1:403`)
- Centered H2 "Frequently Asked Questions" (36px) + sub "Everything you need to know before you register."
- **Accordion** component (desktop 768 wide). The Figma uses an instance ("FAQ DESKTOP" / "FAq") — the individual Q/A text is inside that component; recommended questions (from the mobile render):
  1. Who is eligible to attend this placement drive?
  2. Is there any registration fee?
  3. What technologies will the interviews focus on?
  4. How many companies will be participating?
  5. Will I get an on-the-spot offer?
  6. What should I bring on the day?
  7. How will I receive the confirmation after registering?
  8. Can I attend if I am currently employed?
  - First item expanded by default; answer sample: *"The drive is open to all — freshers who have recently graduated and experienced professionals looking to switch into a Java Full Stack development role. …"* (confirm real copy with owner).

### 3.5 Footer  (desktop `8:694`, 1920×66 · mobile `1:686`)
- Thin top border. Left: "© 2026 PlaceDrive. All rights reserved." Right (desktop): "Marathalli Campus, Bangalore — 22 Aug 2026". Mobile: copyright centered.

---

## 4. Reusable components

```
components/reg/reg-navbar.tsx        # centered logo bar
components/reg/reg-hero.tsx          # navy gradient + glow blobs + copy + CTA + photo
components/reg/free-badge.tsx        # "Absolutely FREE for All" badge (img)
components/reg/glow-blobs.tsx        # decorative blurred circles (shared)
components/reg/gradient-button.tsx   # pill button + arrow (used 3x)
components/reg/event-detail-item.tsx # icon chip + label + value (used 5x)
components/reg/registration-form.tsx # RHF + zod, 5 fields + submit  (desktop; modal/section on mobile)
components/reg/reg-faq.tsx           # accordion
components/reg/reg-footer.tsx
components/reg/reg-landing.tsx       # composes all sections
app/reg/page.tsx                     # route entry
app/api/reg/route.ts                 # Sheets + nodemailer
lib/reg-content.ts                   # event details, FAQ, qualification options (single source of copy)
```

Responsive: `md` (768px) breakpoint. Details+form is 2-col on desktop, 1-col on mobile; hero 2-col → stacked; form card hidden on mobile (CTA instead).

---

## 5. Assets (already extracted → `public/reg/`)

| File | Source | Size | Use |
|---|---|---|---|
| `excelr-logo.png` | Figma raw (522×135) | crisp | navbar logo (both breakpoints) |
| `free-badge.png` | Figma raw (2481×834) | high-res | "Absolutely FREE for All" hero badge |
| `hero-student.png` | Figma raw (360×512, **transparent**) | small | hero photo — composites over navy |
| `hero-student-hires-blackbg.png` | Figma raw (2878×4096) | 12 MB | backup hi-res, **black bg** (needs bg removal if used) |

Glow blobs, underline bar, icon chips = pure CSS (no assets). Icons = lucide-react.

> Note: transparent hero is low-res (soft on large desktop). If crispness matters, background-remove the hi-res variant and replace `hero-student.png`.

---

## 6. Form backend — `app/api/reg/route.ts`

POST handler (Node runtime), server-only:
1. Validate body with the same zod schema as the client.
2. **Append to Google Sheet** via `googleapis` (service account): row = `[ISO timestamp, fullName, email, phone, college, qualification]`.
3. **Send email** via `nodemailer`: (a) admin notification to `REG_NOTIFY_TO`; (b) optional confirmation to applicant.
4. Return `{ ok: true }` → client shows success toast/state.

**Required env (server-only):**
```
GOOGLE_SHEETS_SPREADSHEET_ID=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=   # keep \n escaped; replace at runtime
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
REG_NOTIFY_TO=
```
Setup: create a Google Cloud service account, enable Sheets API, **share the target sheet with the service-account email as Editor**. Never import these on the client.

---

## 7. To confirm with the design owner
- Real FAQ question/answer copy (only partial text was readable from the render).
- Exact "Highest Qualification" dropdown options.
- Where the mobile "Register Now" CTA leads (scroll to a form section? open a modal? separate page?) — Figma hides the inline card but the target isn't defined.
- Confirmation-email content/branding.

---

## 8. Figma re-access (if you need to re-pull anything)
- MCP authenticated as `gohyacademytools@gmail.com`; file shared to it as **can edit** (view-only is NOT enough for the Figma MCP).
- Re-pull screenshot: `get_screenshot(fileKey=rK65fxnztDnrX2IIDmk2oM, nodeId=8-527 | 1-697)`.
- Re-pull assets: `download_assets(fileKey=…, nodeId=8-527)`.
- Tokens: `get_variable_defs(fileKey=…, nodeId=8-527)`.
