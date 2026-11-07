import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
const page = fs.readFileSync('welcome/index.html', 'utf8')
const script = fs.readFileSync('welcome/welcome.js', 'utf8')
const nodes = new Map(['paidGateTitle', 'paidGateCopy', 'paidGateReturn', 'paidGateSupport'].map(id => [id, { textContent: '', hidden: id === 'paidGateSupport', style: {} }]))
let paymentState = 'checking', networkCalls = 0
const document = {
  title: 'Welcome', body: { setAttribute: (key, value) => { if (key === 'data-payment-state') paymentState = value } },
  getElementById: id => nodes.get(id) || null, querySelector: () => null,
  createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }), head: { appendChild() {} },
}
new vm.Script(script).runInNewContext({ document, window: { location: { href: 'https://preview.example/welcome/' }, history: { replaceState() {} } }, URL,
  fetch: () => { networkCalls++; throw new Error('No checkout session should make no network request') } })
assert.equal(paymentState, 'unverified')
assert.equal(networkCalls, 0)
assert.equal(nodes.get('paidGateSupport').hidden, false)
assert.ok(nodes.get('paidGateTitle').textContent.includes('couldn’t verify'))
assert.ok(/id="paidGateSupport"[^>]*hidden[^>]*>[^<]*<a href="mailto:support@zeni.business">Contact Member Support<\/a>/.test(page))
assert.ok(fs.readFileSync('welcome/shared.css', 'utf8').includes('#paidGateSupport a{display:inline'))
assert.ok(!fs.readFileSync('index.html', 'utf8').includes('Trusted by <b>Canadian founders</b>'))
console.log('ZENI1150_CUSTOMER_RECOVERY_PASS {"checks":7,"providerSends":0}')
