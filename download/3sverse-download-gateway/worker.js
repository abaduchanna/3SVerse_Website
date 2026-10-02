/**
 * 3S Verse — Download Gateway (Cloudflare Worker)
 * ================================================
 * Serves the FULL (paid) Windows builds ONLY to customers whose order
 * number is present and active in the license ledger. The FULL builds
 * live in PRIVATE GitHub repos and are NEVER publicly downloadable —
 * this worker is the single gate in front of them.
 *
 *   GET /download?order=3SV-XXXXXXXX&product=extractor|ordering|rebate
 *   GET /download?order=3SV-XXXXXXXX&product=bundle   → HTML page with
 *                                                       one button per
 *                                                       covered tool
 *   POST /order   → order intake: the website POSTs the customer's
 *                   order here and the worker files it into the ledger
 *                   repo (ledger/orders_inbox/<ref>.json) so the
 *                   License Studio "Orders" tab can pick it up
 *   GET /         → info page
 *
 * HOW A REQUEST IS HANDLED
 *   1. Normalize the order number (trim + uppercase).
 *   2. Load ledger/orders.json from the PRIVATE 3SVerse_License_Server
 *      repo through the GitHub Contents API (in-memory cache, 5 min).
 *   3. Validate: order exists → status "active" → package not expired
 *      ("expiry" model must have expires >= today) → requested product is
 *      covered by the package (bundle covers all three tools).
 *   4. Stream the current release asset of the private build repo straight
 *      to the customer (Content-Disposition: attachment). The customer
 *      ALWAYS gets the newest build — nothing to re-upload, ever.
 *
 * SETUP (summary — full walkthrough in README.md)
 *   Secrets (Worker → Settings → Variables):
 *     GH_TOKEN            fine-grained PAT, Contents: Read-only on
 *                         3SVerse_License_Server, VidaPay_Incentive_Extractor,
 *                         VidaPay_Device_Ordering, VidaPay_Rebate_Filing
 *     LEDGER_WRITE_TOKEN  fine-grained PAT, Contents: Read+Write on
 *                         3SVerse_License_Server ONLY (the Studio
 *                         admin token works) — used by POST /order to
 *                         file orders into the inbox
 *   Variables (plain text):
 *     LEDGER_REPO   "abaduchanna/3SVerse_License_Server"
 *     LEDGER_PATH   "ledger/orders.json"
 *     OWNER         "abaduchanna"
 *   Then paste this worker's URL into the website config:
 *     artifacts/landing-page/src/lib/catalog.ts → PAID_DOWNLOAD.gatewayUrl
 *
 * Revoking a customer: set "status": "revoked" (or expire the package) in
 * ledger/orders.json — their download gate closes within 5 minutes.
 *
 * Developed by www.3SVerse.com (c) 2026
 */

const OWNER_DEFAULT = "abaduchanna";
const LEDGER_REPO_DEFAULT = "abaduchanna/3SVerse_License_Server";
const LEDGER_PATH_DEFAULT = "ledger/orders.json";
const INBOX_DIR_DEFAULT = "ledger/orders_inbox";
const CACHE_SECONDS = 300;

/* ----------------------- customer invoice email ------------------------
   The moment an order is filed into the ledger inbox, the worker emails
   the CUSTOMER a complete invoice (order lines, total, payment terms and
   the EULA / Terms / Privacy / Refund links) through EmailJS's REST API.

   Enable by adding these Worker variables/secret-free public IDs (the
   EmailJS public key is safe by design):
     EMAILJS_SERVICE_ID   service_xxxxxxx
     EMAILJS_TEMPLATE_ID  template_xxxxx (must render {{invoice_html}}
                          with TRIPLE braces — see EMAILJS_SETUP.md)
     EMAILJS_PUBLIC_KEY   the EmailJS account public key
   While any of them is missing the email silently skips and the /order
   response reports invoiceEmailed:false — the website then falls back to
   its client-side EmailJS copy, so invoices never double-send. */
const EMAILJS_SEND_URL = "https://api.emailjs.com/api/v1.0/email/send";

const MODEL_LABELS = {
  trial: "7-Day Free Trial",
  monthly: "Monthly",
  annual: "Annual",
  lifetime: "Lifetime",
};

function escHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function invoiceNumberFromRef(ref) {
  return "INV-" + String(ref || "").toUpperCase().replace(/^3SV-/, "");
}

function buildInvoiceHtml(order) {
  const itemRows = (order.items || [])
    .map((it) => {
      const name = PRODUCT_NAMES[it.productId] || it.productId;
      const label = MODEL_LABELS[it.model] || it.model;
      const detail =
        it.productId === "bundle"
          ? `${escHtml(label)} · ${it.pcs} PC${it.pcs === 1 ? "" : "s"} — 2 licenses of each tool (6 total)`
          : `${escHtml(label)} · ${it.pcs} PC${it.pcs === 1 ? "" : "s"}`;
      return `<tr>
  <td style="padding:10px 0;border-bottom:1px solid #e6e4ee;font-size:14px;color:#16151d;">${escHtml(name)}<div style="font-size:12px;color:#6b6880;margin-top:2px;">${detail}</div></td>
  <td style="padding:10px 0;border-bottom:1px solid #e6e4ee;text-align:center;font-size:13px;color:#16151d;">${Number(it.qty) || 1}</td>
</tr>`;
    })
    .join("");
  return `<div style="background:#f4f3f8;padding:20px 10px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e6e4ee;border-top:3px solid #0e7c8c;border-radius:6px;">
<tr><td style="padding:22px 28px;">
  <table role="presentation" width="100%"><tr>
    <td><img src="https://3sverse.com/logo.png" alt="3S Verse" height="40" style="height:40px;width:auto;display:block;border:0;outline:none;" /><div style="font-size:10px;color:#6b6880;letter-spacing:.2em;text-transform:uppercase;margin-top:6px;">Dealer Automation Tools</div></td>
    <td style="text-align:right;"><div style="font-size:18px;font-weight:700;color:#16151d;">INVOICE</div><div style="font-size:11px;color:#b45309;font-weight:700;">PAYMENT DUE</div></td>
  </tr></table>
  <div style="height:1px;background:#e6e4ee;margin:14px 0;"></div>
  <table role="presentation" width="100%"><tr>
    <td style="font-size:12px;color:#6b6880;line-height:1.8;">
      Invoice no: <strong style="color:#16151d;">${escHtml(invoiceNumberFromRef(order.ref))}</strong><br/>
      Order ref: <strong style="color:#16151d;">${escHtml(order.ref)}</strong><br/>
      Date: ${escHtml(new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }))}<br/>
      Pay by: ${escHtml(new Date(Date.now() + 7 * 86400000).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }))} (auto-cancels after)
    </td>
    <td style="text-align:right;font-size:12px;color:#6b6880;line-height:1.8;">
      Bill to:<br/><strong style="color:#16151d;font-size:13px;">${escHtml(order.customer && order.customer.name)}</strong><br/>
      ${escHtml(order.customer && order.customer.company)}${order.customer && order.customer.company ? "<br/>" : ""}${escHtml(order.customer && order.customer.email)}
    </td>
  </tr></table>
  <table role="presentation" width="100%" style="margin-top:14px;">
    <tr>
      <th align="left" style="padding:8px 0;border-bottom:2px solid #16151d;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#6b6880;">Description</th>
      <th align="center" style="padding:8px 0;border-bottom:2px solid #16151d;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#6b6880;">Qty</th>
    </tr>
    ${itemRows}
  </table>
  <table role="presentation" width="100%" style="margin-top:12px;"><tr>
    <td style="font-size:12px;color:#6b6880;">Payment: bank transfer · Wise · PayPal · USDT</td>
    <td style="text-align:right;font-size:15px;font-weight:800;color:#16151d;">Total: ${escHtml(order.totalLabel || "")}</td>
  </tr></table>
  <div style="height:1px;background:#e6e4ee;margin:16px 0 12px;"></div>
  <div style="font-size:11.5px;line-height:1.7;color:#6b6880;">
    <strong style="color:#16151d;">What happens next:</strong> reply to this email with your payment receipt and order
    reference ${escHtml(order.ref)} — license keys and download links are delivered right after payment is confirmed.
    Monthly/annual plans renew until cancelled; reply anytime to cancel or switch to lifetime.
    <br/><br/>
    <strong style="color:#16151d;">Terms &amp; license:</strong> by paying this invoice the customer accepts the
    <a href="https://3sverse.com/#/eula" style="color:#0e7c8c;">End-User License Agreement</a> and the
    <a href="https://3sverse.com/#/terms" style="color:#0e7c8c;">Terms &amp; Conditions</a>. Licenses are per-PC,
    non-exclusive and non-transferable; keys activate on first run on the registered PC(s). Licenses are
    non-refundable once activated — genuine defects are made right (see the
    <a href="https://3sverse.com/#/refund" style="color:#0e7c8c;">Refund Policy</a>). Customer details are
    processed as described in the <a href="https://3sverse.com/#/privacy" style="color:#0e7c8c;">Privacy Policy</a>.
    Issued electronically by 3S Verse (3sverse.com · Connect@3SVerse.com) — valid without a signature.
  </div>
</td></tr></table></div>`;
}

