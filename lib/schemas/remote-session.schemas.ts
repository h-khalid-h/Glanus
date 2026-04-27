import { z } from 'zod';

/**
 * Asset / user IDs are Prisma cuid()s (e.g. "cmoa3wrp5000sljdndwpo5ro4"),
 * not UUIDs. Use a permissive non-empty string id instead of z.string().uuid().
 */
const idSchema = z.string().min(1, 'Invalid id');

/**
 * Create remote session schema
 */
export const createRemoteSessionSchema = z.object({
    assetId: idSchema,
    quality: z.enum(['LOW', 'MEDIUM', 'HIGH', 'ULTRA']).default('MEDIUM'),
    notes: z.string().max(1000).optional(),
    offer: z.record(z.unknown()).optional(),
});

/**
 * Update remote session schema
 */
export const updateRemoteSessionSchema = z.object({
    quality: z.enum(['LOW', 'MEDIUM', 'HIGH', 'ULTRA']).optional(),
    notes: z.string().max(1000).optional(),
    status: z.enum(['ACTIVE', 'ENDED', 'FAILED']).optional(),
    averageLatency: z.number().nonnegative().optional(),
    averageFPS: z.number().nonnegative().optional(),
    metadata: z.record(z.unknown()).optional(),
    offer: z.record(z.unknown()).optional(),
    answer: z.record(z.unknown()).optional(),
    iceCandidates: z.array(z.record(z.unknown())).optional(),
});

/**
 * Remote session query parameters
 */
export const remoteSessionQuerySchema = z.object({
    status: z.enum(['ACTIVE', 'ENDED', 'FAILED']).optional(),
    assetId: idSchema.optional(),
    userId: idSchema.optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(20),
});

export type CreateRemoteSessionInput = z.infer<typeof createRemoteSessionSchema>;
export type UpdateRemoteSessionInput = z.infer<typeof updateRemoteSessionSchema>;
export type RemoteSessionQueryParams = z.infer<typeof remoteSessionQuerySchema>;
