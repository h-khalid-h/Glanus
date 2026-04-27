---
applyTo: "lib/services/**"
description: "Rules for domain services in lib/services/."
---

# Domain Services — `lib/services/**`

Services hold all business logic. They are the ONLY layer that touches Prisma directly (alongside `lib/db.ts` helpers and migrations).

## Shape

- Stateless **classes with `static` methods**. No instance state, no constructors, no singletons-with-fields.
- File name = class name = `XxxService.ts`.
- Methods take a single typed object argument, never positional primitives:
  ```ts
  static async createAsset(args: { workspaceId: string; actorId: string; input: CreateAssetInput }): Promise<Asset> { ... }
  ```
- Return Prisma model types or domain DTOs; do NOT return `NextResponse`.

## Authorization

- Every method that touches workspace-scoped data MUST accept `workspaceId` and include it in the `where` clause. Never trust an `id` in isolation.
- Cross-workspace operations (super-admin, partner moderation) must explicitly bypass scoping with a clearly named helper (e.g. `findAcrossWorkspaces`) and require a super-admin / partner role check upstream.

## Errors

- Throw the typed errors in `lib/errors.ts` (`NotFoundError`, `ForbiddenError`, `ValidationError`, `ConflictError`, `QuotaExceededError`).
- Don't return `null` to mean "not found" if the caller would have to throw anyway — throw it here.

## Side effects

- Database writes that span multiple tables MUST run inside `prisma.$transaction([...])` or `prisma.$transaction(async (tx) => { ... })`.
- External calls (Stripe, OpenAI, SendGrid, S3) belong in `lib/stripe/`, `lib/ai/`, `lib/email/`, etc. — services orchestrate, but route the call through those modules so they can be mocked in tests.
- Audit-worthy mutations call `WorkspaceAuditService.record(...)` (or equivalent) inside the same transaction.

## Catalogue

Before adding a new service, check `ARCHITECTURE.md` for an existing one. Common pitfalls:

- New asset behavior → extend `AssetService` / `AssetActionService` / `AssetBulkService`, do not fork.
- New agent telemetry → `AgentService` (heartbeat dedup lives there).
- New workspace-scoped feature → consider `WorkspaceSubFeatureService`, `WorkspaceSearchService`, etc.
- Stripe events → handle in `StripeWebhookService` with idempotency claim.

## Testing

- Each service should have a `__tests__/lib/services/XxxService.test.ts`.
- Mock Prisma via the helpers already in `__tests__/setup/`.
- Always cover: workspace isolation (negative test), validation rejection, audit log emission for destructive ops.
