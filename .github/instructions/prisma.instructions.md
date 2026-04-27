---
applyTo: "prisma/**,lib/db.ts,lib/rls-*.ts"
description: "Rules for Prisma schema, migrations, seeds, and DB access helpers."
---

# Prisma & PostgreSQL

## Schema (`prisma/schema.prisma`)

- Every workspace-owned model has a `workspaceId String` field with `@@index([workspaceId])` (and composite indexes for common filters: `@@index([workspaceId, status])`, `@@index([workspaceId, createdAt])`).
- Required relations on tenant-scoped data use `onDelete: Cascade` from the workspace side ONLY when the data is meaningless without the workspace; otherwise prefer `Restrict` and a soft-delete column.
- Use enums (Prisma `enum`) for finite state — don't use free-form strings for status / role / type.
- Soft-delete pattern: `deletedAt DateTime?` plus a `@@index([workspaceId, deletedAt])`. Services must filter `deletedAt: null` by default.
- Money: store as integer cents (or `Decimal` with explicit scale). Never `Float`.
- Timestamps: `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt` on every mutable entity.

## Migrations

- Schema changes go through `npm run prisma:migrate:dev -- --name <descriptive_snake_case>`.
- Never edit a migration that has been merged to main. Add a follow-up migration instead.
- Destructive migrations (DROP, NOT NULL on existing column with data) need a multi-step plan: add nullable → backfill → enforce. Call this out in the PR.
- Do not run `prisma migrate reset` against any non-local database. Ever.

## Queries

- Always include `workspaceId` (or `tenantId`) in the `where` for tenant-scoped models. A bare `findUnique({ where: { id } })` on a tenant model is a bug.
- Prefer `findFirst` with composite where over `findUnique` when scoping by `workspaceId` + `id`.
- Use `select`/`include` deliberately — don't over-fetch (especially for relations with sensitive fields).
- Pagination: cursor-based (`cursor`, `take`, `skip: 1`) for large lists; offset only for small admin tables.
- Transactions: wrap multi-write operations in `prisma.$transaction(async (tx) => { ... })`. Use the `tx` client inside, never the global `prisma`.

## Raw SQL

- Avoid. If unavoidable, use `Prisma.sql\`...\`` tagged templates with `${value}` interpolation (parameterized) — NEVER string concatenation.
- Document why raw SQL was needed and add a unit test against the function.

## RLS context

- `lib/rls-context.ts` / `lib/rls-session.ts` set the Postgres session variables that DB-side row-level-security policies read. When you add a new tenant-scoped model, ensure the corresponding RLS policy exists or document why it's exempt.
