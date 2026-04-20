-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('SUCCEEDED', 'FAILED', 'PENDING', 'REFUNDED');

-- CreateEnum
CREATE TYPE "public"."PermissionScope" AS ENUM ('PLATFORM', 'WORKSPACE');

-- DropIndex
DROP INDEX "public"."AgentMetric_agent_timestamp_idx";

-- DropIndex
DROP INDEX "public"."Asset_description_trgm_idx";

-- DropIndex
DROP INDEX "public"."Asset_name_trgm_idx";

-- DropIndex
DROP INDEX "public"."Asset_serialNumber_trgm_idx";

-- DropIndex
DROP INDEX "public"."Asset_workspaceId_name_key";

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "isStaff" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "platformRoleId" TEXT;

-- AlterTable
ALTER TABLE "public"."WorkspaceInvitation" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "public"."BillingEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "previousPlan" "public"."SubscriptionPlan",
    "newPlan" "public"."SubscriptionPlan",
    "amount" INTEGER,
    "currency" TEXT DEFAULT 'usd',
    "stripeEventId" TEXT,
    "actorId" TEXT,
    "actorType" TEXT NOT NULL DEFAULT 'system',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ImpersonationLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "reason" TEXT,

    CONSTRAINT "ImpersonationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Payment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "stripeInvoiceId" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripeCustomerId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "plan" "public"."SubscriptionPlan",
    "description" TEXT,
    "invoiceUrl" TEXT,
    "invoicePdf" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "failureReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PlanConfig" (
    "id" TEXT NOT NULL,
    "plan" "public"."SubscriptionPlan" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "highlighted" BOOLEAN NOT NULL DEFAULT false,
    "stripePriceId" TEXT,
    "stripePriceIdPublic" TEXT,
    "priceMonthly" INTEGER NOT NULL DEFAULT 0,
    "priceYearly" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "maxAssets" INTEGER NOT NULL DEFAULT 5,
    "maxAICreditsPerMonth" INTEGER NOT NULL DEFAULT 100,
    "maxStorageMB" INTEGER NOT NULL DEFAULT 1024,
    "maxMembers" INTEGER NOT NULL DEFAULT 1,
    "features" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."page_permissions" (
    "id" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "permissions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "page_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."permissions" (
    "id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "scope" "public"."PermissionScope" NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."platform_roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isStaff" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."role_permissions" (
    "id" TEXT NOT NULL,
    "platformRoleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workspace_custom_role_members" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_custom_role_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workspace_custom_roles" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "baseRole" "public"."WorkspaceRole",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_custom_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workspace_role_permissions" (
    "id" TEXT NOT NULL,
    "workspaceCustomRoleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BillingEvent_createdAt_idx" ON "public"."BillingEvent"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "BillingEvent_type_idx" ON "public"."BillingEvent"("type" ASC);

-- CreateIndex
CREATE INDEX "BillingEvent_workspaceId_idx" ON "public"."BillingEvent"("workspaceId" ASC);

-- CreateIndex
CREATE INDEX "ImpersonationLog_adminId_idx" ON "public"."ImpersonationLog"("adminId" ASC);

-- CreateIndex
CREATE INDEX "ImpersonationLog_startedAt_idx" ON "public"."ImpersonationLog"("startedAt" ASC);

-- CreateIndex
CREATE INDEX "ImpersonationLog_targetUserId_idx" ON "public"."ImpersonationLog"("targetUserId" ASC);

-- CreateIndex
CREATE INDEX "ImpersonationLog_workspaceId_idx" ON "public"."ImpersonationLog"("workspaceId" ASC);

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "public"."Payment"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "public"."Payment"("status" ASC);

-- CreateIndex
CREATE INDEX "Payment_stripeCustomerId_idx" ON "public"."Payment"("stripeCustomerId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripeInvoiceId_key" ON "public"."Payment"("stripeInvoiceId" ASC);

-- CreateIndex
CREATE INDEX "Payment_workspaceId_idx" ON "public"."Payment"("workspaceId" ASC);

-- CreateIndex
CREATE INDEX "PlanConfig_isActive_idx" ON "public"."PlanConfig"("isActive" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PlanConfig_plan_key" ON "public"."PlanConfig"("plan" ASC);

-- CreateIndex
CREATE INDEX "PlanConfig_sortOrder_idx" ON "public"."PlanConfig"("sortOrder" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "page_permissions_page_key" ON "public"."page_permissions"("page" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "public"."permissions"("key" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "permissions_resource_action_scope_key" ON "public"."permissions"("resource" ASC, "action" ASC, "scope" ASC);

-- CreateIndex
CREATE INDEX "permissions_scope_idx" ON "public"."permissions"("scope" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "platform_roles_name_key" ON "public"."platform_roles"("name" ASC);

-- CreateIndex
CREATE INDEX "role_permissions_permissionId_idx" ON "public"."role_permissions"("permissionId" ASC);

-- CreateIndex
CREATE INDEX "role_permissions_platformRoleId_idx" ON "public"."role_permissions"("platformRoleId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_platformRoleId_permissionId_key" ON "public"."role_permissions"("platformRoleId" ASC, "permissionId" ASC);

-- CreateIndex
CREATE INDEX "workspace_custom_role_members_roleId_idx" ON "public"."workspace_custom_role_members"("roleId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "workspace_custom_role_members_roleId_userId_key" ON "public"."workspace_custom_role_members"("roleId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "workspace_custom_role_members_userId_idx" ON "public"."workspace_custom_role_members"("userId" ASC);

-- CreateIndex
CREATE INDEX "workspace_custom_roles_workspaceId_idx" ON "public"."workspace_custom_roles"("workspaceId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "workspace_custom_roles_workspaceId_name_key" ON "public"."workspace_custom_roles"("workspaceId" ASC, "name" ASC);

-- CreateIndex
CREATE INDEX "workspace_role_permissions_permissionId_idx" ON "public"."workspace_role_permissions"("permissionId" ASC);

-- CreateIndex
CREATE INDEX "workspace_role_permissions_workspaceCustomRoleId_idx" ON "public"."workspace_role_permissions"("workspaceCustomRoleId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "workspace_role_permissions_workspaceCustomRoleId_permission_key" ON "public"."workspace_role_permissions"("workspaceCustomRoleId" ASC, "permissionId" ASC);

-- CreateIndex
CREATE INDEX "Asset_workspaceId_name_idx" ON "public"."Asset"("workspaceId" ASC, "name" ASC);

-- CreateIndex
CREATE INDEX "User_isStaff_idx" ON "public"."User"("isStaff" ASC);

-- AddForeignKey
ALTER TABLE "public"."BillingEvent" ADD CONSTRAINT "BillingEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ImpersonationLog" ADD CONSTRAINT "ImpersonationLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ImpersonationLog" ADD CONSTRAINT "ImpersonationLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ImpersonationLog" ADD CONSTRAINT "ImpersonationLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_platformRoleId_fkey" FOREIGN KEY ("platformRoleId") REFERENCES "public"."platform_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "public"."permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."role_permissions" ADD CONSTRAINT "role_permissions_platformRoleId_fkey" FOREIGN KEY ("platformRoleId") REFERENCES "public"."platform_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workspace_custom_role_members" ADD CONSTRAINT "workspace_custom_role_members_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."workspace_custom_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workspace_custom_role_members" ADD CONSTRAINT "workspace_custom_role_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workspace_custom_roles" ADD CONSTRAINT "workspace_custom_roles_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workspace_role_permissions" ADD CONSTRAINT "workspace_role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "public"."permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workspace_role_permissions" ADD CONSTRAINT "workspace_role_permissions_workspaceCustomRoleId_fkey" FOREIGN KEY ("workspaceCustomRoleId") REFERENCES "public"."workspace_custom_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

