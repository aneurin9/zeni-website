from pathlib import Path
import re

path = Path('index.html')
text = path.read_text()

text = text.replace('<script async src="https://js.stripe.com/v3/pricing-table.js"></script>\n', '')

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

checkout_script = '<script src="/paid-checkout.js"></script>\n'
if checkout_script not in text:
    if '</body>' not in text:
        raise SystemExit('Missing body close marker')
    text = text.replace('</body>', checkout_script + '</body>', 1)

for retired in ('stripe-pricing-table', 'pricing-table.js', 'id="stripe-modal"', 'function openStripe()'):
    if retired in text:
        raise SystemExit(f'Retired Stripe marker remains: {retired}')

if 'function gsRunCheckout()' not in text or 'gsRunCheckout();' not in text:
    raise SystemExit('Get Started checkout hook is missing')

path.write_text(text)
print('Applied guarded paid onboarding index patch')
