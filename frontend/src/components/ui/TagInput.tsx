import { useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'

/**
 * Tag input: type a value and press Enter (or comma) to add it as a chip; each chip has a remove
 * button; Backspace on an empty field removes the last chip. Supports multiple tags. Value is
 * stored as a comma-separated string so it maps cleanly onto the backend's single `report` field.
 */
export function TagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const tags = value ? value.split(',').map((t) => t.trim()).filter(Boolean) : []
  const [draft, setDraft] = useState('')

  const commit = (next: string[]) => onChange(next.join(', '))
  const add = () => {
    const t = draft.trim()
    if (t && !tags.includes(t)) commit([...tags, t])
    setDraft('')
  }
  const removeAt = (i: number) => commit(tags.filter((_, idx) => idx !== i))

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add()
    } else if (e.key === 'Backspace' && !draft && tags.length) {
      removeAt(tags.length - 1)
    }
  }

  return (
    <div className="flex w-full flex-wrap items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1.5 transition-colors hover:border-[#cbd2da] focus-within:border-accent">
      {tags.map((t, i) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 rounded-md bg-primary/10 py-0.5 pl-2 pr-1 text-small font-semibold text-primary"
        >
          {t}
          <button
            type="button"
            onClick={() => removeAt(i)}
            aria-label={`Hapus ${t}`}
            className="grid h-4 w-4 place-items-center rounded text-primary/60 hover:bg-primary/15 hover:text-primary"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
        onBlur={add}
        placeholder={tags.length ? '' : placeholder}
        className="min-w-[90px] flex-1 border-0 bg-transparent p-0 text-body text-ink placeholder:text-muted focus:outline-none"
      />
    </div>
  )
}
