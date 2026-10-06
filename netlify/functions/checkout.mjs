import { webcrypto } from 'node:crypto'

const PRODUCTION_ORIGIN = 'https://zeni.aneurinadvisory.com'
const OWNED_NETLIFY_HOST_PATTERN = /^(?:[a-z0-9-]+--)?[a-z0-9-]+\.netlify\.app$/i
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{20,120}$/
const MAX_BODY_BYTES = 4096
const LEGACY_BACKEND_CHECKOUT_PATH = '/api/public/checkout'
const CONFIGURED_BACKEND_CHECKOUT_PATH = '/api/public/configured-checkout'

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
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

function parseBackendUrl() {
  const raw = envValue('ZENI_BACKEND_CHECKOUT_URL')
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

function bridgeSecret() {
  const secret = envValue('ZENI_CHECKOUT_BRIDGE_SECRET')
  if (secret.length < 32) throw new Error('ZENI_CHECKOUT_BRIDGE_SECRET is not configured securely')
  return secret
}

function validatedBody(raw) {
  const body = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const requestId = String(body.requestId || '').trim()
  const firstName = String(body.firstName || '').trim().replace(/[ \t]+/g, ' ')
  const digits = String(body.whatsappNumber || '').replace(/[^0-9]/g, '')
  const whatsappNumber = digits.length === 10 ? '1' + digits : digits
  const province = String(body.province || '').trim().toUpperCase()
  const plan = String(body.plan || '').trim().toLowerCase()

  if (!REQUEST_ID_PATTERN.test(requestId)) return null
  if (!firstName || firstName.length > 120) return null
  if (!/^1[0-9]{10}$/.test(whatsappNumber)) return null
  if (!['ON', 'BC', 'AB'].includes(province)) return null
  if (!['core', 'core_weekly'].includes(plan)) return null

  return { requestId, firstName, whatsappNumber, province, plan }
}

function sourceIp(request) {
  return [
    request.headers.get('x-nf-client-connection-ip'),
    request.headers.get('x-forwarded-for'),
    request.headers.get('x-real-ip'),
  ].map(value => String(value || '').split(',')[0].trim()).find(Boolean)?.slice(0, 128) || ''
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

async function signedBackendHeaders(secret, clientIp, serializedBody) {
  const timestamp = String(Math.floor(Date.now() / 1000))
  const clientIpHash = await hmacHex(secret, 'ip:' + clientIp)
  const signature = await hmacHex(secret, timestamp + '.' + clientIpHash + '.' + serializedBody)
  return {
    'X-Zeni-Checkout-Timestamp': timestamp,
    'X-Zeni-Client-IP-Hash': clientIpHash,
    'X-Zeni-Checkout-Signature': signature,
  }
}

export default async function checkoutBridge(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405,
      headers: {
        Allow: 'POST',
        'Content-Type': 'application/json; charset=utf-8',
      },
    })
  }

  const requestOrigin = allowedRequestOrigin(request)
  if (!requestOrigin) {
    return json(403, { error: 'origin not allowed', code: 'website_bridge_origin_rejected' })
  }

  if (!String(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
    return json(415, { error: 'content type must be application/json' })
  }

  const contentLength = Number(request.headers.get('content-length') || 0)
  if (contentLength > MAX_BODY_BYTES) return json(413, { error: 'request too large' })

  const rawText = await request.text()
  if (new TextEncoder().encode(rawText).byteLength > MAX_BODY_BYTES) {
    return json(413, { error: 'request too large' })
  }

  let raw
  try {
    raw = JSON.parse(rawText || '{}')
  } catch {
    return json(400, { error: 'invalid json' })
  }

  const body = validatedBody(raw)
  if (!body) return json(400, { error: 'invalid checkout request' })

  let backendUrl
  let secret
  try {
    backendUrl = parseBackendUrl()
    secret = bridgeSecret()
  } catch (error) {
    console.error('[Paid Checkout Bridge] Configuration error', error)
    return json(503, { error: 'checkout temporarily unavailable' })
  }

  const clientIp = sourceIp(request)
  if (!clientIp) {
    console.error('[Paid Checkout Bridge] Trusted client IP was unavailable')
    return json(503, { error: 'checkout temporarily unavailable' })
  }

  const serializedBody = JSON.stringify(body)
  let bridgeHeaders
  try {
    bridgeHeaders = await signedBackendHeaders(secret, clientIp, serializedBody)
  } catch (error) {
    console.error('[Paid Checkout Bridge] Could not sign backend request', error)
    return json(503, { error: 'checkout temporarily unavailable' })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    const upstream = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Origin: requestOrigin,
        ...bridgeHeaders,
      },
      body: serializedBody,
      signal: controller.signal,
    })

    const text = await upstream.text()
    let payload
    try {
      payload = text ? JSON.parse(text) : {}
    } catch {
      return json(502, { error: 'checkout temporarily unavailable', code: 'upstream_non_json' })
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return json(502, { error: 'checkout temporarily unavailable', code: 'upstream_non_json' })
    }

    return json(upstream.status, payload)
  } catch (error) {
    console.error('[Paid Checkout Bridge] Backend request failed', error)
    return json(502, { error: 'checkout temporarily unavailable' })
  } finally {
    clearTimeout(timeout)
  }
}

export const config = {
  path: '/api/checkout',
}
