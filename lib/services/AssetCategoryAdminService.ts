import { ApiError } from '@/lib/errors';
/**
 * AssetCategoryAdminService — Manages asset category definitions and their field/action schemas.
 *
 * Responsibilities:
 *  - createCategory / updateCategory / deleteCategory: CRUD for category types
 *  - createCategoryField / updateCategoryField / deleteCategoryField: manage custom field definitions
 *  - createCategoryAction / updateCategoryAction / deleteCategoryAction: manage action definitions
 */
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import {
    createCategorySchema,
    updateCategorySchema,
    categoryQuerySchema,
    createFieldDefinitionRequestSchema,
    updateFieldDefinitionSchema,
    createActionDefinitionRequestSchema,
    updateActionDefinitionSchema,
} from '@/lib/schemas/dynamic-asset.schemas';
import { z } from 'zod';

export type CategoryQueryInput = z.infer<typeof categoryQuerySchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateFieldInput = z.infer<typeof createFieldDefinitionRequestSchema>;
export type UpdateFieldInput = z.infer<typeof updateFieldDefinitionSchema>;
export type CreateActionInput = z.infer<typeof createActionDefinitionRequestSchema>;
export type UpdateActionInput = z.infer<typeof updateActionDefinitionSchema>;

/**
 * AssetCategoryAdminService — Domain layer for asset schema management.
 *
 * Encapsulates:
 *   - Asset category CRUD with circular-reference protection and audit trail
 *   - Field definition management (value-count guard prevents unsafe deletes)
 *   - Action definition management (soft-delete preserves execution history)
 */
export class AssetCategoryAdminService {

    // ========================================
    // ASSET CATEGORIES
    // ========================================

