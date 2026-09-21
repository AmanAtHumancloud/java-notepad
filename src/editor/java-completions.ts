import {
  type Completion,
  type CompletionContext,
  type CompletionResult,
  snippetCompletion,
} from '@codemirror/autocomplete'

/**
 * There is no language server here, so completion is a curated vocabulary
 * plus snippets. It can offer `System.out.println`, but it cannot know that
 * `in.` should offer `nextInt()` — that would need type analysis.
 */

const KEYWORDS = [
  'abstract', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 'class',
  'continue', 'default', 'do', 'double', 'else', 'enum', 'extends', 'final',
  'finally', 'float', 'for', 'if', 'implements', 'import', 'instanceof',
  'int', 'interface', 'long', 'new', 'package', 'private', 'protected',
  'public', 'record', 'return', 'short', 'static', 'super', 'switch',
  'this', 'throw', 'throws', 'try', 'void', 'while', 'var', 'true', 'false',
  'null',
]

const API = [
  'System.out.println', 'System.out.print', 'System.out.printf',
  'System.err.println', 'System.in', 'System.currentTimeMillis',
  'String', 'String.format', 'String.join', 'String.valueOf',
  'StringBuilder', 'Integer.parseInt', 'Double.parseDouble',
  'Math.abs', 'Math.max', 'Math.min', 'Math.pow', 'Math.sqrt', 'Math.random',
  'Scanner', 'nextInt', 'nextLine', 'nextDouble', 'hasNext',
  'ArrayList', 'LinkedList', 'HashMap', 'LinkedHashMap', 'TreeMap',
  'HashSet', 'TreeSet', 'List', 'Map', 'Set', 'Arrays', 'Arrays.sort',
  'Arrays.asList', 'Collections', 'Collections.sort', 'Optional',
  'stream', 'filter', 'map', 'collect', 'Collectors.toList',
  'Collectors.joining', 'forEach', 'length', 'size', 'equals',
  'toString', 'hashCode', 'charAt', 'substring', 'indexOf', 'split',
  'trim', 'toUpperCase', 'toLowerCase', 'contains', 'isEmpty',
  'Exception', 'RuntimeException', 'IllegalArgumentException',
  'printStackTrace', 'getMessage',
]

export const SNIPPETS: Completion[] = [
  snippetCompletion('System.out.println(${});', {
    label: 'sout', detail: 'print a line', type: 'keyword', boost: 99,
  }),
  snippetCompletion('System.out.printf("${%s%n}", ${});', {
    label: 'souf', detail: 'printf', type: 'keyword', boost: 96,
  }),
  snippetCompletion(
    'public static void main(String[] args) {\n    ${}\n}',
    { label: 'psvm', detail: 'main method', type: 'keyword', boost: 98 },
  ),
  snippetCompletion(
    'public class ${Main} {\n    public static void main(String[] args) {\n        ${}\n    }\n}',
    { label: 'class', detail: 'class with main', type: 'keyword', boost: 90 },
  ),
  snippetCompletion(
    'for (int ${i} = 0; ${i} < ${n}; ${i}++) {\n    ${}\n}',
    { label: 'fori', detail: 'indexed for loop', type: 'keyword', boost: 97 },
  ),
  snippetCompletion(
    'for (${String} ${item} : ${items}) {\n    ${}\n}',
    { label: 'foreach', detail: 'enhanced for loop', type: 'keyword', boost: 95 },
  ),
  snippetCompletion(
    'while (${condition}) {\n    ${}\n}',
    { label: 'while', detail: 'while loop', type: 'keyword', boost: 80 },
  ),
  snippetCompletion(
    'if (${condition}) {\n    ${}\n}',
    { label: 'if', detail: 'if block', type: 'keyword', boost: 80 },
  ),
  snippetCompletion(
    'try {\n    ${}\n} catch (${Exception} e) {\n    e.printStackTrace();\n}',
    { label: 'trycatch', detail: 'try/catch', type: 'keyword', boost: 94 },
  ),
  snippetCompletion(
    'Scanner ${in} = new Scanner(System.in);\n${}',
    { label: 'scanner', detail: 'read from stdin', type: 'keyword', boost: 93 },
  ),
]

const WORDS: Completion[] = [
  ...KEYWORDS.map(label => ({ label, type: 'keyword' })),
  ...API.map(label => ({ label, type: 'function' })),
]

export const OPTIONS: Completion[] = [...SNIPPETS, ...WORDS]

/** Dotted names must match, so the token pattern includes `.`. */
const TOKEN = /[\w.]*/
const VALID_FOR = /^[\w.]*$/

export function javaCompletionSource(
  context: CompletionContext,
): CompletionResult | null {
  const token = context.matchBefore(TOKEN)
  if (!token) return null
  // Do not pop up on every keystroke in empty space; Ctrl+Space still works.
  if (token.from === token.to && !context.explicit) return null

  return { from: token.from, options: OPTIONS, validFor: VALID_FOR }
}
