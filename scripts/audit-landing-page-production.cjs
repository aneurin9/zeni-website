const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const target = process.env.TARGET_URL || 'https://zeni.aneurinadvisory.com/';
const outDir = path.join(process.cwd(), 'landing-audit-artifacts');
fs.mkdirSync(outDir, { recursive: true });

const viewports = [
  { name: 'desktop', width: 1440, height: 1000, isMobile: false, hasTouch: false },
  { name: 'ipad-landscape', width: 1180, height: 820, isMobile: false, hasTouch: true },
  { name: 'ipad-portrait', width: 820, height: 1180, isMobile: false, hasTouch: true },
  { name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true },
];

async function scrollWholePage(page) {
  await page.evaluate(async () => {
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    const total = document.documentElement.scrollHeight;
    for (let y = 0; y < total; y += Math.max(500, innerHeight * 0.75)) {
      scrollTo(0, y);
      await delay(80);
    }
    scrollTo(0, 0);
  });
  await page.waitForTimeout(500);
}

async function auditViewport(browser, cfg) {
  const context = await browser.newContext({
    viewport: { width: cfg.width, height: cfg.height },
    isMobile: cfg.isMobile,
    hasTouch: cfg.hasTouch,
    deviceScaleFactor: 1,
    locale: 'en-CA',
    timezoneId: 'America/Toronto',
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const consoleWarnings = [];
  const pageErrors = [];
  const requestFailures = [];
  const badResponses = [];

  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
    if (msg.type() === 'warning') consoleWarnings.push(msg.text());
  });
  page.on('pageerror', err => pageErrors.push(String(err)));
  page.on('requestfailed', req => requestFailures.push({
    url: req.url(),
    error: req.failure()?.errorText || 'unknown',
  }));
  page.on('response', response => {
    if (response.status() >= 400) badResponses.push({
      url: response.url(),
      status: response.status(),
    });
  });

  const response = await page.goto(target, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1200);
  await scrollWholePage(page);

  const baseline = await page.evaluate(() => {
    const visible = el => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    const brokenImages = [...document.images]
      .filter(img => visible(img) && (!img.complete || img.naturalWidth === 0))
      .map(img => ({ src: img.currentSrc || img.src, alt: img.alt }));
    const overflowCandidates = [];
    for (const el of document.querySelectorAll('a,button,input,select,textarea,h1,h2,h3,h4,p,li,img')) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      if (r.left < -4 || r.right > innerWidth + 4) {
        overflowCandidates.push({
          tag: el.tagName,
          id: el.id,
          className: typeof el.className === 'string' ? el.className : '',
          left: Math.round(r.left),
          right: Math.round(r.right),
          width: Math.round(r.width),
          text: (el.innerText || el.alt || '').trim().slice(0, 100),
        });
      }
    }
    const duplicateIds = [...document.querySelectorAll('[id]')]
      .map(el => el.id)
      .filter((id, i, all) => id && all.indexOf(id) !== i)
      .filter((id, i, all) => all.indexOf(id) === i);
    const emptyInteractiveLabels = [...document.querySelectorAll('button,a[href],input,select,textarea')]
      .filter(el => visible(el))
      .filter(el => !(el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('alt') || el.value || '').trim())
      .map(el => ({
        tag: el.tagName,
        className: typeof el.className === 'string' ? el.className : '',
        href: el.getAttribute('href'),
      }));
    return {
      title: document.title,
      lang: document.documentElement.lang,
      innerWidth,
      innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
      brokenImages,
      overflowCandidates,
      duplicateIds,
      emptyInteractiveLabels,
    };
  });

  await page.screenshot({ path: path.join(outDir, `${cfg.name}-full.png`), fullPage: true });

  const interactions = {
    mobileMenu: { applicable: cfg.width <= 860 },
    howItWorks: {},
    outcomeTabs: [],
    faq: {},
    getStarted: {},
  };

  if (cfg.width <= 860) {
    const hamburger = page.locator('.hamburger');
    interactions.mobileMenu.visible = await hamburger.isVisible().catch(() => false);
    if (interactions.mobileMenu.visible) {
      await hamburger.click();
      await page.waitForTimeout(250);
      interactions.mobileMenu.open = await page.locator('.mobile-menu')
        .evaluate(el => el.classList.contains('open')).catch(() => false);
      await page.screenshot({ path: path.join(outDir, `${cfg.name}-menu.png`) });
      await hamburger.click();
      await page.waitForTimeout(200);
      interactions.mobileMenu.closed = await page.locator('.mobile-menu')
        .evaluate(el => !el.classList.contains('open')).catch(() => false);
    }
  }

  const howButton = page.getByText('See how Zeni works', { exact: true }).first();
  interactions.howItWorks.triggerVisible = await howButton.isVisible().catch(() => false);
  if (interactions.howItWorks.triggerVisible) {
    await howButton.click();
    await page.waitForTimeout(350);
    interactions.howItWorks.modalTitleVisible = await page.getByText('See how Zeni works', { exact: true })
      .last().isVisible().catch(() => false);
    interactions.howItWorks.initialBackVisible = await page.getByText('Back', { exact: true })
      .last().isVisible().catch(() => false);
    interactions.howItWorks.initialNextVisible = await page.getByText('Next', { exact: true })
      .last().isVisible().catch(() => false);
    await page.screenshot({ path: path.join(outDir, `${cfg.name}-how-it-works-open.png`) });

    const visited = [];
    for (let i = 0; i < 8; i += 1) {
      const body = page.locator('#wtBody');
      if (await body.count()) visited.push((await body.innerText()).trim().slice(0, 220));
      const next = page.getByText('Next', { exact: true }).last();
      if (!(await next.isVisible().catch(() => false))) break;
      await next.click();
      await page.waitForTimeout(350);
    }
    interactions.howItWorks.stepsVisited = visited;
    interactions.howItWorks.seeItInActionVisible = await page.getByText('See it in action', { exact: true })
      .last().isVisible().catch(() => false);

    if (interactions.howItWorks.seeItInActionVisible) {
      const finalText = page.getByText(
        'Draft ready, and I’ve prepared a reminder for tomorrow at 9:00 AM. Nothing has been sent.',
        { exact: false },
      );
      await finalText.waitFor({ state: 'visible', timeout: 15500 });
      interactions.howItWorks.finalDemoVisible = true;
      interactions.howItWorks.demoBubbleCount = await page.locator('#simBody .bub').count();
      await page.screenshot({ path: path.join(outDir, `${cfg.name}-demo-final.png`) });
      await page.waitForTimeout(3000);
      interactions.howItWorks.finalDemoStillVisibleAfter3s = await finalText.isVisible().catch(() => false);
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }

  const tabs = page.locator('.oc-tab');
  const tabCount = await tabs.count();
  for (let i = 0; i < tabCount; i += 1) {
    const tab = tabs.nth(i);
    if (!(await tab.isVisible())) continue;
    const label = (await tab.innerText()).trim();
    await tab.click();
    await page.waitForTimeout(180);
    const panelText = await page.locator('#outcomePanel').innerText().catch(() => '');
    interactions.outcomeTabs.push({ label, panelText: panelText.trim().slice(0, 500) });
  }
  const inbox = interactions.outcomeTabs.find(tab => tab.label.toLowerCase().includes('inbox'));
  interactions.inboxCopy = {
    found: !!inbox,
    newCopyPresent: !!inbox && inbox.panelText.includes('Works with the business email I help you set up.'),
    providerSpecificCopyPresent: !!inbox && inbox.panelText.includes('Works with the Zoho business email I help you set up.'),
  };

  const faqQuestion = page.getByText('Do I need any business experience to use Zeni?', { exact: true });
  interactions.faq.questionVisible = await faqQuestion.isVisible().catch(() => false);
  if (interactions.faq.questionVisible) {
    await faqQuestion.click();
    await page.waitForTimeout(180);
    interactions.faq.answerVisible = await page.getByText(
      'No. I’m built for people who are new to running a business.',
      { exact: false },
    ).isVisible().catch(() => false);
  }

  const getStarted = page.getByText('Get started with Zeni', { exact: true }).first();
  interactions.getStarted.triggerVisible = await getStarted.isVisible().catch(() => false);
  if (interactions.getStarted.triggerVisible) {
    await getStarted.click();
    await page.waitForTimeout(300);
    interactions.getStarted.nameStepVisible = await page.getByText('Name', { exact: true })
      .last().isVisible().catch(() => false);
    interactions.getStarted.continueVisible = await page.getByText('Continue', { exact: true })
      .last().isVisible().catch(() => false);
    await page.screenshot({ path: path.join(outDir, `${cfg.name}-get-started.png`) });
    await page.keyboard.press('Escape');
  }

  const origin = new URL(target).origin;
  const sameOriginFailures = requestFailures.filter(item => item.url.startsWith(origin));
  const sameOriginBadResponses = badResponses.filter(item => item.url.startsWith(origin));

  const result = {
    viewport: cfg,
    status: response ? response.status() : null,
    finalUrl: page.url(),
    baseline,
    interactions,
    consoleErrors,
    consoleWarnings,
    pageErrors,
    requestFailures,
    badResponses,
    sameOriginFailures,
    sameOriginBadResponses,
  };

  await context.close();
  return result;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  for (const viewport of viewports) results.push(await auditViewport(browser, viewport));
  await browser.close();

  fs.writeFileSync(path.join(outDir, 'audit.json'), JSON.stringify(results, null, 2));

  const failures = [];
  for (const result of results) {
    const name = result.viewport.name;
    if (!result.status || result.status >= 400) failures.push(`${name}: HTTP ${result.status}`);
    if (result.baseline.horizontalOverflow > 2) failures.push(`${name}: root horizontal overflow ${result.baseline.horizontalOverflow}px`);
    if (result.baseline.brokenImages.length) failures.push(`${name}: broken visible images`);
    if (result.pageErrors.length) failures.push(`${name}: page errors`);
    if (result.sameOriginFailures.length) failures.push(`${name}: same-origin request failures`);
    if (result.sameOriginBadResponses.length) failures.push(`${name}: same-origin HTTP errors`);
    if (!result.interactions.howItWorks.triggerVisible || !result.interactions.howItWorks.modalTitleVisible) {
      failures.push(`${name}: How Zeni works did not open`);
    }
    if (!result.interactions.howItWorks.finalDemoVisible || !result.interactions.howItWorks.finalDemoStillVisibleAfter3s) {
      failures.push(`${name}: demo timing/final state failed`);
    }
    if (!result.interactions.inboxCopy.newCopyPresent || result.interactions.inboxCopy.providerSpecificCopyPresent) {
      failures.push(`${name}: Inbox copy mismatch`);
    }
    if (!result.interactions.faq.answerVisible) failures.push(`${name}: FAQ interaction failed`);
    if (!result.interactions.getStarted.nameStepVisible || !result.interactions.getStarted.continueVisible) {
      failures.push(`${name}: Get Started flow did not open`);
    }
    if (result.viewport.width <= 860 && (
      !result.interactions.mobileMenu.visible ||
      !result.interactions.mobileMenu.open ||
      !result.interactions.mobileMenu.closed
    )) failures.push(`${name}: mobile menu failed`);
  }

  const summary = results.map(r => ({
    viewport: r.viewport.name,
    status: r.status,
    horizontalOverflow: r.baseline.horizontalOverflow,
    brokenImages: r.baseline.brokenImages.length,
    pageErrors: r.pageErrors.length,
    sameOriginFailures: r.sameOriginFailures.length,
    sameOriginBadResponses: r.sameOriginBadResponses.length,
    consoleErrors: r.consoleErrors.length,
    overflowCandidates: r.baseline.overflowCandidates.length,
    demoFinal: r.interactions.howItWorks.finalDemoVisible,
    demoHeld: r.interactions.howItWorks.finalDemoStillVisibleAfter3s,
    inboxCopy: r.interactions.inboxCopy,
    faq: r.interactions.faq,
    getStarted: r.interactions.getStarted,
    mobileMenu: r.interactions.mobileMenu,
  }));
  console.log(JSON.stringify({ summary, failures }, null, 2));
  if (failures.length) process.exit(1);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
