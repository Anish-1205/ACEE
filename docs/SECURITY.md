# Security & privacy review checklist

Status: ✅ implemented and tested · 🟡 implemented, not covered by an automated test · ⬜ not done

This describes design intent; it is not a statement of legal compliance. A qualified review is required before production.

## Authentication & sessions

- ✅ Argon2id password hashing (OWASP parameters); timing-equalised failed logins for unknown users
- ✅ Generic "incorrect email/mobile or password" error
- ✅ Login/register/refresh rate limits (10/min per IP) plus a global limit
- ✅ Web: opaque session token in `HttpOnly`, `SameSite=Lax`, `Secure` (prod) cookie; token stored hashed (SHA-256)
- ✅ CSRF: cookie-authenticated writes must carry an allowed `Origin`
- ✅ Mobile: 15-minute access token + 30-day refresh token, rotated on each use; reuse of an old refresh token revokes the whole family
- 🟡 Mobile tokens stored with `expo-secure-store` (Android Keystore)
- ✅ Logout revokes the session family; disabling a user or changing a role revokes all sessions
- ✅ OTP endpoint returns 501 until a provider exists (no fake OTP)

## Authorization

- ✅ Every check is server-side (`requireRole` + ownership queries); `/api/v1/admin/*` is admin-only before body validation
- ✅ Public sign-up always creates STUDENT; role field ignored
- ✅ Invitations: admins → counselor/trainer only; super admin → any staff role; one-time, hashed, 72 h expiry
- ✅ Students see only their own records; counselors only students assigned to them or who booked them; trainers only their batch rosters (names only)
- ✅ Internal application notes and counselor notes never returned on student endpoints
- 🟡 Super-admin-only: role changes, admin account changes, business-detail confirmation, account deletion execution

## Documents

- ✅ Type decided by magic bytes (PDF/JPEG/PNG), not filename or client MIME
- ✅ 5 MB limit, 1 file per request, sanitised filename, random storage key, mode 0600, outside any web root
- ✅ No public URLs: download only via authorised API route with `Cache-Control: private, no-store`, `nosniff`, attachment disposition
- ✅ Every upload, download, review and deletion audit-logged (who, when, IP)
- ✅ Re-upload supersedes; student deletion purges the file immediately
- ⬜ Virus/malware scanning (add ClamAV or a provider before accepting large volumes)
- ⬜ Encryption at rest beyond the host's disk encryption

## Data minimisation & DPDP

- ✅ No Aadhaar, bank, passport fields anywhere; UI warns not to upload them
- ✅ Caste category, income and marks are collected only in an eligibility check and stored with that assessment; anonymous checks are not stored
- ✅ Consent records (purpose, version, time, IP) for terms, privacy, email/SMS/WhatsApp; changeable in settings
- 🟡 Right of access: `GET /me/export` (JSON download from settings)
- 🟡 Erasure: student requests deletion → super admin executes (files purged, PII anonymised, sessions revoked)
- ⬜ Automated time-based retention (e.g. purge documents N months after a case closes) — policy decision needed from ACEE
- ⬜ Breach-notification runbook, grievance officer contact, children's-data handling if minors are expected

## Input & output

- ✅ Zod validation on every body/query/param (shared with clients)
- ✅ Safe error handling: 500s return a generic message; details only in server logs
- ✅ CSV export escapes formula-injection characters
- ✅ JSON-LD output escapes `<`
- ✅ Security headers: Helmet on API; `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` on web
- ⬜ Content-Security-Policy for the web app (needs nonce setup with Next.js)

## Operations

- ✅ Secrets only via environment; `.env` git-ignored; `.env.example` has no secrets
- ✅ Seed refuses to run in production; demo credentials documented as dev-only
- ✅ `X-Forwarded-For` trusted only from configured proxies (`TRUST_PROXY`, default loopback)
- ⬜ Dependency vulnerability scanning in CI (`pnpm audit` / Dependabot)
- ⬜ Centralised log retention and alerting
