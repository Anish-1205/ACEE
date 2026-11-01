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

export const DOCUMENT_CATEGORIES = [
  'EDUCATION_CERTIFICATE', 'GRADUATION_MARKSHEET', 'INCOME_CERTIFICATE', 'COMMUNITY_CERTIFICATE',
  'OFFER_LETTER', 'EXAM_SCORECARD', 'OTHER',
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const ALLOWED_UPLOAD_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const APPOINTMENT_TYPES = ['SCHOLARSHIP', 'COACHING', 'ADMISSION', 'GENERAL'] as const;
export const MODES = ['ONLINE', 'OFFLINE'] as const;

export const OFFICIAL_PORTAL_URL = 'https://telanganaepass.cgg.gov.in/';
export const OFFICIAL_SCHEME_URL = 'https://telanganaepass.cgg.gov.in/OverseasLinks.do';
