'use client';

import { useEffect } from 'react';
import { animate, inView } from 'motion';

/**
 * Scroll animation for the whole app, on Motion. Every card, panel and marked
 * row springs in when it scrolls into view — from below when you scroll down,
 * from above when you scroll up — and fades back out when it leaves, so it
 * plays again on every pass rather than once.
 *
 * Elements opt in by class (.card, .card-hero, .card-ink, .card-tinted) or
 * with a data-animate attribute. A MutationObserver picks up whatever React
 * renders later (route changes, loaded data, opened panels).
 */
const SELECTOR = '.card, .card-hero, .card-ink, .card-tinted, [data-animate]';
const OFFSET = 28;

export default function ScrollMotion() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const watched = new WeakSet<Element>();
    const stops: VoidFunction[] = [];

    // Elements entering in the same frame get a small stagger.
    let batch = 0;
    let batchFrame = 0;
    const nextDelay = () => {
      if (!batchFrame) {
        batchFrame = requestAnimationFrame(() => {
          batch = 0;
          batchFrame = 0;
        });
      }
      return Math.min(batch++, 6) * 0.05;
    };

    const watch = (el: Element) => {
      if (watched.has(el)) return;
      watched.add(el);
      (el as HTMLElement).style.opacity = '0';
      stops.push(
        inView(
          el,
          (element, entry) => {
            // Coming in from the top edge means the user is scrolling up.
            const fromAbove = entry.boundingClientRect.top < 0;
            animate(
              element,
              { opacity: [0, 1], y: [fromAbove ? -OFFSET : OFFSET, 0], scale: [0.97, 1] },
              { type: 'spring', bounce: 0.22, duration: 0.7, delay: nextDelay() },
            );
            return (leave) => {
              const leftAbove = leave.boundingClientRect.top < 0;
              animate(element, { opacity: 0, y: leftAbove ? -OFFSET / 2 : OFFSET / 2, scale: 0.97 }, { duration: 0.25, ease: 'easeIn' });
            };
          },
          { amount: 0.12 },
        ),
      );
    };

    const scan = () => document.querySelectorAll(SELECTOR).forEach(watch);
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      mo.disconnect();
      stops.forEach((stop) => stop());
      cancelAnimationFrame(batchFrame);
    };
  }, []);

  return null;
}
