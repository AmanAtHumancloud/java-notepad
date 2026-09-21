import { useCallback, useEffect, useState } from 'react'
import { MenuBar } from './components/MenuBar'
import { Editor } from './components/Editor'
import { OutputPane } from './components/OutputPane'
import { StatusBar } from './components/StatusBar'
import { Resizer } from './components/Resizer'
import { Controls } from './components/Controls'
import { useTheme } from './hooks/useTheme'
import { useSuggestions } from './hooks/useSuggestions'
import { useEditorState } from './hooks/useEditorState'
import { useRunner } from './hooks/useRunner'
import type { Example } from './examples/examples'

export default function App() {
  const { theme, preference, setPreference } = useTheme()
  const suggestions = useSuggestions()
  const { source, setSource, stdin, setStdin, isDirty, reset } = useEditorState()
  const { status, result, error, run, stop } = useRunner()
  const [cursor, setCursor] = useState({ line: 1, col: 1 })
  const [tab, setTab] = useState<'output' | 'input'>('output')
  const [paneHeight, setPaneHeight] = useState(224)

  const running = status === 'running'

  const doRun = useCallback(() => {
    setTab('output')
    void run(source, stdin)
  }, [run, source, stdin])

  const doSave = useCallback(() => {
    const url = URL.createObjectURL(new Blob([source], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'Main.java'
    a.click()
    URL.revokeObjectURL(url)
  }, [source])

  const loadExample = useCallback((ex: Example) => {
    if (isDirty && !confirm('Discard your current code?')) return
    reset(ex.source, ex.stdin)
  }, [isDirty, reset])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.key === 'Enter') { e.preventDefault(); doRun() }
      // Trap Ctrl+S so the browser's save dialog never appears.
      if (e.key === 's') { e.preventDefault(); doSave() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doRun, doSave])

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--bg)' }}>
      <MenuBar
        onRun={doRun}
        onStop={stop}
        onSave={doSave}
        onLoadExample={loadExample}
        running={running}
        controls={
          <Controls
            preference={preference}
            onPreferenceChange={setPreference}
            suggestions={suggestions.enabled}
            onSuggestionsToggle={suggestions.toggle}
          />
        }
      />

      <div className="min-h-0 flex-1 overflow-hidden">
        <Editor
          value={source}
          onChange={setSource}
          onCursor={(line, col) => setCursor({ line, col })}
          theme={theme}
          suggestions={suggestions.enabled}
        />
      </div>

      <Resizer height={paneHeight} onResize={setPaneHeight} />

      <div className="flex min-h-0 flex-col" style={{ height: paneHeight }}>
        <OutputPane
          result={result}
          error={error}
          stdin={stdin}
          onStdinChange={setStdin}
          activeTab={tab}
          onTabChange={setTab}
        />
      </div>

      <StatusBar
        line={cursor.line}
        col={cursor.col}
        result={result}
        error={error}
        running={running}
      />
    </div>
  )
}
