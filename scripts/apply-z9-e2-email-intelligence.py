from pathlib import Path


BRANCH = 'agent/adopt-z9-e2-public-email-intelligence-copy-20260730'
HOME_MARKER = '<!-- Z9-E2 Email Intelligence capability -->'
PRIVACY_MARKER = '<!-- Z9-E2 Email Intelligence privacy -->'
TERMS_MARKER = '<!-- Z9-E2 Email Intelligence terms -->'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one anchor, found {count}')
    return text.replace(old, new, 1)


def verify_once(text: str, marker: str, label: str) -> None:
    count = text.count(marker)
    if count != 1:
        raise SystemExit(f'{label}: expected one generated marker, found {count}')


# Homepage outcome block -----------------------------------------------------
home_path = Path('index.html')
home = home_path.read_text()

home_css = '''
  /* Z9-E2 Email Intelligence capability */
  .email-relief-shell{display:grid;grid-template-columns:.86fr 1.14fr;gap:28px;align-items:stretch;background:linear-gradient(145deg,rgba(255,255,255,.78),rgba(244,241,255,.7));border:1px solid rgba(255,255,255,.88);border-radius:26px;padding:30px;box-shadow:var(--shadow);backdrop-filter:blur(18px) saturate(1.2);-webkit-backdrop-filter:blur(18px) saturate(1.2)}
  .email-relief-copy{padding:8px 4px}.email-relief-copy h2{font-size:clamp(28px,4vw,42px);line-height:1.08;letter-spacing:-1.1px;margin:10px 0 14px}.email-relief-copy>p{font-size:16px;color:var(--ink2);max-width:500px}.email-relief-note{display:inline-flex;margin-top:18px;padding:7px 11px;border-radius:10px;background:rgba(123,97,255,.08);color:var(--muted);font-size:12.5px;font-weight:600}
  .email-relief-list{display:grid;grid-template-columns:1fr 1fr;gap:12px}.email-relief-item{background:#fff;border:1px solid var(--line2);border-radius:16px;padding:17px;box-shadow:var(--shadow-sm)}.email-relief-item strong{display:block;font-size:14px;line-height:1.35;margin-bottom:5px}.email-relief-item span{display:block;font-size:12.8px;line-height:1.5;color:var(--muted)}
  @media(max-width:760px){.email-relief-shell{grid-template-columns:1fr;padding:22px}.email-relief-list{grid-template-columns:1fr}}
'''

home_section = '''
<!-- Z9-E2 Email Intelligence capability -->
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

if HOME_MARKER not in home:
    home = replace_once(home, '</style>', home_css + '</style>', 'homepage CSS anchor')
    home = replace_once(
        home,
        '<section class="section" id="pricing">',
        home_section + '<section class="section" id="pricing">',
        'homepage pricing anchor',
    )

verify_once(home, HOME_MARKER, 'homepage')
if home.count('Your business inbox stops becoming another job.') != 1:
    raise SystemExit('Homepage outcome heading must appear exactly once')
if 'Connect Zoho Mail with read-only access' in home:
    raise SystemExit('Homepage must not lead with technical connection language')
if '<summary>Email Intelligence' in home:
    raise SystemExit('No Email Intelligence FAQ is permitted')
home_path.write_text(home)


# Privacy disclosure --------------------------------------------------------
privacy_path = Path('privacy/index.html')
privacy = privacy_path.read_text()

privacy_toc = '        <li><a href="#p-email">Optional business-email connection</a></li>\n'
privacy_section = '''
      <!-- Z9-E2 Email Intelligence privacy -->
      <section id="p-email">
        <h2><span>Optional feature</span>Business-email connection</h2>

        <p>
          If you choose to connect a Zoho business-email account, Zeni uses
          permission to read the account details, folders, and messages needed
          to help you find and understand business email from WhatsApp. This
          feature is optional. You can continue using the rest of Zeni without
          connecting email.
        </p>

        <p>
          Zeni does not request permission to send, delete, archive, move,
          label, mark as read or unread, report as spam, or otherwise change
          email in Zoho Mail. Draft replies remain in WhatsApp for your review;
          Zeni does not send them through Zoho.
        </p>

        <h3>Content processed and information retained</h3>
        <p>
          When needed to answer your request, Zeni may temporarily process
          message content and attachments, including invoices, PDFs, and
          screenshots. Raw message bodies and attachment files are not stored
          permanently by default. Zeni may retain limited message metadata,
          derived summaries or insights, source references, synchronization
          state, and audit records needed to provide and protect the feature.
        </p>

        <h3>Confirmation before permanent business actions</h3>
        <p>
          Email messages and attachments are treated as untrusted evidence.
          An email cannot authorize a payment, filing, record change, document
          save, or other business action in Zeni. Zeni requires confirmation
          through WhatsApp before saving or linking authoritative business
          records, contacts, tasks, reminders, notes, or documents.
        </p>

        <h3>Your controls</h3>
        <p>
          You can pause email processing, reconnect when permission expires,
          disconnect the Zoho account, and request deletion of Email
          Intelligence data created by Zeni. Disconnecting or deleting Zeni's
          derived data does not delete or change email in Zoho and does not
          remove separately confirmed Zeni business records.
        </p>
      </section>

