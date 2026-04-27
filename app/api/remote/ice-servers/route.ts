import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, withErrorHandler, ApiError } from '@/lib/api/withAuth';
import { prisma } from '@/lib/db';
import { hashAgentToken } from '@/lib/security/agent-auth';

/**
 * GET /api/remote/ice-servers
 *
 * Returns the ICE server configuration both the browser viewer and the
 * Rust agent feed into their `RTCConfiguration`.  Without this endpoint
 * peers fall back to host-candidate-only signaling, which fails on any
 * non-LAN network and leaks "ErrMismatchUsername" floods on flaky LANs
 * because the browser silently triggers an ICE restart with fresh
 * credentials while the agent is still pinned to the old ones.
 *
 * Auth model mirrors `app/api/remote/sessions/[id]/signaling/route.ts`:
 *  • A signed-in user (cookie session) — for the browser viewer.
 *  • A registered agent (Bearer auth_token) — for the Rust host runtime.
 *
 * Static configuration via environment variables (all optional):
 *  • REMOTE_STUN_URLS       — comma-separated list. Default: Google's
 *                             public STUN servers (good enough for LAN
 *                             and most consumer NATs).
 *  • REMOTE_TURN_URL        — full URL, e.g. `turn:turn.example.com:3478`.
 *  • REMOTE_TURN_USERNAME   — TURN long-term credential username.
 *  • REMOTE_TURN_PASSWORD   — TURN long-term credential password.
 */
async function resolveCaller(request: NextRequest): Promise<'user' | 'agent' | null> {
    // Bearer first — covers the Rust agent path and avoids paying the cost of
    // `getServerSession()` for every agent ICE refresh. The agent has no
    // browser cookie, so its requests would always fall through to the
    // catch branch anyway.
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const agent = await prisma.agentConnection.findFirst({
            where: { authToken: hashAgentToken(token) },
            select: { id: true },
        });
        if (agent) return 'agent';
    }
    // Browser viewer path — uses the NextAuth cookie session.
    try {
        await requireAuth();
        return 'user';
    } catch {
        return null;
    }
}

interface IceServer {
    urls: string | string[];
    username?: string;
    credential?: string;
}

function loadIceServers(): IceServer[] {
    const servers: IceServer[] = [];

    const stunCsv = process.env.REMOTE_STUN_URLS?.trim();
    const stunUrls = stunCsv
        ? stunCsv.split(',').map((s) => s.trim()).filter(Boolean)
        : [
            // Google's public STUN — keeps the agent reachable behind
            // typical home/office NATs without requiring infra ops to
            // stand up their own server. Override via REMOTE_STUN_URLS
            // if you need to lock the deployment down to private STUN.
            'stun:stun.l.google.com:19302',
            'stun:stun1.l.google.com:19302',
        ];
    if (stunUrls.length > 0) {
        servers.push({ urls: stunUrls });
    }

    const turnUrl = process.env.REMOTE_TURN_URL?.trim();
    const turnUser = process.env.REMOTE_TURN_USERNAME?.trim();
    const turnPass = process.env.REMOTE_TURN_PASSWORD?.trim();
    if (turnUrl && turnUser && turnPass) {
        servers.push({
            urls: turnUrl,
            username: turnUser,
            credential: turnPass,
        });
    }

    return servers;
}

export const GET = withErrorHandler(async (request: NextRequest) => {
    const caller = await resolveCaller(request);
    if (!caller) throw new ApiError(401, 'Unauthorized');
    return apiSuccess({ iceServers: loadIceServers() });
});
