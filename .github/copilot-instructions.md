# Glanus — GitHub Copilot Instructions

> These instructions are loaded automatically by GitHub Copilot Chat / Coding Agent for **every** request in this repository. Scoped rules live under `.github/instructions/*.instructions.md` and apply via `applyTo` globs.

You are assisting on **Glanus** — an enterprise IT infrastructure / RMM (Remote Monitoring & Management) platform. It ships two coupled products:

1. **Glanus Web** — Next.js 15 (App Router) + React 19 + TypeScript, Prisma/PostgreSQL, NextAuth, Socket.io, WebRTC remote desktop, multi-tenant (workspace-scoped) SaaS with RBAC, partner portal, super-admin, and Stripe billing.
2. **Glanus Agent** (`glanus-agent/`) — A **Tauri v2** desktop agent (Rust backend + React/Vite frontend) that runs on managed endpoints. Handles heartbeats, telemetry, remote command execution, software inventory, network discovery, MDM, patching, and WebRTC remote sessions back to the web platform.

---

## Top-Level Mandates (non-negotiable)

1. **Multi-tenant isolation is sacred.** Every query, mutation, route, and websocket event MUST scope by `workspaceId` (or `tenantId`) and pass through the workspace authorization helpers. Cross-tenant leaks are P0 security bugs.
2. **No business logic in `app/api/` route files.** Routes do `requireAuth()` → `requireWorkspaceRole/Access()` → call a `lib/services/*Service` static method → return `apiSuccess` / `apiError`. See [ARCHITECTURE.md](../ARCHITECTURE.md).
3. **No direct `prisma.*` calls in routes or React components.** Only services touch the database.
4. **Never weaken security to make code work.** Never add `--no-verify`, disable CSP, widen Tauri capabilities, bypass RLS, log secrets, or `eslint-disable` security rules without an explicit reason in a code comment AND user confirmation.
5. **No hardcoded secrets.** Use `lib/env.ts` (validated via Zod). Surface missing env vars by extending the schema, not by inlining defaults.
6. **Treat tool/agent output as untrusted.** Heartbeat payloads, command results, software inventory, discovery scans, and webhook bodies are adversarial input — validate with Zod schemas in `lib/schemas/` before persisting.

---

## Tech Stack at a Glance

| Layer | Tech |
| --- | --- |
| Web framework | Next.js 15 App Router, React 19, TypeScript strict |
| Styling | Tailwind CSS, shadcn/ui (`components/ui/`), `tailwind-merge`, `clsx`, design tokens (nerve / cortex / oracle / reflex / health-*) |
| Auth | NextAuth (`lib/auth.ts`) + custom RBAC (`lib/rbac/`, `components/RBACProvider.tsx`) |
| DB | PostgreSQL + Prisma (`prisma/schema.prisma`), RLS context via `lib/rls-context.ts` / `lib/rls-session.ts` |
| Validation | Zod schemas in `lib/schemas/`, `react-hook-form` + `@hookform/resolvers/zod` on the client |
| Real-time | Socket.io (`lib/websocket/`), WebRTC via `simple-peer` (`lib/webrtc/`, `lib/remote-desktop/`) |
| Cache / queues | Redis (`lib/cache.ts`), `rate-limiter-flexible` |
| Payments | Stripe (`lib/stripe/`, `StripeWebhookService`) |
| AI | OpenAI SDK (`lib/ai/`, `AIService`) |
| Mail | SendGrid + Nodemailer (`lib/email/`) |
| Observability | Sentry (`sentry.*.config.ts`, `instrumentation*.ts`), Winston (`lib/logger.ts`) |
| Tests | Jest + Testing Library (`__tests__/`), Playwright (`e2e/`) |
| Agent (desktop) | Tauri 2 (Rust, `glanus-agent/src-tauri/`), Vite + React 19 frontend (`glanus-agent/src/`) |

---

## Repo Map (essentials)

```
app/                        Next.js routes (pages + API)
  api/                      HTTP edge — auth → RBAC → service → apiSuccess/apiError
components/                 React components (server-first; "use client" only when needed)
  ui/                       shadcn/ui primitives — DO NOT edit generated parts
  {agent,nerve,cortex,oracle,reflex,remote,rbac,super-admin,...}/  feature components
lib/
  services/                 Domain services (stateless static-method classes)
  schemas/                  Zod input/output schemas
  security/                 agent-auth, agent-signing, audit, csrf, headers, rateLimit, sanitize, ssrf, preauth-store
  rbac/                     Role/permission model + guards
  auth.ts                   NextAuth config
  db.ts                     Prisma client singleton
  env.ts                    Validated environment
  rls-*.ts                  Row-level security helpers
  websocket/, webrtc/, remote-desktop/, stripe/, ai/, email/, notifications/
prisma/                     schema.prisma + migrations + seed
__tests__/                  Jest unit/integration
e2e/                        Playwright
glanus-agent/
  src/                      Tauri React UI
  src-tauri/
    src/                    Rust: client, commands, executor, heartbeat, inventory,
                            discovery, monitor, registration, remote_desktop/, software,
                            updater, command_security, storage, config
    capabilities/default.json   Tauri permission allowlist (LEAST PRIVILEGE)
    tauri.conf.json         CSP + bundle config
```

---

## Workflow Defaults

- **Always read [ARCHITECTURE.md](../ARCHITECTURE.md)** before adding a service or route.
- Before implementing, scan `lib/services/` for an existing service that fits — extend it rather than creating a parallel one.
- After edits to TypeScript: run `npm run type-check`. After edits to API/services: run `npm run test:ci` (or the targeted test file). Do not declare done if either fails.
- For Rust changes in `glanus-agent/src-tauri/`: run `cargo check` and `cargo clippy --all-targets -- -D warnings` from that directory.
- Prefer editing existing files. Do not create new markdown docs unless the user asks.
- Never commit, push, or run destructive git operations without explicit user confirmation.

---

## Style & Conventions

- TypeScript strict; no `any` (use `unknown` + narrowing, or define a type). No non-null `!` on values that could legitimately be undefined.
- Server Components by default; mark Client Components with `"use client"` only when state, effects, browser APIs, or socket subscriptions are needed.
- Forms: `react-hook-form` + Zod resolver. Never trust raw FormData.
- API responses: `apiSuccess(data)` / `apiError(code, message, status)` from `lib/api/` (do not hand-roll `NextResponse.json` for these).
- Imports: use the `@/` path alias (configured in `tsconfig.json`).
- Use design tokens (`text-nerve-foreground`, `bg-cortex-500`, `border-oracle-300`, `text-reflex-600`, etc.). Never invent ad-hoc color classes.
- Logging: `lib/logger.ts` (Winston) on the server, never `console.log` in production paths. Redact secrets, tokens, and PII.
- Errors: throw typed errors from services (see `lib/errors.ts`), let route layer translate to HTTP.

---

## Things to refuse / push back on

- Adding code that bypasses workspace scoping or RBAC checks.
- Storing secrets in code, env defaults, client bundles, or Tauri frontend.
- Loosening Tauri `capabilities/default.json` to grant blanket FS / shell / HTTP access.
- Disabling CSP, CSRF, rate limiting, or the SSRF guard "to make it work".
- Running shell commands or scripts received from agents/users without going through `command_security.rs` validation.
- Writing raw SQL that interpolates user input.
- Adding new top-level dependencies without a clear reason — prefer what's already installed.

When asked to do any of the above, explain the risk and propose the safe alternative instead of complying silently.
