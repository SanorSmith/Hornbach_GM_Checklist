'use client';

import { useState } from 'react';
import { PhotoLightbox } from '@/components/ui/photo-lightbox';
import type { AttachmentMeta } from '@/lib/repo/types';

/**
 * The photos attached to one point of a filed record.
 *
 * Thumbnails on the page so the printed copy carries the evidence, and each
 * one opens full-screen so a group leader can actually review it rather than
 * approve a 96px square on faith.
 */
export function RecordPhotos({
  photos,
  caption,
  countLabel,
}: {
  photos: AttachmentMeta[];
  /** The point's own text, kept with the photo once it fills the screen. */
  caption: string;
  countLabel: string;
}) {
  const [open, setOpen] = useState<number | null>(null);

  if (photos.length === 0) return null;

  return (
    <div className="mt-2">
      <p className="gm-muted text-xs">{countLabel}</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {photos.map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setOpen(index)}
            className="rounded-gm focus-visible:outline focus-visible:outline-2"
            aria-label={`Öppna bild ${index + 1} i full storlek`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- bytes come
                from our own authenticated route, not an optimisable URL */}
            <img
              src={`/api/photos/${photo.id}`}
              alt=""
              className="gm-print-photo h-24 w-auto rounded-gm border border-[hsl(var(--gm-border))]"
            />
          </button>
        ))}
      </div>

      <PhotoLightbox
        photos={photos}
        index={open}
        caption={caption}
        onIndexChange={setOpen}
        onClose={() => setOpen(null)}
      />
    </div>
  );
}
