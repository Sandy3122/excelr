# ExcelR Placement Drive — Registration Page

A standalone, public registration page for **ExcelR's Java Full Stack Placement Drive**,
built from `FIGMA_REG_PAGE_SPEC.md`. Next.js (App Router) + TypeScript + Tailwind CSS.
Form submissions verify WhatsApp OTP, send email via Nodemailer, and optionally
send a WhatsApp confirmation.

## Stack

- **Next.js 14 (App Router)** + React 18 + TypeScript
- **Tailwind CSS 3** — design tokens in `tailwind.config.ts`, `Poppins` + `Inter` via `next/font`
- **react-hook-form + zod** — client validation, re-validated server-side
- **lucide-react** — icons
- **nodemailer** — server route (`app/api/reg/route.ts`)
- **Infobip WhatsApp** — OTP + registration confirmation

## Routes

| Route | Description |
|---|---|
| `/reg` | The public registration page (no app chrome). |
| `/` | Redirects to `/reg`. |
| `/api/reg` (POST) | Validates → requires WhatsApp verify → sends emails. |

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

## Project structure

```
app/
  layout.tsx            # fonts + root html
  page.tsx              # redirect → /reg
  reg/page.tsx          # route entry (public, no chrome)
  api/reg/route.ts      # Nodemailer + WhatsApp confirmation POST handler
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
