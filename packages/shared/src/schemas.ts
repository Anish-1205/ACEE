import { z } from 'zod';
import {
  APPOINTMENT_TYPES, COURSE_CODES, DOCUMENT_CATEGORIES, LANGUAGES, MODES, TELANGANA_DISTRICTS,
} from './constants';
import { ROLES } from './roles';

/**
 * Error messages are i18n keys in the `validation` namespace so both clients can localise them.
 */
export const indianMobile = z.string().trim().regex(/^[6-9]\d{9}$/, 'validation:mobile');
export const password = z.string().min(10, 'validation:passwordLength').max(128, 'validation:passwordLength')
  .regex(/[A-Za-z]/, 'validation:passwordLetters').regex(/\d/, 'validation:passwordDigits');
const email = z.email('validation:email').trim().toLowerCase().max(200);
const name = z.string().trim().min(2, 'validation:name').max(120, 'validation:name');
const localized = z.object({ en: z.string().max(20000), te: z.string().max(20000).default(''), hi: z.string().max(20000).default('') });

export const registerSchema = z.object({
  fullName: name,
  mobile: indianMobile,
  email,
  district: z.enum(TELANGANA_DISTRICTS, 'validation:district'),
  preferredLanguage: z.enum(LANGUAGES),
  password,
  acceptTerms: z.literal(true, 'validation:acceptTerms'),
  consentEmail: z.boolean().default(false),
  consentSms: z.boolean().default(false),
  consentWhatsapp: z.boolean().default(false),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  /** Email or 10-digit mobile number. */
  identifier: z.string().trim().min(3, 'validation:required').max(200),
  password: z.string().min(1, 'validation:required').max(128),
  client: z.enum(['web', 'mobile']).default('web'),
});

export const refreshSchema = z.object({ refreshToken: z.string().min(20).max(200) });

export const inviteSchema = z.object({
  email,
  fullName: name,
  role: z.enum(ROLES).exclude(['STUDENT']),
});
export const acceptInviteSchema = z.object({
  token: z.string().min(20).max(200),
  mobile: indianMobile,
  password,
  preferredLanguage: z.enum(LANGUAGES).default('en'),
});

export const profileSchema = z.object({
  fullName: name,
  district: z.enum(TELANGANA_DISTRICTS),
  preferredLanguage: z.enum(LANGUAGES),
  qualification: z.enum(['UG_PURSUING', 'UG_COMPLETED', 'PG_COMPLETED', 'OTHER']).nullable(),
  fieldOfStudy: z.string().trim().max(120).nullable(),
  graduationYear: z.number().int().min(1980).max(2040).nullable(),
  intendedCountry: z.string().length(2).nullable(),
  intendedLevel: z.enum(['MASTERS', 'PHD', 'OTHER']).nullable(),
  intendedIntake: z.string().trim().max(40).nullable(),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const consentSchema = z.object({
  purpose: z.enum(['COMM_EMAIL', 'COMM_SMS', 'COMM_WHATSAPP', 'COMM_PUSH']),
  granted: z.boolean(),
});

export const enrollSchema = z.object({
  batchId: z.string().min(1),
  preferredMode: z.enum(MODES),
});

export const courseSchema = z.object({
  code: z.enum(COURSE_CODES),
  name: localized,
  description: localized,
  durationWeeks: z.number().int().min(1).max(52),
  isFree: z.boolean(),
  feeAmount: z.number().int().min(0).nullable(),
  feeNote: localized,
  active: z.boolean().default(true),
});

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'validation:time');
export const batchSchema = z.object({
  courseId: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  mode: z.enum([...MODES, 'HYBRID']),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  days: z.array(z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'])).min(1),
  startTime: hhmm,
  endTime: hhmm,
  capacity: z.number().int().min(1).max(500),
  trainerId: z.string().nullable(),
  location: z.string().max(200).nullable(),
}).refine((b) => b.endDate >= b.startDate, { message: 'validation:dateOrder', path: ['endDate'] });

export const attendanceSchema = z.object({
  date: z.iso.date(),
  records: z.array(z.object({
    userId: z.string().min(1),
    status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
  })).min(1).max(500),
});

export const materialSchema = z.object({
  title: z.string().trim().min(2).max(200),
  url: z.url().refine((u) => u.startsWith('https://'), 'validation:httpsOnly'),
  description: z.string().max(1000).default(''),
});

export const availabilitySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: hhmm,
  endTime: hhmm,
  slotMinutes: z.number().int().min(15).max(120).default(30),
  mode: z.enum([...MODES, 'BOTH']).default('BOTH'),
}).refine((a) => a.startTime < a.endTime, { message: 'validation:timeOrder', path: ['endTime'] });

export const bookAppointmentSchema = z.object({
  counselorId: z.string().min(1),
  startsAt: z.iso.datetime({ offset: true }),
  type: z.enum(APPOINTMENT_TYPES),
  mode: z.enum(MODES),
  questions: z.string().trim().max(2000).default(''),
});
export const rescheduleSchema = z.object({ startsAt: z.iso.datetime({ offset: true }) });

export const counselorNoteSchema = z.object({
  studentId: z.string().min(1),
  appointmentId: z.string().nullable().default(null),
  body: z.string().trim().min(1).max(5000),
  followUpStatus: z.enum(['NONE', 'PENDING', 'DONE']).default('NONE'),
  followUpDate: z.iso.date().nullable().default(null),
});

export const appointmentStatusSchema = z.object({
  status: z.enum(['COMPLETED', 'NO_SHOW', 'CANCELLED']),
  followUpStatus: z.enum(['NONE', 'PENDING', 'DONE']).optional(),
});

export const stageChangeSchema = z.object({
  stageId: z.string().min(1),
  note: z.string().trim().max(2000).default(''),
});
export const applicationNoteSchema = z.object({
  body: z.string().trim().min(1).max(5000),
  visibleToStudent: z.boolean().default(false),
});
export const applicationUpdateSchema = z.object({
  assignedCounselorId: z.string().nullable().optional(),
  pendingActions: z.string().max(2000).optional(),
  studentReportedGovtStatus: z.string().max(500).optional(),
});
export const stageSchema = z.object({
  code: z.string().regex(/^[A-Z_]{3,40}$/),
  name: localized,
  order: z.number().int().min(0).max(1000),
  active: z.boolean().default(true),
});

export const documentMetaSchema = z.object({ category: z.enum(DOCUMENT_CATEGORIES) });
export const documentReviewSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().trim().max(1000).default(''),
}).refine((r) => r.decision === 'APPROVED' || r.reason.length > 0, { message: 'validation:reasonRequired', path: ['reason'] });

export const inquirySchema = z.object({
  name,
  mobile: indianMobile,
  email: email.optional().or(z.literal('')),
  interest: z.enum(['SCHOLARSHIP', 'COACHING', 'ADMISSION', 'OTHER']),
  message: z.string().trim().max(2000).default(''),
  consent: z.literal(true, 'validation:acceptTerms'),
});
export const inquiryUpdateSchema = z.object({
  status: z.enum(['NEW', 'CONTACTED', 'CONVERTED', 'CLOSED']),
});

export const announcementSchema = z.object({
  title: localized,
  body: localized,
  audience: z.enum(['PUBLIC', 'STUDENTS', 'STAFF', 'BATCH']),
  batchId: z.string().nullable().default(null),
  expiresAt: z.coerce.date().nullable().default(null),
});

export const cmsSchema = z.object({ content: z.record(z.string(), z.unknown()) });

export const userAdminUpdateSchema = z.object({
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
  role: z.enum(ROLES).optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
});
