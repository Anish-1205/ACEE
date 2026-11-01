import { expect, test } from '@playwright/test';
import { login } from './helpers';

test.describe.configure({ mode: 'serial' });

test('admin sees metrics and reviews a pending document', async ({ page }) => {
  await login(page, 'admin@demo.acee.test');
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByTestId('metric-students')).not.toHaveText('0');
  await page.goto('/admin/documents');
  const rows = page.getByRole('row', { name: /E2E Student/ });
  await expect(rows).toHaveCount(2); // caste certificate (registration step) + marks memo
  await rows.first().getByRole('button', { name: 'Approve' }).click();
  await expect(rows).toHaveCount(1);
  await rows.first().getByRole('button', { name: 'Approve' }).click();
  await expect(rows).toHaveCount(0);
});

test('admin publishes a new scheme rule version without code changes', async ({ page }) => {
  await login(page, 'admin@demo.acee.test');
  await page.goto('/admin/rules');
  await expect(page.getByText(/UNVERIFIED — ACEE brochure/).first()).toBeVisible();
  await page.getByRole('button', { name: 'New rule version' }).first().click();
  await page.getByLabel('GO reference').fill('G.O.Ms.No.TEST/E2E');
  await page.getByRole('button', { name: 'New rule version' }).last().click();
  await expect(page.getByText('GO reference: G.O.Ms.No.TEST/E2E')).toBeVisible();
});

test('counselor opens an assigned student and adds a private note', async ({ page }) => {
  await login(page, 'counselor1@demo.acee.test');
  await expect(page).toHaveURL(/\/counselor$/);
  await page.getByRole('link', { name: 'Ravi Kumar (Demo)' }).first().click();
  await page.getByRole('textbox', { name: 'Add note' }).fill('E2E follow-up note');
  await page.getByRole('button', { name: 'Add note' }).click();
  await expect(page.getByText('E2E follow-up note')).toBeVisible();
});

test('trainer marks attendance', async ({ page }) => {
  await login(page, 'trainer@demo.acee.test');
  await expect(page).toHaveURL(/\/trainer$/);
  await page.getByRole('link', { name: /IELTS · IELTS Morning/ }).click();
  await page.getByTestId('save-attendance').click();
  await expect(page.getByText('Attendance saved.')).toBeVisible();
});
