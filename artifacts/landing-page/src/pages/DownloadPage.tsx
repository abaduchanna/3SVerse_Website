/**
 * Download page (#/download, deep link /download) — the branded download
 * destination for the official VidaPay tool installers.
 *
 * One build per tool: it opens as a free 7-day trial and a license key
 * unlocks the full version, so trial users and paid customers download
 * the same file. Checksums are fetched LIVE from the public downloads
 * repository's latest release (GitHub provides sha256 digests on release
 * assets), so the values shown always match the file a visitor downloads
 * right now — the builds re-publish on a fixed sync schedule.
 */
import { useEffect, useState } from 'react';
import { ArrowLeft, Check, FileDown, ShieldCheck } from 'lucide-react';
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
    document.title = 'Download — 3S Verse';
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
        <div className="mx-auto flex h-[64px] max-w-4xl items-center justify-between px-5">
          <a href="#/" aria-label="3S Verse — home" className="flex items-center gap-2.5">
            <img src="/logo-240.png" alt="3S Verse" width={240} height={57} className="h-5 w-auto" />
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
          Each download is the full software: it runs as a 7-day trial on one PC, and the license key you
          buy unlocks it permanently — no second installer. Builds are hosted in our controlled public
          repository and re-published on a fixed sync schedule.
        </p>

        {metaFailed && (
          <div className="mt-8 rounded-2xl border border-amber-400/30 bg-amber-400/[.06] p-5 text-[13.5px] leading-6 text-foreground">
            Live checksums and file sizes are temporarily unavailable (GitHub API limit hit on this network).
            The installers below are always the current builds — download normally, and verify the SHA-256 on the{' '}
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
                  <div className="text-[15.5px] font-medium text-foreground">All three tools — the Full Bundle (2 licenses of each — 6 total)</div>
                  <div className="mt-1 font-mono-tech text-[10px] uppercase tracking-[.16em] text-muted-foreground">
                    Grab each installer from the release list
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
            <h2 className="text-[15px] font-medium text-foreground">Before you run the installer</h2>
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
