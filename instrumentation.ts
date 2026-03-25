import * as Sentry from '@sentry/nextjs';

export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        // Validate environment variables at startup
        const { assertEnvValid } = await import('./lib/env');
        assertEnvValid();

        await import('./sentry.server.config');

        // Graceful shutdown: flush Sentry, disconnect Prisma on SIGTERM/SIGINT
        const shutdown = async (signal: string) => {
            console.log(`[Shutdown] Received ${signal}, shutting down gracefully...`);
            try {
                await Sentry.flush(3000);
            } catch { /* best-effort */ }
            try {
                const { prisma } = await import('./lib/db');
                await (prisma as unknown as { $disconnect: () => Promise<void> }).$disconnect();
            } catch { /* best-effort */ }
            console.log('[Shutdown] Cleanup complete, exiting.');
            process.exit(0);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }

    if (process.env.NEXT_RUNTIME === 'edge') {
        await import('./sentry.edge.config')
    }
}

export const onRequestError = Sentry.captureRequestError;
