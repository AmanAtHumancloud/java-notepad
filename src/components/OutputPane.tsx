import type { RunResult } from '../run/types'

interface Props {
  result: RunResult | null
  error: string | null
  stdin: string
  onStdinChange: (v: string) => void
  activeTab: 'output' | 'input'
  onTabChange: (t: 'output' | 'input') => void
}

export function OutputPane({
  result, error, stdin, onStdinChange, activeTab, onTabChange,
}: Props) {
  const tab = (id: 'output' | 'input', label: string) => (
    <button
      role="tab"
      aria-selected={activeTab === id}
      onClick={() => onTabChange(id)}
      className="border-r px-3 py-1 text-xs"
      style={{
        borderColor: 'var(--border)',
        background: activeTab === id ? 'var(--bg)' : 'var(--bg-panel)',
        color: activeTab === id ? 'var(--fg)' : 'var(--fg-muted)',
      }}
    >
      {label}
    </button>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex border-b" style={{ borderColor: 'var(--border)' }} role="tablist">
        {tab('output', 'Output')}
        {tab('input', 'Input')}
      </div>

      {activeTab === 'output' ? (
        <div className="min-h-0 flex-1 overflow-auto p-2 text-xs whitespace-pre-wrap">
          {error && <div style={{ color: 'var(--error)' }}>{error}</div>}
          <div data-testid="stdout">{result?.stdout}</div>
          <div data-testid="stderr" style={{ color: 'var(--error)' }}>{result?.stderr}</div>
        </div>
      ) : (
        <textarea
          aria-label="Standard input"
          value={stdin}
          onChange={e => onStdinChange(e.target.value)}
          placeholder="Text here is piped to System.in"
          spellCheck={false}
          className="min-h-0 flex-1 resize-none p-2 text-xs outline-none"
          style={{ background: 'var(--bg)', color: 'var(--fg)', fontFamily: 'inherit' }}
        />
      )}
    </div>
  )
}
