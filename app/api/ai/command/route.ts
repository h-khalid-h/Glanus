import { NextRequest } from 'next/server';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { apiSuccess, apiError } from '@/lib/api/response';
import { enforceQuota, incrementAICredits } from '@/lib/workspace/quotas';
import { withRateLimit } from '@/lib/security/rateLimit';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// Available command functions for OpenAI function-calling
const COMMAND_FUNCTIONS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
        type: 'function',
        function: {
            name: 'navigate',
            description: 'Navigate to a page in the application',
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'The URL path to navigate to' },
                    label: { type: 'string', description: 'Human-readable label for the destination' },
                },
                required: ['path', 'label'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'query',
            description: 'Search or query for information about assets, agents, alerts, or workspace data',
            parameters: {
                type: 'object',
                properties: {
                    entity: { type: 'string', enum: ['assets', 'agents', 'alerts', 'members', 'activity'] },
                    filter: { type: 'string', description: 'Filter condition' },
                    summary: { type: 'string', description: 'Human-readable summary of what was queried' },
                },
                required: ['entity', 'summary'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'explain',
            description: 'Provide an explanation or analysis about operational state, risks, or incidents',
            parameters: {
                type: 'object',
                properties: {
                    topic: { type: 'string', description: 'What to explain' },
                    detail: { type: 'string', description: 'Detailed explanation' },
                },
                required: ['topic', 'detail'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'execute',
            description: 'Execute an action like running a script, restarting an agent, or creating an alert',
            parameters: {
                type: 'object',
                properties: {
                    actionType: { type: 'string', enum: ['run_script', 'restart_agent', 'create_alert', 'send_notification'] },
                    target: { type: 'string', description: 'Target asset, agent, or entity' },
                    summary: { type: 'string', description: 'Human-readable summary of the action' },
                    requiresConfirmation: { type: 'boolean', description: 'Whether this action needs user confirmation' },
                },
                required: ['actionType', 'summary', 'requiresConfirmation'],
            },
        },
    },
];

// POST /api/ai/command - Process natural language command
export const POST = withErrorHandler(async (request: NextRequest) => {
    const rateLimitResponse = await withRateLimit(request, 'strict-api');
    if (rateLimitResponse) return rateLimitResponse;

    const user = await requireAuth();

    const body = await request.json();
    const { input, workspaceId, currentPath } = body;

    if (!input?.trim()) {
        return apiError(400, 'Command input is required');
    }

    if (!process.env.OPENAI_API_KEY) {
        return apiError(503, 'AI service not configured');
    }

    // Enforce AI credit quota before calling OpenAI
    if (workspaceId) {
        await enforceQuota(workspaceId, 'ai_credits');
    }

    const systemPrompt = `You are Glanus, an IT operations assistant. The user is interacting with your command palette.

Current context:
- Workspace ID: ${workspaceId || 'none'}
- Current page: ${currentPath || '/'}
- User: ${user.name || user.email}

Available navigation paths:
- /dashboard — Main dashboard
- /assets — Asset management
- /workspaces/{id}/analytics — Mission Control (workspace overview)
- /workspaces/{id}/agents — Agent management
- /workspaces/{id}/alerts — Alert management
- /workspaces/{id}/intelligence — AI Intelligence (CORTEX causal analysis, REFLEX automation)
- /workspaces/{id}/members — Team management
- /workspaces/{id}/settings — Workspace settings
- /workspaces/{id}/billing — Billing & subscription

Respond with the most appropriate function call for the user's request.
If the request is a question, use the 'explain' function.
If the request could be destructive, set requiresConfirmation to true.`;

    try {
        const response = await openai.chat.completions.create({
            model: MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: input },
            ],
            tools: COMMAND_FUNCTIONS,
            tool_choice: 'auto',
            temperature: 0.2,
            max_tokens: 500,
        });

        const message = response.choices[0]?.message;

        // Increment AI credits after successful OpenAI call
        if (workspaceId) {
            await incrementAICredits(workspaceId);
        }

        if (message?.tool_calls && message.tool_calls.length > 0) {
            const toolCall = message.tool_calls[0];
            const args = JSON.parse(toolCall.function.arguments);

            return apiSuccess({
                type: toolCall.function.name,
                ...args,
                rawInput: input,
            });
        }

        // Fallback: return as explanation
        return apiSuccess({
            type: 'explain',
            topic: input,
            detail: message?.content || 'I could not process that command.',
            rawInput: input,
        });
    } catch (err: unknown) {
        return apiError(500, 'Failed to process command');
    }
});
