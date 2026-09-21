export type Phase = 'compile' | 'run'

export interface RunResult {
  /** Where execution ended. 'compile' means the program never ran. */
  phase: Phase
  stdout: string
  stderr: string
  exitCode: number | null
  timeMs: number | null
  /** Human label of the engine that produced this, e.g. "Judge0 · JDK 17". */
  engine: string
}

export interface Provider {
  id: string
  label: string
  run(source: string, stdin: string, signal: AbortSignal): Promise<RunResult>
}

/** Thrown for transport failures only — these are what trigger failover. */
export class ProviderError extends Error {
  constructor(public providerId: string, message: string) {
    super(message)
    this.name = 'ProviderError'
  }
}
