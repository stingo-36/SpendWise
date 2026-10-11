import type { SVGProps } from 'react';

// Minimal lucide-style stroke icons — crisp at any size, currentColor.
const paths: Record<string, React.ReactNode> = {
  overview: (
    <>
      <path d="M3 3v18h18" />
      <rect x="7" y="12" width="3" height="6" rx="1" />
      <rect x="12" y="8" width="3" height="10" rx="1" />
      <rect x="17" y="5" width="3" height="13" rx="1" />
    </>
  ),
  transactions: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </>
  ),
  review: (
    <>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.5 5.5 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.5A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.5Z" />
    </>
  ),
  keywords: (
    <>
      <path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </>
  ),
  subscriptions: (
    <>
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </>
  ),
  parsers: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </>
  ),
  wallet: (
    <>
      <path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2" />
      <path d="M21 7H8a2 2 0 0 0 0 10h13a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1Z" />
      <circle cx="16" cy="12" r="1" />
    </>
  ),
  income: (
    <>
      <path d="M12 3v14" />
      <path d="m6 11 6 6 6-6" />
      <path d="M5 21h14" />
    </>
  ),
  piggy: (
    <>
      <path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 1 3.4 2.5 4.5V19a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-.5c1 .2 2 .3 3 .3s2-.1 3-.3V19a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-2.4c.7-.5 1.3-1.2 1.7-2H21a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1h-.5c-.3-.7-.7-1.3-1.2-1.8V5Z" />
      <path d="M2 9v1c0 1.1.9 2 2 2h1" />
      <path d="M16 11h.01" />
    </>
  ),
  creditcard: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2.5" />
      <path d="M2 10h20" />
      <path d="M6 15h3" />
    </>
  ),
  receipt: (
    <>
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M8 7h8M8 11h8M8 15h5" />
    </>
  ),
  budget: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9 9.5a2 2 0 0 1 2-1.5h2a1.8 1.8 0 0 1 .3 3.6l-2.6.8a1.8 1.8 0 0 0 .3 3.6h2a2 2 0 0 0 2-1.5" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),

  /* ── Category glyphs (see categoryStyle in lib/palette) ───────────────── */
  food: (
    <>
      <path d="M4 3v7a3 3 0 0 0 3 3 3 3 0 0 0 3-3V3" />
      <path d="M7 3v10M7 13v8" />
      <path d="M17 3c-1.7 1.4-2.5 3.4-2.5 5.5S15.3 12.6 17 14v7" />
    </>
  ),
  emi: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M7 9h4M7 13h2M7 17h6" />
      <path d="M17 9v8" />
    </>
  ),
  sip: (
    <>
      <path d="M3 17 9 11l4 4 8-8" />
      <path d="M15 7h6v6" />
    </>
  ),
  transport: (
    <>
      <path d="M5 17h14" />
      <path d="M3 13h18l-1.6-4.7A2 2 0 0 0 17.5 7h-11a2 2 0 0 0-1.9 1.3L3 13Z" />
      <circle cx="7.5" cy="16.5" r="1.6" />
      <circle cx="16.5" cy="16.5" r="1.6" />
    </>
  ),
  shopping: (
    <>
      <path d="M5 8h14l-1.2 11a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
  house: (
    <>
      <path d="m3 10 9-7 9 7" />
      <path d="M5 9v11h14V9" />
      <path d="M10 20v-6h4v6" />
    </>
  ),
  bills: (
    <>
      <path d="M5 3v18l2-1.2L9 21l2-1.2L13 21l2-1.2L17 21V3l-2 1.2L13 3l-2 1.2L9 3 7 4.2 5 3Z" />
      <path d="M9 8h5M9 12h5M9 16h3" />
    </>
  ),
  health: (
    <>
      <path d="M12 20.5S3.5 15 3.5 9.2A4.7 4.7 0 0 1 12 6.6a4.7 4.7 0 0 1 8.5 2.6c0 5.8-8.5 11.3-8.5 11.3Z" />
    </>
  ),
  other: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="7" cy="12" r="1" />
      <circle cx="17" cy="12" r="1" />
    </>
  ),
  transfers: (
    <>
      <path d="m7 4-4 4 4 4" />
      <path d="M3 8h13" />
      <path d="m17 12 4 4-4 4" />
      <path d="M21 16H8" />
    </>
  ),
  salary: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="2.5" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6 12h.01M18 12h.01" />
    </>
  ),
  bonus: (
    <>
      <rect x="3" y="9" width="18" height="12" rx="2" />
      <path d="M12 9v12M3 14h18" />
      <path d="M12 9C10 9 7.5 8.4 7.5 6.2A2.2 2.2 0 0 1 12 6a2.2 2.2 0 0 1 4.5.2C16.5 8.4 14 9 12 9Z" />
    </>
  ),
  extra: (
    <>
      <path d="m12 3 2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.4l6.1-.8L12 3Z" />
    </>
  ),
  refund: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </>
  ),

  /* ── Actions ─────────────────────────────────────────────────────────── */
  edit: (
    <>
      <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="m15 6 3 3" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M6 7v12.5A1.5 1.5 0 0 0 7.5 21h9a1.5 1.5 0 0 0 1.5-1.5V7" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  restore: (
    <>
      <path d="M3 12a9 9 0 1 0 2.6-6.4" />
      <path d="M3 4v5h5" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  check: <path d="m5 13 4 4L19 7" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  repeat: (
    <>
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3.5 22 20H2L12 3.5Z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  sparkle: (
    <>
      <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
      <path d="M18.5 16.5 19 18l1.5.5L19 19l-.5 1.5L18 19l-1.5-.5L18 18l.5-1.5Z" />
    </>
  ),
};

export default function Icon({ name, size = 18, ...props }: { name: keyof typeof paths | string; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {paths[name] ?? null}
    </svg>
  );
}
