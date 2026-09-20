import { webcrypto } from 'node:crypto'

const PRODUCTION_ORIGIN = 'https://zeni.aneurinadvisory.com'
const OWNED_NETLIFY_HOST_PATTERN = /^(?:[a-z0-9-]+--)?[a-z0-9-]+\.netlify\.app$/i
const CHECKOUT_SESSION_PATTERN = /^cs_(?:test|live)_[A-Za-z0-9_]+$/
const BACKEND_WELCOME_PATH = '/api/public/welcome'

function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  })
}

function envValue(name) {
  try {
    return String(Netlify.env.get(name) || '').trim()
  } catch {
    return ''
  }
}

function trustedWebsiteOrigin(origin) {
  try {
    const parsed = new URL(origin)
    return parsed.origin === PRODUCTION_ORIGIN ||
      (parsed.protocol === 'https:' && OWNED_NETLIFY_HOST_PATTERN.test(parsed.hostname))
  } catch {
    return false
  }
}

function allowedRequestOrigin(request) {
  const hostOrigin = new URL(request.url).origin
  if (!trustedWebsiteOrigin(hostOrigin)) return null

  const browserOrigin = request.headers.get('origin')
  const fetchSite = String(request.headers.get('sec-fetch-site') || '').trim().toLowerCase()
  if (browserOrigin) {
    let normalized
    try {
      normalized = new URL(browserOrigin).origin
    } catch {
      return null
    }
    if (normalized !== hostOrigin) return null
    if (fetchSite && fetchSite !== 'same-origin') return null
    return hostOrigin
  }
  return fetchSite === 'same-origin' ? hostOrigin : null
}

function backendWelcomeUrl() {
  const raw = envValue('ZENI_BACKEND_CHECKOUT_URL')
  if (!raw) throw new Error('ZENI_BACKEND_CHECKOUT_URL is not configured')
  const url = new URL(raw)
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('ZENI_BACKEND_CHECKOUT_URL is invalid')
  }
  url.pathname = BACKEND_WELCOME_PATH
  return url.toString()
}

function bridgeSecret() {
  const secret = envValue('ZENI_CHECKOUT_BRIDGE_SECRET')
  if (secret.length < 32) throw new Error('ZENI_CHECKOUT_BRIDGE_SECRET is not configured securely')
  return secret
}

function bytesToHex(bytes) {
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')
}

async function hmacHex(secret, value) {
  const encoder = new TextEncoder()
  const key = await webcrypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return bytesToHex(await webcrypto.subtle.sign('HMAC', key, encoder.encode(value)))
}

export default async function welcomeBridge(request) {
  if (request.method !== 'GET') {
    return json(405, { error: 'method not allowed' }, { Allow: 'GET' })
  }

  const requestOrigin = allowedRequestOrigin(request)
  if (!requestOrigin) return json(403, { error: 'origin not allowed' })

  const url = new URL(request.url)
  const checkoutSessionId = String(url.searchParams.get('checkout_session_id') || '').trim()
  if (checkoutSessionId.length > 255 || !CHECKOUT_SESSION_PATTERN.test(checkoutSessionId)) {
    return json(400, { error: 'invalid checkout session' })
  }

  let backendUrl
  let secret
  try {
    backendUrl = backendWelcomeUrl()
    secret = bridgeSecret()
  } catch (error) {
    console.error('[Paid Welcome Bridge] Configuration error', error)
    return json(503, { error: 'welcome temporarily unavailable' })
  }

  const body = JSON.stringify({ checkoutSessionId })
  const timestamp = String(Math.floor(Date.now() / 1000))
  let signature
  try {
    signature = await hmacHex(secret, timestamp + '.' + body)
  } catch (error) {
    console.error('[Paid Welcome Bridge] Could not sign backend request', error)
    return json(503, { error: 'welcome temporarily unavailable' })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)

  try {
    const upstream = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Origin: requestOrigin,
        'X-Zeni-Welcome-Timestamp': timestamp,
        'X-Zeni-Welcome-Signature': signature,
      },
      body,
      signal: controller.signal,
    })

    const text = await upstream.text()
    let payload
    try {
      payload = text ? JSON.parse(text) : {}
    } catch {
      return json(502, { error: 'welcome temporarily unavailable' })
    }

    if (!upstream.ok) return json(upstream.status, { error: 'welcome temporarily unavailable' })
    return json(200, { firstName: typeof payload?.firstName === 'string' ? payload.firstName : null })
  } catch (error) {
    console.error('[Paid Welcome Bridge] Backend request failed', error)
    return json(502, { error: 'welcome temporarily unavailable' })
  } finally {
    clearTimeout(timeout)
  }
}

export const config = {
  path: '/api/welcome',
}
