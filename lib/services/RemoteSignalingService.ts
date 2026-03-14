/**
 * RemoteSignalingService — WebRTC signaling channel for remote access sessions.
 *
 * Responsibilities:
 *  - verifySignalingAccess: dual-auth guard — user session or agent bearer token
 *  - getSignalingState: read the current offer/answer/ICE candidates for a session
 *  - patchSignalingState: write offer (user side), answer (agent side), or append ICE candidates
 *
 * Dual-auth pattern:
 *   User side  → writes offer, reads answer, appends ICE candidates (source: 'admin')
 *   Agent side → writes answer, reads offer, appends ICE candidates (source: 'agent')
 *
 * Note: session lifecycle CRUD (getSessions/createSession/getSessionById/updateSession/endSession)
 * lives in RemoteSessionService.
 */
import { prisma } from '@/lib/db';
import { hashAgentToken } from '@/lib/security/agent-auth';

export class RemoteSignalingService {
    /**
     * Verify that the caller is authorized to access the signaling channel.
     * Returns { isAuthorized, isAgent } — isAgent distinguishes user vs. agent writers.
     * Accepts either a session userId (user-side) or an HMAC-hashed agent bearer token.
     */
    static async verifySignalingAccess(
        sessionId: string,
        userId: string | null,
        agentBearerToken: string | null,
    ): Promise<{ isAuthorized: boolean; isAgent: boolean }> {
        if (userId) return { isAuthorized: true, isAgent: false };

        if (agentBearerToken) {
            const hashedToken = hashAgentToken(agentBearerToken);
            const agent = await prisma.agentConnection.findUnique({
                where: { authToken: hashedToken },
            });
            if (agent) {
                const session = await prisma.remoteSession.findUnique({
                    where: { id: sessionId },
                    select: { assetId: true },
                });
                if (session && session.assetId === agent.assetId) {
                    return { isAuthorized: true, isAgent: true };
                }
            }
        }

        return { isAuthorized: false, isAgent: false };
    }

    /**
     * Read the current signaling state (offer, answer, ICE candidates) for a session.
     */
    static async getSignalingState(sessionId: string) {
        const session = await prisma.remoteSession.findUnique({
            where: { id: sessionId },
            select: { id: true, status: true, offer: true, answer: true, iceCandidates: true },
        });
        if (!session) {
            throw Object.assign(new Error('Session not found'), { statusCode: 404 });
        }
        return session;
    }

    /**
     * Patch the signaling state.
     *  - User side: may write offer, append ICE candidates (source: 'admin')
     *  - Agent side: may write answer, append ICE candidates (source: 'agent')
     * Throws 400 if the body contains no valid signaling data.
     */
    static async patchSignalingState(
        sessionId: string,
        body: { offer?: unknown; answer?: unknown; status?: string; iceCandidate?: unknown },
        isAgent: boolean,
    ) {
        const updateData: Record<string, unknown> = {};

        if (body.offer && !isAgent) updateData.offer = body.offer;
        if (body.answer && isAgent) updateData.answer = body.answer;

        if (body.status) {
            updateData.status = body.status;
            if (body.status === 'ENDED' || body.status === 'FAILED') {
                updateData.endedAt = new Date();
            }
        }

        if (body.iceCandidate) {
            const session = await prisma.remoteSession.findUnique({
                where: { id: sessionId },
                select: { iceCandidates: true },
            });
            const existing = (session?.iceCandidates as unknown[]) || [];
            updateData.iceCandidates = [...existing, { ...body.iceCandidate as object, source: isAgent ? 'agent' : 'admin' }];
        }

        if (Object.keys(updateData).length === 0) {
            throw Object.assign(new Error('No valid signaling data provided'), { statusCode: 400 });
        }

        return prisma.remoteSession.update({
            where: { id: sessionId },
            data: updateData as Parameters<typeof prisma.remoteSession.update>[0]['data'],
            select: { id: true, status: true, offer: true, answer: true, iceCandidates: true },
        });
    }
}
