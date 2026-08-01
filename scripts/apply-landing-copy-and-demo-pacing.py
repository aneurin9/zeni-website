from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one anchor, found {count}')
    return text.replace(old, new, 1)


home_path = Path('index.html')
home = home_path.read_text()

home = replace_once(
    home,
    'Works with the Zoho business email I help you set up.',
    'Works with the business email I help you set up.',
    'Inbox availability note',
)

old_sequence = """  var seq=[
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

new_sequence = """  var seq=[
    [0,function(){box.innerHTML='<div class=\"day\">Today</div>';}],
    [500,function(){add('<div class=\"bub in\">Good morning, Marcus. I\\'ve reviewed your business — here\\'s what needs attention today.<span class=\"t\">9:00</span></div>');}],
    [1800,function(){add(RLIST());}],
    [4300,function(){add('<div class=\"bub out\">What does Westline need?<span class=\"t\">9:01</span></div>');}],
    [5200,function(){simT=typing();}],
    [6900,function(){if(simT)simT.remove();add('<div class=\"bub in\">They need your final quantities by Friday. Their attached quote totals <b>USD $410</b>, and I\\'ve kept your last packaging order in context. Want me to draft a reply and prepare a reminder?<span class=\"t\">9:01</span></div>');}],
    [10100,function(){add('<div class=\"bub out\">Yes — tell them I\\'ll confirm tomorrow.<span class=\"t\">9:02</span></div>');}],
    [11000,function(){simT=typing();}],
    [12700,function(){if(simT)simT.remove();add('<div class=\"bub in\">Draft ready, and I\\'ve prepared a reminder for tomorrow at 9:00 AM. Nothing has been sent.<span class=\"t\">9:02</span></div>');}]
  ];"""

home = replace_once(home, old_sequence, new_sequence, 'See it in action sequence timing')
home = replace_once(
    home,
    'if(reduce){seq.forEach(function(s){if(s[0]!==4000&&s[0]!==7600)s[1]();});return;}',
    'if(reduce){seq.forEach(function(s){if(s[0]!==5200&&s[0]!==11000)s[1]();});return;}',
    'reduced-motion typing steps',
)
home = replace_once(
    home,
    'simTimers.push(setTimeout(playSim,11500));',
    'simTimers.push(setTimeout(playSim,17000));',
    'See it in action replay timing',
)

for required in (
    'Works with the business email I help you set up.',
    '[4300,function(){add(\'<div class="bub out">What does Westline need?',
    '[6900,function(){if(simT)simT.remove();add(\'<div class="bub in">They need your final quantities by Friday.',
    '[12700,function(){if(simT)simT.remove();add(\'<div class="bub in">Draft ready,',
    'setTimeout(playSim,17000)',
):
    if home.count(required) != 1:
        raise SystemExit(f'Landing polish contract missing or duplicated: {required}')

if 'Works with the Zoho business email I help you set up.' in home:
    raise SystemExit('Provider-specific Inbox availability note must not remain')

home_path.write_text(home)
