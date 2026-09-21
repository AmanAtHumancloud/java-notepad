import CodeMirror from '@uiw/react-codemirror'
import { java } from '@codemirror/lang-java'
import { EditorView } from '@codemirror/view'
import type { Theme } from '../hooks/useTheme'

interface Props {
  value: string
  onChange: (v: string) => void
  onCursor: (line: number, col: number) => void
  theme: Theme
}

/** Reads the CSS tokens so the editor and the chrome cannot drift apart. */
function cmTheme(theme: Theme) {
  const read = (name: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim()

  return EditorView.theme({
    '&': { backgroundColor: read('--bg'), color: read('--fg'), height: '100%' },
    '.cm-gutters': {
      backgroundColor: read('--bg-panel'),
      color: read('--fg-muted'),
      border: 'none',
    },
    '.cm-activeLine': { backgroundColor: read('--bg-panel') },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
      backgroundColor: read('--selection'),
    },
  }, { dark: theme === 'dark' })
}

export function Editor({ value, onChange, onCursor, theme }: Props) {
  return (
    <CodeMirror
      value={value}
      height="100%"
      theme={cmTheme(theme)}
      extensions={[java(), EditorView.lineWrapping]}
      onChange={onChange}
      onUpdate={v => {
        if (!v.selectionSet && !v.docChanged) return
        const pos = v.state.selection.main.head
        const line = v.state.doc.lineAt(pos)
        onCursor(line.number, pos - line.from + 1)
      }}
      basicSetup={{ tabSize: 4, foldGutter: false }}
    />
  )
}
