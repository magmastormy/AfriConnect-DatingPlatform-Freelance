'use client';

import { useRef, useState, useCallback } from 'react';
import { uploadFile, type UploadFolder } from '@/lib/api';

interface Props {
  label: string;
  accept?: string;
  folder: UploadFolder;
  value?: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}

/**
 * Polished file picker — drag-over + preview.
 * Replaces the old “Choose file / View uploaded” row with a zone that feels
 * like IG / Drive: dashed on idle, brand ring on drag, thumbnail when set.
 */
export function FileUpload({ label, accept, folder, value, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const isImage = !!value && /\.(jpe?g|png|webp|avif|gif)$/i.test(value.split('?')[0]);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const { url } = await uploadFile(file, folder);
      onChange(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }, [folder, onChange]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled || busy) return;
    const f = e.dataTransfer.files?.[0];
    if (f) void handleFile(f);
  }, [disabled, busy, handleFile]);

  return (
    <div className="field" style={{ gap: 8 }}>
      <span>{label}</span>

      <div
        className={`fu-zone ${dragOver ? 'is-drag' : ''} ${busy ? 'is-busy' : ''} ${value ? 'has-value' : ''}`}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !disabled && !busy && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !disabled && !busy) { e.preventDefault(); inputRef.current?.click(); } }}
        aria-label={busy ? 'Uploading' : `Upload ${label}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          disabled={disabled || busy}
          hidden
          onChange={(e) => {
            const f = e.currentTarget.files?.[0];
            if (f) void handleFile(f);
            e.currentTarget.value = '';
          }}
        />

        {isImage && value ? (
          <div className="fu-preview">
            <img src={value} alt="" />
            <span className="fu-preview-badge">Uploaded — tap to replace</span>
          </div>
        ) : value ? (
          <div className="fu-file">
            <span className="fu-file-icon" aria-hidden>File</span>
            <span className="fu-file-name">File attached</span>
            <a href={value} target="_blank" rel="noreferrer" className="fu-file-link" onClick={(e) => e.stopPropagation()}>View</a>
          </div>
        ) : (
          <div className="fu-empty">
            <span className="fu-empty-icon" aria-hidden>{busy ? '…' : '＋'}</span>
            <span className="fu-empty-title">{busy ? 'Uploading…' : dragOver ? 'Drop to upload' : 'Tap or drag file here'}</span>
            <span className="fu-empty-hint">{accept?.includes('pdf') ? 'JPG, PNG or PDF · ≤5 MB · encrypted' : 'JPG / PNG · ≤5 MB · encrypted'}</span>
          </div>
        )}
      </div>

      {error && <div className="notice" style={{ marginTop: 6 }}>{error}</div>}
      {value && !isImage && (
        <span style={{ fontSize: '.78rem', color: 'var(--muted)' }}>
          <a href={value} target="_blank" rel="noreferrer" style={{ color: 'var(--brand)', fontWeight: 700 }}>View uploaded</a> · tap the zone to replace
        </span>
      )}
    </div>
  );
}
