/**
 * Split transactions — paying for something in full and sharing it.
 *
 * You pay ₹14,500 rent; your part is ₹4,832 and two flatmates owe ₹4,834
 * each. The bank row keeps its real amount (sync dedupe matches on it), the
 * debit gets `myShare`, and each flatmate gets a SplitShare. When one of them
 * pays you back, that incoming credit is linked to their share: it settles it
 * and stops counting as income, so the money doesn't show up twice.
 *
 * Everything here is pure so it can be unit-tested without a database.
 */

/** Paise, so sums never drift (14500.00 is 1450000). */
export const toPaise = (n: number | string) => Math.round(Number(n) * 100);

/** What a debit costs *you* — your share when split, else the whole amount. */
export function spendAmount(t: { amount: unknown; myShare?: unknown | null }): number {
  return t.myShare != null ? Number(t.myShare) : Number(t.amount);
}

/** A credit that pays back someone's share is not income. */
export function isSettlement(t: { settles?: { id: number } | null }): boolean {
  return t.settles != null;
}

export interface ShareInput {
  id?: number;
  name: string;
  amount: number;
}

export type SplitCheck =
  | { ok: true; myShare: number; shares: ShareInput[] }
  | { ok: false; error: string };

/**
 * Validate a split. Names are trimmed and required, every part is positive
 * (your own part may be 0 when you paid entirely for others), and the parts
 * must add up to the transaction amount to the paisa.
 */
export function checkSplit(total: number, myShare: unknown, shares: unknown): SplitCheck {
  const mine = Number(myShare);
  if (!Number.isFinite(mine) || mine < 0) return { ok: false, error: 'Your share must be 0 or more.' };
  if (!Array.isArray(shares) || shares.length === 0) return { ok: false, error: 'Add at least one person to split with.' };
  if (shares.length > 20) return { ok: false, error: 'A split can have at most 20 people.' };

  const clean: ShareInput[] = [];
  for (const s of shares) {
    const name = String((s as ShareInput)?.name ?? '').trim();
    const amount = Number((s as ShareInput)?.amount);
    if (!name) return { ok: false, error: 'Every share needs a name.' };
    if (name.length > 60) return { ok: false, error: 'Names can be at most 60 characters.' };
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: `${name}'s share must be more than 0.` };
    const id = (s as ShareInput)?.id;
    clean.push({ ...(Number.isInteger(id) ? { id } : {}), name, amount: toPaise(amount) / 100 });
  }

  const sum = toPaise(mine) + clean.reduce((acc, s) => acc + toPaise(s.amount), 0);
  const diff = toPaise(total) - sum;
  if (diff !== 0) {
    const off = (Math.abs(diff) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    return { ok: false, error: diff > 0 ? `₹${off} is still unassigned.` : `The parts are ₹${off} more than the total.` };
  }
  return { ok: true, myShare: toPaise(mine) / 100, shares: clean };
}

/**
 * Split `total` into `people` equal parts. Paise that don't divide go to the
 * first part (yours), so the parts always add back up exactly.
 */
export function splitEvenly(total: number, people: number): number[] {
  const n = Math.max(1, Math.floor(people));
  const all = toPaise(total);
  const each = Math.floor(all / n);
  return Array.from({ length: n }, (_, i) => (i === 0 ? all - each * (n - 1) : each) / 100);
}

/** Lower-case words of a name, ignoring initials and punctuation. */
function words(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

/** True when a share's name plausibly is the person a credit came from. */
export function nameMatches(shareName: string, creditFrom: string): boolean {
  const from = new Set(words(creditFrom));
  return words(shareName).some((w) => from.has(w));
}

export interface OpenShare {
  id: number;
  name: string;
  amount: number;
  /** When the split debit happened — a pay-back can't come before it. */
  paidAt: Date;
}

/** Pay-backs older than this after the original payment aren't suggested. */
const MATCH_WINDOW_DAYS = 90;

/**
 * The open share an incoming credit most likely pays back, or null.
 * The amount must match exactly and the credit must come after the payment
 * (within 90 days). Among those, a name match wins; with no name match, a
 * suggestion is made only when exactly one share fits, so UPI names that
 * differ from what you typed still get matched without guessing between two.
 */
export function suggestShare(
  credit: { amount: number; occurredAt: Date; from: string },
  open: OpenShare[],
): OpenShare | null {
  const amt = toPaise(credit.amount);
  const fits = open.filter((s) => {
    if (toPaise(s.amount) !== amt) return false;
    const days = (credit.occurredAt.getTime() - s.paidAt.getTime()) / 86_400_000;
    return days >= -1 && days <= MATCH_WINDOW_DAYS; // a day's slack for timezone edges
  });
  if (fits.length === 0) return null;
  const named = fits.filter((s) => nameMatches(s.name, credit.from));
  if (named.length > 0) return named.sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime())[0];
  return fits.length === 1 ? fits[0] : null;
}
