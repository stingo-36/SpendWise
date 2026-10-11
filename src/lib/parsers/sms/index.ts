/**
 * SMS parser dispatch, mirroring ../index.ts but keyed off the DLT sender
 * header rather than a From: address.
 */
import { parserForSmsSender } from '@/config/banks';
import { EmailInput, ParseResult } from '../types';
import { hdfcSms } from './hdfc';
import { iciciSms } from './icici';
import { sbiSms } from './sbi';
import { axisSms } from './axis';

type SmsParser = (input: EmailInput) => ParseResult;

const REGISTRY: Record<string, SmsParser> = {
  hdfc: hdfcSms,
  icici: iciciSms,
  sbi: sbiSms,
  axis: axisSms,
};

/** Route an SMS to its bank parser. Unknown headers stay unparsed. */
export function parseSms(input: EmailInput): ParseResult {
  const key = parserForSmsSender(input.sender);
  if (!key) return { status: 'unparsed' };
  const parser = REGISTRY[key];
  if (!parser) return { status: 'unparsed' };
  return parser(input);
}
