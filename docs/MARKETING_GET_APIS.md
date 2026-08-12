# Registration GET APIs (Marketing)

**Base URL:** `https://excelr-placement-drive.vercel.app`

Set your Admin API key once:

```bash
export REG_ADMIN_API_KEY='paste-the-key-here'
```

Every request needs this header:

```text
Authorization: Bearer $REG_ADMIN_API_KEY
```

---

## 1. Get first page of registrations

**What it does:** Returns the latest registrations (default 50, max 100). Newest first.

```bash
curl -sS "https://excelr-placement-drive.vercel.app/api/reg?limit=50" \
  -H "Authorization: Bearer $REG_ADMIN_API_KEY"
```

---

## 2. Get next page of registrations

**What it does:** Returns the next batch after the first page.  
Copy `nextCursor` from the previous response and pass it as `cursor`.

```bash
curl -sS "https://excelr-placement-drive.vercel.app/api/reg?limit=50&cursor=NEXT_CURSOR_HERE" \
  -H "Authorization: Bearer $REG_ADMIN_API_KEY"
```

Repeat until `nextCursor` is `null` — that means there are no more records.

---

## 3. Get one registration by ID

**What it does:** Returns a single lead.  
`id` = phone number without `+` (example: `+919876543210` → `919876543210`).

```bash
curl -sS "https://excelr-placement-drive.vercel.app/api/reg?id=919876543210" \
  -H "Authorization: Bearer $REG_ADMIN_API_KEY"
```
