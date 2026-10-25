import fs from 'node:fs'
import assert from 'node:assert/strict'

const terms=fs.readFileSync('terms/index.html','utf8')
const privacy=fs.readFileSync('privacy/index.html','utf8')
const compact=(value)=>value.replace(/\s+/g,' ')
const termsText=compact(terms)
const privacyText=compact(privacy)
const netlify=fs.readFileSync('netlify.toml','utf8')

const oldRetention=/Upon cancellation, your data will be retained for 30 days after the\s+end of your final billing period/i
assert.ok(!oldRetention.test(terms),'old fixed 30-day cancellation retention promise is present')
assert.ok(termsText.includes('After cancellation or account closure, data handling and retention'))
assert.ok(termsText.includes('are governed by the Privacy Policy'))
assert.ok(termsText.includes('legal obligations, security records, unresolved disputes, normal backup'))
assert.ok(termsText.includes('You may request export or deletion'))

const terms30=[...terms.matchAll(/30 days/gi)].length
const privacy30=[...privacy.matchAll(/30 days/gi)].length
assert.equal(terms30,1,'Terms should contain exactly one unrelated 30-day pricing notice')
assert.ok(termsText.includes("change pricing with 30 days' written"))
assert.equal(privacy30,1,'Privacy should contain exactly one 30-day privacy-request response timeframe')
assert.ok(privacyText.includes('generally respond within 30 days'))

for(const phrase of [
  'Retention and deletion',
  'normal backup',
  'After a verified deletion request or account closure',
  'legal obligations, security records, unresolved disputes',
  'backup cycles, and provider limitations',
]) assert.ok(privacyText.includes(phrase),`Privacy missing qualified retention text: ${phrase}`)

assert.ok(netlify.includes('publish = "."'))
assert.ok(netlify.includes('https://zeni.business/:splat'))
assert.ok(netlify.includes('status = 301'))

console.log(JSON.stringify({
  status:'PASS',
  candidate:'5876e0b3ee4c32695376b23171f491604761a43f + validation-only overlay',
  termsFixedRetention:false,
  terms30DayOccurrences:terms30,
  privacy30DayOccurrences:privacy30,
  netlifyRedirectContract:true,
  deployAuthority:false
},null,2))
