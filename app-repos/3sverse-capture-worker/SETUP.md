# 3S Verse — Capture Worker (SETUP)

**Website contact + review submissions → stored in your ledger repo, forever.**
Developed by www.3SVerse.com

Right now contact/review submissions only arrive as EMAILS (FormSubmit).
This tiny Cloudflare worker stores EVERY submission as a JSON file in the
private `3SVerse_License_Server` repo — the same zero-cost GitHub database
that already stores orders, trials and activations — so you keep the full
history and can export it any time from License Studio → **Inbox →
Export All Data (CSV)**.

```
Website form → this worker → 1) ledger/captures/contacts|reviews/<id>.json  (storage, primary)
                           → 2) FormSubmit email copy                       (backup, best-effort)
```

## One-time setup (~10 minutes, no CLI)

1. **Create the worker**
   - dash.cloudflare.com → **Workers & Pages** → **Create application** →
     **Worker** → "Hello world" → **Edit code**.
   - Delete the sample code, paste the full contents of `worker.js`,
     press **Deploy**.

2. **Name it** (so the URL matches the website, which already points here)
   - Worker → **Settings** → **Change name** → `3sverse-capture`.
   - Final URL must be `https://3sverse-capture.abaduchanna.workers.dev`.

3. **Give it a GitHub token** (storage secret)
   - github.com → Settings → Developer settings → **Fine-grained tokens**
     → Generate new:
     - Repository access → **Only select repositories** →
       `3SVerse_License_Server`
     - Permissions → Repository permissions → **Contents: Read and write**
   - Worker → **Settings** → **Variables & Secrets** → **Add**:
     - Type **Secret**, name `GH_TOKEN`, value = the new token.

4. **Test it** (30 seconds):
   ```bash
   curl -X POST https://3sverse-capture.abaduchanna.workers.dev/contact \
     -H "Content-Type: application/json" \
     -d '{"name":"Self Test","email":"connect@3sverse.com","organization":"3SVerse","message":"SELF-TEST capture - safe to delete."}'
   ```
   Expect `{"ok":true,"id":"CT-..."}`. Check the ledger repo →
   `ledger/captures/contacts/` → the JSON is there. Delete it from
   License Studio → **Inbox** → select → **Delete Selected**.

5. **Done.** No website redeploy is needed — the site already tries this
   worker first and silently skips it while it is offline.

## What the website submits

- **Contact form**: name, email, organization, locations, interest, message
- **Review form**: name, email, store, tool, rating, review
- Honeypot fields reject bots; per-IP rate limit 8 / 15 min; CORS locked
  to `https://3sverse.com`.

## Where every piece of data lives (full picture)

| Data | Stored where | Seen in |
|------|--------------|---------|
| Orders | `ledger/orders_inbox/<ref>.json` (download-gateway worker) | Studio → Orders |
| Contact submissions | `ledger/captures/contacts/<id>.json` (this worker) | Studio → Inbox |
| Review submissions | `ledger/captures/reviews/<id>.json` (this worker) | Studio → Inbox |
| Trials | `ledger/trials/<machine>_<product>.json` (the apps) | ledger repo |
| Activations | `ledger/activations/<key>.json` (the apps) | ledger repo |

**Backup habit**: once a month (or before any big change) open License
Studio → Inbox → **Export All Data (CSV)** — it writes
`3sverse-orders-<date>.csv`, `3sverse-contacts-<date>.csv` and
`3sverse-reviews-<date>.csv` to any folder you pick.
