import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '@acee/i18n';
import type { EligibilityResponse } from '@acee/shared';
import { EligibilityResult } from './eligibility-wizard';

vi.mock('./providers', () => ({ useMe: () => ({ data: null }) }));
afterEach(cleanup);

const result: EligibilityResponse = {
  outcome: 'REVIEW',
  reasonCodes: ['admissionStatus.FAIL'],
  assessmentId: null,
  ruleVersion: { id: 'v1', version: 1, goReference: 'UNVERIFIED — ACEE brochure', sourceUrl: 'https://telanganaepass.cgg.gov.in/', verifiedAt: '2026-11-01', effectiveFrom: '2026-11-01' },
  results: [
    { ruleId: 'income', criterion: 'annualFamilyIncome', operator: 'lt', threshold: 500000, actual: 300000, status: 'PASS', effect: 'NONE', description: '' },
    { ruleId: 'admission', criterion: 'admissionStatus', operator: 'eq', threshold: 'OFFER_RECEIVED', actual: 'APPLIED', status: 'FAIL', effect: 'REVIEW', description: '' },
  ],
};

const renderIn = (lang: 'en' | 'te' | 'hi', onRestart = () => {}) =>
  render(<I18nextProvider i18n={createI18n(lang)}><EligibilityResult result={result} signedIn={false} onRestart={onRestart} /></I18nextProvider>);

describe('EligibilityResult', () => {
  it('shows the outcome, per-criterion reasons, the unverified-rules warning and the government disclaimer', () => {
    renderIn('en');
    expect(screen.getByTestId('eligibility-outcome').textContent).toBe('More information or manual review required');
    expect(screen.getByText('Annual family income')).toBeTruthy();
    expect(screen.getByText('Needs review')).toBeTruthy();
    expect(screen.getByText(/not yet been verified against a Government Order/)).toBeTruthy();
    expect(screen.getByText(/determined by the concerned Government of Telangana authorities/)).toBeTruthy();
  });

  it('renders in Telugu and Hindi', () => {
    renderIn('te');
    expect(screen.getByText('మరింత సమాచారం లేదా మాన్యువల్ సమీక్ష అవసరం')).toBeTruthy();
    cleanup();
    renderIn('hi');
    expect(screen.getByText('अधिक जानकारी या मैन्युअल समीक्षा आवश्यक')).toBeTruthy();
  });

  it('lets the user start over', () => {
    const onRestart = vi.fn();
    renderIn('en', onRestart);
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
    expect(onRestart).toHaveBeenCalled();
  });
});