    static async listCategories(query: CategoryQueryInput, workspaceId: string) {
        const { assetType, parentId, isActive, includeFields, includeActions, includeChildren } = query;

        const categories = await prisma.assetCategory.findMany({
            where: {
                workspaceId,
                ...(assetType && { assetTypeValue: assetType }),
                ...(parentId && { parentId }),
                ...(isActive !== undefined && { isActive }),
            },
            include: {
                parent: true,
                ...(includeFields && { fieldDefinitions: { orderBy: { sortOrder: 'asc' } } }),
                ...(includeActions && { actionDefinitions: { orderBy: { sortOrder: 'asc' } } }),
                ...(includeChildren && { children: { orderBy: { sortOrder: 'asc' } } }),
            } as never,
            orderBy: [{ assetTypeValue: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
        });

        return { categories, count: categories.length };
    }

    static async createCategory(data: CreateCategoryInput, userId: string, workspaceId: string) {
        const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const existing = await prisma.assetCategory.findUnique({ where: { workspaceId_slug: { workspaceId, slug } } });
        if (existing) throw new ApiError(409, 'Category slug already exists in this workspace');

        if (data.parentId) {
            const parent = await prisma.assetCategory.findUnique({ where: { id: data.parentId } });
            if (!parent) throw new ApiError(404, 'Parent category not found');
            if (!parent.allowsChildren) throw new ApiError(400, 'Parent category does not allow children');
            if (parent.assetTypeValue !== data.assetTypeValue) throw new ApiError(400, 'Child category must have same asset type as parent');
        }

        const category = await prisma.assetCategory.create({
            data: {
                workspaceId,
                name: data.name,
                assetTypeValue: data.assetTypeValue,
                description: data.description,
                slug,
                icon: data.icon ?? '',
                parentId: data.parentId,
                allowsChildren: data.allowsChildren ?? true,
                isActive: data.isActive ?? true,
                sortOrder: data.sortOrder ?? 0,
                metadata: data.metadata as Prisma.InputJsonValue ?? {},
            },
            include: { parent: true, fieldDefinitions: true, actionDefinitions: true },
        });

        await prisma.auditLog.create({
            data: { action: 'CATEGORY_CREATED', resourceType: 'AssetCategory', resourceId: category.id, userId, metadata: { categoryName: category.name, slug: category.slug } },
        });

        return category;
    }

    static async getCategory(id: string, workspaceId: string) {
        const category = await prisma.assetCategory.findFirst({
            where: { id, workspaceId },
            include: {
                parent: true,
                children: { orderBy: { sortOrder: 'asc' } },
                fieldDefinitions: { orderBy: { sortOrder: 'asc' } },
                actionDefinitions: { orderBy: { sortOrder: 'asc' } },
                _count: { select: { assets: true } },
            },
        });
        if (!category) throw new ApiError(404, 'Category not found');
        return category;
    }

    static async updateCategory(id: string, data: UpdateCategoryInput, userId: string, workspaceId: string) {
        const existing = await prisma.assetCategory.findFirst({ where: { id, workspaceId } });
        if (!existing) throw new ApiError(404, 'Category not found');

        if (data.slug && data.slug !== existing.slug) {
            const conflict = await prisma.assetCategory.findUnique({ where: { workspaceId_slug: { workspaceId, slug: data.slug } } });
            if (conflict) throw new ApiError(409, 'Category slug already exists in this workspace');
        }

        if (data.parentId !== undefined && data.parentId !== existing.parentId) {
            if (data.parentId === id) throw new ApiError(400, 'Category cannot be its own parent');
            if (data.parentId) {
                const parent = await prisma.assetCategory.findUnique({ where: { id: data.parentId } });
                if (!parent) throw new ApiError(404, 'Parent category not found');
                if (!parent.allowsChildren) throw new ApiError(400, 'Parent category does not allow children');
                if (await AssetCategoryAdminService.hasCircularRef(id, data.parentId)) throw new ApiError(400, 'This change would create a circular reference');
            }
        }

        const category = await prisma.assetCategory.update({
            where: { id },
            data: { ...data, metadata: data.metadata as never },
            include: { parent: true, children: true, fieldDefinitions: true, actionDefinitions: true },
        });

        await prisma.auditLog.create({
            data: { action: 'CATEGORY_UPDATED', resourceType: 'AssetCategory', resourceId: id, userId, metadata: { categoryName: category.name, changes: data } as never },
        });
        return category;
    }

    static async deleteCategory(id: string, userId: string, workspaceId: string) {
        const category = await prisma.assetCategory.findFirst({
            where: { id, workspaceId },
            include: { children: true, _count: { select: { assets: true } } },
        });
        if (!category) throw new ApiError(404, 'Category not found');
        if (category.children.length > 0) throw new ApiError(400, 'Cannot delete category with children. Delete children first.');
        if (category._count.assets > 0) throw new ApiError(400, 'Cannot delete category with assets. Reassign or delete assets first.');

        await prisma.assetCategory.delete({ where: { id } });
        await prisma.auditLog.create({
            data: { action: 'CATEGORY_DELETED', resourceType: 'AssetCategory', resourceId: id, userId, metadata: { categoryName: category.name } },
        });
    }

    private static async hasCircularRef(categoryId: string, newParentId: string): Promise<boolean> {
        let currentId: string | null = newParentId;
        while (currentId) {
            if (currentId === categoryId) return true;
            const parent: { parentId: string | null } | null = await prisma.assetCategory.findUnique({ where: { id: currentId }, select: { parentId: true } });
            currentId = parent?.parentId ?? null;
        }
        return false;
    }

    // ========================================
    // FIELD DEFINITIONS
    // ========================================

    static async listCategoryFields(categoryId: string) {
        const category = await prisma.assetCategory.findUnique({ where: { id: categoryId } });
        if (!category) throw new ApiError(404, 'Category not found');
        const fields = await prisma.assetFieldDefinition.findMany({ where: { categoryId }, orderBy: { sortOrder: 'asc' } });
        return { fields, count: fields.length };
    }

    static async createCategoryField(categoryId: string, data: CreateFieldInput) {
        const category = await prisma.assetCategory.findUnique({ where: { id: categoryId } });
        if (!category) throw new ApiError(404, 'Category not found');
        const existing = await prisma.assetFieldDefinition.findUnique({ where: { categoryId_slug: { categoryId, slug: data.slug } } });
        if (existing) throw new ApiError(409, 'Field with this slug already exists in category');
        const { workspaceId, ...fieldData } = data;
        return prisma.assetFieldDefinition.create({ data: { ...fieldData, categoryId, sortOrder: fieldData.sortOrder ?? 0 } });
    }

    static async updateField(id: string, data: UpdateFieldInput, userId: string) {
        const existing = await prisma.assetFieldDefinition.findUnique({ where: { id }, select: { categoryId: true, slug: true, name: true } });
        if (!existing) throw new ApiError(404, 'Field definition not found');

        if (data.slug && data.slug !== existing.slug) {
            const conflict = await prisma.assetFieldDefinition.findFirst({ where: { categoryId: existing.categoryId, slug: data.slug, id: { not: id } } });
            if (conflict) throw new ApiError(400, 'A field with this slug already exists in this category');
        }

        const { workspaceId: _ws, ...updateData } = data;
        const field = await prisma.assetFieldDefinition.update({ where: { id }, data: { ...updateData, validationRules: updateData.validationRules as never } });
        await prisma.auditLog.create({
            data: { action: 'FIELD_UPDATED', resourceType: 'AssetFieldDefinition', resourceId: id, userId, metadata: { fieldName: field.name, previousName: existing.name, changes: data } },
        });
        return field;
    }

    static async deleteField(id: string, userId: string) {
        const field = await prisma.assetFieldDefinition.findUnique({ where: { id }, select: { id: true, name: true } });
        if (!field) throw new ApiError(404, 'Field definition not found');

        const valueCount = await prisma.assetFieldValue.count({ where: { fieldDefinitionId: id } });
        if (valueCount > 0) throw new ApiError(400, `Cannot delete field definition. ${valueCount} asset(s) have values for this field.`);

        await prisma.assetFieldDefinition.delete({ where: { id } });
        await prisma.auditLog.create({
            data: { action: 'FIELD_DELETED', resourceType: 'AssetFieldDefinition', resourceId: id, userId, metadata: { fieldName: field.name } },
        });
        return field;
    }

    // ========================================
    // ACTION DEFINITIONS
    // ========================================

    static async createCategoryAction(categoryId: string, data: CreateActionInput) {
        const category = await prisma.assetCategory.findUnique({ where: { id: categoryId } });
        if (!category) throw new ApiError(404, 'Category not found');
        const existing = await prisma.assetActionDefinition.findUnique({ where: { categoryId_slug: { categoryId, slug: data.slug } } });
        if (existing) throw new ApiError(409, 'Action with this slug already exists in category');
        return prisma.assetActionDefinition.create({ data: { ...data, categoryId, sortOrder: data.sortOrder ?? 0 } });
    }

    static async updateAction(id: string, data: UpdateActionInput) {
        const existing = await prisma.assetActionDefinition.findUnique({ where: { id }, select: { categoryId: true, slug: true } });
        if (!existing) throw new ApiError(404, 'Action definition not found');

        if (data.slug && data.slug !== existing.slug) {
            const conflict = await prisma.assetActionDefinition.findFirst({ where: { categoryId: existing.categoryId, slug: data.slug, id: { not: id } } });
            if (conflict) throw new ApiError(400, 'An action with this slug already exists in this category');
        }

        return prisma.assetActionDefinition.update({ where: { id }, data: { ...data, handlerConfig: data.handlerConfig as never, parameters: data.parameters as never } });
    }

    /**
     * Soft-delete: if executions exist, mark as hidden (preserves history).
     * If no executions, hard-delete is safe.
     */
    static async deleteAction(id: string) {
        const action = await prisma.assetActionDefinition.findUnique({ where: { id }, select: { id: true, name: true } });
        if (!action) throw new ApiError(404, 'Action definition not found');

        const executionCount = await prisma.assetActionExecution.count({ where: { actionDefinitionId: id } });
        if (executionCount > 0) {
            const updated = await prisma.assetActionDefinition.update({ where: { id }, data: { isVisible: false } });
            return { hidden: true, action: updated, executionCount, message: `Action has ${executionCount} execution(s). Marked as hidden instead of deleting.` };
        }

        await prisma.assetActionDefinition.delete({ where: { id } });
        return { hidden: false, deletedAction: action, message: 'Action definition deleted successfully' };
    }
}
