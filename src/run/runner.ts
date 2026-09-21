import { type Provider, type RunResult, ProviderError } from './types'
import { judge0 } from './judge0'
import { wandbox } from './wandbox'

export const DEFAULT_PROVIDERS: Provider[] = [judge0, wandbox]

/** Client-side wait limit, distinct from each provider's own CPU limit. */
export const DEFAULT_TIMEOUT_MS = 20_000

export class AllProvidersFailedError extends Error {
  constructor(failures: { id: string; reason: string }[]) {
    super(
      'Could not run your code. ' +
        failures.map(f => `${f.id}: ${f.reason}`).join('; '),
    )
    this.name = 'AllProvidersFailedError'
  }
}

/**
 * Try each provider in order. Only *transport* failures fail over — a
 * compile error or a non-zero exit is a successful call whose answer is
 * "your program is wrong", and must be shown, not retried elsewhere.
 */
export async function runJava(
  source: string,
  stdin: string,
  providers: Provider[] = DEFAULT_PROVIDERS,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  externalSignal?: AbortSignal,
): Promise<RunResult> {
  const failures: { id: string; reason: string }[] = []

  for (const provider of providers) {
    if (externalSignal?.aborted) break

    const timeout = AbortSignal.timeout(timeoutMs)
    const signal = externalSignal
      ? AbortSignal.any([externalSignal, timeout])
      : timeout

    try {
      return await provider.run(source, stdin, signal)
    } catch (e) {
      // A user-initiated stop is not a provider failure — do not fail over.
      if (externalSignal?.aborted) throw e
      failures.push({ id: provider.id, reason: (e as ProviderError).message })
    }
  }

  if (externalSignal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }
  throw new AllProvidersFailedError(failures)
}
