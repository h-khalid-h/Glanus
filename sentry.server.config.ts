import * as Sentry from '@sentry/nextjs'

Sentry.init({
    dsn: process.env.SENTRY_DSN,

    // Performance Monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    environment: process.env.NODE_ENV,

    // Enable debug in development
    debug: false,
})
