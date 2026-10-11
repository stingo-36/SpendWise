'use client';

import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
import { inr } from '@/lib/format';
import { AMBER, CREDIT, DEBIT, MUTED } from '@/lib/palette';

/**
 * Savings-rate gauge: (income − money out of the account) / income.
 *
 * `spend` is deliberately the ACCOUNT outflow, not total spend: a credit-card
 * charge hasn't left the account yet, so counting it here understated what you
 * actually kept — the gauge was reporting money as already gone while it was
 * still sitting in the account.
 */
export default function HealthGauge({ income, spend }: { income: number; spend: number }) {
  const net = income - spend;
  const rate = income > 0 ? Math.max(0, Math.min(100, Math.round((net / income) * 100))) : null;
  const color = rate == null ? MUTED : rate >= 40 ? CREDIT : rate >= 15 ? AMBER : DEBIT;
  const value = rate ?? 0;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 180, height: 180 }}>
        <RadialBarChart
          width={180}
          height={180}
          cx="50%"
          cy="50%"
          innerRadius={70}
          outerRadius={88}
          barSize={16}
          data={[{ name: 'savings', value, fill: color }]}
          startAngle={220}
          endAngle={-40}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar dataKey="value" cornerRadius={10} background={{ fill: 'rgb(var(--surface-2))' }} isAnimationActive={false} />
        </RadialBarChart>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {rate == null ? (
            <>
              <div className="text-[10px] uppercase tracking-wide text-muted">Kept</div>
              <div className={`text-lg font-semibold tabular ${net >= 0 ? 'text-credit' : 'text-debit'}`}>{inr(net)}</div>
            </>
          ) : (
            <>
              <div className="text-[26px] font-extrabold tabular">{rate}%</div>
              <div className="text-[10px] uppercase tracking-wide text-muted">kept</div>
            </>
          )}
        </div>
      </div>
      <div className="mt-2 text-center text-xs text-muted">
        Kept <span className={`font-semibold ${net >= 0 ? 'text-credit' : 'text-debit'}`}>{inr(net)}</span> in your account this month
      </div>
    </div>
  );
}
