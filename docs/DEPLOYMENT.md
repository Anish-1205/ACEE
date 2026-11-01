# Deployment & operations

Nothing has been deployed, no paid service configured, and nothing published to Google Play. Every step below needs ACEE's explicit approval first.

## Topology

```
Browser ──HTTPS──► Next.js web (apps/web, `next start`) ──/api/v1 rewrite──► Fastify API (apps/api) ──► PostgreSQL 17
Android app ─────────────HTTPS─────────────────────────────────────────────► Fastify API      └──► private upload volume
```

Run web and API on the same host (or set `TRUST_PROXY` to the web server's IP) so per-IP rate limits see real client addresses.

## Integration with www.aceereviewconsultants.com

The app is the **student portal** of the existing website, served from its own subdomain. The existing site is not modified except for links.

| Item | Value |
|---|---|
| Portal URL | `https://portal.aceereviewconsultants.com` (name is a suggestion) |
| DNS | One `A`/`CNAME` record for `portal` pointing at the portal server, with HTTPS |
| Web env | `NEXT_PUBLIC_SITE_URL=https://portal.aceereviewconsultants.com` |
| API env | `WEB_ORIGINS` and `PUBLIC_WEB_URL` = the portal URL |
| Cookies | Host-only on the portal subdomain; nothing is shared with or set on the main site |

What lives where:
- **Main site** keeps About, Contact (`contact.php`), study destinations, visas, migration, branches, reviews and blog. The portal header/footer link there, and portal `/about`, `/contact`, `/countries` redirect there (307).
- **Portal** owns the scholarship scheme page, eligibility checker, coaching registration, counseling booking, student/staff logins and dashboards. Only these pages are in its sitemap, so there is no duplicate content with the main site.
- The portal header shows the main site's logo, loaded from `/img/AACEEREVVIEW_LOGO.svg` on www.aceereviewconsultants.com. Before production, copy that file into `apps/web/public/` so the portal does not depend on the main site being up.

Links to add on the main site (suggested):
- Header button **Student Portal** → `https://portal.aceereviewconsultants.com/login`
- Scholarship Guidance section → `/scholarships` and **Check Eligibility** → `/eligibility`
- IELTS / PTE / TOEFL / GRE pages → `/coaching/ielts` (etc.) "Register for free coaching"
- Book a Free Consultation → `/counseling`

Example:

```html
<a href="https://portal.aceereviewconsultants.com/eligibility" class="btn">Check Scholarship Eligibility</a>
```

The main site's "Send Your Message" form is separate. If ACEE wants those leads in the portal's admin console, it can post to `POST /api/v1/inquiries` (fields: name, mobile, email, interest, message, consent).

## Database & migrations

- Schema: `apps/api/prisma/schema.prisma`; migrations: `apps/api/prisma/migrations/` (versioned SQL, committed).
- Development: `pnpm db:migrate` (creates a new migration when the schema changes, then regenerates the client).
- Production: `pnpm --filter @acee/api prisma:deploy` — applies pending migrations only; never `migrate dev` or `seed`.
- Backups: daily `pg_dump` + point-in-time recovery from the managed Postgres provider, plus a backup of the upload volume taken at the same time (documents are referenced by storage key). Test a restore before go-live.

## API

```bash
pnpm install --frozen-lockfile
```

```bash
pnpm --filter @acee/api prisma:deploy
```

```bash
NODE_ENV=production pnpm --filter @acee/api start
```

Required env: see `.env.example`. In production set `WEB_ORIGINS` and `PUBLIC_WEB_URL` to the real HTTPS origin, keep `STORAGE_LOCAL_DIR` on a persistent private volume, and keep secrets in the host's secret manager (never in the repo). Health check: `GET /health`. OpenAPI: `/docs` (restrict or disable publicly if preferred).

Only one API instance is supported today (local-disk storage, in-process reminder timer). To scale out, add an S3-compatible `StorageDriver` and move reminders to a scheduled job.

## Web

```bash
pnpm --filter @acee/web build
```

```bash
API_URL=http://127.0.0.1:4000 NEXT_PUBLIC_SITE_URL=https://www.example.in pnpm --filter @acee/web start
```

Put both behind an HTTPS reverse proxy (Caddy/Nginx) or a platform that terminates TLS. Session cookies are `Secure` when `NODE_ENV=production`.

## Administrator provisioning

1. Create the first super admin on the server (password from the environment, never on the command line):
   ```bash
   SUPERADMIN_PASSWORD='<strong password>' pnpm --filter @acee/api provision:superadmin -- --email owner@acee.example --name "Owner Name" --mobile 9XXXXXXXXX
   ```
2. Sign in on the website → Admin console → **Users & roles → Invite staff member**. Super admins can invite admins; admins can invite counselors and trainers.
3. The app shows a one-time link valid for 72 hours (no email provider is wired). Send it through a trusted channel. The invitee sets their own mobile and password.
4. Public registration can only create students; roles change only through a super admin.

## Business details confirmation

Brochure contact details are seeded in **Admin → Website content → company** as *Not confirmed*; the public site shows "awaiting confirmation". A super admin confirms after checking company records. Editing that block resets confirmation. Do not add any government-empanelment claim unless ACEE holds verifiable documents.

## Scheme rules before go-live

The seeded SC/ST rules come from the brochure and are labelled `UNVERIFIED`. An admin must check each threshold against the current Government Order on https://telanganaepass.cgg.gov.in/OverseasLinks.do, create a new rule version with the real GO reference and dates, and activate it.

## Android

App id `com.aceereview.globaleducation`. Profiles in `apps/mobile/eas.json`:

| Profile | Output | Use |
|---|---|---|
| `development` | APK with dev client | Local testing against `http://10.0.2.2:4000` |
| `preview` | APK | Internal testers; set `EXPO_PUBLIC_API_URL` to the staging HTTPS API first |
| `production` | AAB | Google Play upload; set `EXPO_PUBLIC_API_URL` to the production HTTPS API first |

The placeholder URLs in `eas.json` (`*.example.invalid`) must be replaced before building `preview`/`production`.

Cloud build (needs a free Expo account):

```bash
npm install -g eas-cli
```

```bash
cd apps/mobile && eas login && eas build:configure
```

```bash
eas build --platform android --profile preview
```

```bash
eas build --platform android --profile production
```

Local build (needs Android Studio + SDK + JDK 17/21):

```bash
cd apps/mobile && npx expo prebuild --platform android && cd android && ./gradlew assembleRelease
```

**No APK or AAB has been produced yet.**

### Signing

- Let EAS manage the upload keystore (recommended) or supply your own; back up the keystore and passwords outside the repo. Losing it blocks app updates unless Play App Signing is enabled.
- Enroll in **Play App Signing** (required for AAB on Google Play).

### Google Play requirements (checklist)

- Developer account (organisation account for ACEE; D-U-N-S number required for organisations).
- Privacy policy URL (the website `/privacy` page, after legal review).
- Data safety form: declare name, email, phone, district, eligibility answers (income, category, marks), uploaded documents; encrypted in transit; deletion request available in-app via web settings.
- Content rating questionnaire; target audience 18+ (students); no ads.
- Target API level must meet Play's current requirement (Expo SDK 58 handles this; verify at upload).
- App access instructions for reviewers: a reviewer test account (create a dedicated student, **not** the demo seed accounts).
- Store listing in English, Telugu and Hindi; screenshots from a real device.
- The listing and app must not imply government affiliation (Play's government-impersonation policy).

## Production checklist

- [ ] Legal review of privacy policy, terms and consent wording (DPDP Act 2023 / DPDP Rules 2025)
- [ ] Scheme rules verified against the current GO and a verified version activated
- [ ] Company details confirmed by a super admin
- [ ] `NODE_ENV=production`, HTTPS everywhere, `WEB_ORIGINS`/`PUBLIC_WEB_URL` set, secrets in a secret manager
- [ ] `prisma migrate deploy` run; no seed data in production; demo accounts absent
- [ ] Super admin provisioned via CLI; staff invited
- [ ] Database + upload-volume backups scheduled and a restore tested
- [ ] Upload volume not web-served; disk-usage alerting
- [ ] `/docs` restricted if the API is internet-facing
- [ ] Log retention set; logs contain no document contents or passwords (Fastify logs method/URL only)
- [ ] Android `EXPO_PUBLIC_API_URL` points at production HTTPS; release built and tested on a real device
- [ ] Incident contact and data-breach notification procedure documented (DPDP)
