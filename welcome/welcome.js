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

  function alignFirstMessagePreview() {
    var bubble = document.querySelector('.bub.in')
    if (bubble) {
      bubble.textContent = ''
      bubble.appendChild(document.createTextNode('Hi Marcus, I’m Zeni — your WhatsApp business operator.'))
      bubble.appendChild(document.createElement('br'))
      bubble.appendChild(document.createElement('br'))
      bubble.appendChild(document.createTextNode('Let’s get you into the right setup path.'))
      bubble.appendChild(document.createElement('br'))
      bubble.appendChild(document.createElement('br'))
      bubble.appendChild(document.createTextNode('Choose the closest option:'))
    }

    Array.prototype.forEach.call(document.querySelectorAll('.menu-item, .menu-card'), function (item) {
      var title = item.querySelector('.menu-item-title, .menu-card-title')
      if (title && title.textContent.trim() === 'See how Zeni works') item.remove()
    })
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

  alignFirstMessagePreview()
  loadPersonalization()
})()
