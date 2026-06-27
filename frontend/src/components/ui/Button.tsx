import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

/**
 * Button. DESIGN.md §7:
 *   primary     = navy solid
 *   destructive = danger solid (e.g. "Konfirmasi Fraud")
 *   secondary   = white + border
 *   ghost       = low-emphasis
 * Height 36-40px; touch target >= 44px on full-width usage handled by callers.
 */
export type ButtonVariant = 'primary' | 'destructive' | 'secondary' | 'ghost'

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-white hover:bg-primary-700 border border-transparent shadow-btn',
  destructive:
    'bg-danger text-white hover:bg-[#991b1b] border border-transparent shadow-btn',
  secondary:
    'bg-surface text-ink border border-line hover:bg-bg hover:border-[#cbd2da] shadow-btn',
  ghost:
    'bg-transparent text-ink border border-transparent hover:bg-bg',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

export function Button({
  variant = 'primary',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex h-9 items-center justify-center rounded-md px-3 text-body font-semibold',
        'transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
