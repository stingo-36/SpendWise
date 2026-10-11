'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { inr, inrCompact } from '@/lib/format';
import { useWidth } from '@/lib/useWidth';
import Icon from './Icon';
import { categoryStyle } from '@/lib/palette';

export interface CategoryWeek {
  label: string;
  total: number;
  [category: string]: string | number;
}

export interface WeeklyCategorySpend {
  weeks: CategoryWeek[];
  categories: string[];
}

/** Custom tooltip: per-category rows for the hovered week plus a total. */
function WeekTooltip({ active, payload, label, colors }: any) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p: any) => Number(p.value) > 0).reverse();
  if (rows.length === 0) return null;
  const total = rows.reduce((s: number, p: any) => s + Number(p.value), 0);
  return (
    <div className="rounded-2xl bg-[rgb(var(--ink))] px-3.5 py-3 text-xs text-white shadow-[0_18px_40px_-20px_rgb(26_28_31/0.7)]">
      <div className="mb-1.5 font-semibold text-white/60">{label}</div>
      <div className="space-y-1">
        {rows.map((p: any) => (
          <div key={p.name} className="flex items-center gap-3">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colors[p.name] }} />
            <span className="flex-1 whitespace-nowrap">{p.name}</span>
            <span className="tabular font-semibold">{inr(Number(p.value))}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between gap-6 border-t border-white/15 pt-1.5 font-semibold">
        <span>Total</span>
        <span className="tabular">{inr(total)}</span>
      </div>
    </div>
  );
}

/**
 * Week-wise spend for the month, stacked by category. Weeks on x, rupees on y —
 * each bar shows what the week was actually spent on.
 */
export default function CategoryWeekChart({ data }: { data: WeeklyCategorySpend }) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const height = 300;
  const { weeks, categories } = data;

  // Keyed by category NAME (not by index) so a category is the same colour
  // here as on the spend-by-category donut. These are always expense-side.
  const colors: Record<string, string> = {};
  const icons: Record<string, string> = {};
  categories.forEach((c) => {
    const st = categoryStyle(c, true);
    colors[c] = st.solid;
    icons[c] = st.icon;
  });

  const empty = weeks.every((w) => Number(w.total) === 0);

  return (
    <div>
      <div ref={ref} className="w-full" style={{ height }}>
        {empty ? (
          <div className="h-full grid place-items-center text-sm text-muted">No spend to chart this month yet.</div>
        ) : (
          width > 0 && (
            <BarChart width={width} height={height} data={weeks} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 6" stroke="rgb(var(--border))" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: 'rgb(var(--muted))', fontSize: 12, fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
                dy={6}
              />
              <YAxis
                tickFormatter={(v) => inrCompact(v)}
                tick={{ fill: 'rgb(var(--muted))', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <Tooltip cursor={{ fill: 'rgb(var(--surface-2))', radius: 14 }} content={<WeekTooltip colors={colors} />} />
              {categories.map((name, ci) => {
                const last = ci === categories.length - 1;
                return (
                  <Bar key={name} dataKey={name} stackId="spend" fill={colors[name]} maxBarSize={54}>
                    {/* Round only the topmost visible band of each bar. */}
                    {weeks.map((w, wi) => {
                      const above = categories.slice(ci + 1).some((n) => Number(w[n]) > 0);
                      const isTop = last || !above;
                      return <Cell key={wi} radius={(isTop ? [10, 10, 0, 0] : [0, 0, 0, 0]) as any} />;
                    })}
                  </Bar>
                );
              })}
            </BarChart>
          )
        )}
      </div>

      {/* Legend — ordered by spend, largest first */}
      {!empty && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {categories.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold"
              style={{ background: `${colors[name]}14`, color: categoryStyle(name, true).ink }}
            >
              <span className="grid h-4 w-4 place-items-center rounded-full text-white" style={{ background: colors[name] }}>
                <Icon name={icons[name]} size={10} />
              </span>
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
