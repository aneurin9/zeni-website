(function () {
  'use strict'

  var SESSION_PATTERN = /^cs_(?:test|live)_[A-Za-z0-9_]+$/
  var MENU_OPTIONS = [
    {
      matches: ['See how Zeni works', 'Recommended: Walkthrough'],
      title: 'Recommended: Walkthrough',
      description: 'See how Zeni works'
    },
    {
      matches: ['Start a new business'],
      title: 'Start a new business',
      description: 'I’ll help you build the right foundation'
    },
    {
      matches: ['Grow my existing business', 'Grow existing business', 'Grow my business'],
      title: 'Grow my business',
      description: 'I’ll learn how it works and help you move it forward'
    },
    {
      matches: ['Explore a business idea'],
      title: 'Explore a business idea',
      description: 'We’ll think it through, step by step'
    }
  ]

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

  function findOption(title) {
    var clean = String(title || '').trim()
    return MENU_OPTIONS.find(function (option) {
      return option.matches.indexOf(clean) !== -1
    })
  }

  function alignMenuItems(container, itemSelector, titleSelector, descriptionSelector, insertBefore) {
    if (!container) return
    var indexed = {}

    Array.prototype.forEach.call(container.querySelectorAll(itemSelector), function (item) {
      var title = item.querySelector(titleSelector)
      var option = findOption(title && title.textContent)
      if (!option) return
      indexed[option.title] = item
      title.textContent = option.title
      var description = descriptionSelector ? item.querySelector(descriptionSelector) : null
      if (description) description.textContent = option.description
    })

    MENU_OPTIONS.forEach(function (option) {
      var item = indexed[option.title]
      if (item) container.insertBefore(item, insertBefore || null)
    })
  }

  function alignFirstMessagePreview() {
    var bubble = document.querySelector('.bub.in')
    if (bubble) {
      bubble.textContent = ''
      bubble.appendChild(document.createTextNode('Hi Marcus, I’m Zeni — your WhatsApp business operator.'))
      bubble.appendChild(document.createElement('br'))
      bubble.appendChild(document.createElement('br'))
      bubble.appendChild(document.createTextNode('I’ll help you build and run your business, one clear step at a time.'))
      bubble.appendChild(document.createElement('br'))
      bubble.appendChild(document.createElement('br'))
      bubble.appendChild(document.createTextNode('How would you like to get started?'))
    }

    var menuSheet = document.querySelector('.menu-sheet')
    var menuTap = menuSheet && menuSheet.querySelector('.menu-tap')
    alignMenuItems(menuSheet, '.menu-item', '.menu-item-title', '.menu-item-sub', menuTap)

    var menuCards = document.querySelector('.menu-cards')
    alignMenuItems(menuCards, '.menu-card', '.menu-card-title', null, null)
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