async function sendCustomerInvoice(env, order, htmlOverride = null) {
  const serviceId = env.EMAILJS_SERVICE_ID;
  const templateId = env.EMAILJS_TEMPLATE_ID;
  const publicKey = env.EMAILJS_PUBLIC_KEY;
  if (!serviceId || !templateId || !publicKey) return false;
  if (!order.customer || !order.customer.email) return false;
  try {
    const res = await fetch(EMAILJS_SEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        /* EmailJS API sits behind Cloudflare bot rules: server-side calls
           (this Worker) must look like a browser session or they get 403
           code 1010. These three headers are the proven pass. */
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Origin": "https://dashboard.emailjs.com",
        "Referer": "https://dashboard.emailjs.com/",
      },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        /* Server-side REST calls authenticate with the private key
           (accessToken). The public key alone is only for the browser SDK. */
        ...(env.EMAILJS_PRIVATE_KEY ? { accessToken: env.EMAILJS_PRIVATE_KEY } : {}),
        template_params: {
          to_email: order.customer.email,
          customer_name: order.customer.name || "",
          invoice_no: invoiceNumberFromRef(order.ref),
          order_ref: order.ref,
          total_label: order.totalLabel || "",
          invoice_html: htmlOverride || buildInvoiceHtml(order),
        },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/* Trial builds live in the PUBLIC 3sverse-downloads repo (GitHub serves
   them directly). The /trial route puts the same Turnstile gate in front
   of those public links so scrapers/bots cannot hammer them at scale. */
const TRIAL_DOWNLOADS_BASE =
  "https://github.com/abaduchanna/3sverse-downloads/releases/latest/download/";
const TRIAL_ASSETS = {
  extractor: "VidaPay_Incentive_Extractor_TRIAL.exe",
  ordering: "VidaPay_Device_Ordering_TRIAL.exe",
  rebate: "VidaPay_Rebate_Filing_TRIAL.exe",
};

/* --------------------------- Turnstile (bot gate) -----------------------
   Add these in Worker → Settings → Variables to switch the protection on:
     TURNSTILE_SITE_KEY   (plain text, from the CF dashboard widget)
     TURNSTILE_SECRET_KEY (secret, from the same widget)
   While either is missing the worker behaves exactly like the previous
   version (no challenge) so the rollout can be staged. */
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function turnstileConfigured(env) {
  return Boolean(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY);
}

async function verifyTurnstile(env, token, ip) {
  if (!turnstileConfigured(env)) return true; // protection not switched on
  if (!token) return false;
  const body = new URLSearchParams({
    secret: env.TURNSTILE_SECRET_KEY,
    response: token,
  });
  if (ip && ip !== "unknown") body.set("remoteip", ip);
  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: String(body),
    });
    const data = await res.json();
    return Boolean(data.success);
  } catch {
    return false; // fail closed when the gate is on
  }
}

/* Challenge page: renders the widget, and on success re-requests the same
   URL with &ct=<token> so the worker can verify it server-side. */
function challengePage(request, env, nextUrl) {
  if (!turnstileConfigured(env)) {
    // Unreachable in normal flow (verify passes when unconfigured) — kept
    // as a safe fallback so a relative nextUrl can never hit Response.redirect.
    return errorPage(500, "Download gate is not configured yet.");
  }
  const siteKey = env.TURNSTILE_SITE_KEY;
  const sep = nextUrl.includes("?") ? "&" : "?";
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<link rel="icon" href="https://3sverse.com/favicon.ico?v=2">` +
    `<title>3S Verse — quick check</title>` +
    `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer><\/script>` +
    `</head><body style="font-family:Arial,sans-serif;background:#f4f3f8;padding:40px;text-align:center;">` +
    `<div style="max-width:420px;margin:60px auto 0;background:#fff;border:1px solid #e6e4ee;border-radius:12px;padding:36px;">` +
    `<h1 style="margin:0 0 8px;font-size:19px;">Quick security check</h1>` +
    `<p style="color:#6b6880;font-size:13px;line-height:1.6;margin:0 0 20px;">This one-click check keeps downloads fast and bot-free for everyone.</p>` +
    `<div id="tsbox" style="display:flex;justify-content:center;"></div>` +
    `<p id="tserr" style="color:#b91c1c;font-size:12px;display:none;">Check failed — please try again.</p>` +
    `<p style="color:#6b6880;font-size:12px;margin-top:18px;">3S Verse · Connect@3SVerse.com</p>` +
    `</div>` +
    `<script>
      function _onToken(token){
        window.location.href = ${JSON.stringify(nextUrl + sep + "ct=")} + encodeURIComponent(token);
      }
      window._tsOnToken = _onToken;
      window.onload = function(){
        function render(){
          if (!window.turnstile){ setTimeout(render, 200); return; }
          try {
            turnstile.render("#tsbox", { sitekey: ${JSON.stringify(siteKey)}, callback: _onToken, "error-callback": function(){ document.getElementById("tserr").style.display="block"; } });
          } catch(e){ document.getElementById("tserr").style.display="block"; }
        }
        render();
      };
    <\/script>` +
    `</body></html>`;
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/* Order intake + contact relay rate limit (per IP): 5 orders / 15 min,
   10 contact posts / 15 min. */
const INBOX_WINDOW_MS = 15 * 60 * 1000;
const INBOX_MAX_PER_WINDOW = 5;
const CONTACT_WINDOW_MS = 15 * 60 * 1000;
const CONTACT_MAX_PER_WINDOW = 10;
const hitWindows = new Map(); // "kind:ip" → [timestamps]

function rateLimited(kind, ip, windowMs, maxPerWindow) {
  const now = Date.now();
  const k = kind + ":" + ip;
  const recent = (hitWindows.get(k) || []).filter((t) => now - t < windowMs);
  if (recent.length >= maxPerWindow) {
    hitWindows.set(k, recent);
    return true;
  }
  recent.push(now);
  hitWindows.set(k, recent);
  return false;
}

function inboxIp(request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/* product → private repo + release asset name (the FULL builds).
   "bundle" is expanded to all three products at validation time. */
const ASSET_MAP = {
  extractor: { repo: "VidaPay_Incentive_Extractor", asset: "VidaPay_Incentive_Extractor_FULL.exe" },
  ordering: { repo: "VidaPay_Device_Ordering", asset: "VidaPay_Device_Ordering_FULL.exe" },
  rebate: { repo: "VidaPay_Rebate_Filing", asset: "VidaPay_Rebate_Filing_FULL.exe" },
};
const PRODUCT_NAMES = {
  extractor: "VidaPay Incentive Extractor",
  ordering: "VidaPay Device Ordering",
  rebate: "VidaPay Rebate Filing",
  bundle: "VidaPay Full Bundle",
};
const ALL_PRODUCTS = Object.keys(ASSET_MAP);

/* ------------------------- tiny in-memory cache ------------------------- */
const cache = new Map(); // key → { at, data }

async function cached(key, loader) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_SECONDS * 1000) return hit.data;
  const data = await loader();
  cache.set(key, { at: Date.now(), data });
  return data;
}

/* ------------------------------ GitHub I/O ------------------------------ */
function ghHeaders(token, octetStream = false) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: octetStream
      ? "application/octet-stream"
      : "application/vnd.github+json",
    "User-Agent": "3sverse-download-gateway",
  };
}

async function loadLedger(env) {
  const repo = env.LEDGER_REPO || LEDGER_REPO_DEFAULT;
  const path = env.LEDGER_PATH || LEDGER_PATH_DEFAULT;
  return cached(`ledger:${repo}:${path}`, async () => {
    const url = `https://api.github.com/repos/${repo}/contents/${path}?ref=main`;
    const res = await fetch(url, { headers: ghHeaders(env.GH_TOKEN) });
    if (res.status === 404) return {};
    if (!res.ok) throw new Error(`ledger HTTP ${res.status}`);
    const meta = await res.json();
    const content = atob((meta.content || "").replace(/\s/g, ""));
    const bytes = Uint8Array.from(content, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  });
}

async function findAsset(env, repo, assetName) {
  const owner = env.OWNER || OWNER_DEFAULT;
  return cached(`release:${repo}`, async () => {
    const url = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
    const res = await fetch(url, { headers: ghHeaders(env.GH_TOKEN) });
    if (!res.ok) throw new Error(`release HTTP ${res.status} for ${repo}`);
    const rel = await res.json();
    const asset = (rel.assets || []).find((a) => a.name === assetName);
    if (!asset) throw new Error(`asset ${assetName} not found in ${repo} ${rel.tag_name}`);
    return { id: asset.id, name: asset.name, size: asset.size, tag: rel.tag_name };
  });
}

/* ------------------------------ validation ------------------------------ */
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function expandProducts(order) {
  const owned = Array.isArray(order.products) ? order.products : [];
  if (owned.includes("bundle")) return ALL_PRODUCTS.slice();
  return owned.filter((p) => ALL_PRODUCTS.includes(p));
}

/* ---------------------------- order intake ----------------------------- */
function corsHeaders(request) {
  const origin = request.headers.get("origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonCors(request, status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...corsHeaders(request),
    },
  });
}

function readText(v, max) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

const INBOX_PRODUCTS = { extractor: 1, ordering: 1, rebate: 1, bundle: 1 };
const INBOX_MODELS = { trial: 1, monthly: 1, annual: 1, lifetime: 1 };

