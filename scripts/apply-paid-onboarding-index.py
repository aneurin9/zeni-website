from pathlib import Path
import re

# Marker-guarded source patches for the signed paid Checkout handoff and welcome CTA.
path = Path('index.html')
text = path.read_text()

stripe_loader = '<script async src="https://js.stripe.com/v3/pricing-table.js"></script>\n'
text = text.replace(stripe_loader, '')

text, modal_count = re.subn(
    r'\n<div id="stripe-modal"[\s\S]*?</div>\n<nav>',
    '\n<nav>',
    text,
    count=1,
)
if modal_count not in (0, 1):
    raise SystemExit(f'Unexpected Stripe modal count: {modal_count}')

stripe_script = '''<script>
// Stripe modal
function openStripe(){document.getElementById('stripe-modal').style.display='block';document.body.style.overflow='hidden';}
function closeStripe(){document.getElementById('stripe-modal').style.display='none';document.body.style.overflow='';}
document.getElementById('stripe-close').addEventListener('click',closeStripe);
document.getElementById('stripe-modal').addEventListener('click',function(e){if(e.target===this)closeStripe();});
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeStripe();});
</script>
'''
text = text.replace(stripe_script, '')

old_checkout = '''function gsRunCheckout(){
  closeGS();
  openStripe();
}
'''
new_checkout = '''function gsRunCheckout(){
  if (typeof window.runPaidCheckout === 'function') {
    return window.runPaidCheckout();
  }
  var box=document.getElementById('gsBody');
  if(!box) return;
  var error=document.getElementById('gsCheckoutError');
  if(!error){
    error=document.createElement('p');
    error.id='gsCheckoutError';
    error.setAttribute('role','alert');
    error.style.cssText='display:block;margin:16px 0 0;padding:11px 13px;border-radius:11px;background:rgba(190,45,65,.08);border:1px solid rgba(190,45,65,.18);color:#9f2e43;font-size:13px;line-height:1.45;';
    box.appendChild(error);
  }
  error.textContent='Checkout couldn’t be opened right now. Please refresh and try again.';
}
'''
if old_checkout in text:
    text = text.replace(old_checkout, new_checkout, 1)
elif new_checkout not in text:
    raise SystemExit('Could not locate the Get Started checkout handoff')

# Preserve the latest main-branch keyboard behavior while this feature branch is merged.
enter_helper = '''function gsOnEnter(el, fn){
  if(!el) return;
  el.addEventListener('keydown', function(e){
    if(e.key==='Enter'){ e.preventDefault(); fn(); }
  });
}

'''
if enter_helper not in text:
    marker = 'function gsBindInputs(){\n'
    if marker not in text:
        raise SystemExit('Could not locate gsBindInputs for Enter-key support')
    text = text.replace(marker, enter_helper + marker, 1)

enter_bindings = (
    ("  if(n){ n.addEventListener('input', function(){ gsData.name=this.value; gsUpdateNextState(); }); n.focus(); }\n", "  if(n){ n.addEventListener('input', function(){ gsData.name=this.value; gsUpdateNextState(); }); n.focus(); }\n  gsOnEnter(n, gsNextClick);\n"),
    ("  if(ph){ ph.addEventListener('input', function(){ this.value=formatPhone(this.value); this.setSelectionRange(this.value.length,this.value.length); gsData.phone=this.value; gsUpdateNextState(); }); }\n", "  if(ph){ ph.addEventListener('input', function(){ this.value=formatPhone(this.value); this.setSelectionRange(this.value.length,this.value.length); gsData.phone=this.value; gsUpdateNextState(); }); }\n  gsOnEnter(ph, gsNextClick);\n"),
    ("  if(we){ we.addEventListener('input', function(){ gsData.waitlistEmail=this.value; gsHideWaitlistError(); }); }\n", "  if(we){ we.addEventListener('input', function(){ gsData.waitlistEmail=this.value; gsHideWaitlistError(); }); }\n  gsOnEnter(we, gsJoinWaitlist);\n"),
    ("  if(wp){ wp.addEventListener('input', function(){ gsData.waitlistProvince=this.value; }); }\n", "  if(wp){ wp.addEventListener('input', function(){ gsData.waitlistProvince=this.value; }); }\n  gsOnEnter(wp, gsJoinWaitlist);\n"),
)
for original, updated in enter_bindings:
    if updated not in text:
        if original not in text:
            raise SystemExit('Could not preserve Enter-key binding in Get Started flow')
        text = text.replace(original, updated, 1)

checkout_script = '<script src="/paid-checkout.js"></script>\n'
if checkout_script not in text:
    if '</body>' not in text:
        raise SystemExit('Missing body close marker')
    text = text.replace('</body>', checkout_script + '</body>', 1)

for retired in (
    'stripe-pricing-table',
    'pricing-table.js',
    'id="stripe-modal"',
    'function openStripe()',
    'openStripe();',
):
    if retired in text:
        raise SystemExit(f'Retired Stripe marker remains: {retired}')

if text.count(checkout_script) != 1:
    raise SystemExit('Paid checkout script must be included exactly once')
if 'function gsRunCheckout()' not in text or 'window.runPaidCheckout' not in text:
    raise SystemExit('Get Started checkout dispatcher is missing')
if 'function gsGreeting()' not in text:
    raise SystemExit('Latest personalized Get Started flow is missing')
if text.count('function gsOnEnter(el, fn)') != 1:
    raise SystemExit('Enter-key helper must appear exactly once')

path.write_text(text)

welcome_path = Path('welcome/index.html')
welcome = welcome_path.read_text()
welcome_cta = '''    <a href="https://wa.me/18683166361?text=Hi%20Zeni" target="_blank" rel="noopener" class="btn btn-primary" style="margin:2px 0 16px">Message Zeni on WhatsApp <span class="ic" data-ic="arrow"></span></a>\n'''
welcome_marker = '''    </div>\n    <div class="warn">\n'''
if welcome_cta not in welcome:
    if welcome.count(welcome_marker) != 1:
        raise SystemExit('Could not locate the welcome-page WhatsApp CTA marker')
    welcome = welcome.replace(welcome_marker, '    </div>\n' + welcome_cta + '    <div class="warn">\n', 1)

if welcome.count('https://wa.me/18683166361?text=Hi%20Zeni') != 1:
    raise SystemExit('Primary Zeni WhatsApp CTA must appear exactly once')
welcome_path.write_text(welcome)

print('Applied guarded paid onboarding website patches')
