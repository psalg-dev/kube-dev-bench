import { expect, type Page, type Locator } from '@playwright/test';

// The app replaced window.confirm/prompt with an in-DOM BaseModal (ModalProvider,
// driven by showModalConfirm/showModalPrompt). These helpers drive that modal from
// e2e tests instead of page.once('dialog'). Click the triggering button FIRST, then
// call one of these — the modal is queued on click.
//
// A ModalProvider dialog can render on top of another BaseModal (e.g. a confirm over
// an edit modal), so several .base-modal-container may coexist. Scope to the provider
// dialog by its distinctive control (Confirm button / #prompt-input) to stay unambiguous.

function confirmModal(page: Page): Locator {
  return page
    .locator('.base-modal-container')
    .filter({ has: page.getByRole('button', { name: 'Confirm', exact: true }) });
}

function promptModal(page: Page): Locator {
  return page.locator('.base-modal-container').filter({ has: page.locator('#prompt-input') });
}

export async function acceptModalConfirm(page: Page, expectText?: string | RegExp, timeoutMs = 10_000): Promise<void> {
  const modal = confirmModal(page);
  await expect(modal).toBeVisible({ timeout: timeoutMs });
  if (expectText !== undefined) {
    await expect(modal).toContainText(expectText, { timeout: timeoutMs });
  }
  await modal.getByRole('button', { name: 'Confirm', exact: true }).click();
}

export async function dismissModalConfirm(page: Page, expectText?: string | RegExp, timeoutMs = 10_000): Promise<void> {
  const modal = confirmModal(page);
  await expect(modal).toBeVisible({ timeout: timeoutMs });
  if (expectText !== undefined) {
    await expect(modal).toContainText(expectText, { timeout: timeoutMs });
  }
  await modal.getByRole('button', { name: 'Cancel', exact: true }).click();
}

export async function respondModalPrompt(page: Page, value: string, timeoutMs = 10_000): Promise<void> {
  const modal = promptModal(page);
  await expect(modal).toBeVisible({ timeout: timeoutMs });
  await modal.locator('#prompt-input').fill(value);
  await modal.getByRole('button', { name: 'OK', exact: true }).click();
}