function sanitizeInboxOrder(body) {
  const ref = readText(body.ref, 24).toUpperCase();
  if (!/^3SV-[A-Z0-9]{4,12}$/.test(ref)) return { error: "Bad order reference." };
  const name = readText(body.name, 120);
  const email = readText(body.email, 254).toLowerCase();
  if (!name) return { error: "Name is required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "A valid email is required." };
  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length < 1 || rawItems.length > 10) return { error: "Order must contain 1-10 items." };
  const items = [];
  for (const it of rawItems) {
    const productId = readText(it?.productId, 40);
    const model = readText(it?.model, 16);
    const pcs = Number(it?.pcs);
    const qty = Math.max(1, Math.min(10, Number(it?.qty) || 1));
    if (!INBOX_PRODUCTS[productId]) return { error: "Unknown product." };
    if (!INBOX_MODELS[model]) return { error: "Unknown billing model." };
    if (!Number.isInteger(pcs) || pcs < 1 || pcs > 50) return { error: "Bad PC count." };
    /* Bundle deal: every bundle line ships 2 licenses of EACH tool (6 keys
       to issue). Recorded on the order so License Studio shows the rule. */
    items.push({ productId, model, pcs, qty, ...(productId === "bundle" ? { bundleEach: 2 } : {}) });
  }
  const total = Number(body.total);
  return {
    order: {
      ref,
      status: "pending",
      createdAt: new Date().toISOString(),
      customer: {
        name,
        email,
        company: readText(body.company, 160),
        messenger: readText(body.messenger, 120),
        notes: readText(body.notes, 1000),
      },
      items,
      totalLabel: readText(body.totalLabel, 32) ||
        (Number.isFinite(total) ? `$${total.toFixed(2)}` : ""),
      source: "3sverse.com",
    },
  };
}

async function handleOrderPost(request, env) {
  if (!env.LEDGER_WRITE_TOKEN) {
    return jsonCors(request, 503, { ok: false, error: "Order intake is not configured yet (missing LEDGER_WRITE_TOKEN)." });
  }
  const ip = inboxIp(request);
  if (rateLimited("order", ip, INBOX_WINDOW_MS, INBOX_MAX_PER_WINDOW)) {
    return jsonCors(request, 429, { ok: false, error: "Too many orders — please try again later." });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonCors(request, 400, { ok: false, error: "Invalid request body." });
  }
  if (!(await verifyTurnstile(env, body.turnstileToken, ip))) {
    return jsonCors(request, 403, { ok: false, error: "Security check failed or missing — please retry the order." });
  }
  const clean = sanitizeInboxOrder(body);
  if (clean.error) return jsonCors(request, 400, { ok: false, error: clean.error });
  const order = clean.order;
  const repo = env.LEDGER_REPO || LEDGER_REPO_DEFAULT;
  const dir = env.INBOX_DIR || INBOX_DIR_DEFAULT;
  const url = `https://api.github.com/repos/${repo}/contents/${dir}/${order.ref}.json`;
  const put = async (payload) =>
    fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${env.LEDGER_WRITE_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "3sverse-download-gateway",
      },
      body: JSON.stringify(payload),
    });
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(order, null, 2))));
  let res = await put({
    message: `order inbox ${order.ref}`,
    content,
  });
  if (res.status === 422) {
    return jsonCors(request, 409, { ok: false, error: "This order reference was already received." });
  }
  if (res.status >= 400) {
    return jsonCors(request, 502, { ok: false, error: `Could not file the order (GitHub ${res.status}).` });
  }
  // Order is safely in the ledger — now email the customer their invoice.
  // Best-effort and non-blocking for the response body: a slow mail relay
  // never turns a filed order into an error for the buyer.
  const invoiceNo = invoiceNumberFromRef(order.ref);
  const invoiceEmailed = await sendCustomerInvoice(env, order);
  if (!invoiceEmailed) {
    /* Flag the failure on the ledger order itself so the /ops dashboard
       shows a "mail fail" chip — best effort, never blocks the response. */
    try {
      const gRes = await fetch(url, { headers: ghHeaders(env.LEDGER_WRITE_TOKEN) });
      if (gRes.ok) {
        const meta = await gRes.json();
        const rec = JSON.parse(
          new TextDecoder().decode(
            Uint8Array.from(atob(String(meta.content || "").replace(/\s/g, "")), (c) => c.charCodeAt(0)),
          ),
        );
        rec.invoiceEmailed = false;
        await put({
          message: `order ${order.ref} — invoice email failed (flagged by gateway)`,
          content: btoa(unescape(encodeURIComponent(JSON.stringify(rec, null, 2)))),
          sha: meta.sha,
        });
      }
    } catch {
      /* best effort */
    }
  }
  return jsonCors(request, 200, { ok: true, ref: order.ref, invoiceNo, invoiceEmailed });
}

function validate(ledger, orderNo, product) {
  if (!orderNo || !/^3SV-/.test(orderNo)) {
    return { ok: false, status: 400, message: "Order number must look like 3SV-… (see your invoice)." };
  }
  const order = ledger[orderNo];
  if (!order) {
    return { ok: false, status: 403, message: "Order number not found. Check your invoice or contact Connect@3SVerse.com." };
  }
  if (order.status === "revoked") {
    return { ok: false, status: 403, message: "This license has been revoked. Contact Connect@3SVerse.com if you believe this is a mistake." };
  }
  if (order.status !== "active") {
    return { ok: false, status: 403, message: "This order is not active yet. If you just paid, give us a few hours to activate it." };
  }
  if (order.model === "expiry") {
    const exp = String(order.expires || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(exp) || exp < todayISO()) {
      return { ok: false, status: 403, message: "Your 1-year package has expired — renew to keep downloading updates." };
    }
  }
  const owned = expandProducts(order);
  if (product === "bundle") {
    if (!owned.length) {
      return { ok: false, status: 403, message: "This order does not cover any downloadable tool." };
    }
    return { ok: true, products: owned };
  }
  if (!owned.includes(product)) {
    return { ok: false, status: 403, message: `This order does not include ${PRODUCT_NAMES[product] || product}.` };
  }
  return { ok: true, products: [product] };
}

