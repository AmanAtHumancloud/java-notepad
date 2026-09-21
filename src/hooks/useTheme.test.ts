import { renderHook, act } from '@testing-library/react'
import { useTheme } from './useTheme'

/** A controllable matchMedia so 'system' can be driven from the test. */
function stubMatchMedia(matches: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>()
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
    matches,
    addEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => listeners.delete(fn),
  }))
  return {
    emit(next: boolean) {
      listeners.forEach(fn => fn({ matches: next } as MediaQueryListEvent))
    },
  }
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})
afterEach(() => vi.unstubAllGlobals())

test('defaults to following the system', () => {
  stubMatchMedia(false)
  const { result } = renderHook(() => useTheme())
  expect(result.current.preference).toBe('system')
  expect(result.current.theme).toBe('light')
})

test('system preference resolves to dark when the OS prefers dark', () => {
  stubMatchMedia(true)
  const { result } = renderHook(() => useTheme())
  expect(result.current.theme).toBe('dark')
})

test('system mode re-themes live when the OS preference changes', () => {
  const mq = stubMatchMedia(false)
  const { result } = renderHook(() => useTheme())
  expect(result.current.theme).toBe('light')

  act(() => mq.emit(true))

  expect(result.current.theme).toBe('dark')
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
})

test('an explicit preference ignores the OS and does not move', () => {
  const mq = stubMatchMedia(false)
  const { result } = renderHook(() => useTheme())
  act(() => result.current.setPreference('light'))

  act(() => mq.emit(true))

  expect(result.current.theme).toBe('light')
})

test('the preference is persisted, not the resolved theme', () => {
  stubMatchMedia(true)
  const { result } = renderHook(() => useTheme())
  act(() => result.current.setPreference('system'))
  // Storing 'dark' here is the bug that made system unreachable.
  expect(localStorage.getItem('java-notepad:theme')).toBe('system')
})

test('a stored preference survives a remount', () => {
  stubMatchMedia(false)
  localStorage.setItem('java-notepad:theme', 'dark')
  const { result } = renderHook(() => useTheme())
  expect(result.current.preference).toBe('dark')
  expect(result.current.theme).toBe('dark')
})

test('a legacy stored value from the two-way toggle still parses', () => {
  stubMatchMedia(false)
  localStorage.setItem('java-notepad:theme', 'light')
  const { result } = renderHook(() => useTheme())
  expect(result.current.preference).toBe('light')
})
