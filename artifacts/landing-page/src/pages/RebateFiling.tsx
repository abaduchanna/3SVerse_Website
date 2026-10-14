/**
 * VidaPay Rebate Filing landing page (#/rebate-filing → canonical /vidapay-rebate-filing/).
 *
 * Purpose (SEO, 2026-10-15): the Leados scan flagged "VidaPay rebate filing
 * automation" and "how to file rebates on VidaPay" as not-ranked search gaps.
 * This page targets both phrases with VISIBLE, accurate content — every claim
 * here comes from the tool's actual behavior (VidaPay_Rebate_Filing README:
 * Activations & Commissions flow, appeal fields, Excel log) and the site
 * catalog. Nothing invented — site rule: fake content is not allowed.
 */
import PageShell from './PageShell';
import { ArrowRight, CheckCircle2, FileSpreadsheet, ListChecks, LockKeyhole, Store } from 'lucide-react';

const HOW_TO_STEPS: Array<{ name: string; text: string }> = [
  {
    name: 'Sign in to the VidaPay portal for the store',
    text: 'Open portal.vidapay.com and sign in with that store\u2019s dealer login. Cloudflare/reCAPTCHA checks and 2FA are completed by you, on your side of the screen.',
  },
  {
    name: 'Open the Activations & Commissions page',
    text: 'Rebate and appeal claims are filed from the portal\u2019s reporting section: reporting \u2192 Activations and Commissions.',
  },
  {
    name: 'Click "Create an appeal" for the claim',
    text: 'For the activation you are claiming, start a new appeal on that page.',
  },
  {
    name: 'Fill IMEI, activation date, type, amount and comments',
    text: 'Select "IMEI and Activation Date" as the appeal type, then fill in the IMEI, the activation date (MM/DD/YYYY), the claim type, the claim amount and any comments.',
  },
  {
    name: 'Submit and record the result',
    text: 'Submit the appeal and note whether it came back Submitted or Failed, so failed claims can be retried and nothing falls through the cracks.',
  },
];

const AUTOMATION_POINTS: Array<{ icon: typeof FileSpreadsheet; title: string; body: string }> = [
  {
    icon: FileSpreadsheet,
    title: 'Bulk filing from Excel',
    body: 'Bring your claim rows into the tool\u2019s Excel template — IMEI, activation date, type, claim amount, comments — and it files them claim by claim on the Activations & Commissions page, per store.',
  },
  {
    icon: ListChecks,
    title: 'Validation before anything is filed',
    body: 'Required-field checks run before submission, so a row with a missing IMEI or claim amount is caught at import — not after a failed portal submission.',
  },
  {
    icon: Store,
    title: 'Store login management built in',
    body: 'Every store signs in through the same portal sign-in flow used across the 3SVerse tools — Cloudflare/reCAPTCHA and 2FA stay user-controlled, and the tool pauses for your approval where the portal requires it.',
  },
  {
    icon: CheckCircle2,
    title: 'Per-claim status tracking',
    body: 'Submitted and failed claims are recorded as the run happens, and a complete Excel log is written to Documents\\VidaPay Rebate Filing\\rebate_filing_log_<date>.xlsx for follow-up.',
  },
];

const FEATURES = [
  'Bulk claim filing from Excel',
  'Claim templates + validation',
  'Store login management built in',
  'Per-claim status tracking',
];

const FAQ_ITEMS: Array<{ q: string; a: string }> = [
  {
    q: 'Does it run under my own VidaPay login?',
    a: 'Yes. Everything runs on your own Windows PC under your own dealer login. Your VidaPay credentials stay on your machine, portal security checks stay user-controlled, and each license is machine-locked to the PC you activate it on.',
  },
  {
    q: 'Can I file rebate claims for every store at once?',
    a: 'Yes — bulk claim filing across every branch is the default. Each store signs in with its own login, and claims are filed IMEI by IMEI with a per-claim status record kept the whole way.',
  },
  {
    q: 'What happens to claims that fail?',
    a: 'Failed claims are detected during the run and recorded — both in the app and in the Excel log written to Documents\\VidaPay Rebate Filing\\rebate_filing_log_<date>.xlsx — so you can fix the row and retry without losing track.',
  },
  {
    q: 'What are the requirements?',
    a: 'Windows 10 or 11, Microsoft Edge (the automation runs on Edge), and VPN connected for portal access. The installer is a Windows executable — no development setup required.',
  },
  {
    q: 'Is there a free trial?',
    a: 'Yes — the full software is free for 7 days on 1 PC, no card required. After the trial, monthly, annual and lifetime plans are available, including a Full Bundle that covers all three VidaPay tools.',
  },
];

