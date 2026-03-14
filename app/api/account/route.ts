import { NextRequest } from 'next/server';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/response';
import { AccountService } from '@/lib/services/AccountService';
import { z } from 'zod';

const updateProfileSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    email: z.string().email().optional(),
});

const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

/**
 * GET /api/account
 * Get the current authenticated user's profile with workspace memberships.
 */
export const GET = withErrorHandler(async () => {
    const user = await requireAuth();
    const profile = await AccountService.getProfile(user.id);
    return apiSuccess({ profile });
});

/**
 * PATCH /api/account
 * Update the current user's profile (name, email).
 */
export const PATCH = withErrorHandler(async (request: NextRequest) => {
    const user = await requireAuth();
    const data = updateProfileSchema.parse(await request.json());
    const profile = await AccountService.updateProfile(user.id, data);
    return apiSuccess({ profile }, { message: 'Profile updated successfully.' });
});

/**
 * POST /api/account
 * Change the current user's password.
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
    const user = await requireAuth();
    const { currentPassword, newPassword } = changePasswordSchema.parse(await request.json());
    const result = await AccountService.changePassword(user.id, currentPassword, newPassword);
    return apiSuccess(result, { message: 'Password changed successfully.' });
});
