---
mode: agent
description: "Audit a workspace-scoped feature for cross-tenant data leaks."
---

# Tenant Isolation Audit

Audit **${input:target:the route, service, page, or feature}** for multi-tenant isolation issues.

## Checklist

For every code path, verify:

1. **Entrypoint guard** — `requireAuth()` followed by `requireWorkspaceRole(...)` or `requireWorkspaceAccess(...)` resolves the active `workspaceId` from the session, NOT from the request body / params alone.
2. **Prisma `where`** — every `findUnique`, `findFirst`, `findMany`, `update`, `updateMany`, `delete`, `deleteMany`, `count`, `aggregate`, `groupBy` includes `workspaceId` (or scoped foreign key).
3. **`include` / `select` traversal** — when including a relation, confirm the related model is also tenant-bounded by the parent OR add an explicit `where` on the relation.
4. **Bulk / transaction operations** — `$transaction` blocks scope every individual write.
5. **Raw SQL** — `Prisma.sql\`...\`` includes a `workspaceId` predicate; values are parameterized.
6. **Background jobs / cron / heartbeat handlers** — derive `workspaceId` from the entity being processed, not from any global default.
7. **Websocket handlers** — verify the socket's session workspace matches the room / event payload before emitting.
8. **Webhook handlers** (Stripe, agent) — resolve `workspaceId` from the verified payload (e.g. Stripe `customerId` → workspace lookup), never from a query param.
9. **Super-admin / partner bypass** — explicit role check, named helper (e.g. `findAcrossWorkspaces`), and audit log entry.

## Output

For each finding:

- **Severity:** P0 (proven cross-tenant leak) / P1 (likely leak under specific input) / P2 (defense-in-depth gap) / P3 (style).
- **Location:** file + line.
- **Repro sketch:** the concrete request a user from workspace A would send to read/modify workspace B's data.
- **Fix:** the exact `where` / guard / service refactor to apply.

End with a one-paragraph summary and an ordered remediation plan. Do not modify code — report only.
