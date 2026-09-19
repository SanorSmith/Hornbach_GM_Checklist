'use client';

import { Delete } from 'lucide-react';
import { cn } from '@/lib/utils';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

/**
 * A numeric pad rather than the device keyboard.
 *
 * On a 4" Zebra the Android keyboard covers most of the screen and its keys are
 * far below a gloved fingertip's accuracy. These are 64px targets, well above
 * the 48px floor, because this is the control every worker touches first at
 * 06:00 with cold hands.
 */
export function PinPad({
  value,
  maxLength,
  onChange,
  disabled,
}: {
  value: string;
  maxLength: number;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const press = (digit: string) => {
    if (value.length >= maxLength) return;
    onChange(value + digit);
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          disabled={disabled}
          onClick={() => press(key)}
          className="gm-btn-secondary h-16 text-2xl font-bold"
          aria-label={key}
        >
          {key}
        </button>
      ))}
      <button
        type="button"
        disabled={disabled || value.length === 0}
        onClick={() => onChange('')}
        className="gm-btn-ghost h-16 text-base"
      >
        Rensa
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => press('0')}
        className="gm-btn-secondary h-16 text-2xl font-bold"
        aria-label="0"
      >
        0
      </button>
      <button
        type="button"
        disabled={disabled || value.length === 0}
        onClick={() => onChange(value.slice(0, -1))}
        className="gm-btn-ghost h-16"
        aria-label="Radera siffra"
      >
        <Delete className="h-6 w-6" aria-hidden />
      </button>
    </div>
  );
}

/** Shows how many digits are entered without ever showing the digits. */
export function PinDots({ length, max }: { length: number; max: number }) {
  return (
    <div className="flex justify-center gap-2 py-1" aria-hidden>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={cn(
            'h-3.5 w-3.5 rounded-full border-2 transition-colors',
            i < length
              ? 'border-[hsl(var(--gm-brand))] bg-[hsl(var(--gm-brand))]'
              : 'border-[hsl(var(--gm-border))]',
          )}
        />
      ))}
    </div>
  );
}
