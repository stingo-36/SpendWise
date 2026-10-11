/**
 * Categorization (spec §7). Fallback chain per transaction:
 *   1. merchant_rules lookup (substring, highest priority)  → source 'rule'
 *   2. LLM classification (batched, unknown merchants only)  → source 'llm'
 *   3. Review queue (low confidence / failure)              → source 'unassigned'
 *
 * The write-back loop (§7.2): every LLM/manual decision writes a merchant_rules
 * row, so each unknown merchant costs at most one LLM call ever.
 *
 * The categorizer MUST skip rows where category_locked = true (§7.5).
 */
import { prisma } from './db';
import { classifyMerchants, llmConfigured, type ClosedTaxonomy } from './llm';

const CONFIDENCE_THRESHOLD = 0.7; // §7.3 — below this goes to review queue

export interface CategorizeResult {
  scanned: number;
  byRule: number;
  byLlm: number;
  queued: number;
  llmCalls: number;
}

interface CatIds {
  categoryId: number;
  subcategoryId: number | null;
}

// Business-name tokens that mean a merchant is NOT a person.
const BUSINESS_WORDS = /\b(LTD|LIMITED|PVT|PRIVATE|LLP|INC|CORP|CO|STORE|SHOP|MART|SUPERMARKET|WINE|CAFE|RESTAURANT|HOTEL|FOODS?|BAKERY|SWEETS|TECH|TECHNOLOGIES|SOLUTIONS|SERVICES?|ENTERPRISES?|INDIA|RETAIL|TRADERS?|AGENCY|MEDICAL|PHARMA|CLINIC|HOSPITAL|MOTORS?|AUTO|FINANCE|FINANCIAL|PAY|DIGITAL|ONLINE|CART|FUELS?|ENERGY|POWER|TELECOM|COMMUNICATIONS?|NETWORK)\b/;

/**
 * Heuristic: does this merchant look like a person (a P2P UPI transfer) rather
 * than a business? Catches names like "JITENDRA KUMAR YADAV" / "SUNIL V" and raw
 * VPAs, routing them to Transfers → To people without needing the LLM.
 */
function isLikelyPerson(merchant: string): boolean {
  const m = merchant.trim().toUpperCase();
  if (!m) return false;
  if (/\d/.test(m)) return false; // names don't contain digits
  if (BUSINESS_WORDS.test(m)) return false;
  if (m.includes('@')) return true; // bare VPA handle
  const tokens = m.split(/\s+/).filter(Boolean);
  // 2–4 alphabetic tokens (allow a trailing single-letter initial like "SUNIL V").
  if (tokens.length < 2 || tokens.length > 4) return false;
  return tokens.every((t) => /^[A-Z.]+$/.test(t));
}

/** Build the closed taxonomy the LLM must choose from, and name→id lookups. */
async function loadTaxonomy() {
  const cats = await prisma.category.findMany({ orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }] });
  const byId = new Map(cats.map((c) => [c.id, c]));
  const topByName = new Map<string, number>();
  const subByPath = new Map<string, number>(); // "Top/Sub" -> id
  const taxonomy: ClosedTaxonomy = {};

  for (const c of cats) {
    if (c.parentId == null) {
      topByName.set(c.name, c.id);
      taxonomy[c.name] ??= [];
    }
  }
  for (const c of cats) {
    if (c.parentId != null) {
      const parent = byId.get(c.parentId);
      if (!parent) continue;
      taxonomy[parent.name] ??= [];
      taxonomy[parent.name].push(c.name);
      subByPath.set(`${parent.name}/${c.name}`, c.id);
    }
  }
  return { taxonomy, topByName, subByPath };
}

/** Resolve LLM category/subcategory names to ids. Unknown category → null. */
function resolveNames(
  category: string | null,
  subcategory: string | null,
  topByName: Map<string, number>,
  subByPath: Map<string, number>,
): CatIds | null {
  if (!category) return null;
  const categoryId = topByName.get(category);
  if (!categoryId) return null;
  const subcategoryId = subcategory ? subByPath.get(`${category}/${subcategory}`) ?? null : null;
  return { categoryId, subcategoryId };
}

/**
 * Apply the highest-priority matching merchant_rule to a merchant string.
 * Increments hit_count on the winner. Returns the category ids or null.
 */
async function applyRule(userId: number, merchant: string): Promise<(CatIds & { ruleId: number; label: string | null }) | null> {
  // Rules for this user OR global seed rules (userId null). Substring match.
  const rules = await prisma.merchantRule.findMany({ where: { OR: [{ userId }, { userId: null }] }, orderBy: { priority: 'desc' } });
  const upper = merchant.toUpperCase();
  for (const r of rules) {
    if (upper.includes(r.pattern.toUpperCase())) {
      await prisma.merchantRule.update({ where: { id: r.id }, data: { hitCount: { increment: 1 } } });
      return { categoryId: r.categoryId, subcategoryId: r.subcategoryId, ruleId: r.id, label: r.label };
    }
  }
  return null;
}

