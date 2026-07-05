'use strict'

const { createHmac } = require('node:crypto')

const PRODUCTION_ORIGIN = 'https://zeni.aneurinadvisory.com'
const OWNED_VERCEL_PREVIEW_HOST_PATTERN = /^zeni-website(?:-[a-z0-9-]+)?-info-92096591s-projects\.vercel\.app$/i
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{20,120}$/
const MAX_BODY_BYTES = 4096

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

function logOriginDiagnostic(req) {
  if (process.env.VERCEL_ENV !== 'preview') return

  console.warn('[Paid Checkout Bridge] Origin diagnostic', {
    origin: req.headers.origin || null,
    host: req.headers.host || null,
    forwardedHost: req.headers['x-forwarded-host'] || null,
    forwardedProto: req.headers['x-forwarded-proto'] || null,
    fetchSite: req.headers['sec-fetch-site'] || null,
    vercelUrl: process.env.VERCEL_URL || null,
    vercelBranchUrl: process.env.VERCEL_BRANCH_URL || null,
    vercelEnv: process.env.VERCEL_ENV || null,
  })
}

function parseBackendUrl() {
  const raw = String(process.env.ZENI_BACKEND_CHECKOUT_URL || '').trim()
  if (!raw) throw new Error('ZENI_BACKEND_CHECKOUT_URL is not configured')

  const url = new URL(raw)
  const pathname = url.pathname.replace(/\/+$/, '')
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    pathname !== '/api/public/checkout'
  ) {
    throw new Error('ZENI_BACKEND_CHECKOUT_URL is invalid')
  }

  url.pathname = pathname
  return url.toString()
}

function checkoutBridgeSecret() {
  const secret = String(process.env.ZENI_CHECKOUT_BRIDGE_SECRET || '')
  if (secret.length < 32) throw new Error('ZENI_CHECKOUT_BRIDGE_SECRET is not configured securely')
  return secret
}

