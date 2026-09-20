'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, X, ZoomIn, ZoomOut } from 'lucide-react';
import type { AttachmentMeta } from '@/lib/repo/types';
import { formatDateTime } from '@/lib/utils';

/**
 * A photo at the size it was taken.
 *
 * The photos are the evidence — the empty container, the swept yard — and a
 * group leader doing efterkontroll has to be able to actually look at one.
 * A 96px thumbnail is enough to see that a photo exists and not nearly enough
 * to see what is in it, which makes the review a rubber stamp.
 *
 * Opens fitted to the screen, and zooms to natural size for the detail: a
 * label, a date on a pallet, whether that really is the right container.
 */

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PhotoLightbox({
  photos,
  index,
  caption,
  onIndexChange,
  onClose,
}: {
  photos: AttachmentMeta[];
  /** Which photo is open; null when the viewer is closed. */
  index: number | null;
  /** The point the photos belong to, so the context survives the zoom. */
  caption?: string;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  // Which photo is zoomed, rather than a zoomed flag: moving to the next photo
  // then un-zooms by itself, because the index no longer matches. Carrying a
  // zoom across would land the next one already scrolled into a corner.
  const [zoomedIndex, setZoomedIndex] = useState<number | null>(null);
  const open = index !== null && index >= 0 && index < photos.length;
  const photo = open ? photos[index]! : null;
  const zoomed = index !== null && zoomedIndex === index;

  const toggleZoom = () => setZoomedIndex(zoomed ? null : index);

  const step = useCallback(
    (delta: number) => {
      if (index === null || photos.length === 0) return;
      onIndexChange((index + delta + photos.length) % photos.length);
    },
    [index, photos.length, onIndexChange],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') step(1);
      if (event.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    // The page behind must not scroll while a full-screen photo is open.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose, step]);

  if (!open || !photo) return null;

  return (
    <div
      className="gm-no-print fixed inset-0 z-50 flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={caption ? `Bild: ${caption}` : 'Bild'}
    >
      <div className="flex items-start justify-between gap-2 p-3 text-white">
        <div className="min-w-0">
          {caption ? <p className="truncate text-sm font-semibold">{caption}</p> : null}
          <p className="truncate text-xs text-white/70">
            {photos.length > 1 ? `Bild ${index + 1} av ${photos.length} · ` : ''}
            {formatDateTime(photo.uploadedAt)} · {formatBytes(photo.byteSize)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={toggleZoom}
            className="flex min-h-touch min-w-touch items-center justify-center rounded-gm text-white hover:bg-white/10"
            aria-label={zoomed ? 'Passa till skärmen' : 'Zooma in'}
            aria-pressed={zoomed}
          >
            {zoomed ? (
              <ZoomOut className="h-6 w-6" aria-hidden />
            ) : (
              <ZoomIn className="h-6 w-6" aria-hidden />
            )}
          </button>
          {/* The photo route serves inline, so this hands the image to the
              browser's own viewer — pinch, rotate, save, print one picture. */}
          <a
            href={`/api/photos/${photo.id}`}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-touch min-w-touch items-center justify-center rounded-gm text-white hover:bg-white/10"
            aria-label="Öppna i nytt fönster"
          >
            <ExternalLink className="h-6 w-6" aria-hidden />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-touch min-w-touch items-center justify-center rounded-gm text-white hover:bg-white/10"
            aria-label="Stäng"
          >
            <X className="h-7 w-7" aria-hidden />
          </button>
        </div>
      </div>

      <div
        className={
          zoomed
            ? 'flex-1 overflow-auto p-2'
            : 'flex flex-1 items-center justify-center overflow-hidden p-2'
        }
        // Closing by tapping the backdrop is the gesture people expect, but
        // only when tapping past the picture rather than on it.
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- bytes come from
            our own authenticated route, not an optimisable URL */}
        <img
          src={`/api/photos/${photo.id}`}
          alt={caption ? `Bild för ${caption}` : 'Bifogad bild'}
          className={zoomed ? 'max-w-none' : 'max-h-full max-w-full object-contain'}
          onClick={toggleZoom}
        />
      </div>

      {photos.length > 1 ? (
        <div className="flex items-center justify-between gap-3 p-3">
          <button
            type="button"
            onClick={() => step(-1)}
            className="flex min-h-touch items-center gap-1 rounded-gm px-4 text-white hover:bg-white/10"
          >
            <ChevronLeft className="h-6 w-6" aria-hidden />
            Föregående
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            className="flex min-h-touch items-center gap-1 rounded-gm px-4 text-white hover:bg-white/10"
          >
            Nästa
            <ChevronRight className="h-6 w-6" aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
}
