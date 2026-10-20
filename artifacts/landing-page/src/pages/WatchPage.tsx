/**
 * /watch/<slug>/ — ONE video per page. This is the watch page Google's
 * video indexing asks for: the player is the first and primary content,
 * the h1 is the exact video title, and generate-routes.mjs injects a
 * server-rendered VideoObject JSON-LD into the page head (no JS needed
 * for Google to read it).
 *
 * GSC context: validation for "Video isn't on a watch page" kept failing
 * while both demos lived on /demo and on the homepage. The homepage now
 * links poster images instead of embedding players, and each demo has a
 * dedicated watch page plus a video-sitemap entry pointing here.
 */
import { Download, ArrowRight, Youtube } from 'lucide-react';
import PageShell from '@/pages/PageShell';
import { DEMOS, YOUTUBE_URL } from '@/lib/catalog';

export default function WatchPage({ slug }: { slug: string }) {
  const demo = DEMOS.find((d) => d.slug === slug) ?? DEMOS[0];
  return (
    <PageShell
      kicker="Product demo"
      title={demo.title}
      metaLine="Recorded from the real app — no mockups, no marketing polish."
      width="max-w-4xl"
    >
      <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-black">
        <div className="relative aspect-video w-full">
          <iframe
            src={`https://www.youtube.com/embed/${demo.id}`}
            title={demo.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        </div>
      </div>
      <p className="mt-3 font-mono-tech text-[10px] uppercase tracking-[.22em] text-muted-foreground">
        Runtime {demo.dur}
      </p>

      <p className="mt-4 max-w-2xl text-[15px] font-light leading-7 text-foreground/75">
        {demo.blurb} This is the same software the free 7-day trial installs —
        nothing to sign up for to watch.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <a
          href="/download/"
          data-testid="watch-cta-download"
          className="inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-3 text-[13.5px] font-semibold text-background transition-transform hover:scale-[1.02]"
        >
          <Download className="h-4 w-4" /> Download the free trial
        </a>
        <a
          href="/demo/"
          data-testid="watch-all-demos"
          className="inline-flex items-center gap-2 rounded-xl border border-input px-5 py-3 text-[13.5px] font-medium text-foreground transition-colors hover:border-brand-cyan/60 hover:text-brand-cyan"
        >
          All demos <ArrowRight className="h-4 w-4" />
        </a>
        <a
          href={YOUTUBE_URL}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="watch-cta-youtube"
          className="inline-flex items-center gap-2 px-2 py-3 text-[13.5px] font-medium text-foreground/85 transition-colors hover:text-brand-cyan"
        >
          <Youtube className="h-4 w-4" /> Watch on YouTube — @3SVerse
        </a>
      </div>

      <p className="mt-10 text-[12.5px] font-light leading-5 text-muted-foreground">
        3S Verse is an independent software provider and is not affiliated with,
        endorsed by, or sponsored by VidaPay, T-CETRA, Total Wireless, or their
        parent companies.
      </p>
    </PageShell>
  );
}
