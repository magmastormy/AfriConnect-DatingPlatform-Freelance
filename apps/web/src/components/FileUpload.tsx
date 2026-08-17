'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui';
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
 * Real file picker (replaces the old URL text box). Uploads straight to the
 * backend `/upload` proxy and hands the stored URL back via `onChange`. The
 * browser never sees storage credentials.
 */
export function FileUpload({ label, accept, folder, value, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
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
  }

  return (
    <label className="field">
      <span>{label}</span>
      <div className="row-actions">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          disabled={disabled || busy}
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.currentTarget.files?.[0];
            if (f) void handleFile(f);
            e.currentTarget.value = '';
          }}
        />
        <Button
          variant="ghost"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? 'Uploading…' : value ? 'Replace file' : 'Choose file'}
        </Button>
        {value ? (
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: '0.85rem', color: 'var(--muted)' }}
          >
            View uploaded
          </a>
        ) : (
          <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>No file selected</span>
        )}
      </div>
      {error && (
        <div className="notice" style={{ marginTop: 6 }}>
          {error}
        </div>
      )}
    </label>
  );
}
