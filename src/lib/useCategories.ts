'use client';

import { useEffect, useState } from 'react';

export interface SubcategoryOpt {
  id: number;
  name: string;
  isExpense: boolean;
}
export interface CategoryOpt {
  id: number;
  name: string;
  isExpense: boolean;
  subcategories: SubcategoryOpt[];
}

// Module-level cache so every editor instance shares one fetch.
let cache: CategoryOpt[] | null = null;
let inflight: Promise<CategoryOpt[]> | null = null;

async function load(): Promise<CategoryOpt[]> {
  if (cache) return cache;
  if (!inflight) {
    inflight = fetch('/api/categories')
      .then((r) => (r.ok ? r.json() : { categories: [] }))
      .then((d) => {
        cache = (d.categories ?? []) as CategoryOpt[];
        return cache;
      })
      .catch(() => {
        inflight = null; // allow retry on next mount
        return [] as CategoryOpt[];
      });
  }
  return inflight;
}

export function useCategories() {
  const [categories, setCategories] = useState<CategoryOpt[]>(cache ?? []);
  useEffect(() => {
    let live = true;
    load().then((c) => live && setCategories(c));
    return () => {
      live = false;
    };
  }, []);
  return categories;
}

/**
 * The categories offered for one side of a transaction.
 *
 * Income is the non-expense side of the taxonomy, and expense is the rest —
 * plus Transfers, which is the exception that made cash disappear. Transfers is
 * is_expense = false so that moving your own money never counts as spend, but
 * that flag was also driving what the pickers offered: on a debit only
 * is_expense categories were listed, so "Transfers › Cash withdrawal" — the
 * home for every ATM withdrawal — could not be chosen for the debit it always
 * is. A transfer genuinely runs in both directions, so it belongs on both.
 */
export function categoriesForSide(categories: CategoryOpt[], side: 'expense' | 'income'): CategoryOpt[] {
  return categories.filter((c) => (c.isExpense ? side === 'expense' : side === 'income' || isTransfers(c)));
}

function isTransfers(c: CategoryOpt): boolean {
  return /^transfers$/i.test(c.name);
}
