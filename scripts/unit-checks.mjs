import { sanitizeSearchTerm } from '../src/utils/sanitize.ts'

const cases = [
  { input: 'a,b', expected: 'a b' },
  { input: '(x)', expected: 'x' },
  { input: '100%', expected: '100' },
  { input: '_', expected: '' },
  { input: "'", expected: '' },
  { input: '"', expected: '' },
  { input: '\\', expected: '' },
  { input: '*', expected: '' },
  { input: '', expected: '' },
  { input: '   ', expected: '' },
  { input: 'a'.repeat(200), expected: 'a'.repeat(60) },
]

let failed = 0
for (const { input, expected } of cases) {
  const got = sanitizeSearchTerm(input)
  const ok = got === expected
  console.log(
    `${ok ? 'PASS' : 'FAIL'}: sanitizeSearchTerm(${JSON.stringify(input)}) => ${JSON.stringify(got)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`
  )
  if (!ok) failed += 1
}

console.log(`\nSUMMARY: ${cases.length - failed}/${cases.length} passed`)
if (failed > 0) process.exit(1)
