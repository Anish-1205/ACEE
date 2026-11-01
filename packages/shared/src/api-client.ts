import type { EligibilityResult, Outcome } from './eligibility';
import type { Role } from './roles';
import type { Language } from './constants';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

export type ApiClientOptions = {
  baseUrl: string;
  /** Mobile: returns the bearer access token. Web leaves it out and relies on the HttpOnly cookie. */
  getAccessToken?: () => Promise<string | null> | string | null;
  /** Called once on a 401; return true if credentials were refreshed and the call should be retried. */
  onUnauthorized?: () => Promise<boolean>;
  getLanguage?: () => string;
  fetchImpl?: typeof fetch;
};

export function createApiClient(opts: ApiClientOptions) {
  const f = opts.fetchImpl ?? fetch;

  async function request<T>(method: string, path: string, body?: unknown, retried = false): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const token = await opts.getAccessToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (opts.getLanguage) headers['Accept-Language'] = opts.getLanguage();
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
    if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';

    const res = await f(`${opts.baseUrl}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
    if (res.status === 401 && !retried && opts.onUnauthorized && (await opts.onUnauthorized())) {
      return request<T>(method, path, body, true);
    }
    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, data.code ?? 'ERROR', data.message ?? res.statusText, data.details);
    return data as T;
  }

  return {
    request,
    get: <T>(p: string) => request<T>('GET', p),
    post: <T>(p: string, b?: unknown) => request<T>('POST', p, b ?? {}),
    put: <T>(p: string, b: unknown) => request<T>('PUT', p, b),
    patch: <T>(p: string, b: unknown) => request<T>('PATCH', p, b),
    del: <T>(p: string) => request<T>('DELETE', p),
  };
}
export type ApiClient = ReturnType<typeof createApiClient>;

// ---- Response DTOs shared by web and mobile ----

export type Localized = { en: string; te?: string; hi?: string };
export type Paged<T> = { items: T[]; total: number; page: number; pageSize: number };

export type Me = {
  id: string; fullName: string; email: string; mobile: string; role: Role;
  district: string | null; preferredLanguage: Language;
};
export type AuthResponse = { user: Me; accessToken?: string; refreshToken?: string; accessExpiresAt?: string };

export type StudentProfile = {
  qualification: string | null; fieldOfStudy: string | null; graduationYear: number | null;
  intendedCountry: string | null; intendedLevel: string | null; intendedIntake: string | null;
  completion: number;
};

export type Course = {
  id: string; code: string; name: Localized; description: Localized; durationWeeks: number;
  isFree: boolean; feeAmount: number | null; feeNote: Localized;
};
export type Batch = {
  id: string; courseId: string; name: string; mode: string; startDate: string; endDate: string;
  days: string[]; startTime: string; endTime: string; capacity: number; seatsTaken: number;
  location: string | null; trainer: { id: string; fullName: string } | null; course?: Course;
};
export type Enrollment = { id: string; status: string; preferredMode: string; batch: Batch; createdAt: string };

export type Slot = { counselorId: string; counselorName: string; startsAt: string; endsAt: string; mode: string };
export type Appointment = {
  id: string; startsAt: string; endsAt: string; type: string; mode: string; status: string;
  questions: string; meetingLink: string | null; followUpStatus: string;
  counselor: { id: string; fullName: string }; student?: { id: string; fullName: string; mobile: string };
};

export type DocumentDto = {
  id: string; category: string; fileName: string; mimeType: string; sizeBytes: number; status: string;
  version: number; createdAt: string; rejectionReason: string | null; owner?: { id: string; fullName: string };
};

export type Stage = { id: string; code: string; name: Localized; order: number };
export type ApplicationDto = {
  id: string; stage: Stage; intendedCountry: string | null; intake: string | null; pendingActions: string;
  studentReportedGovtStatus: string; updatedAt: string;
  assignedCounselor: { id: string; fullName: string } | null;
  history: { id: string; toStage: Stage; note: string; createdAt: string }[];
  notes: { id: string; body: string; createdAt: string; author: { fullName: string } }[];
  student?: { id: string; fullName: string; mobile: string; email: string };
};

export type NotificationDto = { id: string; type: string; titleKey: string; bodyKey: string; params: Record<string, string>; readAt: string | null; createdAt: string };
export type AnnouncementDto = { id: string; title: Localized; body: Localized; audience: string; publishedAt: string };

export type EligibilityResponse = EligibilityResult & {
  outcome: Outcome; ruleVersion: { id: string; version: number; goReference: string; sourceUrl: string; verifiedAt: string; effectiveFrom: string } | null;
  assessmentId: string | null;
};
