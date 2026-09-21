import { type Provider, type RunResult, ProviderError } from './types'
import { stripTopLevelPublic, remapProgJava } from './wandbox-source'

const ENDPOINT = 'https://wandbox.org/api/compile.json'
const COMPILER = 'openjdk-jdk-22+36'
const ENGINE = 'Wandbox · JDK 22'

interface WandboxBody {
  status?: string
  compiler_error?: string
  program_output?: string
  program_error?: string
}

export function normalizeWandbox(body: unknown, timeMs: number | null): RunResult {
  const b = body as WandboxBody
  if (!b || typeof b !== 'object' || typeof b.status !== 'string') {
    throw new ProviderError('wandbox', 'unexpected response shape')
  }

  const compileError = (b.compiler_error ?? '').trim() !== ''
  const exitCode = Number.parseInt(b.status, 10)

  return {
    phase: compileError ? 'compile' : 'run',
    stdout: compileError ? '' : (b.program_output ?? ''),
    stderr: remapProgJava(
      compileError ? (b.compiler_error ?? '') : (b.program_error ?? ''),
    ),
    exitCode: Number.isNaN(exitCode) ? null : exitCode,
    timeMs,
    engine: ENGINE,
  }
}

export const wandbox: Provider = {
  id: 'wandbox',
  label: ENGINE,
  async run(source, stdin, signal) {
    const started = performance.now()
    let res: Response
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compiler: COMPILER,
          // Wandbox compiles to prog.java, so a top-level `public class`
          // would not compile. See wandbox-source.ts.
          code: stripTopLevelPublic(source),
          stdin,
          codes: [],
          save: false,
        }),
        signal,
      })
    } catch (e) {
      throw new ProviderError('wandbox', (e as Error).message)
    }

    if (!res.ok) throw new ProviderError('wandbox', `HTTP ${res.status}`)

    try {
      return normalizeWandbox(await res.json(), Math.round(performance.now() - started))
    } catch (e) {
      if (e instanceof ProviderError) throw e
      throw new ProviderError('wandbox', 'malformed JSON')
    }
  },
}
