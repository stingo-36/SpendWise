'use client';

import { PieChart, Pie, Cell, Tooltip } from 'recharts';
import { inr } from '@/lib/format';
import { PALETTE, categoryStyle } from '@/lib/palette';
import Icon from './Icon';

export interface PieItem {
  categoryId: number | null;
  categoryName: string;
  amount: number;
}

export { PALETTE };

export function colorFor(index: number): string {
  return PALETTE[index % PALETTE.length];
}

/**
 * Donut of spend (or income) by category.
 *
 * Colours come from the category NAME via `categoryStyle`, not from the slice
 * index: that keeps a category the same colour here and on the week-wise bar
 * chart, and keeps the income view in its own hue family instead of reusing
 * the expense colours because both lists happen to start at index 0.
 */
export default function CategoryPie({ items, variant = 'expense' }: { items: PieItem[]; variant?: 'expense' | 'income' }) {
  const isExpense = variant === 'expense';
  const total = items.reduce((s, i) => s + i.amount, 0);
  if (items.length === 0 || total === 0) {
    return (
      <div className="grid place-items-center gap-2 py-10 text-center">
        <span className="tile h-11 w-11 bg-surface-2 text-muted"><Icon name={isExpense ? 'wallet' : 'income'} size={20} /></span>
        <p className="text-sm font-medium text-muted">No {isExpense ? 'expenses' : 'income'} to chart this month.</p>
      </div>
    );
  }

  const data = items.map((it) => ({ ...it, ...categoryStyle(it.categoryName, isExpense) }));

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10">
      {/* Donut — left; labels to the right */}
      <div className="relative shrink-0" style={{ width: 200, height: 200 }}>
        <PieChart width={200} height={200}>
          <Pie
            data={data}
            dataKey="amount"
            nameKey="categoryName"
            cx="50%"
            cy="50%"
            innerRadius={62}
            outerRadius={92}
            paddingAngle={2}
            stroke="none"
            isAnimationActive={false}
          >
            {data.map((d) => (
              <Cell key={d.categoryName} fill={d.solid} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string) => [inr(value), name]}
            contentStyle={{
              background: 'rgb(var(--ink))',
              border: 'none',
              borderRadius: 14,
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
            }}
            itemStyle={{ color: '#fff' }}
            labelStyle={{ color: 'rgb(255 255 255 / 0.6)' }}
          />
        </PieChart>
        {/* Center total */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Total</div>
          <div className="text-base font-bold tabular">{inr(total)}</div>
        </div>
      </div>

      {/* Labels — to the right of the donut */}
      <ul className="flex-1 min-w-0 w-full space-y-1.5">
        {data.map((d) => (
          <li
            key={d.categoryName}
            className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm transition-colors"
            style={{ background: `${d.solid}0f` }}
          >
            <span className="tile h-6 w-6 shrink-0 rounded-lg text-white" style={{ background: d.solid }}>
              <Icon name={d.icon} size={13} />
            </span>
            <span className="flex-1 truncate font-semibold" style={{ color: d.ink }}>{d.categoryName}</span>
            <span className="shrink-0 text-right tabular font-bold">{inr(d.amount)}</span>
            <span className="w-9 shrink-0 text-right text-[11px] font-semibold text-muted tabular">
              {Math.round((d.amount / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
