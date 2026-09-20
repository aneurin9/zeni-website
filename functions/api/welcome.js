const PRODUCTION_ORIGIN = 'https://zeni.aneurinadvisory.com'
const OWNED_PAGES_HOST_PATTERN = /^(?:[a-z0-9-]+\.)?zeni-website\.pages\.dev$/i
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

function trustedWebsiteOrigin(origin) {
  try {
    const parsed = new URL(origin)
    return parsed.origin === PRODUCTION_ORIGIN ||
      (parsed.protocol === 'https:' && OWNED_PAGES_HOST_PATTERN.test(parsed.hostname))
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
    try { normalized = new URL(browserOrigin).origin } catch { return null }
    if (normalized !== hostOrigin) return null
    if (fetchSite && fetchSite !== 'same-origin') return null
    return hostOrigin
  }
  return fetchSite === 'same-origin' ? hostOrigin : null
}

function backendWelcomeUrl(env) {
  const raw = String(env.ZENI_BACKEND_CHECKOUT_URL || '').trim()
  if (!raw) throw new Error('ZENI_BACKEND_CHECKOUT_URL is not configured')
  const url = new URL(raw)
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('ZENI_BACKEND_CHECKOUT_URL is invalid')
  }
  url.pathname = BACKEND_WELCOME_PATH
  return url.toString()
}

function bridgeSecret(env) {
  const secret = String(env.ZENI_CHECKOUT_BRIDGE_SECRET || '')
  if (secret.length < 32) throw new Error('ZENI_CHECKOUT_BRIDGE_SECRET is not configured securely')
  return secret
}

function bytesToHex(bytes) {
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('')
}

async function hmacHex(secret, value) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return bytesToHex(await crypto.subtle.sign('HMAC', key, encoder.encode(value)))
}

export async function onRequestGet({ request, env }) {
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
    backendUrl = backendWelcomeUrl(env)
    secret = bridgeSecret(env)
  } catch (error) {
    console.error('[Paid Welcome Bridge] Configuration error', error)
    return json(503, { error: 'welcome temporarily unavailable' })
  }

  const body = JSON.stringify({ checkoutSessionId })
  const timestamp = String(Math.floor(Date.now() / 1000))
  const signature = await hmacHex(secret, `${timestamp}.${body}`)

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
      signal: AbortSignal.timeout(10000),
    })

    const text = await upstream.text()
    let payload
    try { payload = text ? JSON.parse(text) : {} } catch {
      return json(502, { error: 'welcome temporarily unavailable' })
    }

    if (!upstream.ok) return json(upstream.status, { error: 'welcome temporarily unavailable' })
    return json(200, { firstName: typeof payload?.firstName === 'string' ? payload.firstName : null })
  } catch (error) {
    console.error('[Paid Welcome Bridge] Backend request failed', error)
    return json(502, { error: 'welcome temporarily unavailable' })
  }
}

export async function onRequest() {
  return json(405, { error: 'method not allowed' }, { Allow: 'GET' })
}
