'use client';

import type { Bucket } from '@/lib/api';

const W = 320;
const H = 120;
const PAD = 18;

/** Hand-rolled SVG line chart (no chart dependency). */
export function LineChart({ data, label }: { data: Bucket[]; label?: string }) {
  if (!data || data.length === 0) {
    return <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>No data</div>;
  }
  const max = Math.max(1, ...data.map((d) => d.count));
  const n = data.length;
  const xFor = (i: number) => (n <= 1 ? W / 2 : PAD + (i * (W - 2 * PAD)) / (n - 1));
  const yFor = (c: number) => H - PAD - (c / max) * (H - 2 * PAD);
  const linePts = data.map((d, i) => `${xFor(i).toFixed(1)},${yFor(d.count).toFixed(1)}`).join(' ');
  const areaPts = `${PAD},${H - PAD} ${linePts} ${W - PAD},${H - PAD}`;
  const gridVals = [0, max / 2, max].map((v) => Math.round(v));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={120}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={label ?? 'line chart'}
    >
      {gridVals.map((v, i) => {
        const y = yFor(v);
        return (
          <line key={i} x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="var(--line)" strokeWidth={1} />
        );
      })}
      <polyline points={areaPts} fill="var(--brand)" opacity={0.12} stroke="none" />
      <polyline
        points={linePts}
        fill="none"
        stroke="var(--brand)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {data.map((d, i) => (
        <circle key={i} cx={xFor(i)} cy={yFor(d.count)} r={2.5} fill="var(--brand)" />
      ))}
    </svg>
  );
}
