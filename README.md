# Java Notepad

Write one Java file, press Run, see the output. No project, no build system,
no login. A static site with no backend of its own.

## Commands

| | |
|---|---|
| `npm run dev` | dev server |
| `npm test` | unit tests (Vitest) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | static build into `dist/` |
| `npm run check:providers` | **hits the real execution APIs** — run this when output looks wrong |

## How code is executed

There is no server here. Execution is delegated to free public APIs, tried in
order by `src/run/runner.ts`:

| Provider | JDK | Notes |
|---|---|---|
| Judge0 CE (`ce.judge0.com`) | 17 | primary; `public class Main` works natively |
| Wandbox (`wandbox.org`) | 22 | fallback; compiles to `prog.java`, so the top-level `public` modifier is stripped on send and the filename is remapped in error output |

Only *transport* failures fail over. A compile error or a non-zero exit is a
successful call — the user's code is wrong, not the provider — so it is shown
immediately and not retried elsewhere.

**Piston is not used.** Its public API went whitelist-only on 2026-02-15. That
shutdown is why this app is built around a provider list rather than a single
client: assume any free provider will eventually disappear.

## Adding a provider

1. Implement the `Provider` interface from `src/run/types.ts`.
2. Append it to `DEFAULT_PROVIDERS` in `src/run/runner.ts`.
3. Add fixture-driven normalizer tests, as in `src/run/judge0.test.ts`.

**The provider must send CORS headers.** Paiza was rejected for this reason
alone — a static site cannot call an API that does not allow cross-origin
requests, no matter how good the API looks from curl.

## Limits

One file, no external libraries, a few seconds of CPU, and execution happens
on a third-party service. These are stated in the UI, not hidden in a dialog.
