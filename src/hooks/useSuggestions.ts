import { useCallback, useEffect, useState } from 'react'

const KEY = 'java-notepad:suggestions'

export function useSuggestions() {
  const [enabled, setEnabled] = useState(
    () => localStorage.getItem(KEY) !== 'off',
  )

  useEffect(() => {
    localStorage.setItem(KEY, enabled ? 'on' : 'off')
  }, [enabled])

  return { enabled, toggle: useCallback(() => setEnabled(e => !e), []) }
}