/* -------------------------------- pages -------------------------------- */
function infoPage() {
  return new Response(
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><link rel="icon" href="https://3sverse.com/favicon.ico?v=2"><title>3S Verse — Downloads</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f3f8;padding:40px;text-align:center;">
<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e6e4ee;border-radius:12px;padding:32px;">
<h1 style="margin:0 0 8px;font-size:20px;">3S Verse — Customer Downloads</h1>
<p style="color:#6b6880;font-size:14px;line-height:1.6;">Use the <strong>order number from your invoice</strong> on
<a href="https://3sverse.com" style="color:#0e7c8c;">3sverse.com</a> to download your software.
Free trials are available on the site without any sign-in.</p>
<p style="color:#6b6880;font-size:12px;">Routes: /download?order=…&product=… · /trial?product=… · POST /order · POST /contact</p>
<p style="color:#6b6880;font-size:12px;">Support: Connect@3SVerse.com</p>
</div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

function bundlePage(orderNo, products) {
  const buttons = products
    .map(
      (p) =>
        `<a href="/download?order=${encodeURIComponent(orderNo)}&product=${p}" ` +
        `style="display:block;margin:10px auto;max-width:420px;padding:14px 18px;background:#0e7c8c;color:#fff;` +
        `border-radius:10px;text-decoration:none;font-weight:600;">${PRODUCT_NAMES[p]} — download (.exe)</a>`,
    )
    .join("\n");
  return new Response(
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><link rel="icon" href="https://3sverse.com/favicon.ico?v=2"><title>3S Verse — Your downloads</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f3f8;padding:40px;text-align:center;">
<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e6e4ee;border-radius:12px;padding:32px;">
<h1 style="margin:0 0 6px;font-size:20px;">Order ${orderNo} — your software</h1>
<p style="color:#6b6880;font-size:13px;margin:0 0 18px;">Bundle license — every tool below is included. Always the newest build.</p>
${buttons}
<p style="color:#6b6880;font-size:12px;">Keys activate on first run on the registered PC(s).</p>
</div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

function errorPage(status, message) {
  return new Response(
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><link rel="icon" href="https://3sverse.com/favicon.ico?v=2"><title>3S Verse — Download</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f3f8;padding:40px;text-align:center;">
<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #fecaca;border-radius:12px;padding:32px;">
<h1 style="margin:0 0 8px;font-size:20px;color:#b91c1c;">Download unavailable</h1>
<p style="color:#6b6880;font-size:14px;line-height:1.6;">${message}</p>
<p style="color:#6b6880;font-size:12px;">3S Verse · Connect@3SVerse.com</p>
</div></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

/* ------------------------------ ops dashboard ---------------------------
   Private operator view of EVERYTHING the ledger holds, fully online:
     ledger/orders_inbox/*.json  — orders filed live by this gateway
     ledger/activations/*.json   — licenses issued by License Studio
   /ops serves a key-gated shell page; the shell calls /ops/data with the
   ops key (x-ops-key header) and joins orders ↔ licenses so each order
   shows which license it received, when it was issued and when it
   expires. No local files, no CSV clicks. Set the OPS_KEY variable. */
const ACTIVATIONS_DIR_DEFAULT = "ledger/activations";
const opsCache = new Map();

async function opsCached(key, loader) {
  const hit = opsCache.get(key);
  if (hit && Date.now() - hit.at < 45000) return hit.data;
  const data = await loader();
  opsCache.set(key, { at: Date.now(), data });
  return data;
}

async function opsLoadDir(env, dir) {
  const repo = env.LEDGER_REPO || LEDGER_REPO_DEFAULT;
  return opsCached("ops:" + dir, async () => {
    const listUrl = `https://api.github.com/repos/${repo}/contents/${dir}?ref=main`;
    const res = await fetch(listUrl, { headers: ghHeaders(env.GH_TOKEN) });
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`GitHub HTTP ${res.status} (${dir})`);
    const items = await res.json();
    const out = [];
    for (const item of Array.isArray(items) ? items : []) {
      const name = String(item.name || "");
      if (!name.endsWith(".json")) continue;
      try {
        const fUrl = `https://api.github.com/repos/${repo}/contents/${dir}/${name}?ref=main`;
        const fRes = await fetch(fUrl, { headers: ghHeaders(env.GH_TOKEN) });
        if (!fRes.ok) continue;
        const meta = await fRes.json();
        const rec = JSON.parse(
          new TextDecoder().decode(
            Uint8Array.from(atob(String(meta.content || "").replace(/\s/g, "")), (c) => c.charCodeAt(0)),
          ),
        );
        if (rec && typeof rec === "object") out.push(rec);
      } catch {
        /* skip unreadable file */
      }
    }
    return out;
  });
}

function opsKeyOk(request, url, env) {
  const expected = String(env.OPS_KEY || "");
  if (!expected) return false;
  const given =
    request.headers.get("x-ops-key") || url.searchParams.get("key") || "";
  if (!given || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

/* ------------------ ops: ledger write proxy (Studio) --------------------
   The License Studio talks to the private ledger THROUGH this worker so
   the PC app never needs a GitHub PAT of its own: GitHub tokens expire
   (fine-grained ones MUST), and every expiry used to brick the Studio
   until a full rebuild. The only long-lived client credential is
   LEDGER_PROXY_KEY - a random string WE control, it never expires - and
   the GitHub token lives server-side where it rotates with one secret
   update, no app rebuild.

   GET    /ops/ledger?path=ledger/activations/KEY.json → {ok, kind:"file", data, sha}
   GET    /ops/ledger?path=ledger/activations          → {ok, kind:"dir", items:[…]}
   GET    /ops/ledger?path=ledger/gone.json            → {ok, kind:"missing"}
   PUT    /ops/ledger?path=…  body {data, sha?, message} → {ok, sha}  (create/update)
   DELETE /ops/ledger?path=…  body {sha, message}        → {ok}         (remove)

   Auth: x-lkey header = LEDGER_PROXY_KEY (constant-time compare). Paths
   are hard-scoped to ledger/…json (no .., no backslash, json only).
*/
function ledgerKeyOk(request, env) {
  const expected = String(env.LEDGER_PROXY_KEY || "");
  if (!expected) return false;
  const given = request.headers.get("x-lkey") || "";
  if (!given || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

function ledgerSafePath(raw) {
  const p = String(raw || "").trim().replace(/^\/+/, "");
  if (!p.startsWith("ledger/")) return null;
  if (p.includes("..") || p.includes("\\") || p.includes("//")) return null;
  if (!/^[A-Za-z0-9._\-/]+$/.test(p)) return null;
  return p;
}

function ledgerToken(env) {
  return String(env.LEDGER_WRITE_TOKEN || "").trim();
}

function b64Utf8(s) {
  const bytes = new TextEncoder().encode(String(s));
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

async function handleOpsLedger(request, env, url) {
  const json = (status, obj) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  if (!env.LEDGER_PROXY_KEY) {
    return json(503, { ok: false, error: "LEDGER_PROXY_KEY is not configured on this worker yet." });
  }
  if (!ledgerKeyOk(request, env)) {
    // Brute-force guard only punishes BAD keys; valid traffic is never throttled.
    if (rateLimited("lkeyauth", inboxIp(request), 10 * 60 * 1000, 30)) {
      return json(429, { ok: false, error: "Too many attempts — try again later." });
    }
    return json(403, { ok: false, error: "Invalid ledger proxy key." });
  }
  const tok = ledgerToken(env);
  if (!tok) return json(503, { ok: false, error: "No ledger GitHub token on this worker." });
  const repo = env.LEDGER_REPO || LEDGER_REPO_DEFAULT;
  const path = ledgerSafePath(url.searchParams.get("path"));
  if (!path) return json(400, { ok: false, error: "Bad path (ledger/*.json only)." });

  try {
    if (request.method === "GET") {
      const res = await fetch(
        `https://api.github.com/repos/${repo}/contents/${path}?ref=main`,
        { headers: ghHeaders(tok) },
      );
      if (res.status === 404) return json(200, { ok: true, kind: "missing" });
      if (!res.ok) return json(502, { ok: false, error: `GitHub HTTP ${res.status}` });
      const body = await res.json();
      if (Array.isArray(body)) {
        return json(200, {
          ok: true,
          kind: "dir",
          items: body.map((it) => ({
            name: it.name, sha: it.sha, type: it.type, size: it.size,
          })),
        });
      }
      let data = null;
      try {
        data = JSON.parse(new TextDecoder().decode(
          Uint8Array.from(atob(String(body.content || "").replace(/\s/g, "")), (c) => c.charCodeAt(0)),
        ));
      } catch { data = null; }
      return json(200, { ok: true, kind: "file", data, sha: body.sha });
    }

    if (request.method === "PUT" || request.method === "DELETE") {
      let req = {};
      try { req = await request.json(); } catch { req = {}; }
      const ghBody = {
        message: String(req.message || `${request.method === "PUT" ? "update" : "remove"} ${path}`)
          .replace(/[\r\n]+/g, " ").slice(0, 200),
      };
      if (request.method === "PUT") {
        if (req.data === undefined || req.data === null) {
          return json(400, { ok: false, error: "Missing data." });
        }
        ghBody.content = b64Utf8(JSON.stringify(req.data, null, 2));
        if (req.sha) ghBody.sha = String(req.sha);
      } else {
        if (!req.sha) return json(400, { ok: false, error: "Missing sha for delete." });
        ghBody.sha = String(req.sha);
      }
      const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
        method: request.method,
        headers: ghHeaders(tok),
        body: JSON.stringify(ghBody),
      });
      if (res.status === 404) return json(200, { ok: false, ghStatus: 404, error: "GitHub HTTP 404" });
      if (res.status === 409 || res.status === 422) {
        return json(200, { ok: false, ghStatus: res.status, error: `GitHub HTTP ${res.status}` });
      }
      if (!res.ok) return json(200, { ok: false, ghStatus: res.status, error: `GitHub HTTP ${res.status}` });
      const body = await res.json();
      return json(200, { ok: true, sha: body && body.content ? body.content.sha : "" });
    }
    return json(405, { ok: false, error: "Method not allowed." });
  } catch (e) {
    return json(502, { ok: false, error: String((e && e.message) || e) });
  }
}

async function handleOpsData(request, env, url) {
  const json = (status, obj) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  if (!env.OPS_KEY) {
    return json(503, { ok: false, error: "OPS_KEY is not configured on this worker yet." });
  }
  if (rateLimited("opsauth", inboxIp(request), 10 * 60 * 1000, 30)) {
    return json(429, { ok: false, error: "Too many attempts — try again later." });
  }
  if (!opsKeyOk(request, url, env)) {
    return json(403, { ok: false, error: "Invalid ops key." });
  }
  if (!env.GH_TOKEN) {
    return json(503, { ok: false, error: "GH_TOKEN missing on this worker." });
  }
  try {
    const [orders, licenses] = await Promise.all([
      opsLoadDir(env, env.INBOX_DIR || INBOX_DIR_DEFAULT),
      opsLoadDir(env, env.ACTIVATIONS_DIR || ACTIVATIONS_DIR_DEFAULT),
    ]);
    return json(200, {
      ok: true,
      generatedAt: new Date().toISOString(),
      orders,
      licenses,
    });
  } catch (e) {
    return json(502, { ok: false, error: String((e && e.message) || e) });
  }
}

/* ------------------ ops: .lic build + mail (v2 ops) ---------------------
   GET  /ops/lic?license_id=VP3S-…  → signed .lic file download (x-ops-key).
   POST /ops/maillic {license_id}   → email the key + .lic content to the
   linked order's customer (same EmailJS relay as the invoice).
   The .lic payload is rebuilt from the live ledger record and its Ed25519
   signature is VERIFIED against the seller-published public keys
   (ledger/config.json) in both machine-pinned and unpinned variants — the
   variant that verifies is the one served, so pinned keys (issue-time
   "machine" field) and legacy-pointer records both come out byte-correct. */
const pubKeyCache = { at: 0, keys: [] };

function hexToBytes(h) {
  const s = String(h || "").replace(/[^0-9a-fA-F]/g, "");
  const out = new Uint8Array(Math.floor(s.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.substr(i * 2, 2), 16);
  return out;
}

async function sellerPubKeys(env) {
  if (pubKeyCache.keys.length && Date.now() - pubKeyCache.at < 600000) {
    return pubKeyCache.keys;
  }
  const repo = env.LEDGER_REPO || LEDGER_REPO_DEFAULT;
  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/ledger/config.json?ref=main`,
    { headers: ghHeaders(env.GH_TOKEN) },
  );
  if (!res.ok) throw new Error(`seller keys HTTP ${res.status}`);
  const meta = await res.json();
  const cfg = JSON.parse(
    new TextDecoder().decode(
      Uint8Array.from(atob(String(meta.content || "").replace(/\s/g, "")), (c) => c.charCodeAt(0)),
    ),
  );
  pubKeyCache.keys = (cfg.pub_keys || []).map(hexToBytes).filter((k) => k.length === 32);
  pubKeyCache.at = Date.now();
  return pubKeyCache.keys;
}

function licensePayload(rec, withMachine) {
  const p = {
    license_id: String(rec.license_id || "").trim(),
    customer: String(rec.customer || ""),
    products: Array.isArray(rec.products) ? rec.products.slice() : [],
    model: String(rec.model || "lifetime"),
    max_seats: Math.max(1, parseInt(rec.max_seats, 10) || 1),
    issued_at: String(rec.issued_at || ""),
  };
  if (withMachine && rec.mid_code) p.machine = String(rec.mid_code);
  if (p.model === "expiry") p.expires = String(rec.expires || "");
  const sorted = {};
  for (const k of Object.keys(p).sort()) sorted[k] = p[k];
  return sorted;
}

async function sigVerifyOk(pubBytes, sigBytes, msgBytes) {
  try {
    const key = await crypto.subtle.importKey(
      "raw", pubBytes, { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify({ name: "Ed25519" }, key, sigBytes, msgBytes);
  } catch {
    return false;
  }
}

async function fetchActivationRecord(env, key) {
  const repo = env.LEDGER_REPO || LEDGER_REPO_DEFAULT;
  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/ledger/activations/${encodeURIComponent(key)}.json?ref=main`,
    { headers: ghHeaders(env.GH_TOKEN) },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub HTTP ${res.status}`);
  const meta = await res.json();
  return JSON.parse(
    new TextDecoder().decode(
      Uint8Array.from(atob(String(meta.content || "").replace(/\s/g, "")), (c) => c.charCodeAt(0)),
    ),
  );
}

async function buildLicFile(env, rec) {
  const pubs = await sellerPubKeys(env);
  if (!(pubs || []).length) {
    throw new Error("No seller public keys published (ledger/config.json).");
  }
  const sigB64 = String(rec.lic_sig || "");
  const sigBytes = Uint8Array.from(atob(sigB64), (c) => c.charCodeAt(0));
  for (const withMachine of [false, true]) {
    const payload = licensePayload(rec, withMachine);
    const msg = new TextEncoder().encode(JSON.stringify(payload));
    for (const pub of pubs) {
      if (await sigVerifyOk(pub, sigBytes, msg)) {
        return Object.assign({}, payload, { sig: sigB64 });
      }
    }
  }
  throw new Error("License signature did not verify - refresh and retry.");
}

async function handleOpsLic(request, env, url) {
  const json = (status, obj) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    });
  if (!opsKeyOk(request, url, env)) {
    return json(403, { ok: false, error: "Invalid ops key." });
  }
  if (!env.GH_TOKEN) return json(503, { ok: false, error: "GH_TOKEN missing on this worker." });
  const key = (url.searchParams.get("license_id") || "").trim().toUpperCase();
  if (!/^VP3S-/.test(key)) return json(400, { ok: false, error: "license_id must look like VP3S-…." });
  let rec;
  try {
    rec = await fetchActivationRecord(env, key);
  } catch (e) {
    return json(502, { ok: false, error: String((e && e.message) || e) });
  }
  if (!rec) return json(404, { ok: false, error: "License not found in the ledger." });
  let lic;
  try {
    lic = await buildLicFile(env, rec);
  } catch (e) {
    return json(500, { ok: false, error: String((e && e.message) || e) });
  }
  return new Response(JSON.stringify(lic, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${key}.lic"`,
    },
  });
}

function buildLicenseDeliveryHtml(order, lic) {
  const key = escHtml(lic.license_id || "");
  const name = escHtml((order && order.customer && order.customer.name) || "there");
  const ref = escHtml((order && order.ref) || "-");
  const prods = ((lic.products || [])
    .map((p) => ({ extractor: "Incentive Extractor", ordering: "Device Ordering", rebate: "Rebate Filing", bundle: "Full Bundle" }[p] || p))
    .join(", ")) || "3S Verse tools";
  const licJson = escHtml(JSON.stringify(lic, null, 2));
  const exp = lic.expires
    ? `Valid till <strong style="color:#16151d;">${escHtml(lic.expires)}</strong>`
    : "Lifetime license";
  return `<div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e6e4ee;border-top:3px solid #0e7c8c;border-radius:6px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#16151d;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:22px 26px 8px;">
  <tr><td>
    <div style="font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#6b6880;">3S Verse — license delivery</div>
    <h2 style="margin:6px 0 2px;font-size:19px;">Your license keys are ready, ${name}</h2>
    <div style="font-size:12px;color:#6b6880;">Order <strong style="color:#16151d;">${ref}</strong> · ${escHtml(prods)} · ${exp}</div>
  </td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:6px 26px;">
  <tr><td style="background:#f4f3f8;border:1px solid #e6e4ee;border-radius:8px;padding:16px;text-align:center;">
    <div style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#6b6880;">License key</div>
    <div class="mono" style="font-size:20px;font-weight:800;letter-spacing:.06em;padding:8px 0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;">${key}</div>
    <div style="font-size:11.5px;color:#6b6880;">Type this key into the app's activation window (one PC). It activates on first run on the registered PC.</div>
  </td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:8px 26px 4px;">
  <tr><td style="font-size:12px;color:#16151d;padding-bottom:6px;"><strong>License file (.lic) — no typing needed:</strong> copy the block below into a plain-text file named <span class="mono" style="font-family:ui-monospace,Menlo,Consolas,monospace;">${key}.lic</span>, then press <em>“Select License File…”</em> in the app's activation window and pick it.</td></tr>
  <tr><td><pre style="background:#f4f3f8;border:1px solid #e6e4ee;border-radius:8px;padding:12px 14px;font-size:10.5px;line-height:1.5;overflow-x:auto;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#16151d;white-space:pre-wrap;word-break:break-all;">${licJson}</pre></td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:4px 26px 20px;">
  <tr><td style="font-size:11.5px;line-height:1.7;color:#6b6880;">
    <strong style="color:#16151d;">Downloads:</strong> your order status page on 3sverse.com always serves the newest build — open it with your order reference ${ref} and use the download buttons.<br>
    Questions? Reply to this email or write to <a href="mailto:Connect@3SVerse.com" style="color:#0e7c8c;">Connect@3SVerse.com</a>.<br><br>
    Issued electronically by 3S Verse (3sverse.com) — licenses are per-PC and non-transferable; keys activate on first run on the registered PC(s).
  </td></tr>
</table>
</div>`;
}

async function handleOpsMailLic(request, env) {
  const url = new URL(request.url);
  const json = (status, obj) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    });
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "x-ops-key,content-type", "Access-Control-Allow-Methods": "POST,OPTIONS" } });
  }
  if (request.method !== "POST") return json(405, { ok: false, error: "Method not allowed." });
  if (!opsKeyOk(request, url, env)) return json(403, { ok: false, error: "Invalid ops key." });
  if (!env.GH_TOKEN) return json(503, { ok: false, error: "GH_TOKEN missing on this worker." });
  let body = {};
  try { body = await request.json(); } catch { /* empty body */ }
  const key = String(body.license_id || "").trim().toUpperCase();
  if (!/^VP3S-/.test(key)) return json(400, { ok: false, error: "license_id must look like VP3S-…." });
  let rec;
  try {
    rec = await fetchActivationRecord(env, key);
  } catch (e) {
    return json(502, { ok: false, error: String((e && e.message) || e) });
  }
  if (!rec) return json(404, { ok: false, error: "License not found in the ledger." });
  let lic;
  try {
    lic = await buildLicFile(env, rec);
  } catch (e) {
    return json(500, { ok: false, error: String((e && e.message) || e) });
  }
  let orders = [];
  try {
    orders = await opsLoadDir(env, env.INBOX_DIR || INBOX_DIR_DEFAULT);
  } catch { /* orders optional */ }
  const order = (orders || []).find((o) => String(o.licenseId || "").toUpperCase() === key) || null;
  const toEmail = (order && order.customer && order.customer.email)
    || String(rec.customer || "").match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0] || "";
  if (!toEmail) {
    return json(400, { ok: false, error: "No customer email found - link this license to its order first." });
  }
  const mailOrder = order || { ref: "-", customer: { name: rec.customer, email: toEmail }, totalLabel: "" };
  const emailed = await sendCustomerInvoice(env, mailOrder, buildLicenseDeliveryHtml(mailOrder, lic));
  if (emailed && order && order.ref && String(order.ref).startsWith("3SV-")) {
    /* best-effort flag on the order so /ops shows the key went out */
    try {
      const repo = env.LEDGER_REPO || LEDGER_REPO_DEFAULT;
      const dir = env.INBOX_DIR || INBOX_DIR_DEFAULT;
      const gRes = await fetch(`https://api.github.com/repos/${repo}/contents/${dir}/${encodeURIComponent(order.ref)}.json?ref=main`, { headers: ghHeaders(env.LEDGER_WRITE_TOKEN || env.GH_TOKEN) });
      if (gRes.ok) {
        const meta = await gRes.json();
        const rec2 = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(String(meta.content || "").replace(/\s/g, "")), (c) => c.charCodeAt(0))));
        rec2.keyMailed = true;
        await fetch(`https://api.github.com/repos/${repo}/contents/${dir}/${encodeURIComponent(order.ref)}.json`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${env.LEDGER_WRITE_TOKEN || env.GH_TOKEN}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
            "User-Agent": "3sverse-download-gateway",
          },
          body: JSON.stringify({
            message: `order ${order.ref} — license key + .lic mailed`,
            content: btoa(unescape(encodeURIComponent(JSON.stringify(rec2, null, 2)))),
            sha: meta.sha,
          }),
        });
      }
    } catch { /* best effort */ }
  }
  return json(200, { ok: true, emailed, to: toEmail, license_id: key });
}

