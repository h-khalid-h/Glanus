-- Performance: GIN trigram indexes for ILIKE search on Asset columns
-- These replace full-table scans when using `contains` + `mode: insensitive`

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Composite GIN index on Asset.name for fast ILIKE search
CREATE INDEX IF NOT EXISTS "Asset_name_trgm_idx"
    ON "Asset" USING gin ("name" gin_trgm_ops);

-- GIN index on Asset.serialNumber for ILIKE search
CREATE INDEX IF NOT EXISTS "Asset_serialNumber_trgm_idx"
    ON "Asset" USING gin ("serialNumber" gin_trgm_ops);

-- GIN index on Asset.description for ILIKE search (text column)
CREATE INDEX IF NOT EXISTS "Asset_description_trgm_idx"
    ON "Asset" USING gin ("description" gin_trgm_ops);

-- Composite index for common dashboard query: workspace + deletedAt + createdAt
CREATE INDEX IF NOT EXISTS "Asset_workspace_active_recent_idx"
    ON "Asset" ("workspaceId", "createdAt" DESC)
    WHERE "deletedAt" IS NULL;

-- AgentMetric: index for time-series queries ordered by timestamp
CREATE INDEX IF NOT EXISTS "AgentMetric_agent_timestamp_idx"
    ON "AgentMetric" ("agentId", "timestamp" DESC);

-- AuditLog: composite covering index for workspace timeline queries
CREATE INDEX IF NOT EXISTS "AuditLog_workspace_timeline_idx"
    ON "AuditLog" ("workspaceId", "createdAt" DESC)
    WHERE "workspaceId" IS NOT NULL;

-- AIInsight: unacknowledged count per workspace (dashboard hot path)
CREATE INDEX IF NOT EXISTS "AIInsight_unack_workspace_idx"
    ON "AIInsight" ("acknowledged", "workspaceId")
    WHERE "acknowledged" = false;
