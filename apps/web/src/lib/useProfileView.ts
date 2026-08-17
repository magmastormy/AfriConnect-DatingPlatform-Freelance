'use client';

import { useCallback, useRef } from 'react';
import { trackProfileView } from './api';

/**
 * Tracks a profile view. Combines the server-side cooldown (24h) with a
 * per-session client dedup so quickly re-opening a card does not spam the API.
 * Fire-and-forget: failures are swallowed and the id is released for retry.
 */
export function useTrackProfileView() {
  const seen = useRef<Set<string>>(new Set());
  const track = useCallback((viewedUserId: string) => {
    if (!viewedUserId) return;
    if (seen.current.has(viewedUserId)) return;
    seen.current.add(viewedUserId);
    void trackProfileView(viewedUserId).catch(() => {
      seen.current.delete(viewedUserId);
    });
  }, []);
  return { track };
}
