'use client';

export function PhotoDots({
  count,
  idx,
  onSelect,
}: {
  count: number;
  idx: number;
  onSelect: (i: number) => void;
}) {
  if (count <= 1) return null;
  return (
    <div className="fs-dots" role="tablist" aria-label="Profile photos">
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-selected={i === idx}
          aria-label={`Photo ${i + 1} of ${count}`}
          className={`fs-dot ${i === idx ? 'is-on' : ''}`}
          onClick={() => onSelect(i)}
        />
      ))}
    </div>
  );
}
