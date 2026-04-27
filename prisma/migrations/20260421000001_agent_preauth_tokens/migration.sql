-- CreateTable
CREATE TABLE "AgentPreAuthToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentPreAuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentPreAuthToken_tokenHash_key" ON "AgentPreAuthToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AgentPreAuthToken_workspaceId_idx" ON "AgentPreAuthToken"("workspaceId");

-- CreateIndex
CREATE INDEX "AgentPreAuthToken_expiresAt_idx" ON "AgentPreAuthToken"("expiresAt");

-- CreateIndex
CREATE INDEX "AgentPreAuthToken_consumedAt_idx" ON "AgentPreAuthToken"("consumedAt");

-- AddForeignKey
ALTER TABLE "AgentPreAuthToken" ADD CONSTRAINT "AgentPreAuthToken_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
