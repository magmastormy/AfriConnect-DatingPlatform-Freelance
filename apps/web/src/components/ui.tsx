'use client';

import React from 'react';

export function Card({
  children,
  title,
  action,
}: {
  children: React.ReactNode;
  title?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="card">
      {(title || action) && (
        <header className="card-head">
          <h2>{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'ghost' | 'danger' | 'subtle';
  disabled?: boolean;
}) {
  return (
    <button type={type} className={`btn btn-${variant}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function Input({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}

export function Select({
  label,
  children,
  ...props
}: { label: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="field">
      <span>{label}</span>
      <select {...props}>{children}</select>
    </label>
  );
}

export function Textarea({
  label,
  ...props
}: { label: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea {...props} />
    </label>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function ApiState({
  loading,
  error,
  empty,
  emptyText,
  children,
}: {
  loading: boolean;
  error: string | null;
  empty?: boolean;
  emptyText?: string;
  children: React.ReactNode;
}) {
  if (loading) return (
    <div className="state" style={{ display: 'grid', gap: 10, placeItems: 'center', padding: '2.2rem 1rem' }}>
      <span className="spinner" style={{ width: 22, height: 22 }} aria-label="Loading" />
      <span style={{ color: 'var(--muted)', fontSize: '.88rem' }}>Loading…</span>
    </div>
  );
  if (error) return (
    <div className="state state-error" style={{ display: 'grid', gap: 8, placeItems: 'center', padding: '1.6rem 1rem' }}>
      <span style={{ fontSize: '1.3rem' }} aria-hidden>⚠</span>
      <span>{error}</span>
    </div>
  );
  if (empty) return (
    <div className="state" style={{ display: 'grid', gap: 8, placeItems: 'center', padding: '2rem 1rem', textAlign: 'center' }}>
      <span style={{ width: 44, height: 44, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--surface-3)', color: 'var(--muted)' }} aria-hidden>—</span>
      <span style={{ color: 'var(--muted)', maxWidth: '32ch' }}>{emptyText ?? 'Nothing here yet.'}</span>
    </div>
  );
  return <>{children}</>;
}

export function SkeletonCard() {
  return (
    <div className="card" style={{ display: 'grid', gap: 10 }}>
      <div style={{ height: 14, width: '42%', background: 'var(--line)', borderRadius: 6 }} />
      <div style={{ height: 10, width: '88%', background: 'var(--line)', borderRadius: 6, opacity: .7 }} />
      <div style={{ height: 10, width: '66%', background: 'var(--line)', borderRadius: 6, opacity: .5 }} />
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="field" style={{ flex: 1, minWidth: 200 }}>
      <span>{placeholder ?? 'Search'}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

export function Pagination({
  page,
  total,
  limit,
  onPageChange,
}: {
  page: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  const go = (p: number) => {
    if (p >= 1 && p <= pages && p !== page) onPageChange(p);
  };
  return (
    <div className="pagination">
      <button className="btn btn-subtle" onClick={() => go(page - 1)} disabled={page <= 1}>
        Prev
      </button>
      <span className="pagination-info">
        Page {page} of {pages}
      </span>
      <button className="btn btn-subtle" onClick={() => go(page + 1)} disabled={page >= pages}>
        Next
      </button>
    </div>
  );
}
