import { describe, expect, it } from 'vitest';
import { evaluateEligibility, ruleSchema, type EligibilityInput, type Rule } from './eligibility';

const rules: Rule[] = [
  { id: 'res', criterion: 'telanganaResident', operator: 'eq', threshold: true, onFail: 'NOT_MET', description: '' },
  { id: 'inc', criterion: 'annualFamilyIncome', operator: 'lt', threshold: 500000, onFail: 'NOT_MET', description: '' },
  { id: 'grad', criterion: 'graduationPercentage', operator: 'gte', threshold: 60, onFail: 'NOT_MET', description: '' },
  { id: 'country', criterion: 'intendedCountry', operator: 'in', threshold: ['US', 'GB'], onFail: 'NOT_MET', description: '' },
  { id: 'adm', criterion: 'admissionStatus', operator: 'eq', threshold: 'OFFER_RECEIVED', onFail: 'REVIEW', description: '' },
];

const good: EligibilityInput = {
  telanganaResident: 'yes', category: 'SC', annualFamilyIncome: 300000, graduationPercentage: 72,
  qualification: 'UG_COMPLETED', intendedCountry: 'US', admissionStatus: 'OFFER_RECEIVED',
  examStatus: 'SCORE_AVAILABLE', priorFamilyBenefit: 'no',
};

describe('evaluateEligibility', () => {
  it('passes when every rule passes', () => {
    expect(evaluateEligibility(good, rules).outcome).toBe('ELIGIBLE');
  });
  it('fails on income at the threshold (strictly less than)', () => {
    const r = evaluateEligibility({ ...good, annualFamilyIncome: 500000 }, rules);
    expect(r.outcome).toBe('NOT_MET');
    expect(r.reasonCodes).toContain('annualFamilyIncome.FAIL');
  });
  it('accepts exactly 60% graduation', () => {
    expect(evaluateEligibility({ ...good, graduationPercentage: 60 }, rules).outcome).toBe('ELIGIBLE');
  });
  it('asks for review when an answer is unsure or missing', () => {
    const r = evaluateEligibility({ ...good, telanganaResident: 'unsure', graduationPercentage: null }, rules);
    expect(r.outcome).toBe('REVIEW');
    expect(r.reasonCodes).toEqual(['telanganaResident.UNKNOWN', 'graduationPercentage.UNKNOWN']);
  });
  it('treats REVIEW-type failures as review, not rejection', () => {
    expect(evaluateEligibility({ ...good, admissionStatus: 'NOT_STARTED' }, rules).outcome).toBe('REVIEW');
  });
  it('a hard failure outranks a review', () => {
    expect(evaluateEligibility({ ...good, admissionStatus: 'NOT_STARTED', intendedCountry: 'IN' }, rules).outcome).toBe('NOT_MET');
  });
  it('rejects categories the scheme does not cover', () => {
    expect(evaluateEligibility({ ...good, category: 'OTHER' }, rules).reasonCodes).toEqual(['CATEGORY_NOT_COVERED']);
  });
  it('needs review when no active rule version exists', () => {
    expect(evaluateEligibility(good, null).outcome).toBe('REVIEW');
  });
  it('rule schema rejects unknown criteria', () => {
    expect(ruleSchema.safeParse({ id: 'x', criterion: 'caste', operator: 'eq', threshold: 1 }).success).toBe(false);
  });
});
