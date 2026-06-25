import { expect, type Page } from '@playwright/test';

export class CreateOverlay {
  constructor(private readonly page: Page) {}

  async openFromOverviewHeader() {
    // Different sections expose different create buttons:
    // - Most resources: "Create new"
    // - Pods: a "+" button with aria-label "Create" and class "overview-create-btn"
    // Prefer a short, retrying strategy instead of relying on a single locator.
    const clickTimeoutMs = 10_000;
    const attempts: Array<() => Promise<void>> = [
      async () => {
        const btn = this.page.getByRole('button', { name: /create new/i }).first();
        await btn.waitFor({ state: 'visible', timeout: clickTimeoutMs });
        await btn.scrollIntoViewIfNeeded();
        await btn.click({ timeout: clickTimeoutMs });
      },
      async () => {
        const btn = this.page.getByRole('button', { name: /^create$/i }).first();
        await btn.waitFor({ state: 'visible', timeout: clickTimeoutMs });
        await btn.scrollIntoViewIfNeeded();
        await btn.click({ timeout: clickTimeoutMs });
      },
      async () => {
        const btn = this.page.locator('.overview-create-btn').first();
        await btn.waitFor({ state: 'visible', timeout: clickTimeoutMs });
        await btn.scrollIntoViewIfNeeded();
        await btn.click({ timeout: clickTimeoutMs });
      },
    ];

    let lastErr: unknown;
    for (const fn of attempts) {
      try {
        await fn();
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (lastErr) {
      throw lastErr;
    }

    // Robustly wait for the overlay to appear. Different overlays expose
    // different controls (some have a "Close" button, others show "Cancel"
    // and "Create", and some render a dialog container). Check for any of
    // these to avoid flakiness across resource types.
    const timeoutMs = 20_000;
    const start = Date.now();
    const overlay = this.page.locator('[data-testid="create-manifest-overlay"]').first();
    while (Date.now() - start < timeoutMs) {
      const overlayVisible = await overlay.isVisible().catch(() => false);
      const createVisible = await this.page.getByRole('button', { name: /^create$/i }).isVisible().catch(() => false);
      const cancelVisible = await this.page.getByRole('button', { name: /^cancel$/i }).isVisible().catch(() => false);
      const dialogVisible = await this.page.locator('[role="dialog"]').first().isVisible().catch(() => false);
      if (overlayVisible || createVisible || cancelVisible || dialogVisible) return;
      await this.page.waitForTimeout(100);
    }

    throw new Error('Create overlay did not appear within timeout');
  }

  async fillYaml(yaml: string) {
    const editor = this.page.locator('.cm-content').first();
    await expect(editor).toBeVisible();

    // Use page.evaluate to interact with CodeMirror 6 API directly.
    // This is more reliable than keyboard events for replacing editor content.
    await this.page.evaluate((newContent) => {
      const cmContent = document.querySelector('.cm-content');
      if (!cmContent) throw new Error('CodeMirror .cm-content not found');

      // Try several ways to access the CodeMirror 6 EditorView.
      const tryView = (el: any) => el?.cmView?.view || el?.__cmView?.view || el?.cmView || el?.view || null;

      // 1) Directly on the content element
      let view = tryView(cmContent as any);

      // 2) On the closest editor container
      if (!view) {
        const cmEditor = cmContent.closest?.('.cm-editor') || document.querySelector('.cm-editor');
        view = tryView(cmEditor as any);
      }

      // 3) Search any editor elements on the page for a view
      if (!view) {
        const editors = Array.from(document.querySelectorAll('.cm-editor, .cm-content'));
        for (const e of editors) {
          const v = tryView(e as any);
          if (v) {
            view = v;
            break;
          }
        }
      }

      // If we found an EditorView, use the official transaction API to replace the document.
      if (view && view.dispatch && view.state) {
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: newContent } });
        return;
      }

      // Last-resort fallback: replace the editable DOM content and dispatch an input event.
      // This may not update CodeMirror's internal state in all builds, but it works for many setups
      // where the editor is contenteditable and listens for input events.
      (cmContent as HTMLElement).textContent = newContent;
      const ev = new InputEvent('input', { bubbles: true, cancelable: true });
      cmContent.dispatchEvent(ev);
    }, yaml);

