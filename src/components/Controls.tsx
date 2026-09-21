import type { ThemePreference } from '../hooks/useTheme'

interface Props {
  preference: ThemePreference
  onPreferenceChange: (p: ThemePreference) => void
  suggestions: boolean
  onSuggestionsToggle: () => void
}

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

export function Controls({
  preference, onPreferenceChange, suggestions, onSuggestionsToggle,
}: Props) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onSuggestionsToggle}
        aria-pressed={suggestions}
        className="flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-xs"
        style={{
          borderColor: 'var(--border)',
          background: suggestions ? 'var(--bg)' : 'transparent',
          color: suggestions ? 'var(--fg)' : 'var(--fg-muted)',
        }}
        title="Ctrl+Space to request suggestions manually"
      >
        <span
          aria-hidden
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: suggestions ? 'var(--accent)' : 'var(--border)' }}
        />
        Suggestions
      </button>

      <div
        role="radiogroup"
        aria-label="Theme"
        className="flex overflow-hidden rounded-sm border"
        style={{ borderColor: 'var(--border)' }}
      >
        {THEMES.map(t => {
          const active = preference === t.value
          return (
            <button
              key={t.value}
              role="radio"
              aria-checked={active}
              aria-label={t.label}
              onClick={() => onPreferenceChange(t.value)}
              className="px-2 py-0.5 text-xs"
              style={{
                background: active ? 'var(--accent)' : 'transparent',
                color: active ? 'var(--bg)' : 'var(--fg-muted)',
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
