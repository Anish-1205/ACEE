import { expect, test } from '@playwright/test';
import { PDF, nextWorkday, setLang } from './helpers';

test.describe.configure({ mode: 'serial' });

test('a new student registers, checks eligibility, joins coaching, books counseling, uploads a document and tracks the application', async ({ page }) => {
  await setLang(page, 'en');
  const mobile = `8${String(Date.now()).slice(-9)}`;

  // Register
  await page.goto('/register');
  await page.getByLabel('Full name').fill('E2E Student');
  await page.getByLabel('Mobile number').fill(mobile);
  await page.getByLabel('Email address').fill(`e2e-${mobile}@example.com`);
  await page.getByLabel('District').selectOption('Nalgonda');
  await page.getByLabel('Create a password').fill('E2ePassword123');
  await page.getByRole('checkbox', { name: /I agree to the Terms/ }).check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Namaste, E2E' })).toBeVisible();

  // Preliminary eligibility (stored with rule version)
  await page.goto('/dashboard/eligibility');
  const next = page.getByTestId('eligibility-next');
  const pick = async (label: string) => { await page.getByRole('radio', { name: label, exact: true }).check(); await next.click(); };
  await pick('Yes');
  await pick('Scheduled Caste (SC)');
  await page.getByLabel('Annual family income (₹)').fill('300000');
  await next.click();
  await page.getByLabel('Graduation percentage').fill('72');
  await next.click();
  await pick('Graduation completed');
  await pick('USA');
  await pick('I have an admission offer');
  await pick('I have my scores');
  await pick('No');
  await expect(page.getByTestId('eligibility-outcome')).toHaveText('Appears preliminarily eligible');
  await expect(page.getByText('Final eligibility and scholarship selection are determined by the concerned Government of Telangana authorities').first()).toBeVisible();
  await expect(page.getByText('Your result has been saved to your dashboard.')).toBeVisible();

  // Coaching registration
  await page.goto('/coaching/ielts');
  await page.getByTestId('enroll').first().click();
  await expect(page.getByText('You are registered!')).toBeVisible();

  // Counseling booking
  await page.goto('/dashboard/counseling');
  await page.getByRole('radio', { name: 'Scholarship guidance' }).check();
  await page.getByLabel('Choose a date').fill(nextWorkday());
  await page.getByTestId('slot').first().click();
  await page.getByTestId('book').click();
  await expect(page.getByText('Your appointment is booked.')).toBeVisible();

  // Document upload
  await page.goto('/dashboard/documents');
  await page.getByTestId('upload-GRADUATION_MARKSHEET').setInputFiles({ name: 'marks.pdf', mimeType: 'application/pdf', buffer: PDF });
  await expect(page.getByText('Uploaded. ACEE will review it soon.')).toBeVisible();

  // Application tracking
  await page.goto('/dashboard/application');
  await page.getByRole('button', { name: 'Start application assistance' }).click();
  await expect(page.getByTestId('current-stage')).toHaveText('Inquiry Received');
  await expect(page.getByText(/not official government scholarship statuses/)).toBeVisible();

  // Language switching re-renders and persists
  await page.getByTestId('language-switcher').first().selectOption('te');
  await expect(page.getByRole('heading', { name: 'దరఖాస్తు సహాయం' })).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'te-IN');
  await page.getByTestId('language-switcher').first().selectOption('hi');
  await expect(page.getByRole('heading', { name: 'आवेदन सहायता' })).toBeVisible();
});

test('anonymous eligibility check explains a category mismatch and links to the official portal', async ({ page }) => {
  await setLang(page, 'en');
  await page.goto('/eligibility');
  const next = page.getByTestId('eligibility-next');
  await page.getByRole('radio', { name: 'Yes', exact: true }).check();
  await next.click();
  await page.getByRole('radio', { name: 'Other / not SC or ST' }).check();
  await next.click();
  await page.getByRole('checkbox', { name: "I don't know" }).check();
  await next.click();
  await page.getByRole('checkbox', { name: 'Not sure' }).check();
  await next.click();
  for (const label of ['Graduation completed', 'Germany', 'Not started yet', 'Not started', 'No']) {
    await page.getByRole('radio', { name: label, exact: true }).check();
    await next.click();
  }
  await expect(page.getByTestId('eligibility-outcome')).toHaveText('Does not currently meet one or more criteria');
  await expect(page.getByText('This scheme is for SC and ST students only.')).toBeVisible();
  await expect(page.getByRole('link', { name: /Apply on the official portal/ })).toHaveAttribute('href', 'https://telanganaepass.cgg.gov.in/OverseasLinks.do');
});
