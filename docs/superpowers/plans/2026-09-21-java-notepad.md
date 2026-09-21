# Java Notepad Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static, backend-free web app where you write one Java file, press Run, and see stdout/stderr/exit code — executed by free public APIs with automatic failover.

**Architecture:** A React SPA built by Vite. All execution is delegated behind a `Provider` interface; `runJava()` tries Judge0 CE first and falls back to Wandbox on transport failure. Provider-specific response shapes are normalized into one `RunResult` by isolated, fixture-tested pure functions. UI is three hooks and five components — no state library, no router.

**Tech Stack:** Vite 6 · React 19 · TypeScript 5 · Tailwind 4 (`@tailwindcss/vite`) · CodeMirror 6 via `@uiw/react-codemirror` · Vitest + Testing Library + jsdom

**Spec:** `docs/superpowers/specs/2026-09-21-java-notepad-design.md`

## Global Constraints

- **No backend, no API keys, no environment variables.** Anything needed at build time would be public anyway.
- **Judge0 CE endpoint:** `POST https://ce.judge0.com/submissions?wait=true&base64_encoded=false&fields=stdout,stderr,compile_output,message,time,exit_code,status`, `language_id: 91` (JDK 17.0.6).
- **Wandbox endpoint:** `POST https://wandbox.org/api/compile.json`, `compiler: "openjdk-jdk-22+36"`.
- **Provider order is `[judge0, wandbox]`.** A compile error or non-zero exit is a *successful* call and must NOT fail over. Only transport failures (network error, non-2xx, malformed body, abort-by-timeout) fail over.
- **Client wait limit is 20 seconds** via `AbortController`, distinct from the providers' own server-side CPU limits (~5-10s).
- **The user's class is always `Main`.** Judge0 supports `public class Main` natively; Wandbox does not and requires source rewriting (Task 2).
- **Commits:** this project follows the user's standing preference — **do not commit unless asked.** Each task ends when its tests are green. Where the plan says "verify green", that is the task boundary.
- Bundle budget: **under 400KB gzipped**.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `.gitignore`
- Create: `src/main.tsx`, `src/App.tsx`, `src/styles/index.css`
- Test: `src/App.test.tsx`, `src/test/setup.ts`

**Interfaces:**
- Consumes: nothing
- Produces: a working `npm run dev`, `npm run build`, `npm test`

- [ ] **Step 1: Scaffold and install**

```bash
cd ~/Desktop/java-notepad
npm create vite@latest . -- --template react-ts
npm install
npm install @uiw/react-codemirror @codemirror/lang-java @codemirror/view @codemirror/state
npm install -D tailwindcss @tailwindcss/vite vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 2: Configure Vite for Tailwind 4 and Vitest**

`vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
})
```

Add to `vite.config.ts` top so `test` typechecks: `/// <reference types="vitest" />`

`src/test/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest'

// jsdom lags the platform on these two. Task 6's failover logic depends on
// both, so provide minimal stand-ins when the environment lacks them.
// Verify with: node -e "console.log(typeof AbortSignal.any)"
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
```

Note: `AbortSignal.any` requires Node 20+ in the browser build too. Both are
present in every browser Cloudflare Pages serves; this shim is test-only.

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest",
"typecheck": "tsc --noEmit"
```

- [ ] **Step 3: Replace the generated CSS and App**

`src/styles/index.css`:
```css
@import "tailwindcss";
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>
)
```

`src/App.tsx`:
```tsx
export default function App() {
  return <div>Java Notepad</div>
}
```

Delete `src/App.css`, `src/index.css`, `src/assets/react.svg`.

- [ ] **Step 4: Write the smoke test**

`src/App.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import App from './App'

test('renders the app', () => {
  render(<App />)
  expect(screen.getByText('Java Notepad')).toBeInTheDocument()
})
```

- [ ] **Step 5: Verify green**

Run: `npm test && npm run typecheck && npm run build`
Expected: 1 test passes, no type errors, build emits `dist/`.

---

### Task 2: Wandbox source rewriting

Pure functions, no network. Wandbox compiles to `prog.java`, so a top-level `public class Main` is a hard compile error, and stack traces leak `prog.java`.

**Files:**
- Create: `src/run/wandbox-source.ts`
- Test: `src/run/wandbox-source.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `stripTopLevelPublic(source: string): string`, `remapProgJava(text: string): string`

- [ ] **Step 1: Write the failing tests**

