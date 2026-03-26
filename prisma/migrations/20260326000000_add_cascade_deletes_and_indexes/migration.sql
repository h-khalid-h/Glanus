-- ============================================================
-- Migration: Add missing onDelete cascades and compound indexes
-- ============================================================

-- ============================================================
-- 1. AuditLog: Change workspace from CASCADE to SET NULL
--    (Preserve audit logs when workspace is deleted for compliance)
-- ============================================================
ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_workspaceId_fkey";
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AuditLog.user → SET NULL
ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_userId_fkey";
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AuditLog.asset → SET NULL
ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_assetId_fkey";
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 2. Workspace.owner → CASCADE
-- ============================================================
ALTER TABLE "Workspace" DROP CONSTRAINT IF EXISTS "Workspace_ownerId_fkey";
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 3. WorkspaceInvitation.inviter → CASCADE
-- ============================================================
ALTER TABLE "WorkspaceInvitation" DROP CONSTRAINT IF EXISTS "WorkspaceInvitation_invitedBy_fkey";
ALTER TABLE "WorkspaceInvitation" ADD CONSTRAINT "WorkspaceInvitation_invitedBy_fkey"
  FOREIGN KEY ("invitedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 4. Asset.assignedTo → SET NULL
-- ============================================================
ALTER TABLE "Asset" DROP CONSTRAINT IF EXISTS "Asset_assignedToId_fkey";
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_assignedToId_fkey"
  FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 5. Asset.category → SET NULL
-- ============================================================
ALTER TABLE "Asset" DROP CONSTRAINT IF EXISTS "Asset_categoryId_fkey";
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "AssetCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 6. RemoteSession.user → CASCADE
-- ============================================================
ALTER TABLE "RemoteSession" DROP CONSTRAINT IF EXISTS "RemoteSession_userId_fkey";
ALTER TABLE "RemoteSession" ADD CONSTRAINT "RemoteSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 7. AIInsight.user → SET NULL
-- ============================================================
ALTER TABLE "AIInsight" DROP CONSTRAINT IF EXISTS "AIInsight_userId_fkey";
ALTER TABLE "AIInsight" ADD CONSTRAINT "AIInsight_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 8. AssetActionExecution.user → SET NULL
-- ============================================================
ALTER TABLE "AssetActionExecution" DROP CONSTRAINT IF EXISTS "AssetActionExecution_userId_fkey";
ALTER TABLE "AssetActionExecution" ADD CONSTRAINT "AssetActionExecution_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 9. AssetRelationship.createdBy → SET NULL
-- ============================================================
ALTER TABLE "AssetRelationship" DROP CONSTRAINT IF EXISTS "AssetRelationship_createdById_fkey";
ALTER TABLE "AssetRelationship" ADD CONSTRAINT "AssetRelationship_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 10. ScriptExecution → CASCADE on asset, workspace, and user
-- ============================================================
ALTER TABLE "ScriptExecution" DROP CONSTRAINT IF EXISTS "ScriptExecution_assetId_fkey";
ALTER TABLE "ScriptExecution" ADD CONSTRAINT "ScriptExecution_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScriptExecution" DROP CONSTRAINT IF EXISTS "ScriptExecution_workspaceId_fkey";
ALTER TABLE "ScriptExecution" ADD CONSTRAINT "ScriptExecution_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScriptExecution" DROP CONSTRAINT IF EXISTS "ScriptExecution_createdBy_fkey";
ALTER TABLE "ScriptExecution" ADD CONSTRAINT "ScriptExecution_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 11. AlertRule.createdBy → SET NULL
-- ============================================================
ALTER TABLE "AlertRule" DROP CONSTRAINT IF EXISTS "AlertRule_createdBy_fkey";
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 12. ReportSchedule.createdBy → CASCADE
-- ============================================================
ALTER TABLE "ReportSchedule" DROP CONSTRAINT IF EXISTS "ReportSchedule_createdBy_fkey";
ALTER TABLE "ReportSchedule" ADD CONSTRAINT "ReportSchedule_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 13. ApiKey.createdBy → CASCADE
-- ============================================================
ALTER TABLE "ApiKey" DROP CONSTRAINT IF EXISTS "ApiKey_createdBy_fkey";
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 14. MaintenanceWindow.createdBy → CASCADE
-- ============================================================
ALTER TABLE "MaintenanceWindow" DROP CONSTRAINT IF EXISTS "MaintenanceWindow_createdById_fkey";
ALTER TABLE "MaintenanceWindow" ADD CONSTRAINT "MaintenanceWindow_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 15. Ticket.creator → CASCADE
-- ============================================================
ALTER TABLE "Ticket" DROP CONSTRAINT IF EXISTS "Ticket_creatorId_fkey";
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_creatorId_fkey"
  FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 16. TicketMessage.sender → CASCADE
-- ============================================================
ALTER TABLE "TicketMessage" DROP CONSTRAINT IF EXISTS "TicketMessage_senderId_fkey";
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 17. Compound indexes for common query patterns
-- ============================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS "RemoteSession_userId_createdAt_idx"
  ON "RemoteSession"("userId", "createdAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "AuditLog_assetId_createdAt_idx"
  ON "AuditLog"("assetId", "createdAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "AIInsight_userId_createdAt_idx"
  ON "AIInsight"("userId", "createdAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "ScriptExecution_workspaceId_status_idx"
  ON "ScriptExecution"("workspaceId", "status");
