import { describe, expect, it } from 'vitest';
import { DOCUMENT_CATEGORIES, REQUIRED_DOCUMENTS, SENSITIVE_DOCUMENTS, missingRequiredDocuments } from './constants';

describe('ePASS document checklist', () => {
  it('lists every required and sensitive document as an uploadable category', () => {
    for (const c of [...REQUIRED_DOCUMENTS, ...SENSITIVE_DOCUMENTS]) expect(DOCUMENT_CATEGORIES).toContain(c);
  });
  it('counts only pending or approved uploads as provided', () => {
    const docs = [
      { category: 'PASSPORT_PHOTO', status: 'APPROVED' },
      { category: 'CASTE_CERTIFICATE', status: 'PENDING' },
      { category: 'INCOME_CERTIFICATE', status: 'REJECTED' },
      { category: 'SSC_CERTIFICATE', status: 'DELETED' },
    ];
    expect(missingRequiredDocuments(docs)).toEqual(['INCOME_CERTIFICATE', 'BONAFIDE_CERTIFICATE', 'SSC_CERTIFICATE', 'BANK_PASSBOOK', 'RESIDENCE_CERTIFICATE']);
  });
});