`src/run/wandbox-source.test.ts`:
```ts
import { stripTopLevelPublic, remapProgJava } from './wandbox-source'

describe('stripTopLevelPublic', () => {
  test('strips public from a top-level class', () => {
    expect(stripTopLevelPublic('public class Main {}')).toBe('class Main {}')
  })

  test('leaves an indented nested class alone', () => {
    const src = 'class Main {\n    public class Inner {}\n}'
    expect(stripTopLevelPublic(src)).toBe(src)
  })

  test('leaves public methods alone', () => {
    const src = 'class Main {\n    public static void main(String[] a) {}\n}'
    expect(stripTopLevelPublic(src)).toBe(src)
  })

  test('handles final, abstract and sealed modifiers', () => {
    expect(stripTopLevelPublic('public final class Main {}')).toBe('final class Main {}')
    expect(stripTopLevelPublic('public abstract class A {}')).toBe('abstract class A {}')
  })

  test('handles interface, enum and record', () => {
    expect(stripTopLevelPublic('public interface I {}')).toBe('interface I {}')
    expect(stripTopLevelPublic('public enum E {}')).toBe('enum E {}')
    expect(stripTopLevelPublic('public record R(int x) {}')).toBe('record R(int x) {}')
  })

  test('preserves the line count so error line numbers stay correct', () => {
    const src = 'import java.util.*;\npublic class Main {\n}\n'
    expect(stripTopLevelPublic(src).split('\n').length).toBe(src.split('\n').length)
  })

  test('strips every top-level public declaration, not just the first', () => {
    expect(stripTopLevelPublic('public class A {}\npublic class B {}'))
      .toBe('class A {}\nclass B {}')
  })
})

describe('remapProgJava', () => {
  test('rewrites the filename in a stack trace', () => {
    expect(remapProgJava('\tat Main.main(prog.java:1)'))
      .toBe('\tat Main.main(Main.java:1)')
  })

  test('rewrites the filename in a compiler message', () => {
    expect(remapProgJava('prog.java:2: error: cannot find symbol'))
      .toBe('Main.java:2: error: cannot find symbol')
  })

  test('rewrites every occurrence', () => {
    expect(remapProgJava('prog.java:1\nprog.java:2')).toBe('Main.java:1\nMain.java:2')
  })

  test('leaves unrelated text untouched', () => {
    expect(remapProgJava('all good')).toBe('all good')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/run/wandbox-source.test.ts`
Expected: FAIL — cannot resolve `./wandbox-source`.

- [ ] **Step 3: Implement**

`src/run/wandbox-source.ts`:
```ts
/**
 * Wandbox writes the submitted source to `prog.java`, so javac rejects a
 * top-level `public class Main`. Strip the modifier from column-0
 * declarations only — nested/indented ones are unaffected by the filename
 * rule and must be left alone. The edit is within a line, so line numbers
 * in compiler output remain correct.
 */
const TOP_LEVEL_PUBLIC =
  /^public\s+((?:(?:final|abstract|sealed|non-sealed|strictfp)\s+)*(?:class|interface|enum|record)\b)/gm

export function stripTopLevelPublic(source: string): string {
  return source.replace(TOP_LEVEL_PUBLIC, '$1')
}

/** Hide Wandbox's internal filename from compiler output and stack traces. */
export function remapProgJava(text: string): string {
  return text.replaceAll('prog.java', 'Main.java')
}
```

- [ ] **Step 4: Verify green**

Run: `npx vitest run src/run/wandbox-source.test.ts`
Expected: all 11 tests PASS.

---

### Task 3: Provider types and fixtures

No logic — the shared contract plus the real captured API responses that Tasks 4 and 5 assert against.

**Files:**
- Create: `src/run/types.ts`
- Create: `src/run/__fixtures__/judge0.ts`, `src/run/__fixtures__/wandbox.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `RunResult`, `Provider`, `Phase`, `ProviderError`, and the fixture constants named below.

- [ ] **Step 1: Define the contract**

`src/run/types.ts`:
```ts
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
```

- [ ] **Step 2: Record the fixtures**

These are real bodies captured on 2026-09-21. Do not invent additional ones.

`src/run/__fixtures__/judge0.ts`:
```ts
export const JUDGE0_SUCCESS = {
  stdout: 'Hi Aman\n', time: '0.111', stderr: null, compile_output: null,
  exit_code: 0, message: null, status: { id: 3, description: 'Accepted' },
}

export const JUDGE0_COMPILE_ERROR = {
  stdout: null, time: null, stderr: null,
  compile_output:
    'Main.java:1: error: incompatible types: String cannot be converted to int\n' +
    'public class Main{public static void main(String[] a){int x="oops";}}\n' +
    '                                                            ^\n1 error\n',
  exit_code: null, message: null,
  status: { id: 6, description: 'Compilation Error' },
}

export const JUDGE0_RUNTIME_ERROR = {
  stdout: null, time: '0.032',
  stderr:
    'Exception in thread "main" java.lang.ArrayIndexOutOfBoundsException: ' +
    'Index 5 out of bounds for length 1\n\tat Main.main(Main.java:1)\n',
  compile_output: null, exit_code: 1, message: 'Exited with error status 1',
  status: { id: 11, description: 'Runtime Error (NZEC)' },
}
```

`src/run/__fixtures__/wandbox.ts`:
```ts
export const WANDBOX_SUCCESS = {
  status: '0', signal: '', compiler_error: '',
  program_output: 'Hi Aman\n', program_error: 'on stderr\n',
  permlink: '', url: '',
}

export const WANDBOX_COMPILE_ERROR = {
  status: '1', signal: '',
  compiler_error:
    'prog.java:1: error: incompatible types: String cannot be converted to int\n1 error\n',
  program_output: '', program_error: '', permlink: '', url: '',
}

export const WANDBOX_RUNTIME_ERROR = {
  status: '1', signal: '', compiler_error: '', program_output: '',
  program_error:
    'Exception in thread "main" java.lang.ArrayIndexOutOfBoundsException: ' +
    'Index 5 out of bounds for length 1\n\tat Main.main(prog.java:1)\n',
  permlink: '', url: '',
}
```

- [ ] **Step 3: Verify green**

Run: `npm run typecheck`
Expected: no errors.

---

### Task 4: Judge0 provider

**Files:**
- Create: `src/run/judge0.ts`
- Test: `src/run/judge0.test.ts`

**Interfaces:**
- Consumes: `RunResult`, `Provider`, `ProviderError` (Task 3); the `JUDGE0_*` fixtures (Task 3)
- Produces: `normalizeJudge0(body: unknown): RunResult` and `judge0: Provider`

- [ ] **Step 1: Write the failing tests**

`src/run/judge0.test.ts`:
```ts
import { normalizeJudge0, judge0 } from './judge0'
import { ProviderError } from './types'
import {
  JUDGE0_SUCCESS, JUDGE0_COMPILE_ERROR, JUDGE0_RUNTIME_ERROR,
} from './__fixtures__/judge0'

