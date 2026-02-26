import { logError, logInfo, logWarn } from '@/lib/logger';
import sgMail from '@sendgrid/mail';
import { sendEmailViaBrevo } from '@/lib/email/brevo';

// Initialize SendGrid with API key from environment variables
if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
    logWarn('SENDGRID_API_KEY is not set. Emails will use Brevo or be logged to console only.');
}

type EmailData = {
    to: string;
    subject: string;
    html: string;
    text?: string; // Optional plain text version
};

export const sendEmail = async (data: EmailData): Promise<void> => {
    const hasSendGrid = !!process.env.SENDGRID_API_KEY;
    const hasBrevo = !!process.env.BREVO_API_KEY;

    // No providers configured — mock send
    if (!hasSendGrid && !hasBrevo) {
        logInfo('Mock email send (no email provider configured)', {
            to: data.to,
            subject: data.subject,
            htmlPreview: data.html.substring(0, 100),
        });
        return;
    }

    // Try SendGrid first (primary)
    if (hasSendGrid) {
        try {
            const msg = {
                to: data.to,
                from: process.env.SENDGRID_FROM_EMAIL || 'noreply@glanus.com',
                subject: data.subject,
                html: data.html,
                text: data.text || data.html.replace(/<[^>]*>?/gm, ''),
            };
            await sgMail.send(msg);
            return; // Success — done
        } catch (error: unknown) {
            logError('SendGrid email failed, attempting Brevo failover', error);
            if (error && typeof error === 'object' && 'response' in error) {
                logError('SendGrid API response', (error as { response: { body: unknown } }).response.body);
            }

            // If Brevo is available, fail over — otherwise throw
            if (!hasBrevo) {
                throw new Error('Failed to send email via SendGrid (no failover configured)');
            }
        }
    }

    // Brevo failover (or primary if no SendGrid)
    try {
        await sendEmailViaBrevo(data);
    } catch (brevoError: unknown) {
        logError('Brevo email failover also failed', brevoError);
        throw new Error('Failed to send email via both SendGrid and Brevo');
    }
};

