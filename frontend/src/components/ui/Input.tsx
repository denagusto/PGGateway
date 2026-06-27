import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

/** Shared field styling — one source of truth so every form control looks identical. */
export const fieldClass =
  'w-full rounded-md border border-line bg-surface px-3 py-2 text-body text-ink ' +
  'placeholder:text-muted transition-colors hover:border-[#cbd2da] focus:border-accent'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldClass, className)} {...props} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldClass, className)} {...props} />
}

/** Field label + control wrapper for consistent vertical rhythm. */
export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1 block text-small font-medium text-muted">{label}</span>
      {children}
    </label>
  )
}
