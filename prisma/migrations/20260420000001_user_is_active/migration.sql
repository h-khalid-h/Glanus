-- Migration: Add User.isActive
-- Closes schema drift: the `isActive` column exists in prisma/schema.prisma
-- but was never added by any prior migration. Admins use this flag to
-- deactivate members without deleting their account.
-- Idempotent: safe to re-apply.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
