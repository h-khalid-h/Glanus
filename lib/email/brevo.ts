import { logError, logInfo } from '@/lib/logger';

type EmailData = {
    to: string;
    subject: string;
    html: string;
    text?: string;
};

/**
 * Send a transactional email via the Brevo (Sendinblue) v3 API.
 * Uses the JSON transactional SMTP endpoint — no SDK dependency required.
 *
 * @see https://developers.brevo.com/reference/sendtransacemail
 */
export const sendEmailViaBrevo = async (data: EmailData): Promise<void> => {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
        throw new Error('BREVO_API_KEY is not configured');
    }

    const fromEmail = process.env.BREVO_FROM_EMAIL || process.env.SENDGRID_FROM_EMAIL || 'noreply@glanus.com';
    const fromName = process.env.BREVO_FROM_NAME || 'Glanus';

    const body = {
        sender: { name: fromName, email: fromEmail },
        to: [{ email: data.to }],
        subject: data.subject,
        htmlContent: data.html,
        textContent: data.text || data.html.replace(/<[^>]*>?/gm, ''),
    };

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        logError('Brevo email send failed', { status: response.status, body: errorBody });
        throw new Error(`Brevo API error: ${response.status} — ${errorBody}`);
    }

    logInfo('Email sent via Brevo', { to: data.to, subject: data.subject });
};
