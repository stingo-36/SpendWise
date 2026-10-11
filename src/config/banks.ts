/**
 * Bank sender addresses (spec §4.2 / §5.1). Adding a new bank = adding an entry
 * here plus a parser module keyed by one of these senders. No other code change.
 *
 * `senders` are matched case-insensitively against the raw From: address.
 * `parser` is the key registered in src/lib/parsers/index.ts.
 */
export interface BankConfig {
  key: string;
  displayName: string;
  senders: string[];
  /**
   * DLT sender headers used by this bank's SMS alerts. Indian operators
   * prefix these with an operator/entity code — "VM-HDFCBK", "AD-ICICIB",
   * "JD-SBIINB" — so only the part after the last hyphen is compared.
   */
  smsSenders: string[];
  parser: string; // parser module key
}

export const BANKS: BankConfig[] = [
  {
    key: 'hdfc',
    displayName: 'HDFC Bank',
    senders: ['alerts@hdfcbank.net', 'alerts@hdfcbank.com', 'alerts@hdfcbank.bank.in', 'emailstatements.cc@hdfcbank.net'],
    smsSenders: ['HDFCBK', 'HDFCBN'],
    parser: 'hdfc',
  },
  {
    key: 'icici',
    displayName: 'ICICI Bank',
    senders: ['alerts@icicibank.com', 'credit_cards@icicibank.com', 'noreply@icicibank.com'],
    smsSenders: ['ICICIB', 'ICICIT', 'ICICIBK'],
    parser: 'icici',
  },
  {
    key: 'sbi',
    displayName: 'State Bank of India',
    senders: ['sbiinb@sbi.co.in', 'alerts@sbi.co.in', 'donotreply.sbicard@sbicard.com'],
    smsSenders: ['SBIINB', 'SBIUPI', 'SBIPSG', 'ATMSBI', 'SBICRD', 'SBIBNK'],
    parser: 'sbi',
  },
  {
    key: 'axis',
    displayName: 'Axis Bank',
    senders: ['alerts@axisbank.com', 'cc.statements@axisbank.com'],
    smsSenders: ['AXISBK', 'AXISBANK'],
    parser: 'axis',
  },
];

/** All configured sender addresses, lowercased — used to build the Gmail query. */
export function allSenders(): string[] {
  return BANKS.flatMap((b) => b.senders).map((s) => s.toLowerCase());
}

/** Resolve the parser key for a raw From: header, or null if unknown. */
export function parserForSender(from: string): string | null {
  const lower = from.toLowerCase();
  for (const bank of BANKS) {
    if (bank.senders.some((s) => lower.includes(s.toLowerCase()))) return bank.parser;
  }
  return null;
}

/**
 * Normalize a DLT SMS header to its 6-character entity code.
 * "VM-HDFCBK" / "vm-hdfcbk" / "HDFCBK" all become "HDFCBK".
 */
export function normalizeSmsSender(header: string): string {
  const trimmed = header.trim().toUpperCase();
  const dash = trimmed.lastIndexOf('-');
  return dash >= 0 ? trimmed.slice(dash + 1) : trimmed;
}

/** Resolve the parser key for an SMS sender header, or null if unknown. */
export function parserForSmsSender(header: string): string | null {
  const code = normalizeSmsSender(header);
  for (const bank of BANKS) {
    if (bank.smsSenders.some((s) => s.toUpperCase() === code)) return bank.parser;
  }
  return null;
}

/** Every configured SMS header, for the setup instructions in Settings. */
export function allSmsSenders(): string[] {
  return BANKS.flatMap((b) => b.smsSenders);
}
