'use client';

import { useEffect, useState } from 'react';

/**
 * Returns true when the viewport is at or below `maxWidth` px (mobile-first).
 * SSR-safe: starts false, resolves after mount. Used to swap the desktop
 * browse grid for the immersive full-screen discovery deck on phones.
 */
export function useViewport(maxWidth = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [maxWidth]);

  return isMobile;
}
