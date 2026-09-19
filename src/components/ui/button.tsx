import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * `size` defaults to `touch` (48px). That is not a styling preference: the
 * worker shell is operated with gloves on a 4" screen, and anything smaller is
 * a mis-tap that lands in a signed record. Use `compact` only in the leader's
 * desktop views.
 */
const buttonVariants = cva('gm-btn', {
  variants: {
    variant: {
      primary: 'gm-btn-primary',
      secondary: 'gm-btn-secondary',
      ghost: 'gm-btn-ghost',
      danger: 'gm-btn-danger',
    },
    size: {
      touch: 'min-h-touch px-5 text-base',
      compact: 'min-h-9 px-3 text-sm',
      block: 'min-h-touch w-full px-5 text-base',
    },
  },
  defaultVariants: { variant: 'primary', size: 'touch' },
});

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = 'Button';

export { buttonVariants };
