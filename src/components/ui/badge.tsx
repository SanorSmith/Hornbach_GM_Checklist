import * as React from 'react';
import { cn } from '@/lib/utils';

const TONES = {
  neutral: 'gm-badge-neutral',
  ja: 'gm-badge-ja',
  nej: 'gm-badge-nej',
  brand: 'gm-badge-brand',
} as const;

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: keyof typeof TONES;
}

export function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  return <span className={cn(TONES[tone], className)} {...props} />;
}