describe('normalizeJudge0', () => {
  test('maps a successful run', () => {
    const r = normalizeJudge0(JUDGE0_SUCCESS)
    expect(r.phase).toBe('run')
    expect(r.stdout).toBe('Hi Aman\n')
    expect(r.stderr).toBe('')
    expect(r.exitCode).toBe(0)
    expect(r.timeMs).toBe(111)
    expect(r.engine).toBe('Judge0 · JDK 17')
  })

  test('maps a compile error into stderr and phase=compile', () => {
    const r = normalizeJudge0(JUDGE0_COMPILE_ERROR)
    expect(r.phase).toBe('compile')
    expect(r.stderr).toContain('incompatible types')
    expect(r.stdout).toBe('')
    expect(r.timeMs).toBeNull()
  })

  test('maps a runtime exception', () => {
    const r = normalizeJudge0(JUDGE0_RUNTIME_ERROR)
    expect(r.phase).toBe('run')
    expect(r.stderr).toContain('ArrayIndexOutOfBoundsException')
    expect(r.exitCode).toBe(1)
    expect(r.timeMs).toBe(32)
  })

  test('nulls become empty strings, never the literal "null"', () => {
    const r = normalizeJudge0(JUDGE0_COMPILE_ERROR)
    expect(r.stdout).not.toContain('null')
  })

  test('rejects a body with no status', () => {
    expect(() => normalizeJudge0({ stdout: 'x' })).toThrow(ProviderError)
  })
})

describe('judge0.run', () => {
  afterEach(() => vi.unstubAllGlobals())

  test('posts source and stdin, and returns the normalized result', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(JUDGE0_SUCCESS), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const r = await judge0.run('class Main {}', 'Aman', new AbortController().signal)

    expect(r.stdout).toBe('Hi Aman\n')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('ce.judge0.com/submissions')
    expect(url).toContain('wait=true')
    const body = JSON.parse(init.body)
    expect(body.language_id).toBe(91)
    expect(body.source_code).toBe('class Main {}')
    expect(body.stdin).toBe('Aman')
  })

  test('throws ProviderError on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('rate limited', { status: 429 }),
    ))
    await expect(
      judge0.run('class Main {}', '', new AbortController().signal),
    ).rejects.toThrow(ProviderError)
  })

  test('throws ProviderError on a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed to fetch')))
    await expect(
      judge0.run('class Main {}', '', new AbortController().signal),
    ).rejects.toThrow(ProviderError)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/run/judge0.test.ts`
Expected: FAIL — cannot resolve `./judge0`.

- [ ] **Step 3: Implement**

`src/run/judge0.ts`:
```ts
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
```

- [ ] **Step 4: Verify green**

Run: `npx vitest run src/run/judge0.test.ts`
Expected: all 8 tests PASS.

---

### Task 5: Wandbox provider

**Files:**
- Create: `src/run/wandbox.ts`
- Test: `src/run/wandbox.test.ts`

**Interfaces:**
- Consumes: `stripTopLevelPublic`, `remapProgJava` (Task 2); `RunResult`, `Provider`, `ProviderError` (Task 3); the `WANDBOX_*` fixtures (Task 3)
- Produces: `normalizeWandbox(body: unknown, timeMs: number | null): RunResult` and `wandbox: Provider`

Note Wandbox returns no timing, so `run` measures wall-clock client-side and passes it in.

- [ ] **Step 1: Write the failing tests**

`src/run/wandbox.test.ts`:
```ts
import { normalizeWandbox, wandbox } from './wandbox'
import { ProviderError } from './types'
import {
  WANDBOX_SUCCESS, WANDBOX_COMPILE_ERROR, WANDBOX_RUNTIME_ERROR,
} from './__fixtures__/wandbox'

describe('normalizeWandbox', () => {
  test('maps a successful run', () => {
    const r = normalizeWandbox(WANDBOX_SUCCESS, 250)
    expect(r.phase).toBe('run')
    expect(r.stdout).toBe('Hi Aman\n')
    expect(r.stderr).toBe('on stderr\n')
    expect(r.exitCode).toBe(0)
    expect(r.timeMs).toBe(250)
    expect(r.engine).toBe('Wandbox · JDK 22')
  })

  test('maps a compile error and hides prog.java', () => {
    const r = normalizeWandbox(WANDBOX_COMPILE_ERROR, 300)
    expect(r.phase).toBe('compile')
    expect(r.stderr).toContain('Main.java:1')
    expect(r.stderr).not.toContain('prog.java')
    expect(r.stdout).toBe('')
  })

  test('hides prog.java in a runtime stack trace too', () => {
    const r = normalizeWandbox(WANDBOX_RUNTIME_ERROR, 300)
    expect(r.phase).toBe('run')
    expect(r.stderr).toContain('Main.java:1')
    expect(r.stderr).not.toContain('prog.java')
    expect(r.exitCode).toBe(1)
  })

  test('rejects a body with no status', () => {
    expect(() => normalizeWandbox({}, null)).toThrow(ProviderError)
  })
})