function opsShellPage() {
  return new Response(
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>3S Verse — Ops</title>
<link rel="icon" href="https://3sverse.com/favicon.ico?v=2">
<style>
:root{--bg:#0b1020;--card:#141b38;--bd:#2b3561;--teal:#22b8c9;--tx:#e8ecf7;--mut:#9aa4c0;--ok:#5ee39a;--warn:#ffcf70;--bad:#ff9b93;--hov:#1a2246;--chipok:#12301f;--chipwarn:#33270e;--chipbad:#3a1518;--chipmut:#23283b;--chipteal:#0e2f36;--thead:#e8ecf7}
body[data-theme="light"]{--bg:#f4f3f8;--card:#fff;--bd:#e6e4ee;--teal:#0e7c8c;--tx:#16151d;--mut:#6b6880;--ok:#1f7a4d;--warn:#b45309;--bad:#b3261e;--hov:#fafafd;--chipok:#e5f4ec;--chipwarn:#fdf1df;--chipbad:#fbe9e7;--chipmut:#efedf5;--chipteal:#e3f1f3;--thead:#16151d}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--tx);font:14px/1.5 -apple-system,'Segoe UI',Roboto,Arial,sans-serif}
.wrap{max-width:1180px;margin:0 auto;padding:18px 14px 60px}
.bar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px}
.bar img{height:34px;display:block}
.bar h1{font-size:18px;margin:0}
.sub{color:var(--mut);font-size:11px;letter-spacing:.18em;text-transform:uppercase}
.sp{flex:1}
button{background:var(--card);border:1px solid var(--bd);color:var(--tx);border-radius:8px;padding:8px 14px;font:600 13px/1.4 inherit;cursor:pointer}
button.pri{background:var(--teal);border-color:var(--teal);color:#fff}
button:hover{filter:brightness(.96)}
input,select{background:var(--card);border:1px solid var(--bd);border-radius:8px;padding:8px 10px;font:13px/1.4 inherit;color:var(--tx)}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(128px,1fr));gap:10px;margin-bottom:16px}
.card{background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:12px 14px}
.card .k{color:var(--mut);font-size:10px;letter-spacing:.14em;text-transform:uppercase}
.card .v{font-size:22px;font-weight:700;margin-top:2px}
.sec{background:var(--card);border:1px solid var(--bd);border-radius:10px;margin-bottom:18px;overflow:hidden}
.sec h2{font-size:13px;margin:0;padding:12px 14px;border-bottom:1px solid var(--bd);letter-spacing:.08em;text-transform:uppercase;color:var(--mut)}
.tools{display:flex;gap:10px;flex-wrap:wrap;padding:10px 12px;border-bottom:1px solid var(--bd);align-items:center}
.sc{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:13px;min-width:920px}
th{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--mut);text-align:left;padding:9px 10px;border-bottom:2px solid var(--thead);white-space:nowrap}
td{padding:9px 10px;border-bottom:1px solid var(--bd);vertical-align:top}
tbody tr:hover td{background:var(--hov)}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px}
.mut{color:var(--mut)}
.sm{font-size:12px}
.chip{display:inline-block;border-radius:20px;padding:2px 9px;font-size:11px;font-weight:700;white-space:nowrap}
.c-ok{background:var(--chipok);color:var(--ok)}
.c-warn{background:var(--chipwarn);color:var(--warn)}
.c-bad{background:var(--chipbad);color:var(--bad)}
.c-mut{background:var(--chipmut);color:var(--mut)}
.c-teal{background:var(--chipteal);color:var(--teal)}
.mini{padding:4px 10px;border-radius:7px;font-size:11px;font-weight:700;white-space:nowrap}
#gate{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.gcard{background:var(--card);border:1px solid var(--bd);border-top:3px solid var(--teal);border-radius:10px;padding:30px 28px;max-width:380px;width:100%;text-align:center}
.gcard img{height:44px;margin-bottom:10px}
.gcard input{width:100%;margin:14px 0 8px;text-align:center}
.err{color:var(--bad);font-size:12px;min-height:16px;margin-bottom:6px}
.hint{color:var(--mut);font-size:11px;margin-top:12px}
.lbl{font-size:11px;color:var(--mut);letter-spacing:.14em;text-transform:uppercase;margin-top:4px}
/* Animated brand background - same spiral + orb artwork as the Studio app
   and the 3sverse.com hero/footer. Speeds matched to the site (user order:
   "spiral ki speed hero jitni, orb website wala"): ring floats 16px over
   12s while its image spins once per 120s (hero speed); the orb floats
   12px over 13s and rotates once per 140s - exactly the site values.
   Float runs on the wrapper, spin on the img (same split as the site).
   Respect reduced motion. */
