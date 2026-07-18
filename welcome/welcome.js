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

  function addNaturalCommandNote() {
    var commandList = document.querySelector('.cmd-details .cmd-list')
    if (!commandList || commandList.querySelector('.cmd-natural')) return

    var note = document.createElement('div')
    note.className = 'cmd-natural'
    note.setAttribute('role', 'note')

    var title = document.createElement('span')
    title.className = 'cmd-natural-title'
    title.textContent = 'Say it naturally'

    var copy = document.createElement('span')
    copy.className = 'cmd-natural-copy'
    copy.textContent = 'You don’t need to memorize exact commands. Say things like “skip this,” “pause here,” “go back,” or “I already did this,” and I’ll understand.'

    note.appendChild(title)
    note.appendChild(copy)
    commandList.appendChild(note)
  }

  function polishWelcomePage() {
    var warningCopy = document.querySelector('.warn span:last-child')
    if (warningCopy && warningCopy.innerHTML.indexOf('Just message') !== -1) {
      warningCopy.innerHTML = warningCopy.innerHTML.replace('Just message', 'Just WhatsApp')
    }

    var style = document.createElement('style')
    style.textContent = [
      '.price-row{flex-wrap:nowrap}',
      '.price-row .price-new{order:1}',
      '.price-row .price-old{order:2;margin-left:4px}',
      '.price-row .price-mo{order:3}',
      '.cmd-natural{margin-top:2px;padding-top:14px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:3px}',
      '.cmd-natural-title{font-size:12.5px;font-weight:700;color:var(--ink2)}',
      '.cmd-natural-copy{font-size:12px;color:var(--faint);line-height:1.6;max-width:600px}'
    ].join('')
    document.head.appendChild(style)

    addNaturalCommandNote()
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

  polishWelcomePage()
  alignFirstMessagePreview()
  loadPersonalization()
})()
