import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    output: 'standalone',
    serverExternalPackages: ['ssh2', 'node-ssh', 'isomorphic-dompurify', 'jsdom'],
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: '*.googleusercontent.com' },
            { protocol: 'https', hostname: '*.githubusercontent.com' },
            { protocol: 'https', hostname: '*.gravatar.com' },
        ],
    },
    experimental: {
        serverActions: {
            bodySizeLimit: '2mb',
        },
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
}

export default withSentryConfig(nextConfig, {
    // Sentry configuration options
    silent: true, // Suppresses source map uploading logs during build
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
}, {
    // Additional config options for the Sentry webpack plugin
    widenClientFileUpload: true,
    transpileClientSDK: true,
    tunnelRoute: '/monitoring',
    hideSourceMaps: true,
    disableLogger: true,
})