#bgart{position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:0}
#bgart>div{position:absolute;will-change:transform}
#bgart img{position:relative;display:block;width:100%;height:auto;will-change:transform}
.bg-ring{right:-22vw;top:-16vh;width:min(56vw,720px);opacity:.45;animation:bgfloatR 12s ease-in-out infinite}
.bg-ring img{animation:bgspin 120s linear infinite}
.bg-ring-light{display:none;right:-22vw;top:-16vh;width:min(56vw,720px);opacity:.3;animation:bgfloatR 12s ease-in-out infinite}
.bg-ring-light img{animation:bgspin 120s linear infinite}
.bg-orb{left:-9vw;bottom:-24vh;width:min(34vw,440px);opacity:.45;animation:bgfloatO 13s ease-in-out infinite}
.bg-orb img{animation:bgspin 140s linear infinite}
body[data-theme="light"] .bg-ring{display:none}
body[data-theme="light"] .bg-ring-light{display:block}
body[data-theme="light"] .bg-orb{opacity:.3}
@keyframes bgspin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes bgfloatR{0%,100%{transform:translateY(-16px)}50%{transform:translateY(16px)}}
@keyframes bgfloatO{0%,100%{transform:translateY(-12px)}50%{transform:translateY(12px)}}
@media (prefers-reduced-motion:reduce){#bgart>div,#bgart img{animation:none}}
#gate,.wrap{position:relative;z-index:1}
</style></head><body>
<div id="bgart" aria-hidden="true">
<div class="bg-ring"><img src="https://3sverse.com/shapes/shape-v1.webp" alt=""></div>
<div class="bg-ring-light"><img src="https://3sverse.com/shapes/shape-v1-solid.webp?v=7" alt=""></div>
<div class="bg-orb"><img src="https://3sverse.com/shapes/shape-v3.webp" alt=""></div>
</div>
<div id="gate"><div class="gcard">
<img src="https://3sverse.com/logo.png" alt="3S Verse">
<div class="lbl">Dealer Automation Tools</div>
<h2 style="margin:8px 0 2px">Ops Dashboard</h2>
<div class="mut sm">Orders · Invoices · Licenses — live ledger</div>
<input id="key" type="password" placeholder="Ops key" autocomplete="off">
<div class="err" id="gerr"></div>
<button class="pri" style="width:100%" onclick="unlock()">Unlock</button>
<div class="hint">Private. The key is the OPS_KEY variable on the gateway worker.</div>
</div></div>
<div id="app" style="display:none">
<div class="wrap">
  <div class="bar">
    <img src="https://3sverse.com/logo.png" alt="">
    <div><h1>3S Verse — Ops</h1><div class="sub">Orders · Invoices · Licenses</div></div>
    <div class="sp"></div>
    <span class="mut sm" id="upd"></span>
    <button id="thbtn" onclick="toggleTheme()" title="Dark / light">🌙</button>
    <button onclick="loadData()">Refresh</button>
    <button onclick="exportCsv('orders')">Orders CSV</button>
    <button onclick="exportCsv('licenses')">Licenses CSV</button>
    <button onclick="logout()">Log out</button>
  </div>
  <div class="cards" id="cards"></div>
  <div class="sec">
    <h2>Website orders — ledger/orders_inbox</h2>
    <div class="tools">
      <input id="q" placeholder="Search ref, name, email…" style="min-width:220px" oninput="renderOrders()">
      <select id="fst" onchange="renderOrders()">
        <option value="">All statuses</option>
        <option value="pending">Pending</option>
        <option value="fulfilled">Fulfilled</option>
      </select>
      <label class="sm mut"><input type="checkbox" id="auto" checked> auto-refresh 60s</label>
    </div>
    <div class="sc"><table id="tOrders"></table></div>
  </div>
  <div class="sec">
    <h2>Issued licenses — ledger/activations</h2>
    <div class="tools"><input id="ql" placeholder="Search key, customer…" style="min-width:220px" oninput="renderLic()"></div>
    <div class="sc"><table id="tLic"></table></div>
  </div>
</div></div>
<script>
var KEY = sessionStorage.getItem('opsKey') || '';
var DATA = null;
function applyTheme(t){document.body.setAttribute('data-theme',t);var b=document.getElementById('thbtn');if(b)b.textContent=(t==='dark'?'🌙':'☀️');try{localStorage.setItem('opsTheme',t);}catch(e){}}
function toggleTheme(){applyTheme((document.body.getAttribute('data-theme')==='dark')?'light':'dark');}
(function(){var t=null;try{t=localStorage.getItem('opsTheme');}catch(e){}applyTheme(t||'dark');})();
function dlLic(key){
  fetch('/ops/lic?license_id='+encodeURIComponent(key),{headers:{'x-ops-key':KEY}})
    .then(function(r){if(!r.ok)return r.json().then(function(j){throw new Error(j.error||('HTTP '+r.status));});return r.text();})
    .then(function(txt){var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([txt],{type:'application/octet-stream'}));a.download=key+'.lic';document.body.appendChild(a);a.click();a.remove();})
    .catch(function(e){alert('.lic download fail: '+e.message);});
}
function mailLic(key){
  if(!confirm('Mail the license key + .lic content to the customer?'))return;
  fetch('/ops/maillic',{method:'POST',headers:{'x-ops-key':KEY,'Content-Type':'application/json'},body:JSON.stringify({license_id:key})})
    .then(function(r){return r.json().then(function(j){return {st:r.status,j:j};});})
    .then(function(x){
      if(x.j&&x.j.ok){alert(x.j.emailed?('Key + .lic content mailed to '+(x.j.to||'the customer')):'Mail relay failed - check the EMAILJS bindings.');}
      else{alert('Mail fail: '+((x.j&&x.j.error)||('HTTP '+x.st)));}
    })
    .catch(function(e){alert('Mail fail: '+e.message);});
}
var PNAME = {extractor:'Incentive Extractor',ordering:'Device Ordering',rebate:'Rebate Filing',bundle:'Full Bundle'};
var MSHORT = {trial:'7-day trial',monthly:'monthly',annual:'annual',lifetime:'lifetime'};
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function money(s){var v=parseFloat(String(s||'').replace(/[^0-9.]/g,''));return isNaN(v)?0:v;}
function inv(ref){return 'INV-'+String(ref||'').toUpperCase().replace(/^3SV-/,'');}
function today(){return new Date().toISOString().slice(0,10);}
function days(d){if(!d)return null;var t=Date.parse(d+'T00:00:00Z'),n=Date.parse(today()+'T00:00:00Z');return Math.round((t-n)/864e5);}
function licById(id){if(!id)return null;var L=(DATA&&DATA.licenses)||[];for(var i=0;i<L.length;i++){if(L[i].license_id===id)return L[i];}return null;}
function orderForLic(lid){var O=(DATA&&DATA.orders)||[];for(var i=0;i<O.length;i++){if(O[i].licenseId===lid)return O[i].ref;}return '';}
function orderItems(rec){return (rec.items||[]).map(function(it){var n=PNAME[it.productId]||it.productId;var q=' ×'+(it.qty||1);var pcs=it.pcs?' · '+it.pcs+' PC':'';var be=it.bundleEach?' · '+it.bundleEach+' each':'';var m=(MSHORT[it.model]||it.model);return n+q+pcs+be+' ('+m+')';}).join('; ');}
function licChip(l){if(!l)return '<span class="chip c-warn">no license yet</span>';var d=days(l.expires);if(l.expires&&d<0)return '<span class="chip c-bad">expired '+esc(l.expires)+'</span>';if(l.expires&&d<=30)return '<span class="chip c-warn">expires in '+d+'d</span>';if(l.expires)return '<span class="chip c-ok">till '+esc(l.expires)+'</span>';return '<span class="chip c-teal">lifetime</span>';}
function unlock(){KEY=document.getElementById('key').value.trim();document.getElementById('gerr').textContent='';loadData();}
function logout(){sessionStorage.removeItem('opsKey');location.reload();}
function loadData(){
  if(!KEY){return;}
  fetch('/ops/data',{headers:{'x-ops-key':KEY}}).then(function(r){
    if(r.status===403){sessionStorage.removeItem('opsKey');DATA=null;document.getElementById('app').style.display='none';document.getElementById('gate').style.display='flex';document.getElementById('gerr').textContent='Invalid ops key.';throw new Error('auth');}
    if(!r.ok){throw new Error('HTTP '+r.status);}
    return r.json();
  }).then(function(j){
    if(!j.ok){throw new Error(j.error||'unknown error');}
    DATA=j;sessionStorage.setItem('opsKey',KEY);
    document.getElementById('gate').style.display='none';
    document.getElementById('app').style.display='block';
    document.getElementById('gerr').textContent='';
    document.getElementById('upd').textContent='updated '+new Date().toLocaleTimeString();
    renderCards();renderOrders();renderLic();
  }).catch(function(e){
    if(e&&e.message!=='auth'){document.getElementById('gerr').textContent='Failed to load: '+e.message;}
  });
}
function renderCards(){
  var O=(DATA&&DATA.orders)||[],L=(DATA&&DATA.licenses)||[];
  var pend=0,ful=0,revenue=0,act=0,exp=0,expn=0;
  O.forEach(function(o){if(o.status==='fulfilled')ful++;else if(o.status==='pending')pend++;revenue+=money(o.totalLabel);});
  L.forEach(function(l){var d=days(l.expires);if(l.expires&&d<0)exp++;else if(l.expires&&d<=30)expn++;else act++;});
  var cards=[['Orders',O.length],['Pending',pend],['Fulfilled',ful],['Licenses',L.length],['Active',act],['Expiring ≤30d',expn],['Expired',exp],['Revenue','$'+revenue.toFixed(2)]];
  document.getElementById('cards').innerHTML=cards.map(function(c){return '<div class="card"><div class="k">'+c[0]+'</div><div class="v">'+c[1]+'</div></div>';}).join('');
}
function renderOrders(){
  var O=(DATA&&DATA.orders)||[];
  var q=(document.getElementById('q').value||'').toLowerCase();
  var st=document.getElementById('fst').value;
  var rows=O.filter(function(o){
    if(st&&o.status!==st)return false;
    if(!q)return true;
    var c=o.customer||{};
    var hay=[o.ref,c.name,c.email,c.company,o.licenseId,inv(o.ref),orderItems(o)].join(' ').toLowerCase();
    return hay.indexOf(q)>=0;
  }).sort(function(a,b){return String(b.createdAt||'').localeCompare(String(a.createdAt||''));});
  var h='<thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th>Invoice</th><th>License</th><th>Expiry</th><th>Status</th></tr></thead><tbody>';
  if(!rows.length)h+='<tr><td colspan="9" class="mut">No orders match.</td></tr>';
  rows.forEach(function(o){
    var c=o.customer||{};
    var l=licById(o.licenseId);
    var stChip;
    if(o.status==='fulfilled')stChip='<span class="chip c-ok">fulfilled</span>';
    else if(o.status==='pending')stChip='<span class="chip c-warn">pending</span>';
    else stChip='<span class="chip c-mut">'+esc(o.status||'?')+'</span>';
    if(o.invoiceEmailed===false)stChip+=' <span class="chip c-bad" title="Invoice email failed">mail fail</span>';
    h+='<tr>'
      +'<td class="mono"><b>'+esc(o.ref)+'</b></td>'
      +'<td class="sm">'+esc(String(o.createdAt||'').replace('T',' ').slice(0,16))+'</td>'
      +'<td><b>'+esc(c.name||'-')+'</b>'+(c.company?'<div class="sm mut">'+esc(c.company)+'</div>':'')+'<div class="sm mut">'+esc(c.email||'')+'</div></td>'
      +'<td class="sm">'+esc(orderItems(o))+'</td>'
      +'<td class="mono">'+esc(o.totalLabel||'')+'</td>'
      +'<td class="mono">'+esc(inv(o.ref))+'</td>'
      +'<td class="mono sm">'+(o.licenseId?esc(o.licenseId):'<span class="mut">—</span>')+'</td>'
      +'<td>'+licChip(o.licenseId?l:null)+'</td>'
      +'<td>'+stChip+'</td>'
      +'</tr>';
  });
  document.getElementById('tOrders').innerHTML=h+'</tbody>';
}
function renderLic(){
  var L=(DATA&&DATA.licenses)||[];
  var q=(document.getElementById('ql').value||'').toLowerCase();
  var rows=L.filter(function(l){
    if(!q)return true;
    var hay=[l.license_id,l.customer,(l.products||[]).join(','),l.model].join(' ').toLowerCase();
    return hay.indexOf(q)>=0;
  }).sort(function(a,b){return String(b.issued_at||'').localeCompare(String(a.issued_at||''));});
  var h='<thead><tr><th>License key</th><th>Customer</th><th>Products</th><th>Model</th><th>Seats</th><th>Issued</th><th>Expiry</th><th>Status</th><th>Order</th><th>Actions</th></tr></thead><tbody>';
  if(!rows.length)h+='<tr><td colspan="10" class="mut">No licenses match.</td></tr>';
  rows.forEach(function(l){
    var d=days(l.expires);
    var st;
    if(l.expires&&d<0)st='<span class="chip c-bad">expired</span>';
    else if(l.expires&&d<=30)st='<span class="chip c-warn">'+d+'d left</span>';
    else st='<span class="chip c-ok">active</span>';
    var prods=(l.products||[]).map(function(p){return PNAME[p]||p;}).join(', ');
    var ref=orderForLic(l.license_id);
    h+='<tr>'
      +'<td class="mono"><b>'+esc(l.license_id)+'</b></td>'
      +'<td class="sm">'+esc(l.customer||'-')+'</td>'
      +'<td class="sm">'+esc(prods)+'</td>'
      +'<td class="sm">'+esc(MSHORT[l.model]||l.model||'')+'</td>'
      +'<td class="mono">'+esc(l.max_seats||1)+'</td>'
      +'<td class="sm">'+esc(l.issued_at||'')+'</td>'
      +'<td class="sm">'+(l.expires?esc(l.expires):'<span class="mut">never</span>')+'</td>'
      +'<td>'+st+'</td>'
      +'<td class="mono sm">'+(ref?'<a href="#" data-ref="'+esc(ref)+'">'+esc(ref)+'</a>':'<span class="mut">—</span>')+'</td>'
      +'<td style="white-space:nowrap"><button class="mini" onclick="dlLic(&quot;'+esc(l.license_id)+'&quot;)" title="Download the signed .lic file">⬇ .lic</button> <button class="mini" onclick="mailLic(&quot;'+esc(l.license_id)+'&quot;)" title="Email the key + .lic content to the customer">✉ Mail</button></td>'
      +'</tr>';
  });
  document.getElementById('tLic').innerHTML=h+'</tbody>';
}
function csvCell(v){v=String(v==null?'':v);return '"'+v.replace(/"/g,'""')+'"';}
function exportCsv(kind){
  var rows,head,name;
  if(kind==='orders'){
    head=['ref','created_at','status','customer','company','email','items','total','invoice_no','license_id','expires','messenger','notes'];
    rows=((DATA&&DATA.orders)||[]).map(function(o){var l=licById(o.licenseId);var c=o.customer||{};return [o.ref,o.createdAt,o.status,c.name,c.company,c.email,orderItems(o),o.totalLabel,inv(o.ref),o.licenseId||'',(l&&l.expires)||'',c.messenger||'',c.notes||''];});
    name='3sverse-orders.csv';
  }else{
    head=['license_id','customer','products','model','max_seats','issued_at','expires','status','order_ref'];
    rows=((DATA&&DATA.licenses)||[]).map(function(l){return [l.license_id,l.customer,(l.products||[]).join(' '),l.model,l.max_seats,l.issued_at,l.expires,l.status,orderForLic(l.license_id)];});
    name='3sverse-licenses.csv';
  }
  var txt='\\ufeff'+head.join(',')+'\\n'+rows.map(function(r){return r.map(csvCell).join(',');}).join('\\n');
  var a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([txt],{type:'text/csv'}));
  a.download=name;document.body.appendChild(a);a.click();a.remove();
}
document.getElementById('key').addEventListener('keydown',function(ev){if(ev.key==='Enter')unlock();});
document.addEventListener('click',function(ev){
  var t=ev.target;
  if(t&&t.getAttribute&&t.getAttribute('data-ref')){ev.preventDefault();document.getElementById('q').value=t.getAttribute('data-ref');renderOrders();window.scrollTo({top:0,behavior:'smooth'});}
});
setInterval(function(){if(DATA&&document.getElementById('auto').checked)loadData();},60000);
if(KEY)loadData();
</script></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );
}

