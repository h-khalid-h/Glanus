/*
  Warnings:

  - A unique constraint covering the columns `[workspaceId,slug]` on the table `AssetCategory` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `workspaceId` to the `AssetCategory` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "AssetCategory_slug_key";

-- AlterTable (Add nullable first)
ALTER TABLE "AssetCategory" ADD COLUMN "workspaceId" TEXT;

-- Backfill existing categories (Assign to the first available workspace)
UPDATE "AssetCategory" SET "workspaceId" = (SELECT id FROM "Workspace" LIMIT 1);

-- AlterTable (Make required)
ALTER TABLE "AssetCategory" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "RemoteSession" ALTER COLUMN "quality" SET DEFAULT 'HIGH';

-- CreateIndex
CREATE INDEX "AssetCategory_workspaceId_idx" ON "AssetCategory"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetCategory_workspaceId_slug_key" ON "AssetCategory"("workspaceId", "slug");

-- AddForeignKey
ALTER TABLE "AssetCategory" ADD CONSTRAINT "AssetCategory_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
