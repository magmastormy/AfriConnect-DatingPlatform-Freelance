'use client';

import Image from 'next/image';
import { Badge } from '@/components/ui';
import type { DiscoverCard } from '@/lib/types';
import type { SwipeHandlers } from '@/lib/use-swipe-gesture';

/**
 * A single full-screen profile card in the swipe deck. The whole surface is a
 * swipe target (like / pass), and a quick tap opens the detail sheet. The live
 * drag transform comes from the parent's useSwipeGesture hook.
 */
export function ProfileCardFull({
  card,
  photoIdx,
  swipe,
  behind = false,
}: {
  card: DiscoverCard;
  photoIdx: number;
  swipe: { dx: number; dy: number; dragging: boolean; handlers: SwipeHandlers };
  behind?: boolean;
}) {
  const photos = card.photos.length ? card.photos : [];
  const photo = photos[photoIdx] ?? null;
  const rotate = swipe.dx / 18;
  const likeHint = swipe.dx > 60;
  const passHint = swipe.dx < -60;

  return (
    <div
      className={`fs-card ${behind ? 'fs-card--behind' : ''}`}
      style={
        behind
          ? undefined
          : {
              transform: `translate(${swipe.dx}px, ${swipe.dy}px) rotate(${rotate}deg)`,
              transition: swipe.dragging ? 'none' : 'transform 0.25s ease',
            }
      }
      {...(behind ? {} : swipe.handlers)}
    >
      {photo ? (
        <Image
          src={photo}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 480px"
          style={{ objectFit: 'cover' }}
          priority={!behind}
          draggable={false}
        />
      ) : (
        <div className="fs-card-fallback">No photo</div>
      )}

      {likeHint && !behind && <div className="fs-stamp fs-stamp-like">LIKE</div>}
      {passHint && !behind && <div className="fs-stamp fs-stamp-pass">PASS</div>}

      <div className="fs-card-scrim">
        <div className="fs-card-name">
          {card.displayName ?? 'Member'} · {card.age}
        </div>
        <div className="fs-card-sub">
          {card.city}
          {card.profession ? ` · ${card.profession}` : ''}
        </div>
        <div className="fs-card-badges">
          {card.verified && <Badge tone="good">Verified</Badge>}
          {card.isPremium && <Badge tone="warn">Premium</Badge>}
        </div>
      </div>
    </div>
  );
}
