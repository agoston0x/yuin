/**
 * One file, no server, nothing to configure at runtime.
 *
 * Swarm serves bytes, not applications — so everything the page needs is inlined into a
 * single HTML file: the script, the styles, the addresses. What comes out is what gets
 * uploaded, and its hash is what anyone can check it against.
 */
import { build } from 'esbuild'
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const define = Object.fromEntries(
  ['EMAIL_IDENTITY_REGISTRY', 'P256_VERIFIER', 'SENDERS', 'SEPOLIA_RPC'].map((name) => [
    `process.env.NEXT_PUBLIC_${name}`,
    JSON.stringify(process.env[`NEXT_PUBLIC_${name}`] ?? ''),
  ]),
)

const result = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  target: 'es2022',
  minify: true,
  write: false,
  define,
  legalComments: 'none',
})

const js = result.outputFiles[0].text
const shell = await readFile('index.html', 'utf8')
const html = shell.replace('<!--SCRIPT-->', `<script type="module">${js}</script>`)

await mkdir('dist', { recursive: true })
await writeFile('dist/index.html', html)
await copyFile('seal.png', 'dist/seal.png')

console.log(`${(html.length / 1024).toFixed(0)} kB`)
console.log(`sha256 ${createHash('sha256').update(html).digest('hex')}`)
