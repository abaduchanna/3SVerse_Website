/**
 * Dealer Tools catalog — single source of truth for the license store.
 *
 * Used by BOTH the storefront UI (src/components/DealerStore.tsx) and the
 * serverless order API (netlify/functions/order.mts), so the server always
 * recomputes prices from this file and never trusts client-sent amounts.
 *
 * All prices in USD. Edit prices here and redeploy — nothing else to touch.
 */

export type ModelId = 'trial' | 'monthly' | 'annual' | 'lifetime';
/** How many PCs one license covers — self-serve picks 1–9 (audit F09:
 *  10+ PCs move to the district-quote flow: message us for pricing). */
export type PcCount = number;
export const PC_MIN = 1;
export const PC_MAX = 9;

/** Suffix shown after a price for recurring models — '' for one-time. */
export function modelPriceSuffix(model: ModelId): string {
  if (model === 'monthly') return '/mo';
  if (model === 'annual') return '/yr';
  return '';
}

/** Per-model billing explanation shown under the price in the store.
 *  `product` (optional) makes the annual savings % exact per product —
 *  the per-tool plans and the Full Bundle discount differently, and the
 *  % is computed against the CURRENT effective monthly price (launch
 *  sale now, list after it ends), so it stays true on both sides of Nov 1. */
export function modelBillingNote(model: ModelId, product?: Product): string {
  switch (model) {
    case 'monthly':
      return 'per month · cancel anytime';
    case 'annual': {
      if (product && product.prices.monthly > 0) {
        return `per year · save ${annualSavingsPct(product)}% vs monthly`;
      }
      return 'per year · save 44% vs monthly';
    }
    case 'lifetime':
      return 'one-time payment · permanent use · 1 year of updates included';
    default:
      return '7 days · 1 PC · no card needed';
  }
}

/** True for models that renew (shown on invoices + emails). */
export function isRecurringModel(model: ModelId): boolean {
  return model === 'monthly' || model === 'annual';
}

/**
 * Per-PC licensing, explained (audit: per-PC pricing can feel punitive
 * unless the site explains why it exists). Shown next to the PC picker.
 */
export const PER_PC_NOTE =
  'One PC can run every store you operate — most single-PC dealers need exactly one license. '
  + 'Extra PCs are for extra workstations (a second office, a colleague\u2019s desk): each seat is a separate '
  + 'activation with its own license key, support and updates, so volume discounts apply per PC instead.';

export interface ModelOption {
  id: ModelId;
  label: string;
  note: string;
}

export interface VolumeTier {
  /** Minimum PC count for this tier. */
  min: number;
  /** Per-PC price multiplier at this tier. */
  multiplier: number;
  /** Percent off per PC (display only). */
  offPct: number;
  /** Human label, '' when no discount. */
  label: string;
}

/**
 * Volume ladder — bigger PC counts cost less per PC (audit F09: shallower
 * tiers so deep discounts are reserved for annual/district contracts; 10+
 * PCs are quoted through the district flow instead of self-serve).
 * Ordered best-tier-first; pick the first tier whose min the count reaches.
 */
export const VOLUME_TIERS: VolumeTier[] = [
  { min: 5, multiplier: 0.8, offPct: 20, label: '20% off per PC' },
  { min: 2, multiplier: 0.9, offPct: 10, label: '10% off per PC' },
  { min: 1, multiplier: 1, offPct: 0, label: '' },
];

export function volumeTier(pcs: number): VolumeTier {
  const n = Math.max(PC_MIN, Math.floor(pcs || PC_MIN));
  return VOLUME_TIERS.find((t) => n >= t.min) ?? VOLUME_TIERS[VOLUME_TIERS.length - 1];
}

/** Next better volume tier above `pcs`, if any (for “add N more…” hints). */
export function nextVolumeTier(pcs: number): VolumeTier | undefined {
  const current = volumeTier(pcs);
  return VOLUME_TIERS.find((t) => t.min > current.min);
}

export function pcAllowedForModel(model: ModelId, pcs: number): boolean {
  if (!Number.isInteger(pcs) || pcs < PC_MIN || pcs > PC_MAX) return false;
  return model === 'trial' ? pcs === 1 : true;
}

export function pcLabel(pcs: number): string {
  return `${pcs} PC${pcs === 1 ? '' : 's'}`;
}

