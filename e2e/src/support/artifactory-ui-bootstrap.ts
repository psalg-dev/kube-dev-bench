import path from 'node:path';
import fs from 'node:fs/promises';
import { chromium, type Browser, type Page, type Locator } from '@playwright/test';
import { e2eRoot } from './paths.js';

export type ArtifactoryUiBootstrapOptions = {
  baseUiUrl: string;
  username: string;
  password: string;
  /** Password to try if the configured password does not work yet (e.g. default 'password'). */
  fallbackPassword?: string;
  repoKey: string;
  timeoutMs: number;
  runId?: string;
};

function isoNowForFile() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeSmallFile(filePath: string, content: string) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf-8');
}

function isLoginUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return /\/ui\/login\/?$/.test(u.pathname);
  } catch {
    return false;
  }
}

async function applyUiWorkarounds(page: Page): Promise<void> {
  // Artifactory/JFrog UI sometimes shows onboarding/overlays that intercept pointer events.
  // Hide them so we can deterministically interact with underlying controls.
  await page
    .addStyleTag({
      content: [
        '.welcome-sidebar{display:none !important; pointer-events:none !important;}',
        '.pounding-heart-container{display:none !important; pointer-events:none !important;}',
      ].join('\n'),
    })
    .catch(() => undefined);

  // Some overlays can be dismissed with Escape.
  await page.keyboard.press('Escape').catch(() => undefined);
}

async function hasUnsignedEulaNotice(page: Page): Promise<boolean> {
  const systemMessages = page.locator('[data-cy="systemMessagesContainer"]').first();

  // Prefer checking the system-messages text directly: the banner can exist but be
  // temporarily "not visible" during rerenders/navigation.
  const txt = await systemMessages.innerText({ timeout: 2_500 }).catch(() => '');
  if (/no\s+signed\s+eula\s+found/i.test(txt)) return true;

  return page
    .getByText(/no\s+signed\s+eula\s+found/i)
    .first()
    .isVisible({ timeout: 2_500 })
    .catch(() => false);
}

