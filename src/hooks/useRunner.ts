import { useCallback, useRef, useState } from 'react'
import * as runner from '../run/runner'
import type { RunResult } from '../run/types'

export type RunStatus = 'idle' | 'running' | 'done'

export function useRunner() {
  const [status, setStatus] = useState<RunStatus>('idle')
  const [result, setResult] = useState<RunResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const controller = useRef<AbortController | null>(null)

  const run = useCallback(async (source: string, stdin: string) => {
    controller.current?.abort()
    const ctrl = new AbortController()
    controller.current = ctrl

    setStatus('running')
    setResult(null)
    setError(null)

    try {
      const r = await runner.runJava(
        source, stdin, runner.DEFAULT_PROVIDERS, runner.DEFAULT_TIMEOUT_MS, ctrl.signal,
      )
      setResult(r)
    } catch (e) {
      // We cannot kill the remote process, only stop waiting for it. Say so.
      setError(
        (e as Error).name === 'AbortError'
          ? 'Stopped waiting. The program may still be running on the server.'
          : (e as Error).message,
      )
    } finally {
      setStatus('done')
    }
  }, [])

  const stop = useCallback(() => controller.current?.abort(), [])

  return { status, result, error, run, stop }
}
