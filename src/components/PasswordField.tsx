'use client';

import { useState } from 'react';

/* Password input with a show/hide toggle, and an optional strength meter for
   the signup flow (the API's rule is simply "at least 6 characters"). */
export default function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  strength = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  strength?: boolean;
}) {
  const [show, setShow] = useState(false);

  const score = scorePassword(value);
  const meter = [
    { label: 'Too short', color: 'rgb(var(--debit))' },
    { label: 'Weak', color: 'rgb(var(--amber))' },
    { label: 'Good', color: 'rgb(var(--peri))' },
    { label: 'Strong', color: 'rgb(var(--credit))' },
  ][score];

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label className="text-xs font-semibold text-muted">{label}</label>
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="text-xs font-semibold text-muted hover:text-text"
        >
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
      <input
        type={show ? 'text' : 'password'}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input"
      />
      {strength && value.length > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <div className="flex flex-1 gap-1">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="h-1 flex-1 rounded-full transition-colors"
                style={{ background: i <= score ? meter.color : 'rgb(var(--surface-2))' }}
              />
            ))}
          </div>
          <span className="text-[11px] font-semibold" style={{ color: meter.color }}>{meter.label}</span>
        </div>
      )}
    </div>
  );
}

/* 0–3, deliberately simple: length first, then variety. */
function scorePassword(v: string) {
  if (v.length < 6) return 0;
  let s = 1;
  if (v.length >= 10) s++;
  if (/[^a-zA-Z]/.test(v) && /[a-zA-Z]/.test(v)) s++;
  return Math.min(s, 3);
}
