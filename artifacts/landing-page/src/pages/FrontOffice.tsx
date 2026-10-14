/**
 * Wireless dealer front office automation landing page (#/front-office →
 * canonical /front-office-automation/).
 *
 * Purpose (SEO, 2026-10-15): Leados scan flagged "wireless dealer front office
 * automation", "wireless dealer incentive tracking software" and "multi-store
 * wireless dealer reporting tools" as not-ranked gaps, plus "VidaPay tools for
 * wireless dealers". This page targets those phrases with visible, accurate
 * content drawn from the real product catalog (Incentive Extractor, Device
 * Ordering, Rebate Filing) and the site's own FAQ facts. Nothing invented.
 */
import PageShell from './PageShell';
import { ArrowRight, CheckCircle2, FileSpreadsheet, ShoppingCart, FileSignature, Boxes, LockKeyhole } from 'lucide-react';

const TOOLS: Array<{
  icon: typeof FileSpreadsheet;
  name: string;
  tagline: string;
  features: string[];
}> = [
  {
    icon: FileSpreadsheet,
    name: 'VidaPay Incentive Extractor',
    tagline: 'IMEI-level incentive & activation extraction, store by store.',
    features: [
      'Per-store incentive dashboards in one run',
      'IMEI + activation detail export',
      'One-click Excel workbook output',
      'Runs under your own dealer login',
    ],
  },
  {
    icon: ShoppingCart,
    name: 'VidaPay Device Ordering',
    tagline: 'Guided device ordering with store login management.',
    features: [
      'Store-by-store ordering flow',
      'Built-in store login manager',
      'Verification steps pause for your approval',
      'Runs on a second screen with limited supervision',
    ],
  },
  {
    icon: FileSignature,
    name: 'VidaPay Rebate Filing',
    tagline: 'Bulk rebate claim filing with per-claim status tracking.',
    features: [
      'Bulk claim filing from Excel',
      'Claim templates + validation',
      'Store login management built in',
      'Per-claim status tracking',
    ],
  },
];

const FAQ_ITEMS: Array<{ q: string; a: string }> = [
  {
    q: 'I run multiple stores. Will it keep up?',
    a: 'Yes — all three tools were born inside a real multi-store wireless operation: per-store dashboards, per-store ordering quantities, and bulk claim filing across every branch are the default. One PC can run every store you operate; extra licenses are only for extra workstations.',
  },
  {
    q: 'Do the tools run under my own VidaPay login?',
    a: 'Yes. Everything runs on your own Windows PC under your own dealer login. Your VidaPay credentials stay on your machine, portal security checks stay user-controlled, and each license is machine-locked to the PC you activate it on.',
  },
  {
    q: 'Is this a subscription?',
    a: 'Only if you want it to be. Monthly is cancel-anytime, annual is billed yearly with up to 72% off versus monthly, and lifetime is permanent use with 1 year of updates included. The Full Bundle covers all three tools.',
  },
  {
    q: 'What about inventory audits and reporting beyond the three tools?',
    a: '3SVerse also scopes custom workflows and operations dashboards around the files and systems your team already uses — inventory audits, aging reports and store or district reporting built on your approved data sources and KPIs.',
  },
];

const FAQ_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

const SUITE_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: '3SVerse VidaPay dealer tools',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Windows 10, Windows 11',
  description: 'Front office automation for wireless dealers: VidaPay Incentive Extractor, VidaPay Device Ordering and VidaPay Rebate Filing — multi-store by default, running under the dealer\u2019s own login.',
  featureList: [
    'Wireless dealer incentive tracking software — IMEI-level incentive and activation extraction',
    'Multi-store wireless dealer reporting tools — per-store dashboards and bulk claim filing across branches',
    'Guided VidaPay device ordering with store login management',
    'Bulk VidaPay rebate claim filing from Excel with per-claim status tracking',
  ],
  offers: {
    '@type': 'AggregateOffer',
    lowPrice: '0',
    highPrice: '2499',
    priceCurrency: 'USD',
    offerCount: '4',
  },
};

