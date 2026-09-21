import { EditorView } from '@codemirror/view'

/**
 * Style rules for the editor.
 *
 * These reference the CSS custom properties directly rather than reading
 * their resolved values with getComputedStyle. Reading them imperatively
 * means reading during render, but `data-theme` is applied in an effect that
 * runs *after* render — so the editor always picked up the previous theme's
 * colours and appeared inverted. Letting CSS resolve `var()` at paint time
 * removes the ordering problem entirely.
 */
export function themeSpec(): Record<string, Record<string, string>> {
  return {
    '&': {
      backgroundColor: 'var(--bg)',
      color: 'var(--fg)',
      height: '100%',
    },
    '.cm-gutters': {
      backgroundColor: 'var(--bg-panel)',
      color: 'var(--fg-muted)',
      border: 'none',
    },
    '.cm-activeLine': { backgroundColor: 'var(--bg-panel)' },
    '.cm-activeLineGutter': { backgroundColor: 'var(--bg-panel)' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--fg)' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, .cm-content ::selection':
      { backgroundColor: 'var(--selection)' },
    '.cm-tooltip-autocomplete': {
      backgroundColor: 'var(--bg-panel)',
      color: 'var(--fg)',
      border: '1px solid var(--border)',
    },
    '.cm-tooltip-autocomplete ul li[aria-selected]': {
      backgroundColor: 'var(--accent)',
      color: 'var(--bg)',
    },
  }
}

/**
 * Two stable extensions rather than one built per render — rebuilding the
 * theme on every render forces CodeMirror to reconfigure needlessly.
 * The `dark` flag is all that differs; it drives CodeMirror's own
 * light/dark base styles.
 */
export const LIGHT_THEME = EditorView.theme(themeSpec(), { dark: false })
export const DARK_THEME = EditorView.theme(themeSpec(), { dark: true })
