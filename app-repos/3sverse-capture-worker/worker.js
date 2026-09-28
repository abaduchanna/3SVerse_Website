/**
 * 3S Verse — Capture Worker
 * Developed by www.3SVerse.com
 *
 * Files every website CONTACT + REVIEW submission into the private
 * license ledger repo (GitHub Contents API) so no lead or review is
 * ever lost to an inbox, and forwards an email copy via FormSubmit as
 * a backup channel. Data capture happens FIRST; the email is
 * best-effort and never blocks the 200.
 *
 *   POST /contact  { name, email, organization?, locations?, interest?,
 *                    message, website? (honeypot), turnstileToken? }
 *   POST /review   { name, email, store?, tool?, rating?, review,
 *                    website?/_honey? (honeypot) }
 *   GET  /         info page
 *
 * Ledger layout (repo: abaduchanna/3SVerse_License_Server):
 *   ledger/captures/contacts/CT-<ts36>-<rand>.json
 *   ledger/captures/reviews /RV-<ts36>-<rand>.json
 * The seller reads these live in License Studio → Inbox tab and exports
 * everything (orders + contacts + reviews) as CSV from the same tab.
 *
 * Required secret (dashboard → Settings → Variables & Secrets):
 *   GH_TOKEN   fine-grained PAT scoped to ONLY the ledger repo with
 *              "Contents: Read and write"  (see GITHUB_TOKEN_SETUP.md)
 * Optional:
 *   CONTACT_TO   inbox for the email copy (default Connect@3SVerse.com)
 *
 * Setup guide: SETUP.md (10 minutes, no CLI needed).
 */

const GITHUB_REPO = "abaduchanna/3SVerse_License_Server";
const GITHUB_API = "https://api.github.com";
const FORMSUBMIT = "https://formsubmit.co/ajax/";
const DEFAULT_INBOX = "Connect@3SVerse.com";

const CORS = {
  "Access-Control-Allow-Origin": "https://3sverse.com",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const json = (status, payload) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...CORS,
    },
  });

const readText = (v, max) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

// Best-effort per-isolate rate limit (per IP): 8 submissions / 15 min.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_WINDOW = 8;
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

async function fileToLedger(token, kind, id, rec) {
  const dir = kind === "contact"
    ? "ledger/captures/contacts"
    : "ledger/captures/reviews";
  const path = `repos/${GITHUB_REPO}/contents/${dir}/${id}.json`;
  const res = await fetch(`${GITHUB_API}/${path}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "3sverse-capture-worker",
    },
    body: JSON.stringify({
      message: `capture ${kind} ${id}`,
      content: btoa(unescape(encodeURIComponent(JSON.stringify(rec, null, 2)))),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`github ${res.status} ${body.slice(0, 200)}`);
  }
}

async function emailCopy(kind, rec, replyTo) {
  const to = DEFAULT_INBOX;
  const subject = kind === "contact"
    ? `New website inquiry — ${rec.name}${rec.organization ? ` (${rec.organization})` : ""}`
    : `New dealer review — ${rec.tool || "site"} — ${rec.store || ""} — ${rec.rating || ""}`;
  const fields = {
    _subject: subject.replace(/[\r\n]+/g, " "),
    _template: "table",
    _captcha: "false",
    _replyto: replyTo,
    ...rec,
  };
  try {
    await fetch(`${FORMSUBMIT}${to}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(fields),
    });
  } catch {
    /* email is the backup channel — ledger already has the record */
  }
}

const rand = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(4)),
    (b) => b.toString(16).padStart(2, "0")).join("");

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    if (request.method === "GET") {
      return new Response(
        `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f3f8;padding:40px;text-align:center;">
<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e6e4ee;border-radius:12px;padding:32px;">
<h1 style="margin:0 0 8px;font-size:20px;">3S Verse — Capture</h1>
<p style="color:#6b6880;font-size:14px;line-height:1.6;">Website form intake for
<a href="https://3sverse.com" style="color:#0e7c8c;">3sverse.com</a>.
Contact and review submissions are stored in the 3S Verse ledger and emailed to the seller.</p>
<p style="color:#6b6880;font-size:12px;">Routes: POST /contact · POST /review</p>
</div></body></html>`,
        { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
      );
    }

    if (request.method !== "POST") return json(405, { ok: false, error: "Method not allowed." });

    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    if (rateLimited(ip)) return json(429, { ok: false, error: "Too many submissions — please try again later." });

    let body;
    try {
      body = await request.json();
    } catch {
      return json(400, { ok: false, error: "Invalid request body." });
    }

    if (readText(body.website, 200) || readText(body._honey, 200)) {
      return json(400, { ok: false, error: "Unable to process this submission." });
    }

    const kind = url.pathname.replace(/\/+$/, "").split("/").pop();
    if (kind !== "contact" && kind !== "review") {
      return json(404, { ok: false, error: "Unknown route." });
    }

    const name = readText(body.name, 120);
    const email = readText(body.email, 254);
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json(400, { ok: false, error: "Name and a valid email are required." });
    }

    let rec;
    if (kind === "contact") {
      const message = readText(body.message, 5000);
      if (!message) return json(400, { ok: false, error: "Message is required." });
      rec = {
        kind, createdAt: new Date().toISOString(),
        name, email,
        organization: readText(body.organization, 160),
        locations: readText(body.locations, 80),
        interest: readText(body.interest, 160),
        message,
      };
    } else {
      const review = readText(body.review, 4000) || readText(body.text, 4000);
      if (!review) return json(400, { ok: false, error: "Review text is required." });
      const rating = readText(body.rating, 16) || "5 / 5";
      if (!/^[1-5]\s*\/\s*5$/.test(rating)) {
        return json(400, { ok: false, error: "Invalid rating." });
      }
      rec = {
        kind, createdAt: new Date().toISOString(),
        name, email,
        store: readText(body.store, 160),
        tool: readText(body.tool, 80) || "not specified",
        rating, review, published: false,
      };
    }

    const token = env.GH_TOKEN;
    if (!token) {
      return json(503, { ok: false, error: "Capture storage is not configured yet." });
    }

    const id = `${kind === "contact" ? "CT" : "RV"}-${Date.now().toString(36)}-${rand()}`;
    rec.id = id;

    try {
      await fileToLedger(token, kind, id, rec);
    } catch (err) {
      return json(502, { ok: false, error: "Could not store the submission — please email Connect@3SVerse.com directly." });
    }

    // Backup channel only — never blocks the success response.
    await emailCopy(kind, rec, email);
    return json(200, { ok: true, id });
  },
};