describe('wandbox.run', () => {
  afterEach(() => vi.unstubAllGlobals())

  test('strips the top-level public modifier before sending', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(WANDBOX_SUCCESS), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await wandbox.run('public class Main {}', 'Aman', new AbortController().signal)

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.code).toBe('class Main {}')
    expect(body.stdin).toBe('Aman')
    expect(body.compiler).toBe('openjdk-jdk-22+36')
  })

  test('throws ProviderError on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })))
    await expect(
      wandbox.run('class Main {}', '', new AbortController().signal),
    ).rejects.toThrow(ProviderError)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/run/wandbox.test.ts`
Expected: FAIL — cannot resolve `./wandbox`.

- [ ] **Step 3: Implement**

`src/run/wandbox.ts`:
```ts
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
```

- [ ] **Step 4: Verify green**

Run: `npx vitest run src/run/wandbox.test.ts`
Expected: all 6 tests PASS.

---

### Task 6: Failover orchestrator

The heart of the design. Piston's shutdown is why this exists.

**Files:**
- Create: `src/run/runner.ts`
- Test: `src/run/runner.test.ts`

**Interfaces:**
- Consumes: `Provider`, `RunResult`, `ProviderError` (Task 3); `judge0` (Task 4); `wandbox` (Task 5)
- Produces: `runJava(source, stdin, providers?, timeoutMs?): Promise<RunResult>`, `AllProvidersFailedError`, `DEFAULT_PROVIDERS`

- [ ] **Step 1: Write the failing tests**

`src/run/runner.test.ts`:
```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/run/runner.test.ts`
Expected: FAIL — cannot resolve `./runner`.

- [ ] **Step 3: Implement**

`src/run/runner.ts`:
```ts
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
```

- [ ] **Step 4: Verify green**

Run: `npx vitest run src/run/runner.test.ts`
Expected: all 8 tests PASS.

---

### Task 7: Theme tokens and useTheme

One token set drives both the chrome and the editor so they cannot drift.

**Files:**
- Modify: `src/styles/index.css`
- Create: `src/hooks/useTheme.ts`
- Test: `src/hooks/useTheme.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `useTheme(): { theme: 'light' | 'dark'; toggle: () => void }`; CSS variables listed below

- [ ] **Step 1: Define the tokens**

Append to `src/styles/index.css`:
```css
:root {
  --bg:        #ffffff;
  --bg-panel:  #f4f4f4;
  --fg:        #1a1a1a;
  --fg-muted:  #6b6b6b;
  --border:    #d4d4d4;
  --accent:    #1a5fb4;
  --error:     #c01c28;
  --selection: #cfe3ff;
}

[data-theme='dark'] {
  --bg:        #1c1c1c;
  --bg-panel:  #252525;
  --fg:        #e4e4e4;
  --fg-muted:  #9a9a9a;
  --border:    #3a3a3a;
  --accent:    #78aeed;
  --error:     #ff7b72;
  --selection: #2d4f76;
}

html, body, #root { height: 100%; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font-family: ui-monospace, "Cascadia Mono", "SF Mono", Menlo, Consolas, monospace;
  font-size: 13px;
}
```

- [ ] **Step 2: Write the failing test**

`src/hooks/useTheme.test.ts`:
```ts
import { renderHook, act } from '@testing-library/react'
import { useTheme } from './useTheme'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
    matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }))
})

test('defaults to light when the system does not prefer dark', () => {
  const { result } = renderHook(() => useTheme())
  expect(result.current.theme).toBe('light')
})

test('defaults to dark when the system prefers dark', () => {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
    matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }))
  const { result } = renderHook(() => useTheme())
  expect(result.current.theme).toBe('dark')
})

test('toggle flips the theme and sets the document attribute', () => {
  const { result } = renderHook(() => useTheme())
  act(() => result.current.toggle())
  expect(result.current.theme).toBe('dark')
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
})

test('an explicit choice persists and wins over the system preference', () => {
  localStorage.setItem('java-notepad:theme', 'dark')
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
    matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }))
  const { result } = renderHook(() => useTheme())
  expect(result.current.theme).toBe('dark')
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/hooks/useTheme.test.ts`
Expected: FAIL — cannot resolve `./useTheme`.

- [ ] **Step 4: Implement**

`src/hooks/useTheme.ts`:
```ts
import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const KEY = 'java-notepad:theme'

function initialTheme(): Theme {
  const stored = localStorage.getItem(KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(KEY, theme)
  }, [theme])

  const toggle = useCallback(() => {
    setTheme(t => (t === 'light' ? 'dark' : 'light'))
  }, [])

  return { theme, toggle }
}
```

- [ ] **Step 5: Verify green**

Run: `npx vitest run src/hooks/useTheme.test.ts`
Expected: all 4 tests PASS.

---

### Task 8: useEditorState with autosave

**Files:**
- Create: `src/hooks/useEditorState.ts`
- Create: `src/examples/examples.ts`
- Test: `src/hooks/useEditorState.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `useEditorState(): { source, setSource, stdin, setStdin, isDirty, reset }`; `EXAMPLES: Example[]` with `interface Example { name: string; source: string; stdin: string }`; `DEFAULT_SOURCE: string`

- [ ] **Step 1: Write the examples**

`src/examples/examples.ts`:
```ts
export interface Example {
  name: string
  source: string
  stdin: string
}

export const DEFAULT_SOURCE = `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, world!");
    }
}
`

export const EXAMPLES: Example[] = [
  { name: 'Hello World', stdin: '', source: DEFAULT_SOURCE },
  {
    name: 'Reading input',
    stdin: 'Aman\n27\n',
    source: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        String name = in.nextLine();
        int age = in.nextInt();
        System.out.println(name + " will be " + (age + 1) + " next year.");
    }
}
`,
  },
  {
    name: 'Arrays and loops',
    stdin: '',
    source: `public class Main {
    public static void main(String[] args) {
        int[] numbers = { 5, 3, 9, 1, 7 };
        int sum = 0;
        for (int n : numbers) {
            sum += n;
        }
        System.out.println("sum = " + sum);
        System.out.println("avg = " + (double) sum / numbers.length);
    }
}
`,
  },
  {
    name: 'Collections',
    stdin: '',
    source: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Map<String, Integer> stock = new LinkedHashMap<>();
        stock.put("apples", 4);
        stock.put("pears", 0);
        stock.put("plums", 12);

        for (Map.Entry<String, Integer> e : stock.entrySet()) {
            System.out.printf("%-8s %d%n", e.getKey(), e.getValue());
        }
    }
}
`,
  },
  {
    name: 'Streams',
    stdin: '',
    source: `import java.util.List;
import java.util.stream.Collectors;

public class Main {
    public static void main(String[] args) {
        List<String> words = List.of("delta", "alpha", "charlie", "bravo");

        String result = words.stream()
                .filter(w -> w.length() > 4)
                .map(String::toUpperCase)
                .sorted()
                .collect(Collectors.joining(", "));

        System.out.println(result);
    }
}
`,
  },
  {
    name: 'A compile error',
    stdin: '',
    source: `public class Main {
    public static void main(String[] args) {
        // This will not compile — that is the point.
        int count = "not a number";
        System.out.println(count);
    }
}
`,
  },
]
```

- [ ] **Step 2: Write the failing test**

`src/hooks/useEditorState.test.ts`:
```ts
import { renderHook, act } from '@testing-library/react'
import { useEditorState } from './useEditorState'
import { DEFAULT_SOURCE } from '../examples/examples'

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

