-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'IT_STAFF', 'USER');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('PHYSICAL', 'DIGITAL');

-- CreateEnum
CREATE TYPE "HostType" AS ENUM ('ASSET', 'PROVIDER', 'HYBRID', 'ON_PREMISE');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'RETIRED', 'LOST');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'ENDED', 'FAILED');

-- CreateEnum
CREATE TYPE "HardwareCategory" AS ENUM ('LAPTOP', 'DESKTOP', 'SERVER', 'MOBILE_DEVICE', 'TABLET', 'PRINTER', 'NETWORK_EQUIPMENT', 'MONITOR', 'PERIPHERAL', 'OTHER');

-- CreateEnum
CREATE TYPE "SoftwareCategory" AS ENUM ('WEB_APPLICATION', 'MOBILE_APP', 'DESKTOP_APP', 'SAAS_SUBSCRIPTION', 'DATABASE', 'DEVELOPMENT_TOOL', 'SECURITY_DIGITAL', 'LICENSE', 'API_SERVICE', 'CLOUD_STORAGE', 'VIRTUAL_MACHINE', 'LLM', 'OTHER');

-- CreateEnum
CREATE TYPE "LicenseType" AS ENUM ('PERPETUAL', 'SUBSCRIPTION', 'TRIAL', 'OPEN_SOURCE', 'FREEMIUM', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'PERSONAL', 'TEAM', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'UNPAID');

-- CreateEnum
CREATE TYPE "PartnerCertificationLevel" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM');

-- CreateEnum
CREATE TYPE "PartnerStatus" AS ENUM ('PENDING', 'VERIFIED', 'ACTIVE', 'SUSPENDED', 'BANNED');

-- CreateEnum
CREATE TYPE "ExamLevel" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM');