export default function FrontOffice() {
  return (
    <PageShell
      title="Wireless dealer front office automation"
      kicker="3SVerse for wireless dealers"
      metaLine={<>Free 7-day trial &middot; Windows 10/11 &middot; Questions: <a className="normal-case text-brand-cyan hover:underline" href="mailto:Connect@3SVerse.com">Connect@3SVerse.com</a></>}
    >
      <script type="application/ld+json">{JSON.stringify(SUITE_JSONLD)}</script>
      <script type="application/ld+json">{JSON.stringify(FAQ_JSONLD)}</script>

      {/* Lede */}
      <div className="mt-8 space-y-4 text-[15px] font-light leading-7 text-foreground/75">
        <p>
          The front office of a wireless dealership is where the money either moves or stalls:
          incentive reports pulled store by store, rebate claims filed IMEI by IMEI, device
          orders placed under the right store login, and the reporting that tells you what any
          location actually did this week. Most dealerships run all of it by hand — which means
          hours of portal work, retyped values, and follow-up that lives in somebody\u2019s notes.
        </p>
        <p>
          <strong className="font-medium text-foreground">3SVerse is front office automation for
          wireless dealers:</strong> a set of Windows tools that runs the VidaPay portal work for
          you — incentive extraction, device ordering and rebate filing — built by operators who
          ran wireless retail stores themselves, multi-store by default, and always under your
          own dealer login.
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

      {/* Suite overview — "VidaPay tools for wireless dealers" */}
      <section className="mt-16">
        <div className="font-mono-tech text-[10px] uppercase tracking-[.3em] text-brand-cyan">The toolkit</div>
        <h2 className="mt-3 text-[clamp(1.6rem,3vw,2.4rem)] font-light leading-[1.12] tracking-[-0.02em]">
          VidaPay tools for wireless dealers
        </h2>
        <p className="mt-4 max-w-2xl text-[15px] font-light leading-7 text-foreground/70">
          Three packaged tools cover the three portal jobs that eat the week. Buy them
          separately or as a Full Bundle — every plan starts with a free 7-day trial, no card
          needed.
        </p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((tool) => (
            <div key={tool.name} className="h-full rounded-3xl border border-border bg-card p-7">
              <tool.icon className="h-5 w-5 text-brand-cyan" />
              <h3 className="mt-4 text-[16px] font-medium leading-6 text-foreground">{tool.name}</h3>
              <p className="mt-1.5 text-[13.5px] font-light leading-6 text-muted-foreground">{tool.tagline}</p>
              <ul className="mt-4 space-y-2">
                {tool.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[12.5px] font-light leading-5 text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-cyan" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Incentive tracking — exact-phrase section */}
      <section className="mt-16">
        <div className="font-mono-tech text-[10px] uppercase tracking-[.3em] text-brand-cyan">Incentives</div>
        <h2 className="mt-3 text-[clamp(1.6rem,3vw,2.4rem)] font-light leading-[1.12] tracking-[-0.02em]">
          Wireless dealer incentive tracking software
        </h2>
        <div className="mt-6 space-y-4 text-[15px] font-light leading-7 text-foreground/75">
          <p>
            The <strong className="font-medium text-foreground">VidaPay Incentive Extractor</strong> is
            the incentive tracking half of the toolkit. It signs in to each store\u2019s VidaPay
            dashboard in one run — under that store\u2019s own dealer login — and pulls selected
            activation and incentive details down to the IMEI level into one organized Excel
            workbook.
          </p>
          <p>
            Instead of screenshots, repeated copying and spreadsheet combining, the report lands
            as a single one-click export your office can review, share and file. The portal
            security checks stay user-controlled: the tool never bypasses you, it queues the work
            and keeps you in the loop.
          </p>
        </div>
      </section>

      {/* Multi-store reporting — exact-phrase section */}
      <section className="mt-16">
        <div className="font-mono-tech text-[10px] uppercase tracking-[.3em] text-brand-cyan">Reporting</div>
        <h2 className="mt-3 text-[clamp(1.6rem,3vw,2.4rem)] font-light leading-[1.12] tracking-[-0.02em]">
          Multi-store wireless dealer reporting tools
        </h2>
        <div className="mt-6 space-y-4 text-[15px] font-light leading-7 text-foreground/75">
          <p>
            Multi-store is the default across the toolkit, not a premium tier: per-store
            dashboards in one run, per-store ordering quantities in the ordering flow, and bulk
            claim filing across every branch in the filing tool. The output of each run is an
            Excel workbook you keep — so your reporting lives in your own files, not inside a
            vendor\u2019s web app.
          </p>
          <p>
            Need reporting beyond the three packaged tools? 3SVerse scopes custom operations
            dashboards around your approved data sources and KPIs — inventory audits, aging
            reports, and store or district views built on the files your team already produces.
          </p>
        </div>
        <div className="mt-6 flex gap-4 rounded-2xl border border-border bg-card p-6">
          <Boxes className="h-5 w-5 shrink-0 text-brand-cyan" />
          <p className="text-[14px] font-light leading-7 text-foreground/75">
            Custom work starts from the same principle as the packaged tools: your data stays on
            your machines, the workflow is scoped around what your team already does, and the
            limits are stated before you pay.
          </p>
        </div>
      </section>

      {/* Trust */}
      <section className="mt-16">
        <div className="font-mono-tech text-[10px] uppercase tracking-[.3em] text-brand-cyan">Trust</div>
        <h2 className="mt-3 text-[clamp(1.6rem,3vw,2.4rem)] font-light leading-[1.12] tracking-[-0.02em]">
          Automation that stays under your control
        </h2>
        <div className="mt-6 flex gap-4 rounded-2xl border border-border bg-card p-6">
          <LockKeyhole className="h-5 w-5 shrink-0 text-brand-cyan" />
          <p className="text-[14px] font-light leading-7 text-foreground/75">
            Every tool runs on your own Windows PC under your own dealer login. Credentials stay
            on your machine, portal verification steps pause for your approval, licenses are
            machine-locked to the PCs you bought them for, and there is no 3SVerse server holding
            your dealership data.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-16">
        <div className="font-mono-tech text-[10px] uppercase tracking-[.3em] text-brand-cyan">FAQ</div>
        <h2 className="mt-3 text-[clamp(1.6rem,3vw,2.4rem)] font-light leading-[1.12] tracking-[-0.02em]">
          Front office automation questions, answered
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
          Hand your front office its hours back
        </h2>
        <p className="mt-4 max-w-2xl text-[15px] font-light leading-7 text-foreground/75">
          Start with the free 7-day trial of any tool — the full software on 1 PC, no card
          required — and see a real run on your own store data within days.
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
