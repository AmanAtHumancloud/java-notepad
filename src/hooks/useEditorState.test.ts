import { renderHook, act } from '@testing-library/react'
import { useEditorState } from './useEditorState'
import { DEFAULT_SOURCE } from '../examples/examples'

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

test('starts from the default source when nothing is stored', () => {
  const { result } = renderHook(() => useEditorState())
  expect(result.current.source).toBe(DEFAULT_SOURCE)
  expect(result.current.isDirty).toBe(false)
})

test('restores a stored source', () => {
  localStorage.setItem('java-notepad:source', 'class Restored {}')
  const { result } = renderHook(() => useEditorState())
  expect(result.current.source).toBe('class Restored {}')
})

test('autosaves after the debounce window, not before', () => {
  const { result } = renderHook(() => useEditorState())
  act(() => result.current.setSource('class Edited {}'))

  expect(localStorage.getItem('java-notepad:source')).not.toBe('class Edited {}')
  act(() => { vi.advanceTimersByTime(500) })
  expect(localStorage.getItem('java-notepad:source')).toBe('class Edited {}')
})

test('editing marks the buffer dirty', () => {
  const { result } = renderHook(() => useEditorState())
  act(() => result.current.setSource('class Edited {}'))
  expect(result.current.isDirty).toBe(true)
})

test('reset replaces source and stdin and clears dirty', () => {
  const { result } = renderHook(() => useEditorState())
  act(() => result.current.setSource('class Edited {}'))
  act(() => result.current.reset('class Fresh {}', 'input'))
  expect(result.current.source).toBe('class Fresh {}')
  expect(result.current.stdin).toBe('input')
  expect(result.current.isDirty).toBe(false)
})

test('stdin persists separately', () => {
  const { result } = renderHook(() => useEditorState())
  act(() => result.current.setStdin('Aman'))
  act(() => { vi.advanceTimersByTime(500) })
  expect(localStorage.getItem('java-notepad:stdin')).toBe('Aman')
})
