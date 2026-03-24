import { ApiError } from '@/lib/errors';
/**
 * AIService — OpenAI-powered assistant layer for workspace intelligence features.
 *
 * Responsibilities:
 *  - processAICommand: route natural-language commands to workspace actions (assets, agents, scripts)
 *  - autoCategorizeAsset: classify an asset into the workspace's category taxonomy using AI
 *  - generateAssetDescription: produce a structured AI description for a given asset
 *
 * Note: token usage is metered through enforceQuota + incrementAICredits.
 */
import OpenAI from 'openai';
import { enforceQuota, incrementAICredits } from '@/lib/workspace/quotas';
import { getOpenAIClient, prompts, defaultModel } from '@/lib/ai/openai';

// ============================================
// CONSTANTS
// ============================================

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

/**
 * OpenAI function-call tool definitions for the command palette.
 * Centralised here so future tools can be added without touching route handlers.
 */
const COMMAND_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
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

// ============================================
// INPUT TYPES
// ============================================

export interface CommandInput {
    input: string;
    workspaceId?: string;
    currentPath?: string;
    userName?: string;
    userEmail?: string;
}

// ============================================
// AI SERVICE
// ============================================

/**
 * AIService — Domain layer for all LLM/AI operations.
 *
 * Encapsulates:
 *   - Natural language command palette dispatch (processCommand)
 *   - Asset auto-categorization (autoCategorizeAsset)
 *
 * Architecture benefits:
 *   - Removes OpenAI SDK from route handlers entirely
 *   - Single place to swap LLM providers (e.g., Anthropic, Gemini)
 *   - quota enforcement and credit tracking are centralised here
 *   - Route handlers remain provider-agnostic
 */
export class AIService {

    // Lazy-init singleton for the command palette (uses env key directly)
    private static _client: OpenAI | null = null;

    private static getClient(): OpenAI {
        if (!process.env.OPENAI_API_KEY) {
            throw new ApiError(503, 'AI service not configured');
        }
        if (!AIService._client) {
            AIService._client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        }
        return AIService._client;
    }

    /**
     * Process a natural language command through the AI command palette.
     * Enforces quota before calling the LLM, increments credits on success.
     */
    static async processCommand(cmd: CommandInput) {
        if (!cmd.input?.trim()) {
            throw new ApiError(400, 'Command input is required');
        }

        const client = AIService.getClient();

        if (cmd.workspaceId) {
            await enforceQuota(cmd.workspaceId, 'ai_credits');
        }

        const systemPrompt = `You are Glanus, an IT operations assistant. The user is interacting with your command palette.

Current context:
- Workspace ID: ${cmd.workspaceId || 'none'}
- Current page: ${cmd.currentPath || '/'}
- User: ${cmd.userName || cmd.userEmail || 'Unknown'}

Available navigation paths:
- /dashboard — Main dashboard
- /assets — Asset management
- /workspaces/{id}/analytics — Mission Control
- /workspaces/{id}/agents — Agent management
- /workspaces/{id}/alerts — Alert management
- /workspaces/{id}/intelligence — AI Intelligence (CORTEX, REFLEX)
- /workspaces/{id}/members — Team management
- /workspaces/{id}/settings — Workspace settings
- /workspaces/{id}/billing — Billing & subscription

Respond with the most appropriate function call. If the request is a question, use 'explain'. If destructive, set requiresConfirmation to true.`;

        const response = await client.chat.completions.create({
            model: MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: cmd.input },
            ],
            tools: COMMAND_TOOLS,
            tool_choice: 'auto',
            temperature: 0.2,
            max_tokens: 500,
        });

        const message = response.choices[0]?.message;

        if (cmd.workspaceId) {
            await incrementAICredits(cmd.workspaceId);
        }

        if (message?.tool_calls && message.tool_calls.length > 0) {
            const toolCall = message.tool_calls[0];
            let args: Record<string, unknown>;
            try {
                args = JSON.parse(toolCall.function.arguments);
            } catch {
                throw new ApiError(502, 'AI returned invalid response');
            }
            return { type: toolCall.function.name, ...args, rawInput: cmd.input };
        }

        // Fallback: treat as explanation
        return {
            type: 'explain',
            topic: cmd.input,
            detail: message?.content || 'I could not process that command.',
            rawInput: cmd.input,
        };
    }

    /**
     * Auto-categorize an asset based on its description using the structured
     * OpenAI JSON mode. Uses the shared `lib/ai/openai` helper to keep the
     * system prompt consistent across all categorization callers.
     */
    static async autoCategorizeAsset(description: string) {
        const openai = getOpenAIClient(); // throws if key missing
        const completion = await openai.chat.completions.create({
            model: defaultModel,
            messages: [
                { role: 'system', content: 'You are an IT asset management expert. Provide precise categorization and suggestions.' },
                { role: 'user', content: prompts.assetCategorization(description) },
            ],
            response_format: { type: 'json_object' },
        });
        const content = completion.choices?.[0]?.message?.content;
        try {
            return JSON.parse(content || '{}');
        } catch {
            return {};
        }
    }
}
