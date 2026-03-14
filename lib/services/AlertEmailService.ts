/**
 * AlertEmailService — Delivers alert notification emails via SendGrid and Brevo.
 *
 * Responsibilities:
 *  - sendAlertEmail: dispatch an alert email using the configured provider
 *  - Supports SendGrid (primary) and Brevo (fallback) transports
 */
import { logError, logInfo } from '@/lib/logger';
// Email notification service
interface EmailPayload {
  to: string[];
  subject: string;
  alert: string;
  asset: string;
  metric: string;
  value: number;
  threshold: number;
  severity: string;
  timestamp: string;
}

export class EmailService {
  /**
   * Send alert notification email
   * Primary: SendGrid, Failover: Brevo
   */
  async sendAlert(payload: EmailPayload): Promise<{ success: boolean; error?: string }> {
    try {
      const emailHtml = this.generateAlertEmail(payload);
      const hasSendGrid = !!process.env.SENDGRID_API_KEY;
      const hasBrevo = !!process.env.BREVO_API_KEY;

      if (!hasSendGrid && !hasBrevo) {
        // Development fallback: log instead of sending
        logInfo('[EMAIL] Would send alert email (dev mode)', {
          to: payload.to,
          subject: payload.subject,
          preview: `${payload.alert}: ${payload.asset} ${payload.metric} is ${payload.value}% (threshold: ${payload.threshold}%)`,
        });
        return { success: true };
      }

      // Try SendGrid first (primary)
      if (hasSendGrid) {
        try {
          const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              personalizations: [{
                to: payload.to.map(email => ({ email })),
              }],
              from: { email: process.env.ALERT_FROM_EMAIL || 'alerts@glanus.com', name: 'Glanus Alerts' },
              subject: payload.subject,
              content: [{
                type: 'text/html',
                value: emailHtml,
              }],
            }),
          });

          if (!response.ok) {
            throw new Error(`SendGrid error: ${response.status} ${response.statusText}`);
          }
          return { success: true };
        } catch (sgError) {
          logError('SendGrid alert email failed', sgError);
          if (!hasBrevo) throw sgError;
          // Fall through to Brevo
        }
      }

      // Brevo failover for alerts
      if (hasBrevo) {
        const brevoBody = {
          sender: {
            name: 'Glanus Alerts',
            email: process.env.ALERT_FROM_EMAIL || process.env.BREVO_FROM_EMAIL || 'alerts@glanus.com',
          },
          to: payload.to.map(email => ({ email })),
          subject: payload.subject,
          htmlContent: emailHtml,
        };

        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': process.env.BREVO_API_KEY!,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(brevoBody),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`Brevo alert error: ${response.status} — ${errorBody}`);
        }
      }

      return { success: true };
    } catch (error: unknown) {
      logError('Email send failed (all providers)', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate HTML email template
   */
  private generateAlertEmail(payload: EmailPayload): string {
    const severityColors = {
      INFO: '#3B82F6',
      WARNING: '#F59E0B',
      CRITICAL: '#EF4444',
    };

    const color = severityColors[payload.severity as keyof typeof severityColors] || '#6B7280';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${payload.subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: ${color}; padding: 24px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">
                🚨 ${payload.severity} Alert
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 20px;">
                ${payload.alert}
              </h2>
              
              <p style="margin: 0 0 24px 0; color: #6B7280; font-size: 14px;">
                ${new Date(payload.timestamp).toLocaleString()}
              </p>
              
              <table width="100%" cellpadding="12" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="color: #6B7280; font-size: 14px; font-weight: 600;">Asset</td>
                  <td style="color: #111827; font-size: 14px; text-align: right;">${payload.asset}</td>
                </tr>
                <tr>
                  <td style="color: #6B7280; font-size: 14px; font-weight: 600;">Metric</td>
                  <td style="color: #111827; font-size: 14px; text-align: right;">${payload.metric}</td>
                </tr>
                <tr>
                  <td style="color: #6B7280; font-size: 14px; font-weight: 600;">Current Value</td>
                  <td style="color: ${color}; font-size: 18px; font-weight: bold; text-align: right;">
                    ${payload.value}${payload.metric === 'OFFLINE' ? ' min' : '%'}
                  </td>
                </tr>
                <tr>
                  <td style="color: #6B7280; font-size: 14px; font-weight: 600;">Threshold</td>
                  <td style="color: #111827; font-size: 14px; text-align: right;">
                    ${payload.threshold}${payload.metric === 'OFFLINE' ? ' min' : '%'}
                  </td>
                </tr>
              </table>
              
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://app.glanus.com'}" 
                       style="display: inline-block; background-color: ${color}; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px;">
                      View in Dashboard
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background-color: #f9fafb; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px 0; color: #6B7280; font-size: 12px;">
                This is an automated alert from Glanus RMM
              </p>
              <p style="margin: 0; color: #9CA3AF; font-size: 12px;">
                © ${new Date().getFullYear()} Glanus. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  /**
   * Get workspace admin emails
   */
  async getWorkspaceAdminEmails(workspaceId: string): Promise<string[]> {
    const { prisma } = await import('@/lib/db');

    const [members, workspace] = await Promise.all([
      prisma.workspaceMember.findMany({
        where: {
          workspaceId,
          role: {
            in: ['OWNER', 'ADMIN'],
          },
        },
        include: {
          user: {
            select: {
              email: true,
            },
          },
        },
      }),
      prisma.workspace.findUnique({
        where: { id: workspaceId },
        include: {
          owner: { select: { email: true } },
        },
      }),
    ]);

    const emails = members.map((m) => m.user.email).filter(Boolean);
    if (workspace?.owner?.email && !emails.includes(workspace.owner.email)) {
      emails.unshift(workspace.owner.email);
    }
    return emails;
  }
}

export const emailService = new EmailService();
