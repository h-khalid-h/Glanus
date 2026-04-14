import 'next-auth';

declare module 'next-auth' {
    interface User {
        id: string;
        role: string;
        isStaff: boolean;
    }

    interface Session {
        user: {
            id: string;
            email: string;
            name?: string | null;
            role: string;
            isStaff: boolean;
        };
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        id: string;
        role: string;
        isStaff: boolean;
        /** AuthSession ID for server-side session revocation checks. */
        sid?: string;
        /**
         * Active workspace ID — set when user calls /api/auth/switch-workspace.
         * Allows requireWorkspaceAccess() to skip the DB lookup for the hot path.
         * Absent on first login; falls back to DB verification.
         */
        wid?: string;
        /**
         * Role in the active workspace (OWNER | ADMIN | MEMBER | VIEWER).
         * Embedded alongside wid so role checks are also claim-based.
         */
        wRole?: string;
    }
}
