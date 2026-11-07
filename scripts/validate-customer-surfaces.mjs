import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const websiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const legacy = /aneurinadvisory(?:\\?\.)com/i
const oldOrigin = 'https://zeni.' + ['aneurinadvisory', 'com'].join('.')
const bridgePaths = new Set(['api/checkout.js', 'api/welcome.js', 'functions/api/checkout.js', 'functions/api/welcome.js', 'netlify/functions/checkout.mjs', 'netlify/functions/welcome.mjs'])

export function scanWebsite(root = websiteRoot) {
  const findings = [], retained = []
  let scannedFiles = 0
  function walk(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['.git', 'node_modules', 'scripts', '.github'].includes(item.name)) continue
      const file = path.join(dir, item.name)
      if (item.isDirectory()) { walk(file); continue }
      if (!/\.(?:html|[cm]?js|css|json|txt|toml)$/.test(file)) continue
      scannedFiles++
      const rel = path.relative(root, file).replaceAll(path.sep, '/')
      const text = fs.readFileSync(file, 'utf8')
      const refCount = (text.match(/LEGACY_PRODUCTION_ORIGIN/g) || []).length
      text.split('\n').forEach((line, index) => {
        if (!legacy.test(line)) return
        if (bridgePaths.has(rel) && line === "const LEGACY_PRODUCTION_ORIGIN = '" + oldOrigin + "'" && refCount === 2 && text.includes('parsed.origin === LEGACY_PRODUCTION_ORIGIN')) {
          retained.push({ path: rel, line: index + 1, reason: 'Incoming-origin compatibility only; no generated legacy links.' }); return
        }
        if (rel === 'netlify.toml' && [oldOrigin, oldOrigin.replace('https:', 'http:')].some(origin => line.trim() === 'from = "' + origin + '/*"') && text.includes('to = "https://zeni.business/:splat"')) {
          retained.push({ path: rel, line: index + 1, reason: 'One-way redirect to the canonical website.' }); return
        }
        findings.push({ path: rel, line: index + 1 })
      })
    }
  }
  walk(root)
  for (const rel of ['index.html', 'privacy/index.html', 'terms/index.html', 'getting-started/index.html', 'welcome/index.html']) {
    const text = fs.readFileSync(path.join(root, rel), 'utf8')
    if (!text.includes('info@zeni.business')) findings.push({ path: rel, reason: 'Missing canonical general contact' })
  }
  return { scannedFiles, findings, retained }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = scanWebsite()
  console.log('ZENI_WEBSITE_SURFACE_RESIDUE ' + JSON.stringify(result))
  if (result.findings.length) process.exitCode = 1
}
