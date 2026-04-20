import { createTransport } from 'nodemailer';
import { logInfo } from '@/lib/logger';

type EmailData = {
    to: string;
    subject: string;
    html: string;
    text?: string;
};

/**
 * Send a transactional email via SMTP (nodemailer).
 * Configured via SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS env vars.
 */
export const sendEmailViaSMTP = async (data: EmailData): Promise<void> => {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host) throw new Error('SMTP_HOST is not configured');

    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = process.env.SMTP_SECURE === 'true'; // true = TLS on connect (port 465)

    const fromEmail = process.env.SMTP_FROM_EMAIL || 'noreply@glanus.com';
    const fromName = process.env.SMTP_FROM_NAME || 'Glanus';

    const transport = createTransport({
        host,
        port,
        secure,
        ...(user && pass ? { auth: { user, pass } } : {}),
    });

    await transport.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: data.to,
        subject: data.subject,
        html: data.html,
        text: data.text || data.html.replace(/<[^>]*>?/gm, ''),
    });

    logInfo('Email sent via SMTP', { to: data.to, subject: data.subject, host, port });
};
