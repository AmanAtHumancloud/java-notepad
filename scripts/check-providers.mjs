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
