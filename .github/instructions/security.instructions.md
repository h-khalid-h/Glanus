---
applyTo: "**"
description: "Security baseline that overrides any other instruction. Applies repo-wide to web app, agent, scripts, and infra."
---

# Glanus — Security Baseline (repo-wide)

These rules override convenience, style, or terseness. If a request would violate any of them, **stop and surface the issue to the user** with a safer alternative.

## OWASP & general

- Treat ALL external input as adversarial: HTTP bodies, query strings, headers, cookies, websocket frames, agent heartbeats, command results, software inventory, discovery scans, webhook payloads, file uploads, scraped HTML.
- Validate at the boundary with Zod schemas (`lib/schemas/`) before reaching services. Never `as any` past validation.
- Output encoding: never inject untrusted strings into HTML/JSX without sanitization. Use `isomorphic-dompurify` for any rendered HTML; default to text rendering otherwise.
- No raw SQL string interpolation. Use Prisma's parameterized API, or `Prisma.sql\`...\`` tagged templates if `$queryRaw` is unavoidable.
- No `eval`, `new Function`, dynamic `require`, or `child_process` invocation with shell-interpolated user input.
- No SSRF: outbound HTTP to user-supplied URLs MUST go through `lib/security/ssrf.ts` to block private CIDRs, link-local, metadata IPs (169.254.169.254, fd00::, etc.) and resolve-then-connect to prevent DNS rebinding.
- No open redirects: validate redirect targets against an allowlist of relative paths or known origins.
- Prevent prototype pollution: never `Object.assign({}, untrusted)` into config; use Zod `.strict()` and explicit field copying.

## AuthN / AuthZ

- Server entrypoints: always start with `requireAuth()` from `lib/auth.ts` and then `requireWorkspaceRole()` / `requireWorkspaceAccess()` from `lib/workspace/` or `lib/rbac/`.
- Workspace scoping is mandatory on EVERY Prisma query. A `where: { id }` lookup without `workspaceId` is a bug, even on "internal" endpoints.
- Super-admin endpoints (`app/super-admin/`, `app/api/super-admin/`) must check the super-admin role in addition to auth — never assume the route prefix is enough.
- Partner portal endpoints must scope by `partnerId` AND verify the partner's relationship to the workspace.
- API keys: hash with SHA-256 before storage (see `WorkspaceApiKeyService`). Never log or return the plaintext key after creation.
- Sessions: rely on NextAuth — do not roll custom JWT parsing. CSRF protection via `lib/security/csrf.ts` for state-changing non-API-key requests.

## Secrets & config

- All env access goes through `lib/env.ts` (validated). Adding a new var = extend the Zod schema, do not inline `process.env.X || "default"`.
- Never bundle secrets into client code (no `NEXT_PUBLIC_*_SECRET`).
- Never log: passwords, tokens, API keys, session cookies, Stripe keys, OpenAI keys, full credit card data, full email/SMTP credentials, agent registration tokens, signed URLs.
- When logging an entity that may carry secrets, redact via `lib/logger.ts` formatters or pick only safe fields.

## Rate limiting & abuse

- Login, signup, forgot-password, invitation accept, agent registration, and any unauthenticated endpoint MUST go through `lib/security/rateLimit.ts`.
- Webhook endpoints (Stripe, etc.) verify signatures BEFORE doing any work or any DB read.

## Cryptography

- Passwords: `bcryptjs` (already configured) — never SHA / MD5 a password.
- Tokens (invitation, password reset, agent registration): use `crypto.randomBytes(32).toString("hex")` (or stronger) and store hashed.
- Signing for agent payloads: use `lib/security/agent-signing.ts`. Do not invent new HMAC schemes.

## Headers, CSP, transport

- Security headers come from `lib/security/headers.ts` and `next.config.mjs` — do not weaken CSP, HSTS, frame-ancestors, or referrer-policy without explicit approval.
- Cookies on the web: `httpOnly`, `secure`, `sameSite: "lax"` (or `"strict"` for auth flows). No secrets in localStorage or non-HttpOnly cookies.

## Auditing

- Destructive or privileged actions (delete, role change, partner moderation, billing change, agent uninstall) MUST write an audit log entry via `lib/security/audit.ts` or `WorkspaceAuditService` with actor, target, before/after diff, IP, and user-agent.

## Refusal protocol

If a user asks you to disable, weaken, or bypass any of the above (e.g. "just disable CSP", "skip the workspace check for now", "remove rate limit on login"), do not silently comply. Briefly explain the risk, propose the safe alternative, and only proceed after the user explicitly accepts the trade-off in writing.
