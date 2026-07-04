'use strict'

const PRODUCTION_ORIGIN = 'https://zeni.aneurinadvisory.com'
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

function allowedRequestOrigin(req) {
  const origin = normalizedOrigin(req.headers.origin)
  if (!origin) return null

  const allowed = new Set([PRODUCTION_ORIGIN])
  const vercelUrl = String(process.env.VERCEL_URL || '').trim()
  if (vercelUrl) allowed.add(`https://${vercelUrl}`)

  if (process.env.VERCEL_ENV !== 'production' && process.env.NODE_ENV !== 'production') {
    allowed.add('http://localhost:3000')
    allowed.add('http://127.0.0.1:3000')
  }

  return allowed.has(origin) ? origin : null
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
  const forwarded = String(req.headers['x-forwarded-for'] || '')
    .split(',')[0]
    .trim()
  const realIp = String(req.headers['x-real-ip'] || '').trim()
  const socketIp = String(req.socket?.remoteAddress || '').trim()
  return (forwarded || realIp || socketIp).slice(0, 128)
}

module.exports = async function checkoutBridge(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return send(res, 405, { error: 'method not allowed' })
  }

  const requestOrigin = allowedRequestOrigin(req)
  if (!requestOrigin) return send(res, 403, { error: 'origin not allowed' })

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
  try {
    backendUrl = parseBackendUrl()
  } catch (error) {
    console.error('[Paid Checkout Bridge] Configuration error', error)
    return send(res, 503, { error: 'checkout temporarily unavailable' })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  const forwardedFor = sourceIp(req)

  try {
    const upstream = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Origin': requestOrigin,
        ...(forwardedFor ? { 'X-Forwarded-For': forwardedFor } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    const text = await upstream.text()
    let payload
    try {
      payload = text ? JSON.parse(text) : {}
    } catch {
      payload = { error: 'invalid checkout response' }
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      payload = { error: 'invalid checkout response' }
    }

    return send(res, upstream.status, payload)
  } catch (error) {
    console.error('[Paid Checkout Bridge] Backend request failed', error)
    return send(res, 502, { error: 'checkout temporarily unavailable' })
  } finally {
    clearTimeout(timeout)
  }
}
