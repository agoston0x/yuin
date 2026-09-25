/** Three pages, one bundle each, static output. */
import { build, context } from 'esbuild'
import { mkdir, copyFile } from 'node:fs/promises'

const OUT = 'dist'
const serve = process.argv.includes('--serve')

const define = Object.fromEntries(
  [
    'SEPOLIA_RPC',
    'NODE_REGISTRY',
    'APP_REGISTRY',
    'IDENTITY_REGISTRY',
    'ACCOUNT_FACTORY',
    'APP_RESOLVER',
    'SIGNIN_URL',
    'ENS_ROOT',
  ].map((name) => [`process.env.${name}`, JSON.stringify(process.env[name] ?? '')]),
)

const options = {
  entryPoints: ['src/landing.js', 'src/console.js', 'src/dashboard.js'],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  minify: !serve,
  outdir: OUT,
  define,
  legalComments: 'none',
}

const pages = ['index.html', 'console.html', 'dashboard.html', 'style.css']

await mkdir(OUT, { recursive: true })

if (serve) {
  const ctx = await context(options)
  await ctx.watch()
  for (const page of pages) await copyFile(page, `${OUT}/${page}`)
  const server = await ctx.serve({ servedir: OUT, port: 8730 })
  console.log(`website on http://localhost:${server.port}`)
} else {
  await build(options)
  for (const page of pages) await copyFile(page, `${OUT}/${page}`)
  console.log(`built ${pages.length} pages`)
}
