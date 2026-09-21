import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_SOURCE } from '../examples/examples'

const SOURCE_KEY = 'java-notepad:source'
const STDIN_KEY = 'java-notepad:stdin'
const DEBOUNCE_MS = 500

export function useEditorState() {
  const [source, setSource] = useState(
    () => localStorage.getItem(SOURCE_KEY) ?? DEFAULT_SOURCE,
  )
  const [stdin, setStdin] = useState(() => localStorage.getItem(STDIN_KEY) ?? '')
  const [isDirty, setDirty] = useState(false)
  const skipDirty = useRef(true)

  useEffect(() => {
    if (skipDirty.current) {
      skipDirty.current = false
      return
    }
    setDirty(true)
  }, [source])

  useEffect(() => {
    const id = setTimeout(() => {
      localStorage.setItem(SOURCE_KEY, source)
      localStorage.setItem(STDIN_KEY, stdin)
    }, DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [source, stdin])

  const reset = useCallback((nextSource: string, nextStdin: string) => {
    skipDirty.current = true
    setSource(nextSource)
    setStdin(nextStdin)
    setDirty(false)
  }, [])

  return { source, setSource, stdin, setStdin, isDirty, reset }
}
