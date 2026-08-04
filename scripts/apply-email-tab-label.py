from pathlib import Path


path = Path('index.html')
html = path.read_text()

old_label = "tab:'Inbox'"
new_label = "tab:'Emails'"

if html.count(old_label) != 1:
    raise SystemExit(
        f'Email outcome tab label: expected exactly one {old_label!r}, '
        f'found {html.count(old_label)}'
    )
if new_label in html:
    raise SystemExit(f'Email outcome tab label already contains {new_label!r}')

html = html.replace(old_label, new_label, 1)

if html.count(new_label) != 1 or old_label in html:
    raise SystemExit('Email outcome tab label replacement did not complete cleanly')

path.write_text(html)
