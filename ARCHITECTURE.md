# Glanus — Architecture Reference

> **Maintained by the Architecture Guardian.** Update this document whenever the service layer, layering rules, or extension patterns change.

---

## Layering Model

```
┌─────────────────────────────────────────┐
│             app/api/ (Routes)           │  ← HTTP edge, auth, validation only
├─────────────────────────────────────────┤
│          lib/services/ (Domain)         │  ← Business logic, NO infrastructure
├─────────────────────────────────────────┤
│     lib/workspace/, lib/security/,      │
│     lib/email/, lib/stripe/, etc.       │  ← Infrastructure / utilities
├─────────────────────────────────────────┤
│         lib/db (Prisma + PostgreSQL)    │  ← Data layer
└─────────────────────────────────────────┘
```

**Hard rules:**
- ✗ No business logic in `app/api/` routes — delegate everything to a service
- ✗ No direct `prisma.*` calls from route files
- ✗ No tight coupling between feature services — use shared utilities or events
- ✓ Services are stateless static-method classes
- ✓ Route files: `requireAuth()` → `requireWorkspaceRole/Access()` → call service → return `apiSuccess/apiError`

---

## Service Catalogue

### Core Asset Domain

| Service | File | Responsibility |
|---|---|---|
| `AssetService` | `lib/services/AssetService.ts` | Asset CRUD: getAssets (filtered/paginated), createAsset (quotas + polymorphic sub-entities + dynamic fields), getAssetById, updateAsset, deleteAsset (soft) |
| `AssetActionService` | `lib/services/AssetActionService.ts` | Dynamic asset actions: listActions, getActionBySlug, executeAction (fire-and-forget 202 pattern) |
| `AssetAnalyticsService` | `lib/services/AssetAnalyticsService.ts` | Asset telemetry: getMetrics (agent time-series), getSchema (dynamic field + action definition), exportAssets (CSV) |
| `AssetBulkService` | `lib/services/AssetBulkService.ts` | `bulkDelete`, `bulkUpdate`, `bulkAssign`, `bulkAction`, `importCSV` |
| `AssetRelationshipService` | `lib/services/AssetRelationshipService.ts` | Relationship CRUD + circular dependency BFS check |
| `AssetAssignmentService` | `lib/services/AssetAssignmentService.ts` | `assignAsset`, `unassignAsset`, `executeScript`, `getScriptHistory`, `getLinkedAgent` |

### Workspace Domain

| Service | File | Responsibility |
|---|---|---|
| `WorkspaceService` | `lib/services/WorkspaceService.ts` | Workspace CRUD, member management, activity feed |
| `WorkspaceSubFeatureService` | `lib/services/WorkspaceSubFeatureService.ts` | Workspace-level utilities: data export (JSON/CSV) + Stripe billing portal session |
| `WorkspaceAgentService` | `lib/services/WorkspaceAgentService.ts` | Workspace RMM: agent list with online/offline stats + agent telemetry detail |
| `WorkspaceSearchService` | `lib/services/WorkspaceSearchService.ts` | Unified cross-entity search: assets, agents, AI insights |
| `WorkspaceNotificationService` | `lib/services/WorkspaceNotificationService.ts` | Merged audit log + AI insight notification feed |
| `WorkspacePartnerService` | `lib/services/WorkspacePartnerService.ts` | Partner lifecycle: removePartner, reviewPartner, assignPartner |
| `WorkspaceApiKeyService` | `lib/services/WorkspaceApiKeyService.ts` | API key lifecycle: list, create (SHA-256 hash), revoke |
| `WorkspaceWebhookService` | `lib/services/WorkspaceWebhookService.ts` | Workspace notification webhook lifecycle: get, upsert (create-or-update), delete |
| `InvitationService` | `lib/services/InvitationService.ts` | Invitation lifecycle: list, create (with email), revoke |
| `MaintenanceService` | `lib/services/MaintenanceService.ts` | Maintenance window CRUD with audit trail |
| `WorkspaceReportService` | `lib/services/WorkspaceReportService.ts` | On-demand CSV reports (3 types) + report schedule CRUD |
| `NetworkService` | `lib/services/NetworkService.ts` | Network topology (devices + scans) + software inventory |
| `StorageService` | `lib/services/StorageService.ts` | Records file upload audit events (actual storage is route-layer) |

### Agent / RMM Domain

| Service | File | Responsibility |
|---|---|---|
| `AgentService` | `lib/services/AgentService.ts` | Agent registration, heartbeat (Prism dedup engine), command results, update checks, software sync, discovery |
| `RemoteSessionService` | `lib/services/RemoteSessionService.ts` | WebRTC remote session lifecycle |
| `ScriptService` | `lib/services/ScriptService.ts` | Script CRUD and execution dispatch |
| `PatchService` | `lib/services/PatchService.ts` | Patch policy CRUD (get/create/update/delete) + execution dispatch across vulnerable endpoints |
| `MdmService` | `lib/services/MdmService.ts` | Mobile device management |

### Security / AI / Analytics

