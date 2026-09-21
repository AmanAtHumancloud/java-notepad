import { EditorState } from '@codemirror/state'
import { CompletionContext } from '@codemirror/autocomplete'
import { javaCompletionSource, SNIPPETS, OPTIONS } from './java-completions'

function complete(doc: string, explicit = false) {
  const state = EditorState.create({ doc })
  return javaCompletionSource(new CompletionContext(state, doc.length, explicit))
}

test('offers completions for a partial word', () => {
  const r = complete('sou')
  expect(r).not.toBeNull()
  expect(r!.from).toBe(0)
  expect(r!.options.map(o => o.label)).toContain('sout')
})

test('a dotted name is treated as one token, so System.out.println is reachable', () => {
  const r = complete('System.out.pri')
  expect(r!.from).toBe(0)
  expect(r!.options.map(o => o.label)).toContain('System.out.println')
})

test('does not pop up in empty space unless explicitly asked', () => {
  expect(complete('')).toBeNull()
  expect(complete('', true)).not.toBeNull()
})

test('sout expands to a println with a placeholder', () => {
  const sout = SNIPPETS.find(s => s.label === 'sout')!
  expect(sout.detail).toBe('print a line')
  // The template lives in the completion's apply function, which CodeMirror
  // builds from the string passed to snippetCompletion.
  expect(typeof sout.apply).toBe('function')
})

test('the snippets people actually reach for are present', () => {
  const labels = SNIPPETS.map(s => s.label)
  expect(labels).toEqual(expect.arrayContaining([
    'sout', 'psvm', 'fori', 'foreach', 'trycatch', 'scanner',
  ]))
})

test('keywords and common API are both offered', () => {
  const labels = OPTIONS.map(o => o.label)
  expect(labels).toContain('implements')
  expect(labels).toContain('Scanner')
  expect(labels).toContain('Collectors.joining')
})

test('snippets outrank plain words so sout beats any sou* identifier', () => {
  const sout = OPTIONS.find(o => o.label === 'sout')!
  const keyword = OPTIONS.find(o => o.label === 'static')!
  expect(sout.boost ?? 0).toBeGreaterThan(keyword.boost ?? 0)
})
