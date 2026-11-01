# ACEE Global Education

*From Our Village to a Global Future*

Student portal extension of **https://www.aceereviewconsultants.com**, intended for **portal.aceereviewconsultants.com**: a multilingual (English / తెలుగు / हिन्दी) website, staff console and Android app for **ACEE Review Consultants Pvt. Ltd.**: free coaching registration, preliminary scholarship eligibility screening (Dr. B.R. Ambedkar Overseas Vidya Nidhi), counseling bookings, private document uploads and application-assistance tracking.

> ACEE Global Education is operated by a private company. It is **not** a Government of Telangana portal. Eligibility results are preliminary; official applications go through https://telanganaepass.cgg.gov.in/.

## What's inside

```
apps/api       Fastify REST API + Prisma/PostgreSQL (OpenAPI docs at /docs)
apps/web       Next.js 16 website, student portal, counselor/trainer/admin consoles
apps/mobile    Expo (React Native) Android app for students — native screens, no WebView
packages/shared   Zod schemas, eligibility engine, roles, design tokens, typed API client
packages/i18n     en-IN / te-IN / hi-IN translations (13 namespaces) + formatters
assets/references Brochure images supplied by ACEE
docs/          Architecture, status, deployment, security, testing
```

## Local setup

Requirements: Node 24, pnpm 12, Docker Desktop.

```bash
pnpm install
```

```bash
docker compose up -d
```

This starts PostgreSQL and **Mailpit**, a local mail catcher: every email the app sends in development (password reset codes, notifications) appears at http://localhost:8025.

```bash
cp .env.example apps/api/.env
```

```bash
pnpm db:migrate
```

```bash
pnpm db:seed
```

Then run each in its own terminal:

```bash
pnpm dev:api
```

```bash
pnpm dev:web
```

Open http://localhost:3000 (API docs: http://localhost:4000/docs).

### Demo accounts (development only)

All use password `AceeDemo2026`. The seed refuses to run when `NODE_ENV=production`; never create these in production.

| Role | Email |
|---|---|
| Super admin | superadmin@demo.acee.test |
| Admin | admin@demo.acee.test |
| Counselor | counselor1@demo.acee.test, counselor2@demo.acee.test |
| Trainer | trainer@demo.acee.test |
| Student | student1@demo.acee.test (Telugu), student2@demo.acee.test (Hindi) |

### Android app

```bash
pnpm dev:mobile
```

Press `a` with an Android emulator running (or scan the QR code in a development build). The emulator reaches the local API at `http://10.0.2.2:4000`; for a phone on Wi-Fi set `EXPO_PUBLIC_API_URL=http://<PC-LAN-IP>:4000`. Build instructions: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#android).

## Checks

```bash
pnpm typecheck
```

```bash
pnpm test
```

```bash
pnpm --filter @acee/web e2e
```

```bash
pnpm --filter @acee/mobile smoke
```

The E2E run reseeds the development database. Details and latest results: [docs/TESTING.md](docs/TESTING.md).

## Documentation

- [Architecture & decisions](docs/ARCHITECTURE.md)
- [Implementation status, known issues](docs/IMPLEMENTATION_STATUS.md)
- [Deployment, admin provisioning, Android builds, production checklist](docs/DEPLOYMENT.md)
- [Security & privacy review checklist](docs/SECURITY.md)
- [Testing](docs/TESTING.md)
