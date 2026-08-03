const PRODUCTION_ORIGIN = 'https://zeni.aneurinadvisory.com'
const WORKERS_PREVIEW_HOST_PATTERN = /^(?:[a-z0-9-]+-)?zeni-website\.[a-z0-9-]+\.workers\.dev$/i
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{20,120}$/
const CHECKOUT_SESSION_PATTERN = /^cs_(?:test|live)_[A-Za-z0-9_]+$/
const MAX_BODY_BYTES = 4096
const LEGACY_BACKEND_CHECKOUT_PATH = '/api/public/checkout'
const CONFIGURED_BACKEND_CHECKOUT_PATH = '/api/public/configured-checkout'
const BACKEND_WELCOME_PATH = '/api/public/welcome'
const encoder = new TextEncoder()

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

function methodNotAllowed(allowedMethod) {
  const response = jsonResponse(405, { error: 'method not allowed' })
  response.headers.set('Allow', allowedMethod)
  return response
}

function normalizedOrigin(value) {
  try {
    return new URL(String(value || '')).origin
  } catch {
    return null
  }
}

function trustedWebsiteOrigin(origin) {
  try {
    const parsed = new URL(origin)
    if (parsed.origin === PRODUCTION_ORIGIN) return true
    if (parsed.protocol === 'https:' && WORKERS_PREVIEW_HOST_PATTERN.test(parsed.hostname)) return true
    return parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
  } catch {
    return false
  }
}

function allowedRequestOrigin(request) {
  const hostOrigin = new URL(request.url).origin
  if (!trustedWebsiteOrigin(hostOrigin)) return null

  const browserOrigin = normalizedOrigin(request.headers.get('Origin'))
  const fetchSite = String(request.headers.get('Sec-Fetch-Site') || '').trim().toLowerCase()

  if (browserOrigin) {
    if (browserOrigin !== hostOrigin) return null
    if (fetchSite && fetchSite !== 'same-origin') return null
    return hostOrigin
  }

  return fetchSite === 'same-origin' ? hostOrigin : null
}

function parseBackendCheckoutUrl(env) {
  const raw = String(env.ZENI_BACKEND_CHECKOUT_URL || '').trim()
  if (!raw) throw new Error('ZENI_BACKEND_CHECKOUT_URL is not configured')

  const url = new URL(raw)
  const pathname = url.pathname.replace(/\/+$/, '')
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    ![LEGACY_BACKEND_CHECKOUT_PATH, CONFIGURED_BACKEND_CHECKOUT_PATH].includes(pathname)
  ) {
    throw new Error('ZENI_BACKEND_CHECKOUT_URL is invalid')
  }

  url.pathname = CONFIGURED_BACKEND_CHECKOUT_PATH
  return url.toString()
}

function parseBackendWelcomeUrl(env) {
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

function validatedCheckoutBody(raw) {
  const body = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const requestId = String(body.requestId || '').trim()
  const firstName = String(body.firstName || '').trim().replace(/\s+/g, ' ')
  const digits = String(body.whatsappNumber || '').replace(/\D/g, '')
  const whatsappNumber = digits.length === 10 ? `1${digits}` : digits
  const province = String(body.province || '').trim().toUpperCase()
  const plan = String(body.plan || '').trim().toLowerCase()

  if (!REQUEST_ID_PATTERN.test(requestId)) return null
  if (!firstName || firstName.length > 120) return null
  if (!/^1\d{10}$/.test(whatsappNumber)) return null
  if (!['ON', 'BC', 'AB'].includes(province)) return null
  if (!['core', 'premium'].includes(plan)) return null

  return { requestId, firstName, whatsappNumber, province, plan }
}

function sourceIp(request) {
  const connectingIp = String(request.headers.get('CF-Connecting-IP') || '').trim()
  if (connectingIp) return connectingIp.slice(0, 128)

  const host = new URL(request.url).hostname
  if (host === 'localhost' || host === '127.0.0.1') {
    return String(request.headers.get('X-Real-IP') || '127.0.0.1').trim().slice(0, 128)
  }

  return ''
}

async function importHmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

async function hmacHex(key, value) {
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value))
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('')
}

async function signedCheckoutHeaders(secret, clientIp, serializedBody) {
  const key = await importHmacKey(secret)
  const timestamp = String(Math.floor(Date.now() / 1000))
  const clientIpHash = await hmacHex(key, `ip:${clientIp}`)
  const signature = await hmacHex(key, `${timestamp}.${clientIpHash}.${serializedBody}`)

  return {
    'X-Zeni-Checkout-Timestamp': timestamp,
    'X-Zeni-Client-IP-Hash': clientIpHash,
    'X-Zeni-Checkout-Signature': signature,
  }
}

async function signedWelcomeHeaders(secret, serializedBody) {
  const key = await importHmacKey(secret)
  const timestamp = String(Math.floor(Date.now() / 1000))
  const signature = await hmacHex(key, `${timestamp}.${serializedBody}`)

  return {
    'X-Zeni-Welcome-Timestamp': timestamp,
    'X-Zeni-Welcome-Signature': signature,
  }
}

