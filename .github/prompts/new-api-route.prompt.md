---
mode: agent
description: "Scaffold a new Next.js API route + service + Zod schema + tests in one pass."
---

# New API Route

Create a new API route for: **${input:endpoint:e.g. 'POST /api/workspaces/[id]/tags — create a tag'}**.

## Steps

1. **Plan**
   - Identify the HTTP method, path, required role(s), input shape, output shape.
   - Confirm an existing service does NOT already cover this. If one does, extend it.
2. **Schema** in `lib/schemas/<domain>.ts`:
   - `.strict()`, bounded strings, enums where finite.
   - Export the Zod object and `z.infer` type.
3. **Service method** in `lib/services/<Name>Service.ts`:
   - Static method on the class.
   - Accepts `{ workspaceId, actorId, input }`.
   - All Prisma queries include `workspaceId`.
   - Audit + transaction for destructive ops.
4. **Route** at `app/api/<path>/route.ts`:
   ```ts
   export async function POST(req: NextRequest) {
     try {
       const session = await requireAuth();
       const { workspaceId } = await requireWorkspaceRole(session, ["OWNER", "ADMIN"]);
       const input = SchemaName.parse(await req.json());
       const result = await ServiceName.method({ workspaceId, actorId: session.user.id, input });
       return apiSuccess(result);
     } catch (err) {
       return apiError(err);
     }
   }
   ```
   - Rate-limit unauthenticated routes via `lib/security/rateLimit.ts`.
   - For uploads / webhooks, follow the special handling in [api-routes.instructions.md](../instructions/api-routes.instructions.md).
5. **Tests**
   - Unit: service test with happy path, workspace isolation, validation rejection.
   - (Optional) Playwright spec under `e2e/` if user-facing.
6. **Run**
   ```bash
   npm run type-check
   npm run test:ci -- <ServiceName>
   ```

Do NOT put business logic in the route. Do NOT call `prisma.*` from the route. Do NOT hand-roll `NextResponse.json`.