/* ------------------------------- handler ------------------------------- */
/* ------------------- contact relay (Turnstile-gated) --------------------
   The website's forms post here; the worker verifies the Turnstile token
   server-side and only then relays the payload to FormSubmit. This gives
   the static site (GitHub Pages) a real server-side bot gate. */
const FORUM_SUBMIT_URL = "https://formsubmit.co/ajax/connect@3sverse.com";
const CONTACT_ALLOWED_FIELDS = new Set([
  "name", "email", "store", "company", "tool", "rating", "review", "text",
  "message", "phone", "messenger", "notes", "_subject", "_template",
  "_replyto", "_autoresponse", "_honey",
]);

async function handleContactPost(request, env) {
  const ip = inboxIp(request);
  if (rateLimited("contact", ip, CONTACT_WINDOW_MS, CONTACT_MAX_PER_WINDOW)) {
    return jsonCors(request, 429, { ok: false, error: "Too many messages — please try again later." });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonCors(request, 400, { ok: false, error: "Invalid request body." });
  }
  if (!(await verifyTurnstile(env, body.turnstileToken, ip))) {
    return jsonCors(request, 403, { ok: false, error: "Security check failed or missing — please retry." });
  }
  if (body._honey) {
    // Honeypot filled -> almost certainly a bot. Pretend success, send nothing.
    return jsonCors(request, 200, { ok: true });
  }
  const fields = {};
  for (const [k, v] of Object.entries(body || {})) {
    if (k === "turnstileToken" || k === "website") continue;
    if (!CONTACT_ALLOWED_FIELDS.has(k)) continue;
    fields[k] = typeof v === "string" ? v.slice(0, 4000) : v;
  }
  if (!fields.name && !fields.email && !fields._subject) {
    return jsonCors(request, 400, { ok: false, error: "Nothing to send." });
  }
  try {
    const upstream = await fetch(FORUM_SUBMIT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(fields),
    });
    const payload = await upstream.json().catch(() => ({}));
    return jsonCors(request, upstream.ok && payload.success === "true" ? 200 : 502,
      upstream.ok && payload.success === "true"
        ? { ok: true }
        : { ok: false, error: "The mail relay rejected the message — please email Connect@3SVerse.com directly." });
  } catch {
    return jsonCors(request, 502, { ok: false, error: "Mail relay unreachable — please email Connect@3SVerse.com directly." });
  }
}

