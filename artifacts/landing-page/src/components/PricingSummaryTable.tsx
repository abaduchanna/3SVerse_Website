/**
 * One-glance pricing summary table (audit v6 #2: pricing numbers were spread
 * across sections — "one clean table that answers every pricing question in
 * 10 seconds"). Rendered at the top of the storefront and the Pricing page.
 *
 * All values are computed from catalog.ts — launch-aware, so the
 * "Monthly (now)" column flips itself on Nov 1 with no manual edits, and the
 * Lifetime column shows "(unchanged Nov 1)" because it is the same on both
 * sides of the deadline (audit v6 #1: lifetime buyers must not be spooked by
 * a countdown that does not apply to them).
 */
import { PRODUCTS, formatUSD, launchLive, type Product } from '@/lib/catalog';

function colPrices(p: Product) {
  const live = launchLive();
  const monthlyNow = live
    ? (p.launchPrices?.monthly ?? p.prices.monthly)
    : (p.postLaunchPrices?.monthly ?? p.prices.monthly);
  const monthlyNov1 = p.postLaunchPrices?.monthly ?? p.prices.monthly;
  const lifetimeNow = live
    ? (p.launchPrices?.lifetime ?? p.prices.lifetime)
    : (p.postLaunchPrices?.lifetime ?? p.prices.lifetime);
  const lifetimeNov1 = p.postLaunchPrices?.lifetime ?? p.prices.lifetime;
  return { monthlyNow, monthlyNov1, lifetimeNow, lifetimeNov1 };
}

export default function PricingSummaryTable() {
  return (
    <div data-testid="pricing-summary-table" className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13.5px]">
          <thead>
            <tr className="border-b border-border font-mono-tech text-[10px] uppercase tracking-[.18em] text-muted-foreground">
              <th className="px-5 py-3.5 font-normal">Tool</th>
              <th className="px-5 py-3.5 font-normal">Monthly (now)</th>
              <th className="px-5 py-3.5 font-normal">Monthly (Nov 1)</th>
              <th className="px-5 py-3.5 font-normal">Lifetime</th>
            </tr>
          </thead>
          <tbody>
            {PRODUCTS.map((p) => {
              const { monthlyNow, monthlyNov1, lifetimeNow, lifetimeNov1 } = colPrices(p);
              const isBundle = p.id === 'bundle';
              const lifetimeUnchanged = lifetimeNow === lifetimeNov1;
              return (
                <tr key={p.id} className="border-b border-border last:border-b-0" data-testid={`pricing-row-${p.id}`}>
                  <td className="px-5 py-3.5 font-medium text-foreground">{p.name}</td>
                  <td className="px-5 py-3.5 text-foreground/85">{formatUSD(monthlyNow)}/mo</td>
                  <td className="px-5 py-3.5 text-foreground/85">{formatUSD(monthlyNov1)}/mo</td>
                  <td className="px-5 py-3.5 text-foreground/85">
                    {formatUSD(lifetimeNow)}
                    {isBundle ? <span className="ml-1.5 whitespace-nowrap text-[11.5px] text-muted-foreground">· covers 2 PCs</span> : null}
                    {lifetimeUnchanged ? <span className="ml-1.5 whitespace-nowrap text-[11.5px] text-muted-foreground">(unchanged Nov 1)</span> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-border px-5 py-3 text-[11.5px] font-light leading-5 text-muted-foreground">
        One row per product — the whole price picture in one glance. Only the monthly rate goes up on Nov 1;
        lifetime prices stay where they are. Lifetime = one-time payment, permanent use, 1 year of updates included.
      </p>
    </div>
  );
}
