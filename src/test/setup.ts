import '@testing-library/jest-dom/vitest'

// jsdom lags the platform on these two. The failover logic depends on both,
// so provide minimal stand-ins when the environment lacks them.
if (typeof AbortSignal.timeout !== 'function') {
  AbortSignal.timeout = (ms: number) => {
    const c = new AbortController()
    setTimeout(() => c.abort(new DOMException('TimeoutError', 'TimeoutError')), ms)
    return c.signal
  }
}

if (typeof AbortSignal.any !== 'function') {
  AbortSignal.any = (signals: AbortSignal[]) => {
    const c = new AbortController()
    for (const s of signals) {
      if (s.aborted) { c.abort(s.reason); break }
      s.addEventListener('abort', () => c.abort(s.reason), { once: true })
    }
    return c.signal
  }
}

// jsdom does not implement matchMedia at all. useTheme reads it for the
// initial prefers-color-scheme value, so every component test needs it.
// Tests that care about the preference stub it themselves.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}
