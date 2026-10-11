'use client';

import { useEffect, useRef } from 'react';
import { runSync } from '@/lib/syncClient';

// Twice a day is plenty: bank alerts are read from Gmail, which keeps them
// until we fetch them, so a longer gap costs nothing but far fewer wake-ups on
// a scale-to-zero Postgres (each sync wakes the database for ~5 minutes).
const SYNC_INTERVAL = 12 * 60 * 60 * 1000;
const KEY = 'mt_last_autosync';

/**
 * Background auto-sync: triggers /api/sync at most once every 12 hours while the
 * app is open (on load if it's been >12h, then every 12h). Silent — errors are
 * ignored. The daily 2am cron (vercel.json) covers the app being closed.
 */
export default function AutoSync() {
  const running = useRef(false);

  useEffect(() => {
    async function maybeSync(force = false) {
      if (running.current) return;
      let last = 0;
      try {
        last = Number(localStorage.getItem(KEY) || 0);
      } catch {
        /* ignore */
      }
      if (!force && Date.now() - last < SYNC_INTERVAL) return;
      running.current = true;
      try {
        const data = await runSync();
        if (data.ok) {
          try {
            localStorage.setItem(KEY, String(Date.now()));
          } catch {
            /* ignore */
          }
          // Let open pages refresh their data.
          window.dispatchEvent(new CustomEvent('mt:synced'));
        }
      } catch {
        /* ignore */
      } finally {
        running.current = false;
      }
    }

    // On load (only if stale), then every 12 hours.
    maybeSync(false);
    const id = setInterval(() => maybeSync(true), SYNC_INTERVAL);
    return () => clearInterval(id);
  }, []);

  return null;
}