/**
 * Write-back (§7.2): persist a learned rule for a merchant. The pattern is the
 * full normalized merchant string so it only re-matches the same merchant.
 * Idempotent-ish: skips if an identical (pattern, source) rule already exists.
 */
export async function writeBackRule(
  userId: number,
  merchant: string,
  categoryId: number,
  subcategoryId: number | null,
  source: 'llm' | 'manual',
  priority = source === 'manual' ? 100 : 20,
): Promise<void> {
  const pattern = merchant.toUpperCase().trim();
  if (!pattern) return;
  const existing = await prisma.merchantRule.findFirst({ where: { userId, pattern, source } });
  if (existing) {
    await prisma.merchantRule.update({ where: { id: existing.id }, data: { categoryId, subcategoryId, priority } });
    return;
  }
  await prisma.merchantRule.create({ data: { userId, pattern, categoryId, subcategoryId, priority, source } });
}

/**
 * Run the categorizer over eligible transactions:
 * category_id IS NULL AND category_locked = false (§7.1 / §7.5).
 */
export async function runCategorizer(userId: number, batchLimit = 1000): Promise<CategorizeResult> {
  const { taxonomy, topByName, subByPath } = await loadTaxonomy();
  const res: CategorizeResult = { scanned: 0, byRule: 0, byLlm: 0, queued: 0, llmCalls: 0 };

  const pending = await prisma.transaction.findMany({
    where: { userId, categoryId: null, categoryLocked: false },
    take: batchLimit,
    orderBy: { occurredAt: 'desc' },
  });
  res.scanned = pending.length;
  if (pending.length === 0) return res;

  // Resolve the Transfers → To people bucket for the person heuristic.
  const toPeople = subByPath.get('Transfers/To people') ?? null;
  const transfersId = topByName.get('Transfers') ?? null;

  // ── Pass 1: rules, then person heuristic ─────────────────────────────────
  const unresolved: typeof pending = [];
  for (const t of pending) {
    const hit = await applyRule(userId, t.merchant);
    if (hit) {
      await prisma.transaction.update({
        where: { id: t.id },
        data: { categoryId: hit.categoryId, subcategoryId: hit.subcategoryId, categorySource: 'rule', displayLabel: hit.label ?? undefined },
      });
      res.byRule++;
      continue;
    }
    // No rule → if it looks like a person, route to Transfers → To people.
    if (transfersId && isLikelyPerson(t.merchant)) {
      await prisma.transaction.update({
        where: { id: t.id },
        data: { categoryId: transfersId, subcategoryId: toPeople, categorySource: 'rule' },
      });
      res.byRule++;
      continue;
    }
    unresolved.push(t);
  }

  if (unresolved.length === 0) return res;

  // ── Pass 2: LLM over the DISTINCT unknown merchants (batched) ─────────────
  if (!(await llmConfigured())) {
    // No LLM configured — everything unresolved goes to the review queue.
    for (const t of unresolved) {
      await prisma.transaction.update({ where: { id: t.id }, data: { categorySource: 'unassigned' } });
    }
    res.queued += unresolved.length;
    return res;
  }

  const distinct = Array.from(new Set(unresolved.map((t) => t.merchant)));
  res.llmCalls = 1;
  let classifications;
  try {
    classifications = await classifyMerchants(distinct, taxonomy);
  } catch (err) {
    console.error('[categorize] LLM call failed, queuing batch:', err instanceof Error ? err.message : err);
    for (const t of unresolved) {
      await prisma.transaction.update({ where: { id: t.id }, data: { categorySource: 'unassigned' } });
    }
    res.queued += unresolved.length;
    return res;
  }

  const decisionByMerchant = new Map(classifications.map((c) => [c.merchant.toUpperCase(), c]));

  for (const merchant of distinct) {
    const decision = decisionByMerchant.get(merchant.toUpperCase());
    const txns = unresolved.filter((t) => t.merchant === merchant);

    const ids = decision ? resolveNames(decision.category, decision.subcategory, topByName, subByPath) : null;
    const confident = decision && ids && decision.confidence >= CONFIDENCE_THRESHOLD;

    if (confident && ids) {
      // Assign all txns for this merchant and write back a rule (§7.2).
      for (const t of txns) {
        await prisma.transaction.update({
          where: { id: t.id },
          data: { categoryId: ids.categoryId, subcategoryId: ids.subcategoryId, categorySource: 'llm', llmConfidence: decision!.confidence },
        });
      }
      await writeBackRule(userId, merchant, ids.categoryId, ids.subcategoryId, 'llm');
      res.byLlm += txns.length;
    } else {
      // Low confidence / unresolved → review queue.
      for (const t of txns) {
        await prisma.transaction.update({
          where: { id: t.id },
          data: { categorySource: 'unassigned', llmConfidence: decision?.confidence ?? null },
        });
      }
      res.queued += txns.length;
    }
  }

  return res;
}
