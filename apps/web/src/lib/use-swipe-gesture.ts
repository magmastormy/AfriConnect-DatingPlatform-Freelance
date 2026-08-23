'use client';

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

export interface SwipeHandlers {
  onPointerDown: (e: ReactPointerEvent) => void;
  onPointerMove: (e: ReactPointerEvent) => void;
  onPointerUp: (e: ReactPointerEvent) => void;
  onPointerCancel: (e: ReactPointerEvent) => void;
}

interface SwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onTap?: () => void;
  /** Horizontal drag (px) past which a swipe commits. */
  threshold?: number;
  disabled?: boolean;
}

/**
 * Pointer-events swipe detector for the discovery deck. Reports live drag
 * offset (dx/dy) for transform animations and commits a swipe/tap on release.
 * No external gesture library — keeps the bundle lean and the UX predictable.
 */
export function useSwipeGesture(opts: SwipeOptions): {
  dx: number;
  dy: number;
  dragging: boolean;
  handlers: SwipeHandlers;
} {
  const { onSwipeLeft, onSwipeRight, onTap, threshold = 90, disabled } = opts;
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const [dx, setDx] = useState(0);
  const [dy, setDy] = useState(0);
  const [dragging, setDragging] = useState(false);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (disabled) return;
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      start.current = { x: e.clientX, y: e.clientY, t: Date.now() };
      setDragging(true);
    },
    [disabled],
  );

  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    if (!start.current) return;
    setDx(e.clientX - start.current.x);
    setDy(e.clientY - start.current.y);
  }, []);

  const finish = useCallback(
    (e: ReactPointerEvent) => {
      const s = start.current;
      start.current = null;
      setDragging(false);
      setDx(0);
      setDy(0);
      if (!s || disabled) return;
      const dxv = e.clientX - s.x;
      const dyv = e.clientY - s.y;
      const moved = Math.hypot(dxv, dyv);
      const dt = Date.now() - s.t;
      // A short, small movement is a tap (open the detail sheet).
      if (moved < 12 && dt < 400) {
        onTap?.();
        return;
      }
      // A decisive horizontal drag commits like (right) / pass (left).
      if (Math.abs(dxv) > threshold && Math.abs(dxv) > Math.abs(dyv)) {
        if (dxv > 0) onSwipeRight?.();
        else onSwipeLeft?.();
      }
    },
    [disabled, onSwipeLeft, onSwipeRight, onTap, threshold],
  );

  return {
    dx,
    dy,
    dragging,
    handlers: { onPointerDown, onPointerMove, onPointerUp: finish, onPointerCancel: finish },
  };
}
