from pathlib import Path


PATCH_MARKER = '<!-- Z9-E3 Integrated Inbox experience -->'
LEGACY_HOME_MARKER = '<!-- Z9-E2 Email Intelligence capability -->'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one anchor, found {count}')
    return text.replace(old, new, 1)


def remove_once_if_present(text: str, value: str, label: str) -> str:
    count = text.count(value)
    if count > 1:
        raise SystemExit(f'{label}: expected at most one legacy block, found {count}')
    return text.replace(value, '', 1) if count == 1 else text


home_path = Path('index.html')
home = home_path.read_text()

legacy_css = '''  /* Z9-E2 Email Intelligence capability */
  .email-relief-shell{display:grid;grid-template-columns:.86fr 1.14fr;gap:28px;align-items:stretch;background:linear-gradient(145deg,rgba(255,255,255,.78),rgba(244,241,255,.7));border:1px solid rgba(255,255,255,.88);border-radius:26px;padding:30px;box-shadow:var(--shadow);backdrop-filter:blur(18px) saturate(1.2);-webkit-backdrop-filter:blur(18px) saturate(1.2)}
  .email-relief-copy{padding:8px 4px}.email-relief-copy h2{font-size:clamp(28px,4vw,42px);line-height:1.08;letter-spacing:-1.1px;margin:10px 0 14px}.email-relief-copy>p{font-size:16px;color:var(--ink2);max-width:500px}.email-relief-note{display:inline-flex;margin-top:18px;padding:7px 11px;border-radius:10px;background:rgba(123,97,255,.08);color:var(--muted);font-size:12.5px;font-weight:600}
  .email-relief-list{display:grid;grid-template-columns:1fr 1fr;gap:12px}.email-relief-item{background:#fff;border:1px solid var(--line2);border-radius:16px;padding:17px;box-shadow:var(--shadow-sm)}.email-relief-item strong{display:block;font-size:14px;line-height:1.35;margin-bottom:5px}.email-relief-item span{display:block;font-size:12.8px;line-height:1.5;color:var(--muted)}
  @media(max-width:760px){.email-relief-shell{grid-template-columns:1fr;padding:22px}.email-relief-list{grid-template-columns:1fr}}
'''

legacy_section = '''<!-- Z9-E2 Email Intelligence capability -->
<section class="section" id="inbox" style="padding-top:0">
  <div class="wrap">
    <div class="email-relief-shell">
      <div class="email-relief-copy">
        <div class="sec-eye">Inbox</div>
        <h2>Your business inbox stops becoming another job.</h2>
        <p>Important messages become clear next steps—without leaving WhatsApp.</p>
        <span class="email-relief-note">Works with the business email Zeni helps you set up.</span>
      </div>
      <div class="email-relief-list">
        <div class="email-relief-item"><strong>Customer and supplier emails, summarized</strong><span>See what matters without reading every thread from the beginning.</span></div>
        <div class="email-relief-item"><strong>Invoices, renewals and deadlines caught early</strong><span>Important dates and attached business documents become easier to act on.</span></div>
        <div class="email-relief-item"><strong>Replies drafted with your business context</strong><span>Prepare the response in WhatsApp, review it, then decide what happens next.</span></div>
        <div class="email-relief-item"><strong>Confirmed next steps kept together</strong><span>Turn important email details into approved tasks, reminders and saved documents.</span></div>
      </div>
    </div>
  </div>
</section>

'''

# Remove the earlier standalone homepage treatment after the E2 legal/copy patch runs.
home = remove_once_if_present(home, legacy_css, 'legacy Inbox CSS')
home = remove_once_if_present(home, legacy_section, 'legacy Inbox section')

