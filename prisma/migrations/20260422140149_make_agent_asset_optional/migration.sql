-- DropForeignKey
ALTER TABLE "AgentConnection" DROP CONSTRAINT "AgentConnection_assetId_fkey";

-- AlterTable
ALTER TABLE "AgentConnection" ALTER COLUMN "assetId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "AgentConnection" ADD CONSTRAINT "AgentConnection_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
