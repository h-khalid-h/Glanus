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
    }
}
