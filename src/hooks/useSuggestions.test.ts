import { renderHook, act } from '@testing-library/react'
import { useSuggestions } from './useSuggestions'

beforeEach(() => localStorage.clear())

test('defaults to on', () => {
  const { result } = renderHook(() => useSuggestions())
  expect(result.current.enabled).toBe(true)
})

test('toggle turns it off and persists', () => {
  const { result } = renderHook(() => useSuggestions())
  act(() => result.current.toggle())
  expect(result.current.enabled).toBe(false)
  expect(localStorage.getItem('java-notepad:suggestions')).toBe('off')
})

test('a stored off value survives a remount', () => {
  localStorage.setItem('java-notepad:suggestions', 'off')
  const { result } = renderHook(() => useSuggestions())
  expect(result.current.enabled).toBe(false)
})
