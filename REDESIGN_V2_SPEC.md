# Zeni Website Redesign V2 — Approved Interaction Spec

## Locked visual direction

- Hero concept: Option A — Glass Horizon
- Visual tone: light, calm, human, premium, intelligent
- Palette: pearl white, pale lavender, mist blue, restrained pink-violet accents, deep ink typography
- Use Liquid Glass selectively for navigation, phone frame, floating activity cards, walkthrough container and conversion controls
- Keep the trust line: “Trusted by Canadian founders and small business owners”
- Do not show ratings, review stars or platform logos until verified ratings exist

## Hero copy

Eyebrow:

> Hello, I’m Zeni.

Headline:

> Your business operator, in WhatsApp.

Supporting copy:

> I’ll guide you through setting up your Canadian business, then keep the details moving—money, invoices, deadlines, documents and what needs attention next.

Trust points:

- Built for first-time founders
- Canada first, U.S. when you’re ready
- No new software to learn

Primary CTA:

> Get started with Zeni

Secondary CTA:

> See how Zeni works

## Hero motion loop

Build this as a lightweight coded animation rather than a prerecorded video so it stays crisp, responsive and accessible.

Target duration: 10–11 seconds

### 0.0–1.0 seconds — Calm opening

- Phone frame is already visible
- Soft horizon lighting moves very slightly
- WhatsApp header reads “Zeni — Business Operator”
- No abrupt entrance or oversized decorative orb

### 1.0–2.8 seconds — Morning review

Zeni message appears with a short typing indicator:

> Good morning, Marcus.  
> I reviewed your business.  
> Here’s what needs attention today.

### 2.8–5.2 seconds — Priorities appear

Rows enter one at a time:

1. Overdue invoice  
   INV-10042 · CAD $1,200
2. Annual return due in 21 days  
   Ontario Corporation
3. Receipt ready to log  
   Office supplies · CAD $64.20

### 5.2–7.8 seconds — Floating activity proof

No more than three activity cards appear around the phone:

- Invoice draft ready — CAD $800 — Ready for review
- Reminder scheduled — Friday, 9:00 AM — Annual return
- Receipt logged — CAD $64.20 — Office supplies

The cards use slow staggered movement and remain inside the hero container.

### 7.8–9.3 seconds — Founder response

User bubble appears:

> Thanks Zeni. What should I focus on first?

The overdue invoice row receives a restrained highlight.

### 9.3–10.8 seconds — Resolution and loop

Zeni response:

> Start with the overdue invoice. I have the follow-up ready for you to review.

The visual holds briefly, then resets through a soft crossfade.

### Hero motion requirements

- Silent autoplay
- Seamless loop
- No visible player controls
- No more than three floating cards at once
- Pause decorative motion when the tab is hidden
- `prefers-reduced-motion` fallback showing the final useful state without looping
- Simplified mobile version using the phone plus one activity card at a time
- Do not imply an invoice was sent without approval

## Interactive walkthrough

The walkthrough is a real clickable WhatsApp-style interaction, not a video, slide deck or dashboard tour.

### Opening screen

Heading:

> Hi, I’m Zeni. How can I help you today?

Display the four real entry choices:

1. Start a new business
2. Grow my existing business
3. Explore a business idea
4. See how Zeni works

“See how Zeni works” is gently highlighted and labelled “Recommended for this preview.”

The other three cards remain visible for product truth, but the preview follows one focused route only. They do not open separate demo branches.

## Guided chat sequence

Estimated continuous completion time: 60–75 seconds

### Step 1 — Priorities

Suggested visitor message:

> What should I focus on today?

Zeni types:

> Three things matter today. Start with the overdue invoice. Your annual return is due in 21 days, and website payments can wait until tomorrow.

Show a compact priority result with:

- Overdue invoice — first
- Annual return — upcoming
- Website payments — tomorrow

### Step 2 — Invoice context

Suggested visitor message:

> Show me the overdue invoice.

Zeni displays:

- Invoice: INV-10042
- Client: Sarah Mitchell
- Amount: CAD $1,200
- Status: 12 days overdue

Zeni says:

> This invoice is 12 days overdue. I can prepare a polite follow-up using the saved invoice details.

### Step 3 — Prepare the action

Suggested visitor message:

> Prepare the follow-up.

Zeni types:

> I drafted the follow-up for you to review. Nothing will be sent until you approve it.

Show message preview:

> Hi Sarah, just following up on invoice INV-10042 for CAD $1,200, which is now overdue. Please let me know if you need another copy or have any questions. Thank you.

Controls:

- Review draft
- Set a 7-day reminder

If the visitor chooses the reminder:

> Done. I’ll remind you in seven days if the invoice is still unpaid.

### Step 4 — Receipt handling

A receipt image enters the conversation.

Suggested visitor message:

> Log this receipt.

Zeni types:

> Logged — Office supplies, CAD $64.20. I added it to this month’s expenses and stored the receipt.

Show a compact saved record with category, amount and date.

### Step 5 — Memory and continuity

Suggested visitor message:

> What do you remember about my business?

Zeni displays:

- Ontario corporation
- Stripe Canada connected
- Current priority: overdue invoice
- Annual return due in 21 days
- U.S. expansion saved for later

Zeni concludes:

> You do not need to explain the business again. I’ll continue from where we left off.

### Walkthrough ending

Closing line:

> You build the business. I’ll keep the next step clear.

Primary CTA:

> Get started with Zeni

Secondary action:

> Restart demo

## Walkthrough interaction requirements

- No sidebar
- No chapter menu
- No independent optional branches
- One suggested message at a time
- Visitor choice appears as a WhatsApp bubble
- Short typing indicator before each Zeni reply
- Compact results appear inside the conversation
- Keyboard-operable controls
- Visible focus states
- `aria-live` region for newly inserted chat messages
- Reduced-motion mode keeps the sequence functional without animated typing
- On mobile, the demo becomes one full-width phone-like conversation with controls directly below it

## Implementation safety

- Work only on `website-redesign-v2`
- Do not merge or deploy without explicit approval
- Preserve current Stripe IDs and legal links
- Validate desktop, tablet and mobile
- Check clipping, overflow, keyboard use and reduced-motion behaviour
- Produce preview screenshots before any production integration
