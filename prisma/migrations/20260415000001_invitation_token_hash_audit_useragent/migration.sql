-- Migration: 20260415000001_invitation_token_hash_audit_useragent
-- Additive-only: no destructive changes, fully backward-compatible.
--
-- 1. Add tokenHash to WorkspaceInvitation
--    Stores SHA-256(rawToken). The raw token travels only in invitation URLs;
--    the DB only ever holds the digest, mitigating token-enumeration attacks.
--
-- 2. Add updatedAt to WorkspaceInvitation
--    Tracks last state change (e.g. resend, revoke, accept) for auditing.
--
-- 3. Add userAgent to AuditLog
--    Captures the HTTP User-Agent header for richer forensic audit trails.

-- WorkspaceInvitation: secure token storage column
ALTER TABLE "WorkspaceInvitation"
  ADD COLUMN IF NOT EXISTS "tokenHash" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill legacy invitations before enforcing uniqueness.
-- Existing plaintext tokens are already unique from the initial schema,
-- so sha256(token) is also unique for all non-null legacy rows.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE "WorkspaceInvitation"
SET "tokenHash" = ENCODE(DIGEST("token", 'sha256'), 'hex')
WHERE "tokenHash" IS NULL
  AND "token" IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "WorkspaceInvitation"
    WHERE "tokenHash" IS NOT NULL
    GROUP BY "tokenHash"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate WorkspaceInvitation.tokenHash values exist; resolve duplicates before applying migration 20260415000001.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceInvitation_tokenHash_key"
  ON "WorkspaceInvitation"("tokenHash");

CREATE INDEX IF NOT EXISTS "WorkspaceInvitation_tokenHash_idx"
  ON "WorkspaceInvitation"("tokenHash");

-- AuditLog: user-agent capture
ALTER TABLE "AuditLog"
  ADD COLUMN IF NOT EXISTS "userAgent" TEXT;
