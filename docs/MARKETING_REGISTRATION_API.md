# Placement Drive — Registration API Guide

**Audience:** Marketing / ops team  
**Live registration page:** https://excelr-placement-drive.vercel.app/reg  
**API base URL:** https://excelr-placement-drive.vercel.app

This document explains how to **read registration leads** from the live API (and briefly how new submissions work). Ask the engineering team for the **Admin API key** — do not share it publicly or put it in emails/Slack channels that are widely visible.

---

## Quick start (marketing)

1. Get the **Admin API key** from engineering (`REG_ADMIN_API_KEY`).
2. Open a terminal (Mac: Terminal / iTerm).
3. Set the key once in that terminal session:

```bash
export REG_ADMIN_API_KEY='paste-the-key-here'
```

4. Fetch the latest registrations:

```bash
curl -sS "https://excelr-placement-drive.vercel.app/api/reg?limit=50" \
  -H "Authorization: Bearer $REG_ADMIN_API_KEY"
```

5. If the response includes `"nextCursor": "..."`, fetch the next page (see [Pagination](#pagination--more-than-50-records) below).

---

## Authentication (required for reading data)

All **GET** requests must include the Admin API key.

**Option A (recommended):**

```text
Authorization: Bearer <REG_ADMIN_API_KEY>
```

**Option B:**

```text
x-admin-key: <REG_ADMIN_API_KEY>
```

| Status | Meaning |
|--------|---------|
| `401` | Missing or wrong API key |
| `200` | Success |

Without a valid key you cannot list or download registrations.

---

## 1. List registrations (GET)

Returns registrations **newest first**.

### Request

```bash
curl -sS "https://excelr-placement-drive.vercel.app/api/reg?limit=50" \
  -H "Authorization: Bearer $REG_ADMIN_API_KEY"
```

### Query parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `limit` | No | `50` | How many records per page (min `1`, max `100`) |
| `cursor` | No | — | Pass `nextCursor` from the previous response to get the next page |
| `id` | No | — | If set, returns a **single** registration instead of a list (see below) |

### Success response (list)

```json
{
  "ok": true,
  "registrations": [
    {
      "id": "919876543210",
      "fullName": "Ada Lovelace",
      "email": "ada@example.com",
      "emailLower": "ada@example.com",
      "phone": "+919876543210",
      "college": "Example College",
      "qualification": "B.E / B.Tech",
      "pageUrl": "https://excelr-placement-drive.vercel.app/reg?utm_source=instagram",
      "submittedAtIso": "2026-08-13T00:00:00.000Z",
      "event": "java-fullstack-placement-drive",
      "submittedAt": "2026-08-13T00:00:00.000Z",
      "createdAt": "2026-08-13T00:00:00.000Z",
      "updatedAt": null
    }
  ],
  "nextCursor": "9198XXXXXXXXXX"
}
```

If there are no more pages, `nextCursor` is `null`.

### Field meanings (for exports / CRM)

| Field | What it is |
|-------|------------|
| `id` | Unique record id (WhatsApp number without `+`, e.g. `919876543210`) |
| `fullName` | Candidate name |
| `email` | Email as entered |
| `phone` | WhatsApp number in international form (`+91…`) |
| `college` | College / university |
| `qualification` | Highest qualification selected on the form |
| `pageUrl` | Exact page URL when they registered (includes UTM / campaign query params if present) |
| `submittedAt` / `submittedAtIso` | When they registered (UTC / ISO timestamp) |
| `event` | Always `java-fullstack-placement-drive` for this campaign |

**Tip:** Use `pageUrl` to attribute leads to campaigns (Instagram, Google Ads, email, etc.).

---

## Pagination — more than 50 records

The API returns at most **100** records per request (`limit` max = 100). Default is **50**.

### Page 1

```bash
curl -sS "https://excelr-placement-drive.vercel.app/api/reg?limit=50" \
  -H "Authorization: Bearer $REG_ADMIN_API_KEY"
```

Look at the response for `"nextCursor"`.

### Page 2

Replace `CURSOR_FROM_PAGE_1` with the exact `nextCursor` value from page 1:

```bash
curl -sS "https://excelr-placement-drive.vercel.app/api/reg?limit=50&cursor=CURSOR_FROM_PAGE_1" \
  -H "Authorization: Bearer $REG_ADMIN_API_KEY"
```

### Page 3 and beyond

Repeat: take the new `nextCursor` from each response and pass it as `cursor` until:

```json
"nextCursor": null
```

That means you have all records.

### Larger pages (optional)

```bash
curl -sS "https://excelr-placement-drive.vercel.app/api/reg?limit=100" \
  -H "Authorization: Bearer $REG_ADMIN_API_KEY"
```

---

## 2. Get one registration by ID (GET)

Useful when you already know the phone / id.

The `id` is the phone **without** the leading `+`.  
Example: phone `+919876543210` → id `919876543210`.

```bash
curl -sS "https://excelr-placement-drive.vercel.app/api/reg?id=919876543210" \
  -H "Authorization: Bearer $REG_ADMIN_API_KEY"
```

### Success

```json
{
  "ok": true,
  "registration": {
    "id": "919876543210",
    "fullName": "Ada Lovelace",
    "email": "ada@example.com",
    "phone": "+919876543210",
    "college": "Example College",
    "qualification": "B.E / B.Tech",
    "pageUrl": "https://excelr-placement-drive.vercel.app/reg",
    "submittedAtIso": "2026-08-13T00:00:00.000Z",
    "event": "java-fullstack-placement-drive",
    "submittedAt": "2026-08-13T00:00:00.000Z",
    "createdAt": "2026-08-13T00:00:00.000Z",
    "updatedAt": null
  }
}
```

### Not found

```json
{ "ok": false, "error": "Registration not found." }
```

HTTP status: `404`

---

## 3. Submit a registration (POST) — for reference

Candidates normally register on the **website form**. Marketing usually does **not** need to call this API.

The public form flow is:

1. User fills the form on `/reg`
2. WhatsApp OTP verification
3. Server saves the lead to the database, sends confirmation email, and (best-effort) WhatsApp confirmation

### Endpoint

`POST https://excelr-placement-drive.vercel.app/api/reg`

### Body fields

| Field | Required | Notes |
|-------|----------|--------|
| `fullName` | Yes | 2–80 characters |
| `email` | Yes | Valid email |
| `phone` | Yes | 10-digit Indian mobile (no `+91` in this field) |
| `college` | Yes | College / university |
| `qualification` | Yes | Must be one of the allowed values below |
| `pageUrl` | Yes | Full URL of the page where they submitted |

### Allowed `qualification` values

- `B.E / B.Tech`
- `B.Sc`
- `BCA`
- `M.E / M.Tech`
- `M.Sc`
- `MCA`
- `Other`

### Example (will fail without prior WhatsApp OTP verify)

```bash
curl -sS -X POST "https://excelr-placement-drive.vercel.app/api/reg" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Ada Lovelace",
    "email": "ada@example.com",
    "phone": "9876543210",
    "college": "Example College",
    "qualification": "B.E / B.Tech",
    "pageUrl": "https://excelr-placement-drive.vercel.app/reg"
  }'
```

### Common POST responses

| Status | Meaning |
|--------|---------|
| `200` `{ "ok": true }` | Registered successfully |
| `400` | Invalid / incomplete form data |
| `403` | WhatsApp number not verified via OTP |
| `409` | Email or phone already registered (with a different pairing) |
| `500` | Temporary server / email / storage issue — user can retry |

---

## Pretty-print JSON in Terminal (optional)

If responses look hard to read:

```bash
curl -sS "https://excelr-placement-drive.vercel.app/api/reg?limit=50" \
  -H "Authorization: Bearer $REG_ADMIN_API_KEY" | python3 -m json.tool
```

---

## Save all pages to a file (optional)

This loop downloads every page into one JSON array (Mac / Linux):

```bash
export REG_ADMIN_API_KEY='paste-the-key-here'
OUT=registrations.json
echo '[]' > "$OUT"
CURSOR=""
while true; do
  if [ -z "$CURSOR" ]; then
    URL="https://excelr-placement-drive.vercel.app/api/reg?limit=100"
  else
    URL="https://excelr-placement-drive.vercel.app/api/reg?limit=100&cursor=$CURSOR"
  fi
  RESP=$(curl -sS "$URL" -H "Authorization: Bearer $REG_ADMIN_API_KEY")
  echo "$RESP" | python3 -c "
import json,sys
data=json.load(sys.stdin)
regs=data.get('registrations') or []
print(len(regs), data.get('nextCursor'))
open('/tmp/_page.json','w').write(json.dumps(regs))
open('/tmp/_cursor.txt','w').write(data.get('nextCursor') or '')
"
  python3 -c "
import json
all_regs=json.load(open('$OUT'))
page=json.load(open('/tmp/_page.json'))
all_regs.extend(page)
json.dump(all_regs, open('$OUT','w'), indent=2)
print('total', len(all_regs))
"
  CURSOR=$(cat /tmp/_cursor.txt)
  [ -z "$CURSOR" ] && break
done
echo "Saved to $OUT"
```

---

## Security & sharing rules

- Treat the Admin API key like a password.
- Do **not** post the key in public Slack channels, Notion pages, or WhatsApp groups.
- Do **not** share raw API responses with personal emails/phones outside the team without approval.
- Prefer exporting only the fields you need for campaigns (name, email, phone, college, UTMs from `pageUrl`).

---

## Support

- **Registration page issues / form bugs:** Engineering  
- **API key rotation / access:** Engineering  
- **Lead quality / campaign UTMs:** Marketing (ensure campaign links include UTM params on `/reg`, e.g. `?utm_source=instagram&utm_campaign=aug_drive`)

**Canonical live URL:** https://excelr-placement-drive.vercel.app/reg
