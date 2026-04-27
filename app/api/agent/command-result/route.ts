import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { withErrorHandler, requireAgentContext, runWithWorkspaceRLS } from '@/lib/api/withAuth';
import { z } from 'zod';
import { AgentService } from '@/lib/services/AgentService';
import { withRateLimit } from '@/lib/security/rateLimit';
import { hashAgentToken } from '@/lib/security/agent-auth';

// NOTE: Use `.nullish()` (accepts null | undefined) — the Rust agent serializes
// Option<T> fields as explicit `null` (no skip_serializing_if), which plain
// `.optional()` would reject with a 400.
const commandResultSchema = z.object({
    authToken: z.string(),
    executionId: z.string(),
    status: z.enum(['completed', 'failed', 'timeout']),
    exitCode: z.number().int().nullish(),
    output: z.string().max(1_000_000).nullish(),
    error: z.string().max(100_000).nullish(),
    duration: z.number().nullish(),
});

export const POST = withErrorHandler(async (request: NextRequest) => {
    const data = commandResultSchema.parse(await request.json());
    const rateLimitResponse = await withRateLimit(request, 'agent', `agent:${hashAgentToken(data.authToken)}`);
    if (rateLimitResponse) return rateLimitResponse;

    const agent = await requireAgentContext(data.authToken);
    await runWithWorkspaceRLS(
        agent.workspaceId,
        { id: agent.id, role: 'USER' },
        () => AgentService.recordCommandResult(data)
    );
    return apiSuccess({ status: 'ok', message: 'Result recorded successfully' });
});
