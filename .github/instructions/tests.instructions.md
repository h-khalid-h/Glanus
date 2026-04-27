---
applyTo: "__tests__/**,e2e/**,**/*.test.ts,**/*.test.tsx,**/*.spec.ts"
description: "Rules for unit, integration, and end-to-end tests."
---

# Tests

## Unit / integration (Jest, `__tests__/`)

- Mirror the source path: `lib/services/AssetService.ts` → `__tests__/lib/services/AssetService.test.ts`.
- Use the Prisma mocks and helpers already in `__tests__/setup/`. Do not connect to a real DB from unit tests.
- Each service test MUST cover:
  1. Happy path
  2. Workspace isolation (call from a different workspace → expect `NotFoundError` / `ForbiddenError`)
  3. Validation rejection (bad input → ZodError or `ValidationError`)
  4. Audit log written for destructive operations
- Use `describe` blocks per method, `it` per case. Use AAA (Arrange / Act / Assert) layout.
- No snapshot tests for service outputs — assert on specific fields, not whole objects.

## React component tests (Testing Library)

- Query by accessible role / label / text — never by class name or test-id unless absolutely necessary.
- `userEvent` over `fireEvent` for interactions.
- Mock `fetch` (or the typed API client) — don't hit real routes.

## E2E (Playwright, `e2e/`)

- Use the helpers in `e2e/helpers/` for login, workspace creation, and seeded data.
- Each spec is independent — no shared state between tests. Use `test.beforeEach` to seed.
- Security specs (`api-security.spec.ts`, `security-headers.spec.ts`) must be extended whenever new headers / CSRF / rate-limit rules are added.
- Don't hardcode prod URLs. Use `process.env.PLAYWRIGHT_BASE_URL` (already wired in `playwright.config.ts`).

## What NOT to test

- Do not test third-party libraries (Prisma, Zod, NextAuth) — assume they work.
- Do not test trivial getters or pure prop-drilling components.

## Running

- `npm run test:ci` — full Jest run.
- `npm test -- <pattern>` — focused.
- `npm run test:e2e` — Playwright (requires app running or use the configured webServer).
