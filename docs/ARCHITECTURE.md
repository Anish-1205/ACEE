# ACEE Global Education — Architecture

## 1. Requirements summary (from brief + flyers)

**Operator:** ACEE Review Consultants Pvt. Ltd. (Hyderabad). The platform is a private consultancy
product. It is **not** a Government of Telangana portal and must never present itself as one.

**From the flyers (business-provided, unverified):**

| Item | Flyer claim | How the app treats it |
|---|---|---|
| Services | Free coaching (IELTS, PTE, TOEFL, GRE, GMAT), study-abroad guidance, help with the Dr. B.R. Ambedkar Overseas Vidya Nidhi scheme | Modelled as courses + counseling + application assistance |
| Audience | SC & ST students of Telangana | Eligibility checker + coaching; free status is configurable per course |
| Scheme criteria | Telangana SC/ST, family income < ₹5 lakh, ≥ 60% in graduation | Seeded as **draft rule versions** marked "unverified – from brochure"; admins must verify against the official GO before activating in production |
| Benefits | Up to ₹20 lakh, visa fee + one-way airfare reimbursement | Shown as scheme description text, editable in CMS |
| Countries | USA, UK, Canada, Australia, Germany, New Zealand, Singapore, Japan, France, South Korea | Seeded country list, editable |
| "Official empanelled partner" / Govt. seal | Not verifiable | **Not shown.** No government logo or seal is used. Admin can add an empanelment statement in CMS only after uploading proof (manual process) |
| Contact | 84659 03456, 95461 69456, Pillar No. 1555, 2nd Floor, Chaitanyapuri, Dilsukhnagar, Hyderabad 500060 | Seeded into CMS with `confirmedAt = null`; the site shows an "unconfirmed" banner to admins until a SUPER_ADMIN confirms |

Official scheme portal: https://telanganaepass.cgg.gov.in/ (links: `/OverseasLinks.do`).

## 2. System shape

```
apps/web (Next.js) ──┐  same-origin /api/* rewrite, HttpOnly cookie session
                     ├──► apps/api (Fastify, REST /api/v1, OpenAPI at /docs) ──► PostgreSQL (Prisma)
apps/mobile (Expo) ──┘  Bearer access token (15 min) + rotating refresh token        └► private file storage (local dir | S3)
packages/shared  — Zod schemas, eligibility engine, roles, design tokens, typed API client
packages/i18n    — en-IN / te-IN / hi-IN resources (13 namespaces) + i18next factory
```

One backend and one database serve both clients. The Android app is a native Expo Router app, not a WebView.

## 3. Key decisions

| Decision | Choice | Why |
|---|---|---|
| Monorepo | pnpm workspaces, `node-linker=hoisted` | Expo/React Native needs a flat `node_modules` |
| Packages | 2 shared packages (`shared`, `i18n`) instead of 5 | validation, config, api-client and tokens are small; one package with sub-paths keeps builds simple. Split later if they grow |
| Prisma location | `apps/api/prisma` | The API is the only DB owner |
| Auth tokens | Opaque random tokens, SHA-256 hashed in `Session` | Instant revocation, no JWT key management. Refresh rotation with reuse detection revokes the whole token family |
| Web auth | HttpOnly, `SameSite=Lax`, `Secure` in prod cookie; mutating cookie requests must send a matching `Origin` (CSRF) | |
| Passwords | Argon2id (`@node-rs/argon2`) | |
| Locale on web | `lang` cookie (not URL prefix) | Simpler; SEO hreflang can be added with URL locales later |
| UI kit | Tailwind CSS v4 + a few hand-written shadcn-style primitives | Avoids the shadcn CLI + Radix weight for the handful of components needed |
| Double-booking | `activeSlotKey` unique column on `Appointment` (null when cancelled) inside a transaction | DB-enforced, race-safe |
| Batch capacity | `SELECT ... FOR UPDATE` on the batch row inside the enrollment transaction | Race-safe |
| Eligibility rules | Immutable, versioned JSON rule sets per scheme + category, validated by Zod; every assessment stores the rule version id | Admin edits without code changes; history is reproducible |
| Notifications | In-app table always; email/SMS/WhatsApp/push are adapters that report `not configured` when no credentials exist | No fake sending |
| OTP | Interface + endpoint returns `501 OTP_NOT_CONFIGURED` until a provider is wired | No fake OTP |
| Document storage | `StorageDriver` interface, local private dir (dev) or S3-compatible (prod); downloads only through an authorised API route that writes an audit log | No public URLs |

