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

test('loading an example over a clean buffer replaces the source and stdin', async () => {
  render(<App />)
  await userEvent.click(screen.getByRole('button', { name: /examples/i }))
  await userEvent.click(screen.getByRole('menuitem', { name: /reading input/i }))

  // CodeMirror splits a line across syntax-highlight spans, so assert on the
  // editor's full content rather than on any single text node.
  await waitFor(() => {
    expect(document.querySelector('.cm-content')?.textContent)
      .toContain('new Scanner(System.in)')
  })

  await userEvent.click(screen.getByRole('tab', { name: /input/i }))
  expect(screen.getByLabelText(/standard input/i)).toHaveValue('Aman\n27\n')
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
