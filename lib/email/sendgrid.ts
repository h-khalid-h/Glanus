import { logError, logInfo, logWarn } from '@/lib/logger';
import sgMail from '@sendgrid/mail';
import { sendEmailViaBrevo } from '@/lib/email/brevo';
import { sendEmailViaSMTP } from '@/lib/email/smtp';

// Initialize SendGrid if key is present
if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
    logWarn('SENDGRID_API_KEY is not set. Primary SMTP will be used first, then Brevo as last resort.');
}

type EmailData = {
    to: string;
    subject: string;
    html: string;
    text?: string; // Optional plain text version
};

export const sendEmail = async (data: EmailData): Promise<void> => {
    const hasSMTP = !!process.env.SMTP_HOST;
    const hasSendGrid = !!process.env.SENDGRID_API_KEY;
    const hasBrevo = !!process.env.BREVO_API_KEY;

    // No providers configured — mock send
    if (!hasSMTP && !hasSendGrid && !hasBrevo) {
        logInfo('Mock email send (no email provider configured)', {
            to: data.to,
            subject: data.subject,
            htmlPreview: data.html.substring(0, 100),
        });
        return;
    }

    // Tier 1: SMTP (primary)
    if (hasSMTP) {
        try {
            await sendEmailViaSMTP(data);
            return; // Success — done
        } catch (smtpError: unknown) {
            logError('SMTP email failed, attempting SendGrid failover', smtpError);
        }
    }

    // Tier 2: SendGrid
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
        }
    }

    // Tier 3: Brevo (last resort)
    if (hasBrevo) {
        try {
            await sendEmailViaBrevo(data);
            return; // Success — done
        } catch (brevoError: unknown) {
            logError('Brevo email failover also failed', brevoError);
            throw new Error('Failed to send email via all providers (SMTP, SendGrid, Brevo)');
        }
    }

    throw new Error('Failed to send email: no configured provider succeeded');
};

