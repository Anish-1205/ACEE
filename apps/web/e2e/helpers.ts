import { expect, type Page } from '@playwright/test';

export const DEMO_PASSWORD = 'AceeDemo2026';

export async function setLang(page: Page, lang: 'en' | 'te' | 'hi') {
  await page.context().addCookies([{ name: 'lang', value: lang, url: 'http://localhost:3000' }]);
}

/** Logs in through the UI. The login page switches the UI to the user's saved language. */
export async function login(page: Page, email: string, password = DEMO_PASSWORD) {
  await page.context().clearCookies();
  await setLang(page, 'en');
  await page.goto('/login');
  await page.getByLabel('Email or mobile number').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** Next Monday–Saturday date (IST) on which seeded counselors work. */
export function nextWorkday(): string {
  const d = new Date(Date.now() + 5.5 * 3600_000 + 86_400_000);
  while (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