const HOWTO_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'How to file rebates on VidaPay',
  description: 'The VidaPay appeal-filing workflow for wireless dealers, step by step — the exact process the 3SVerse rebate filing automation tool runs for you.',
  step: HOW_TO_STEPS.map((s, i) => ({
    '@type': 'HowToStep',
    position: i + 1,
    name: s.name,
    text: s.text,
  })),
};

const FAQ_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

const APP_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'VidaPay Rebate Filing — 3SVerse',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Windows 10, Windows 11',
  featureList: FEATURES,
  description: 'Bulk VidaPay rebate claim filing automation for wireless dealers: file appeals IMEI by IMEI from Excel, with validation, store login management and per-claim status tracking.',
  offers: {
    '@type': 'AggregateOffer',
    lowPrice: '0',
    highPrice: '999',
    priceCurrency: 'USD',
    offerCount: '4',
  },
};

export default function RebateFiling() {
  return (
    <PageShell
      title="VidaPay rebate filing automation for wireless dealers"
      kicker="VidaPay Rebate Filing"
      metaLine={<>Free 7-day trial &middot; Windows 10/11 &middot; Questions: <a className="normal-case text-brand-cyan hover:underline" href="mailto:Connect@3SVerse.com">Connect@3SVerse.com</a></>}
    >
      <script type="application/ld+json">{JSON.stringify(HOWTO_JSONLD)}</script>
      <script type="application/ld+json">{JSON.stringify(FAQ_JSONLD)}</script>
      <script type="application/ld+json">{JSON.stringify(APP_JSONLD)}</script>

      {/* Lede */}
      <div className="mt-8 space-y-4 text-[15px] font-light leading-7 text-foreground/75">
        <p>
          Filing rebate claims on VidaPay is precise, repetitive work: for every IMEI you open
          the appeal form on the Activations &amp; Commissions page, type the same fields again,
          submit, and hope the result was recorded. Done by hand across a week of activations,
          it turns into hours at the desk — and one retyped IMEI is one wrong claim.
        </p>
        <p>
          <strong className="font-medium text-foreground">VidaPay Rebate Filing by 3SVerse</strong> is
          rebate filing automation for wireless dealers: it files rebate and appeal claims for
          every store, IMEI by IMEI, from your Excel sheet — with required-field validation
          before submission, per-claim status tracking during the run, and an Excel log of every
          submitted and failed claim afterwards.
        </p>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <a
          href="#/download"
          className="inline-flex items-center gap-2 rounded-xl bg-brand-cyan px-5 py-3 text-[13.5px] font-medium text-background transition-opacity hover:opacity-90"
        >
          Start the free 7-day trial <ArrowRight className="h-4 w-4" />
        </a>
        <a
          href="#/pricing"
          className="inline-flex items-center gap-2 rounded-xl border border-input px-5 py-3 text-[13.5px] font-medium text-foreground transition-colors hover:border-foreground/40"
        >
          See pricing
        </a>
      </div>

      {/* How-to — the exact manual workflow, so dealers searching for it get the real answer */}
      <section className="mt-16">
        <div className="font-mono-tech text-[10px] uppercase tracking-[.3em] text-brand-cyan">The manual workflow</div>
        <h2 className="mt-3 text-[clamp(1.6rem,3vw,2.4rem)] font-light leading-[1.12] tracking-[-0.02em]">
          How to file rebates on VidaPay
        </h2>
        <p className="mt-4 max-w-2xl text-[15px] font-light leading-7 text-foreground/70">
          This is the process, step by step, exactly as the portal works today — the same
          sequence the tool automates on your behalf.
        </p>
        <ol className="mt-8 space-y-4">
          {HOW_TO_STEPS.map((step, i) => (
            <li key={step.name} className="flex gap-4 rounded-2xl border border-border bg-card p-5">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-brand-cyan/40 font-mono-tech text-[11px] text-brand-cyan">
                {i + 1}
              </span>
              <div>
                <h3 className="text-[15px] font-medium leading-6 text-foreground">{step.name}</h3>
                <p className="mt-1.5 text-[13.5px] font-light leading-6 text-muted-foreground">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-6 max-w-2xl text-[13.5px] font-light leading-6 text-muted-foreground">
          Multiply that by dozens of IMEIs per store per week and the case for automation writes
          itself. The tool below runs this exact sequence for you — nothing about the claim
          changes, only who does the typing.
        </p>
      </section>

      {/* Automation mapping */}
      <section className="mt-16">
        <div className="font-mono-tech text-[10px] uppercase tracking-[.3em] text-brand-cyan">The automation</div>
        <h2 className="mt-3 text-[clamp(1.6rem,3vw,2.4rem)] font-light leading-[1.12] tracking-[-0.02em]">
          What the rebate filing automation does for you
        </h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {AUTOMATION_POINTS.map((point) => (
            <div key={point.title} className="h-full rounded-3xl border border-border bg-card p-7">
              <point.icon className="h-5 w-5 text-brand-cyan" />
              <h3 className="mt-4 text-[16px] font-medium leading-6 text-foreground">{point.title}</h3>
              <p className="mt-2.5 text-[13.5px] font-light leading-6 text-muted-foreground">{point.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Multi-store */}
      <section className="mt-16">
        <div className="font-mono-tech text-[10px] uppercase tracking-[.3em] text-brand-cyan">Multi-store</div>
        <h2 className="mt-3 text-[clamp(1.6rem,3vw,2.4rem)] font-light leading-[1.12] tracking-[-0.02em]">
          Built for multi-store dealerships
        </h2>
        <div className="mt-6 space-y-4 text-[15px] font-light leading-7 text-foreground/75">
          <p>
            All three 3SVerse tools were born inside a real multi-store wireless operation, so
            multi-store is the default, not an add-on: each store signs in with its own dealer
            login, claims are filed across every branch in bulk, and the status record is kept
            per claim so follow-up never depends on somebody\u2019s memory or a loose notebook.
          </p>
          <p>
            One PC can run every store you operate — most single-PC dealers need exactly one
            license. Extra licenses are only for extra workstations, and volume discounts apply
            automatically from the second PC.
          </p>
        </div>
      </section>

      {/* Security posture */}
      <section className="mt-16">
        <div className="font-mono-tech text-[10px] uppercase tracking-[.3em] text-brand-cyan">Trust</div>
        <h2 className="mt-3 text-[clamp(1.6rem,3vw,2.4rem)] font-light leading-[1.12] tracking-[-0.02em]">
          Automation that stays user-controlled
        </h2>
        <div className="mt-6 flex gap-4 rounded-2xl border border-border bg-card p-6">
          <LockKeyhole className="h-5 w-5 shrink-0 text-brand-cyan" />
          <p className="text-[14px] font-light leading-7 text-foreground/75">
            The tool runs on your own Windows PC under your own dealer login. Portal security
            checks — Cloudflare/reCAPTCHA, 2FA, verification steps — are completed by you and the
            tool pauses for your approval where the portal requires it. Nothing bypasses you, no
            credentials leave your machine, and there is no 3SVerse server holding your
            dealership data.
          </p>
        </div>
        <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-[14px] font-light leading-6 text-foreground/85">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-cyan" /> {f}
            </li>
          ))}
        </ul>
      </section>

      {/* FAQ */}
      <section className="mt-16">
        <div className="font-mono-tech text-[10px] uppercase tracking-[.3em] text-brand-cyan">FAQ</div>
        <h2 className="mt-3 text-[clamp(1.6rem,3vw,2.4rem)] font-light leading-[1.12] tracking-[-0.02em]">
          Rebate filing questions, answered
        </h2>
        <div className="mt-8 space-y-3">
          {FAQ_ITEMS.map((item) => (
            <details key={item.q} className="group rounded-2xl border border-border bg-card p-6">
              <summary className="cursor-pointer list-none text-[15px] font-medium leading-6 text-foreground marker:hidden">
                {item.q}
              </summary>
              <p className="mt-3 text-[13.5px] font-light leading-6 text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mt-16 rounded-3xl border border-border bg-card p-8">
        <h2 className="text-[clamp(1.4rem,2.6vw,2rem)] font-light leading-[1.15] tracking-[-0.02em]">
          See the filing run on your own store data
        </h2>
        <p className="mt-4 max-w-2xl text-[15px] font-light leading-7 text-foreground/75">
          The 7-day trial is the full software on 1 PC — no card, no feature gates. Load your
          own claim sheet, watch the first store file, and decide from there.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="#/download"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-cyan px-5 py-3 text-[13.5px] font-medium text-background transition-opacity hover:opacity-90"
          >
            Download the free trial <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="#/pricing"
            className="inline-flex items-center gap-2 rounded-xl border border-input px-5 py-3 text-[13.5px] font-medium text-foreground transition-colors hover:border-foreground/40"
          >
            Compare plans
          </a>
        </div>
      </section>
    </PageShell>
  );
}