/* ------------------------------- router -------------------------------- */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "") return infoPage();

    if (url.pathname === "/order") {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders(request) });
      }
      if (request.method !== "POST") {
        return jsonCors(request, 405, { ok: false, error: "Method not allowed." });
      }
      return handleOrderPost(request, env);
    }

    if (url.pathname === "/contact") {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders(request) });
      }
      if (request.method !== "POST") {
        return jsonCors(request, 405, { ok: false, error: "Method not allowed." });
      }
      return handleContactPost(request, env);
    }

    if (url.pathname === "/trial") {
      const tproduct = (url.searchParams.get("product") || "").trim().toLowerCase();
      const asset = TRIAL_ASSETS[tproduct];
      if (!asset) {
        return errorPage(404, "Unknown trial product — use /trial?product=extractor|ordering|rebate.");
      }
      const target = TRIAL_DOWNLOADS_BASE + asset;
      const ct = url.searchParams.get("ct") || "";
      if (!(await verifyTurnstile(env, ct, inboxIp(request)))) {
        return challengePage(request, env, url.pathname + "?product=" + encodeURIComponent(tproduct));
      }
      return Response.redirect(target, 302);
    }

    /* Operator dashboard (private): key-gated shell + JSON feed. */
    if (url.pathname === "/ops" || url.pathname === "/ops/") {
      return opsShellPage();
    }
    if (url.pathname === "/ops/data") {
      return handleOpsData(request, env, url);
    }
    if (url.pathname === "/ops/ledger") {
      return handleOpsLedger(request, env, url);
    }
    if (url.pathname === "/ops/lic") {
      return handleOpsLic(request, env, url);
    }
    if (url.pathname === "/ops/maillic") {
      return handleOpsMailLic(request, env);
    }

    if (url.pathname !== "/download") {
      return errorPage(404, "Unknown path — use /download?order=…&product=…");
    }

    /* Paid-download Turnstile gate: first hit (no ct token) shows the
       one-click check; the widget bounces back with &ct=<token> which is
       verified server-side before a single byte of the build is served. */
    {
      const ct = url.searchParams.get("ct") || "";
      if (!(await verifyTurnstile(env, ct, inboxIp(request)))) {
        const qs = new URLSearchParams(url.search);
        qs.delete("ct");
        return challengePage(request, env, url.pathname + "?" + qs.toString());
      }
    }

    if (!env.GH_TOKEN) {
      return errorPage(500, "Gateway is not configured yet (missing GH_TOKEN).");
    }

    const orderNo = (url.searchParams.get("order") || "").trim().toUpperCase();
    const product = (url.searchParams.get("product") || "bundle").trim().toLowerCase();

    let verdict;
    try {
      const ledger = await loadLedger(env);
      verdict = validate(ledger, orderNo, product);
    } catch (err) {
      return errorPage(502, `Could not verify orders (${err.message}). Try again in a minute.`);
    }
    if (!verdict.ok) return errorPage(verdict.status, verdict.message);

    /* Bundle (or any order covering several tools) → picker page. */
    if (product === "bundle" && verdict.products.length > 1) {
      return bundlePage(orderNo, verdict.products);
    }

    const target = verdict.products[0];
    const conf = ASSET_MAP[target];
    try {
      const asset = await findAsset(env, conf.repo, conf.asset);
      const owner = env.OWNER || OWNER_DEFAULT;
      const upstream = await fetch(
        `https://api.github.com/repos/${owner}/${conf.repo}/releases/assets/${asset.id}`,
        { headers: ghHeaders(env.GH_TOKEN, true), redirect: "follow" },
      );
      if (!upstream.ok || !upstream.body) {
        return errorPage(502, `Could not fetch the build (${upstream.status}). Try again shortly.`);
      }
      const headers = new Headers();
      headers.set("Content-Type", "application/octet-stream");
      headers.set("Content-Disposition", `attachment; filename="${asset.name}"`);
      if (asset.size) headers.set("Content-Length", String(asset.size));
      headers.set("Cache-Control", "no-store");
      headers.set("X-3SV-Order", orderNo);
      headers.set("X-3SV-Build", asset.tag);
      return new Response(upstream.body, { status: 200, headers });
    } catch (err) {
      return errorPage(502, `Could not fetch the build (${err.message}). Try again shortly.`);
    }
  },
};
