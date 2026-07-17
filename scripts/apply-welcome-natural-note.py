from html.parser import HTMLParser
from pathlib import Path
import re

path = Path("welcome/index.html")
text = path.read_text(encoding="utf-8")

css_anchor = '.cmd-when{font-size:12px;color:var(--faint);line-height:1.55}'
css_replacement = '''.cmd-when{font-size:12px;color:var(--faint);line-height:1.55}
.cmd-natural{margin-top:2px;padding-top:14px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:3px}
.cmd-natural-title{font-size:12.5px;font-weight:700;color:var(--ink2)}
.cmd-natural-copy{font-size:12px;color:var(--faint);line-height:1.6;max-width:600px}'''

html_anchor = '''        <div class="cmd-item">
          <span class="cmd-tag">"Get me unstuck"</span>
          <span class="cmd-what">I'll protect your place, work out the safest next step, and help you continue without starting over.</span>
          <span class="cmd-when">Use it only when something seems technically stuck, glitching, or unable to continue.</span>
        </div>
      </div>'''
html_replacement = '''        <div class="cmd-item">
          <span class="cmd-tag">"Get me unstuck"</span>
          <span class="cmd-what">I'll protect your place, work out the safest next step, and help you continue without starting over.</span>
          <span class="cmd-when">Use it only when something seems technically stuck, glitching, or unable to continue.</span>
        </div>
        <div class="cmd-natural" role="note">
          <span class="cmd-natural-title">Say it naturally</span>
          <span class="cmd-natural-copy">You don’t need to memorize exact commands. Say things like “skip this,” “pause here,” “go back,” or “I already did this,” and I’ll understand.</span>
        </div>
      </div>'''

for label, anchor in (("CSS", css_anchor), ("HTML", html_anchor)):
    count = text.count(anchor)
    if count != 1:
        raise SystemExit(f"Expected exactly one {label} anchor, found {count}")

if "cmd-natural" in text:
    raise SystemExit("Natural-language note already exists")

updated = text.replace(css_anchor, css_replacement, 1).replace(html_anchor, html_replacement, 1)

command_block = re.search(r'<details class="cmd-details">.*?</details>', updated, flags=re.S)
if not command_block:
    raise SystemExit("Handy commands block not found after patch")
block = command_block.group(0)

if block.count('<div class="cmd-item">') != 3:
    raise SystemExit("Handy commands must remain exactly three primary items")
if block.count('<div class="cmd-natural" role="note">') != 1:
    raise SystemExit("Expected exactly one secondary natural-language note")

for phrase in ("skip this", "pause here", "go back", "I already did this"):
    if phrase not in block:
        raise SystemExit(f"Missing natural-language example: {phrase}")

class StrictEnoughHTMLParser(HTMLParser):
    pass

StrictEnoughHTMLParser().feed(updated)
path.write_text(updated, encoding="utf-8")
print("Welcome natural-language note applied and validated.")
