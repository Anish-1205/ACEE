import { expect, test } from '@playwright/test';
import { setLang } from './helpers';

test('home page and navigation work on a phone without horizontal scrolling', async ({ page }) => {
  await setLang(page, 'en');
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('From Our Village to a Global Future');
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.locator('#mobile-nav').getByRole('link', { name: 'Coaching' }).click();
  await expect(page).toHaveURL(/\/coaching$/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