export interface Product {
  id: string;
  name: string;
  tagline: string;
  features: string[];
  /** Regular (list) price per model in whole USD. */
  prices: Record<ModelId, number>;
  /** Optional list price that takes over AUTOMATICALLY once the launch offer
   *  ends (endsAt passes): per-tool lifetime settles at the $999 price point
   *  and the bundle at $2,499 — no manual flip needed on Nov 1.
   *  Owner 2026-10-08: monthly does the SAME flip — $89/$300 sale during the
   *  window, then the $149/$450 list returns on Nov 1. */
  postLaunchPrices?: Partial<Record<ModelId, number>>;
  /** Launch-offer price per model in whole USD (optional — falls back to list). */
  launchPrices?: Partial<Record<ModelId, number>>;
}

/**
 * Launch offer — site-wide introductory discount with a REAL, enforced end
 * condition (audit: scarcity must be tied to an enforced deadline — no
 * fabricated "X of Y left" counters; the countdown counts to the fixed
 * cutoff below and list prices return automatically). Flip `active` to
 * false to end the promotion early.
 */
export const LAUNCH_OFFER = {
  active: true,
  label: 'Launch Offer',
  /* Audit v4 #3: urgency needs stakes — show the exact after-price so the customer
     sees what they save by deciding today. Rendered under the countdown strip, in
     the storefront, and on the Pricing page. */
  note: 'Launch pricing ends Oct 31, 2026 — honored to the minute. From Nov 1: monthly $149 per tool · $450 Full Bundle. Lifetime stays $999 per tool · $2,499 Full Bundle.',
  /** ISO deadline for launch pricing — the storefront counts down to it.
   *  Flip `active` to false (or clear endsAt) when the promo ends. */
  endsAt: '2026-10-31T23:59:59-05:00',
} as const;

/**
 * WhatsApp float button — paste the number in international format with no
 * +, spaces or dashes (e.g. '923001234567'). Leave '' to hide the button.
 */
export const WHATSAPP_NUMBER = '923393078683';
export const WHATSAPP_GREETING =
  'Hi 3SVerse — I have a question about the VidaPay dealer tools.';

