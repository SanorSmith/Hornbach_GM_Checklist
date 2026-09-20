'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Eraser, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Writing your name on the glass with a finger.
 *
 * The paper form had a line to sign on, and this is that line. The drawing is
 * not what makes the signature valid — the hash chain does that — but it is
 * what a person recognises as their own mark on a printed record, and it is
 * what the binder used to hold.
 *
 * Pointer events rather than touch events: one code path covers a gloved
 * finger on a Zebra, a stylus, and a mouse on the office desktop, and
 * `setPointerCapture` keeps the stroke alive when the finger slides past the
 * edge of the canvas mid-letter.
 */
export function SignaturePad({
  displayName,
  username,
  busy,
  onCancel,
  onSign,
}: {
  displayName: string;
  username: string;
  busy: boolean;
  onCancel: () => void;
  /** `drawing` is base64 PNG without the data-URL prefix, or null if skipped. */
  onSign: (drawing: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  // The canvas is sized to its own box in device pixels, so a stroke is not a
  // blurry rectangle on a 3x phone screen.
  const fitCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const box = canvas.getBoundingClientRect();
    canvas.width = Math.round(box.width * ratio);
    canvas.height = Math.round(box.height * ratio);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111827';
  }, []);

  useEffect(() => {
    fitCanvas();
    window.addEventListener('resize', fitCanvas);
    return () => window.removeEventListener('resize', fitCanvas);
  }, [fitCanvas]);

  const pointAt = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    const { x, y } = pointAt(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
    // A dot is a signature too — someone who taps once has still made a mark.
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasInk(true);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = pointAt(event);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const end = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  };

  const submit = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasInk) return onSign(null);
    // Flattened onto white: a transparent PNG is invisible on a printed page.
    const flat = document.createElement('canvas');
    flat.width = canvas.width;
    flat.height = canvas.height;
    const ctx = flat.getContext('2d');
    if (!ctx) return onSign(null);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, flat.width, flat.height);
    ctx.drawImage(canvas, 0, 0);
    onSign(flat.toDataURL('image/png').split(',')[1] ?? null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Skriv din namnteckning"
    >
      <div className="gm-card w-full max-w-lg p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold">Skriv din namnteckning</h2>
            <p className="gm-muted text-sm">Rita med fingret i rutan nedan.</p>
          </div>
          <Button variant="ghost" size="compact" onClick={onCancel} aria-label="Stäng">
            <X className="h-5 w-5" aria-hidden />
          </Button>
        </div>

        <canvas
          ref={canvasRef}
          // `touch-none` is what stops the phone scrolling the page instead of
          // drawing the moment the finger moves.
          className="mt-3 h-44 w-full touch-none rounded-gm border-2 border-dashed border-[hsl(var(--gm-border))] bg-white"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerLeave={end}
        />

        <p className="gm-muted mt-1 text-center text-xs">
          {displayName} ({username})
        </p>

        <div className="mt-4 flex items-center gap-2">
          <Button variant="secondary" onClick={clear} disabled={!hasInk || busy} className="gap-2">
            <Eraser className="h-4 w-4" aria-hidden />
            Rensa
          </Button>
          <Button onClick={submit} disabled={!hasInk || busy} className="flex-1 gap-2">
            <ShieldCheck className="h-5 w-5" aria-hidden />
            Signera
          </Button>
        </div>

        {/* Nobody gets stranded by a screen that will not take their finger.
            The signature is still valid without a drawing — the hash is what
            makes it one. */}
        <button
          type="button"
          onClick={() => onSign(null)}
          disabled={busy}
          className="gm-muted mt-3 block w-full text-center text-sm underline focus-visible:rounded-gm"
        >
          Signera utan namnteckning
        </button>
      </div>
    </div>
  );
}
