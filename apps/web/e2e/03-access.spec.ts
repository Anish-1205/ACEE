import { expect, test } from '@playwright/test';
import { login, setLang } from './helpers';

test('signed-out users are sent to login from portal pages', async ({ page }) => {
  await setLang(page, 'en');
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin/);
});

test('students cannot use the admin console or staff APIs', async ({ page }) => {
  await login(page, 'student2@demo.acee.test');
  await page.goto('/admin');
  await expect(page.getByRole('alert')).toBeVisible();
  const statuses = await page.evaluate(async () => Promise.all(
    ['/api/v1/admin/metrics', '/api/v1/counselor/students', '/api/v1/staff/documents'].map(async (u) => (await fetch(u)).status),
  ));
  expect(statuses).toEqual([403, 403, 403]);
});
