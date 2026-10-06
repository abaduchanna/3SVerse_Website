/**
 * 3SVerse — trial download gate.
 *
 * Every EXE download on the site (trials included) happens only AFTER a
 * form submission — the visitor leaves their name + email first, the lead
 * is filed into the private ledger (Cloudflare capture worker →
 * ledger/captures/contacts/…), and only a SUCCESSFUL submission unlocks
 * the download buttons in this browser.
 *
 * Once unlocked, the lead is remembered in localStorage so returning
 * visitors do not have to fill the same form twice; every unlock still
 * corresponds to exactly one captured lead.
 *
 * If the capture worker is unreachable, the gate FAILS CLOSED (no
 * download) with a retry note and the direct email fallback — the seller's
 * rule: "form submission ke baad hi download ho".
 */
import { PAID_DOWNLOAD } from './catalog';

const LS_KEY = '3sv_trial_lead';

export interface TrialLead {
  name: string;
  email: string;
  company?: string;
  at: number;
}

export interface TrialGateResult {
  ok: boolean;
  error?: string;
}

export function savedTrialLead(): TrialLead | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TrialLead;
    if (!parsed || typeof parsed.name !== 'string' || typeof parsed.email !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveLead(lead: TrialLead) {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(lead));
  } catch {
    /* private mode — the gate still worked for this session */
  }
}

/**
 * Submit the trial lead to the capture worker. Resolves {ok:true} only on a
 * worker 200 — anything else resolves {ok:false} with a user-facing error.
 */
export async function submitTrialLead(input: {
  name: string;
  email: string;
  company?: string;
  product: string;
}): Promise<TrialGateResult> {
  const name = input.name.trim().slice(0, 120);
  const email = input.email.trim().slice(0, 254);
  if (!name) return { ok: false, error: 'Please enter your name.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Please enter a valid email address.' };
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(PAID_DOWNLOAD.captureContactUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        organization: (input.company || '').trim().slice(0, 160),
        interest: 'Trial download',
        message: `Trial download requested: ${input.product} (Windows installer, free 7-day trial).`,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      return {
        ok: false,
        error: 'The form could not be submitted right now — please try again, or email Connect@3SVerse.com for your download link.',
      };
    }
  } catch {
    return {
      ok: false,
      error: 'The form could not be submitted (network issue) — please try again, or email Connect@3SVerse.com for your download link.',
    };
  } finally {
    window.clearTimeout(timer);
  }

  saveLead({ name, email, company: (input.company || '').trim(), at: Date.now() });
  return { ok: true };
}
