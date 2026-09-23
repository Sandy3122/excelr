# ExcelR Placement Drive — Registration & Automation System
### Project Proposal / Delivery Summary

**Prepared for:** ExcelR
**Project:** Java Full Stack Placement Drive — Registration Platform
**Status:** Built, tested, and deployed live

---

## Overview

A complete, production-ready registration platform built from scratch and delivered
under an urgent timeline. This is not a single form — it is four systems working
together: a public registration page, a WhatsApp OTP verification flow, a
password-protected admin dashboard, and an automated multi-channel messaging engine.

- **~12,800 lines of code** across **112 files**
- **Delivered in ~11 days** under client urgency
- **Fully deployed and live** on Vercel
- Built with Next.js 14, TypeScript, Tailwind CSS, Firebase Firestore, Infobip WhatsApp, and SparkPost email

---

## Features Delivered

### 1. Public Registration Page
- Custom responsive design built from the Figma spec (desktop + mobile)
- Registration form with full field validation (name, email, phone, qualification, college, and more)
- International phone-number validation and normalization to a clean, canonical format so WhatsApp and OTP delivery never fail on badly formatted numbers
- Hero section, event details, FAQ, and footer — all mobile-optimized
- "Register Now" smooth-scroll call-to-action for mobile
- Dedicated thank-you page after successful registration

### 2. WhatsApp OTP Verification
- OTP sent to the applicant's WhatsApp number before registration is allowed
- Blocks fake and spam entries — only verified numbers can register
- Integrated with the Infobip WhatsApp API
- **Security hardening:** OTPs are HMAC-hashed before storage, with expiry,
  resend cooldowns, per-user and per-IP rate limiting, and Redis-backed durable storage

### 3. Data Storage & Integrity
- All registrations stored securely in Firebase Firestore
- Duplicate prevention — blocks repeat registrations by both phone number and email
- Conflict handling for existing records
- Firestore security rules that deny all direct client access (server-only writes)

### 4. Email Notifications
- Automatic admin notification email for every new registration
- Branded HTML confirmation email sent to the applicant
- Professional email templates via SparkPost / Nodemailer

### 5. Admin Console (password-protected dashboard)
- Secure login with signed-cookie session management
- Leads table listing every registration
- Search, multi-select filtering (by qualification and college), and column sorting
- Cursor-based pagination for large lists
- One-click CSV export of all leads, with proper escaping and formatting so files open cleanly in Excel (no broken columns or mangled rows)
- Automation run history — sends grouped by day so admins can see exactly what went out and when
- Registration window control — open or close registrations on demand

### 6. Automated Messaging System
Four scheduled message types, all timed to Indian Standard Time, each personalized with the applicant's first name (e.g. "Hi Sandeep"):
1. **Welcome message** — on registration (WhatsApp + Email)
2. **"Things to carry" reminder** — one hour after registration
3. **Day-before event reminder** — WhatsApp + Email
4. **Event-day reminder** — the morning of the event

Plus:
- Batch sending (40 contacts at a time) that safely skips already-sent contacts
- Automatic retry logic for failed messages
- Per-contact delivery status tracking (WhatsApp + email)
- Downloadable per-message delivery reports

### 7. Integrations & Automation
- Vercel Cron for automatic scheduled sending
- Platform-constraint handling — engineered around Vercel's daily-cron limitation so scheduled messages still fire reliably (tested)
- n8n webhook integration on every new registration
- Secure server-side credential handling for all third-party services

### 8. Deployment, Testing & Setup
- Fully deployed and live on Vercel
- Environment configuration and secure secret management
- **18 automated test suites (vitest)** covering the whole system — OTP logic, phone validation, WhatsApp integration, admin authentication and sessions, lead filtering and sorting, CSV export, IST scheduling, the automation engine, cron limits, Firestore storage, and webhooks

---

## Why This Is More Than "Just a Form"

This project integrates **four external services** (Firestore, Infobip WhatsApp,
SparkPost email, n8n) and includes a full admin dashboard and a time-aware automated
messaging engine with retry and delivery tracking. Each of these is normally quoted
as a separate module. The work covers UI design, backend APIs, third-party
integration, security hardening, testing, and live deployment — all delivered on an
urgent timeline.

---

## Investment

**Project fee: ₹35,000 – ₹40,000**

This reflects a complete, working, deployed system — the integrations, security,
testing, and live deployment — not just the code. It remains below standard market
rates for equivalent full-stack integration work, offered in recognition of the
timeline and relationship.

---

*Delivered ready to run. Handover includes source code, environment setup, and deployment configuration.*
