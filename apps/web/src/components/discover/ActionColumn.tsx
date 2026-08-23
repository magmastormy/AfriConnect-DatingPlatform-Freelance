'use client';

import type { SwipeHandlers } from '@/lib/use-swipe-gesture';

export type ActAction = 'like' | 'pass' | 'superlike';

/**
 * Tinder / Tantan-style floating action tray. Green = Like (swipe right),
 * red = Pass (swipe left), gold = Superlike (the connection request). Buttons
 * are large (≥56px) for thumb reach; the deck also honours swipe gestures.
 */
export function ActionColumn({
  disabled,
  onPass,
  onLike,
  onSuper,
}: {
  disabled: boolean;
  onPass: () => void;
  onLike: () => void;
  onSuper: () => void;
}) {
  return (
    <div className="fs-actions" aria-label="Discovery actions">
      <button
        type="button"
        className="fs-act fs-act-pass"
        aria-label="Pass"
        disabled={disabled}
        onClick={onPass}
      >
        ✕
      </button>
      <button
        type="button"
        className="fs-act fs-act-super"
        aria-label="Superlike"
        disabled={disabled}
        onClick={onSuper}
      >
        ★
      </button>
      <button
        type="button"
        className="fs-act fs-act-like"
        aria-label="Like"
        disabled={disabled}
        onClick={onLike}
      >
        ♥
      </button>
    </div>
  );
}

// Re-export the handler type so consumers can attach swipe to the card root.
export type { SwipeHandlers };
