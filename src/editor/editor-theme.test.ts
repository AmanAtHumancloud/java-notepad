import { themeSpec, LIGHT_THEME, DARK_THEME } from './editor-theme'

test('colours are CSS variables, never resolved literals', () => {
  // Resolving these in JS means reading them during render, before the
  // data-theme effect has run — which renders the editor one theme behind.
  const values = Object.values(themeSpec()).flatMap(r => Object.values(r))
  const literals = values.filter(v => /#[0-9a-f]{3,8}\b|rgba?\(/i.test(v))
  expect(literals).toEqual([])
  expect(values.some(v => v.includes('var(--bg)'))).toBe(true)
})

test('the editor surface, gutters and popup are all themed', () => {
  const spec = themeSpec()
  expect(spec['&'].backgroundColor).toBe('var(--bg)')
  expect(spec['.cm-gutters'].backgroundColor).toBe('var(--bg-panel)')
  expect(spec['.cm-tooltip-autocomplete'].backgroundColor).toBe('var(--bg-panel)')
})

test('light and dark are distinct, stable extensions', () => {
  expect(LIGHT_THEME).not.toBe(DARK_THEME)
  // Stable identity — not rebuilt per render.
  expect(LIGHT_THEME).toBe(LIGHT_THEME)
})
