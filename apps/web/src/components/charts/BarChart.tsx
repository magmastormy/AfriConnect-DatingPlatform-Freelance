'use client';

import type { Bucket } from '@/lib/api';

const W = 320;
const H = 120;
const PAD = 18;

/** Hand-rolled SVG bar chart (no chart dependency). */
export function BarChart({ data, label }: { data: Bucket[]; label?: string }) {
  if (!data || data.length === 0) {
    return <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>No data</div>;
  }
  const max = Math.max(1, ...data.map((d) => d.count));
  const n = data.length;
  const gap = 2;
  const bw = (W - 2 * PAD - gap * (n - 1)) / n;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={120}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={label ?? 'bar chart'}
    >
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="var(--line)" strokeWidth={1} />
      {data.map((d, i) => {
        const h = (d.count / max) * (H - 2 * PAD);
        const x = PAD + i * (bw + gap);
        const y = H - PAD - h;
        return (
          <rect key={i} x={x} y={y} width={bw} height={Math.max(0, h)} rx={2} fill="var(--gold)" />
        );
      })}
    </svg>
  );
}
