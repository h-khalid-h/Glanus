import { ApiError } from '@/lib/errors';
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
        if (userId) {
            // Verify the user is a workspace member for the session's asset
            const session = await prisma.remoteSession.findFirst({
                where: {
                    id: sessionId,
                    asset: { workspace: { members: { some: { userId } } } },
                },
                select: { id: true },
            });
            return { isAuthorized: !!session, isAgent: false };
        }

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
            throw new ApiError(404, 'Session not found');
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
            // Validate ICE candidate structure to prevent injection of malformed data
            const candidate = body.iceCandidate as Record<string, unknown>;
            if (typeof candidate !== 'object' || candidate === null ||
                (candidate.candidate !== undefined && typeof candidate.candidate !== 'string') ||
                (candidate.sdpMid !== undefined && typeof candidate.sdpMid !== 'string') ||
                (candidate.sdpMLineIndex !== undefined && typeof candidate.sdpMLineIndex !== 'number')) {
                throw new ApiError(400, 'Invalid ICE candidate format');
            }

            const session = await prisma.remoteSession.findUnique({
                where: { id: sessionId },
                select: { iceCandidates: true },
            });
            const existing = (session?.iceCandidates as unknown[]) || [];

            // Cap ICE candidates to prevent unbounded growth
            if (existing.length >= 50) {
                throw new ApiError(400, 'Maximum ICE candidates reached for this session');
            }

            updateData.iceCandidates = [...existing, {
                candidate: candidate.candidate,
                sdpMid: candidate.sdpMid,
                sdpMLineIndex: candidate.sdpMLineIndex,
                source: isAgent ? 'agent' : 'admin',
            }];
        }

        if (Object.keys(updateData).length === 0) {
            throw new ApiError(400, 'No valid signaling data provided');
        }

        return prisma.remoteSession.update({
            where: { id: sessionId },
            data: updateData as Parameters<typeof prisma.remoteSession.update>[0]['data'],
            select: { id: true, status: true, offer: true, answer: true, iceCandidates: true },
        });
    }
}
