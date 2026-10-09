/**
 * Download page (#/download, deep link /download) — the branded download
 * destination for the official portable VidaPay Windows executables.
 *
 * One build per tool: it opens as a free 7-day trial and a license key
 * unlocks the full version, so trial users and paid customers download
 * the same file. Checksums are fetched LIVE from the public downloads
 * repository's latest release (GitHub provides sha256 digests on release
 * assets), so the values shown always match the file a visitor downloads
 * right now — the builds re-publish on a fixed sync schedule.
 */
import { useEffect, useState } from 'react';
import { ArrowLeft, Check, FileDown, KeyRound, ShieldAlert, ShieldCheck } from 'lucide-react';
import TrialGateModal from '@/components/TrialGateModal';
import { savedTrialLead } from '@/lib/trialgate';

const RELEASES_API = 'https://api.github.com/repos/abaduchanna/3SVerse_Downloads/releases/latest';
const RELEASES_PAGE = 'https://github.com/abaduchanna/3SVerse_Downloads/releases/latest';
/* Deterministic per-file URLs: GitHub redirects /releases/latest/download/<name>
   to the newest release's asset — zero API calls, never rate-limited. The
   buttons must render even when the GitHub API is exhausted (60 req/hr per
   IP for anonymous callers); the API only enriches cards with live size and
   SHA-256, and its absence never blocks a download. */
const dlUrl = (name: string) =>
  `https://github.com/abaduchanna/3SVerse_Downloads/releases/latest/download/${name}`;

const KNOWN_EXES: Array<{ name: string; label: string }> = [
  { name: 'VidaPay_Incentive_Extractor.exe', label: 'VidaPay Incentive Extractor — 7-day trial included' },
  { name: 'VidaPay_Device_Ordering.exe', label: 'VidaPay Device Ordering — 7-day trial included' },
  { name: 'VidaPay_Rebate_Filing.exe', label: 'VidaPay Rebate Filing — 7-day trial included' },
];

/* Audit 4.5: a 60-second "how to activate your key in 3 steps" video on the
   download page eliminates ~90% of activation support requests.
   Shipped: self-hosted MP4 (3SVerse_Downloads release asset, tag "latest" —
   stable even if newer releases appear; Range/streaming verified). A .mp4 URL
   renders a native <video> player; paste a YouTube/Loom embed URL instead and
   the iframe branch takes over automatically. */
const ACTIVATION_VIDEO_URL = 'https://github.com/abaduchanna/3SVerse_Downloads/releases/download/latest/3SVerse_Activation_in_60_Seconds.mp4';
const ACTIVATION_VIDEO_POSTER = 'https://github.com/abaduchanna/3SVerse_Downloads/releases/download/latest/3SVerse_Activation_poster.jpg';

interface AssetMeta { size?: number; digest?: string }

