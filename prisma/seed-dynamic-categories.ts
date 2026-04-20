import { PrismaClient, FieldType, ActionType, HandlerType, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

type SeedField = {
    name: string;
    label: string;
    slug: string;
    fieldType: FieldType;
    isRequired?: boolean;
    isUnique?: boolean;
    defaultValue?: string;
    validationRules?: Prisma.InputJsonValue;
    placeholder?: string;
    sortOrder: number;
};

type SeedAction = {
    name: string;
    label: string;
    slug: string;
    description?: string;
    icon?: string;
    actionType: ActionType;
    isDestructive?: boolean;
    requiresConfirmation?: boolean;
    estimatedDuration?: number;
    handlerType: HandlerType;
    handlerConfig?: Prisma.InputJsonValue;
    parameters?: Prisma.InputJsonValue;
    buttonColor?: string;
    sortOrder: number;
};

type SeedCategoryInput = {
    workspaceId: string;
    name: string;
    slug: string;
    description?: string;
    icon?: string;
    assetTypeValue: 'PHYSICAL' | 'DIGITAL';
    parentId?: string;
    allowsChildren?: boolean;
    isActive?: boolean;
    sortOrder?: number;
    fields?: SeedField[];
    actions?: SeedAction[];
};

async function getOrCreateWorkspace(): Promise<{ id: string }> {
    const existingWorkspace = await prisma.workspace.findFirst({
        select: { id: true },
        orderBy: { createdAt: 'asc' },
    });

    if (existingWorkspace) {
        return existingWorkspace;
    }

    const owner = await prisma.user.findFirst({ select: { id: true }, orderBy: { createdAt: 'asc' } });
    if (!owner) {
        throw new Error('Cannot seed dynamic categories: no users found to assign workspace owner.');
    }

    return prisma.workspace.create({
        data: {
            name: 'Default System Workspace',
            slug: 'default',
            ownerId: owner.id,
        },
        select: { id: true },
    });
}

async function upsertCategory(input: SeedCategoryInput) {
    const {
        workspaceId,
        name,
        slug,
        description,
        icon,
        assetTypeValue,
        parentId,
        allowsChildren,
        isActive,
        sortOrder,
        fields = [],
        actions = [],
    } = input;

    const createData: Prisma.AssetCategoryCreateInput = {
        workspace: { connect: { id: workspaceId } },
        name,
        slug,
        description,
        icon,
        assetTypeValue,
        allowsChildren,
        isActive,
        sortOrder,
        parent: parentId ? { connect: { id: parentId } } : undefined,
        fieldDefinitions: fields.length ? { create: fields } : undefined,
        actionDefinitions: actions.length ? { create: actions } : undefined,
    };

    const updateData: Prisma.AssetCategoryUpdateInput = {
        name,
        description,
        icon,
        assetTypeValue,
        allowsChildren,
        isActive,
        sortOrder,
        parent: parentId ? { connect: { id: parentId } } : { disconnect: true },
        fieldDefinitions: {
            deleteMany: {},
            create: fields,
        },
        actionDefinitions: {
            deleteMany: {},
            create: actions,
        },
    };

    return prisma.assetCategory.upsert({
        where: {
            workspaceId_slug: {
                workspaceId,
                slug,
            },
        },
        create: createData,
        update: updateData,
    });
}

async function main() {
    console.log('Seeding dynamic categories (idempotent mode)...');

    const workspace = await getOrCreateWorkspace();
    const workspaceId = workspace.id;

    console.log('Syncing Physical asset category tree...');

    const physicalRoot = await upsertCategory({
        workspaceId,
        name: 'Physical',
        slug: 'physical',
        description: 'Physical hardware and infrastructure assets',
        icon: '🏢',
        assetTypeValue: 'PHYSICAL',
        allowsChildren: true,
    });

    const computing = await upsertCategory({
        workspaceId,
        name: 'Computing',
        slug: 'computing',
        description: 'Computing devices and servers',
        icon: '💻',
        assetTypeValue: 'PHYSICAL',
        parentId: physicalRoot.id,
        fields: [
            {
                name: 'manufacturer',
                label: 'Manufacturer',
                slug: 'manufacturer',
                fieldType: FieldType.STRING,
                isRequired: false,
                sortOrder: 1,
            },
            {
                name: 'model',
                label: 'Model',
                slug: 'model',
                fieldType: FieldType.STRING,
                sortOrder: 2,
            },
        ],
    });

    await upsertCategory({
        workspaceId,
        name: 'Server',
        slug: 'server',
        description: 'Physical and virtual servers',
        icon: '🖥️',
        assetTypeValue: 'PHYSICAL',
        parentId: computing.id,
        fields: [
            {
                name: 'ipAddress',
                label: 'IP Address',
                slug: 'ip_address',
                fieldType: FieldType.IP_ADDRESS,
                isRequired: true,
                isUnique: true,
                sortOrder: 1,
            },
            {
                name: 'rackPosition',
                label: 'Rack Position',
                slug: 'rack_position',
                fieldType: FieldType.STRING,
                placeholder: 'e.g., Rack A1, U10-U12',
                sortOrder: 2,
            },
            {
                name: 'powerConsumption',
                label: 'Power Consumption (W)',
                slug: 'power_consumption',
                fieldType: FieldType.NUMBER,
                sortOrder: 3,
            },
            {
                name: 'cpuCores',
                label: 'CPU Cores',
                slug: 'cpu_cores',
                fieldType: FieldType.NUMBER,
                sortOrder: 4,
            },
            {
                name: 'ramGb',
                label: 'RAM (GB)',
                slug: 'ram_gb',
                fieldType: FieldType.NUMBER,
                sortOrder: 5,
            },
        ],
        actions: [
            {
                name: 'restart',
                label: 'Restart Server',
                slug: 'restart',
                description: 'Reboot the server',
                icon: '🔄',
                actionType: ActionType.POWER,
                isDestructive: true,
                requiresConfirmation: true,
                estimatedDuration: 300,
                handlerType: HandlerType.API,
                handlerConfig: {
                    endpoint: '/api/actions/server/restart',
                    method: 'POST',
                },
                parameters: {
                    fields: [
                        {
                            name: 'graceful',
                            label: 'Graceful Shutdown',
                            type: 'boolean',
                            default: true,
                        },
                        {
                            name: 'timeout',
                            label: 'Timeout (seconds)',
                            type: 'number',
                            default: 300,
                        },
                    ],
                },
                buttonColor: 'warning',
                sortOrder: 1,
            },
            {
                name: 'shutdown',
                label: 'Shutdown Server',
                slug: 'shutdown',
                description: 'Power down the server',
                icon: '⏻',
                actionType: ActionType.POWER,
                isDestructive: true,
                requiresConfirmation: true,
                handlerType: HandlerType.API,
                handlerConfig: {
                    endpoint: '/api/actions/server/shutdown',
                },
                buttonColor: 'danger',
                sortOrder: 2,
            },
            {
                name: 'backup',
                label: 'Create Backup',
                slug: 'backup',
                description: 'Create a full system backup',
                icon: '💾',
                actionType: ActionType.MAINTENANCE,
                handlerType: HandlerType.SCRIPT,
                handlerConfig: {
                    script: '/scripts/backup-server.sh',
                },
                parameters: {
                    fields: [
                        {
                            name: 'type',
                            label: 'Backup Type',
                            type: 'select',
                            options: ['full', 'incremental'],
                            default: 'incremental',
                        },
                    ],
                },
                sortOrder: 3,
            },
            {
                name: 'monitor',
                label: 'Health Check',
                slug: 'monitor',
                description: 'Check system health and status',
                icon: '❤️',
                actionType: ActionType.MONITORING,
                handlerType: HandlerType.API,
                handlerConfig: {
                    endpoint: '/api/actions/server/health',
                },
                sortOrder: 4,
            },
            {
                name: 'connect',
                label: 'SSH Connect',
                slug: 'connect',
                description: 'Open SSH connection',
                icon: '🔌',
                actionType: ActionType.NETWORK,
                handlerType: HandlerType.REMOTE_COMMAND,
                handlerConfig: {
                    protocol: 'ssh',
                    port: 22,
                },
                sortOrder: 5,
            },
        ],
    });

    await upsertCategory({
        workspaceId,
        name: 'Laptop',
        slug: 'laptop',
        description: 'Portable computing devices',
        icon: '💼',
        assetTypeValue: 'PHYSICAL',
        parentId: computing.id,
        fields: [
            {
                name: 'serialNumber',
                label: 'Serial Number',
                slug: 'serial_number',
                fieldType: FieldType.STRING,
                isUnique: true,
                sortOrder: 1,
            },
            {
                name: 'screenSize',
                label: 'Screen Size (inches)',
                slug: 'screen_size',
                fieldType: FieldType.DECIMAL,
                sortOrder: 2,
            },
            {
                name: 'processor',
                label: 'Processor',
                slug: 'processor',
                fieldType: FieldType.STRING,
                placeholder: 'e.g., Intel Core i7-12700H',
                sortOrder: 3,
            },
            {
                name: 'ramGb',
                label: 'RAM (GB)',
                slug: 'ram_gb',
                fieldType: FieldType.NUMBER,
                sortOrder: 4,
            },
            {
                name: 'storageGb',
                label: 'Storage (GB)',
                slug: 'storage_gb',
                fieldType: FieldType.NUMBER,
                sortOrder: 5,
            },
        ],
        actions: [
            {
                name: 'locate',
                label: 'Locate Device',
                slug: 'locate',
                description: 'Find device location',
                icon: '📍',
                actionType: ActionType.SECURITY,
                handlerType: HandlerType.API,
                handlerConfig: {
                    endpoint: '/api/actions/laptop/locate',
                },
                sortOrder: 1,
            },
            {
                name: 'lock',
                label: 'Remote Lock',
                slug: 'lock',
                description: 'Lock the device remotely',
                icon: '🔒',
                actionType: ActionType.SECURITY,
                isDestructive: true,
                requiresConfirmation: true,
                handlerType: HandlerType.API,
                handlerConfig: {
                    endpoint: '/api/actions/laptop/lock',
                },
                buttonColor: 'danger',
                sortOrder: 2,
            },
        ],
    });

    const infrastructure = await upsertCategory({
        workspaceId,
        name: 'Infrastructure',
        slug: 'infrastructure',
        description: 'Physical infrastructure and facilities',
        icon: '🏗️',
        assetTypeValue: 'PHYSICAL',
        parentId: physicalRoot.id,
    });

    await upsertCategory({
        workspaceId,
        name: 'Building',
        slug: 'building',
        description: 'Buildings and facilities',
        icon: '🏢',
        assetTypeValue: 'PHYSICAL',
        parentId: infrastructure.id,
        fields: [
            {
                name: 'address',
                label: 'Address',
                slug: 'address',
                fieldType: FieldType.TEXT,
                isRequired: true,
                sortOrder: 1,
            },
            {
                name: 'floors',
                label: 'Number of Floors',
                slug: 'floors',
                fieldType: FieldType.NUMBER,
                sortOrder: 2,
            },
        ],
    });

    await upsertCategory({
        workspaceId,
        name: 'Room',
        slug: 'room',
        description: 'Rooms within buildings',
        icon: '🚪',
        assetTypeValue: 'PHYSICAL',
        parentId: infrastructure.id,
        fields: [
            {
                name: 'roomNumber',
                label: 'Room Number',
                slug: 'room_number',
                fieldType: FieldType.STRING,
                isRequired: true,
                sortOrder: 1,
            },
            {
                name: 'floor',
                label: 'Floor',
                slug: 'floor',
                fieldType: FieldType.NUMBER,
                sortOrder: 2,
            },
            {
                name: 'squareMeters',
                label: 'Area (m²)',
                slug: 'square_meters',
                fieldType: FieldType.DECIMAL,
                sortOrder: 3,
            },
        ],
    });

    console.log('Syncing Digital asset category tree...');

    const digitalRoot = await upsertCategory({
        workspaceId,
        name: 'Digital',
        slug: 'digital',
        description: 'Digital assets, software, and cloud services',
        icon: '☁️',
        assetTypeValue: 'DIGITAL',
        allowsChildren: true,
    });

    const content = await upsertCategory({
        workspaceId,
        name: 'Content',
        slug: 'content',
        description: 'Digital content and media',
        icon: '📁',
        assetTypeValue: 'DIGITAL',
        parentId: digitalRoot.id,
        fields: [
            {
                name: 'url',
                label: 'URL',
                slug: 'url',
                fieldType: FieldType.URL,
                sortOrder: 1,
            },
            {
                name: 'fileSize',
                label: 'File Size (bytes)',
                slug: 'file_size',
                fieldType: FieldType.NUMBER,
                sortOrder: 2,
            },
        ],
    });

    const video = await upsertCategory({
        workspaceId,
        name: 'Video',
        slug: 'video',
        description: 'Video content',
        icon: '🎥',
        assetTypeValue: 'DIGITAL',
        parentId: content.id,
        fields: [
            {
                name: 'duration',
                label: 'Duration (seconds)',
                slug: 'duration',
                fieldType: FieldType.NUMBER,
                sortOrder: 1,
            },
            {
                name: 'resolution',
                label: 'Resolution',
                slug: 'resolution',
                fieldType: FieldType.SELECT,
                validationRules: {
                    options: ['720p', '1080p', '1440p', '4K', '8K'],
                },
                sortOrder: 2,
            },
            {
                name: 'codec',
                label: 'Codec',
                slug: 'codec',
                fieldType: FieldType.STRING,
                sortOrder: 3,
            },
        ],
    });

    await upsertCategory({
        workspaceId,
        name: 'YouTube Video',
        slug: 'youtube-video',
        description: 'Videos hosted on YouTube',
        icon: '📺',
        assetTypeValue: 'DIGITAL',
        parentId: video.id,
        fields: [
            {
                name: 'videoId',
                label: 'YouTube Video ID',
                slug: 'video_id',
                fieldType: FieldType.STRING,
                isRequired: true,
                isUnique: true,
                sortOrder: 1,
            },
            {
                name: 'channelId',
                label: 'Channel ID',
                slug: 'channel_id',
                fieldType: FieldType.STRING,
                sortOrder: 2,
            },
            {
                name: 'views',
                label: 'View Count',
                slug: 'views',
                fieldType: FieldType.NUMBER,
                sortOrder: 3,
            },
            {
                name: 'privacy',
                label: 'Privacy',
                slug: 'privacy',
                fieldType: FieldType.SELECT,
                isRequired: true,
                validationRules: {
                    options: ['public', 'unlisted', 'private'],
                },
                defaultValue: 'public',
                sortOrder: 4,
            },
        ],
        actions: [
            {
                name: 'analytics',
                label: 'View Analytics',
                slug: 'analytics',
                description: 'View YouTube analytics',
                icon: '📊',
                actionType: ActionType.MONITORING,
                handlerType: HandlerType.API,
                handlerConfig: {
                    endpoint: '/api/integrations/youtube/analytics',
                },
                sortOrder: 1,
            },
            {
                name: 'download',
                label: 'Download Video',
                slug: 'download',
                description: 'Download video file',
                icon: '⬇️',
                actionType: ActionType.DATA,
                handlerType: HandlerType.API,
                handlerConfig: {
                    endpoint: '/api/actions/youtube/download',
                },
                sortOrder: 2,
            },
        ],
    });

    await upsertCategory({
        workspaceId,
        name: 'Software',
        slug: 'software',
        description: 'Software and applications',
        icon: '⚙️',
        assetTypeValue: 'DIGITAL',
        parentId: digitalRoot.id,
        fields: [
            {
                name: 'version',
                label: 'Version',
                slug: 'version',
                fieldType: FieldType.STRING,
                sortOrder: 1,
            },
            {
                name: 'vendor',
                label: 'Vendor',
                slug: 'vendor',
                fieldType: FieldType.STRING,
                sortOrder: 2,
            },
        ],
    });

    console.log('Dynamic categories seeded successfully.');
    console.log('Created categories:');
    console.log(`  - Physical (with ${await prisma.assetCategory.count({ where: { workspaceId, assetTypeValue: 'PHYSICAL' } })} categories)`);
    console.log(`  - Digital (with ${await prisma.assetCategory.count({ where: { workspaceId, assetTypeValue: 'DIGITAL' } })} categories)`);
    console.log(`  - ${await prisma.assetFieldDefinition.count({ where: { category: { workspaceId } } })} field definitions`);
    console.log(`  - ${await prisma.assetActionDefinition.count({ where: { category: { workspaceId } } })} action definitions`);
}

main()
    .catch((e) => {
        console.error('Error seeding database:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
