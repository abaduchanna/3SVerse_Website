/**
 * One-glance pricing summary table (audit v6 #2: pricing numbers were spread
 * across sections — "one clean table that answers every pricing question in
 * 10 seconds"). Rendered at the top of the storefront and the Pricing page.
 *
 * All values are computed from catalog.ts — launch-aware, so the Monthly
 * column always shows the rate in force right now and flips itself on Nov 1
 * with no manual edits.
 *
 * SIMPLIFIED (owner 2026-10-08, deep-audit: "too many options, tabs and
 * pricing cards"): the old "Monthly (now)" vs "Monthly (Nov 1)" split columns
 * are gone — one honest Monthly column + a one-line footnote carries the
 * Nov 1 change. Countdown-style urgency was removed from the store the same
 * day; the table stays pure pricing information. 3 billing options:
 * Monthly | Annual | Lifetime.
 */
import { PRODUCTS, formatUSD, launchLive, type Product } from '@/lib/catalog';

function colPrices(p: Product) {
  const live = launchLive();
  const monthly = live
    ? (p.launchPrices?.monthly ?? p.prices.monthly)
    : (p.postLaunchPrices?.monthly ?? p.prices.monthly);
  const lifetime = live
    ? (p.launchPrices?.lifetime ?? p.prices.lifetime)
    : (p.postLaunchPrices?.lifetime ?? p.prices.lifetime);
  return { monthly, lifetime };
}

export default function PricingSummaryTable() {
  return (
    <div data-testid="pricing-summary-table" className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13.5px]">
          <thead>
            <tr className="border-b border-border font-mono-tech text-[10px] uppercase tracking-[.18em] text-muted-foreground">
              <th className="px-5 py-3.5 font-normal">Tool</th>
              <th className="px-5 py-3.5 font-normal">Monthly</th>
              <th className="px-5 py-3.5 font-normal">Annual</th>
              <th className="px-5 py-3.5 font-normal">Lifetime</th>
            </tr>
          </thead>
          <tbody>
            {PRODUCTS.map((p) => {
              const { monthly, lifetime } = colPrices(p);
              const isBundle = p.id === 'bundle';
              return (
                <tr key={p.id} className="border-b border-border last:border-b-0" data-testid={`pricing-row-${p.id}`}>
                  <td className="px-5 py-3.5 font-medium text-foreground">{p.name}</td>
                  <td className="px-5 py-3.5 text-foreground/85">{formatUSD(monthly)}/mo</td>
                  <td className="px-5 py-3.5 text-foreground/85">{formatUSD(p.prices.annual)}/yr</td>
                  <td className="px-5 py-3.5 text-foreground/85">
                    {formatUSD(lifetime)}
                    {isBundle ? <span className="ml-1.5 whitespace-nowrap text-[11.5px] text-muted-foreground">· covers 2 PCs</span> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-border px-5 py-3 text-[11.5px] font-light leading-5 text-muted-foreground">
        One row per product — the whole price picture in one glance. Monthly rates go up on Nov 1; annual and lifetime
        prices stay where they are. Annual = billed once a year, cancel before renewal, every update included while
        active. Lifetime = one-time payment, permanent use, 1 year of updates included.
      </p>
    </div>
  );
}