## 4. Roles and access

| Role | Can |
|---|---|
| STUDENT | Own profile, eligibility, enrollments, appointments, documents, application, notifications |
| COUNSELOR | Students assigned to them (via application or appointment), their appointments, availability, private notes, those students' documents (view + review) |
| TRAINER | Batches assigned to them, rosters, attendance, materials, batch announcements |
| ADMIN | Everything operational: users (non-admin), courses, batches, stages, rules, CMS, documents, reports, audit log |
| SUPER_ADMIN | Plus: create/disable admins, change roles, confirm business details |

Self-registration always creates `STUDENT`. Staff accounts come only from invitations (ADMIN invites COUNSELOR/TRAINER; SUPER_ADMIN invites ADMIN). The first SUPER_ADMIN is created by a CLI script (`pnpm --filter api provision:superadmin`).

All checks are in the API (`requireRole`, ownership checks in each query). The clients hide UI only for convenience.

## 5. Privacy posture (DPDP Act 2023 / DPDP Rules 2025 — design intent, not a compliance claim)

- Caste category, income band and marks are collected **only** inside an eligibility check, stored with the assessment (purpose-bound), never on the profile.
- No Aadhaar, bank or passport numbers are typed into forms. The document checklist mirrors the ePASS overseas form (passport photo, caste/income certificates, bonafide, ration card, SSC, masked Aadhaar, TC, bank passbook first page, residence certificate, marks memo); 7 are marked required. Registration has a second, skippable step for these uploads.
- Consent records (purpose, version, timestamp, IP) for terms, privacy and each communication channel.
- Students can delete documents and request account deletion; admins process deletion requests (documents purged from storage, PII anonymised, audit kept).
- Every document view/download/review is audit-logged.
- A legal review is required before production.

## 6. Data model (apps/api/prisma/schema.prisma)

| Area | Models |
|---|---|
| Identity | `User` (role enum = Roles), `Session`, `Invitation`, `StudentProfile`, `CounselorProfile`, `TrainerProfile`, `Consent` |
| Scholarships | `ScholarshipScheme`, `SchemeRuleVersion` (immutable JSON rules, unique per scheme+category+version), `EligibilityAssessment` (inputs, outcome, per-rule results, rule version id) |
| Coaching | `Course`, `Batch`, `Enrollment` (unique user+batch), `Attendance` (unique batch+user+date), `StudyMaterial` |
| Counseling | `CounselingAvailability` (weekly IST hours), `Appointment` (unique `counselorSlotKey`/`studentSlotKey` while booked), `CounselorNote` (staff-only) |
| Applications | `ApplicationStage` (configurable), `Application`, `ApplicationStageHistory`, `ApplicationNote` (`visibleToStudent`) |
| Documents | `Document` (versioned, soft-deleted row, purged file), `DocumentReview` |
| Communication / CMS | `Notification` (i18n keys + params), `Announcement` (localized JSON), `Inquiry`, `CmsContent` (localized JSON = LocalizationContent; `confirmedAt` for business facts) |
| Governance | `AuditLog`, `DataRequest` (export / deletion) |

## 7. API surface (prefix `/api/v1`, OpenAPI at `/docs`)

`auth/*` (register, login, refresh, logout, me, session, otp, invitations) · `me/*` (profile, language, consents, notifications, dashboard, export, data-requests) · `schemes`, `eligibility/*` · `courses`, `enrollments`, `batches/:id/*`, `trainer/batches`, `attendance/mine` · `counselors`, `counseling/slots`, `appointments/*`, `counselor/*` · `applications/*`, `staff/applications/*` · `documents/*`, `staff/documents/*` · `cms/:key`, `announcements`, `inquiries` · `admin/*` (metrics, users, staff, inquiries, audit-logs, reports, data-requests, schemes, rule-versions, courses, batches, enrollments, announcements, cms, stages).
