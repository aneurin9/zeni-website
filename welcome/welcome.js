(function () {
  'use strict'

  var SESSION_PATTERN = /^cs_(?:test|live)_[A-Za-z0-9_]+$/

  function safeFirstName(value) {
    var name = String(value || '').trim()
    return /^[\p{L}\p{M}'’\-]{1,40}$/u.test(name) ? name : ''
  }

  function personalize(firstName) {
    var heading = document.getElementById('welcome-title')
    if (!heading) return

    heading.textContent = ''
    heading.appendChild(document.createTextNode("You're in, "))
    var accent = document.createElement('span')
    accent.className = 'g'
    accent.textContent = firstName + '.'
    heading.appendChild(accent)
  }

  async function loadPersonalization() {
    var url = new URL(window.location.href)
    var sessionId = String(url.searchParams.get('checkout_session_id') || '').trim()
    window.history.replaceState({}, document.title, url.pathname + url.hash)
    if (!SESSION_PATTERN.test(sessionId)) return

    try {
      var response = await fetch('/api/welcome?checkout_session_id=' + encodeURIComponent(sessionId), {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store'
      })
      if (!response.ok) return
      var payload = await response.json()
      var firstName = safeFirstName(payload && payload.firstName)
      if (firstName) personalize(firstName)
    } catch (_) {
      // The generic welcome remains visible when verification is unavailable.
    }
  }

  loadPersonalization()
})()
