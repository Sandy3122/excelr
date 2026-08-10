# ExcelR Placement Drive — Registration Page

A standalone, public registration page for **ExcelR's Java Full Stack Placement Drive**,
built from `FIGMA_REG_PAGE_SPEC.md`. Next.js (App Router) + TypeScript + Tailwind CSS.
Form submissions append a row to Google Sheets and send email via Nodemailer.

## Stack

- **Next.js 14 (App Router)** + React 18 + TypeScript
- **Tailwind CSS 3** — design tokens in `tailwind.config.ts`, `Poppins` + `Inter` via `next/font`
- **react-hook-form + zod** — client validation, re-validated server-side
- **lucide-react** — icons
- **googleapis + nodemailer** — server route (`app/api/reg/route.ts`)

## Routes

| Route | Description |
|---|---|
| `/reg` | The public registration page (no app chrome). |
| `/` | Redirects to `/reg`. |
| `/api/reg` (POST) | Validates → appends to Google Sheets → sends emails. |

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values (see below)
npm run dev                  # http://localhost:3000/reg
```

The **UI works without any env vars** — only the form's submit (Sheets + email) needs them.

## Environment variables

Copy `.env.example` → `.env.local` and fill in:

### Google Sheets (service account)
1. Create a Google Cloud project → **enable the Google Sheets API**.
2. Create a **service account**, generate a **JSON key**.
3. **Share the target spreadsheet** with the service account's email (`GOOGLE_SERVICE_ACCOUNT_EMAIL`) as **Editor**.
4. Set:
   - `GOOGLE_SHEETS_SPREADSHEET_ID` — the ID from the sheet URL.
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` — paste the full key; keep `\n` escaped (converted at runtime).
   - `GOOGLE_SHEETS_SHEET_NAME` — tab name (defaults to `Registrations`).

The appended row is: `[ISO timestamp, fullName, email, phone, college, qualification]`.
Add a header row to the sheet if you like — new rows are appended after existing content.

### SMTP (Nodemailer)
- `SMTP_HOST`, `SMTP_PORT` (587 STARTTLS / 465 TLS), `SMTP_USER`, `SMTP_PASS`
- `SMTP_FROM` — the From header.
- `REG_NOTIFY_TO` — inbox that receives the admin notification per registration.
- `REG_SEND_APPLICANT_CONFIRMATION=true` — also emails a confirmation to the applicant.

> Sheets append is treated as the source of truth: if it fails the API returns 500.
> Email is best-effort — a mail failure is logged but still returns success (the row is saved).

## Project structure

```
app/
  layout.tsx            # fonts + root html
  page.tsx              # redirect → /reg
  reg/page.tsx          # route entry (public, no chrome)
  api/reg/route.ts      # Sheets + nodemailer POST handler
components/reg/
  reg-landing.tsx       # composes all sections
  reg-navbar.tsx  reg-hero.tsx  glow-blobs.tsx  free-badge.tsx
  gradient-button.tsx   event-details.tsx  event-detail-item.tsx
  registration-form.tsx reg-faq.tsx  reg-footer.tsx
lib/
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
