/**
 * Parser dispatch table (spec §5.1) — one module per bank, keyed by the parser
 * name registered in src/config/banks.ts.
 */
import { parserForSender } from '@/config/banks';
import { hdfcParser } from './hdfc';
import { iciciParser } from './icici';
import { sbiParser } from './sbi';
import { axisParser } from './axis';
import { EmailInput, ParseResult, Parser } from './types';

const REGISTRY: Record<string, Parser> = {
  hdfc: hdfcParser,
  icici: iciciParser,
  sbi: sbiParser,
  axis: axisParser,
};

/**
 * Route an email to its bank parser. If the sender is unknown, the email is
 * unparsed (surfaced in parser-health, spec §5.2) rather than an error.
 */
export function parseEmail(email: EmailInput): ParseResult {
  const key = parserForSender(email.sender);
  if (!key) return { status: 'unparsed' };
  const parser = REGISTRY[key];
  if (!parser) return { status: 'unparsed' };
  return parser(email);
}

export type { ParseResult, EmailInput };
