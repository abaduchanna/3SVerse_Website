// Netlify Function — POST /api/review
//
// Dealer review intake — the review box in the #reviews section of the
// landing page posts here FIRST (same origin, no CORS). Every valid
// review is SAVED to the Netlify Blobs store "review-inbox" (one JSON
// doc per submission) so the seller can pull the full history from the
// /admin console (Reviews tab + CSV/JSON export) — previously reviews
// existed ONLY as emails via the CF-worker relay, with no stored copy.
//
// The old chain (worker /contact → FormSubmit → mailto) stays wired in
// the frontend as the FALLBACK path, so a review is never lost even if
// this function is unreachable.
//
// Zero npm dependencies beyond @netlify/blobs (kept external by the
// Netlify bundler).
//
// Optional environment variables:
//   CONTACT_TO       — inbox that receives review alerts (default Connect@3SVerse.com)
//   RESEND_API_KEY   — when set, a "new review" email is sent (best effort)
//   RESEND_FROM      — verified From identity
//   TURNSTILE_SECRET — server-side Turnstile check when set (unset →
//                      honeypot + rate limit only, same policy as contact)

import { getStore } from "@netlify/blobs";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_REVIEWS_PER_WINDOW = 3;

const SELLER_EMAIL = resolveEnv("CONTACT_TO") ?? "Connect@3SVerse.com";
const RESEND_FROM =
  resolveEnv("RESEND_FROM") ?? "3S Verse Website <connect@3sverse.com>";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const requestTimestamps = new Map<string, number[]>();

function resolveEnv(name: string): string | undefined {
  const exact = process.env[name];
  if (exact) return exact;
  const target = name.toLowerCase();
  for (const key of Object.keys(process.env)) {
    if (key.toLowerCase() === target) return process.env[key];
  }
  return undefined;
}

function json(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function clientKey(req: Request): string {
  return (
    req.headers.get("x-nf-client-connection-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

function rateLimitRetryAfter(key: string): number | null {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  for (const [mapKey, timestamps] of requestTimestamps) {
    const recent = timestamps.filter((t) => t > windowStart);
    if (recent.length === 0) {
      requestTimestamps.delete(mapKey);
    } else {
      requestTimestamps.set(mapKey, recent);
    }
  }
  const timestamps = requestTimestamps.get(key) ?? [];
  if (timestamps.length >= MAX_REVIEWS_PER_WINDOW) {
    return Math.max(
      1,
      Math.ceil((timestamps[0] + RATE_LIMIT_WINDOW_MS - now) / 1000),
    );
  }
  timestamps.push(now);
  requestTimestamps.set(key, timestamps);
  return null;
}

function readText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

type ReviewBody = {
  name?: unknown;
  email?: unknown;
  store?: unknown;
  tool?: unknown;
  rating?: unknown;
  review?: unknown;
  text?: unknown;
  website?: unknown;
  _honey?: unknown;
  turnstileToken?: unknown;
  "cf-turnstile-response"?: unknown;
};

function reviewInbox() {
  return getStore("review-inbox");
}

/** Optional server-side Turnstile check (same policy as contact.mts). */
async function turnstileRejectReason(token: string): Promise<string | null> {
  const secret = resolveEnv("TURNSTILE_SECRET");
  if (!secret) return null;
  if (!token) return "complete the verification box first";
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
      signal: AbortSignal.timeout(8_000),
    });
    const data = (await res.json().catch(() => null)) as { success?: boolean } | null;
    if (data?.success) return null;
    return "verification failed — please retry the checkbox";
  } catch {
    return null; // fail open — honeypot + rate limit still apply
  }
}

function reviewEmailHtml(rec: {
  id: string;
  name: string;
  email: string;
  store: string;
  tool: string;
  rating: string;
  review: string;
}): string {
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px">
      <h2 style="margin:0 0 4px">New dealer review ${rec.id}</h2>
      <p style="margin:0 0 16px;color:#555">
        <strong>${rec.name}</strong> &lt;${rec.email}&gt; · ${rec.store}<br/>
        Tool: ${rec.tool} · Rating: ${rec.rating}
      </p>
      <blockquote style="margin:0;padding:12px 16px;border-left:3px solid #ddd;color:#333">
        ${rec.review.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>")}
      </blockquote>
      <p style="color:#555">Verify it against the license records, then publish
      first name + store/city in <code>catalog.ts → REVIEWS</code> (deploys live in ~1 min).</p>
    </div>`;
}

async function emailSeller(rec: {
  id: string;
  name: string;
  email: string;
  store: string;
  tool: string;
  rating: string;
  review: string;
}): Promise<boolean> {
  const apiKey = resolveEnv("RESEND_API_KEY");
  if (!apiKey) return false;
  const send = async (fromAddress: string) =>
    fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [SELLER_EMAIL],
        reply_to: rec.email,
        subject: `New dealer review — ${rec.tool} — ${rec.store} — ${rec.rating}`,
        html: reviewEmailHtml(rec),
      }),
    }).then((r) => r.status);
  let status = await send(RESEND_FROM);
  if (status >= 400) status = await send("onboarding@resend.dev");
  if (status >= 400) {
    console.error(`[review] seller email failed — status=${status}`);
    return false;
  }
  return true;
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed." });
  }

  let body: ReviewBody;
  try {
    body = (await req.json()) as ReviewBody;
  } catch {
    return json(400, { ok: false, error: "Invalid request body." });
  }

  // Honeypots (both spellings the two forms used over time) must be empty.
  if (readText(body.website, 200) || readText(body._honey, 200)) {
    return json(400, { ok: false, error: "Unable to process this submission." });
  }

  const name = readText(body.name, 120);
  const email = readText(body.email, 254).toLowerCase();
  const store = readText(body.store, 160);
  const tool = readText(body.tool, 80);
  const rating = readText(body.rating, 16);
  const review = readText(body.review, 4000) || readText(body.text, 4000);

  if (!name || !email || !store || !review) {
    return json(400, {
      ok: false,
      error: "Name, email, store, and review text are required.",
    });
  }
  if (!emailPattern.test(email)) {
    return json(400, { ok: false, error: "A valid email address is required." });
  }
  if (!/^[1-5]\s*\/\s*5$/.test(rating || "5 / 5")) {
    // The form always sends "N / 5"; anything else is tampering.
    return json(400, { ok: false, error: "Invalid rating." });
  }

  const turnstileToken =
    readText(body.turnstileToken, 2048) ||
    readText(body["cf-turnstile-response"], 2048);
  const turnstileReject = await turnstileRejectReason(turnstileToken);
  if (turnstileReject) {
    return json(400, { ok: false, error: turnstileReject });
  }

  const retryAfter = rateLimitRetryAfter(clientKey(req));
  if (retryAfter !== null) {
    return json(
      429,
      { ok: false, error: "Too many reviews — please try again later." },
    );
  }

  const rec = {
    kind: "review",
    id: `rv-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`,
    createdAt: new Date().toISOString(),
    name,
    email,
    store,
    tool: tool || "not specified",
    rating: rating || "5 / 5",
    review,
    published: false,
  };

  try {
    await reviewInbox().setJSON(rec.id, rec);
  } catch (err) {
    console.error(`[review] inbox save failed — ${String(err).slice(0, 300)}`);
    return json(503, {
      ok: false,
      error: "Could not save the review — please try again in a minute.",
    });
  }

  const emailed = await emailSeller(rec);
  return json(200, {
    ok: true,
    id: rec.id,
    emailHint: emailed ? undefined : "stored — seller email not configured",
  });
};

export const config = { path: "/api/review" };
