---
applyTo: "app/api/**"
description: "Rules for Next.js App Router API route handlers."
---

# API Route Handlers — `app/api/**`

Route files are the **HTTP edge** only. They MUST stay thin.

## Required shape

```ts
// app/api/<feature>/route.ts
import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { requireWorkspaceRole } from "@/lib/workspace";
import { SomeService } from "@/lib/services/SomeService";
import { SomeInputSchema } from "@/lib/schemas/some";

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { workspaceId } = await requireWorkspaceRole(session, ["OWNER", "ADMIN"]);

    const json = await req.json();
    const input = SomeInputSchema.parse(json); // throws ZodError → handled below

    const result = await SomeService.doThing({ workspaceId, actorId: session.user.id, input });
    return apiSuccess(result);
  } catch (err) {
    return apiError(err);
  }
}
```

## Hard rules

- ✗ No `prisma.*` imports in this folder. Ever.
- ✗ No business logic, no aggregation, no cross-entity orchestration in route files. Push it into `lib/services/`.
- ✗ No `NextResponse.json({ ... })` for success/error envelopes — use `apiSuccess` / `apiError`.
- ✗ Never trust `req.json()` / `req.nextUrl.searchParams` directly — parse with Zod.
- ✓ Always pass `workspaceId` and `actorId` (or full `session`) into the service. The service does authorization-relevant queries scoped to that tenant.
- ✓ For uploads, validate MIME, size, and extension before persisting. Stream where possible.
- ✓ For webhooks (`/api/webhooks/**`), verify signature BEFORE any other work and BEFORE reading the body twice — clone the stream.
- ✓ Rate limit unauthenticated endpoints via `lib/security/rateLimit.ts`.
- ✓ Use `export const dynamic = "force-dynamic"` only when the route truly cannot be statically optimized (auth-bearing routes already are by virtue of using cookies/headers).

## HTTP methods

- Match Next.js conventions: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`. No catch-all `handler()`.
- Idempotency: `PUT` and `DELETE` must be safe to retry. For external side effects (Stripe, email), use idempotency keys.

## Errors

- Throw typed errors (`NotFoundError`, `ForbiddenError`, `ValidationError`, etc. from `lib/errors.ts`) inside services.
- `apiError` maps known errors to HTTP codes and hides internals. Do not leak stack traces, Prisma error messages, or raw env values.
