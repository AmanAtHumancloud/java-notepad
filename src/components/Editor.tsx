import CodeMirror from '@uiw/react-codemirror'
import { java } from '@codemirror/lang-java'
import { EditorView } from '@codemirror/view'
import { autocompletion, completeAnyWord } from '@codemirror/autocomplete'
import { javaCompletionSource } from '../editor/java-completions'
import { LIGHT_THEME, DARK_THEME } from '../editor/editor-theme'
import type { Theme } from '../hooks/useTheme'

interface Props {
  value: string
  onChange: (v: string) => void
  onCursor: (line: number, col: number) => void
  theme: Theme
  suggestions: boolean
}

export function Editor({ value, onChange, onCursor, theme, suggestions }: Props) {
  return (
    <CodeMirror
      value={value}
      height="100%"
      theme={theme === 'dark' ? DARK_THEME : LIGHT_THEME}
      extensions={[
        java(),
        EditorView.lineWrapping,
        // When off, the extension is absent entirely — not merely suppressed.
        ...(suggestions
          ? [autocompletion({ override: [javaCompletionSource, completeAnyWord] })]
          : []),
      ]}
      onChange={onChange}
      onUpdate={v => {
        if (!v.selectionSet && !v.docChanged) return
        const pos = v.state.selection.main.head
        const line = v.state.doc.lineAt(pos)
        onCursor(line.number, pos - line.from + 1)
      }}
      // We own completion entirely, so CodeMirror's default is off.
      basicSetup={{ tabSize: 4, foldGutter: false, autocompletion: false }}
    />
  )
}
