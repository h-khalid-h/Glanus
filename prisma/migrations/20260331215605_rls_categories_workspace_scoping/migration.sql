/*
  Warnings:

  - A unique constraint covering the columns `[workspaceId,slug]` on the table `AssetCategory` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `workspaceId` to the `AssetCategory` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex (idempotent: may already be gone on partially-migrated DBs)
DROP INDEX IF EXISTS "AssetCategory_slug_key";

-- AlterTable (Add nullable first)
ALTER TABLE "AssetCategory" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;

-- Backfill existing categories (Assign to the first available workspace)
UPDATE "AssetCategory"
SET "workspaceId" = (SELECT id FROM "Workspace" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "workspaceId" IS NULL;

-- Safety: drop any categories that could not be backfilled (no Workspace exists yet);
-- seed will recreate defaults on next boot.
DELETE FROM "AssetCategory" WHERE "workspaceId" IS NULL;

-- Deduplicate (workspaceId, slug) so the unique index can be created
DELETE FROM "AssetCategory" a
USING "AssetCategory" b
WHERE a."workspaceId" = b."workspaceId"
  AND a."slug"        = b."slug"
  AND a."createdAt"   > b."createdAt";

-- AlterTable (Make required)
ALTER TABLE "AssetCategory" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "RemoteSession" ALTER COLUMN "quality" SET DEFAULT 'HIGH';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AssetCategory_workspaceId_idx" ON "AssetCategory"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AssetCategory_workspaceId_slug_key" ON "AssetCategory"("workspaceId", "slug");

-- AddForeignKey (drop-then-add so it's idempotent)
ALTER TABLE "AssetCategory" DROP CONSTRAINT IF EXISTS "AssetCategory_workspaceId_fkey";
ALTER TABLE "AssetCategory" ADD CONSTRAINT "AssetCategory_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
