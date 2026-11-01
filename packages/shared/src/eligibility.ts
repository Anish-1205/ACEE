import { z } from 'zod';

/**
 * Preliminary eligibility screening. This is NOT a government decision: it only compares the
 * student's self-reported answers with an admin-maintained, versioned copy of published criteria.
 */

export const CRITERIA = [
  'telanganaResident',
  'annualFamilyIncome',
  'graduationPercentage',
  'qualification',
  'intendedCountry',
  'admissionStatus',
  'examStatus',
  'priorFamilyBenefit',
] as const;
export type Criterion = (typeof CRITERIA)[number];

export const OPERATORS = ['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'in', 'notIn'] as const;
export type Operator = (typeof OPERATORS)[number];

export const ruleSchema = z.object({
  id: z.string().min(1).max(60),
  criterion: z.enum(CRITERIA),
  operator: z.enum(OPERATORS),
  threshold: z.union([z.number(), z.string(), z.boolean(), z.array(z.string())]),
  /** What a failed rule means: hard "does not meet", or "needs manual review". */
  onFail: z.enum(['NOT_MET', 'REVIEW']).default('NOT_MET'),
  description: z.string().max(300).default(''),
});
export type Rule = z.infer<typeof ruleSchema>;

export const ruleVersionInputSchema = z.object({
  category: z.enum(['SC', 'ST']),
  sourceUrl: z.url(),
  goReference: z.string().min(1).max(200),
  verifiedAt: z.coerce.date(),
  effectiveFrom: z.coerce.date(),
  notes: z.string().max(1000).default(''),
  rules: z.array(ruleSchema).min(1).max(30),
});
export type RuleVersionInput = z.infer<typeof ruleVersionInputSchema>;

const triState = z.enum(['yes', 'no', 'unsure']);
export const eligibilityInputSchema = z.object({
  telanganaResident: triState,
  category: z.enum(['SC', 'ST', 'OTHER']),
  annualFamilyIncome: z.number().int().min(0).max(100_000_000).nullable(),
  graduationPercentage: z.number().min(0).max(100).nullable(),
  qualification: z.enum(['UG_PURSUING', 'UG_COMPLETED', 'PG_COMPLETED', 'OTHER']),
  intendedCountry: z.string().length(2).nullable(),
  admissionStatus: z.enum(['OFFER_RECEIVED', 'APPLIED', 'NOT_STARTED']),
  examStatus: z.enum(['SCORE_AVAILABLE', 'SCHEDULED', 'NOT_STARTED']),
  priorFamilyBenefit: triState,
});
export type EligibilityInput = z.infer<typeof eligibilityInputSchema>;

export type Outcome = 'ELIGIBLE' | 'REVIEW' | 'NOT_MET';
export type RuleResult = {
  ruleId: string;
  criterion: Criterion;
  operator: Operator;
  threshold: Rule['threshold'];
  actual: unknown;
  status: 'PASS' | 'FAIL' | 'UNKNOWN';
  effect: 'NONE' | 'NOT_MET' | 'REVIEW';
  description: string;
};
export type EligibilityResult = { outcome: Outcome; results: RuleResult[]; reasonCodes: string[] };

/** Tri-state answers become booleans; "unsure" and nulls become undefined (= unknown). */
function actualValue(input: EligibilityInput, c: Criterion): string | number | boolean | undefined {
  const v = input[c];
  if (v === null || v === 'unsure') return undefined;
  if (v === 'yes') return true;
  if (v === 'no') return false;
  return v;
}

function compare(actual: string | number | boolean, op: Operator, threshold: Rule['threshold']): boolean {
  switch (op) {
    case 'eq': return actual === threshold;
    case 'neq': return actual !== threshold;
    case 'lt': return typeof actual === 'number' && actual < Number(threshold);
    case 'lte': return typeof actual === 'number' && actual <= Number(threshold);
    case 'gt': return typeof actual === 'number' && actual > Number(threshold);
    case 'gte': return typeof actual === 'number' && actual >= Number(threshold);
    case 'in': return Array.isArray(threshold) && threshold.includes(String(actual));
    case 'notIn': return Array.isArray(threshold) && !threshold.includes(String(actual));
  }
}

export function evaluateEligibility(input: EligibilityInput, rules: Rule[] | null): EligibilityResult {
  if (input.category === 'OTHER') {
    return { outcome: 'NOT_MET', results: [], reasonCodes: ['CATEGORY_NOT_COVERED'] };
  }
  if (!rules) {
    return { outcome: 'REVIEW', results: [], reasonCodes: ['NO_ACTIVE_RULES'] };
  }
  const results: RuleResult[] = rules.map((r) => {
    const actual = actualValue(input, r.criterion);
    const base = { ruleId: r.id, criterion: r.criterion, operator: r.operator, threshold: r.threshold, actual: actual ?? null, description: r.description };
    if (actual === undefined) return { ...base, status: 'UNKNOWN', effect: 'REVIEW' };
    const ok = compare(actual, r.operator, r.threshold);
    return { ...base, status: ok ? 'PASS' : 'FAIL', effect: ok ? 'NONE' : r.onFail };
  });
  const outcome: Outcome = results.some((r) => r.effect === 'NOT_MET')
    ? 'NOT_MET'
    : results.some((r) => r.effect === 'REVIEW') ? 'REVIEW' : 'ELIGIBLE';
  const reasonCodes = results.filter((r) => r.effect !== 'NONE').map((r) => `${r.criterion}.${r.status}`);
  return { outcome, results, reasonCodes };
}
