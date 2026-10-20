/**
 * /demo — dedicated video watch page (hash-routed #/demo, generated as a
 * real /demo/ index.html by generate-routes.mjs so Google can index it).
 *
 * WHY THIS PAGE EXISTS: the VidaPay overview MP4 used to be embedded on the
 * homepage as a native <video> (GitHub release asset). Google's video
 * indexing flagged the homepage with "Video isn't on a watch page" — the
 * homepage is not a watch page, and the release asset later vanished from
 * the rolling "latest" release (404 for visitors). The demos live on the
 * 3SVerse YouTube channel, so this page embeds them as the MAIN content.
 *
 * GSC follow-up (2026-10-20): validation still failed because a page with
 * TWO videos + marketing copy is not a per-video watch page. Each demo now
 * has a dedicated /watch/<slug>/ page (video as hero, VideoObject JSON-LD
 * injected server-side by generate-routes.mjs, video-sitemap entry), and
 * the homepage links posters instead of embedding players.
 */
import { PlayCircle, Download, ArrowRight, Youtube } from 'lucide-react';
import PageShell from '@/pages/PageShell';
import { DEMOS, YOUTUBE_URL } from '@/lib/catalog';

export default function DemoPage() {
  return (
    <PageShell
      kicker="Product demos"
      title="Watch the tools work."
      metaLine="Recorded from the real apps — no mockups, no marketing polish."
      width="max-w-4xl"
    >
      <p className="mt-5 max-w-2xl text-[15px] font-light leading-7 text-foreground/75">
        Every demo below is an unedited pass through the actual VidaPay dealer
        workflows: claims pulled from the portal, filed, and tracked; incentive
        data landing in a clean Excel sheet. This is the same software the free
        trial installs — there is nothing to sign up for to watch.
      </p>

      <div className="mt-10 space-y-10">
        {DEMOS.map((demo) => (
          <div key={demo.id} data-testid={`demo-video-${demo.id}`}>
            <div className="overflow-hidden rounded-2xl border border-border bg-black">
              <div className="relative aspect-video w-full">
                <iframe
                  src={`https://www.youtube.com/embed/${demo.id}`}
                  title={demo.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  loading="lazy"
                  className="absolute inset-0 h-full w-full"
                />
              </div>
            </div>
            <h2 className="mt-4 text-[19px] font-medium leading-6 text-foreground">{demo.title}</h2>
            <p className="mt-2 max-w-2xl text-[13.5px] font-light leading-6 text-foreground/70">{demo.blurb}</p>
            <p className="mt-1 font-mono-tech text-[10px] uppercase tracking-[.22em] text-muted-foreground">Runtime {demo.dur}</p>
            <a
              href={`/watch/${demo.slug}/`}
              data-testid={`demo-watch-page-${demo.slug}`}
              className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand-cyan transition-colors hover:text-foreground"
            >
              Permanent watch page — 3sverse.com/watch/{demo.slug}
            </a>
          </div>
        ))}
      </div>

      <div className="mt-12 rounded-2xl border border-border bg-card p-6">
        <p className="flex items-center gap-2 font-mono-tech text-[10px] uppercase tracking-[.22em] text-brand-cyan">
          <PlayCircle className="h-3.5 w-3.5" /> Like what you see?
        </p>
        <p className="mt-3 max-w-2xl text-[14px] font-light leading-7 text-foreground/75">
          The free 7-day trial is the full build — every tool, no feature caps,
          your own dealership data on your own PC. Windows 10/11, no installation.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <a
            href="/download/"
            data-testid="demo-cta-download"
            className="inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-3 text-[13.5px] font-semibold text-background transition-transform hover:scale-[1.02]"
          >
            <Download className="h-4 w-4" /> Download the free trial
          </a>
          <a
            href="/pricing/"
            data-testid="demo-cta-pricing"
            className="inline-flex items-center gap-2 rounded-xl border border-input px-5 py-3 text-[13.5px] font-medium text-foreground transition-colors hover:border-brand-cyan/60 hover:text-brand-cyan"
          >
            See pricing <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href={YOUTUBE_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="demo-cta-youtube"
            className="inline-flex items-center gap-2 px-2 py-3 text-[13.5px] font-medium text-foreground/85 transition-colors hover:text-brand-cyan"
          >
            <Youtube className="h-4 w-4" /> More on YouTube — @3SVerse
          </a>
        </div>
      </div>

      <p className="mt-8 text-[12.5px] font-light leading-5 text-muted-foreground">
        3S Verse is an independent software provider and is not affiliated with,
        endorsed by, or sponsored by VidaPay, T-CETRA, Total Wireless, or their
        parent companies.
      </p>
    </PageShell>
  );
}