| Service | File | Responsibility |
|---|---|---|
| `AlertService` | `lib/services/AlertService.ts` | Alert rule evaluation |
| `WorkspaceAlertService` | `lib/services/WorkspaceAlertService.ts` | Workspace-scoped alert CRUD |
| `WorkspaceAuditService` | `lib/services/WorkspaceAuditService.ts` | Audit log queries |
| `AIService` | `lib/services/AIService.ts` | AI insight generation and management |
| `AnalyticsService` | `lib/services/AnalyticsService.ts` | Dashboard metrics and analytics aggregation |
| `DashboardService` | `lib/services/DashboardService.ts` | Dashboard data composition |
| `ZtnaService` | `lib/services/ZtnaService.ts` | Zero Trust Network Access |

### Admin / Platform

| Service | File | Responsibility |
|---|---|---|
| `AdminService` | `lib/services/AdminService.ts` | Agent version lifecycle: list and publish with auto-deprecation |
| `AssetCategoryAdminService` | `lib/services/AssetCategoryAdminService.ts` | Asset category CRUD (circular-ref guard), field definitions (value-count guard), action definitions (soft-delete) |
| `PartnerModerationService` | `lib/services/PartnerModerationService.ts` | Partner moderation state machine (verify/activate/suspend/ban/unsuspend) with ban cascade |
| `PartnerService` | `lib/services/PartnerService.ts` | Partner portal and application management |
| `AccountService` | `lib/services/AccountService.ts` | User registration, forgot/reset password, profile, password change, invitations, onboarding |
| `TicketService` | `lib/services/TicketService.ts` | Support ticket CRUD |
| `DynamicFieldService` | `lib/services/DynamicFieldService.ts` | Dynamic field validation, serialization, and inherited field resolution |
| `StripeWebhookService` | `lib/services/StripeWebhookService.ts` | Event claiming (idempotency) + 5 event handlers: checkout, subscription create/update/cancel, payment success/failure |
| `SystemMaintenanceService` | `lib/services/SystemMaintenanceService.ts` | Platform-level maintenance operations |

### Notifications / Alerting Infrastructure

> These were originally singleton-exported classes in `lib/` root. They now live in `lib/services/`.

| Service | File | Responsibility |
|---|---|---|
| `AlertEvaluatorService` | `lib/services/AlertEvaluatorService.ts` | Evaluates alert rules against agent metrics; sustained violation logic |
| `NotificationOrchestratorService` | `lib/services/NotificationOrchestratorService.ts` | Coordinates alert evaluation, email delivery, webhook delivery for all workspaces |
| `WebhookNotificationService` | `lib/services/WebhookNotificationService.ts` | Outbound webhook delivery with HMAC signing and 3-tier retry backoff |
| `AlertEmailService` | `lib/services/AlertEmailService.ts` | Alert-specific email sending (SendGrid primary, Brevo failover) |

---

## Action Handlers

Dynamic asset actions are dispatched via `lib/action-handlers/`:

```
lib/action-handlers/
  index.ts          ← executeAction() dispatcher (entry point)
  types.ts          ← Shared ActionResult type
  api.ts            ← HTTP API call actions
  script.ts         ← Agent script execution actions
  webhook.ts        ← Outbound webhook actions
  remote-command.ts ← Remote shell command actions
  manual.ts         ← Manual (human-review) action stubs
```

To add a new action handler type:
1. Create `lib/action-handlers/<type>.ts` exporting `handle<Type>Action()`
2. Add the case to the `switch` in `lib/action-handlers/index.ts`
3. That's it — `AssetService.executeAction` picks it up automatically

---

## Adding a New Feature

### New API endpoint

1. Create `app/api/<feature>/route.ts`
2. Auth guard: `requireAuth()` + `requireWorkspaceRole/Access()`
3. Validate body with `zod`
4. Delegate to the appropriate service
5. Return `apiSuccess(data)` or `apiError(status, message)` — **never** `NextResponse.json()` directly

### Schema coercion guidelines

- Use `z.coerce.number()` for numeric query params and body fields that may arrive as strings (form data, multipart)
- Avoid `.or(z.string().transform(...))` patterns — they produce `string | number` union output types that break service call sites
- Use `z.coerce.number().int().optional()` for optional integer fields (e.g. sort order, position)

### New service

1. Create `lib/services/<Feature>Service.ts` as a static-method class
2. All Prisma calls live here — never in the route
3. Throw errors with `Object.assign(new Error('...'), { statusCode: 4xx })` for route-layer handling
4. If the feature owns multiple concerns (>3 logical groups), split into sibling services from day one
5. Import service input types when calling from routes — never use `as any` casts at the call site

### New dynamic asset action type

See the "Action Handlers" section above.

---

## Known Improvement Opportunities

### Pending: `ZtnaPolicy` Prisma schema model

`ZtnaService` references `(prisma as any).ztnaPolicy` because the `ZtnaPolicy` model exists in the service
but has not yet been added to `prisma/schema.prisma`.  
**Resolution:** Add `ZtnaPolicy` model to the schema and run `prisma generate` — the `as any` casts will be removable immediately after.



---

## Audit

All mutations must call `prisma.auditLog.create(...)` or use `auditLog()` from `lib/workspace/auditLog.ts`. Route files must never call audit log directly.

## Singleton Services

Some infrastructure services use an instance-export pattern (`export const x = new X()`) rather than static methods. This is acceptable for services that maintain internal state (connection pools, retry counters, etc.). They still live in `lib/services/`.

Examples: `AlertEvaluatorService`, `NotificationOrchestratorService`, `WebhookNotificationService`, `AlertEmailService`.
