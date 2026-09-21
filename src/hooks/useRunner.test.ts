import { renderHook, act, waitFor } from '@testing-library/react'
import { useRunner } from './useRunner'
import * as runner from '../run/runner'
import type { RunResult } from '../run/types'

const result: RunResult = {
  phase: 'run', stdout: 'hi\n', stderr: '', exitCode: 0, timeMs: 12,
  engine: 'Judge0 · JDK 17',
}

afterEach(() => vi.restoreAllMocks())

test('starts idle', () => {
  const { result: r } = renderHook(() => useRunner())
  expect(r.current.status).toBe('idle')
  expect(r.current.result).toBeNull()
})

test('stores the result and ends in done', async () => {
  vi.spyOn(runner, 'runJava').mockResolvedValue(result)
  const { result: r } = renderHook(() => useRunner())

  await act(async () => { await r.current.run('class Main {}', '') })

  expect(r.current.status).toBe('done')
  expect(r.current.result?.stdout).toBe('hi\n')
  expect(r.current.error).toBeNull()
})

test('surfaces the all-providers-failed message', async () => {
  vi.spyOn(runner, 'runJava').mockRejectedValue(
    new runner.AllProvidersFailedError([{ id: 'judge0', reason: 'HTTP 503' }]),
  )
  const { result: r } = renderHook(() => useRunner())

  await act(async () => { await r.current.run('class Main {}', '') })

  expect(r.current.status).toBe('done')
  expect(r.current.error).toContain('judge0')
  expect(r.current.result).toBeNull()
})

test('a user stop reports honestly and does not surface as a failure', async () => {
  vi.spyOn(runner, 'runJava').mockRejectedValue(
    new DOMException('Aborted', 'AbortError'),
  )
  const { result: r } = renderHook(() => useRunner())

  await act(async () => { await r.current.run('class Main {}', '') })

  await waitFor(() => expect(r.current.status).toBe('done'))
  expect(r.current.error).toMatch(/stopped waiting/i)
})