test('starts from the default source when nothing is stored', () => {
  const { result } = renderHook(() => useEditorState())
  expect(result.current.source).toBe(DEFAULT_SOURCE)
  expect(result.current.isDirty).toBe(false)
})

test('restores a stored source', () => {
  localStorage.setItem('java-notepad:source', 'class Restored {}')
  const { result } = renderHook(() => useEditorState())
  expect(result.current.source).toBe('class Restored {}')
})

test('autosaves after the debounce window, not before', () => {
  const { result } = renderHook(() => useEditorState())
  act(() => result.current.setSource('class Edited {}'))

  expect(localStorage.getItem('java-notepad:source')).not.toBe('class Edited {}')
  act(() => { vi.advanceTimersByTime(500) })
  expect(localStorage.getItem('java-notepad:source')).toBe('class Edited {}')
})

test('editing marks the buffer dirty', () => {
  const { result } = renderHook(() => useEditorState())
  act(() => result.current.setSource('class Edited {}'))
  expect(result.current.isDirty).toBe(true)
})

test('reset replaces source and stdin and clears dirty', () => {
  const { result } = renderHook(() => useEditorState())
  act(() => result.current.setSource('class Edited {}'))
  act(() => result.current.reset('class Fresh {}', 'input'))
  expect(result.current.source).toBe('class Fresh {}')
  expect(result.current.stdin).toBe('input')
  expect(result.current.isDirty).toBe(false)
})

