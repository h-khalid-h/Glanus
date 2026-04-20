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
        <html lang="en" className="h-full" suppressHydrationWarning>
            <head>
                {/* Inline script to prevent theme flash on load */}
                <script
                    dangerouslySetInnerHTML={{
                        __html: `(function(){try{var d=document.documentElement,s=JSON.parse(localStorage.getItem('glanus-theme')||'{}'),m=s&&s.state&&s.state.mode;if(m==='dark')d.classList.add('dark');else if(m==='light')d.classList.remove('dark');else if(window.matchMedia('(prefers-color-scheme:dark)').matches)d.classList.add('dark')}catch(e){}})()`,
                    }}
                />
            </head>
            <body className={`${interClassName} h-full antialiased`} suppressHydrationWarning>
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
