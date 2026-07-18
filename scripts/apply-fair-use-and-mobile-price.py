from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count == 1:
        return text.replace(old, new, 1)
    if count == 0 and new in text:
        return text
    raise RuntimeError(f"{label}: expected exactly one guarded source match, found {count}")


terms_path = Path("terms/index.html")
welcome_path = Path("welcome/index.html")
welcome_js_path = Path("welcome/welcome.js")

terms = terms_path.read_text(encoding="utf-8")
fair_use_heading = "        <h3>Fair Use and Service Limits</h3>"
prohibited_heading = "        <h3>Prohibited Conduct</h3>"
fair_use_block = """        <h3>Fair Use and Service Limits</h3>
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
          allowances communicated on the pricing page, during purchase, within
          Zeni, or in other plan information. Reaching a feature allowance will
          ordinarily affect only that feature, and the rest of Zeni will remain
          available. Protective controls are intended to prevent abuse and
          technical instability, not to restrict normal day-to-day use.
        </p>
        <p>
          The Company may reasonably adjust protective limits as security risks,
          third-party provider requirements, technical capacity, or the Service
          change. Where reasonably practicable, Zeni will explain a temporary
          pause and when normal use can resume. If a material change would affect
          ordinary use of a paid plan, the Company will provide reasonable notice
          where required.
        </p>

"""
if fair_use_heading not in terms:
    terms = replace_once(
        terms,
        prohibited_heading,
        fair_use_block + prohibited_heading,
        "terms fair-use insertion",
    )

welcome = welcome_path.read_text(encoding="utf-8")
welcome = replace_once(
    welcome,
    ".price-row{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:6px}",
    ".price-row{display:flex;align-items:baseline;gap:8px;flex-wrap:nowrap;margin-bottom:6px}",
    "welcome non-wrapping price row",
)
welcome = replace_once(
    welcome,
    ".price-old{font-size:14px;color:var(--faint);text-decoration:line-through}",
    ".price-old{font-size:14px;color:var(--faint);text-decoration:line-through;margin-left:4px}",
    "welcome old-price spacing",
)
welcome = replace_once(
    welcome,
    '<div class="price-row"><span class="price-old">$299</span><span class="price-new">$149</span><span class="price-mo">CAD/mo</span></div>',
    '<div class="price-row"><span class="price-new">$149</span><span class="price-old">$299</span><span class="price-mo">CAD/mo</span></div>',
    "welcome Core price order",
)

welcome_js = welcome_js_path.read_text(encoding="utf-8")
legacy_price_rules = """      '.price-row .price-new{order:1}',
      '.price-row .price-mo{order:2}',
      '.price-row .price-old{order:3;margin-left:4px}',
"""
if legacy_price_rules in welcome_js:
    welcome_js = welcome_js.replace(legacy_price_rules, "", 1)

terms_path.write_text(terms, encoding="utf-8")
welcome_path.write_text(welcome, encoding="utf-8")
welcome_js_path.write_text(welcome_js, encoding="utf-8")

# Guarded release checks.
assert terms.count(fair_use_heading) == 1
assert "including live web verification, may have monthly" in terms
assert "not to restrict normal day-to-day use" in terms
assert terms.index(fair_use_heading) < terms.index(prohibited_heading)
assert "attempt to circumvent any\n          usage limits, rate limits, or access controls" in terms

expected_core_row = '<div class="price-row"><span class="price-new">$149</span><span class="price-old">$299</span><span class="price-mo">CAD/mo</span></div>'
assert welcome.count(expected_core_row) == 1
assert "flex-wrap:nowrap" in welcome
assert ".price-old{font-size:14px;color:var(--faint);text-decoration:line-through;margin-left:4px}" in welcome
assert ".price-row .price-new{order:1}" not in welcome_js
assert ".price-row .price-old{order:3" not in welcome_js

print("Applied and validated fair-use disclosure and mobile price alignment.")
