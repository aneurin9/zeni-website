(function () {
  'use strict'

  var checkoutRequestId = ''
  var checkoutFingerprint = ''
  var checkoutBusy = false

  function createRequestId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID()
    }
    return 'zeni_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  }

  function canonicalPhone() {
    var digits = String(window.gsData && window.gsData.phone || '').replace(/\D/g, '')
    return digits.length === 10 ? '1' + digits : digits
  }

  function currentFingerprint() {
    var data = window.gsData || {}
    return [
      String(data.name || '').trim(),
      String(data.province || '').trim().toUpperCase(),
      canonicalPhone(),
      String(data.plan || '').trim().toLowerCase()
    ].join('|')
  }

  function checkoutErrorElement() {
    var body = document.getElementById('gsBody')
    if (!body) return null

    var error = document.getElementById('gsCheckoutError')
    if (!error) {
      error = document.createElement('p')
      error.id = 'gsCheckoutError'
      error.setAttribute('role', 'alert')
      error.style.cssText = 'display:none;margin:16px 0 0;padding:11px 13px;border-radius:11px;background:rgba(190,45,65,.08);border:1px solid rgba(190,45,65,.18);color:#9f2e43;font-size:13px;line-height:1.45;'
      body.appendChild(error)
    }
    return error
  }

  function showError(message) {
    var error = checkoutErrorElement()
    if (!error) return
    error.textContent = message
    error.style.display = 'block'
  }

  function clearError() {
    var error = document.getElementById('gsCheckoutError')
    if (error) {
      error.textContent = ''
      error.style.display = 'none'
    }
  }

  function setButtonBusy(button, busy, originalHtml) {
    if (!button) return
    button.disabled = busy
    button.style.pointerEvents = busy ? 'none' : 'auto'
    button.style.opacity = busy ? '.72' : '1'

    if (busy) {
      button.textContent = 'Preparing secure checkout…'
    } else if (originalHtml) {
      button.innerHTML = originalHtml
      if (typeof window.injectIconsFresh === 'function') window.injectIconsFresh(button)
    }
  }

  function safeStripeCheckoutUrl(value) {
    try {
      var url = new URL(String(value || ''))
      return url.protocol === 'https:' && url.hostname === 'checkout.stripe.com' ? url.toString() : null
    } catch (_) {
      return null
    }
  }

  window.gsRunCheckout = async function gsRunCheckout() {
    if (checkoutBusy) return

    var data = window.gsData || {}
    var fingerprint = currentFingerprint()
    var button = document.getElementById('gsNext')
    var originalHtml = button ? button.innerHTML : ''

    clearError()

    if (!data.name || !data.province || !data.plan || !/^1\d{10}$/.test(canonicalPhone())) {
      showError('Please check your details before continuing.')
      return
    }

    if (!checkoutRequestId || checkoutFingerprint !== fingerprint) {
      checkoutRequestId = createRequestId()
      checkoutFingerprint = fingerprint
    }

    checkoutBusy = true
    setButtonBusy(button, true, originalHtml)

    try {
      var response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        credentials: 'same-origin',
        body: JSON.stringify({
          requestId: checkoutRequestId,
          firstName: String(data.name || '').trim(),
          whatsappNumber: canonicalPhone(),
          province: String(data.province || '').trim().toUpperCase(),
          plan: String(data.plan || '').trim().toLowerCase()
        })
      })

      var payload = {}
      try {
        payload = await response.json()
      } catch (_) {
        payload = {}
      }

      if (!response.ok) {
        if (response.status === 409 && payload.error === 'active subscription already exists') {
          throw new Error('A Zeni account with this WhatsApp number is already active. Contact support if you need help with billing.')
        }
        if (response.status === 429) {
          throw new Error('There have been several checkout attempts. Please wait a little and try again.')
        }
        throw new Error('Secure checkout could not be opened. Please try again.')
      }

      var checkoutUrl = safeStripeCheckoutUrl(payload.url)
      if (!checkoutUrl) throw new Error('Secure checkout returned an invalid link. Please try again.')

      window.location.assign(checkoutUrl)
      return
    } catch (error) {
      console.error('[Zeni Paid Checkout] Checkout handoff failed', error)
      showError(error && error.message ? error.message : 'Secure checkout could not be opened. Please try again.')
    } finally {
      checkoutBusy = false
      setButtonBusy(button, false, originalHtml)
    }
  }
})()
