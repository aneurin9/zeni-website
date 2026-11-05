import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import checkout from '../netlify/functions/checkout.mjs'
import welcome from '../netlify/functions/welcome.mjs'

// Local fixtures only: no provider, payment, database, or network calls.
const origin = 'https://deploy-preview-84--zeni-website.netlify.app'
const secret = 'disposable-validation-secret-01234567890123456789'
const headers = { origin, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json', 'x-nf-client-connection-ip': '192.0.2.1' }
globalThis.Netlify = { env: { get: key => ({ ZENI_BACKEND_CHECKOUT_URL: 'https://backend.example/api/public/checkout', ZENI_CHECKOUT_BRIDGE_SECRET: secret })[key] } }
const calls = []
globalThis.fetch = async (url, init) => {
  calls.push({ url, init })
  return new Response(JSON.stringify({ url: 'https://checkout.stripe.com/c/test_fixture', firstName: 'Audit' }), { status: 200 })
}

async function expectStatus(handler, request, expected, upstream = 0) {
  const before = calls.length
  assert.equal((await handler(request)).status, expected)
  assert.equal(calls.length - before, upstream)
}
const req = (path, options) => new Request(origin + path, options)
await expectStatus(checkout, req('/api/checkout'), 405)
await expectStatus(checkout, req('/api/checkout', { method: 'POST', headers: { ...headers, origin: 'https://example.com' }, body: '{}' }), 403)
await expectStatus(checkout, req('/api/checkout', { method: 'POST', headers, body: '{}' }), 400)
await expectStatus(checkout, req('/api/checkout', { method: 'POST', headers, body: '{' }), 400)
await expectStatus(checkout, req('/api/checkout', { method: 'POST', headers, body: 'x'.repeat(4097) }), 413)
const fixture = { requestId: 'zeni_disposable_fixture_123456789', firstName: 'Audit', whatsappNumber: '4165550132', province: 'ON', plan: 'core', timezone: 'America/Toronto' }
await expectStatus(checkout, req('/api/checkout', { method: 'POST', headers, body: JSON.stringify(fixture) }), 200, 1)
const checkoutCall = calls.at(-1)
assert.equal(checkoutCall.url, 'https://backend.example/api/public/configured-checkout')
assert.equal(JSON.parse(checkoutCall.init.body).billingCadence, 'monthly')
const ch = checkoutCall.init.headers
assert.equal(ch['X-Zeni-Checkout-Signature'], createHmac('sha256', secret).update(ch['X-Zeni-Checkout-Timestamp'] + '.' + ch['X-Zeni-Client-IP-Hash'] + '.' + checkoutCall.init.body).digest('hex'))
await expectStatus(welcome, req('/api/welcome', { method: 'POST', headers, body: '{}' }), 405)
await expectStatus(welcome, req('/api/welcome', { headers: { ...headers, origin: 'https://example.com' } }), 403)
await expectStatus(welcome, req('/api/welcome', { headers }), 400)
await expectStatus(welcome, req('/api/welcome?checkout_session_id=cs_test_fixture', { headers }), 200, 1)
const welcomeCall = calls.at(-1)
const wh = welcomeCall.init.headers
assert.equal(wh['X-Zeni-Welcome-Signature'], createHmac('sha256', secret).update(wh['X-Zeni-Welcome-Timestamp'] + '.' + welcomeCall.init.body).digest('hex'))
console.log('Netlify bridge validation passed; local fixtures only.')
