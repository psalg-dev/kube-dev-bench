import { expect, type Page, type Locator } from '@playwright/test';

// The app replaced window.confirm/prompt with an in-DOM BaseModal (ModalProvider,
// driven by showModalConfirm/showModalPrompt). These helpers drive that modal from
// e2e tests instead of page.once('dialog'). Click the triggering button FIRST, then
// call one of these — the modal is queued on click.

async function waitForModal(page: Page, expectText?: string | RegExp, timeoutMs = 10_000): Promise<Locator> {
  const container = page.locator('.base-modal-container');
  await expect(container).toBeVisible({ timeout: timeoutMs });
  if (expectText !== undefined) {
    await expect(container).toContainText(expectText, { timeout: timeoutMs });
  }
  return container;
}

export async function acceptModalConfirm(page: Page, expectText?: string | RegExp, timeoutMs = 10_000): Promise<void> {
  const modal = await waitForModal(page, expectText, timeoutMs);
  await modal.getByRole('button', { name: 'Confirm' }).click();
}

export async function dismissModalConfirm(page: Page, expectText?: string | RegExp, timeoutMs = 10_000): Promise<void> {
  const modal = await waitForModal(page, expectText, timeoutMs);
  await modal.getByRole('button', { name: 'Cancel' }).click();
}

export async function respondModalPrompt(page: Page, value: string, timeoutMs = 10_000): Promise<void> {
  const modal = await waitForModal(page, undefined, timeoutMs);
  const input = modal.locator('#prompt-input');
  await expect(input).toBeVisible({ timeout: timeoutMs });
  await input.fill(value);
  await modal.getByRole('button', { name: 'OK' }).click();
}
