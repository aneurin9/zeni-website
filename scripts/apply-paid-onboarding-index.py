from pathlib import Path
import re

# One-time, marker-guarded source patch for the paid Checkout handoff.
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

path.write_text(text)
print('Applied guarded paid onboarding index patch')
