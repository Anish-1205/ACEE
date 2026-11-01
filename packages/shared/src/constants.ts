export const LANGUAGES = ['en', 'te', 'hi'] as const;
export type Language = (typeof LANGUAGES)[number];
export const LOCALE_TAGS: Record<Language, string> = { en: 'en-IN', te: 'te-IN', hi: 'hi-IN' };

export const TELANGANA_DISTRICTS = [
  'Adilabad', 'Bhadradri Kothagudem', 'Hanumakonda', 'Hyderabad', 'Jagtial', 'Jangaon',
  'Jayashankar Bhupalpally', 'Jogulamba Gadwal', 'Kamareddy', 'Karimnagar', 'Khammam',
  'Kumuram Bheem Asifabad', 'Mahabubabad', 'Mahabubnagar', 'Mancherial', 'Medak',
  'Medchal-Malkajgiri', 'Mulugu', 'Nagarkurnool', 'Nalgonda', 'Narayanpet', 'Nirmal',
  'Nizamabad', 'Peddapalli', 'Rajanna Sircilla', 'Ranga Reddy', 'Sangareddy', 'Siddipet',
  'Suryapet', 'Vikarabad', 'Wanaparthy', 'Warangal', 'Yadadri Bhuvanagiri', 'Outside Telangana',
] as const;

/** Countries named in the ACEE brochure. Admin-editable copy lives in CMS; this is the code list. */
export const COUNTRIES = [
  { code: 'US', name: 'USA' }, { code: 'GB', name: 'UK' }, { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' }, { code: 'DE', name: 'Germany' }, { code: 'NZ', name: 'New Zealand' },
  { code: 'SG', name: 'Singapore' }, { code: 'JP', name: 'Japan' }, { code: 'FR', name: 'France' },
  { code: 'KR', name: 'South Korea' },
] as const;
export const COUNTRY_CODES = COUNTRIES.map((c) => c.code) as string[];

export const COURSE_CODES = ['IELTS', 'PTE', 'TOEFL', 'GRE', 'GMAT'] as const;

/** Mirrors the Telangana ePASS overseas-scholarship upload list (in its order), plus study-abroad extras. */
export const DOCUMENT_CATEGORIES = [
  'PASSPORT_PHOTO', 'CASTE_CERTIFICATE', 'INCOME_CERTIFICATE', 'BONAFIDE_CERTIFICATE', 'RATION_CARD',
  'SSC_CERTIFICATE', 'AADHAAR', 'TRANSFER_CERTIFICATE', 'BANK_PASSBOOK', 'RESIDENCE_CERTIFICATE', 'MARKS_MEMO',
  'OFFER_LETTER', 'EXAM_SCORECARD', 'OTHER',
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

/** Marked * on the ePASS form. */
export const REQUIRED_DOCUMENTS: DocumentCategory[] = [
  'PASSPORT_PHOTO', 'CASTE_CERTIFICATE', 'INCOME_CERTIFICATE', 'BONAFIDE_CERTIFICATE',
  'SSC_CERTIFICATE', 'BANK_PASSBOOK', 'RESIDENCE_CERTIFICATE',
];

/** Identity/financial documents: shown with handling guidance (masked Aadhaar, passbook first page only). */
export const SENSITIVE_DOCUMENTS: DocumentCategory[] = ['AADHAAR', 'BANK_PASSBOOK', 'RATION_CARD'];

/** Statuses that count as "provided" for the required-document checklist. */
export const missingRequiredDocuments = (docs: { category: string; status: string }[]) =>
  REQUIRED_DOCUMENTS.filter((c) => !docs.some((d) => d.category === c && (d.status === 'PENDING' || d.status === 'APPROVED')));

export const ALLOWED_UPLOAD_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const APPOINTMENT_TYPES = ['SCHOLARSHIP', 'COACHING', 'ADMISSION', 'GENERAL'] as const;
export const MODES = ['ONLINE', 'OFFLINE'] as const;

/** The existing ACEE marketing site. This app is its student portal (e.g. portal.aceereviewconsultants.com). */
export const MAIN_SITE = {
  url: 'https://www.aceereviewconsultants.com',
  about: 'https://www.aceereviewconsultants.com/about',
  contact: 'https://www.aceereviewconsultants.com/contact.php',
  destinations: 'https://www.aceereviewconsultants.com/study-steps#countryselection',
  whatsapp: 'https://wa.me/918465903456',
  social: {
    facebook: 'https://www.facebook.com/acereviewconsultants/',
    linkedin: 'https://in.linkedin.com/in/acee-review-245906361',
    instagram: 'https://www.instagram.com/aceereviewoverseas/',
    youtube: 'https://www.youtube.com/@Aceereview',
  },
} as const;

export const OFFICIAL_PORTAL_URL = 'https://telanganaepass.cgg.gov.in/';
export const OFFICIAL_SCHEME_URL = 'https://telanganaepass.cgg.gov.in/OverseasLinks.do';
