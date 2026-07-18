import { expect, type Page } from '@playwright/test';

// The app replaced window.confirm/prompt with an in-DOM BaseModal (ModalProvider).
// These helpers drive that modal from e2e tests instead of page.once('dialog').

export async function acceptModalConfirm(page: Page, timeoutMs = 10_000): Promise<void> {
  const btn = page.locator('.base-modal-container').getByRole('button', { name: 'Confirm' });
  await expect(btn).toBeVisible({ timeout: timeoutMs });
  await btn.click();
}

export async function dismissModalConfirm(page: Page, timeoutMs = 10_000): Promise<void> {
  const btn = page.locator('.base-modal-container').getByRole('button', { name: 'Cancel' });
  await expect(btn).toBeVisible({ timeout: timeoutMs });
  await btn.click();
}

export async function respondModalPrompt(page: Page, value: string, timeoutMs = 10_000): Promise<void> {
  const input = page.locator('#prompt-input');
  await expect(input).toBeVisible({ timeout: timeoutMs });
  await input.fill(value);
  await page.locator('.base-modal-container').getByRole('button', { name: 'OK' }).click();
}
