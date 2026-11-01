# Implementation status

Last updated: 2026-11-01. Test evidence: [TESTING.md](TESTING.md).

## Phases

| Phase | Scope | Status |
|---|---|---|
| A | Repo/asset inspection, requirements, architecture, monorepo | ✅ Done — [ARCHITECTURE.md](ARCHITECTURE.md) |
| B | Database (27 models, 2 migrations), API, auth, RBAC, foundational tests | ✅ Done |
| C | Website + 3-language design system | ✅ Done |
| D | Registration, eligibility engine, profile | ✅ Done |
| E | Coaching, counseling, documents, application tracking | ✅ Done |
| F | Admin, counselor, trainer dashboards | ✅ Done (web) |
| G | Android screens on shared API | 🟡 Built, typechecked, bundled — **not run on a device** |
| H | Notifications, reports, translations, security, tests | ✅ Done (in-app notifications; external channels are adapters only) |
| I | Deployment docs, Android build config, handoff | ✅ Docs + EAS config — **no APK/AAB built, nothing deployed** |

## Acceptance criteria

| Criterion | Status | Evidence |
|---|---|---|
| Student registers/logs in (web) | ✅ | E2E + API tests |
| Selects en/te/hi; persists | ✅ | E2E (switch + reload), i18n tests |
| Completes profile | ✅ web · ⬜ Android | Profile page; Android links the web profile flow only via dashboard completion % |
| Preliminary eligibility with reasons, rule version, history | ✅ | Engine + API + E2E |
| Coaching registration with capacity/waitlist | ✅ | API concurrency test + E2E |
| Counseling booking/cancel/reschedule, no double booking | ✅ | API concurrency test + E2E |
| Upload permitted document | ✅ | API + E2E |
| Track internal application progress | ✅ | API + E2E |
| Counselor: assigned students, appointments, notes | ✅ | API + E2E |
| Trainer: batches, attendance | ✅ | API + E2E |
| Admin: students, coaching, appointments, documents, scheme rules, reports, announcements | ✅ | E2E (documents, rules), pages for all modules |
| Android runs on a device, same backend, 3 languages | 🟡 | Same API client + i18n package; bundle builds; **device run pending** |
| Web works on desktop and mobile | ✅ | E2E desktop + Pixel 7 project |
| Students can't see each other's records; private docs protected; server-side authz | ✅ | API isolation tests + E2E 403 checks |

## Files (by area)

- `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/*`, `apps/api/prisma/seed.ts`
- `apps/api/src/{app,server,config,db}.ts`, `apps/api/src/lib/*` (auth, audit, csv, notify, storage, tokens, errors), `apps/api/src/routes/*` (auth, me, eligibility, coaching, counseling, applications, documents, content, admin), `apps/api/scripts/provision-superadmin.ts`, `apps/api/test/*`
- `packages/shared/src/*` (eligibility engine, schemas, roles, tokens, constants, API client), `packages/i18n/src/*` (en/te/hi resources, factory, formatters)
- `apps/web/app/(public)/*` (12 public pages + invite), `apps/web/app/(portal)/{dashboard,counselor,trainer,admin}/*`, `apps/web/components/*`, `apps/web/lib/*`, `apps/web/proxy.ts`, `apps/web/e2e/*`
- `apps/mobile/app/*` (welcome, login, register, eligibility, tabs: home/coaching/counseling/documents/more, application, notifications, settings), `apps/mobile/lib/*`, `apps/mobile/components/ui.tsx`, `app.json`, `eas.json`
- `docs/*`, `README.md`, `.env.example`, `docker-compose.yml`

## Change log

- 2026-11-01: Document checklist switched to the Telangana ePASS overseas list (14 categories, 7 required); registration now continues to a skippable upload step on web and Android; data migration maps old categories; privacy text and FAQ updated.

- 2026-11-01: Positioned as the student portal of www.aceereviewconsultants.com (subdomain). Removed duplicate About/Destinations/Contact pages (redirect to the main site), main-site logo and links in header/footer/Android menu, company hours/email/branches taken from the main site.
- 2026-11-01: Visual template aligned with www.aceereviewconsultants.com: colours #003A66 / #E02454 / #F0F5FB, Poppins headings + Open Sans text (Noto for Telugu/Hindi), 10px radii, crimson-rule section labels, main-site style footer with social links, floating WhatsApp button. Android shares the same tokens. The brochure palette (navy/gold) from the original brief is replaced.
- 2026-11-01: Pre-launch features: forgot password by emailed 6-digit code (web + Android; hashed, 10-min expiry, 5 attempts, rate-limited, signs out all sessions); email delivery of notifications in the reader's language (Mailpit in dev); Android profile editing, rescheduling, document delete, meeting-link button, in-app privacy/terms; admin website-content forms instead of JSON; inline document preview (audited as document.view); main-site contact form can post leads (CORS allow-list, source tracked); app icon/splash/favicon from the ACEE logo (`pnpm --filter @acee/mobile icons`); logo served locally; GitHub Actions CI.

## Known issues & limitations

1. **Android not run on a device/emulator** (no SDK on the build machine) and **no APK/AAB built**.
2. **Email works** (SMTP; Mailpit locally) for password reset and notifications. **SMS, WhatsApp and push** are adapters that report "not configured" until ACEE chooses providers; OTP *login* (as opposed to reset) is not available. `expo-notifications` is not installed yet.
3. **Storage**: local private disk only; S3-compatible driver not written → single API instance. Appointment reminders run in-process (every 15 min).
4. **Meeting links** are entered manually by counselors; no calendar/video integration.
5. **Scheme rules** are seeded from the brochure and marked UNVERIFIED; **company details** unconfirmed. Both need ACEE action.
6. **Android scope**: student features only (staff use the web console). Students cannot view an uploaded file inside the app (they can on the website).
7. Admin-entered text (rule descriptions, trainer announcements, custom stage names without translations) is shown as entered; a few admin form labels on the stage editor are English-only.
8. Locale is cookie-based, so every web page is dynamically rendered (no static caching, no per-language URLs/hreflang).
9. `lint` = TypeScript checks; no ESLint rules configured.
10. No automated retention purge, malware scanning, or web CSP (see [SECURITY.md](SECURITY.md)).
11. Dark mode: tokens are centralised but no dark theme is shipped.

## Next steps

1. Run the Android app on a device ([manual checklist](TESTING.md#manual-android-smoke-checklist)) and produce a preview APK via EAS.
2. ACEE: verify scheme rules and confirm business details; legal review of privacy/terms.
3. Wire one SMS/WhatsApp provider and email (adapters in `apps/api/src/lib/notify.ts`), then real OTP.
4. Add the S3 storage driver and a job runner before scaling beyond one API instance.
