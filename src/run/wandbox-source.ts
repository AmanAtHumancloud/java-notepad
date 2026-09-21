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
