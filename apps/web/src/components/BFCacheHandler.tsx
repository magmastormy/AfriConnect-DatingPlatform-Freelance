'use client';

import { useEffect } from 'react';

/**
 * Next.js `next dev` HMR uses a WebSocket at `/_next/webpack-hmr`.
 * When a page is restored from the Back-Forward Cache (BFCache), that
 * socket is dead and Chrome logs:
 *   `WebSocket connection to 'ws://localhost:3000/_next/webpack-hmr' failed: Page entered Back-Forward Cache.`
 * This is dev-only (no HMR in `next start` / production) and harmless, but noisy.
 * Reload on `pageshow` with `persisted` to re-establish HMR cleanly.
 */
export function BFCacheHandler() {
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);
  return null;
}