export function whatsappLink(): string | null {
  if (!WHATSAPP_NUMBER) return null;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_GREETING)}`;
}

/**
 * Product demo video — paste a YouTube embed URL (https://www.youtube.com/embed/VIDEO_ID)
 * or a Loom share link after recording the walkthrough. Leave '' to show the
 * "demo dropping soon" placeholder instead of an iframe.
 */
export const VIDEO_DEMO = {
  url: 'https://www.youtube.com/embed/vwU8vkcCQWs',
  kicker: 'See it before you buy it',
  title: 'Watch the tools work.',
  note: 'Raw screen recordings — portal in, clean Excel out. No production polish, because the tools are the point.',
} as const;

/** Short, captioned overview assembled from the real product recordings. */
export const OVERVIEW_DEMO = {
  url: 'https://github.com/abaduchanna/3SVerse_Downloads/releases/download/latest/3SVerse_VidaPay_Tools_90_Second_Demo.mp4',
  poster: 'https://github.com/abaduchanna/3SVerse_Downloads/releases/download/latest/3SVerse_VidaPay_Tools_90_Second_Demo_Poster.jpg',
  kicker: '90-second product overview',
  title: 'See all three tools in 90 seconds',
  note: 'A captioned overview built from the real Incentive Extractor and Rebate Filing recordings, plus the live Device Ordering interface.',
} as const;

/** Both published product demos — embedded on the landing page and linked on YouTube. */
export const DEMOS = [
  {
    id: 'vwU8vkcCQWs',
    title: 'VidaPay Rebate Filing — full walkthrough',
    blurb: 'The complete rebate filing flow, step by step: pull claims, file them, track the money.',
    dur: '19 min',
  },
  {
    id: 'Eij45OnT-lw',
    title: 'VidaPay Incentive Extractor — portal to Excel',
    blurb: 'Incentive data pulled straight from the VidaPay portal into a clean spreadsheet.',
    dur: '7:49',
  },
] as const;

/** YouTube channel — @3SVerse. */
export const YOUTUBE_URL = 'https://www.youtube.com/@3SVerse';

/**
 * Official downloads — served from the PUBLIC 3SVerse_Downloads repo,
 * which auto-syncs the newest build of each tool every 4 hours
 * (github.com/abaduchanna/3SVerse_Downloads → releases/latest). These are
 * versionless URLs: the same link always delivers the newest build, so
 * trial users and paid customers re-downloading updates never need a new
 * link. There is ONE build per tool: it opens as a free 7-day trial and
 * a license key unlocks the full version — paid delivery is the key
 * (emailed), not a separate file. Key authenticity is enforced inside
 * the app via Ed25519 signatures, so this link is safe to share anywhere.
 */
const TRIAL_BASE =
  'https://github.com/abaduchanna/3SVerse_Downloads/releases/latest/download/';

export const TRIAL_DOWNLOADS: Record<string, string> = {
  extractor: `${TRIAL_BASE}VidaPay_Incentive_Extractor.exe`,
  ordering: `${TRIAL_BASE}VidaPay_Device_Ordering.exe`,
  rebate: `${TRIAL_BASE}VidaPay_Rebate_Filing.exe`,
  /* Bundle → the branded download page lists all three portable executables
     with live SHA-256 checksums. */
  bundle: '/#/download',
};

/** Versionless trial download URL for a product ('' hides its button).
 *  With Turnstile switched on, trials route through the worker's /trial
 *  gate (one-click check, then 302 to the same GitHub asset) so bots cannot
 *  hammer the public release links; without it, the direct GitHub URL. */
export function trialDownloadUrl(productId: string): string {
  const direct = TRIAL_DOWNLOADS[productId] ?? '';
  if (TURNSTILE_SITE_KEY && productId !== 'bundle' && direct) {
    return `${PAID_DOWNLOAD.trialUrl}?product=${encodeURIComponent(productId)}`;
  }
  return direct;
}

export const TRIAL_DOWNLOAD = {
  label: 'Download portable Windows app (.exe)',
  note: 'Windows 10/11 · no installation · full 7-day trial built in · license key unlocks the same file',
} as const;

/**
 * Order intake + optional trial gate (Cloudflare Worker):
 * https://3sverse-downloads.abaduchanna.workers.dev
 * The storefront POSTs every order to orderInboxUrl — the worker files it
 * into vidapay-license-server/ledger/orders_inbox/<ref>.json so the
 * License Studio "Orders" tab shows pending orders live (key issue
 * prefills straight from the order). Downloads themselves no longer go
 * through this worker: the one official build is public (see
 * TRIAL_DOWNLOADS above) and paid delivery is the license key.
 */
export const PAID_DOWNLOAD = {
  gatewayUrl: 'https://3sverse-downloads.abaduchanna.workers.dev/download',
  /* Order intake: the storefront POSTs every order here too — the worker
     files it into vidapay-license-server/ledger/orders_inbox/<ref>.json so
     the License Studio "Orders" tab shows pending orders live (key issue
     prefills straight from the order). Must match gatewayUrl origin. */
  orderInboxUrl: 'https://3sverse-downloads.abaduchanna.workers.dev/order',
  /* Capture worker (dormant until deployed — setup:
     app-repos/3sverse-capture-worker/SETUP.md): stores contact/review
     submissions into the ledger repo (ledger/captures/…) BEFORE the email
     copy goes out, so the seller keeps the full history. The forms try it
     first and silently skip it while it is offline. Must match the
     orderInboxUrl workers.dev account. */
  captureContactUrl: 'https://3sverse-capture.abaduchanna.workers.dev/contact',
  captureReviewUrl: 'https://3sverse-capture.abaduchanna.workers.dev/review',
  /* Turnstile-gated free-trial entry (worker /trial → public GitHub release).
     Only used when TURNSTILE_SITE_KEY is set below. */
  trialUrl: 'https://3sverse-downloads.abaduchanna.workers.dev/trial',
  contactRelayUrl: 'https://3sverse-downloads.abaduchanna.workers.dev/contact',
  label: 'Download your licensed software',
  note: 'Enter the order number from your invoice (3SV-…).',
  contactEmail: 'Connect@3SVerse.com',
} as const;

/**
 * Cloudflare Turnstile site key (public by design) — bot protection for the
 * contact/review forms, the order intake and BOTH download paths. Create one
 * free: dash.cloudflare.com → Turnstile → Add site (domain: 3sverse.com) →
 * copy the Site Key here, and the widget's SECRET key into the download-
 * gateway worker env (TURNSTILE_SECRET_KEY), then redeploy both. While ''
 * no widget renders, forms post as before and trial links go straight to
 * GitHub. See download/3sverse-download-gateway/README.md for the checklist.
 */
export const TURNSTILE_SITE_KEY = '';

/**
 * Full Bundle value deal — buy one complete bundle and receive a second
 * complete bundle license free. Each bundle license runs all three tools on
 * one Windows PC, so one purchase covers two PCs. The storefront hides the
 * PC picker on the bundle card and states the inclusion clearly.
 */
export const BUNDLE_EACH = 2;

export function bundleLicenseNote(): string {
  return 'buy one complete bundle, get a second bundle license free — all 3 tools on 2 PCs';
}

/**
 * Lemon Squeezy hosted checkout URLs — the AUTOMATED sales path.
 *
 * Key format: `${productId}:${model}`. The store card renders a "Buy now"
 * button whenever a URL exists for the selected product + model. Card,
 * PayPal, Apple Pay and Google Pay are handled on Lemon Squeezy's SSL page,
 * and the 3sverse-webhooks worker (LS webhook -> branded invoice email ->
 * paid -> Ed25519 key -> private ledger) delivers license keys AUTOMATICALLY
 * right after payment — no manual step.
 *
 * The manual "Add + Place order" flow (bank transfer / Wise / PayPal / USDT
 * receipt) stays available for every product: it is the fallback for
 * PC-volume quotes and invoice customers.
 *
 * Phase 3 (2026-10-06, store went LIVE): the store passed Lemon Squeezy
 * approval, so all 12 SKUs were RE-CREATED as real (non-test) products via
 * the Bridge dashboard automation — the old test-mode products below stayed
 * test data and are replaced here by the live checkouts scraped from the
 * public store page. Same names, same prices (lifetime charges the
 * $999-per-tool / $2,499-bundle price point — during AND after the launch
 * offer; the launch window only shows the strikethrough savings vs the old
 * $1,299/$1,499/$1,699 list).
 * The 3sverse-webhooks worker maps each variant to the right plan
 * (per-tool keys license only that tool; bundle keys license all three).
 */
export const LS_CHECKOUT: Record<string, string> = {
  /* Full Bundle (live products 1416630 / 1416636 / 1416648) */
  'bundle:monthly': 'https://3sverse.lemonsqueezy.com/checkout/buy/6ea77a18-4d29-4e19-b2f6-4566c216b488',
  'bundle:annual': 'https://3sverse.lemonsqueezy.com/checkout/buy/52ae7bbb-27c6-4c9f-862b-7a48a6e8c1bb',
  'bundle:lifetime': 'https://3sverse.lemonsqueezy.com/checkout/buy/7f7ac4ab-b98d-44ea-b3d2-770bfe2afe6d',
  /* VidaPay Incentive Extractor (live products 1416470 / 1416484 / 1416496) */
  'extractor:monthly': 'https://3sverse.lemonsqueezy.com/checkout/buy/ed9deb2d-24b3-4462-95ed-7d5be5e9b50b',
  'extractor:annual': 'https://3sverse.lemonsqueezy.com/checkout/buy/6b69569a-d5aa-4d31-80e0-ea59eb2d2434',
  'extractor:lifetime': 'https://3sverse.lemonsqueezy.com/checkout/buy/1d9e8a4e-06b9-4c03-a83b-8b16bec7cb8a',
  /* VidaPay Device Ordering (live products 1416532 / 1416543 / 1416562) */
  'ordering:monthly': 'https://3sverse.lemonsqueezy.com/checkout/buy/e8aa4316-ee84-40b3-abdb-68fe8baada38',
  'ordering:annual': 'https://3sverse.lemonsqueezy.com/checkout/buy/35349166-a681-4da9-a58f-b817e9f95672',
  'ordering:lifetime': 'https://3sverse.lemonsqueezy.com/checkout/buy/a8ff048b-c853-4392-9543-70a615f8762d',
  /* VidaPay Rebate Filing (live products 1416570 / 1416608 / 1416619) */
  'rebate:monthly': 'https://3sverse.lemonsqueezy.com/checkout/buy/860827c8-01b5-457a-ba4f-f64ebc1b50fc',
  'rebate:annual': 'https://3sverse.lemonsqueezy.com/checkout/buy/4b7e1637-163b-4fc5-9607-408d49c734a2',
  'rebate:lifetime': 'https://3sverse.lemonsqueezy.com/checkout/buy/72a1525e-5da7-41ad-87f2-666d32e8bb1c',
};

/** LS hosted-checkout URL for a product+model, '' when not automated yet. */
export function lsCheckoutUrl(productId: string, model: string): string {
  return LS_CHECKOUT[`${productId}:${model}`] ?? '';
}

export const PRODUCTS: Product[] = [
  {
    id: 'extractor',
    name: 'VidaPay Incentive Extractor',
    tagline: 'IMEI-level incentive & activation extraction, store by store.',
    features: [
      'Per-store incentive dashboards in one run',
      'IMEI + activation detail export',
      'One-click Excel workbook output',
      'Runs under your own dealer login — portal security checks stay user-controlled',
    ],
    /* Owner 2026-10-08: monthly sale 89 (list 149 returns Nov 1) + the $999
       per-tool lifetime price point (standing price from Nov 1). The list
       anchors are what the strikethrough/discount badges compare against. */
    prices: { trial: 0, monthly: 149, annual: 599, lifetime: 1299 },
    launchPrices: { trial: 0, monthly: 89, lifetime: 999 },
    postLaunchPrices: { lifetime: 999, monthly: 149 },
  },
  {
    id: 'ordering',
    name: 'VidaPay Device Ordering',
    tagline: 'Guided device ordering with store login management.',
    features: [
      'Store-by-store ordering flow',
      'Built-in store login manager',
      'Portal verification steps pause for your approval — nothing bypasses you',
      'Runs on a second screen with limited supervision',
    ],
    prices: { trial: 0, monthly: 149, annual: 599, lifetime: 1499 },
    launchPrices: { trial: 0, monthly: 89, lifetime: 999 },
    postLaunchPrices: { lifetime: 999, monthly: 149 },
  },
  {
    id: 'rebate',
    name: 'VidaPay Rebate Filing',
    tagline: 'Bulk rebate claim filing with per-claim status tracking.',
    features: [
      'Bulk claim filing from Excel',
      'Claim templates + validation',
      'Store login management built in',
      'Per-claim status tracking',
    ],
    prices: { trial: 0, monthly: 149, annual: 699, lifetime: 1699 },
    launchPrices: { trial: 0, monthly: 89, lifetime: 999 },
    postLaunchPrices: { lifetime: 999, monthly: 149 },
  },
  {
    id: 'bundle',
    name: 'VidaPay Full Bundle',
    tagline: 'Buy one complete bundle and get a second bundle license free. Use all three tools on two Windows PCs.',
    features: [
      'Incentive Extractor + Device Ordering + Rebate Filing',
      'Two complete bundle licenses for the price shown',
      'All three tools on each of two Windows PCs',
      'Priority support',
    ],
    /* Owner 2026-10-08: bundle monthly = $300 now, $450 list returns Nov 1.
       Lifetime LIST = $2,997 (the 3-tools-separately math used across the
       site) so the $2,499 launch price keeps its strikethrough anchor
       (−17% badge, same as the per-tool cards); from Nov 1 the post-launch
       $2,499 stands alone. */
    prices: { trial: 0, monthly: 450, annual: 999, lifetime: 2997 },
    launchPrices: { trial: 0, monthly: 300, lifetime: 2499 },
    postLaunchPrices: { lifetime: 2499, monthly: 450 },
  },
];

/** PCs allowed per model — trials are always exactly 1 PC. */
export function seatsAllowedForModel(model: ModelId): PcCount[] {
  return model === 'trial' ? [1] : [
    ...Array.from({ length: PC_MAX - PC_MIN + 1 }, (_, i) => i + PC_MIN),
  ];
}

/** Annual-plan savings vs the CURRENT effective monthly price (launch-aware:
 *  vs the $89/$300 sale today, vs the $149/$450 list after it ends) — the
 *  “save X% vs monthly” line never lies on either side of Nov 1. */
export function annualSavingsPct(product: Product): number {
  const m = perPcPrice(product, 'monthly', 1);
  if (m <= 0) return 0;
  return Math.round((1 - product.prices.annual / (m * 12)) * 100);
}

/** Best annual savings across the catalog (the “save up to X%” copy). */
export function maxAnnualSavingsPct(): number {
  return Math.max(...PRODUCTS.map((p) => annualSavingsPct(p)));
}

/** Billing-model pills — notes computed from the catalog so the monthly
 *  price and the annual savings % update themselves when the launch window
 *  ends (owner 2026-10-08: math must stay correct without manual edits). */
export const MODELS: ModelOption[] = (() => {
  const perTool = PRODUCTS.find((p) => p.id === 'extractor')!;
  return [
    { id: 'trial', label: '7-Day Free Trial', note: 'Full features, 7 days, 1 PC — no card needed' },
    { id: 'monthly', label: 'Monthly', note: `$${perPcPrice(perTool, 'monthly', 1)}/mo per tool — cancel anytime` },
    { id: 'annual', label: 'Annual', note: `Save up to ${maxAnnualSavingsPct()}% vs monthly — every update included` },
    { id: 'lifetime', label: 'Lifetime', note: 'Founding-customer launch price — pay once, runs forever. Includes 1 year of portal-change updates; after that an optional $199/yr update plan (your installed copy never stops working).' },
  ] as ModelOption[];
})();

/** Effective per-PC price after launch offer + volume tier (whole USD). */
export function perPcPrice(product: Product, model: ModelId, pcs: number): number {
  const tier = volumeTier(pcs);
  let eff = activeListPrice(product, model);
  if (launchLive()) {
    const launch = product.launchPrices?.[model];
    if (typeof launch === 'number') eff = launch;
  }
  return Math.round(eff * tier.multiplier);
}

/** Price with NO promotion applied, for the whole license (per-PC list × PCs).
 *  Uses the ACTIVE list — during launch the original list (strikethrough
 *  anchor), after it ends the post-launch price point. */
export function listPrice(product: Product, model: ModelId, pcs: number): number {
  const base = activeListPrice(product, model);
  return Math.round(base * Math.max(PC_MIN, pcs || PC_MIN));
}

/** Total price for one license line (per-PC effective × PCs). */
export function unitPrice(product: Product, model: ModelId, pcs: number): number {
  return perPcPrice(product, model, pcs) * Math.max(PC_MIN, pcs || PC_MIN);
}

/** Percent off the per-PC list price (launch offer + volume combined; 0 when none). */
export function discountPercent(product: Product, model: ModelId, pcs: number): number {
  const base = activeListPrice(product, model);
  if (base <= 0) return 0;
  const eff = perPcPrice(product, model, pcs);
  if (eff >= base) return 0;
  return Math.round((1 - eff / base) * 100);
}

export function productById(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

/** Launch window check — auto-expires at endsAt, so the storefront, the
 *  Pricing page and the server order API all flip to the post-launch price
 *  point ($999 per tool / $2,499 bundle) on Nov 1 with no manual step. */
export function launchLive(now: number = Date.now()): boolean {
  if (!LAUNCH_OFFER.active) return false;
  if (!LAUNCH_OFFER.endsAt) return true;
  return now <= new Date(LAUNCH_OFFER.endsAt).getTime();
}

/** The list price in force RIGHT NOW: during the launch window this is the
 *  original list (the strikethrough anchor); after it ends, the post-launch
 *  price point takes over automatically when one is defined. */
export function activeListPrice(product: Product, model: ModelId): number {
  if (!launchLive()) {
    const post = product.postLaunchPrices?.[model];
    if (typeof post === 'number') return post;
  }
  return product.prices[model] ?? 0;
}

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * VERIFIED REVIEWS — how this works (audit fix: anonymous testimonials kill
 * trust, so the site ships with ZERO invented reviews).
 *
 * 1. A dealer submits the review form on the site (#reviews).
 * 2. The submission lands in the Connect@3SVerse.com inbox
 *    (subject: "New dealer review — ...").
 * 3. Verify the person against your license records, then — and only then —
 *    add an entry below and redeploy. It appears on the site instantly.
 *
 * Publish the reviewer's FIRST NAME + store/city at minimum (audit: named
 * reviews are 3x more persuasive; anonymous ones read as fabricated).
 * Leave the array empty to keep the honest "no published reviews yet" state.
 */
export interface DealerReview {
  /** The review text, as the dealer wrote it (lightly formatted is fine). */
  quote: string;
  /** First name + last initial, e.g. 'John D.' */
  name: string;
  /** Store/city line, e.g. 'Total Wireless dealer · Houston, TX' */
  org: string;
  /** Two-letter avatar, e.g. 'JD' */
  initials: string;
  /** 1–5 stars the dealer gave. */
  stars: number;
  /** Month/year published, e.g. 'Oct 2026'. */
  date: string;
}

export const REVIEWS: DealerReview[] = [
  {
    quote: 'Time saving tools, it\'s great for daily tasks.',
    name: 'Reportify Solutions',
    org: 'VidaPay Full Bundle · Houston, TX',
    initials: 'RS',
    stars: 4,
    date: 'Sep 2026',
  },
];
