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
