/**
 * Bundle to a single directory to upload to Swarm.
 *
 * The hash of what comes out is registered on chain, so the build has to be reproducible:
 * no timestamps, no absolute paths, nothing fetched at build time. Two people building
 * the same commit must get the same bytes, or the on-chain hash proves nothing.
 */
import { build, context } from 'esbuild'
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const OUT = 'dist'
const serve = process.argv.includes('--serve')

const define = Object.fromEntries(
  ['SEPOLIA_RPC', 'NODE_REGISTRY', 'APP_REGISTRY', 'IDENTITY_REGISTRY', 'ACCOUNT_FACTORY', 'WORLD_APP_ID'].map(
    (name) => [`process.env.${name}`, JSON.stringify(process.env[name] ?? '')],
  ),
)

const options = {
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  minify: !serve,
  sourcemap: false,
  outfile: `${OUT}/main.js`,
  define,
  legalComments: 'none',
}

await mkdir(OUT, { recursive: true })

if (serve) {
  const ctx = await context(options)
  await ctx.watch()
  const server = await ctx.serve({ servedir: OUT, port: 8720 })
  await copyFile('index.html', `${OUT}/index.html`)
  await copyFile('style.css', `${OUT}/style.css`)
  console.log(`signin on http://localhost:${server.port}`)
} else {
  await build(options)
  await copyFile('index.html', `${OUT}/index.html`)
  await copyFile('style.css', `${OUT}/style.css`)

  // The hash the registry will hold: every served file, in a fixed order.
  const hash = createHash('sha256')
  for (const file of ['index.html', 'style.css', 'main.js']) {
    hash.update(file)
    hash.update(await readFile(`${OUT}/${file}`))
  }
  const digest = '0x' + hash.digest('hex')
  await writeFile(`${OUT}/frontend-hash.txt`, digest + '\n')
  console.log(`frontend hash ${digest}`)
}
