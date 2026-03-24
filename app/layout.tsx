import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

// System font stack matching Inter metrics for offline/CI builds
const interClassName = 'font-sans';

export const metadata: Metadata = {
    title: {
        default: 'Glanus - AI-Native IT Operations Platform',
        template: '%s | Glanus',
    },
    description: 'AI-native operations platform that monitors, reasons about, predicts failures, and runs operations autonomously across your infrastructure.',
    metadataBase: new URL(process.env.NEXTAUTH_URL || 'https://glanus.io'),
    openGraph: {
        type: 'website',
        siteName: 'Glanus',
        locale: 'en_US',
    },
    twitter: {
        card: 'summary_large_image',
    },
    other: {
        'theme-color': '#0a0e1a',
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className="h-full dark">
            <body className={`${interClassName} h-full antialiased`}>
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
