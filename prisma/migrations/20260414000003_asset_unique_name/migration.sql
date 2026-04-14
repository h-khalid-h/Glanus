-- Drop the plain index that is being promoted to a unique constraint
DROP INDEX IF EXISTS "Asset_workspaceId_name_idx";

-- Add unique constraint on (workspaceId, name) — scoped per tenant
-- Duplicate names across different workspaces are still allowed.
CREATE UNIQUE INDEX "Asset_workspaceId_name_key"
    ON "Asset"("workspaceId", "name");
