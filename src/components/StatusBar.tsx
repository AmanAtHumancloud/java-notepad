import type { RunResult } from '../run/types'

interface Props {
  line: number
  col: number
  result: RunResult | null
  error: string | null
  running: boolean
}

export function StatusBar({ line, col, result, error, running }: Props) {
  const parts: string[] = [`Ln ${line}, Col ${col}`]

  if (running) {
    parts.push('running…')
  } else if (error) {
    parts.push(error)
  } else if (result) {
    parts.push(result.phase === 'compile' ? 'compile error' : `exit ${result.exitCode}`)
    if (result.timeMs != null) parts.push(`${result.timeMs}ms`)
    parts.push(result.engine)
  }

  return (
    <div
      data-testid="status-bar"
      className="flex items-center gap-2 border-t px-2 py-1 text-xs"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-panel)', color: 'var(--fg-muted)' }}
    >
      {parts.map((p, i) => (
        <span key={i}>{i > 0 && <span className="mr-2">·</span>}{p}</span>
      ))}
    </div>
  )
}