    // Brief wait for React state to sync if needed
    await this.page.waitForTimeout(100);
  }

  async create() {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const overlay = this.page
        .locator('[data-testid="create-manifest-overlay"], [role="dialog"]')
        .first();
      const overlayVisible = await overlay.isVisible().catch(() => false);
      const overlayScope = overlayVisible ? overlay : this.page;
      const successToasts = this.page.locator('#gh-notification-container .gh-notification--success .gh-notification__text');
      const successBaseline = await successToasts.count().catch(() => 0);

      // Wait for the Create button to be visible and clickable, then click.
      // Try several candidate selectors for the overlay submit button.
      const candidates = [
        overlayScope.getByRole('button', { name: /^create$/i }).first(),
        overlayScope.locator('button', { hasText: 'Create' }).first(),
        overlayScope.getByRole('button', { name: /apply|submit|create/i }).first(),
        overlayScope.locator('[role="dialog"] button', { hasText: 'Create' }).first(),
      ];

      let clicked = false;
      for (const cand of candidates) {
        try {
          await cand.waitFor({ state: 'visible', timeout: 30_000 });
          await cand.scrollIntoViewIfNeeded();
          await cand.click({ timeout: 10_000 });
          clicked = true;
          break;
        } catch (err) {
          // try next candidate
        }
      }

      if (!clicked) {
        // Fallback: try pressing CTRL/CMD+Enter while the editor is focused to submit.
        try {
          const cm = this.page.locator('.cm-content').first();
          if (await cm.isVisible().catch(() => false)) {
            await cm.focus();
            const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
            await this.page.keyboard.press(`${modifier}+Enter`);
            clicked = true;
          }
        } catch (err) {
          // ignore
        }
      }

      if (!clicked) {
        if (attempt < maxAttempts) {
          await this.page.waitForTimeout(1000 * attempt);
          continue;
        }
        throw new Error('Create button not found or not clickable');
      }

      // Overlay closes on success; on failure it shows an inline error.
      // Errors can be: YAML parse errors, REST mapping errors (connectivity), or other API errors.
      const parseError = overlayScope.getByText(/YAML parse error/i).first();
      const apiError = overlayScope.getByText(/could not find REST mapping|dial tcp|connectex|read tcp|connection reset by peer|unexpected eof|\bEOF\b|Bad Gateway|502/i).first();
      const overlayError = overlayScope.locator('[data-testid="create-overlay-error"]').first();
      const errorToast = this.page
        .locator('#gh-notification-container .gh-notification--error .gh-notification__text')
        .first();

      const closeOverlay = async () => {
        const isOpen = await overlay.isVisible().catch(() => false);
        if (!isOpen) return;

        const closeCandidates = [
          overlay.getByRole('button', { name: /close|cancel/i }).first(),
          overlay.locator('[aria-label="Close"]').first(),
          overlay.locator('.modal-close, .popup-close').first(),
        ];

        for (const cand of closeCandidates) {
          if (await cand.isVisible().catch(() => false)) {
            await cand.click().catch(() => undefined);
            break;
          }
        }

        await this.page.keyboard.press('Escape').catch(() => undefined);
        await overlay.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => undefined);
      };

      const timeoutMs = 60_000;
      const start = Date.now();

      while (Date.now() - start < timeoutMs) {
        const stillOpen = await overlay.isVisible().catch(() => false);
        if (!stillOpen) {
          // Overlay close is the primary success signal for this flow.
          // Notification rendering can race and does not always increase toast count.
          return;
        }

        const parseVisible = await parseError.isVisible().catch(() => false);
        if (parseVisible) {
          const msg = await parseError.textContent({ timeout: 2_000 }).then(t => t?.trim()).catch(() => undefined);
          if (msg === undefined) continue; // element vanished, re-check loop
          throw new Error(`Create failed: ${msg || 'YAML parse error'}`);
        }

        const overlayErrVisible = await overlayError.isVisible().catch(() => false);
        if (overlayErrVisible) {
          const msg = await overlayError.textContent({ timeout: 2_000 }).then(t => t?.trim()).catch(() => undefined);
          if (msg === undefined) continue; // element vanished, re-check loop
          const transient = /Bad Gateway|502|dial tcp|read tcp|connectex|connection reset by peer|unexpected eof|\bEOF\b|proxyconnect|connection refused|timeout|timed out|deadline exceeded|i\/o timeout/i.test(msg || '');
          if (transient && attempt < maxAttempts) {
            await this.page.waitForTimeout(1000 * attempt);
            break;
          }
          throw new Error(`Create failed: ${msg || 'Create overlay error'}`);
        }

        const apiVisible = await apiError.isVisible().catch(() => false);
        if (apiVisible) {
          // Use a short timeout to avoid racing: the element can disappear between
          // the isVisible() check and the textContent() call.
          const msg = await apiError.textContent({ timeout: 2_000 }).then(t => t?.trim()).catch(() => undefined);
          if (msg === undefined) continue; // element vanished, re-check loop
          // If the API error looks transient (network / gateway), retry a few times.
          const transient = /Bad Gateway|502|dial tcp|read tcp|connectex|connection reset by peer|unexpected eof|\bEOF\b/i.test(msg || '');
          if (transient && attempt < maxAttempts) {
            // Close any visible dialog before retrying to reset state
            try {
              const cancel = this.page.getByRole('button', { name: /^cancel$/i }).first();
              if (await cancel.isVisible().catch(() => false)) await cancel.click();
            } catch {}
            // small backoff
            await this.page.waitForTimeout(1000 * attempt);
            break; // break inner wait loop and retry
          }

          throw new Error(`Create failed: ${msg || 'API error'}`);
        }

        const toastVisible = await errorToast.isVisible().catch(() => false);
        if (toastVisible) {
          const msg = await errorToast.textContent({ timeout: 2_000 }).then(t => t?.trim()).catch(() => undefined);
          if (msg === undefined) continue; // element vanished, re-check loop
          const transient = /Bad Gateway|502|dial tcp|read tcp|connectex|connection reset by peer|unexpected eof|\bEOF\b|proxyconnect|connection refused|timeout|timed out|deadline exceeded|i\/o timeout/i.test(msg || '');
          if (transient && attempt < maxAttempts) {
            await this.page.waitForTimeout(1000 * attempt);
            break;
          }
          throw new Error(`Create failed: ${msg || 'Notification error'}`);
        }

        const successCount = await successToasts.count().catch(() => 0);
        if (successCount > successBaseline) {
          await closeOverlay();
          return;
        }

        await this.page.waitForTimeout(250);
      }
      // If we reach here and attempt < maxAttempts, the loop will retry.
    }

    throw new Error('Create did not complete within retry attempts.');
  }
}