-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('STARTED', 'PASSED', 'FAILED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('PENDING', 'ACCEPTED', 'ACTIVE', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "AgentPlatform" AS ENUM ('WINDOWS', 'MACOS', 'LINUX');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('ONLINE', 'OFFLINE', 'INSTALLING', 'ERROR', 'UPDATING');

-- CreateEnum
CREATE TYPE "ScriptStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'TIMEOUT');

-- CreateEnum
CREATE TYPE "AlertMetric" AS ENUM ('CPU', 'RAM', 'DISK', 'OFFLINE');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('STRING', 'TEXT', 'NUMBER', 'DECIMAL', 'BOOLEAN', 'DATE', 'DATETIME', 'TIME', 'JSON', 'ARRAY', 'SELECT', 'MULTI_SELECT', 'ASSET_REF', 'USER_REF', 'FILE', 'IMAGE', 'VIDEO', 'URL', 'EMAIL', 'PHONE', 'IP_ADDRESS', 'MAC_ADDRESS', 'COLOR', 'CURRENCY');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('POWER', 'NETWORK', 'MAINTENANCE', 'MONITORING', 'DATA', 'SECURITY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "HandlerType" AS ENUM ('API', 'SCRIPT', 'WEBHOOK', 'REMOTE_COMMAND', 'MANUAL');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT');

-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM ('CONTAINS', 'PART_OF', 'INSTALLED_ON', 'HOSTED_ON', 'DEPENDS_ON', 'LOCATED_IN', 'CONNECTED_TO', 'LICENSED_TO', 'COMPONENT_OF', 'DEPLOYED_ON', 'MANAGED_BY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "DiscoveryScanStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'ON_HOLD', 'WAITING_ON_CUSTOMER', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logo" TEXT,
    "primaryColor" TEXT DEFAULT '#3B82F6',
    "accentColor" TEXT DEFAULT '#10B981',
    "settings" JSONB,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMember" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceInvitation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "token" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invitedBy" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "aiCreditsUsed" INTEGER NOT NULL DEFAULT 0,
    "storageUsedMB" INTEGER NOT NULL DEFAULT 0,
    "maxAssets" INTEGER NOT NULL DEFAULT 5,
    "maxAICreditsPerMonth" INTEGER NOT NULL DEFAULT 100,
    "maxStorageMB" INTEGER NOT NULL DEFAULT 1024,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "assignedPartnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "address" TEXT,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT,
    "networkCIDR" TEXT,
    "vpnEndpoint" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL DEFAULT 'PHYSICAL',
    "name" TEXT NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "status" "AssetStatus" NOT NULL DEFAULT 'AVAILABLE',
    "location" TEXT,
    "description" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "purchaseCost" DECIMAL(65,30),
    "warrantyUntil" TIMESTAMP(3),
    "tags" TEXT[],
    "qrCode" TEXT,
    "assignedToId" TEXT,
    "workspaceId" TEXT NOT NULL,
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhysicalAsset" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "category" "HardwareCategory" NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "processor" TEXT,
    "ram" INTEGER,
    "storage" INTEGER,
    "osVersion" TEXT,
    "macAddress" TEXT,
    "ipAddress" TEXT,
    "isManaged" BOOLEAN NOT NULL DEFAULT false,
    "mdmEnrolled" TIMESTAMP(3),
    "lastSeen" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhysicalAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigitalAsset" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "category" "SoftwareCategory" NOT NULL,
    "version" TEXT,
    "vendor" TEXT,
    "licenseKey" TEXT,
    "licenseType" "LicenseType",
    "seatCount" INTEGER,
    "seatsUsed" INTEGER,
    "subscriptionTier" TEXT,
    "monthlyRecurringCost" DOUBLE PRECISION,
    "renewalDate" TIMESTAMP(3),
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "host" TEXT,
    "hostType" "HostType",
    "url" TEXT,
    "sslExpiry" TIMESTAMP(3),
    "connectionString" TEXT,
    "databaseSize" INTEGER,
    "installedOn" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DigitalAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentHistory" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "AssignmentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemoteSession" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "notes" TEXT,
    "offer" JSONB,
    "answer" JSONB,
    "iceCandidates" JSONB,
    "quality" TEXT DEFAULT 'high',
    "averageLatency" DOUBLE PRECISION,
    "averageFPS" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RemoteSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Script" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "language" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tags" TEXT[],
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Script_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScriptSchedule" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetIds" JSONB NOT NULL,
    "cronExpression" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScriptSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionQueueItem" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "ruleName" TEXT NOT NULL,
    "ruleSnapshot" JSONB NOT NULL,
    "consequence" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedAt" TIMESTAMP(3),
    "result" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionQueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "assetId" TEXT,
    "metadata" JSONB,
    "details" JSONB NOT NULL DEFAULT '{}',
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIInsight" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT,
    "confidence" DOUBLE PRECISION,
    "metadata" JSONB,
    "userId" TEXT,
    "assetId" TEXT,
    "workspaceId" TEXT,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "parentId" TEXT,
    "assetTypeValue" "AssetType" NOT NULL,
    "allowsChildren" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetFieldDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "fieldType" "FieldType" NOT NULL,
    "categoryId" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isUnique" BOOLEAN NOT NULL DEFAULT false,
    "isInherited" BOOLEAN NOT NULL DEFAULT false,
    "defaultValue" TEXT,
    "validationRules" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "isSearchable" BOOLEAN NOT NULL DEFAULT false,
    "group" TEXT,
    "placeholder" TEXT,
    "helpText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetFieldDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetFieldValue" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "fieldDefinitionId" TEXT NOT NULL,
    "valueString" TEXT,
    "valueNumber" DOUBLE PRECISION,
    "valueBoolean" BOOLEAN,
    "valueDate" TIMESTAMP(3),
    "valueJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetActionDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "categoryId" TEXT NOT NULL,
    "actionType" "ActionType" NOT NULL,
    "isDestructive" BOOLEAN NOT NULL DEFAULT false,
    "requiresConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "estimatedDuration" INTEGER,
    "handlerType" "HandlerType" NOT NULL,
    "handlerConfig" JSONB,
    "parameters" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "buttonColor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetActionDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetActionExecution" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "actionDefinitionId" TEXT NOT NULL,
    "userId" TEXT,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "parameters" JSONB,
    "result" JSONB,
    "errorMessage" TEXT,
    "logs" TEXT,
    "triggerType" TEXT,
    "metadata" JSONB,

    CONSTRAINT "AssetActionExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetRelationship" (
    "id" TEXT NOT NULL,
    "parentAssetId" TEXT NOT NULL,
    "childAssetId" TEXT NOT NULL,
    "relationshipType" "RelationshipType" NOT NULL,
    "quantity" INTEGER,
    "position" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "AssetRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "businessNumber" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "bio" TEXT,
    "logo" TEXT,
    "coverImage" TEXT,
    "certificationLevel" "PartnerCertificationLevel" NOT NULL DEFAULT 'BRONZE',
    "certifiedAt" TIMESTAMP(3),
    "status" "PartnerStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "address" TEXT,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT NOT NULL DEFAULT 'US',
    "timezone" TEXT,
    "serviceRadius" INTEGER,
    "remoteOnly" BOOLEAN NOT NULL DEFAULT false,
    "industries" JSONB,
    "certifications" JSONB,
    "languages" TEXT[] DEFAULT ARRAY['en']::TEXT[],
    "maxWorkspaces" INTEGER NOT NULL DEFAULT 10,
    "availableSlots" INTEGER NOT NULL DEFAULT 10,
    "acceptingNew" BOOLEAN NOT NULL DEFAULT true,
    "stripeAccountId" TEXT,
    "stripeOnboarded" BOOLEAN NOT NULL DEFAULT false,
    "totalEarnings" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "averageRating" DECIMAL(3,2),
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerExam" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "level" "ExamLevel" NOT NULL,
    "status" "ExamStatus" NOT NULL,
    "questions" JSONB NOT NULL,
    "answers" JSONB NOT NULL,
    "score" INTEGER NOT NULL,
    "passingScore" INTEGER NOT NULL DEFAULT 80,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "timeLimit" INTEGER NOT NULL DEFAULT 60,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamQuestion" (
    "id" TEXT NOT NULL,
    "level" "ExamLevel" NOT NULL,
    "category" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctAnswer" INTEGER NOT NULL,
    "explanation" TEXT,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerAssignment" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'PENDING',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "revenueSplit" DECIMAL(3,2) NOT NULL DEFAULT 0.50,
    "totalEarnings" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "rating" INTEGER,
    "review" TEXT,
    "ratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerPayout" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "stripePayoutId" TEXT,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "workspaceCount" INTEGER NOT NULL,
    "subscriptionDetails" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "PartnerPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentConnection" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "agentVersion" TEXT NOT NULL,
    "platform" "AgentPlatform" NOT NULL,
    "hostname" TEXT NOT NULL,
    "ipAddress" TEXT,
    "macAddress" TEXT,
    "authToken" TEXT NOT NULL,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "AgentStatus" NOT NULL DEFAULT 'INSTALLING',
    "canMonitor" BOOLEAN NOT NULL DEFAULT true,
    "canRemoteAccess" BOOLEAN NOT NULL DEFAULT false,
    "canExecuteScript" BOOLEAN NOT NULL DEFAULT true,
    "canPatchManage" BOOLEAN NOT NULL DEFAULT false,
    "cpuUsage" DOUBLE PRECISION,
    "ramUsage" DOUBLE PRECISION,
    "diskUsage" DOUBLE PRECISION,
    "networkUp" DOUBLE PRECISION,
    "networkDown" DOUBLE PRECISION,
    "lastMetricSavedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentMetric" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cpuUsage" DOUBLE PRECISION NOT NULL,
    "cpuTemp" DOUBLE PRECISION,
    "ramUsage" DOUBLE PRECISION NOT NULL,
    "ramUsed" DOUBLE PRECISION NOT NULL,
    "ramTotal" DOUBLE PRECISION NOT NULL,
    "diskUsage" DOUBLE PRECISION NOT NULL,
    "diskUsed" DOUBLE PRECISION NOT NULL,
    "diskTotal" DOUBLE PRECISION NOT NULL,
    "networkUp" DOUBLE PRECISION NOT NULL,
    "networkDown" DOUBLE PRECISION NOT NULL,
    "topProcesses" JSONB,

    CONSTRAINT "AgentMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScriptExecution" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "scriptId" TEXT,
    "scriptName" TEXT NOT NULL,
    "scriptBody" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "status" "ScriptStatus" NOT NULL DEFAULT 'PENDING',
    "exitCode" INTEGER,
    "output" TEXT,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "ScriptExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "metric" "AlertMetric" NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'WARNING',
    "notifyEmail" BOOLEAN NOT NULL DEFAULT true,
    "notifyWebhook" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationWebhook" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "secret" TEXT,
    "lastSuccess" TIMESTAMP(3),
    "lastFailure" TIMESTAMP(3),
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentVersion" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "downloadUrl" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "releaseNotes" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MdmProfile" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "platform" TEXT NOT NULL,
    "profileType" TEXT NOT NULL,
    "configPayload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MdmProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MdmAssignment" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "assetId" TEXT,
    "categoryId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "appliedAt" TIMESTAMP(3),
    "errorLog" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MdmAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportSchedule" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'csv',
    "frequency" TEXT NOT NULL,
    "dayOfWeek" INTEGER,
    "dayOfMonth" INTEGER,
    "timeOfDay" TEXT NOT NULL DEFAULT '08:00',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "recipients" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "lastError" TEXT,
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY['read']::TEXT[],
    "lastUsedAt" TIMESTAMP(3),
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceWindow" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'preventive',
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "scheduledEnd" TIMESTAMP(3) NOT NULL,
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "notes" TEXT,
    "cost" DECIMAL(65,30),
    "assetId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstalledSoftware" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT,
    "publisher" TEXT,
    "installDate" TIMESTAMP(3),
    "sizeMB" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstalledSoftware_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatchPolicy" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetSoftware" TEXT NOT NULL,
    "actionScriptId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatchPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZtnaPolicy" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "ipWhitelist" TEXT NOT NULL,
    "action" TEXT NOT NULL DEFAULT 'BLOCK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZtnaPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetworkDevice" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "discoveredById" TEXT,
    "ipAddress" TEXT NOT NULL,
    "macAddress" TEXT,
    "hostname" TEXT,
    "deviceType" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "snmpData" JSONB,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NetworkDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoveryScan" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "subnet" TEXT NOT NULL,
    "status" "DiscoveryScanStatus" NOT NULL DEFAULT 'PENDING',
    "devicesFound" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoveryScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TicketPriority" NOT NULL DEFAULT 'NORMAL',
    "assetId" TEXT,
    "creatorId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE INDEX "Workspace_slug_idx" ON "Workspace"("slug");

-- CreateIndex
CREATE INDEX "Workspace_ownerId_idx" ON "Workspace"("ownerId");

-- CreateIndex
CREATE INDEX "Workspace_deletedAt_idx" ON "Workspace"("deletedAt");

-- CreateIndex
CREATE INDEX "WorkspaceMember_workspaceId_idx" ON "WorkspaceMember"("workspaceId");

-- CreateIndex
CREATE INDEX "WorkspaceMember_userId_idx" ON "WorkspaceMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceInvitation_token_key" ON "WorkspaceInvitation"("token");

-- CreateIndex
CREATE INDEX "WorkspaceInvitation_workspaceId_idx" ON "WorkspaceInvitation"("workspaceId");

-- CreateIndex
CREATE INDEX "WorkspaceInvitation_email_idx" ON "WorkspaceInvitation"("email");

-- CreateIndex
CREATE INDEX "WorkspaceInvitation_token_idx" ON "WorkspaceInvitation"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_workspaceId_key" ON "Subscription"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeCustomerId_key" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_workspaceId_idx" ON "Subscription"("workspaceId");

-- CreateIndex
CREATE INDEX "Location_workspaceId_idx" ON "Location"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "Asset_status_idx" ON "Asset"("status");

-- CreateIndex
CREATE INDEX "Asset_assignedToId_idx" ON "Asset"("assignedToId");

-- CreateIndex
CREATE INDEX "Asset_assetType_idx" ON "Asset"("assetType");

-- CreateIndex
CREATE INDEX "Asset_deletedAt_idx" ON "Asset"("deletedAt");

-- CreateIndex
CREATE INDEX "Asset_categoryId_idx" ON "Asset"("categoryId");

-- CreateIndex
CREATE INDEX "Asset_workspaceId_idx" ON "Asset"("workspaceId");

-- CreateIndex
CREATE INDEX "Asset_workspaceId_name_idx" ON "Asset"("workspaceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_workspaceId_serialNumber_key" ON "Asset"("workspaceId", "serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PhysicalAsset_assetId_key" ON "PhysicalAsset"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "PhysicalAsset_serialNumber_key" ON "PhysicalAsset"("serialNumber");

-- CreateIndex
CREATE INDEX "PhysicalAsset_category_idx" ON "PhysicalAsset"("category");

-- CreateIndex
CREATE INDEX "PhysicalAsset_serialNumber_idx" ON "PhysicalAsset"("serialNumber");

-- CreateIndex
CREATE INDEX "PhysicalAsset_manufacturer_idx" ON "PhysicalAsset"("manufacturer");

-- CreateIndex
CREATE UNIQUE INDEX "DigitalAsset_assetId_key" ON "DigitalAsset"("assetId");

-- CreateIndex
CREATE INDEX "DigitalAsset_category_idx" ON "DigitalAsset"("category");

-- CreateIndex
CREATE INDEX "DigitalAsset_renewalDate_idx" ON "DigitalAsset"("renewalDate");

-- CreateIndex
CREATE INDEX "DigitalAsset_vendor_idx" ON "DigitalAsset"("vendor");

-- CreateIndex
CREATE INDEX "AssignmentHistory_assetId_idx" ON "AssignmentHistory"("assetId");

-- CreateIndex
CREATE INDEX "AssignmentHistory_userId_idx" ON "AssignmentHistory"("userId");

-- CreateIndex
CREATE INDEX "AssignmentHistory_unassignedAt_idx" ON "AssignmentHistory"("unassignedAt");

-- CreateIndex
CREATE INDEX "RemoteSession_assetId_idx" ON "RemoteSession"("assetId");

-- CreateIndex
CREATE INDEX "RemoteSession_userId_idx" ON "RemoteSession"("userId");

-- CreateIndex
CREATE INDEX "RemoteSession_status_idx" ON "RemoteSession"("status");

-- CreateIndex
CREATE INDEX "RemoteSession_createdAt_idx" ON "RemoteSession"("createdAt");

-- CreateIndex
CREATE INDEX "Script_workspaceId_idx" ON "Script"("workspaceId");

-- CreateIndex
CREATE INDEX "Script_language_idx" ON "Script"("language");

-- CreateIndex
CREATE INDEX "ScriptSchedule_workspaceId_idx" ON "ScriptSchedule"("workspaceId");

-- CreateIndex
CREATE INDEX "ScriptSchedule_scriptId_idx" ON "ScriptSchedule"("scriptId");

-- CreateIndex
CREATE INDEX "ScriptSchedule_nextRunAt_idx" ON "ScriptSchedule"("nextRunAt");

-- CreateIndex
CREATE INDEX "ActionQueueItem_workspaceId_idx" ON "ActionQueueItem"("workspaceId");

-- CreateIndex
CREATE INDEX "ActionQueueItem_status_idx" ON "ActionQueueItem"("status");

-- CreateIndex
CREATE INDEX "AuditLog_workspaceId_createdAt_idx" ON "AuditLog"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_workspaceId_action_createdAt_idx" ON "AuditLog"("workspaceId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_assetId_idx" ON "AuditLog"("assetId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AIInsight_type_idx" ON "AIInsight"("type");

-- CreateIndex
CREATE INDEX "AIInsight_assetId_idx" ON "AIInsight"("assetId");

-- CreateIndex
CREATE INDEX "AIInsight_acknowledged_idx" ON "AIInsight"("acknowledged");

-- CreateIndex
CREATE INDEX "AIInsight_workspaceId_idx" ON "AIInsight"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetCategory_slug_key" ON "AssetCategory"("slug");

-- CreateIndex
CREATE INDEX "AssetCategory_parentId_idx" ON "AssetCategory"("parentId");

-- CreateIndex
CREATE INDEX "AssetCategory_slug_idx" ON "AssetCategory"("slug");

-- CreateIndex
CREATE INDEX "AssetCategory_assetTypeValue_idx" ON "AssetCategory"("assetTypeValue");

-- CreateIndex
CREATE INDEX "AssetFieldDefinition_categoryId_idx" ON "AssetFieldDefinition"("categoryId");

-- CreateIndex
CREATE INDEX "AssetFieldDefinition_fieldType_idx" ON "AssetFieldDefinition"("fieldType");

-- CreateIndex
CREATE UNIQUE INDEX "AssetFieldDefinition_categoryId_slug_key" ON "AssetFieldDefinition"("categoryId", "slug");

-- CreateIndex
CREATE INDEX "AssetFieldValue_assetId_idx" ON "AssetFieldValue"("assetId");

-- CreateIndex
CREATE INDEX "AssetFieldValue_fieldDefinitionId_idx" ON "AssetFieldValue"("fieldDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetFieldValue_assetId_fieldDefinitionId_key" ON "AssetFieldValue"("assetId", "fieldDefinitionId");

-- CreateIndex
CREATE INDEX "AssetActionDefinition_categoryId_idx" ON "AssetActionDefinition"("categoryId");

-- CreateIndex
CREATE INDEX "AssetActionDefinition_actionType_idx" ON "AssetActionDefinition"("actionType");

-- CreateIndex
CREATE UNIQUE INDEX "AssetActionDefinition_categoryId_slug_key" ON "AssetActionDefinition"("categoryId", "slug");

-- CreateIndex
CREATE INDEX "AssetActionExecution_assetId_idx" ON "AssetActionExecution"("assetId");

-- CreateIndex
CREATE INDEX "AssetActionExecution_actionDefinitionId_idx" ON "AssetActionExecution"("actionDefinitionId");

-- CreateIndex
CREATE INDEX "AssetActionExecution_userId_idx" ON "AssetActionExecution"("userId");

-- CreateIndex
CREATE INDEX "AssetActionExecution_status_idx" ON "AssetActionExecution"("status");

-- CreateIndex
CREATE INDEX "AssetActionExecution_startedAt_idx" ON "AssetActionExecution"("startedAt");

-- CreateIndex
CREATE INDEX "AssetRelationship_parentAssetId_idx" ON "AssetRelationship"("parentAssetId");

-- CreateIndex
CREATE INDEX "AssetRelationship_childAssetId_idx" ON "AssetRelationship"("childAssetId");

-- CreateIndex
CREATE INDEX "AssetRelationship_relationshipType_idx" ON "AssetRelationship"("relationshipType");

-- CreateIndex
CREATE UNIQUE INDEX "AssetRelationship_parentAssetId_childAssetId_relationshipTy_key" ON "AssetRelationship"("parentAssetId", "childAssetId", "relationshipType");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_userId_key" ON "Partner"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_stripeAccountId_key" ON "Partner"("stripeAccountId");

-- CreateIndex
CREATE INDEX "Partner_status_idx" ON "Partner"("status");

-- CreateIndex
CREATE INDEX "Partner_certificationLevel_idx" ON "Partner"("certificationLevel");

-- CreateIndex
CREATE INDEX "Partner_city_region_country_idx" ON "Partner"("city", "region", "country");

-- CreateIndex
CREATE INDEX "Partner_averageRating_idx" ON "Partner"("averageRating");

-- CreateIndex
CREATE INDEX "Partner_acceptingNew_idx" ON "Partner"("acceptingNew");

-- CreateIndex
CREATE INDEX "PartnerExam_partnerId_level_idx" ON "PartnerExam"("partnerId", "level");

-- CreateIndex
CREATE INDEX "PartnerExam_status_idx" ON "PartnerExam"("status");

-- CreateIndex
CREATE INDEX "PartnerExam_completedAt_idx" ON "PartnerExam"("completedAt");

-- CreateIndex
CREATE INDEX "ExamQuestion_level_isActive_idx" ON "ExamQuestion"("level", "isActive");

-- CreateIndex
CREATE INDEX "ExamQuestion_category_idx" ON "ExamQuestion"("category");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerAssignment_workspaceId_key" ON "PartnerAssignment"("workspaceId");

-- CreateIndex
CREATE INDEX "PartnerAssignment_partnerId_status_idx" ON "PartnerAssignment"("partnerId", "status");

-- CreateIndex
CREATE INDEX "PartnerAssignment_workspaceId_idx" ON "PartnerAssignment"("workspaceId");

-- CreateIndex
CREATE INDEX "PartnerAssignment_status_idx" ON "PartnerAssignment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerAssignment_partnerId_workspaceId_key" ON "PartnerAssignment"("partnerId", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerPayout_stripePayoutId_key" ON "PartnerPayout"("stripePayoutId");

-- CreateIndex
CREATE INDEX "PartnerPayout_partnerId_status_idx" ON "PartnerPayout"("partnerId", "status");

-- CreateIndex
CREATE INDEX "PartnerPayout_periodStart_periodEnd_idx" ON "PartnerPayout"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "PartnerPayout_status_idx" ON "PartnerPayout"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AgentConnection_assetId_key" ON "AgentConnection"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentConnection_authToken_key" ON "AgentConnection"("authToken");

-- CreateIndex
CREATE INDEX "AgentConnection_workspaceId_status_idx" ON "AgentConnection"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "AgentConnection_lastSeen_idx" ON "AgentConnection"("lastSeen");

-- CreateIndex
CREATE INDEX "AgentConnection_status_idx" ON "AgentConnection"("status");

-- CreateIndex
CREATE INDEX "AgentMetric_agentId_timestamp_idx" ON "AgentMetric"("agentId", "timestamp");

-- CreateIndex
CREATE INDEX "AgentMetric_assetId_timestamp_idx" ON "AgentMetric"("assetId", "timestamp");

-- CreateIndex
CREATE INDEX "AgentMetric_timestamp_idx" ON "AgentMetric"("timestamp");

-- CreateIndex
CREATE INDEX "ScriptExecution_agentId_status_idx" ON "ScriptExecution"("agentId", "status");

-- CreateIndex
CREATE INDEX "ScriptExecution_assetId_createdAt_idx" ON "ScriptExecution"("assetId", "createdAt");

-- CreateIndex
CREATE INDEX "ScriptExecution_workspaceId_createdAt_idx" ON "ScriptExecution"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "ScriptExecution_status_idx" ON "ScriptExecution"("status");

-- CreateIndex
CREATE INDEX "ScriptExecution_createdBy_idx" ON "ScriptExecution"("createdBy");

-- CreateIndex
CREATE INDEX "AlertRule_workspaceId_enabled_idx" ON "AlertRule"("workspaceId", "enabled");

-- CreateIndex
CREATE INDEX "AlertRule_metric_idx" ON "AlertRule"("metric");

-- CreateIndex
CREATE INDEX "AlertRule_createdBy_idx" ON "AlertRule"("createdBy");

-- CreateIndex
CREATE INDEX "NotificationWebhook_workspaceId_enabled_idx" ON "NotificationWebhook"("workspaceId", "enabled");

-- CreateIndex
CREATE INDEX "AgentVersion_platform_status_idx" ON "AgentVersion"("platform", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AgentVersion_version_platform_key" ON "AgentVersion"("version", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "StripeEvent_eventId_key" ON "StripeEvent"("eventId");

-- CreateIndex
CREATE INDEX "StripeEvent_eventId_idx" ON "StripeEvent"("eventId");

-- CreateIndex
CREATE INDEX "StripeEvent_createdAt_idx" ON "StripeEvent"("createdAt");

-- CreateIndex
CREATE INDEX "MdmProfile_workspaceId_platform_idx" ON "MdmProfile"("workspaceId", "platform");

-- CreateIndex
CREATE INDEX "MdmAssignment_profileId_idx" ON "MdmAssignment"("profileId");

-- CreateIndex
CREATE INDEX "MdmAssignment_assetId_idx" ON "MdmAssignment"("assetId");

-- CreateIndex
CREATE INDEX "MdmAssignment_categoryId_idx" ON "MdmAssignment"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "MdmAssignment_profileId_assetId_key" ON "MdmAssignment"("profileId", "assetId");

-- CreateIndex
CREATE INDEX "ReportSchedule_workspaceId_enabled_idx" ON "ReportSchedule"("workspaceId", "enabled");

-- CreateIndex
CREATE INDEX "ReportSchedule_frequency_idx" ON "ReportSchedule"("frequency");

-- CreateIndex
CREATE INDEX "ReportSchedule_createdBy_idx" ON "ReportSchedule"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_workspaceId_idx" ON "ApiKey"("workspaceId");

-- CreateIndex
CREATE INDEX "ApiKey_prefix_idx" ON "ApiKey"("prefix");

-- CreateIndex
CREATE INDEX "ApiKey_createdBy_idx" ON "ApiKey"("createdBy");

-- CreateIndex
CREATE INDEX "MaintenanceWindow_assetId_idx" ON "MaintenanceWindow"("assetId");

-- CreateIndex
CREATE INDEX "MaintenanceWindow_workspaceId_idx" ON "MaintenanceWindow"("workspaceId");

-- CreateIndex
CREATE INDEX "MaintenanceWindow_scheduledStart_idx" ON "MaintenanceWindow"("scheduledStart");

-- CreateIndex
CREATE INDEX "MaintenanceWindow_status_idx" ON "MaintenanceWindow"("status");

-- CreateIndex
CREATE INDEX "MaintenanceWindow_createdById_idx" ON "MaintenanceWindow"("createdById");

-- CreateIndex
CREATE INDEX "InstalledSoftware_agentId_idx" ON "InstalledSoftware"("agentId");

-- CreateIndex
CREATE INDEX "InstalledSoftware_name_idx" ON "InstalledSoftware"("name");

-- CreateIndex
CREATE INDEX "PatchPolicy_workspaceId_idx" ON "PatchPolicy"("workspaceId");

-- CreateIndex
CREATE INDEX "PatchPolicy_targetSoftware_idx" ON "PatchPolicy"("targetSoftware");

-- CreateIndex
CREATE INDEX "ZtnaPolicy_workspaceId_isEnabled_idx" ON "ZtnaPolicy"("workspaceId", "isEnabled");

-- CreateIndex
CREATE INDEX "NetworkDevice_workspaceId_idx" ON "NetworkDevice"("workspaceId");

-- CreateIndex
CREATE INDEX "NetworkDevice_discoveredById_idx" ON "NetworkDevice"("discoveredById");

-- CreateIndex
CREATE INDEX "NetworkDevice_ipAddress_idx" ON "NetworkDevice"("ipAddress");

-- CreateIndex
CREATE INDEX "DiscoveryScan_workspaceId_idx" ON "DiscoveryScan"("workspaceId");

-- CreateIndex
CREATE INDEX "DiscoveryScan_agentId_idx" ON "DiscoveryScan"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_number_key" ON "Ticket"("number");

-- CreateIndex
CREATE INDEX "Ticket_workspaceId_idx" ON "Ticket"("workspaceId");

-- CreateIndex
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");

-- CreateIndex
CREATE INDEX "Ticket_assigneeId_idx" ON "Ticket"("assigneeId");

-- CreateIndex
CREATE INDEX "Ticket_assetId_idx" ON "Ticket"("assetId");

-- CreateIndex
CREATE INDEX "TicketMessage_ticketId_idx" ON "TicketMessage"("ticketId");

-- CreateIndex
CREATE INDEX "TicketMessage_senderId_idx" ON "TicketMessage"("senderId");

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceInvitation" ADD CONSTRAINT "WorkspaceInvitation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceInvitation" ADD CONSTRAINT "WorkspaceInvitation_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AssetCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhysicalAsset" ADD CONSTRAINT "PhysicalAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalAsset" ADD CONSTRAINT "DigitalAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentHistory" ADD CONSTRAINT "AssignmentHistory_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentHistory" ADD CONSTRAINT "AssignmentHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteSession" ADD CONSTRAINT "RemoteSession_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteSession" ADD CONSTRAINT "RemoteSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Script" ADD CONSTRAINT "Script_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptSchedule" ADD CONSTRAINT "ScriptSchedule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptSchedule" ADD CONSTRAINT "ScriptSchedule_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "Script"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionQueueItem" ADD CONSTRAINT "ActionQueueItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIInsight" ADD CONSTRAINT "AIInsight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIInsight" ADD CONSTRAINT "AIInsight_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIInsight" ADD CONSTRAINT "AIInsight_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetCategory" ADD CONSTRAINT "AssetCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AssetCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetFieldDefinition" ADD CONSTRAINT "AssetFieldDefinition_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AssetCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetFieldValue" ADD CONSTRAINT "AssetFieldValue_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetFieldValue" ADD CONSTRAINT "AssetFieldValue_fieldDefinitionId_fkey" FOREIGN KEY ("fieldDefinitionId") REFERENCES "AssetFieldDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetActionDefinition" ADD CONSTRAINT "AssetActionDefinition_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AssetCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetActionExecution" ADD CONSTRAINT "AssetActionExecution_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetActionExecution" ADD CONSTRAINT "AssetActionExecution_actionDefinitionId_fkey" FOREIGN KEY ("actionDefinitionId") REFERENCES "AssetActionDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetActionExecution" ADD CONSTRAINT "AssetActionExecution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetRelationship" ADD CONSTRAINT "AssetRelationship_parentAssetId_fkey" FOREIGN KEY ("parentAssetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetRelationship" ADD CONSTRAINT "AssetRelationship_childAssetId_fkey" FOREIGN KEY ("childAssetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetRelationship" ADD CONSTRAINT "AssetRelationship_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerExam" ADD CONSTRAINT "PartnerExam_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerAssignment" ADD CONSTRAINT "PartnerAssignment_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerAssignment" ADD CONSTRAINT "PartnerAssignment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerPayout" ADD CONSTRAINT "PartnerPayout_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentConnection" ADD CONSTRAINT "AgentConnection_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentConnection" ADD CONSTRAINT "AgentConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentMetric" ADD CONSTRAINT "AgentMetric_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentMetric" ADD CONSTRAINT "AgentMetric_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptExecution" ADD CONSTRAINT "ScriptExecution_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptExecution" ADD CONSTRAINT "ScriptExecution_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptExecution" ADD CONSTRAINT "ScriptExecution_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptExecution" ADD CONSTRAINT "ScriptExecution_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "Script"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptExecution" ADD CONSTRAINT "ScriptExecution_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationWebhook" ADD CONSTRAINT "NotificationWebhook_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MdmProfile" ADD CONSTRAINT "MdmProfile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MdmAssignment" ADD CONSTRAINT "MdmAssignment_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "MdmProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MdmAssignment" ADD CONSTRAINT "MdmAssignment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MdmAssignment" ADD CONSTRAINT "MdmAssignment_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AssetCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSchedule" ADD CONSTRAINT "ReportSchedule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSchedule" ADD CONSTRAINT "ReportSchedule_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceWindow" ADD CONSTRAINT "MaintenanceWindow_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceWindow" ADD CONSTRAINT "MaintenanceWindow_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceWindow" ADD CONSTRAINT "MaintenanceWindow_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstalledSoftware" ADD CONSTRAINT "InstalledSoftware_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatchPolicy" ADD CONSTRAINT "PatchPolicy_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatchPolicy" ADD CONSTRAINT "PatchPolicy_actionScriptId_fkey" FOREIGN KEY ("actionScriptId") REFERENCES "Script"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZtnaPolicy" ADD CONSTRAINT "ZtnaPolicy_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkDevice" ADD CONSTRAINT "NetworkDevice_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkDevice" ADD CONSTRAINT "NetworkDevice_discoveredById_fkey" FOREIGN KEY ("discoveredById") REFERENCES "AgentConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveryScan" ADD CONSTRAINT "DiscoveryScan_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveryScan" ADD CONSTRAINT "DiscoveryScan_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "WorkspaceMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
