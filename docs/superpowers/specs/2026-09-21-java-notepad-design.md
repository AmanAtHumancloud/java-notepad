# Java Notepad — Design

**Date:** 2026-09-21
**Status:** Approved, pre-implementation

A web-based Java editor and runner with a deliberately notepad-like interface.
Static site, no backend, deployed free on Cloudflare Pages.

---

## 1. Purpose and constraints

Write a single Java file, press Run, see output. No project setup, no build
system, no login. The notepad framing is not nostalgia — it is an honest
signal of the constraint: one file, no dependencies, short-lived programs.

**Hard constraints**

- No backend of our own. Execution is delegated to a free public API.
- No API keys, no secrets, no environment variables. Anything required at
  build time would have to be public anyway.
- Must deploy to a free static host and be reachable at a public URL.

**Non-goals for v1**

Multi-file projects, Maven/Gradle dependencies, debugging, pre-run syntax
diagnostics, accounts, persistence beyond `localStorage`, URL-hash sharing.

---

## 2. Execution backend

### 2.1 Why not Piston

The original plan targeted the public Piston API (`emkc.org`). It went
**whitelist-only on 2026-02-15**: `/runtimes` still responds, `/execute`
returns a refusal message. Verified 2026-09-21.

This is the central design risk. Free public execution APIs disappear. The
architecture must treat any single provider as temporary.

### 2.2 Provider survey (all verified live, 2026-09-21)

| Provider | CORS from browser | JDK | `public class Main` | Synchronous | Key |
|---|---|---|---|---|---|
| Judge0 CE (`ce.judge0.com`) | reflects `Origin` | 17.0.6 (id 91), 13.0.1 (id 62) | works natively | `?wait=true` | none |
| Wandbox (`wandbox.org`) | `*` | 22, 21 | **fails** — file is `prog.java` | yes | none |
| Paiza (`api.paiza.io`) | **none** | — | — | no, polls | `guest` |
| Piston (`emkc.org`) | — | — | — | — | **whitelisted** |

Paiza is disqualified: no CORS headers means a browser cannot call it at all
from a static origin, regardless of other merits.

**Decision:** Judge0 CE primary (its contract is closest to what the UI needs
and it requires no source rewriting), Wandbox fallback (newer JDK, permissive
CORS, and a built-in permlink that makes future sharing cheap).

### 2.3 The provider interface

```ts
type Phase = 'compile' | 'run'

interface RunResult {
  phase: Phase              // where execution ended
  stdout: string
  stderr: string            // compile errors normalized into here
  exitCode: number | null
  timeMs: number | null
  engine: string            // human label, e.g. "Judge0 · JDK 17"
}

interface Provider {
  id: string
  label: string
  run(source: string, stdin: string, signal: AbortSignal): Promise<RunResult>
}
```

`runJava()` walks the provider list in order.

- A **transport failure** (network error, non-2xx, malformed body, timeout)
  falls through to the next provider.
- A **compile error or non-zero exit** is a successful call. It returns
  immediately and does **not** fail over — the user's code is wrong, not the
  provider.
- If every provider fails, surface a single honest error naming each attempt.

Adding a self-hosted runner later is one new file plus one array entry.

### 2.4 Per-provider quirks to absorb

**Wandbox writes the source to `prog.java`.** A top-level `public class Main`
is therefore a compile error. On send, strip the `public ` modifier from the
top-level class declaration only — a same-line edit, so reported line numbers
stay correct. On receive, rewrite `prog.java:N` to `Main.java:N` in compiler
messages and stack traces so the user never sees the internal filename.

**Field mapping into `RunResult`:**

| | Judge0 CE | Wandbox |
|---|---|---|
| compile error | `compile_output` | `compiler_error` |
| stdout | `stdout` | `program_output` |
| stderr | `stderr` | `program_error` |
| status | `status.id` (3 = Accepted, 6 = Compilation Error) | `status` ("0" = ok) |
| timing | `time` (seconds, string) | not provided — measure client-side |

Judge0 is called with `base64_encoded=false&wait=true`.

### 2.5 Timeouts and cancellation

Two distinct limits, not to be confused:

- **Provider CPU limit** — enforced server-side, roughly 5-10s. Not ours to set.
- **Client wait limit** — 20s `AbortController` on our fetch, covering queueing
  and network on top of the provider's own limit.

Every request is wrapped in that 20s `AbortController`. The Stop button aborts
the fetch. It **cannot** kill the remote process; the status bar says
"stopped waiting" rather than "stopped", because claiming otherwise would be
a lie. Providers enforce their own CPU limits server-side.

---

## 3. Interface

Single screen, no router.

```
┌────────────────────────────────────────────┐
│ File  Edit  Run  Examples  Help      ☾     │  menu bar
├────────────────────────────────────────────┤
│  1  public class Main {                    │  CodeMirror 6
│  2      public static void main(...) {     │
│  3          System.out.println("hi");      │
├──── drag ──────────────────────────────────┤
│ Output │ Input                             │  tabbed bottom pane
│ hi                                         │
├────────────────────────────────────────────┤
│ Ln 3, Col 9 · exit 0 · 111ms · Judge0 JDK17│  status bar
└────────────────────────────────────────────┘
```

**Design decisions**

