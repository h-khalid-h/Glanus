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

CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceInvitation_tokenHash_key"
  ON "WorkspaceInvitation"("tokenHash");

CREATE INDEX IF NOT EXISTS "WorkspaceInvitation_tokenHash_idx"
  ON "WorkspaceInvitation"("tokenHash");

-- AuditLog: user-agent capture
ALTER TABLE "AuditLog"
  ADD COLUMN IF NOT EXISTS "userAgent" TEXT;
