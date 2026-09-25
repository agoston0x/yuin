/** One page, one bundle. Identical in all three demos, so copying one is the whole answer. */
import { build, context } from 'esbuild'
import { mkdir, copyFile } from 'node:fs/promises'

const OUT = 'dist'
const serve = process.argv.includes('--serve')
const port = Number(process.env.PORT ?? 8740)

const define = Object.fromEntries(
  ['APP_ID', 'APP_LABEL', 'SEPOLIA_RPC', 'SIGNIN_URL', 'APP_REGISTRY', 'NODE_REGISTRY', 'IDENTITY_REGISTRY', 'ACCOUNT_FACTORY', 'PRICE_TOKEN', 'PAY_TOKEN'].map(
    (name) => [`process.env.${name}`, JSON.stringify(process.env[name] ?? '')],
  ),
)

const options = {
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  minify: !serve,
  outfile: `${OUT}/main.js`,
  define,
  legalComments: 'none',
}

await mkdir(OUT, { recursive: true })

if (serve) {
  const ctx = await context(options)
  await ctx.watch()
  await copyFile('index.html', `${OUT}/index.html`)
  await copyFile('style.css', `${OUT}/style.css`)
  const server = await ctx.serve({ servedir: OUT, port })
  console.log(`http://localhost:${server.port}`)
} else {
  await build(options)
  await copyFile('index.html', `${OUT}/index.html`)
  await copyFile('style.css', `${OUT}/style.css`)
  console.log('built')
}
