/**
 * TrialGateModal — the form that stands in front of every EXE download.
 *
 * Product rule (seller): no direct downloads — every portable trial app
 * download happens only after this form is submitted successfully. The
 * lead is stored in the private ledger via the capture worker; only a
 * confirmed submission (worker 200) closes the modal and starts the
 * download. The modal has no close-X on purpose? — it HAS a close
 * (Escape / Cancel): hard-locking visitors is hostile, and the buttons on
 * the page remain gated either way.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { FileDown, Loader2, MailCheck, ShieldCheck, X } from 'lucide-react';
import { submitTrialLead } from '@/lib/trialgate';

interface Props {
  open: boolean;
  productName: string;
  onClose: () => void;
  /** Called after a SUCCESSFUL submission — the caller starts the download. */
  onUnlocked: () => void;
}

export default function TrialGateModal({ open, productName, onClose, onUnlocked }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [website, setWebsite] = useState(''); // honeypot — humans never fill this
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) {
      setError('');
      setDone(false);
      setBusy(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (website.trim()) return; // honeypot — silently drop bots
    setBusy(true);
    setError('');
    const result = await submitTrialLead({ name, email, company, product: productName });
    setBusy(false);
    if (!result.ok) {
      setError(result.error || 'Something went wrong — please try again.');
      return;
    }
    setDone(true);
    window.setTimeout(() => {
      onUnlocked();
      onClose();
    }, 900);
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-[#05040a]/70 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Download form"
      data-testid="trial-gate"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-[0_40px_120px_rgba(0,0,0,.5)]">
        <div className="mb-1 flex items-start justify-between gap-4">
          <div>
            <p className="font-mono-tech text-[10px] uppercase tracking-[.22em] text-brand-cyan">
              Instant access · no card needed
            </p>
            <h3 className="mt-2 text-[19px] font-medium leading-snug tracking-[-0.01em] text-foreground">
              Where should we send your download?
            </h3>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-input p-2 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-[13.5px] font-light leading-6 text-foreground/75">
          Tell us who is downloading the <span className="font-medium text-foreground">{productName}</span>{' '}
          app and the download starts immediately — no installation, with the full software and
          free 7-day trial built in.
        </p>

        {done ? (
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-brand-cyan/30 bg-[#6ee7ef]/[.07] p-4" data-testid="trial-gate-success">
            <MailCheck className="h-5 w-5 shrink-0 text-brand-cyan" />
            <p className="text-[13.5px] font-medium text-foreground">
              Received — starting your download…
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name *"
              aria-label="Your name"
              autoComplete="name"
              required
              maxLength={120}
              data-testid="trial-gate-name"
              className="w-full rounded-xl border border-border bg-foreground/[.04] px-4 py-3 text-[15px] text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-brand-cyan/60"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Work email *"
              aria-label="Work email"
              autoComplete="email"
              required
              maxLength={254}
              data-testid="trial-gate-email"
              className="w-full rounded-xl border border-border bg-foreground/[.04] px-4 py-3 text-[15px] text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-brand-cyan/60"
            />
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Store or company (optional)"
              aria-label="Store or company"
              autoComplete="organization"
              maxLength={160}
              data-testid="trial-gate-company"
              className="w-full rounded-xl border border-border bg-foreground/[.04] px-4 py-3 text-[15px] text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-brand-cyan/60"
            />
            {/* honeypot */}
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="hidden"
            />
            {error ? (
              <p className="rounded-xl border border-red-400/30 bg-red-400/[.07] px-4 py-3 text-[13px] leading-5 text-red-200" data-testid="trial-gate-error">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              data-testid="trial-gate-submit"
              className="flex w-full items-center justify-center gap-2.5 rounded-xl border bg-white px-6 py-3.5 text-[14.5px] font-semibold text-[#0b0a10] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#f7f3e8] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
                </>
              ) : (
                <>
                  <FileDown className="h-4 w-4" /> Submit &amp; start download
                </>
              )}
            </button>
            <p className="flex items-start gap-2 text-[11.5px] font-light leading-4 text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-cyan" />
              We only use this to send your license and support — no spam, ever
              (see the <a href="#/privacy" className="underline decoration-foreground/30 underline-offset-2 hover:text-foreground">privacy policy</a>).
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