'''

if PRIVACY_MARKER not in privacy:
    privacy = replace_once(
        privacy,
        '        <li><a href="#p6">Human access to information</a></li>',
        privacy_toc + '        <li><a href="#p6">Human access to information</a></li>',
        'privacy TOC anchor',
    )
    privacy = replace_once(
        privacy,
        '      <section id="p6">',
        privacy_section + '      <section id="p6">',
        'privacy section anchor',
    )

verify_once(privacy, PRIVACY_MARKER, 'privacy')
for required in (
    'This feature is optional.',
    'does not request permission to send, delete, archive, move',
    'not stored permanently by default',
    'treated as untrusted evidence',
    'requires confirmation through WhatsApp',
    'pause email processing',
    'does not delete or change email in Zoho',
):
    if required not in privacy:
        raise SystemExit(f'Privacy disclosure missing: {required}')
privacy_path.write_text(privacy)


# Terms disclosure ----------------------------------------------------------
terms_path = Path('terms/index.html')
terms = terms_path.read_text()

terms_toc = '        <li><a href="#s-email">Optional Business-Email Integration</a></li>\n'
terms_section = '''
      <!-- Z9-E2 Email Intelligence terms -->
      <section id="s-email">
        <h2><span>Optional integration</span>Business Email</h2>

        <p>
          Zeni may offer an optional read-only integration with Zoho Mail. You
          must have authority to connect the mailbox and to permit Zeni to
          process its business-email content. Connecting email is not required
          to use the rest of the Service.
        </p>

        <p>
          The integration may retrieve account details, folders, messages, and,
          when needed, message content or attachments. Zeni is not authorized
          to send, delete, archive, move, label, mark, or otherwise modify mail
          in Zoho. Drafts prepared by Zeni remain drafts in WhatsApp unless you
          independently send them through an authorized channel.
        </p>

        <p>
          Email summaries, classifications, reminders, suggested links,
          extracted facts, and drafts may be incomplete, delayed, or incorrect.
          You are responsible for reviewing the source email and any attachment
          before acting. An email or attachment cannot authorize a payment,
          filing, record change, or other business action in Zeni.
        </p>

        <p>
          Availability may be interrupted by authorization changes, provider
          limits, outages, synchronization delays, safety controls, or the
          provider's own terms and systems. The Company does not guarantee that
          every important message will be identified or surfaced.
        </p>
      </section>

'''

if TERMS_MARKER not in terms:
    terms = replace_once(
        terms,
        '        <li><a href="#s3">Not Professional Advice</a></li>',
        terms_toc + '        <li><a href="#s3">Not Professional Advice</a></li>',
        'terms TOC anchor',
    )
    terms = replace_once(
        terms,
        '      <section id="s3">',
        terms_section + '      <section id="s3">',
        'terms section anchor',
    )

verify_once(terms, TERMS_MARKER, 'terms')
for required in (
    'optional read-only integration with Zoho Mail',
    'must have authority to connect the mailbox',
    'not authorized to send, delete, archive, move, label, mark',
    'cannot authorize a payment',
    'does not guarantee that every important message will be identified',
):
    if required not in terms:
        raise SystemExit(f'Terms disclosure missing: {required}')
terms_path.write_text(terms)

print(f'Applied guarded Z9-E2 Email Intelligence website patches for {BRANCH}')
