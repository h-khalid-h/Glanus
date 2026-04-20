import { prisma } from '@/lib/db';
import { ApiError } from '@/lib/errors';
import { randomUUID } from 'crypto';

function generateId() { return randomUUID(); }

export interface PlatformRoleRow {
    id: string;
    name: string;
    label: string;
    description: string | null;
    isStaff: boolean;
    color: string;
    userCount: number;
    createdAt: Date;
    updatedAt: Date;
}

export class SuperAdminRoleService {
    static async listRoles(): Promise<PlatformRoleRow[]> {
        const roles = await prisma.platformRole.findMany({
            orderBy: { createdAt: 'asc' },
            include: { _count: { select: { users: true } } },
        });
        return roles.map((r) => ({
            id: r.id,
            name: r.name,
            label: r.label,
            description: r.description,
            isStaff: r.isStaff,
            color: r.color,
            userCount: r._count.users,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
        }));
    }

    static async createRole(data: {
        name: string;
        label: string;
        description?: string;
        isStaff?: boolean;
        color?: string;
    }): Promise<PlatformRoleRow> {
        const existing = await prisma.platformRole.findUnique({ where: { name: data.name } });
        if (existing) throw new ApiError(409, `Role "${data.name}" already exists`);

        const role = await prisma.platformRole.create({
            data: {
                id: generateId(),
                name: data.name,
                label: data.label,
                description: data.description ?? null,
                isStaff: data.isStaff ?? false,
                color: data.color ?? '#6366f1',
            },
            include: { _count: { select: { users: true } } },
        });

        return {
            id: role.id,
            name: role.name,
            label: role.label,
            description: role.description,
            isStaff: role.isStaff,
            color: role.color,
            userCount: role._count.users,
            createdAt: role.createdAt,
            updatedAt: role.updatedAt,
        };
    }

    static async ensureDefaultRoles(): Promise<void> {
        const defaults = [
            { name: 'SUPER_ADMIN', label: 'Super Admin', description: 'Full platform access — all permissions granted', isStaff: true,  color: '#f59e0b' },
            { name: 'ADMIN',       label: 'Administrator', description: 'Full super-admin dashboard access', isStaff: true,  color: '#ef4444' },
            { name: 'IT_STAFF',    label: 'IT Staff',    description: 'Workspace support & IT operations', isStaff: true,  color: '#6366f1' },
            { name: 'USER',        label: 'User',         description: 'Regular platform user',  isStaff: false, color: '#64748b' },
        ];
        for (const d of defaults) {
            await prisma.platformRole.upsert({
                where:  { name: d.name },
                create: { id: generateId(), ...d },
                update: {},
            });
        }
    }
}
