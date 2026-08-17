# ExcelR Placement Drive — Registration Page

A standalone, public registration page for **ExcelR's Java Full Stack Placement Drive**,
built from `FIGMA_REG_PAGE_SPEC.md`. Next.js (App Router) + TypeScript + Tailwind CSS.
Form submissions verify WhatsApp OTP, persist to **Firestore**, send email via
Nodemailer, and optionally send a WhatsApp confirmation.

## Stack

- **Next.js 14 (App Router)** + React 18 + TypeScript
- **Tailwind CSS 3** — design tokens in `tailwind.config.ts`, `Poppins` + `Inter` via `next/font`
- **react-hook-form + zod** — client validation, re-validated server-side
- **lucide-react** — icons
- **nodemailer** — server route (`app/api/reg/route.ts`)
- **Firebase Admin / Firestore** — registration storage
- **Infobip WhatsApp** — OTP + registration confirmation

## Routes

| Route | Description |
|---|---|
| `/reg` | The public registration page (no app chrome). |
| `/` | Redirects to `/reg`. |
| `/admin` | Admin console (login required). Leads, automations, CSV export. |
| `/api/reg` (POST) | Validates → WhatsApp verify → **Firestore save** → emails + welcome WhatsApp. |
| `/api/reg` (GET) | Admin-only list/read of registrations (`Authorization: Bearer <REG_ADMIN_API_KEY>`). |
| `/api/cron/automations` | Vercel Cron (every 5 min, IST-aware). Things-to-carry + scheduled reminders. |

## Admin console & automations

Sign in at `/admin` with `ADMIN_PASSWORD` (or `REG_ADMIN_API_KEY`).

The console can:

- List leads and **download CSV**
- Show WhatsApp + email delivery status for each automation
- **Send pending** (or retry failed) in batches of 40 — safe to re-run; already-sent leads are skipped
- Download a per-automation delivery report

| # | Message | When (IST) | Channel |
|---|---------|------------|---------|
| 1 | Welcome | On form submit | WhatsApp + Email |
| 2 | Things to carry | 1 hour later (held 8:00 AM if overnight; stops 22 Aug 8:45 AM) | WhatsApp |
| 3 | Reminder — day before | Fri 21 Aug 2026, 12:00 PM | WhatsApp + Email |
| 4 | Reminder — event day | Sat 22 Aug 2026, 8:50 AM | WhatsApp |

Cron (`vercel.json`) hits `/api/cron/automations` every 5 minutes. Scheduled reminders do **not** send before their IST send-at time unless an admin clicks Send. Vercel Hobby only allows daily crons — use Pro for `*/5`, or trigger from `/admin` at the scheduled time.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values (see below)
npm run dev                  # http://localhost:3000/reg
```

The **UI works without any env vars** — only form submit (email + WhatsApp OTP) needs them.

## Environment variables

Copy `.env.example` → `.env.local` and fill in:

### SMTP (Nodemailer)
- `SMTP_HOST`, `SMTP_PORT` (587 STARTTLS / 465 TLS), `SMTP_USER`, `SMTP_PASS`
- `SMTP_FROM` — the From header.
- `REG_NOTIFY_TO` — inbox that receives the admin notification per registration.
- `REG_SEND_APPLICANT_CONFIRMATION=true` — also emails a confirmation to the applicant.

Email delivery is required for a successful registration response. WhatsApp
confirmation is best-effort and does not block the thank-you page.

### Firebase / Firestore
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` — Admin SDK
  (or place `serviceAccountKey.json` in the project root for local dev; it is gitignored).
- `REG_ADMIN_API_KEY` — required to call **GET** `/api/reg`.
- `ADMIN_PASSWORD` — password for `/admin` (falls back to `REG_ADMIN_API_KEY`).
- `ADMIN_SESSION_SECRET` — signs the admin cookie (falls back to `WHATSAPP_OTP_HASH_SECRET` / password).
- `CRON_SECRET` — Vercel Cron bearer token for `/api/cron/automations`.
- Optional `NEXT_PUBLIC_FIREBASE_*` — public `firebaseConfig` from the Firebase console.
  Client SDKs still cannot read or write data; `firestore.rules` denies all client access.

Deploy rules after creating the Firestore database:

```bash
firebase deploy --only firestore:rules
```

GET examples:

```bash
# List (newest first)
curl -H "Authorization: Bearer $REG_ADMIN_API_KEY" \
  "http://localhost:3000/api/reg?limit=50"

# Single record (document id = phone without leading +)
curl -H "Authorization: Bearer $REG_ADMIN_API_KEY" \
  "http://localhost:3000/api/reg?id=9198XXXXXXXXXX"
```

## Project structure

```
app/
  layout.tsx            # fonts + root html
  page.tsx              # redirect → /reg
  reg/page.tsx          # route entry (public, no chrome)
  api/reg/route.ts      # Firestore + Nodemailer + WhatsApp confirmation
components/reg/
  reg-landing.tsx       # composes all sections
  reg-navbar.tsx  reg-hero.tsx  glow-blobs.tsx  free-badge.tsx
  gradient-button.tsx   event-details.tsx  event-detail-item.tsx
  registration-form.tsx reg-faq.tsx  reg-footer.tsx
lib/
  firebase/             # Admin SDK, Firestore save/list, GET auth
  reg-content.ts        # single source of copy (event details, FAQ, options)
  reg-schema.ts         # shared zod schema (client + server)
public/reg/             # logo, hero photo, FREE badge
```

## Responsive behavior

- `md` (768px) breakpoint. Hero: 2-col desktop → stacked mobile.
- Event Details + form: 2-col desktop; on mobile the form appears below the details,
  and a "Register Now" CTA (in the details column) scrolls to it (`#register`).

## Open items to confirm with the design owner

These were flagged in the spec (§7) and use sensible placeholders for now — edit `lib/reg-content.ts`:

- **FAQ answer copy** — only questions were readable from Figma; answers are placeholders.
- **"Highest Qualification" options** — currently `B.E/B.Tech, B.Sc, BCA, M.E/M.Tech, M.Sc, MCA, Other`.
  (These are also the server-side allow-list in `lib/reg-schema.ts` — keep the two in sync.)
- **Mobile "Register Now" target** — implemented as a smooth-scroll to the form section.
- **Confirmation-email content/branding** — see `applicantHtml()` in `app/api/reg/route.ts`.

## Notes

- The transparent hero photo (`public/reg/hero-student.png`) is low-res; a hi-res
  black-bg backup (`hero-student-hires-blackbg.png`) is included if you want to
  background-remove and swap it in for crisper large-desktop rendering.
```
