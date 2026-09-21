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
