/**
 * LLM merchant classification (spec §7.3).
 *
 * Privacy contract (spec §7.3 / §13): we send ONLY merchant name strings — never
 * amounts, account numbers, reference IDs, dates, or email bodies. The model must
 * choose from the closed category list. Output is structured JSON with a
 * confidence; anything < 0.7 is routed to the review queue by the caller.
 */
import Anthropic from '@anthropic-ai/sdk';
import { getConfig } from './config';

export interface ClosedTaxonomy {
  // top-level category name -> list of its subcategory names
  [category: string]: string[];
}

export interface LlmClassification {
  merchant: string;
  category: string | null;
  subcategory: string | null;
  confidence: number; // 0..1
}

async function client(): Promise<{ anthropic: Anthropic; model: string }> {
  const cfg = await getConfig();
  if (!cfg.anthropicApiKey) throw new Error('Anthropic API key not set — set it in Settings (or ANTHROPIC_API_KEY)');
  return { anthropic: new Anthropic({ apiKey: cfg.anthropicApiKey }), model: cfg.anthropicModel };
}

function buildPrompt(merchants: string[], taxonomy: ClosedTaxonomy): string {
  const catLines = Object.entries(taxonomy)
    .map(([cat, subs]) => `- ${cat}${subs.length ? `  (subcategories: ${subs.join(', ')})` : ''}`)
    .join('\n');

  return `You classify merchant names from Indian bank/UPI transaction alerts into a fixed category taxonomy.

CLOSED CATEGORY LIST — you MUST choose "category" from exactly these top-level names:
${catLines}

Rules:
- "category" must be one of the top-level names above, spelled exactly. Never invent a category.
- "subcategory" must be one of that category's listed subcategories, or null when the merchant does not clearly imply one (e.g. AMAZON is "Shopping" with null subcategory). Do not force a guess.
- Person-to-person UPI handles (a VPA like "john@okhdfc" with no business name) → category "Transfers", subcategory "To people".
- "confidence" is your calibrated probability (0..1) that this classification is correct. Use < 0.7 when the merchant name is ambiguous or unrecognizable.

Classify each merchant below. Respond with ONLY a JSON array, no prose:
[{"merchant": "...", "category": "...", "subcategory": null, "confidence": 0.0}]

Merchants:
${merchants.map((m) => `- ${m}`).join('\n')}`;
}

/**
 * Classify a batch of merchant strings in a single request (spec §7.3 batching).
 * Returns one classification per input merchant (best-effort; unmatched inputs
 * are returned with confidence 0 so the caller queues them).
 */
export async function classifyMerchants(merchants: string[], taxonomy: ClosedTaxonomy): Promise<LlmClassification[]> {
  if (merchants.length === 0) return [];

  const { anthropic, model } = await client();
  const resp = await anthropic.messages.create({
    model,
    max_tokens: 2048,
    messages: [{ role: 'user', content: buildPrompt(merchants, taxonomy) }],
  });

  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  let parsed: LlmClassification[] = [];
  try {
    const jsonStart = text.indexOf('[');
    const jsonEnd = text.lastIndexOf(']');
    const slice = jsonStart >= 0 && jsonEnd >= 0 ? text.slice(jsonStart, jsonEnd + 1) : text;
    parsed = JSON.parse(slice);
  } catch {
    // Malformed output — treat everything as low-confidence for the review queue.
    return merchants.map((m) => ({ merchant: m, category: null, subcategory: null, confidence: 0 }));
  }

  // Re-key by merchant so ordering/omissions from the model don't misalign.
  const byMerchant = new Map(parsed.map((p) => [p.merchant?.toUpperCase?.() ?? '', p]));
  return merchants.map((m) => {
    const hit = byMerchant.get(m.toUpperCase());
    if (!hit) return { merchant: m, category: null, subcategory: null, confidence: 0 };
    return {
      merchant: m,
      category: hit.category ?? null,
      subcategory: hit.subcategory ?? null,
      confidence: typeof hit.confidence === 'number' ? hit.confidence : 0,
    };
  });
}

export async function llmConfigured(): Promise<boolean> {
  const cfg = await getConfig();
  return Boolean(cfg.anthropicApiKey);
}
