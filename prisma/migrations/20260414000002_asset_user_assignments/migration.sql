-- CreateTable: asset_user_assignments (AssetAssignment)
-- Many-to-many pivot between Asset and User with full tenant isolation,
-- assignment lifecycle (startDate / endDate), audited assignedBy, and
-- a composite index that makes the "one active assignment per asset"
-- query a single index seek.

CREATE TABLE "asset_user_assignments" (
    "id"           TEXT         NOT NULL,
    "workspaceId"  TEXT         NOT NULL,
    "assetId"      TEXT         NOT NULL,
    "userId"       TEXT         NOT NULL,
    "startDate"    TIMESTAMP(3) NOT NULL,
    "endDate"      TIMESTAMP(3),
    "assignedById" TEXT,
    "notes"        TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_user_assignments_pkey" PRIMARY KEY ("id")
);

-- Indexes ---------------------------------------------------------------
-- Individual columns
CREATE INDEX "asset_user_assignments_workspaceId_idx"
    ON "asset_user_assignments"("workspaceId");

CREATE INDEX "asset_user_assignments_assetId_idx"
    ON "asset_user_assignments"("assetId");

CREATE INDEX "asset_user_assignments_userId_idx"
    ON "asset_user_assignments"("userId");

-- Composite: drives the one-active-assignment lookup and overlap checks
CREATE INDEX "asset_user_assignments_workspaceId_assetId_endDate_idx"
    ON "asset_user_assignments"("workspaceId", "assetId", "endDate");

-- Foreign Keys ----------------------------------------------------------
ALTER TABLE "asset_user_assignments"
    ADD CONSTRAINT "asset_user_assignments_workspaceId_fkey"
    FOREIGN KEY ("workspaceId")
    REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "asset_user_assignments"
    ADD CONSTRAINT "asset_user_assignments_assetId_fkey"
    FOREIGN KEY ("assetId")
    REFERENCES "Asset"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "asset_user_assignments"
    ADD CONSTRAINT "asset_user_assignments_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "asset_user_assignments"
    ADD CONSTRAINT "asset_user_assignments_assignedById_fkey"
    FOREIGN KEY ("assignedById")
    REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