function validatedBody(raw) {
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

function sourceIp(req) {
  const vercelForwarded = String(req.headers['x-vercel-forwarded-for'] || '').split(',')[0].trim()
  const realIp = String(req.headers['x-real-ip'] || '').trim()
  const socketIp = String(req.socket?.remoteAddress || '').trim()

  if (process.env.VERCEL || process.env.VERCEL_ENV) {
    return (vercelForwarded || realIp || socketIp).slice(0, 128)
  }

  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  return (realIp || forwarded || socketIp).slice(0, 128)
}

function signedBackendHeaders(secret, clientIp, serializedBody) {
  const timestamp = String(Math.floor(Date.now() / 1000))
  const clientIpHash = createHmac('sha256', secret).update(`ip:${clientIp}`).digest('hex')
  const signature = createHmac('sha256', secret)
    .update(`${timestamp}.${clientIpHash}.${serializedBody}`)
    .digest('hex')

  return {
    'X-Zeni-Checkout-Timestamp': timestamp,
    'X-Zeni-Client-IP-Hash': clientIpHash,
    'X-Zeni-Checkout-Signature': signature,
  }
}

// Optional Vercel Deployment Protection bypass for the signed server-to-server
// call. Only emitted when VERCEL_AUTOMATION_BYPASS_SECRET is set on this
// (website) deployment; unset in production, so no header is sent there. This
// lets the bridge reach a protection-gated backend Preview without disabling
// protection for human visitors. See: Vercel "Protection Bypass for Automation".
function protectionBypassHeaders() {
  const secret = String(process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '').trim()
  return secret ? { 'x-vercel-protection-bypass': secret } : {}
}

module.exports = async function checkoutBridge(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return send(res, 405, { error: 'method not allowed' })
  }

  const requestOrigin = allowedRequestOrigin(req)
  if (!requestOrigin) {
    logOriginDiagnostic(req)
    return send(res, 403, { error: 'origin not allowed', code: 'website_bridge_origin_rejected' })
  }

  const contentType = String(req.headers['content-type'] || '').toLowerCase()
  if (!contentType.startsWith('application/json')) {
    return send(res, 415, { error: 'content type must be application/json' })
  }

  const contentLength = Number(req.headers['content-length'] || 0)
  if (contentLength > MAX_BODY_BYTES) return send(res, 413, { error: 'request too large' })

  let rawBody = req.body
  if (typeof rawBody === 'string') {
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
      return send(res, 413, { error: 'request too large' })
    }
    try {
      rawBody = JSON.parse(rawBody)
    } catch {
      return send(res, 400, { error: 'invalid json' })
    }
  } else {
    try {
      if (Buffer.byteLength(JSON.stringify(rawBody || {}), 'utf8') > MAX_BODY_BYTES) {
        return send(res, 413, { error: 'request too large' })
      }
    } catch {
      return send(res, 400, { error: 'invalid json' })
    }
  }

  const body = validatedBody(rawBody)
  if (!body) return send(res, 400, { error: 'invalid checkout request' })

  let backendUrl
  let secret
  try {
    backendUrl = parseBackendUrl()
    secret = checkoutBridgeSecret()
  } catch (error) {
    console.error('[Paid Checkout Bridge] Configuration error', error)
    return send(res, 503, { error: 'checkout temporarily unavailable' })
  }

  const clientIp = sourceIp(req)
  if (!clientIp) {
    console.error('[Paid Checkout Bridge] Trusted client IP was unavailable')
    return send(res, 503, { error: 'checkout temporarily unavailable' })
  }

  const serializedBody = JSON.stringify(body)
  const bridgeHeaders = signedBackendHeaders(secret, clientIp, serializedBody)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    const upstream = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Origin': requestOrigin,
        ...bridgeHeaders,
        ...protectionBypassHeaders(),
      },
      body: serializedBody,
      signal: controller.signal,
    })

    const upstreamContentType = String(upstream.headers.get('content-type') || '').toLowerCase()
    const text = await upstream.text()

    let payload = null
    let parseFailed = false
    if (text) {
      try {
        payload = JSON.parse(text)
      } catch {
        parseFailed = true
      }
    } else {
      payload = {}
    }

    const isJsonObject = payload !== null && typeof payload === 'object' && !Array.isArray(payload)

    // TEMP DIAGNOSTIC (preview only): reveals when the backend Preview returns a
    // non-JSON body (e.g. a Vercel Deployment Protection HTML page) — the case
    // the browser otherwise surfaces as the ambiguous "invalid secure link".
    // Logs no PII, no secrets, no signatures, no response body, no full Checkout
    // URL — only status, content-type, and a hostname.
    if (process.env.VERCEL_ENV === 'preview') {
      let urlHost = null
      try {
        if (isJsonObject && payload.url) urlHost = new URL(String(payload.url)).hostname
      } catch {
        urlHost = 'unparseable'
      }
      console.warn('[Paid Checkout Bridge] Upstream diagnostic', {
        upstreamStatus: upstream.status,
        upstreamContentType: upstreamContentType || null,
        parseFailed,
        hasUrl: Boolean(isJsonObject && payload.url),
        urlHost,
      })
    }

    // A non-JSON upstream body (protection/login/HTML page, gateway error) must
    // never be forwarded with its original status: a 2xx HTML page would reach
    // the browser as response.ok with no url ("invalid secure link"), masking the
    // real cause. Surface it as an unambiguous bridge failure instead.
    if (parseFailed || !isJsonObject) {
      return send(res, 502, { error: 'checkout temporarily unavailable', code: 'upstream_non_json' })
    }

    return send(res, upstream.status, payload)
  } catch (error) {
    console.error('[Paid Checkout Bridge] Backend request failed', error)
    return send(res, 502, { error: 'checkout temporarily unavailable' })
  } finally {
    clearTimeout(timeout)
  }
}
