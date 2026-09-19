'use client';

import { useRef, useState } from 'react';
import imageCompression from 'browser-image-compression';
import { Camera, Trash2 } from 'lucide-react';
import type { AttachmentMeta } from '@/lib/repo/types';

/**
 * Camera capture for a checklist point.
 *
 * Compression happens on the device before anything is sent: a 12 MP Zebra
 * photo is around 4 MB, and the yard and container area are where the wifi is
 * worst. ~250 KB of WebP uploads on a bad connection; 4 MB does not.
 *
 * `capture="environment"` opens the rear camera directly rather than the
 * gallery, which is the difference between two taps and six with gloves on.
 */
export function PhotoCapture({
  runId,
  itemCode,
  groupKey,
  label,
  minCount,
  photos,
  disabled,
  onChange,
}: {
  runId: string;
  itemCode: string;
  groupKey: string | null;
  label?: string;
  minCount: number;
  photos: AttachmentMeta[];
  disabled?: boolean;
  onChange: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);

    try {
      for (const file of Array.from(files)) {
        const compressed = await imageCompression(file, {
          maxWidthOrHeight: 1600,
          maxSizeMB: 0.4,
          fileType: 'image/webp',
          useWebWorker: true,
          // Strips EXIF, which takes the GPS coordinates with it.
          preserveExif: false,
        });

        const dataUrl = await imageCompression.getDataUrlFromFile(compressed);
        const response = await fetch(`/api/runs/${runId}/photos`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ itemCode, groupKey, dataUrl }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          setError(body?.error ?? 'Bilden kunde inte sparas.');
          break;
        }
      }
      onChange();
    } catch {
      setError('Bilden kunde inte behandlas.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async (id: string) => {
    await fetch(`/api/photos/${id}`, { method: 'DELETE' });
    onChange();
  };

  const enough = photos.length >= minCount;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="gm-label mb-0">
          {label ?? 'Bild'}{' '}
          <span className={enough ? 'text-ja' : 'text-nej'}>
            {photos.length}/{minCount}
          </span>
        </span>
        <button
          type="button"
          className="gm-btn-secondary min-h-touch px-4"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
        >
          <Camera className="h-5 w-5" aria-hidden />
          {busy ? 'Bearbetar…' : 'Ta bild'}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="gm-sr-only"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {photos.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {photos.map((photo) => (
            <li key={photo.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- bytes are
                  served from our own authenticated route, not an optimisable URL */}
              <img
                src={`/api/photos/${photo.id}`}
                alt="Bifogad bild"
                className="h-20 w-20 rounded-gm border border-[hsl(var(--gm-border))] object-cover"
              />
              {!disabled ? (
                <button
                  type="button"
                  onClick={() => void remove(photo.id)}
                  className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-nej text-nej-fg shadow"
                  aria-label="Ta bort bild"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {error ? <p className="gm-error">{error}</p> : null}
    </div>
  );
}
