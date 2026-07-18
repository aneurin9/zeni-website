from pathlib import Path
import os
import subprocess

WORKFLOW_NAME = "Apply paid onboarding website patches"

if os.environ.get("GITHUB_WORKFLOW") != WORKFLOW_NAME:
    print("Fair-use branch helper is inactive outside the trusted write workflow")
    raise SystemExit(0)

terms_path = Path("terms/index.html")
text = terms_path.read_text(encoding="utf-8")
heading = "<h3>Fair Use and Service Limits</h3>"
block = '''        <h3>Fair Use and Service Limits</h3>
        <p>
          Zeni is designed for natural, day-to-day use by an individual business
          operator. To protect customer accounts and keep the Service secure,
          reliable, and available, the Company may apply reasonable usage
          limits, rate limits, feature allowances, or temporary pauses when
          activity is unusually intensive, automated, abusive, technically
          abnormal, or creates a risk to the Service or other users.
        </p>
        <p>
          Certain features, including live web verification, may have monthly
          allowances. Reaching a feature allowance will ordinarily affect only
          that feature, and the rest of Zeni will remain available. These
          controls are intended to prevent misuse and technical instability,
          not to restrict normal day-to-day use.
        </p>
        <p>
          The Company may reasonably adjust protective limits as security risks,
          third-party provider requirements, technical capacity, or the Service
          change. Where reasonably practicable, Zeni will explain a temporary
          pause and when normal use can resume.
        </p>

'''

if heading not in text:
    section_start = text.index('<section id="s9">')
    marker = "        <h3>Prohibited Conduct</h3>"
    insert_at = text.index(marker, section_start)
    text = text[:insert_at] + block + text[insert_at:]

if text.count(heading) != 1:
    raise SystemExit("Expected exactly one Fair Use and Service Limits heading")
if "may have monthly allowances communicated during purchase" in text:
    raise SystemExit("Disallowed purchase-communication sentence is present")
if "If a material change would affect ordinary use of a paid plan" in text:
    raise SystemExit("Disallowed material-change sentence is present")

terms_path.write_text(text, encoding="utf-8")

for temporary_path in (
    Path("terms/fair-use-and-service-limits.html"),
    Path(".github/workflows/insert-fair-use.yml"),
):
    if temporary_path.exists():
        temporary_path.unlink()

welcome = Path("welcome/welcome.js").read_text(encoding="utf-8")
for required in (
    ".price-row{flex-wrap:nowrap}",
    ".price-row .price-old{order:2;margin-left:4px}",
    ".price-row .price-mo{order:3}",
):
    if required not in welcome:
        raise SystemExit(f"Missing approved mobile price rule: {required}")
if "Founding rate" in welcome:
    raise SystemExit("Founding rate must not replace the crossed CAD 299 price")

subprocess.run(["git", "fetch", "origin", "main"], check=True)
original_script = subprocess.check_output(
    ["git", "show", "FETCH_HEAD:scripts/apply-paid-onboarding-index.py"],
    text=True,
)
Path("scripts/apply-paid-onboarding-index.py").write_text(original_script, encoding="utf-8")

subprocess.run(["git", "config", "user.name", "github-actions[bot]"], check=True)
subprocess.run(
    ["git", "config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"],
    check=True,
)
subprocess.run(["git", "add", "-A"], check=True)
subprocess.run(["git", "diff", "--cached", "--check"], check=True)
subprocess.run(
    ["git", "commit", "-m", "Add approved fair-use terms and finalize mobile pricing"],
    check=True,
)
subprocess.run(
    ["git", "push", "origin", "HEAD:build/automatic-paid-onboarding-website"],
    check=True,
)

print("Applied approved fair-use Terms and restored helper files")
