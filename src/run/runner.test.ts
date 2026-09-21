import { runJava, AllProvidersFailedError } from './runner'
import { type Provider, type RunResult, ProviderError } from './types'

const ok = (engine: string): RunResult => ({
  phase: 'run', stdout: 'ok', stderr: '', exitCode: 0, timeMs: 1, engine,
})

const compileFail = (engine: string): RunResult => ({
  phase: 'compile', stdout: '', stderr: 'error: bad', exitCode: 1, timeMs: null, engine,
})

function provider(id: string, impl: Provider['run']): Provider {
  return { id, label: id, run: vi.fn(impl) as Provider['run'] }
}

test('uses the first provider when it succeeds', async () => {
  const a = provider('a', async () => ok('a'))
  const b = provider('b', async () => ok('b'))
  const r = await runJava('class Main {}', '', [a, b])
  expect(r.engine).toBe('a')
  expect(b.run).not.toHaveBeenCalled()
})

test('falls over to the second provider on a transport failure', async () => {
  const a = provider('a', async () => { throw new ProviderError('a', 'HTTP 503') })
  const b = provider('b', async () => ok('b'))
  const r = await runJava('class Main {}', '', [a, b])
  expect(r.engine).toBe('b')
})

test('does NOT fail over on a compile error — the code is wrong, not the provider', async () => {
  const a = provider('a', async () => compileFail('a'))
  const b = provider('b', async () => ok('b'))
  const r = await runJava('class Main {}', '', [a, b])
  expect(r.phase).toBe('compile')
  expect(r.engine).toBe('a')
  expect(b.run).not.toHaveBeenCalled()
})

test('does NOT fail over on a non-zero exit code', async () => {
  const a = provider('a', async () => ({ ...ok('a'), exitCode: 1 }))
  const b = provider('b', async () => ok('b'))
  const r = await runJava('class Main {}', '', [a, b])
  expect(r.engine).toBe('a')
  expect(b.run).not.toHaveBeenCalled()
})

test('throws AllProvidersFailedError naming every attempt', async () => {
  const a = provider('a', async () => { throw new ProviderError('a', 'HTTP 503') })
  const b = provider('b', async () => { throw new ProviderError('b', 'network') })
  const err = await runJava('class Main {}', '', [a, b]).catch(e => e)
  expect(err).toBeInstanceOf(AllProvidersFailedError)
  expect(err.message).toContain('a')
  expect(err.message).toContain('b')
  expect(err.message).toContain('HTTP 503')
})

test('passes source and stdin through unchanged', async () => {
  const a = provider('a', async () => ok('a'))
  await runJava('SRC', 'IN', [a])
  expect(a.run).toHaveBeenCalledWith('SRC', 'IN', expect.any(AbortSignal))
})

test('aborts a provider that exceeds the timeout, then fails over', async () => {
  const a = provider('a', (_s, _i, signal) => new Promise((_res, rej) => {
    signal.addEventListener('abort', () => rej(new ProviderError('a', 'aborted')))
  }))
  const b = provider('b', async () => ok('b'))
  const r = await runJava('class Main {}', '', [a, b], 10)
  expect(r.engine).toBe('b')
})

test('an external abort signal cancels without failing over', async () => {
  const controller = new AbortController()
  const a = provider('a', (_s, _i, signal) => new Promise((_res, rej) => {
    signal.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')))
  }))
  const b = provider('b', async () => ok('b'))
  const p = runJava('class Main {}', '', [a, b], 5000, controller.signal)
  controller.abort()
  await expect(p).rejects.toThrow(/abort/i)
  expect(b.run).not.toHaveBeenCalled()
})