async function tryAcceptEulaOnCurrentPage(page: Page, timeoutMs: number): Promise<boolean> {
  // Be strict here: only click controls that look explicitly EULA-related.
  // (Avoid onboarding popovers like "Get started with Projects".)

  let url = page.url();

  // Some images (like JFrog Container Registry) expose an onboarding dashboard under admin.
  // This page is reachable even when other admin routes are gated and may contain the EULA CTA.
  if (/\/ui\/admin\/onboarding-page\/?/i.test(url)) {
    await applyUiWorkarounds(page);

    await clickFirstEnabledVisible(
      page,
      [
        page.getByRole('button', { name: /sign\s*the\s*eula|sign\s*eula|accept\s*eula|agree\s*eula|eula/i }),
        page.getByRole('link', { name: /sign\s*the\s*eula|sign\s*eula|accept\s*eula|agree\s*eula|eula/i }),
        page.locator('button:visible').filter({ hasText: /sign\s*the\s*eula|sign\s*eula|accept\s*eula|agree\s*eula|eula/i }),
        page.locator('a:visible').filter({ hasText: /sign\s*the\s*eula|sign\s*eula|accept\s*eula|agree\s*eula|eula/i }),
      ],
      Math.min(15_000, timeoutMs)
    ).catch(() => undefined);

    // In some JCR builds, signing/activation is only reachable after clicking the main
    // onboarding CTA ("Create a Repository"). Best-effort: click it and let the generic
    // EULA handler below pick up any dedicated EULA route or dialog.
    await clickFirstEnabledVisible(
      page,
      [
        page.getByRole('button', { name: /create\s+a\s+repository/i }),
        page.locator('button:visible').filter({ hasText: /create\s+a\s+repository/i }),
      ],
      Math.min(10_000, timeoutMs)
    ).catch(() => undefined);
    await page.waitForTimeout(750);

    // Some JCR builds don't present an explicit EULA CTA here; completing/skipping onboarding
    // is required before repository creation becomes available.
    // Best-effort: try the visible "Skip" action.
    if (/\/ui\/admin\/onboarding-page\/?/i.test(page.url())) {
      await clickFirstEnabledVisible(
        page,
        [
          page.locator('[data-cy="skipOnboardingButton"]'),
          page.getByRole('button', { name: /^skip$/i }),
          page.locator('button:visible').filter({ hasText: /^\s*skip\s*$/i }),
        ],
        Math.min(10_000, timeoutMs)
      ).catch(() => undefined);
      await page.waitForTimeout(1_000);
    }

    // If this navigated to an actual EULA page, fall through to the dedicated EULA handling.
    url = page.url();
  }

  // Dedicated EULA flow (often: /ui/.../eula). We can't rely on the system-messages banner
  // on these routes, so callers must verify after returning.
  if (/\/ui\/.*\beula\b/i.test(url)) {
    await applyUiWorkarounds(page);

    // Some pages require scrolling the EULA container before enabling the accept button.
    // Be aggressive: scroll any scrollable container inside the main UI.
    await page
      .evaluate(() => {
        try {
          const root = document.querySelector('main') ?? document.body;
          const all = Array.from(root.querySelectorAll('*'));
          for (const el of all) {
            if (!(el instanceof HTMLElement)) continue;
            if (el.clientHeight < 40) continue;
            if (el.scrollHeight <= el.clientHeight + 10) continue;
            const style = window.getComputedStyle(el);
            const overflowY = style.overflowY;
            if (overflowY !== 'auto' && overflowY !== 'scroll') continue;
            try {
              el.scrollTop = el.scrollHeight;
            } catch {
              // ignore
            }
          }

          // Also scroll the window to the bottom.
          window.scrollTo(0, document.body.scrollHeight);
        } catch {
          // ignore
        }
      })
      .catch(() => undefined);

    // Check any visible agreement checkbox.
    const roleCheckboxes = page.getByRole('checkbox');
    const roleCount = await roleCheckboxes.count().catch(() => 0);
    for (let i = 0; i < roleCount; i++) {
      const cb = roleCheckboxes.nth(i);
      if (await cb.isVisible({ timeout: 250 }).catch(() => false)) {
        await cb.check({ timeout: Math.min(3_000, timeoutMs) }).catch(async () => {
          await cb.click({ timeout: Math.min(3_000, timeoutMs), force: true }).catch(() => undefined);
        });
      }
    }

    const inputCheckboxes = page.locator('input[type="checkbox"]');
    const inputCount = await inputCheckboxes.count().catch(() => 0);
    for (let i = 0; i < inputCount; i++) {
      const cb = inputCheckboxes.nth(i);
      if (!(await cb.isVisible({ timeout: 250 }).catch(() => false))) continue;
      const checked = await cb.isChecked().catch(() => false);
      if (!checked) {
        await cb.click({ timeout: Math.min(3_000, timeoutMs), force: true }).catch(() => undefined);
      }
    }

    // Click the first enabled, visible accept/agree/continue action.
    await clickFirstEnabledVisible(
      page,
      [
        page.getByRole('button', { name: /accept|agree|continue|sign|i\s*agree|next|finish|done/i }),
        page.getByRole('link', { name: /accept|agree|continue|sign|i\s*agree|next|finish|done/i }),
        page.locator('button:visible').filter({ hasText: /accept|agree|continue|sign|i\s*agree|next|finish|done/i }),
        page.locator('button[type="submit"]:visible'),
      ],
      Math.min(15_000, timeoutMs)
    ).catch(() => undefined);

    await page.waitForTimeout(1_000);
    return !/\/ui\/.*\beula\b/i.test(page.url());
  }

  const eulaNotice = page.getByText(/no\s+signed\s+eula\s+found/i).first();
  const systemMessages = page.locator('[data-cy="systemMessagesContainer"]').first();
  const repoTypeModal = page.locator('[data-cy="repository-type-modal"]').first();

  const eulaDialog = page.getByRole('dialog').filter({ hasText: /eula/i }).first();
  const eulaButton = page.getByRole('button', { name: /sign\s*eula|accept\s*eula|agree\s*eula|eula/i }).first();

  // Sometimes clicking the notice opens the EULA dialog.
  // If a repository-type modal is open, avoid clicking the notice behind it.
  const modalVisible = await repoTypeModal.isVisible({ timeout: 500 }).catch(() => false);
  if (!modalVisible && (await eulaNotice.isVisible({ timeout: 500 }).catch(() => false))) {
    await eulaNotice.click({ timeout: Math.min(5_000, timeoutMs), force: true }).catch(() => undefined);
  }

  // Prefer clicking a specific "sign the EULA" link/button in the system messages container.
  await clickFirstVisible(
    page,
    [
      systemMessages.getByRole('link', { name: /sign\s*the\s*eula|sign\s*eula|eula/i }),
      systemMessages.getByRole('button', { name: /sign\s*the\s*eula|sign\s*eula|eula/i }),
    ],
    Math.min(5_000, timeoutMs)
  ).catch(() => undefined);

  // If that moved us to a dedicated EULA page, try to accept there.
  if (/eula/i.test(page.url())) {
    await clickFirstVisible(
      page,
      [page.getByRole('button', { name: /accept|agree|continue|sign/i })],
      Math.min(10_000, timeoutMs)
    ).catch(() => undefined);
  }

  if (await eulaButton.isVisible({ timeout: 500 }).catch(() => false)) {
    await eulaButton.click({ timeout: Math.min(5_000, timeoutMs), force: true }).catch(() => undefined);
  }

  // If a dialog appears, attempt to accept within it.
  const dialogVisible = await eulaDialog.isVisible({ timeout: 1_000 }).catch(() => false);
  if (dialogVisible) {
    const checkbox = eulaDialog.getByRole('checkbox', { name: /i\s*agree|accept|agree|eula/i }).first();
    if (await checkbox.isVisible({ timeout: 500 }).catch(() => false)) {
      await checkbox.check({ timeout: Math.min(5_000, timeoutMs) }).catch(async () => {
        await checkbox.click({ timeout: Math.min(5_000, timeoutMs), force: true }).catch(() => undefined);
      });
    }

    const accept = eulaDialog.getByRole('button', { name: /accept|agree|continue|sign/i }).first();
    if (await accept.isVisible({ timeout: 500 }).catch(() => false)) {
      await accept.click({ timeout: Math.min(10_000, timeoutMs), force: true }).catch(() => undefined);
    }
  }

  // Fallback: within the system messages region, click any link/button mentioning EULA.
  await clickFirstVisible(
    page,
    [
      systemMessages.getByRole('link', { name: /eula/i }),
      systemMessages.getByRole('button', { name: /eula/i }),
    ],
    Math.min(5_000, timeoutMs)
  ).catch(() => undefined);

  await page.waitForTimeout(1_000);
  return !(await hasUnsignedEulaNotice(page));
}

