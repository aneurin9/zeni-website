'use strict'

const { createHmac } = require('node:crypto')

const PRODUCTION_ORIGIN = 'https://zeni.aneurinadvisory.com'
const OWNED_VERCEL_PREVIEW_HOST_PATTERN = /^zeni-website(?:-[a-z0-9-]+)?-info-92096591s-projects\.vercel\.app$/i
const CHECKOUT_SESSION_PATTERN = /^cs_(?:test|live)_[A-Za-z0-9_]+$/
const BACKEND_WELCOME_PATH = '/api/public/welcome'

function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  return res.status(status).json(body)
}

function normalizedOrigin(value) {
  try {
    return new URL(String(value || '')).origin
  } catch {
    return null
  }
}

function requestHostOrigin(req) {
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim()
  const host = forwardedHost || String(req.headers.host || '').trim()
  if (!host) return null
  const protocol = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() || 'https'
  return normalizedOrigin(`${protocol}://${host}`)
}

function trustedWebsiteOrigin(origin) {
  try {
    const parsed = new URL(origin)
    if (parsed.origin === PRODUCTION_ORIGIN) return true
    if (parsed.protocol === 'https:' && OWNED_VERCEL_PREVIEW_HOST_PATTERN.test(parsed.hostname)) return true
    return process.env.VERCEL_ENV !== 'production' &&
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
  } catch {
    return false
  }
}

function allowedRequestOrigin(req) {
  const hostOrigin = requestHostOrigin(req)
  if (!hostOrigin || !trustedWebsiteOrigin(hostOrigin)) return null

  const browserOrigin = normalizedOrigin(req.headers.origin)
  const fetchSite = String(req.headers['sec-fetch-site'] || '').trim().toLowerCase()
  if (browserOrigin) {
    if (browserOrigin !== hostOrigin) return null
    if (fetchSite && fetchSite !== 'same-origin') return null
    return hostOrigin
  }
  return fetchSite === 'same-origin' ? hostOrigin : null
}

function backendWelcomeUrl() {
  const raw = String(process.env.ZENI_BACKEND_CHECKOUT_URL || '').trim()
  if (!raw) throw new Error('ZENI_BACKEND_CHECKOUT_URL is not configured')
  const url = new URL(raw)
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('ZENI_BACKEND_CHECKOUT_URL is invalid')
  }
  url.pathname = BACKEND_WELCOME_PATH
  return url.toString()
}

function bridgeSecret() {
  const secret = String(process.env.ZENI_CHECKOUT_BRIDGE_SECRET || '')
  if (secret.length < 32) throw new Error('ZENI_CHECKOUT_BRIDGE_SECRET is not configured securely')
  return secret
}

function protectionBypassHeaders() {
  const secret = String(process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '').trim()
  return secret ? { 'x-vercel-protection-bypass': secret } : {}
}

module.exports = async function paidWelcomeBridge(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return send(res, 405, { error: 'method not allowed' })
  }

  const requestOrigin = allowedRequestOrigin(req)
  if (!requestOrigin) return send(res, 403, { error: 'origin not allowed' })

  const rawSessionId = Array.isArray(req.query?.checkout_session_id)
    ? req.query.checkout_session_id[0]
    : req.query?.checkout_session_id
  const checkoutSessionId = String(rawSessionId || '').trim()
  if (checkoutSessionId.length > 255 || !CHECKOUT_SESSION_PATTERN.test(checkoutSessionId)) {
    return send(res, 400, { error: 'invalid checkout session' })
  }

  let url
  let secret
  try {
    url = backendWelcomeUrl()
    secret = bridgeSecret()
  } catch (error) {
    console.error('[Paid Welcome Bridge] Configuration error', error)
    return send(res, 503, { error: 'welcome temporarily unavailable' })
  }

  const body = JSON.stringify({ checkoutSessionId })
  const timestamp = String(Math.floor(Date.now() / 1000))
  const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Origin': requestOrigin,
        'X-Zeni-Welcome-Timestamp': timestamp,
        'X-Zeni-Welcome-Signature': signature,
        ...protectionBypassHeaders(),
      },
      body,
      signal: controller.signal,
    })

    const text = await upstream.text()
    let payload
    try {
      payload = text ? JSON.parse(text) : {}
    } catch {
      return send(res, 502, { error: 'welcome temporarily unavailable' })
    }

    if (!upstream.ok) return send(res, upstream.status, { error: 'welcome temporarily unavailable' })
    const firstName = typeof payload?.firstName === 'string' ? payload.firstName : null
    return send(res, 200, { firstName })
  } catch (error) {
    console.error('[Paid Welcome Bridge] Backend request failed', error)
    return send(res, 502, { error: 'welcome temporarily unavailable' })
  } finally {
    clearTimeout(timeout)
  }
}