if PATCH_MARKER not in home:
    home = replace_once(
        home,
        '<section class="section" id="handles">',
        PATCH_MARKER + '\n<section class="section" id="handles">',
        'integrated Inbox marker anchor',
    )

    home = replace_once(
        home,
        '  .outcome-note b{color:var(--ink2)}\n',
        '  .outcome-note b{color:var(--ink2)}\n'
        '  .oc-note{margin-top:16px;color:var(--muted);font-size:12px;font-weight:600}\n',
        'outcome availability-note CSS anchor',
    )

    home = replace_once(
        home,
        "      'Invoices, receipts and reminders — handled',",
        "      'Money, inbox and follow-ups watched',",
        'daily chapter outcome copy',
    )
    home = replace_once(
        home,
        "      ['receipt','Receipt to review','Office supplies · $64.20']",
        "      ['chat','Supplier reply needed','Westline Packaging · waiting 2 days']",
        'daily chapter visual',
    )

    home = replace_once(
        home,
        "        feat('sun','Every day',['Automatic morning briefing','Reminders that reach you','Tasks &amp; day planner','Client &amp; contact lookup','Weekly &amp; monthly reviews','Shipment tracking'])+",
        "        feat('sun','Every day',['Automatic Morning Brief','Important business emails surfaced','Tasks, reminders &amp; day planning','Customer &amp; supplier follow-ups','Weekly &amp; monthly reviews','Shipment tracking'])+",
        'How Zeni works Every day card',
    )
    home = replace_once(
        home,
        "        feat('doc','Documents &amp; drafts',['Service agreements &amp; NDAs','Proposals &amp; contracts','Late-payment notices','Emails &amp; messages','Receipt &amp; PDF reader'])+",
        "        feat('doc','Inbox, documents &amp; drafts',['Business email searched &amp; summarized','Replies drafted using your business context','Invoices, PDFs &amp; attachments understood','Contracts, proposals &amp; notices drafted','Nothing sent without your approval'])+",
        'How Zeni works Inbox card',
    )

    daily_outcome = """  { id:'daily', ic:'sun', tab:'Every day', title:'Start each day already knowing what matters.', sub:'No more wondering what you’re forgetting.',
    items:['A morning briefing, automatic, every day','Reminders that actually reach you, on WhatsApp','Your day and tasks, planned without an app to open','Clients and contacts, one message away'] },"""
    inbox_outcome = daily_outcome + """
  { id:'inbox', ic:'chat', tab:'Inbox', title:'Your business inbox stops becoming another job.', sub:'I surface what matters and turn it into the next step — without making you leave WhatsApp.',
    items:['Customer and supplier emails, summarized','Invoices, renewals and deadlines caught early','Replies drafted with the context of your business','Important emails turned into approved tasks, reminders and saved documents'],
    note:'Works with the Zoho business email I help you set up.' },"""
    home = replace_once(home, daily_outcome, inbox_outcome, 'Inbox outcome tab')

    old_outcome_renderer = """  panel.innerHTML =
    '<div class=\"oc-head\"><div class=\"oc-ic\">'+ICONS[o.ic]+'</div><div><h3>'+o.title+'</h3><p>'+o.sub+'</p></div></div>'+
    '<ul class=\"oc-list\">'+o.items.map(function(it){return '<li><span class=\"ic\" data-ic=\"check\"></span><span>'+it+'</span></li>';}).join('')+'</ul>';"""
    new_outcome_renderer = """  panel.innerHTML =
    '<div class=\"oc-head\"><div class=\"oc-ic\">'+ICONS[o.ic]+'</div><div><h3>'+o.title+'</h3><p>'+o.sub+'</p></div></div>'+
    '<ul class=\"oc-list\">'+o.items.map(function(it){return '<li><span class=\"ic\" data-ic=\"check\"></span><span>'+it+'</span></li>';}).join('')+'</ul>'+
    (o.note?'<p class=\"oc-note\">'+o.note+'</p>':'');"""
    home = replace_once(home, old_outcome_renderer, new_outcome_renderer, 'outcome note renderer')

    home = replace_once(
        home,
        "    return '<div class=\"wt-eye\">See it in action</div><div class=\"wt-title\">A real morning with Zeni.</div>'+\n      '<p class=\"wt-sub\">You ask in plain language. I answer, and I prepare the next step — you stay in control.</p>'+",
        "    return '<div class=\"wt-eye\">See it in action</div><div class=\"wt-title\">One message becomes the next step.</div>'+\n      '<p class=\"wt-sub\">You ask in plain language. I connect the context, prepare the work, and leave the decision with you.</p>'+",
        'See it in action heading',
    )
    home = replace_once(
        home,
        "      '<p class=\"sim-cap\">Zeni drafts and prepares — nothing is sent until you approve.</p>';",
        "      '<p class=\"sim-cap\">I prepare the work. Nothing is sent until you approve.</p>';",
        'See it in action first-person caption',
    )

    old_rlist = """function RLIST(){return '<div class=\"rlist\">\\
  <div class=\"ritem\"><div class=\"ri\">'+ICONS.dollar+'</div><div><div class=\"rt\">1 overdue invoice</div><div class=\"rs tnum\">INV-1042 &middot; CAD $1,200</div></div></div>\\
  <div class=\"ritem\"><div class=\"ri\">'+ICONS.calendar+'</div><div><div class=\"rt\">Annual return due in 21 days</div><div class=\"rs\">Ontario Corporation</div></div></div>\\
  <div class=\"ritem\"><div class=\"ri\">'+ICONS.receipt+'</div><div><div class=\"rt\">Receipt to review</div><div class=\"rs tnum\">Office supplies &middot; $64.20</div></div></div></div>';}"""
    new_rlist = """function RLIST(){return '<div class=\"rlist\">\\
  <div class=\"ritem\"><div class=\"ri\">'+ICONS.dollar+'</div><div><div class=\"rt\">1 overdue invoice</div><div class=\"rs tnum\">INV-1042 &middot; CAD $1,200</div></div></div>\\
  <div class=\"ritem\"><div class=\"ri\">'+ICONS.calendar+'</div><div><div class=\"rt\">Annual return due in 21 days</div><div class=\"rs\">Ontario Corporation</div></div></div>\\
  <div class=\"ritem\"><div class=\"ri\">'+ICONS.chat+'</div><div><div class=\"rt\">Supplier reply needed</div><div class=\"rs\">Westline Packaging &middot; waiting 2 days</div></div></div></div>';}"""
    home = replace_once(home, old_rlist, new_rlist, 'morning briefing visual list')

    old_sequence = """  var seq=[
    [0,function(){box.innerHTML='<div class=\"day\">Today</div>';}],
    [400,function(){add('<div class=\"bub in\">Good morning, Marcus. I\\'ve reviewed your business — here\\'s what needs attention today.<span class=\"t\">9:00</span></div>');}],
    [1500,function(){add(RLIST());}],
    [3300,function(){add('<div class=\"bub out\">What should I focus on first?<span class=\"t\">9:01</span></div>');}],
    [4000,function(){simT=typing();}],
    [5300,function(){if(simT)simT.remove();add('<div class=\"bub in\">Start with the overdue invoice — <b>INV-1042, $1,200</b>, now 9 days late. Want me to prepare a follow-up?<span class=\"t\">9:01</span></div>');}],
    [7000,function(){add('<div class=\"bub out\">Yes please.<span class=\"t\">9:02</span></div>');}],
    [7600,function(){simT=typing();}],
    [9100,function(){if(simT)simT.remove();add('<div class=\"bub in\">Done. I\\'ve drafted a polite follow-up for you to review, and I\\'ll remind you in 7 days if it\\'s still unpaid.<span class=\"t\">9:02</span></div>');}]
  ];"""
    new_sequence = """  var seq=[
    [0,function(){box.innerHTML='<div class=\"day\">Today</div>';}],
    [400,function(){add('<div class=\"bub in\">Good morning, Marcus. I\\'ve reviewed your business — here\\'s what needs attention today.<span class=\"t\">9:00</span></div>');}],
    [1500,function(){add(RLIST());}],
    [3300,function(){add('<div class=\"bub out\">What does Westline need?<span class=\"t\">9:01</span></div>');}],
    [4000,function(){simT=typing();}],
    [5400,function(){if(simT)simT.remove();add('<div class=\"bub in\">They need your final quantities by Friday. Their attached quote totals <b>USD $410</b>, and I\\'ve kept your last packaging order in context. Want me to draft a reply and prepare a reminder?<span class=\"t\">9:01</span></div>');}],
    [7600,function(){add('<div class=\"bub out\">Yes — tell them I\\'ll confirm tomorrow.<span class=\"t\">9:02</span></div>');}],
    [8300,function(){simT=typing();}],
    [9800,function(){if(simT)simT.remove();add('<div class=\"bub in\">Draft ready, and I\\'ve prepared a reminder for tomorrow at 9:00 AM. Nothing has been sent.<span class=\"t\">9:02</span></div>');}]
  ];"""
    home = replace_once(home, old_sequence, new_sequence, 'connected Inbox demo sequence')

# Final contract checks. These protect the lean information hierarchy and first-person voice.
if home.count(PATCH_MARKER) != 1:
    raise SystemExit('Integrated Inbox marker must appear exactly once')
if LEGACY_HOME_MARKER in home or '<section class="section" id="inbox"' in home:
    raise SystemExit('Standalone Inbox section must not remain')
for required in (
    "tab:'Inbox'",
    'Your business inbox stops becoming another job.',
    'I surface what matters and turn it into the next step',
    'Works with the Zoho business email I help you set up.',
    'Inbox, documents &amp; drafts',
    'Important business emails surfaced',
    'What does Westline need?',
    'Nothing has been sent.',
):
    if home.count(required) != 1:
        raise SystemExit(f'Homepage integrated Inbox contract missing or duplicated: {required}')
if home.count('Supplier reply needed') != 2:
    raise SystemExit('Supplier reply visual must appear exactly twice')
for prohibited in (
    'Documents &amp; drafts',
    'Receipt to review',
    'Works with the business email Zeni helps you set up.',
):
    if prohibited in home:
        raise SystemExit(f'Homepage still contains superseded copy: {prohibited}')

home_path.write_text(home)
print('Applied integrated Inbox outcome and connected demo experience')
