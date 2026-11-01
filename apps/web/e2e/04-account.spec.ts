import { expect, test } from '@playwright/test';
import { login, setLang } from './helpers';

/** Newest email to `to` in Mailpit (docker compose service `mail`). */
async function latestCode(to: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const list = await (await fetch(`http://localhost:8025/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`)).json() as { messages?: { ID: string }[] };
    if (list.messages?.length) {
      const msg = await (await fetch(`http://localhost:8025/api/v1/message/${list.messages[0]!.ID}`)).json() as { Text: string };
      return /\b(\d{6})\b/.exec(msg.Text)![1]!;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no email for ${to}`);
}

test('a student resets a forgotten password with an emailed code', async ({ page }) => {
  const email = 'student2@demo.acee.test';
  await fetch(`http://localhost:8025/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`, { method: 'DELETE' });
  await setLang(page, 'en');
  await page.goto('/login');
  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await page.waitForLoadState('networkidle'); // let React hydrate before typing
  await page.getByLabel('Email or mobile number').fill(email);
  await page.getByRole('button', { name: 'Send code' }).click();
  await expect(page.getByText(/emailed a 6-digit code/)).toBeVisible();
  await page.getByLabel('6-digit code').fill(await latestCode(email));
  await page.getByLabel('Create a password').fill('ResetPassword42');
  await page.getByRole('button', { name: 'Set new password' }).click();
  await expect(page.getByText('Your password has been changed.')).toBeVisible();
  await login(page, email, 'ResetPassword42');
  await expect(page).toHaveURL(/\/dashboard/);
});

test('admin edits the home page banner with a form, no JSON', async ({ page }) => {
  await login(page, 'admin@demo.acee.test');
  await page.goto('/admin/content');
  await page.waitForLoadState('networkidle');
  const banner = page.locator('section', { has: page.getByRole('heading', { name: 'Home page banner' }) });
  await banner.getByRole('textbox', { name: 'English' }).fill('E2E banner: new IELTS batch from Monday');
  await banner.getByRole('button', { name: 'Save' }).click();
  await expect(banner.getByText('Saved')).toBeVisible();
  // Public pages cache content for up to a minute, so check what the site will serve.
  const saved = await page.evaluate(async () => (await (await fetch('/api/v1/cms/banner')).json()).content.text.en);
  expect(saved).toBe('E2E banner: new IELTS batch from Monday');
});