test('stdin persists separately', () => {
  const { result } = renderHook(() => useEditorState())
  act(() => result.current.setStdin('Aman'))
  act(() => { vi.advanceTimersByTime(500) })
  expect(localStorage.getItem('java-notepad:stdin')).toBe('Aman')
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/hooks/useEditorState.test.ts`
Expected: FAIL — cannot resolve `./useEditorState`.

- [ ] **Step 4: Implement**

`src/hooks/useEditorState.ts`:
```ts
import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_SOURCE } from '../examples/examples'

const SOURCE_KEY = 'java-notepad:source'
const STDIN_KEY = 'java-notepad:stdin'
const DEBOUNCE_MS = 500

export function useEditorState() {
  const [source, setSource] = useState(
    () => localStorage.getItem(SOURCE_KEY) ?? DEFAULT_SOURCE,
  )
  const [stdin, setStdin] = useState(() => localStorage.getItem(STDIN_KEY) ?? '')
  const [isDirty, setDirty] = useState(false)
  const skipDirty = useRef(true)

  useEffect(() => {
    if (skipDirty.current) {
      skipDirty.current = false
      return
    }
    setDirty(true)
  }, [source])

  useEffect(() => {
    const id = setTimeout(() => {
      localStorage.setItem(SOURCE_KEY, source)
      localStorage.setItem(STDIN_KEY, stdin)
    }, DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [source, stdin])

  const reset = useCallback((nextSource: string, nextStdin: string) => {
    skipDirty.current = true
    setSource(nextSource)
    setStdin(nextStdin)
    setDirty(false)
  }, [])

  return { source, setSource, stdin, setStdin, isDirty, reset }
}
```

- [ ] **Step 5: Verify green**

Run: `npx vitest run src/hooks/useEditorState.test.ts`
Expected: all 6 tests PASS.

---

### Task 9: useRunner

**Files:**
- Create: `src/hooks/useRunner.ts`
- Test: `src/hooks/useRunner.test.ts`

**Interfaces:**
- Consumes: `runJava`, `AllProvidersFailedError` (Task 6); `RunResult` (Task 3)
- Produces: `useRunner(): { status: 'idle'|'running'|'done', result: RunResult | null, error: string | null, run(source, stdin): Promise<void>, stop(): void }`

- [ ] **Step 1: Write the failing test**

`src/hooks/useRunner.test.ts`:
```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/hooks/useRunner.test.ts`
Expected: FAIL — cannot resolve `./useRunner`.

- [ ] **Step 3: Implement**

`src/hooks/useRunner.ts`:
```ts
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
```

- [ ] **Step 4: Verify green**

Run: `npx vitest run src/hooks/useRunner.test.ts`
Expected: all 4 tests PASS.

---

### Task 10: The notepad shell

All five presentational components plus the App wiring. They are one task because none is independently reviewable — a menu bar with nothing to drive is not a deliverable.

**Files:**
- Create: `src/components/MenuBar.tsx`, `src/components/Editor.tsx`, `src/components/OutputPane.tsx`, `src/components/StatusBar.tsx`, `src/components/Resizer.tsx`
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx` (replace the Task 1 smoke test)

**Interfaces:**
- Consumes: `useTheme` (Task 7), `useEditorState` (Task 8), `useRunner` (Task 9), `EXAMPLES` (Task 8), `RunResult` (Task 3)
- Produces: the finished UI. No exports other tasks depend on.

- [ ] **Step 1: Write the failing tests**

`src/App.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import * as runner from './run/runner'
import type { RunResult } from './run/types'

const okResult: RunResult = {
  phase: 'run', stdout: 'Hello, world!\n', stderr: '', exitCode: 0,
  timeMs: 111, engine: 'Judge0 · JDK 17',
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

test('renders the editor with the default program', () => {
  render(<App />)
  expect(screen.getByText(/Hello, world!/)).toBeInTheDocument()
})

test('Run shows stdout, exit code, timing and the engine', async () => {
  vi.spyOn(runner, 'runJava').mockResolvedValue(okResult)
  render(<App />)

  await userEvent.click(screen.getByRole('button', { name: /^run$/i }))

  await waitFor(() => {
    expect(screen.getByTestId('stdout')).toHaveTextContent('Hello, world!')
  })
  expect(screen.getByTestId('status-bar')).toHaveTextContent('exit 0')
  expect(screen.getByTestId('status-bar')).toHaveTextContent('111ms')
  expect(screen.getByTestId('status-bar')).toHaveTextContent('Judge0 · JDK 17')
})

test('compile errors render in the error stream', async () => {
  vi.spyOn(runner, 'runJava').mockResolvedValue({
    phase: 'compile', stdout: '', stderr: 'Main.java:1: error: bad',
    exitCode: 1, timeMs: null, engine: 'Judge0 · JDK 17',
  })
  render(<App />)

  await userEvent.click(screen.getByRole('button', { name: /^run$/i }))

  await waitFor(() => {
    expect(screen.getByTestId('stderr')).toHaveTextContent('Main.java:1: error: bad')
  })
})

test('the Input tab holds stdin and is sent to the runner', async () => {
  const spy = vi.spyOn(runner, 'runJava').mockResolvedValue(okResult)
  render(<App />)

  await userEvent.click(screen.getByRole('tab', { name: /input/i }))
  await userEvent.type(screen.getByLabelText(/standard input/i), 'Aman')
  await userEvent.click(screen.getByRole('button', { name: /^run$/i }))

  await waitFor(() => {
    expect(spy).toHaveBeenCalledWith(
      expect.any(String), 'Aman', expect.anything(), expect.anything(), expect.anything(),
    )
  })
})

test('the theme toggle flips the document attribute', async () => {
  render(<App />)
  const before = document.documentElement.getAttribute('data-theme')
  await userEvent.click(screen.getByRole('button', { name: /theme/i }))
  expect(document.documentElement.getAttribute('data-theme')).not.toBe(before)
})

test('loading an example over a clean buffer replaces the source', async () => {
  render(<App />)
  await userEvent.click(screen.getByRole('button', { name: /examples/i }))
  await userEvent.click(screen.getByRole('menuitem', { name: /reading input/i }))
  await waitFor(() => {
    expect(screen.getByText(/Scanner/)).toBeInTheDocument()
  })
})

test('the output pane divider is a keyboard-operable separator', async () => {
  render(<App />)
  const sep = screen.getByRole('separator', { name: /resize output pane/i })
  const before = Number(sep.getAttribute('aria-valuenow'))
  sep.focus()
  await userEvent.keyboard('{ArrowUp}')
  expect(Number(sep.getAttribute('aria-valuenow'))).toBeGreaterThan(before)
})

test('the limits are stated permanently, not hidden in a dialog', () => {
  render(<App />)
  expect(screen.getByTestId('limits')).toHaveTextContent(/one file/i)
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL — no Run button, no testids.

- [ ] **Step 3: Implement `StatusBar`**

`src/components/StatusBar.tsx`:
```tsx
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
```

- [ ] **Step 4: Implement `MenuBar`**

`src/components/MenuBar.tsx`:
```tsx
import { useEffect, useRef, useState } from 'react'
import { EXAMPLES, type Example } from '../examples/examples'

interface Props {
  onRun: () => void
  onStop: () => void
  onSave: () => void
  onLoadExample: (e: Example) => void
  onToggleTheme: () => void
  running: boolean
}

export function MenuBar({
  onRun, onStop, onSave, onLoadExample, onToggleTheme, running,
}: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const item = 'px-2 py-1 hover:bg-[var(--bg-panel)] rounded-sm'

  return (
    <div
      className="flex items-center gap-1 border-b px-2 py-1 text-xs"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-panel)' }}
    >
      <button className={item} onClick={onSave}>Save</button>

      <button
        className={item}
        onClick={running ? onStop : onRun}
        aria-label={running ? 'Stop' : 'Run'}
      >
        {running ? 'Stop' : 'Run'}
      </button>

      <div ref={ref} className="relative">
        <button className={item} aria-label="Examples" onClick={() => setOpen(o => !o)}>
          Examples
        </button>
        {open && (
          <div
            role="menu"
            className="absolute left-0 top-full z-10 w-48 border py-1 shadow-lg"
            style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
          >
            {EXAMPLES.map(ex => (
              <button
                key={ex.name}
                role="menuitem"
                className="block w-full px-3 py-1 text-left hover:bg-[var(--bg-panel)]"
                onClick={() => { onLoadExample(ex); setOpen(false) }}
              >
                {ex.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <span
        data-testid="limits"
        className="ml-auto mr-2 hidden sm:inline"
        style={{ color: 'var(--fg-muted)' }}
      >
        one file · no external libraries · runs on a third-party service
      </span>

      <button className={item} aria-label="Toggle theme" onClick={onToggleTheme}>☾</button>
    </div>
  )
}
```

- [ ] **Step 5: Implement `Editor`**

`src/components/Editor.tsx`:
```tsx
import CodeMirror from '@uiw/react-codemirror'
import { java } from '@codemirror/lang-java'
import { EditorView } from '@codemirror/view'
import type { Theme } from '../hooks/useTheme'

interface Props {
  value: string
  onChange: (v: string) => void
  onCursor: (line: number, col: number) => void
  theme: Theme
}

/** Reads the CSS tokens so the editor and the chrome cannot drift apart. */
function cmTheme(theme: Theme) {
  const read = (name: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim()

  return EditorView.theme({
    '&': { backgroundColor: read('--bg'), color: read('--fg'), height: '100%' },
    '.cm-gutters': {
      backgroundColor: read('--bg-panel'),
      color: read('--fg-muted'),
      border: 'none',
    },
    '.cm-activeLine': { backgroundColor: read('--bg-panel') },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
      backgroundColor: read('--selection'),
    },
  }, { dark: theme === 'dark' })
}

export function Editor({ value, onChange, onCursor, theme }: Props) {
  return (
    <CodeMirror
      value={value}
      height="100%"
      theme={cmTheme(theme)}
      extensions={[java(), EditorView.lineWrapping]}
      onChange={onChange}
      onUpdate={v => {
        if (!v.selectionSet && !v.docChanged) return
        const pos = v.state.selection.main.head
        const line = v.state.doc.lineAt(pos)
        onCursor(line.number, pos - line.from + 1)
      }}
      basicSetup={{ tabSize: 4, foldGutter: false }}
    />
  )
}
```

- [ ] **Step 6: Implement `OutputPane`**

`src/components/OutputPane.tsx`:
```tsx
import { useState } from 'react'
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
```

- [ ] **Step 7: Implement `Resizer`**

The spec's divider is draggable. A fixed-height output pane is not the design.

`src/components/Resizer.tsx`:
```tsx
import { useCallback, useEffect, useRef } from 'react'

interface Props {
  /** Current output-pane height in pixels. */
  height: number
  onResize: (height: number) => void
  min?: number
  max?: number
}

export function Resizer({ height, onResize, min = 80, max = 600 }: Props) {
  const dragging = useRef(false)

  const onPointerDown = useCallback(() => { dragging.current = true }, [])

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!dragging.current) return
      e.preventDefault()
      const next = window.innerHeight - e.clientY
      onResize(Math.min(max, Math.max(min, next)))
    }
    const up = () => { dragging.current = false }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [onResize, min, max])

  return (
    <div
      role="separator"
      aria-label="Resize output pane"
      aria-orientation="horizontal"
      aria-valuenow={height}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={e => {
        if (e.key === 'ArrowUp') onResize(Math.min(max, height + 16))
        if (e.key === 'ArrowDown') onResize(Math.max(min, height - 16))
      }}
      className="h-1 cursor-row-resize"
      style={{ background: 'var(--border)' }}
    />
  )
}
```

- [ ] **Step 8: Wire `App`**

`src/App.tsx`:
```tsx
import { useCallback, useEffect, useState } from 'react'
import { MenuBar } from './components/MenuBar'
import { Editor } from './components/Editor'
import { OutputPane } from './components/OutputPane'
import { StatusBar } from './components/StatusBar'
import { Resizer } from './components/Resizer'
import { useTheme } from './hooks/useTheme'
import { useEditorState } from './hooks/useEditorState'
import { useRunner } from './hooks/useRunner'
import type { Example } from './examples/examples'

export default function App() {
  const { theme, toggle } = useTheme()
  const { source, setSource, stdin, setStdin, isDirty, reset } = useEditorState()
  const { status, result, error, run, stop } = useRunner()
  const [cursor, setCursor] = useState({ line: 1, col: 1 })
  const [tab, setTab] = useState<'output' | 'input'>('output')
  const [paneHeight, setPaneHeight] = useState(224)

  const running = status === 'running'

  const doRun = useCallback(() => {
    setTab('output')
    void run(source, stdin)
  }, [run, source, stdin])

  const doSave = useCallback(() => {
    const url = URL.createObjectURL(new Blob([source], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'Main.java'
    a.click()
    URL.revokeObjectURL(url)
  }, [source])

  const loadExample = useCallback((ex: Example) => {
    if (isDirty && !confirm('Discard your current code?')) return
    reset(ex.source, ex.stdin)
  }, [isDirty, reset])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.key === 'Enter') { e.preventDefault(); doRun() }
      // Trap Ctrl+S so the browser's save dialog never appears.
      if (e.key === 's') { e.preventDefault(); doSave() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doRun, doSave])

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--bg)' }}>
      <MenuBar
        onRun={doRun}
        onStop={stop}
        onSave={doSave}
        onLoadExample={loadExample}
        onToggleTheme={toggle}
        running={running}
      />

      <div className="min-h-0 flex-1 overflow-hidden">
        <Editor
          value={source}
          onChange={setSource}
          onCursor={(line, col) => setCursor({ line, col })}
          theme={theme}
        />
      </div>

      <Resizer height={paneHeight} onResize={setPaneHeight} />

      <div
        className="flex min-h-0 flex-col"
        style={{ height: paneHeight }}
      >
        <OutputPane
          result={result}
          error={error}
          stdin={stdin}
          onStdinChange={setStdin}
          activeTab={tab}
          onTabChange={setTab}
        />
      </div>

      <StatusBar
        line={cursor.line}
        col={cursor.col}
        result={result}
        error={error}
        running={running}
      />
    </div>
  )
}
```

- [ ] **Step 9: Verify green**

Run: `npm test && npm run typecheck`
Expected: every suite passes, no type errors.

---

### Task 11: Real-provider integration check and deploy

The unit tests all use mocked `fetch`. This task is the one place real network calls are made, and it is how you learn that a provider has died.

**Files:**
- Create: `scripts/check-providers.mjs`
- Modify: `package.json` (add the `check:providers` script)
- Create: `README.md`

**Interfaces:**
- Consumes: nothing from earlier tasks — this deliberately calls the live APIs directly so it keeps working if the app code breaks.
- Produces: `npm run check:providers`

- [ ] **Step 1: Write the liveness script**

`scripts/check-providers.mjs`:
```js
// Calls the real APIs. Run this when output looks wrong — it distinguishes
// "our code broke" from "the provider died", which is what killed Piston.
const SRC = 'public class Main{public static void main(String[] a){' +
  'System.out.println("Hi "+new java.util.Scanner(System.in).nextLine());}}'

async function judge0() {
  const url = 'https://ce.judge0.com/submissions?wait=true&base64_encoded=false' +
    '&fields=stdout,stderr,compile_output,message,time,exit_code,status'
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language_id: 91, source_code: SRC, stdin: 'Aman' }),
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const b = await r.json()
  if (b.stdout !== 'Hi Aman\n') throw new Error(`unexpected stdout: ${b.stdout}`)
}

async function wandbox() {
  const r = await fetch('https://wandbox.org/api/compile.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      compiler: 'openjdk-jdk-22+36',
      code: SRC.replace(/^public\s+/, ''),
      stdin: 'Aman', codes: [], save: false,
    }),
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const b = await r.json()
  if (b.program_output !== 'Hi Aman\n') {
    throw new Error(`unexpected output: ${b.program_output} ${b.compiler_error}`)
  }
}

