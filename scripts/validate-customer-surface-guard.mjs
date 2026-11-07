import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { scanWebsite, websiteRoot } from './validate-customer-surfaces.mjs'
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'zeni-website-guard-'))
try {
  for (const rel of ['index.html', 'privacy/index.html', 'terms/index.html', 'getting-started/index.html', 'welcome/index.html', 'netlify.toml', 'netlify/functions/checkout.mjs']) {
    fs.mkdirSync(path.dirname(path.join(temp, rel)), { recursive: true }); fs.copyFileSync(path.join(websiteRoot, rel), path.join(temp, rel))
  }
  assert.equal(scanWebsite(temp).findings.length, 0)
  const extra = path.join(temp, 'future.html')
  fs.writeFileSync(extra, '<a href="mailto:info@' + ['aneurinadvisory', 'com'].join('.') + '">Email</a>')
  assert.ok(scanWebsite(temp).findings.some(f => f.path === 'future.html'))
  fs.unlinkSync(extra)
  const bridge = path.join(temp, 'netlify/functions/checkout.mjs')
  fs.appendFileSync(bridge, '\nconst forbiddenOutput = LEGACY_PRODUCTION_ORIGIN\n')
  assert.ok(scanWebsite(temp).findings.some(f => f.path === 'netlify/functions/checkout.mjs'))
  console.log('ZENI1150_WEBSITE_GUARD_NEGATIVE_PASS {"checks":3}')
} finally { fs.rmSync(temp, { recursive: true, force: true }) }
