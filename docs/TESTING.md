# Testing

| Suite | Command | Needs | What it covers |
|---|---|---|---|
| Type checking | `pnpm typecheck` | — | All 5 packages (`tsc --noEmit`). This is also the `lint` script; no ESLint config yet. |
| Eligibility engine | `pnpm --filter @acee/shared test` | — | Thresholds, boundaries, unknown answers → review, REVIEW vs NOT_MET precedence, category gate, rule schema |
| Translations | `pnpm --filter @acee/i18n test` | — | te/hi have exactly the English keys, no empty strings, same `{{variables}}`, mostly translated; runtime fallback; INR formatting. Missing keys also fail **compilation** (`te`/`hi` are typed against `en`). |
| API integration | `pnpm --filter @acee/api test` | Postgres + Mailpit (`docker compose up -d`) | Runs all migrations on `acee_test` (migration test), then: registration/login, invalid credentials, rate limit, CSRF origin check, refresh rotation + reuse detection, role enforcement, invitations, SC/ST rule versions + history, capacity under concurrency + waitlist promotion, trainer roster/attendance scope, double-booking under concurrency, reschedule, reminders idempotency, counselor scoping, application stage history + hidden internal notes, document isolation (student/trainer/unrelated counselor), magic-byte file validation, audit of downloads |
| Web components | `pnpm --filter @acee/web test` | — | Eligibility result rendering in 3 languages (React Testing Library) |
| Web E2E | `pnpm --filter @acee/web e2e` | API + web dev servers (auto-started if absent), Playwright Chromium | Full student journey in the browser, admin document review + rule versioning, counselor note, trainer attendance, access control, phone layout. **Reseeds the dev DB.** |
| Android smoke | `pnpm --filter @acee/mobile smoke` | — | Metro bundles the whole app for Android into Hermes bytecode (catches resolution/compile errors). |

## Latest results (2026-11-01, this machine)

| Suite | Result |
|---|---|
| Typecheck (5 packages) | ✅ pass |
| shared | ✅ 11/11 |
| i18n | ✅ 11/11 |
| api | ✅ 26/26 (5 migrations applied to a fresh test DB; password reset verified through real email in Mailpit) |
| web components | ✅ 3/3 |
| web E2E (Playwright, Chromium desktop + Pixel 7 emulation) | ✅ 11/11 |
| Android bundle export | ✅ 1355 modules |
| CI (`.github/workflows/ci.yml`) | Written, **not yet run on GitHub** — check the first run in the repo's Actions tab |
| `next build` | ✅ 45 routes |

## Not run

- **Android on a device/emulator**: no Android SDK or emulator is installed on the build machine, so the app has not been launched on Android. Only the typecheck and the bundle export above ran. Run the [manual Android checklist](#manual-android-smoke-checklist) on a device before release.
- **APK/AAB builds**: not built (needs an Expo/EAS account or a local Android SDK). See [DEPLOYMENT.md](DEPLOYMENT.md#android).
- External providers (email/SMS/WhatsApp/push/S3) are not wired, so there is nothing to test there.

## Manual Android smoke checklist

1. Welcome screen shows in device language (te/hi/en); switching language re-renders everything.
2. Register a new student → lands on Home; Home shows welcome + quick actions.
3. Eligibility wizard → result with reasons + government disclaimer.
4. Coaching → expand IELTS → Register → "You are registered!"; appears under My coaching.
5. Counseling → pick type/date/slot → Book; cancel it.
6. Documents → Choose file (PDF) and Take photo → status "Under review".
7. Menu → My application → Start; history shows the first stage.
8. Kill and reopen the app → still signed in (refresh token in SecureStore). Wait > 15 min → API calls still work (silent refresh).
9. Log out → back to Welcome; tokens removed.
