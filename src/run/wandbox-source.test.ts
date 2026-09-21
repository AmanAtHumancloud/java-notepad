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
