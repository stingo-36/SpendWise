/**
 * Merchant normalization pipeline (spec §6). Applied in order to noisy Indian
 * bank alert strings like `UPI/P2M/SWIGGY*ORDER12345/HDFC` or
 * `POS 4471XXXX BLINKIT BANGALORE IN`.
 *
 * Store both raw_merchant (untouched) and merchant (normalized).
 */

// Rail prefixes stripped anywhere they appear as a token boundary (§6.2).
const RAIL_PREFIXES = ['UPI', 'P2M', 'P2A', 'POS', 'NEFT', 'IMPS', 'ACH', 'MMT', 'RTGS', 'NACH'];

// Transfer-narration noise. Account-statement credits arrive as hyphenated
// narrations like `XXXXXXXXXX6069-TPT-SALARY SAHIL SAJJAN-SK`, where the only
// part worth showing is the person's name; these tokens are the scaffolding
// around it. (TPT = third-party transfer, FT = funds transfer.)
const NARRATION_NOISE = ['TPT', 'TRF', 'FT', 'PMT', 'TXN', 'REF'];

// Trailing location/country tokens (§6.3). Extend as new cities appear.
const CITY_TOKENS = new Set([
  'BANGALORE', 'BENGALURU', 'MUMBAI', 'DELHI', 'NEW DELHI', 'GURGAON', 'GURUGRAM',
  'NOIDA', 'PUNE', 'HYDERABAD', 'CHENNAI', 'KOLKATA', 'AHMEDABAD', 'JAIPUR',
  'CHANDIGARH', 'KOCHI', 'INDORE', 'LUCKNOW', 'SURAT', 'NAGPUR', 'THANE',
  'FARIDABAD', 'GHAZIABAD', 'COIMBATORE', 'VIJAYAWADA', 'MYSORE', 'MYSURU',
]);

const COUNTRY_TOKENS = new Set(['IN', 'IND', 'INDIA']);

/**
 * Returns true when a person-to-person VPA (no usable merchant). §6 — such
 * transfers should fall to Transfers → To people, keyed by the VPA itself.
 */
export function looksLikeVpa(raw: string): boolean {
  const m = raw.match(/[a-z0-9._-]+@[a-z]{2,}/i);
  if (!m) return false;
  // A VPA handle without a recognizable merchant brand around it.
  const known = /SWIGGY|ZOMATO|AMAZON|FLIPKART|PAYTM|RAZORPAY|BILLDESK/i;
  return !known.test(raw);
}

/** Extract the VPA (e.g. `john@okhdfc`) if present. */
export function extractVpa(raw: string): string | null {
  const m = raw.match(/[a-z0-9._-]+@[a-z]{2,}/i);
  return m ? m[0].toLowerCase() : null;
}

export function normalizeMerchant(raw: string): string {
  if (!raw) return '';

  // If this is a bare person VPA, keep the VPA as the merchant key.
  if (looksLikeVpa(raw)) {
    const vpa = extractVpa(raw);
    if (vpa) return vpa.toUpperCase();
  }

  let s = raw.toUpperCase();

  // 4b. Payment-aggregator descriptors put the aggregator first and the real
  // merchant after the star: "RAZ*Swiggy", "PAYU*Myntra", "CCAV*BookMyShow".
  // The generic strip below assumes the opposite (SWIGGY*ORDER12345), so
  // without this a card charge through Razorpay was filed under "RAZ" — every
  // such merchant collapsing into one meaningless row in the history.
  const viaAggregator = s.match(/^(?:RAZ|RAZORPAY|PAYU|PAYUBIZ|CCAV|CCAVENUE|BD|BILLDESK|PYTM|INSTAMOJO)\*+\s*(.+)$/);
  if (viaAggregator) s = viaAggregator[1].trim();

  // 5. Strip everything after * or @ where it looks like an order ref / VPA suffix.
  s = s.replace(/[*@][A-Z0-9._-]+/g, ' ');

  // Tokenize on rail separators and whitespace. Hyphens count: bank credit
  // narrations are hyphen-delimited, and without splitting on them the whole
  // `XXXXXXXXXX6069-TPT-SALARY` ran together as one unrecognizable token.
  let tokens = s.split(/[\/\s-]+/).filter(Boolean);

  // 2. Strip rail prefixes and narration scaffolding wherever they appear.
  tokens = tokens.filter((t) => !RAIL_PREFIXES.includes(t) && !NARRATION_NOISE.includes(t));

  // 4. Strip pure digit runs of length >= 4 (order/reference numbers), and
  //    masked-card tokens like 4471XXXX.
  tokens = tokens.filter((t) => {
    if (/^\d{4,}$/.test(t)) return false;
    if (/^X+\d+$/.test(t) || /^\d+X+$/.test(t) || /^\d*X{2,}\d*$/.test(t)) return false;
    return true;
  });

  // 3. Strip trailing country token, then trailing city tokens.
  while (tokens.length > 1 && COUNTRY_TOKENS.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  // City may be multi-word ("NEW DELHI"); handle the common single-token case
  // plus a two-token join at the tail.
  while (tokens.length > 1) {
    const tail1 = tokens[tokens.length - 1];
    const tail2 = tokens.length > 1 ? `${tokens[tokens.length - 2]} ${tail1}` : '';
    if (CITY_TOKENS.has(tail2)) {
      tokens.splice(tokens.length - 2, 2);
    } else if (CITY_TOKENS.has(tail1)) {
      tokens.pop();
    } else {
      break;
    }
  }

  // Drop a trailing 1-2 letter bank/branch code — but ONLY when it was
  // hyphen-attached in the source ("...SAHIL SAJJAN-SK"). Plenty of Indian
  // names legitimately end in a space-separated initial ("NEETHA H M",
  // "SUNIL V"), and an unconditional rule silently truncated those.
  if (tokens.length > 1 && /-\s*[A-Z]{1,2}$/.test(raw.toUpperCase().trim())) {
    if (/^[A-Z]{1,2}$/.test(tokens[tokens.length - 1])) tokens.pop();
  }

  // 6. Collapse punctuation to spaces, collapse whitespace, trim.
  let out = tokens.join(' ').replace(/[^A-Z0-9 &.-]+/g, ' ').replace(/\s+/g, ' ').trim();

  // Fallback: if we stripped everything, return a cleaned version of the raw.
  if (!out) out = raw.toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

  return out;
}
