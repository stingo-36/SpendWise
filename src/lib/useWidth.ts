'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Measure a container's width with ResizeObserver so charts can be given an
 * explicit width — avoids Recharts' ResponsiveContainer zero-measurement race.
 */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, width };
}
