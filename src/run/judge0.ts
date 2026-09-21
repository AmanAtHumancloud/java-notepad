import { type Provider, type RunResult, ProviderError } from './types'

const ENDPOINT =
  'https://ce.judge0.com/submissions?wait=true&base64_encoded=false' +
  '&fields=stdout,stderr,compile_output,message,time,exit_code,status'

const LANGUAGE_ID = 91 // Java (JDK 17.0.6)
const ENGINE = 'Judge0 · JDK 17'
const COMPILATION_ERROR = 6

interface Judge0Body {
  stdout: string | null
  stderr: string | null
  compile_output: string | null
  exit_code: number | null
  time: string | null
  status?: { id: number; description: string }
}

export function normalizeJudge0(body: unknown): RunResult {
  const b = body as Judge0Body
  if (!b || typeof b !== 'object' || !b.status) {
    throw new ProviderError('judge0', 'unexpected response shape')
  }

  const compiled = b.status.id !== COMPILATION_ERROR
  return {
    phase: compiled ? 'run' : 'compile',
    stdout: compiled ? (b.stdout ?? '') : '',
    stderr: compiled ? (b.stderr ?? '') : (b.compile_output ?? ''),
    exitCode: b.exit_code ?? null,
    timeMs: b.time != null ? Math.round(parseFloat(b.time) * 1000) : null,
    engine: ENGINE,
  }
}

export const judge0: Provider = {
  id: 'judge0',
  label: ENGINE,
  async run(source, stdin, signal) {
    let res: Response
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language_id: LANGUAGE_ID,
          source_code: source,
          stdin,
        }),
        signal,
      })
    } catch (e) {
      throw new ProviderError('judge0', (e as Error).message)
    }

    if (!res.ok) {
      throw new ProviderError('judge0', `HTTP ${res.status}`)
    }

    try {
      return normalizeJudge0(await res.json())
    } catch (e) {
      if (e instanceof ProviderError) throw e
      throw new ProviderError('judge0', 'malformed JSON')
    }
  },
}
