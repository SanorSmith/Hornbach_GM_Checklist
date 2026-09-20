'use client';

import { useState } from 'react';
import { PhotoLightbox } from '@/components/ui/photo-lightbox';
import type { RecordPhoto } from '@/lib/reports/record';
import { formatTime } from '@/lib/utils';

/**
 * The photos attached to one point of a filed record.
 *
 * On screen: thumbnails that open full-screen, because the photo is the
 * evidence and a group leader has to be able to look at it.
 *
 * On paper: the names only. A filed protokoll is read for what was answered
 * and by whom; printing fifteen photographs turns a two-page record into a
 * dozen and empties a toner cartridge a week. The names stay so the paper
 * still says which pictures exist and how to find them — the originals are in
 * the system, which is where the record already points for everything else.
 */
export function RecordPhotos({
  photos,
  caption,
  countLabel,
}: {
  photos: RecordPhoto[];
  /** The point's own text, kept with the photo once it fills the screen. */
  caption: string;
  countLabel: string;
}) {
  const [open, setOpen] = useState<number | null>(null);

  if (photos.length === 0) return null;

  return (
    <div className="mt-2">
      <p className="gm-muted text-xs">{countLabel}</p>

      <div className="gm-no-print mt-1 flex flex-wrap gap-2">
        {photos.map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setOpen(index)}
            className="rounded-gm focus-visible:outline focus-visible:outline-2"
            aria-label={`Öppna ${photo.name} i full storlek`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- bytes come
                from our own authenticated route, not an optimisable URL */}
            <img
              src={`/api/photos/${photo.id}`}
              alt=""
              className="h-24 w-auto rounded-gm border border-[hsl(var(--gm-border))]"
            />
          </button>
        ))}
      </div>

      <ul className="gm-print-only gm-muted text-xs">
        {photos.map((photo) => (
          <li key={photo.id}>
            {photo.name} · {formatTime(photo.uploadedAt)} · {photo.shortId}
          </li>
        ))}
      </ul>

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