function formatMB(bytes: number): string {
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function DownloadPage() {
  const [meta, setMeta] = useState<Record<string, AssetMeta> | null>(null);
  const [metaFailed, setMetaFailed] = useState(false);
  const [publishedAt, setPublishedAt] = useState('');
  /* NO direct downloads — every EXE (trials included) downloads only after
     the short form (TrialGateModal) is submitted successfully. A lead
     saved in this browser (from any earlier gated download) skips the form. */
  const [gateFor, setGateFor] = useState<{ name: string; label: string } | null>(null);

  const startDownload = (name: string) => {
    window.location.href = dlUrl(name);
  };

  const requestDownload = (name: string, label: string) => {
    if (savedTrialLead()) {
      startDownload(name);
      return;
    }
    setGateFor({ name, label });
  };

  const requestBundle = () => {
    if (savedTrialLead()) {
      window.open(RELEASES_PAGE, '_blank', 'noopener');
      return;
    }
    setGateFor({ name: '3SVerse_Downloads release list', label: 'Full Bundle — all three tools' });
  };

  useEffect(() => {
    document.title = 'Download — 3SVerse';
    window.scrollTo(0, 0);
    (async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(RELEASES_API, {
          headers: { Accept: 'application/vnd.github+json' },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!res.ok) throw new Error('release fetch failed');
        const data = (await res.json()) as { assets?: Array<AssetMeta & { name: string }>; published_at?: string };
        const byName: Record<string, AssetMeta> = {};
        for (const a of data.assets ?? []) {
          if (a.name.endsWith('.exe')) byName[a.name] = { size: a.size, digest: a.digest };
        }
        setMeta(byName);
        if (data.published_at) setPublishedAt(new Date(data.published_at).toUTCString());
      } catch {
        setMetaFailed(true);
      }
    })();
  }, []);


  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between gap-8 px-5 lg:px-8">
          <a href="#/" aria-label="3SVerse — home" className="flex items-center gap-2.5">
            <img src="/logo-240.webp" alt="3SVerse" width={240} height={57} className="h-7 w-auto" />
          </a>
          <a
            href="#/"
            data-testid="download-back"
            className="inline-flex items-center gap-2 rounded-xl border border-input px-3.5 py-2 text-[12.5px] font-medium text-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to site
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-24 pt-14">
        <div className="font-mono-tech text-[10px] uppercase tracking-[.3em] text-brand-cyan">
          One build each — free 7-day trial, license key unlocks full
        </div>
        <h1 className="mt-4 text-[clamp(2rem,4.5vw,3.2rem)] font-light leading-[1.08] tracking-[-0.02em]">
          Download the VidaPay tools.
        </h1>
        <p className="mt-5 text-[15px] font-light leading-7 text-foreground/75">
          Windows 10/11, your VidaPay dealer login, and Excel for the outputs — that is the whole checklist.
          Each download is the full software: open it and run — no installation, admin password, or IT setup. It runs as a 7-day
          trial on one PC, and the license key activates the plan you buy — there is no second download. Builds are hosted in our controlled public
          repository and re-published on a fixed sync schedule. Not sure it fits your setup? Run the free
          trial on your actual store data — you will know within the first session, no card, no guesswork.
        </p>

        <div className="mt-7 flex flex-wrap gap-x-7 gap-y-2.5 border-t border-border pt-5 font-mono-tech text-[11px] uppercase tracking-[.16em] text-muted-foreground">
          <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#c7ef70]" /> No credit card · download, run, done</span>
          <span className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-brand-cyan" /> Always the latest version — automatically</span>
          <span className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-brand-cyan" /> Your license is protected — it&apos;s yours</span>
        </div>

        {metaFailed && (
          <div className="mt-8 rounded-2xl border border-amber-400/30 bg-amber-400/[.06] p-5 text-[13.5px] leading-6 text-foreground">
            Live checksums and file sizes are temporarily unavailable (GitHub API limit hit on this network).
            The apps below are always the current builds — download normally, and verify the SHA-256 on the{' '}
            <a className="text-brand-cyan hover:underline" href={RELEASES_PAGE} target="_blank" rel="noopener noreferrer">
              releases page
            </a>.
          </div>
        )}

        <div className="mt-10 space-y-4" data-testid="download-list">
          {KNOWN_EXES.map(({ name, label }) => {
            const m = meta?.[name];
            const sha = (m?.digest ?? '').replace(/^sha256:/, '');
            return (
              <div
                key={name}
                data-testid={`dl-${name}`}
                className="rounded-2xl border border-border bg-card p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[15.5px] font-medium text-foreground">{label}</div>
                    <div className="mt-1 font-mono-tech text-[10px] uppercase tracking-[.16em] text-muted-foreground">
                      {name}{typeof m?.size === 'number' ? ` · ${formatMB(m.size)}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => requestDownload(name, label)}
                    data-testid={`dl-button-${name}`}
                    className="inline-flex items-center gap-2 rounded-xl border bg-white px-5 py-3 text-[13.5px] font-semibold text-[#0b0a10] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#f7f3e8]"
                  >
                    <FileDown className="h-4 w-4" /> Download (.exe)
                  </button>
                </div>
                {sha ? (
                  <div className="mt-4 border-t border-border pt-3">
                    <div className="font-mono-tech text-[9px] uppercase tracking-[.18em] text-muted-foreground">
                      SHA-256 — verify before running
                    </div>
                    <code
                      data-testid={`sha-${name}`}
                      className="mt-1 block break-all font-mono-tech text-[11px] leading-5 text-foreground/85"
                    >
                      {sha}
                    </code>
                  </div>
                ) : null}
              </div>
            );
          })}

            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[15.5px] font-medium text-foreground">Full Bundle — buy one complete bundle and get a second bundle license free</div>
                  <div className="mt-1 font-mono-tech text-[10px] uppercase tracking-[.16em] text-muted-foreground">
                    All three tools on two Windows PCs
                  </div>
                </div>
                <button
                  type="button"
                  onClick={requestBundle}
                  data-testid="dl-button-bundle"
                  className="inline-flex items-center gap-2 rounded-xl border border-input px-5 py-3 text-[13.5px] font-semibold text-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
                >
                  <FileDown className="h-4 w-4" /> Release list
                </button>
              </div>
            </div>
          </div>

        {/* Audit v4 #1 (fix first): the single biggest abandonment point for non-technical
            users is the Windows SmartScreen warning on first run of an unsigned download.
            Call it out BEFORE it happens — exact dialog mock + the 2-click pass, framed
            confidently, not apologetically. Swap the mock for a real annotated screenshot
            anytime by replacing this block. */}
        <div className="mt-10 rounded-2xl border border-border bg-card p-6" data-testid="download-smartscreen">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="h-4 w-4 text-brand-cyan" />
            <h2 className="text-[15px] font-medium text-foreground">
              Windows will show a security warning on first run — that is normal.
            </h2>
          </div>
          <p className="mt-3 text-[13.5px] font-light leading-6 text-foreground/75">
            3SVerse is a small independent developer, not a big publisher — so Windows SmartScreen
            may ask before an unsigned app runs. It is a one-time, 2-second pass,
            not a problem with the file. This is the exact dialog you will see:
          </p>
          <div
            aria-hidden="true"
            className="mx-auto mt-5 max-w-md overflow-hidden rounded-xl border border-[#cfcfcf] bg-white text-left shadow-[0_16px_44px_rgba(0,0,0,.3)]"
          >
            <div className="px-4 pt-3 text-[11.5px] text-[#6b6b6b]">VidaPay Incentive Extractor</div>
            <div className="flex gap-3.5 px-4 pb-3 pt-2.5">
              <ShieldAlert className="mt-0.5 h-8 w-8 shrink-0 text-[#0f6cbd]" />
              <div>
                <p className="text-[13.5px] font-semibold leading-5 text-[#1b1b1b]">Windows protected your PC</p>
                <p className="mt-1 text-[12px] leading-5 text-[#5f5f5f]">
                  Microsoft Defender SmartScreen prevented an unrecognized app from starting. Running this app
                  might put your PC at risk.
                </p>
                <p className="mt-1.5 text-[11.5px] leading-4 text-[#8a8a8a]">Publisher: Unknown publisher</p>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-[#ececec] px-4 py-3">
              <span className="text-[12.5px] font-medium text-[#0f6cbd] underline">More info</span>
              <span className="rounded-[4px] bg-[#0f6cbd] px-4 py-1.5 text-[12.5px] font-medium text-white">Run anyway</span>
            </div>
          </div>
          <div className="mx-auto mt-3 flex max-w-md flex-wrap items-center justify-between gap-x-6 gap-y-1.5 text-[12.5px] text-foreground/85">
            <span>
              <span className="font-mono-tech font-semibold text-brand-cyan">1.</span> Click{' '}
              <span className="font-medium text-foreground">More info</span> — the warning expands
            </span>
            <span>
              <span className="font-mono-tech font-semibold text-brand-cyan">2.</span> Click{' '}
              <span className="font-medium text-foreground">Run anyway</span> — the tool opens
            </span>
          </div>
          <p className="mt-3 text-[12.5px] leading-5 text-muted-foreground">
            Why it happens: the current Windows files are not yet Authenticode-signed, so SmartScreen shows
            “Unknown publisher.” Before running a file, compare its SHA-256 checksum with the value above.
            Your VidaPay credentials and extracted dealership data stay on your PC. If your company does not
            allow unsigned software, contact us before downloading.
          </p>
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-card p-6" data-testid="download-activation">
          <div className="flex items-center gap-2.5">
            <KeyRound className="h-4 w-4 text-brand-cyan" />
            <h2 className="text-[15px] font-medium text-foreground">Activate your key in 3 steps</h2>
          </div>
          <ol className="mt-3 space-y-2 text-[13.5px] font-light leading-6 text-foreground/75">
            <li>1. Open the .exe — there is nothing to install, and the full 7-day trial starts.</li>
            <li>2. Buy a license key — it arrives by email within 2 business hours on business days (US Central); after-hours orders ship first thing next morning.</li>
            <li>3. Paste the key into the app&apos;s Activate box — that PC is unlocked permanently.</li>
          </ol>
          {ACTIVATION_VIDEO_URL ? (
            <div className="mt-4 overflow-hidden rounded-xl border border-border">
              <div className="relative aspect-video w-full">
                {ACTIVATION_VIDEO_URL.endsWith('.mp4') ? (
                  <video
                    controls
                    preload="metadata"
                    poster={ACTIVATION_VIDEO_POSTER}
                    src={ACTIVATION_VIDEO_URL}
                    className="absolute inset-0 h-full w-full bg-black"
                  >
                    <track kind="captions" />
                  </video>
                ) : (
                  <iframe
                    src={ACTIVATION_VIDEO_URL}
                    title="How to activate your license key in 3 steps"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    loading="lazy"
                    className="absolute inset-0 h-full w-full"
                  />
                )}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-[12.5px] leading-5 text-muted-foreground">
              One license = one PC, always. Moving to a new PC? Deactivate from the app (bottom-right) and activate the
              same key there — full details in the{' '}
              <a href="https://3sverse.com/#faq" className="text-brand-cyan hover:underline">FAQ</a>. Stuck? WhatsApp
              support answers same-day on business days.
            </p>
          )}
        </div>

        <TrialGateModal
          open={gateFor !== null}
          productName={gateFor?.label ?? ''}
          onClose={() => setGateFor(null)}
          onUnlocked={() => {
            if (!gateFor) return;
            if (gateFor.name === '3SVerse_Downloads release list') {
              window.open(RELEASES_PAGE, '_blank', 'noopener');
            } else {
              startDownload(gateFor.name);
            }
          }}
        />

        <div className="mt-10 rounded-2xl border border-brand-cyan/20 bg-[#6ee7ef]/[.04] p-6" data-testid="download-security">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-4 w-4 text-brand-cyan" />
            <h2 className="text-[15px] font-medium text-foreground">Before you open the app</h2>
          </div>
          <ul className="mt-3 space-y-2.5 text-[13.5px] font-light leading-6 text-foreground/75">
            {[
              'Verify the SHA-256 checksum shown above against the file you downloaded (Windows: certutil -hashfile <file> SHA256).',
              'The tools run on your own PC under your own VidaPay login — credentials and extracted data never leave your machine.',
              'No telemetry, no analytics. Network calls go to the VidaPay portal and the license ledger only.',
              'One official build per tool — the 7-day trial starts on first run; your license key unlocks the full version permanently.',
            ].map((line) => (
              <li key={line} className="flex gap-2.5">
                <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-brand-cyan" /> {line}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[12.5px] leading-5 text-muted-foreground">
            More detail:{' '}
            <a href="#/security" className="text-brand-cyan hover:underline">Security</a> ·{' '}
            <a href="#/eula" className="text-brand-cyan hover:underline">License terms</a> ·{' '}
            <a href="#/privacy" className="text-brand-cyan hover:underline">Privacy</a>
            {publishedAt ? ` · Builds published ${publishedAt}` : ''}
          </p>
        </div>
      </main>
    </div>
  );
}
