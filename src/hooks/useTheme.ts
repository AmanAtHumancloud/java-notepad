import { useCallback, useEffect, useState } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'
export type Theme = 'light' | 'dark'

const KEY = 'java-notepad:theme'
const QUERY = '(prefers-color-scheme: dark)'

/** Old builds stored a resolved 'light'/'dark'; both still parse. */
function readPreference(): ThemePreference {
  const s = localStorage.getItem(KEY)
  return s === 'light' || s === 'dark' || s === 'system' ? s : 'system'
}

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(readPreference)
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia(QUERY).matches,
  )

  // Subscribe, rather than reading once at mount, so 'system' re-themes live
  // when the OS preference changes with the tab open.
  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const theme: Theme =
    preference === 'system' ? (systemDark ? 'dark' : 'light') : preference

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    // Persist the *preference*, never the resolved value — storing the
    // resolved value is what made 'system' unreachable once chosen.
    localStorage.setItem(KEY, preference)
  }, [theme, preference])

  return { preference, theme, setPreference: useCallback(setPreference, []) }
}
