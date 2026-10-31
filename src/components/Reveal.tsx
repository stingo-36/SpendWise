/**
 * Layout wrapper kept for its call sites. Scroll animation now comes from
 * ScrollMotion, which animates the cards inside on every pass; animating
 * this wrapper too would double it up.
 */
export default function Reveal({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return <div className={className}>{children}</div>;
}