let failed = 0
for (const [name, fn] of [['judge0', judge0], ['wandbox', wandbox]]) {
  try {
    await fn()
    console.log(`ok   ${name}`)
  } catch (e) {
    failed++
    console.error(`FAIL ${name}: ${e.message}`)
  }
}
if (failed === 2) {
  console.error('\nBoth providers are down. The app cannot run any code.')
  process.exit(1)
}
```

Add to `package.json` scripts:
```json
"check:providers": "node scripts/check-providers.mjs"
```

- [ ] **Step 2: Run it against the live APIs**

Run: `npm run check:providers`
Expected: `ok   judge0` and `ok   wandbox`. If one fails, that provider has changed or died — note it and continue; if both fail, stop and investigate before deploying.

- [ ] **Step 3: Check the bundle budget**

Run: `npm run build && du -sh dist && find dist -name '*.js' -exec sh -c 'gzip -c "$1" | wc -c' _ {} \;`
Expected: total gzipped JS under 400KB. If over, the likely cause is CodeMirror's full `basicSetup` — drop unused extensions.

- [ ] **Step 4: Manual verification in a browser**

Run: `npm run dev`, open the printed URL, and confirm by hand:
1. Default program runs and prints `Hello, world!`.
2. Examples → "Reading input" loads, the Input tab is pre-filled with `Aman\n27\n`, and Run prints the age line. **This proves the stdin path end to end.**
3. Examples → "A compile error" runs and shows a compile error in red with a `Main.java:N` line reference — **not** `prog.java`.
4. The theme toggle changes both the chrome and the editor together.
5. Reload the page; the source and stdin are restored.
6. `Ctrl+S` downloads `Main.java` and does **not** open the browser save dialog.

- [ ] **Step 5: Write the README**

`README.md` covering: what it is, `npm run dev` / `test` / `build` / `check:providers`, the provider table with the note that Piston went whitelist-only on 2026-02-15, and how to add a provider (implement `Provider`, append to `DEFAULT_PROVIDERS`).

- [ ] **Step 6: Deploy to Cloudflare Pages**

1. Push the repo to GitHub.
2. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git.
3. Build command `npm run build`, output directory `dist`, framework preset Vite.
4. Deploy. No environment variables are needed.
5. Open the resulting `*.pages.dev` URL and repeat the Step 4 checks against the deployed site — in particular that a run succeeds, which proves CORS works from the real origin.

---

## Notes for the executor

- **The failover test in Task 6 is the most important test in this project.** Piston's shutdown is the reason the abstraction exists. If you are tempted to simplify `runJava` into a direct Judge0 call, re-read the spec's section 2.1.
- **Do not add a provider that lacks CORS headers.** Paiza was rejected for exactly this — a static site cannot call it, no matter how good the API looks in curl.
- **`normalizeWandbox` must remap `prog.java` in both the compile and run branches.** Testing only the compile branch would let a real stack trace leak the internal filename.
