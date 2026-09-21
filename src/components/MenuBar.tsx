import { useEffect, useRef, useState } from 'react'
import { EXAMPLES, type Example } from '../examples/examples'

interface Props {
  onRun: () => void
  onStop: () => void
  onSave: () => void
  onLoadExample: (e: Example) => void
  onToggleTheme: () => void
  running: boolean
}

export function MenuBar({
  onRun, onStop, onSave, onLoadExample, onToggleTheme, running,
}: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const item = 'px-2 py-1 hover:bg-[var(--bg-panel)] rounded-sm'

  return (
    <div
      className="flex items-center gap-1 border-b px-2 py-1 text-xs"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-panel)' }}
    >
      <button className={item} onClick={onSave}>Save</button>

      <button
        className={item}
        onClick={running ? onStop : onRun}
        aria-label={running ? 'Stop' : 'Run'}
      >
        {running ? 'Stop' : 'Run'}
      </button>

      <div ref={ref} className="relative">
        <button className={item} aria-label="Examples" onClick={() => setOpen(o => !o)}>
          Examples
        </button>
        {open && (
          <div
            role="menu"
            className="absolute left-0 top-full z-10 w-48 border py-1 shadow-lg"
            style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
          >
            {EXAMPLES.map(ex => (
              <button
                key={ex.name}
                role="menuitem"
                className="block w-full px-3 py-1 text-left hover:bg-[var(--bg-panel)]"
                onClick={() => { onLoadExample(ex); setOpen(false) }}
              >
                {ex.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <span
        data-testid="limits"
        className="ml-auto mr-2 hidden sm:inline"
        style={{ color: 'var(--fg-muted)' }}
      >
        one file · no external libraries · runs on a third-party service
      </span>

      <button className={item} aria-label="Toggle theme" onClick={onToggleTheme}>☾</button>
    </div>
  )
}
