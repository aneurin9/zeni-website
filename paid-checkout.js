(function () {
  'use strict'

  var checkoutRequestId = ''
  var submittedFingerprint = ''
  var checkoutHasSubmitted = false
  var checkoutBusy = false

  function createRequestId() {
    var cryptoApi = window.crypto
    if (!cryptoApi || typeof cryptoApi.getRandomValues !== 'function') {
      throw new Error('Secure browser randomness is unavailable')
    }

    var bytes = new Uint8Array(24)
    cryptoApi.getRandomValues(bytes)
    var value = ''
    for (var i = 0; i < bytes.length; i++) {
      value += bytes[i].toString(16).padStart(2, '0')
    }
    return 'zeni_' + value
  }

  function beginCheckoutAttempt() {
    checkoutRequestId = ''
    submittedFingerprint = ''
    checkoutHasSubmitted = false
    checkoutBusy = false
    clearError()

    try {
      checkoutRequestId = createRequestId()
    } catch (error) {
      console.error('[Zeni Paid Checkout] Could not prepare request ID', error)
    }
  }

  function invalidateCheckoutAttempt() {
    checkoutRequestId = ''
    submittedFingerprint = ''
    checkoutHasSubmitted = false
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
      button.textContent = 'Opening secure checkout…'
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

  function responseMessage(response, payload) {
    var backendError = String(payload && payload.error || '')

    if (response.status === 400 || response.status === 413 || response.status === 415) {
      return 'Please check your signup details before continuing.'
    }

    if (response.status === 403) {
      return 'Checkout isn’t available from this page. Please refresh and try again.'
    }

    if (response.status === 409 && backendError === 'active subscription already exists') {
      return 'This WhatsApp number already has an active Zeni subscription. Contact support if you need help accessing it.'
    }

    if (response.status === 409 && backendError === 'existing subscription requires support') {
      return 'This WhatsApp number already has a Stripe subscription that needs attention. Contact support and we’ll help you continue safely.'
    }

    if (response.status === 409) {
      invalidateCheckoutAttempt()
      return 'This checkout attempt can’t continue. Please try again. If the issue continues, contact support.'
    }

    if (response.status === 429) {
      return 'There have been several checkout attempts. Please wait a little and try again.'
    }

    return 'Checkout couldn’t be opened right now. Please try again. If the issue continues, contact support.'
  }

  window.runPaidCheckout = async function runPaidCheckout() {
    if (checkoutBusy) return

    var data = window.gsData || {}
    var phone = canonicalPhone()
    var province = String(data.province || '').trim().toUpperCase()
    var plan = String(data.plan || '').trim().toLowerCase()
    var firstName = String(data.name || '').trim()
    var fingerprint = currentFingerprint()
    var button = document.getElementById('gsNext')
    var originalHtml = button ? button.innerHTML : ''
    var redirecting = false

    clearError()

    if (!firstName || ['ON', 'BC', 'AB'].indexOf(province) === -1 || ['core', 'premium'].indexOf(plan) === -1 || !/^1\d{10}$/.test(phone)) {
      showError('Please check your signup details before continuing.')
      return
    }

    try {
      if (!checkoutRequestId || (checkoutHasSubmitted && submittedFingerprint !== fingerprint)) {
        checkoutRequestId = createRequestId()
      }
    } catch (error) {
      console.error('[Zeni Paid Checkout] Could not create request ID', error)
      showError('Checkout couldn’t be opened securely in this browser. Please refresh and try again.')
      return
    }

    submittedFingerprint = fingerprint
    checkoutHasSubmitted = true
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
          firstName: firstName,
          whatsappNumber: phone,
          province: province,
          plan: plan
        })
      })

      var payload = {}
      try {
        payload = await response.json()
      } catch (_) {
        payload = {}
      }

      if (!response.ok) {
        showError(responseMessage(response, payload))
        return
      }

      var checkoutUrl = safeStripeCheckoutUrl(payload.url)
      if (!checkoutUrl) {
        showError('Checkout returned an invalid secure link. Please try again.')
        return
      }

      redirecting = true
      window.location.assign(checkoutUrl)
    } catch (error) {
      console.error('[Zeni Paid Checkout] Checkout handoff failed', error)
      showError('Checkout couldn’t be opened right now. Please try again. If the issue continues, contact support.')
    } finally {
      if (!redirecting) {
        checkoutBusy = false
        setButtonBusy(button, false, originalHtml)
      }
    }
  }

  var originalOpenGetStarted = window.openGetStarted
  if (typeof originalOpenGetStarted === 'function') {
    window.openGetStarted = function openGetStartedWithCheckout(presetPlan) {
      beginCheckoutAttempt()
      return originalOpenGetStarted(presetPlan)
    }
  }

  window.gsBeginCheckoutAttempt = beginCheckoutAttempt
})()