async function readJsonBody(request) {
  const contentLength = Number(request.headers.get('Content-Length') || 0)
  if (contentLength > MAX_BODY_BYTES) return { error: jsonResponse(413, { error: 'request too large' }) }

  const text = await request.text()
  if (encoder.encode(text).byteLength > MAX_BODY_BYTES) {
    return { error: jsonResponse(413, { error: 'request too large' }) }
  }

  try {
    return { value: text ? JSON.parse(text) : {} }
  } catch {
    return { error: jsonResponse(400, { error: 'invalid json' }) }
  }
}

async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

async function handleCheckout(request, env) {
  if (request.method !== 'POST') return methodNotAllowed('POST')

  const requestOrigin = allowedRequestOrigin(request)
  if (!requestOrigin) {
    return jsonResponse(403, { error: 'origin not allowed', code: 'website_bridge_origin_rejected' })
  }

  const contentType = String(request.headers.get('Content-Type') || '').toLowerCase()
  if (!contentType.startsWith('application/json')) {
    return jsonResponse(415, { error: 'content type must be application/json' })
  }

  const parsed = await readJsonBody(request)
  if (parsed.error) return parsed.error

  const body = validatedCheckoutBody(parsed.value)
  if (!body) return jsonResponse(400, { error: 'invalid checkout request' })

  let backendUrl
  let secret
  try {
    backendUrl = parseBackendCheckoutUrl(env)
    secret = bridgeSecret(env)
  } catch (error) {
    console.error('[Paid Checkout Bridge] Configuration error', error)
    return jsonResponse(503, { error: 'checkout temporarily unavailable' })
  }

  const clientIp = sourceIp(request)
  if (!clientIp) {
    console.error('[Paid Checkout Bridge] Trusted client IP was unavailable')
    return jsonResponse(503, { error: 'checkout temporarily unavailable' })
  }

  const serializedBody = JSON.stringify(body)
  const bridgeHeaders = await signedCheckoutHeaders(secret, clientIp, serializedBody)

  try {
    const upstream = await fetchWithTimeout(backendUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Origin: requestOrigin,
        ...bridgeHeaders,
      },
      body: serializedBody,
    }, 15000)

    const text = await upstream.text()
    let payload
    try {
      payload = text ? JSON.parse(text) : {}
    } catch {
      return jsonResponse(502, { error: 'checkout temporarily unavailable', code: 'upstream_non_json' })
    }

    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
      return jsonResponse(502, { error: 'checkout temporarily unavailable', code: 'upstream_non_json' })
    }

    return jsonResponse(upstream.status, payload)
  } catch (error) {
    console.error('[Paid Checkout Bridge] Backend request failed', error)
    return jsonResponse(502, { error: 'checkout temporarily unavailable' })
  }
}

async function handleWelcome(request, env) {
  if (request.method !== 'GET') return methodNotAllowed('GET')

  const requestOrigin = allowedRequestOrigin(request)
  if (!requestOrigin) return jsonResponse(403, { error: 'origin not allowed' })

  const requestUrl = new URL(request.url)
  const checkoutSessionId = String(requestUrl.searchParams.get('checkout_session_id') || '').trim()
  if (checkoutSessionId.length > 255 || !CHECKOUT_SESSION_PATTERN.test(checkoutSessionId)) {
    return jsonResponse(400, { error: 'invalid checkout session' })
  }

  let backendUrl
  let secret
  try {
    backendUrl = parseBackendWelcomeUrl(env)
    secret = bridgeSecret(env)
  } catch (error) {
    console.error('[Paid Welcome Bridge] Configuration error', error)
    return jsonResponse(503, { error: 'welcome temporarily unavailable' })
  }

  const serializedBody = JSON.stringify({ checkoutSessionId })
  const signedHeaders = await signedWelcomeHeaders(secret, serializedBody)

  try {
    const upstream = await fetchWithTimeout(backendUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Origin: requestOrigin,
        ...signedHeaders,
      },
      body: serializedBody,
    }, 10000)

    const text = await upstream.text()
    let payload
    try {
      payload = text ? JSON.parse(text) : {}
    } catch {
      return jsonResponse(502, { error: 'welcome temporarily unavailable' })
    }

    if (!upstream.ok) return jsonResponse(upstream.status, { error: 'welcome temporarily unavailable' })
    const firstName = typeof payload?.firstName === 'string' ? payload.firstName : null
    return jsonResponse(200, { firstName })
  } catch (error) {
    console.error('[Paid Welcome Bridge] Backend request failed', error)
    return jsonResponse(502, { error: 'welcome temporarily unavailable' })
  }
}

export default {
  async fetch(request, env) {
    const pathname = new URL(request.url).pathname
    if (pathname === '/api/checkout') return handleCheckout(request, env)
    if (pathname === '/api/welcome') return handleWelcome(request, env)
    return env.ASSETS.fetch(request)
  },
}
