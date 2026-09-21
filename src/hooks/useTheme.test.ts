import { renderHook, act } from '@testing-library/react'
import { useTheme } from './useTheme'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
    matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }))
})

test('defaults to light when the system does not prefer dark', () => {
  const { result } = renderHook(() => useTheme())
  expect(result.current.theme).toBe('light')
})

test('defaults to dark when the system prefers dark', () => {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
    matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }))
  const { result } = renderHook(() => useTheme())
  expect(result.current.theme).toBe('dark')
})

test('toggle flips the theme and sets the document attribute', () => {
  const { result } = renderHook(() => useTheme())
  act(() => result.current.toggle())
  expect(result.current.theme).toBe('dark')
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
})

test('an explicit choice persists and wins over the system preference', () => {
  localStorage.setItem('java-notepad:theme', 'dark')
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
    matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }))
  const { result } = renderHook(() => useTheme())
  expect(result.current.theme).toBe('dark')
})