async function ensureEulaSigned(page: Page, baseUiUrl: string, timeoutMs: number, artifactDir?: string): Promise<void> {
  if (!(await hasUnsignedEulaNotice(page))) return;

  await applyUiWorkarounds(page);

  const returnUrl = page.url();

  if (artifactDir) {
    const systemMessagesText = await page
      .locator('[data-cy="systemMessagesContainer"]')
      .first()
      .innerText({ timeout: 2_500 })
      .catch(() => '');
    const info = `url=${returnUrl}\nmessage=${systemMessagesText.replace(/\s+/g, ' ').trim()}\n`;
    await writeSmallFile(path.join(artifactDir, 'eula-detected.txt'), info).catch(() => undefined);
    await page.screenshot({ path: path.join(artifactDir, 'eula-detected.png'), fullPage: true }).catch(() => undefined);
  }

  const origin = new URL(baseUiUrl).origin;

  // First attempt: accept via whatever modal/buttons are currently shown.
  // Always verify by returning to the original page and checking the banner again.
  try {
    await tryAcceptEulaOnCurrentPage(page, Math.min(15_000, timeoutMs));
  } catch {
    // ignore
  }

  // Re-check on the original page (some flows navigate away without actually signing).
  if (page.url() !== returnUrl) {
    await page.goto(returnUrl, { waitUntil: 'domcontentloaded', timeout: Math.min(30_000, timeoutMs) }).catch(() => undefined);
  }
  await page.waitForTimeout(750);
  if (!(await hasUnsignedEulaNotice(page))) return;

  // Second attempt: navigate to onboarding routes that often host the EULA CTA.
  // Note: different Artifactory/JCR builds expose different onboarding paths.
  try {
    const onboardingRoutes = [`${origin}/ui/admin/onboarding-page`, `${origin}/ui/onboarding/eula`];
    for (const onboardingUrl of onboardingRoutes) {
      await page.goto(onboardingUrl, { waitUntil: 'domcontentloaded', timeout: Math.min(30_000, timeoutMs) });
      await page.waitForTimeout(1_000);
      await applyUiWorkarounds(page);

      if (artifactDir) {
        const prefix = /\/ui\/admin\/onboarding-page\/?/i.test(page.url()) ? 'onboarding-page' : 'onboarding-eula';
        await page.screenshot({ path: path.join(artifactDir, `${prefix}.png`), fullPage: true }).catch(() => undefined);
        const onboardingHtml = await page.content().catch(() => '');
        if (onboardingHtml.trim()) {
          const bounded = onboardingHtml.length <= 20_000 ? onboardingHtml : `${onboardingHtml.slice(0, 10_000)}\n\n<!-- SNIP -->\n\n${onboardingHtml.slice(-10_000)}`;
          await writeSmallFile(path.join(artifactDir, `${prefix}.html.snippet.txt`), bounded).catch(() => undefined);
        }
        const onboardingInfo = `url=${page.url()}\ntitle=${await page.title().catch(() => '')}\n`;
        await writeSmallFile(path.join(artifactDir, `${prefix}-page-info.txt`), onboardingInfo).catch(() => undefined);
      }

      await tryAcceptEulaOnCurrentPage(page, Math.min(20_000, timeoutMs));

      if (artifactDir) {
        const prefix = /\/ui\/admin\/onboarding-page\/?/i.test(page.url()) ? 'onboarding-page' : 'onboarding-eula';
        await page.screenshot({ path: path.join(artifactDir, `${prefix}-after.png`), fullPage: true }).catch(() => undefined);
      }

      // Verify by returning to the original page and checking the banner.
      await page.goto(returnUrl, { waitUntil: 'domcontentloaded', timeout: Math.min(30_000, timeoutMs) });
      await page.waitForTimeout(750);
      if (!(await hasUnsignedEulaNotice(page))) return;
    }
  } catch {
    // ignore
  }

  // Third attempt: navigate to the JFrog Container Registry admin page, which sometimes hosts activation/EULA flows.
  try {
    await page.goto(`${origin}/ui/admin/artifactory/list`, { waitUntil: 'domcontentloaded', timeout: Math.min(30_000, timeoutMs) });
    await page.waitForTimeout(1_000);
    await applyUiWorkarounds(page);
    await tryAcceptEulaOnCurrentPage(page, Math.min(15_000, timeoutMs));
  } catch {
    // ignore
  } finally {
    // Do not strand the flow on a dead/teaser page.
    await page.goto(returnUrl, { waitUntil: 'domcontentloaded', timeout: Math.min(30_000, timeoutMs) }).catch(() => undefined);
    await page.waitForTimeout(500).catch(() => undefined);
  }

  // Final verification.
  if (!(await hasUnsignedEulaNotice(page))) return;
}

async function waitForAnyVisible(page: Page, selectors: Array<ReturnType<Page['locator']>>, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const loc of selectors) {
      if (await loc.first().isVisible({ timeout: 250 }).catch(() => false)) return true;
    }
    await page.waitForTimeout(250);
  }
  return false;
}

