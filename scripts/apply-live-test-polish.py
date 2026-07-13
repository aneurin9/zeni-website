from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


# Main marketing page: make modal sizing follow the actually visible mobile viewport.
index_path = Path("index.html")
index = index_path.read_text(encoding="utf-8")
modal_css = r'''

  /* Live-test fix: keep walkthrough and checkout modals inside the visible mobile viewport. */
  .modal{height:var(--modal-vh,100vh)}
  .modal-card{max-height:calc(var(--modal-vh,100vh) - 44px)}
  @media(max-width:520px){
    .modal{
      padding:calc(12px + env(safe-area-inset-top)) 12px calc(12px + env(safe-area-inset-bottom));
      align-items:center;
    }
    .modal-card{max-height:calc(var(--modal-vh,100vh) - 24px - env(safe-area-inset-top) - env(safe-area-inset-bottom))}
    .modal-body{min-height:0;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
  }
'''
index = replace_once(index, "\n</style>", modal_css + "\n</style>", "index modal CSS insertion")

viewport_js = r'''
function syncModalViewport(){
  var viewport = window.visualViewport;
  var height = viewport ? viewport.height : window.innerHeight;
  if(height){ document.documentElement.style.setProperty('--modal-vh', Math.round(height)+'px'); }
}
syncModalViewport();
window.addEventListener('resize', syncModalViewport);
if(window.visualViewport){
  window.visualViewport.addEventListener('resize', syncModalViewport);
  window.visualViewport.addEventListener('scroll', syncModalViewport);
}

'''
index = replace_once(index, "/* ---------- WALKTHROUGH ---------- */\n", viewport_js + "/* ---------- WALKTHROUGH ---------- */\n", "viewport helper insertion")
index = replace_once(
    index,
    "function openDemo(){\n  lastFocus=document.activeElement;closeMenu();",
    "function openDemo(){\n  syncModalViewport();\n  lastFocus=document.activeElement;closeMenu();",
    "walkthrough open viewport sync",
)
index = replace_once(
    index,
    "  wtGo(1);\n  setTimeout(function(){document.querySelector('.modal-x').focus();},50);",
    "  wtGo(1);\n  requestAnimationFrame(syncModalViewport);\n  setTimeout(function(){document.querySelector('#demoModal .modal-x').focus();},50);",
    "walkthrough post-open viewport sync",
)
index = replace_once(
    index,
    "function openGetStarted(presetPlan){\n  gsLastFocus = document.activeElement;",
    "function openGetStarted(presetPlan){\n  syncModalViewport();\n  gsLastFocus = document.activeElement;",
    "checkout open viewport sync",
)
index = replace_once(
    index,
    "  gsRenderBody();\n  setTimeout(function(){ var n=document.getElementById('gsNameInput'); if(n) n.focus(); }, 60);",
    "  gsRenderBody();\n  requestAnimationFrame(syncModalViewport);\n  setTimeout(function(){ var n=document.getElementById('gsNameInput'); if(n) n.focus(); }, 60);",
    "checkout post-open viewport sync",
)
index_path.write_text(index, encoding="utf-8")


# Premium page: force the mobile equation into a clear vertical sequence.
premium_path = Path("premium/index.html")
premium = premium_path.read_text(encoding="utf-8")
premium_css = r'''

  /* Live-test polish: preserve Core + human team = Premium order on mobile. */
  @media(max-width:720px){
    .bridge-card{flex-direction:column;align-items:stretch;flex-wrap:nowrap}
    .bridge-pill{justify-content:center;text-align:center}
    .bridge-op{align-self:center;line-height:1}
    .bridge-pill.prem{align-self:center}
  }
'''
premium = replace_once(premium, "\n</style>", premium_css + "\n</style>", "premium bridge CSS insertion")
premium_path.write_text(premium, encoding="utf-8")


# Welcome page: use WhatsApp-specific wording and give the old Core price its own left-aligned line.
welcome_path = Path("welcome/index.html")
welcome = welcome_path.read_text(encoding="utf-8")
welcome = replace_once(
    welcome,
    "Want to use a different number instead? Just message <b>1 647-503-2333</b> and we'll switch it for you.",
    "Want to use a different number instead? Just WhatsApp <b>1 647-503-2333</b> and we'll switch it for you.",
    "welcome WhatsApp wording",
)
welcome_css = r'''

/* Live-test polish: separate the introductory Core price from the current price. */
.price-row .price-old{flex:0 0 100%;width:100%;text-align:left;margin-bottom:-4px}
'''
welcome = replace_once(welcome, "\n</style>", welcome_css + "\n</style>", "welcome price CSS insertion")
welcome_path.write_text(welcome, encoding="utf-8")


# Focused assertions for the four requested changes.
assert "--modal-vh" in index
assert "requestAnimationFrame(syncModalViewport)" in index
assert ".bridge-card{flex-direction:column" in premium
assert "Just WhatsApp <b>1 647-503-2333</b>" in welcome
assert ".price-row .price-old{flex:0 0 100%" in welcome
print("Applied and verified live-test website polish.")
