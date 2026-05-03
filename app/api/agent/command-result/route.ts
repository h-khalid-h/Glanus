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
    success: z.boolean(),
    exitCode: z.number().int().nullish(),
    stdout: z.string().max(1_000_000).nullish(),
    stderr: z.string().max(100_000).nullish(),
    startedAt: z.number(),
    finishedAt: z.number(),
});

export const POST = withErrorHandler(async (request: NextRequest) => {
    const data = commandResultSchema.parse(await request.json());
    const rateLimitResponse = await withRateLimit(request, 'agent', `agent:${hashAgentToken(data.authToken)}`);
    if (rateLimitResponse) return rateLimitResponse;

    const agent = await requireAgentContext(data.authToken);
    await runWithWorkspaceRLS(
        agent.workspaceId,
        { id: agent.id, role: 'USER' },
        () => AgentService.recordCommandResult({
            authToken: data.authToken,
            executionId: data.executionId,
            status: data.success ? 'completed' : 'failed',
            exitCode: data.exitCode,
            output: data.stdout,
            error: data.stderr,
            duration: data.finishedAt - data.startedAt,
        })
    );
    return apiSuccess({ status: 'ok', message: 'Result recorded successfully' });
});