async function isOnLoginScreen(page: Page): Promise<boolean> {
  if (isLoginUrl(page.url())) return true;
  const title = await page.title().catch(() => '');
  const hasPassword = await page
    .locator('input[type="password"]')
    .first()
    .isVisible({ timeout: 1_000 })
    .catch(() => false);

  // Avoid false positives: some admin pages may include hidden password inputs.
  if (!hasPassword) return false;

  if (/\blogin\b/i.test(title)) return true;

  const hasLoginButton = await page
    .getByRole('button', { name: /log\s*in|sign\s*in/i })
    .first()
    .isVisible({ timeout: 1_000 })
    .catch(() => false);
  return hasLoginButton;
}

async function clickFirstVisible(page: Page, selectors: Array<ReturnType<Page['locator']>>, timeoutMs: number) {
  const start = Date.now();
  for (const loc of selectors) {
    const remaining = Math.max(500, timeoutMs - (Date.now() - start));
    try {
      if (await loc.first().isVisible({ timeout: Math.min(2_000, remaining) })) {
        try {
          await loc.first().click({ timeout: Math.min(5_000, remaining) });
          return true;
        } catch {
          // Some Artifactory UI states overlay a splash/main container that intercepts pointer events.
          // As a last resort, force the click.
          try {
            await loc.first().click({ timeout: Math.min(5_000, remaining), force: true });
            return true;
          } catch {
            // Final fallback: DOM click bypasses Playwright's hit-target checks.
            try {
              await loc.first().evaluate((el) => {
                (el as HTMLElement).scrollIntoView?.({ block: 'center', inline: 'center' });
                (el as HTMLElement).click();
              });
              return true;
            } catch {
              // Try next selector.
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }
  return false;
}

async function clickFirstEnabledVisible(page: Page, selectors: Array<ReturnType<Page['locator']>>, timeoutMs: number) {
  const start = Date.now();
  for (const loc of selectors) {
    const remaining = Math.max(500, timeoutMs - (Date.now() - start));
    try {
      const first = loc.first();
      if (!(await first.isVisible({ timeout: Math.min(2_000, remaining) }))) continue;

      // Avoid counting a forced click on a disabled button as success.
      const enabled = await first.isEnabled({ timeout: Math.min(2_000, remaining) }).catch(() => false);
      if (!enabled) continue;

      try {
        await first.click({ timeout: Math.min(5_000, remaining) });
        return true;
      } catch {
        // Retry with force in case an overlay intercepts the hit target.
        try {
          await first.click({ timeout: Math.min(5_000, remaining), force: true });
          return true;
        } catch {
          // Final fallback: DOM click bypasses Playwright's hit-target checks.
          try {
            await first.evaluate((el) => {
              (el as HTMLElement).scrollIntoView?.({ block: 'center', inline: 'center' });
              (el as HTMLElement).click();
            });
            return true;
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore
    }
  }
  return false;
}

async function openCreateLocalRepoFlow(page: Page, timeoutMs: number): Promise<boolean> {
  // Check if we're already on the package type selection page (JCR 7.x new local repo page)
  // In this case, no button click is needed - we can directly select Docker
  const url = page.url();
  if (/\/admin\/repositories\/local\/new\/?/i.test(url) || /\/#\/admin\/repositories\/local\/new\/?/i.test(url)) {
    // Already on the new repo page, just return true to proceed with Docker selection
    return true;
  }

  // JCR 7.x Onboarding Page: check for "Create a Repository" CTA card first.
  // This card appears on the /ui/admin/onboarding-page route.
  // 
  // IMPORTANT: JCR 7.x has a tricky UI where the CTA button exists but clicking it
  // might not work due to overlay/pointer intercept issues. We'll try multiple approaches:
  // 1. Try clicking the CTA button using JavaScript evaluation (bypasses Playwright hit-testing)
  // 2. Watch for navigation/modal changes after click
  // 3. If no change, try navigating via sidebar menu instead
  
  const ctaBtn = page.locator('button.cta-button:has(.icon-jfui-repositories)').first();
  const ctaVisible = await ctaBtn.isVisible({ timeout: 3_000 }).catch(() => false);
  
  if (ctaVisible) {
    // Capture current URL to detect navigation
    const urlBefore = page.url();
    
    // Use JavaScript to click the CTA button, triggering Vue's click handler
    const clicked = await ctaBtn.evaluate((el) => {
      const btn = el as HTMLButtonElement;
      // Create and dispatch a proper mouse click event
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
        button: 0,
      });
      btn.dispatchEvent(clickEvent);
      return true;
    }).catch(() => false);
    
    if (clicked) {
      // Wait for either:
      // 1. A modal to appear (repository-type-modal)
      // 2. Navigation to a new URL
      // 3. The Docker package type selector to become visible
      const waitResult = await Promise.race([
        page.locator('[data-cy="repository-type-modal"]').waitFor({ state: 'visible', timeout: 5_000 }).then(() => 'modal'),
        page.locator('[data-cy="repositorySelectPackageTypedocker"]').waitFor({ state: 'visible', timeout: 5_000 }).then(() => 'docker'),
        page.waitForURL((u) => u.href !== urlBefore, { timeout: 5_000 }).then(() => 'nav'),
        new Promise((resolve) => setTimeout(() => resolve('timeout'), 5_000)),
      ]).catch(() => 'error');
      
      if (waitResult === 'modal' || waitResult === 'docker') {
        return true;
      }
      
      // If navigation happened, check if we're on a repo creation page
      if (waitResult === 'nav') {
        const newUrl = page.url();
        if (/\/repositories\/local\/new\/?/i.test(newUrl)) {
          return true;
        }
      }
    }
  }
  
  // Fallback: Try other CTA selectors
  const onboardingCtaSelectors = [
    page.locator('.onboarding-card button:has-text("Create a Repository")'),
    page.locator('button:has-text("Create a Repository")'),
    page.getByRole('button', { name: /create\s+a?\s*repository/i }),
    page.locator('.card-element:has(.icon-jfui-repositories)'),
  ];

  const clickedOnboardingCta = await clickFirstVisible(page, onboardingCtaSelectors, Math.min(5_000, timeoutMs));
  if (clickedOnboardingCta) {
    // The onboarding CTA opens a package type selection modal directly.
    // Wait a brief moment for the modal to render.
    await page.waitForTimeout(500);
    return true;
  }

  // Fall back to the regular "Add Repos" button flow for other pages.
  const addBtn = page.locator('[data-cy="addReposBtn"]').first();

  // Some Element UI dropdowns are configured to open on hover.
  await addBtn.hover({ timeout: Math.min(5_000, timeoutMs) }).catch(() => undefined);
  await addBtn.dispatchEvent('mouseenter').catch(() => undefined);

  // Keep click as a fallback (some versions use click-trigger).
  await clickFirstVisible(
    page,
    [addBtn, page.getByRole('button', { name: /add\s+repos|add\s+repository|new\s+repository|new/i })],
    Math.min(10_000, timeoutMs)
  );

  const menuId = await addBtn.getAttribute('aria-controls').catch(() => null);
  const menu = menuId
    ? page.locator(`#${menuId}`)
    : page.locator('[data-cy="addReposDropdown"], .el-dropdown-menu.el-popper, [id^="dropdown-menu-"]');

  // If the menu is still hidden, try hovering again to force it open.
  await menu.first().waitFor({ state: 'visible', timeout: Math.min(2_000, timeoutMs) }).catch(async () => {
    await addBtn.hover({ timeout: Math.min(5_000, timeoutMs) }).catch(() => undefined);
    await addBtn.dispatchEvent('mouseenter').catch(() => undefined);
    await menu.first().waitFor({ state: 'visible', timeout: Math.min(10_000, timeoutMs) }).catch(() => undefined);
  });

  // Prefer explicit "Local" creation entry.
  const picked = await clickFirstVisible(
    page,
    [
      menu.getByRole('menuitem', { name: /local/i }),
      menu.getByRole('option', { name: /local/i }),
      menu.getByText(/local/i),
      page.getByRole('menuitem', { name: /local/i }),
    ],
    Math.min(10_000, timeoutMs)
  );

  return picked;
}

async function fillFirstVisible(page: Page, selectors: Array<ReturnType<Page['locator']>>, value: string, timeoutMs: number) {
  const start = Date.now();
  for (const loc of selectors) {
    const remaining = Math.max(500, timeoutMs - (Date.now() - start));
    try {
      if (await loc.first().isVisible({ timeout: Math.min(2_000, remaining) })) {
        await loc.first().fill(value, { timeout: Math.min(5_000, remaining) });
        return true;
      }
    } catch {
      // ignore
    }
  }
  return false;
}

async function tryLogin(page: Page, username: string, password: string, timeoutMs: number): Promise<boolean> {
  // Many Artifactory builds use a login form rendered by JS.
  // Wait for a visible password field before attempting to fill.
  const start = Date.now();
  try {
    await page.locator('input[type="password"]').first().waitFor({ state: 'visible', timeout: Math.min(10_000, timeoutMs) });
  } catch {
    return false;
  }

  const remainingForFill = Math.max(1_000, timeoutMs - (Date.now() - start));

  let userFilled = await fillFirstVisible(
    page,
    [
      page.getByLabel(/user(name)?/i),
      page.locator('input[autocomplete="username" i]'),
      page.locator('input[name="username" i]'),
      page.locator('input#username'),
      page.locator('input[name*="user" i]'),
      page.locator('input[name*="login" i]'),
      page.locator('input[type="email"]').first(),
      page.locator('input[type="text"]').first(),
    ],
    username,
    remainingForFill
  );

  // Fallback: fill the first visible non-password input.
  if (!userFilled) {
    try {
      const inputs = page.locator('input:visible');
      const count = await inputs.count();
      for (let i = 0; i < count; i++) {
        const input = inputs.nth(i);
        const type = (await input.getAttribute('type'))?.toLowerCase() ?? '';
        if (type === 'password') continue;
        await input.fill(username, { timeout: Math.min(5_000, remainingForFill) });
        userFilled = true;
        break;
      }
    } catch {
      // ignore
    }
  }

  const passFilled = await fillFirstVisible(
    page,
    [page.getByLabel(/password/i), page.locator('input[type="password"]').first()],
    password,
    remainingForFill
  );

  if (!userFilled || !passFilled) return false;

  const clicked = await clickFirstVisible(
    page,
    [
      page.getByRole('button', { name: /log\s*in|sign\s*in/i }),
      page.getByRole('button', { name: /login/i }),
      page.locator('button[type="submit"]'),
    ],
    timeoutMs
  );

  if (!clicked) return false;

  // Heuristics: successful login typically leaves /ui/login and/or hides the password field.
  try {
    await page.waitForTimeout(1_000);

    // Prefer URL-based check if possible.
    try {
      await page.waitForURL(
        (u) => !u.pathname.endsWith('/ui/login/') && !u.pathname.endsWith('/ui/login'),
        { timeout: Math.min(10_000, timeoutMs) }
      );
      return true;
    } catch {
      // Fall back to checking whether the password field remains visible.
      const stillHasPassword = await page
        .locator('input[type="password"]').first()
        .isVisible({ timeout: 1_000 })
        .catch(() => false);
      return !stillHasPassword;
    }
  } catch {
    return false;
  }
}

function buildRepoAdminCandidates(baseUiUrl: string): string[] {
  const origin = new URL(baseUiUrl).origin;
  const basePath = '/ui/';

  // JCR 7.x: The repositories list page works best.
  // From there we can use the "Add Repos" dropdown menu to create a new local repo.
  return [
    // JCR 7.x repositories list (preferred - we'll use the Add Repos dropdown)
    `${origin}${basePath}admin/repositories`,
    // Direct new local repo page as fallback
    `${origin}${basePath}admin/repositories/local/new`,
    // JCR 7.x onboarding page with CTA buttons
    `${origin}${basePath}admin/onboarding-page`,
    // Hash routes for older versions
    `${origin}${basePath}#/admin/repositories/local/new`,
    `${origin}${basePath}#/admin/repositories/local`,
    `${origin}${basePath}#/admin/repositories`,
    // Non-hash routes as fallback
    `${origin}${basePath}admin/repositories/local`,
    `${origin}${basePath}`,
  ];
}

/**
 * JCR 7.x has a tricky UI where the `<main class="el-main">` element intercepts pointer events.
 * This helper function uses JavaScript evaluate to dispatch events and click elements,
 * bypassing Playwright's hit-testing which would otherwise fail.
 */
async function jsClick(_page: Page, locator: Locator): Promise<boolean> {
  try {
    await locator.evaluate((el: HTMLElement) => {
      el.scrollIntoView({ block: 'center', inline: 'center' });
      el.click();
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Fills an input field using JavaScript, dispatching proper events for Vue/Element UI reactivity.
 */
async function jsFillInput(_page: Page, locator: Locator, value: string): Promise<boolean> {
  try {
    await locator.evaluate((el: HTMLInputElement, val: string) => {
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Opens a dropdown menu by dispatching mouseenter/mouseover events.
 * Element UI dropdowns often use hover triggers rather than click.
 */
async function jsOpenDropdown(_page: Page, locator: Locator): Promise<boolean> {
  try {
    await locator.evaluate((el: HTMLElement) => {
      el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });
    return true;
  } catch {
    return false;
  }
}

async function ensureRepoExistsViaUi(
  page: Page,
  baseUiUrl: string,
  repoKey: string,
  timeoutMs: number,
  creds: { username: string; password: string; fallbackPassword?: string }
): Promise<boolean> {
  const candidates = buildRepoAdminCandidates(baseUiUrl);

  for (const url of candidates) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: Math.min(45_000, timeoutMs) });
      await page.waitForTimeout(1_000);

      await applyUiWorkarounds(page);

      if (await isOnLoginScreen(page)) {
        const primaryOk = await tryLogin(page, creds.username, creds.password, 25_000);
        let loggedIn = primaryOk;
        if (!loggedIn && creds.fallbackPassword) {
          loggedIn = await tryLogin(page, creds.username, creds.fallbackPassword, 25_000);
        }
        if (!loggedIn) continue;

        // Re-try navigation now that we're authenticated.
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: Math.min(45_000, timeoutMs) });
        await page.waitForTimeout(1_000);
        await applyUiWorkarounds(page);
      }

      // JCR can block UI functionality until the EULA is signed.
      await ensureEulaSigned(page, baseUiUrl, timeoutMs);

      // Check if repo already exists
      if (await page.getByText(repoKey).first().isVisible({ timeout: 2_000 }).catch(() => false)) {
        return true;
      }

      // ========== JCR 7.x Approach: Use Add Repos dropdown ==========
      // This approach works by:
      // 1. Opening the Add Repos dropdown via mouseenter/mouseover events
      // 2. Clicking "Local Repository" from the dropdown menu
      // 3. Selecting Docker package type
      // 4. Filling the repo key
      // 5. Submitting the form
      
      const addReposBtn = page.locator('[data-cy="addReposBtn"]');
      if (await addReposBtn.count() > 0) {
        // Open the dropdown menu
        await jsOpenDropdown(page, addReposBtn);
        await page.waitForTimeout(500);
        
        // Click "Local Repository" from the dropdown
        const dropdown = page.locator('[data-cy="addReposDropdown"]');
        const localItem = dropdown.locator('li').first();
        
        if (await localItem.boundingBox().catch(() => null)) {
          await jsClick(page, localItem);
          await page.waitForTimeout(2_000);
          
          // Now we should be on the package type selection page
          // Click Docker selector
          const docker = page.locator('[data-cy="repositorySelectPackageTypedocker"]');
          if (await docker.boundingBox().catch(() => null)) {
            await jsClick(page, docker);
            await page.waitForTimeout(2_000);
            
            // Fill the repo key field
            const repoKeyInput = page.locator('[data-cy="repo-key"]');
            if (await repoKeyInput.boundingBox().catch(() => null)) {
              await jsFillInput(page, repoKeyInput, repoKey);
              await page.waitForTimeout(500);
              
              // Click submit button
              const submitBtn = page.locator('[data-cy="form-submit"]');
              if (await submitBtn.boundingBox().catch(() => null)) {
                await jsClick(page, submitBtn);
                await page.waitForTimeout(3_000);
                
                // Verify repo was created by checking the list
                const origin = new URL(baseUiUrl).origin;
                await page.goto(`${origin}/ui/admin/repositories/local`, {
                  waitUntil: 'domcontentloaded',
                  timeout: 30_000,
                });
                await page.waitForTimeout(1_000);
                
                if (await page.getByText(repoKey).first().isVisible({ timeout: 10_000 }).catch(() => false)) {
                  return true;
                }
              }
            }
          }
        }
      }

      // ========== Fallback: Try the original approach for other versions ==========
      // Attempt to create it using the original openCreateLocalRepoFlow method.
      const openedCreate = await openCreateLocalRepoFlow(page, 15_000);
      if (!openedCreate) continue;

      await applyUiWorkarounds(page);

      // EULA prompt can also show up mid-navigation.
      await ensureEulaSigned(page, baseUiUrl, timeoutMs);

      // We should now be in the "create repository" flow.
      // Some Artifactory versions show a modal to choose the repository package type.
      const repoTypeModal = page.locator('[data-cy="repository-type-modal"]').first();
      const modalVisible = await repoTypeModal.isVisible({ timeout: 1_000 }).catch(() => false);

      // Some versions/routes land directly on the create-local-repo form without a package-type modal.
      // In that case, skip trying to click "Docker" and proceed to filling the repo key.
      const keyAlreadyVisible = await waitForAnyVisible(
        page,
        [page.getByLabel(/repository\s*key/i), page.locator('input[name*="key" i]'), page.locator('input[placeholder*="key" i]')],
        1_000
      ).catch(() => false);

      if (!keyAlreadyVisible) {
        const main = page.locator('main.el-main').first();
        
        // Try to click Docker using JavaScript for JCR 7.x compatibility
        const dockerLoc = page.locator('[data-cy="repositorySelectPackageTypedocker"]').first();
        let pickedDocker = false;
        
        if (await dockerLoc.boundingBox().catch(() => null)) {
          await jsClick(page, dockerLoc);
          await page.waitForTimeout(500);
          
          // Check if repo key field appeared
          const keyVisible = await page.locator('[data-cy="repo-key"]').isVisible({ timeout: 2_000 }).catch(() => false);
          if (keyVisible) {
            pickedDocker = true;
          }
        }
        
        // Fallback to the regular clickFirstVisible if direct approach didn't work
        if (!pickedDocker) {
          pickedDocker = await clickFirstVisible(
            page,
            [
              repoTypeModal.locator('[data-cy="repositorySelectPackageTypedocker"]'),
              repoTypeModal.getByRole('button', { name: /^docker$/i }),
              repoTypeModal.getByRole('link', { name: /^docker$/i }),
              repoTypeModal.getByText(/^docker$/i),
              main.getByRole('button', { name: /^docker$/i }),
              main.getByRole('link', { name: /^docker$/i }),
              main.getByText(/^docker$/i),
              main.getByText(/docker\s+repository/i),
              page.getByRole('button', { name: /^docker$/i }),
            ],
            15_000
          );
        }

        if (!pickedDocker) continue;

        // If we clicked inside the modal, wait for it to close and for the actual form to render.
        if (modalVisible) {
          await repoTypeModal.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => undefined);
        }

        // Wait a moment for the form to render after selecting Docker
        await page.waitForTimeout(1_000);

        // JCR 7.x may show a second modal for repository type (Local/Remote/Virtual/Federated)
        const localRepoBtn = page.locator('[data-cy="repositorySelectTypelocal"], button:has-text("Local Repository"), button:has-text("Local")').first();
        if (await localRepoBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await localRepoBtn.click({ timeout: 5_000 }).catch(() => undefined);
          await page.waitForTimeout(500);
        }
      }

      // EULA can prevent the create form from fully activating.
      await ensureEulaSigned(page, baseUiUrl, timeoutMs);

      // Wait for the repo key field to become available.
      await waitForAnyVisible(
        page,
        [page.locator('[data-cy="repo-key"]'), page.getByLabel(/repository\s*key/i), page.locator('input[name*="key" i]'), page.locator('input[placeholder*="key" i]')],
        10_000
      ).catch(() => undefined);

      await applyUiWorkarounds(page);

      // Fill repository key - try the JCR 7.x selector first
      let keyFilled = false;
      const repoKeyInput = page.locator('[data-cy="repo-key"]');
      if (await repoKeyInput.boundingBox().catch(() => null)) {
        keyFilled = await jsFillInput(page, repoKeyInput, repoKey);
      }
      
      // Fallback to original approach
      if (!keyFilled) {
        keyFilled = await fillFirstVisible(
          page,
          [
            page.getByLabel(/repository\s*key/i),
            page.locator('input[name*="key" i]'),
            page.locator('input[placeholder*="key" i]'),
          ],
          repoKey,
          15_000
        );
      }

      if (!keyFilled) continue;

      // Make sure we didn't accidentally land on the login screen mid-flow.
      if (await isOnLoginScreen(page)) continue;

      // Save - try JCR 7.x selector first
      let saved = false;
      const submitBtn = page.locator('[data-cy="form-submit"]');
      if (await submitBtn.boundingBox().catch(() => null)) {
        saved = await jsClick(page, submitBtn);
      }
      
      // Fallback to original approach
      if (!saved) {
        saved = await clickFirstEnabledVisible(
          page,
          [
            page.getByRole('button', { name: /^save$/i }),
            page.getByRole('button', { name: /^create$/i }),
            page.getByRole('button', { name: /finish/i }),
          ],
          15_000
        );
      }

      if (!saved) continue;

      // Allow UI time to persist.
      await page.waitForTimeout(3_000);

      // Verify it appears on the local repos listing.
      const origin = new URL(baseUiUrl).origin;
      await page.goto(`${origin}/ui/admin/repositories/local`, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
      await page.waitForTimeout(1_000);
      if (await page.getByText(repoKey).first().isVisible({ timeout: 10_000 }).catch(() => false)) return true;
    } catch {
      // try next candidate
    }
  }

  return false;
}

export async function ensureArtifactoryDockerRepoViaUi(opts: ArtifactoryUiBootstrapOptions): Promise<{ ok: boolean; artifactDir: string }>{
  const runId = opts.runId ?? process.env.E2E_RUN_ID ?? 'local';
  const artifactDir = path.join(e2eRoot, 'test-results', 'jfrog-ui-bootstrap', `${runId}-${isoNowForFile()}`);
  await ensureDir(artifactDir);

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const startUrl = opts.baseUiUrl.replace(/\/+$/, '') + '/';
    await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: Math.min(45_000, opts.timeoutMs) });

    await applyUiWorkarounds(page);

    // Login if needed.
    await page.waitForTimeout(1_000);
    if (await isOnLoginScreen(page)) {
      const primaryOk = await tryLogin(page, opts.username, opts.password, 25_000);
      if (!primaryOk && opts.fallbackPassword) {
        const fallbackOk = await tryLogin(page, opts.username, opts.fallbackPassword, 25_000);
        if (!fallbackOk) {
          await page.screenshot({ path: path.join(artifactDir, 'login-failed.png'), fullPage: true });
          return { ok: false, artifactDir };
        }
      } else if (!primaryOk) {
        await page.screenshot({ path: path.join(artifactDir, 'login-failed.png'), fullPage: true });
        return { ok: false, artifactDir };
      }
    }

    await applyUiWorkarounds(page);

    // Accept/sign EULA if required (JCR often blocks admin screens otherwise).
    await ensureEulaSigned(page, startUrl, opts.timeoutMs, artifactDir);

    const ok = await ensureRepoExistsViaUi(page, startUrl, opts.repoKey, opts.timeoutMs, {
      username: opts.username,
      password: opts.password,
      fallbackPassword: opts.fallbackPassword,
    });

    if (!ok) {
      await page.screenshot({ path: path.join(artifactDir, 'repo-create-failed.png'), fullPage: true });

      const info = `url=${page.url()}\ntitle=${await page.title().catch(() => '')}\n`;
      await writeSmallFile(path.join(artifactDir, 'page-info.txt'), info);

      // Capture small, targeted UI text for debugging (bounded, no huge bundles).
      const systemMessagesText = await page
        .locator('[data-cy="systemMessagesContainer"]')
        .first()
        .innerText()
        .catch(() => '');
      if (systemMessagesText.trim()) {
        await writeSmallFile(path.join(artifactDir, 'system-messages.txt'), systemMessagesText);
      }

      const systemMessagesHtml = await page
        .locator('[data-cy="systemMessagesContainer"]')
        .first()
        .evaluate((el) => (el as HTMLElement).outerHTML)
        .catch(() => '');
      if (systemMessagesHtml.trim()) {
        const bounded = systemMessagesHtml.length <= 20_000 ? systemMessagesHtml : systemMessagesHtml.slice(0, 20_000);
        await writeSmallFile(path.join(artifactDir, 'system-messages.html.snippet.txt'), bounded);
      }

      // Only try to read modal text if it exists quickly; don't block failure handling.
      const repoTypeModal = page.locator('[data-cy="repository-type-modal"]').first();
      const repoTypeModalText = (await repoTypeModal.isVisible({ timeout: 750 }).catch(() => false))
        ? await repoTypeModal.innerText({ timeout: 1_000 }).catch(() => '')
        : '';
      if (repoTypeModalText.trim()) {
        await writeSmallFile(path.join(artifactDir, 'repo-type-modal.txt'), repoTypeModalText);
      }

      // Store a small HTML snippet for debugging without dumping huge bundles.
      const html = await page.content();
      // Keep bounded diagnostics: store head+tail so we catch modals/toasts and app root markup.
      if (html.length <= 20_000) {
        await writeSmallFile(path.join(artifactDir, 'repo-create-failed.html.snippet.txt'), html);
      } else {
        const head = html.slice(0, 10_000);
        const tail = html.slice(-10_000);
        await writeSmallFile(
          path.join(artifactDir, 'repo-create-failed.html.snippet.txt'),
          `${head}\n\n<!-- SNIP -->\n\n${tail}`
        );
      }
    }

    return { ok, artifactDir };
  } catch {
    return { ok: false, artifactDir };
  } finally {
    await browser?.close().catch(() => undefined);
  }
}