- **CodeMirror 6, not Monaco.** ~200KB against ~5MB, and Monaco's chrome
  fights the notepad aesthetic. We cannot offer real IntelliSense without a
  language server, so Monaco's main advantage is unavailable anyway.
- **Bottom pane is tabbed (Output / Input), not a third split.** stdin is used
  in a minority of runs; a permanently visible empty box wastes vertical
  space. Running auto-focuses the Output tab.
- **Monospace throughout, 1px borders, no sidebar, no file tabs, no icons
  beyond the theme toggle.** Restraint is the aesthetic.
- **`Ctrl+Enter`** runs. **`Ctrl+S`** is intercepted to suppress the browser
  save dialog and downloads `Main.java` instead. Tab inserts spaces.
- stderr renders in the error colour, stdout in the default foreground, in one
  interleaved-by-section pane (compile errors replace output entirely).
- A short, permanent line under Help states the limits: one file, no external
  libraries, a few seconds of CPU, execution runs on a third-party service.

---

## 4. State

Three hooks, no state library. The app has three pieces of state.

- `useEditorState` — source text; autosaves to `localStorage` debounced 500ms;
  restores on load; tracks a dirty flag for the Examples overwrite warning.
- `useRunner` — `idle | running | done`, the last `RunResult`, and `abort()`.
- `useTheme` — `light | dark`, initialised from `prefers-color-scheme`,
  persisted to `localStorage`.

---

## 5. Theming

CSS custom properties on `:root`, overridden under `[data-theme="dark"]`.
The **same token set** drives both the application chrome and the CodeMirror
theme extension, so the editor and the shell cannot drift apart. The
CodeMirror theme is swapped reactively via a compartment when the theme
changes.

Initial value follows `prefers-color-scheme`; an explicit choice persists and
wins thereafter.

---

## 6. Examples

Six snippets in a single typed array, one file:

1. Hello World
2. Scanner input — **also pre-fills the Input tab**, so the feature teaches itself
3. Arrays and loops
4. Collections (`Map`, `List`)
5. Streams
6. A deliberate compile error, so failure output is discoverable

Loading an example over a dirty buffer prompts first.

---

## 7. Testing

Vitest + Testing Library. Tests target the logic that will actually break:

- **Response normalizers** — one test per provider per outcome (success,
  compile error, runtime exception, stdin echo), driven by the real captured
  responses in Appendix A rather than invented fixtures.
- **Wandbox source rewriting** — `public class Main` is stripped correctly,
  line count is preserved, nested/inner `public class` is untouched, and
  `prog.java:N` is remapped to `Main.java:N`.
- **Failover order** — provider 1 throws, provider 2 is called; provider 1
  returns a compile error, provider 2 is *not* called; all fail, the combined
  error names each attempt.
- One smoke test that the app mounts and the Run button is present.

No coverage target. Tests that would only restate the implementation are not
written.

---

## 8. Build and deployment

Vite + React 19 + TypeScript, Tailwind for layout, CodeMirror 6 for the
editor. `npm run build` emits static assets.

Cloudflare Pages connected to the GitHub repo; pushes to `main` deploy
automatically to a free `*.pages.dev` URL. No environment variables, no
secrets, no server runtime.

Bundle budget: under ~400KB gzipped. CodeMirror plus its Java language mode is
the overwhelming majority; the app code is small.

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| A provider shuts down or whitelists, as Piston did | Two providers with automatic failover; adding a third is one file |
| Judge0 CE public instance is rate-limited or flaky | Wandbox failover; the status bar names the engine so degradation is visible |
| Both providers down | Honest error naming both attempts; the editor and autosave keep working |
| Providers change response shape | Normalizers are isolated and fixture-tested; a break is localized and obvious |
| User expects multi-file or Maven | Limits stated permanently in the UI, not hidden in a Help dialog |

---

## Appendix A — captured responses (2026-09-21)

Real bodies, to be used as test fixtures.

**Judge0 CE — success** (`POST /submissions?wait=true`, `language_id: 91`)
```json
{"stdout":"Hi Aman\n","time":"0.111","memory":18176,"stderr":null,
 "compile_output":null,"message":null,"status":{"id":3,"description":"Accepted"}}
```

**Judge0 CE — compile error**
```json
{"stdout":null,"time":null,"memory":null,"stderr":null,
 "compile_output":"Main.java:1: error: incompatible types: String cannot be converted to int\n...\n1 error\n",
 "message":null,"status":{"id":6,"description":"Compilation Error"}}
```

**Wandbox — success with stdin** (`POST /api/compile.json`, `openjdk-jdk-22+36`)
```json
{"status":"0","signal":"","compiler_error":"","program_output":"Hi Aman\n",
 "program_error":"on stderr\n","permlink":"","url":""}
```

**Wandbox — runtime exception** (note the `prog.java` leak to be rewritten)
```json
{"status":"1","compiler_error":"","program_output":"",
 "program_error":"Exception in thread \"main\" java.lang.ArrayIndexOutOfBoundsException: Index 5 out of bounds for length 1\n\tat Main.main(prog.java:1)\n"}
```

**Wandbox — `public class Main` rejection** (why the rewrite exists)
```
prog.java:2: error: class Main is public, should be declared in a file named Main.java
```
