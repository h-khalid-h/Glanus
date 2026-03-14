/**
 * Escape HTML special characters to prevent XSS injection in email templates.
 * All user-supplied strings MUST be escaped before interpolation into HTML.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const getInvitationEmailTemplate = (inviterName: string, workspaceName: string, inviteUrl: string) => {
  const eName = escapeHtml(inviterName);
  const eWorkspace = escapeHtml(workspaceName);
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .logo { font-size: 24px; font-weight: bold; color: #2563eb; text-decoration: none; }
    .content { background: #f9fafb; padding: 30px; border-radius: 8px; border: 1px solid #e5e7eb; }
    .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 20px; }
    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <a href="${process.env.NEXTAUTH_URL}" class="logo">Glanus</a>
    </div>
    <div class="content">
      <h2>You've been invited to join ${eWorkspace}</h2>
      <p>Hello,</p>
      <p><strong>${eName}</strong> has invited you to join the <strong>${eWorkspace}</strong> workspace on Glanus.</p>
      <p>Accepting this invitation will give you access to the workspace's assets and resources based on your assigned role.</p>
      <div style="text-align: center;">
        <a href="${inviteUrl}" class="button">Accept Invitation</a>
      </div>
      <p style="margin-top: 30px; font-size: 14px;">Or copy and paste this link into your browser:</p>
      <p style="font-size: 12px; color: #6b7280; word-break: break-all;">${inviteUrl}</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Glanus. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;
};

// ============================================
// Additional Email Templates
// ============================================

const emailWrapper = (content: string) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f3f4f6; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; padding-top: 20px; }
    .logo { font-size: 24px; font-weight: bold; color: #2563eb; text-decoration: none; }
    .content { background: #ffffff; padding: 32px; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .button { display: inline-block; background: #2563eb; color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 16px; }
    .button-secondary { display: inline-block; background: #f3f4f6; color: #374151; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 16px; border: 1px solid #d1d5db; }
    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; padding-bottom: 20px; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; }
    .badge-green { background: #dcfce7; color: #166534; }
    .badge-red { background: #fef2f2; color: #991b1b; }
    .badge-blue { background: #dbeafe; color: #1e40af; }
    .badge-yellow { background: #fefce8; color: #854d0e; }
    h2 { color: #111827; margin-top: 0; }
    p { color: #4b5563; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <a href="${process.env.NEXTAUTH_URL || 'https://glanus.com'}" class="logo">Glanus</a>
    </div>
    ${content}
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Glanus. All rights reserved.</p>
      <p style="margin-top: 8px;"><a href="${process.env.NEXTAUTH_URL || 'https://glanus.com'}" style="color: #6b7280;">Visit Glanus</a></p>
    </div>
  </div>
</body>
</html>
`;

/**
 * Welcome email - sent when user completes onboarding or accepts first invitation
 */
export const getWelcomeEmailTemplate = (userName: string, workspaceName: string) => {
  const eUser = escapeHtml(userName);
  const eWorkspace = escapeHtml(workspaceName);
  return emailWrapper(`
    <div class="content">
      <h2>Welcome to Glanus! 🎉</h2>
      <p>Hi <strong>${eUser}</strong>,</p>
      <p>You're all set! Your workspace <strong>${eWorkspace}</strong> is ready to go.</p>
      <p>Here's what you can do next:</p>
      <ul style="color: #4b5563; padding-left: 20px;">
        <li><strong>Add assets</strong> — Track hardware, software, and licenses</li>
        <li><strong>Invite your team</strong> — Collaborate with role-based access</li>
        <li><strong>Deploy agents</strong> — Monitor devices with real-time RMM</li>
        <li><strong>Set up alerts</strong> — Get notified when things need attention</li>
      </ul>
      <div style="text-align: center;">
        <a href="${process.env.NEXTAUTH_URL}/dashboard" class="button">Go to Dashboard</a>
      </div>
    </div>
  `);
};

/**
 * Member removed email - sent when admin removes a member from workspace
 */
export const getMemberRemovedEmailTemplate = (
  memberName: string,
  workspaceName: string,
  reason?: string
) => {
  const eMember = escapeHtml(memberName);
  const eWorkspace = escapeHtml(workspaceName);
  const eReason = reason ? escapeHtml(reason) : undefined;
  return emailWrapper(`
    <div class="content">
      <h2>You've been removed from ${eWorkspace}</h2>
      <p>Hi <strong>${eMember}</strong>,</p>
      <p>Your access to the <strong>${eWorkspace}</strong> workspace on Glanus has been revoked.</p>
      ${eReason ? `<p><strong>Reason:</strong> ${eReason}</p>` : ''}
      <p>You will no longer be able to access assets, settings, or data within this workspace.</p>
      <p>If you believe this was a mistake, please contact your workspace administrator.</p>
      <div style="text-align: center;">
        <a href="${process.env.NEXTAUTH_URL}/dashboard" class="button-secondary">Go to Dashboard</a>
      </div>
    </div>
  `);
};

/**
 * Role changed email - sent when a member's role is updated
 */
export const getRoleChangedEmailTemplate = (
  memberName: string,
  oldRole: string,
  newRole: string,
  workspaceName: string
) => {
  const eMember = escapeHtml(memberName);
  const eOldRole = escapeHtml(oldRole);
  const eNewRole = escapeHtml(newRole);
  const eWorkspace = escapeHtml(workspaceName);
  return emailWrapper(`
    <div class="content">
      <h2>Your role has been updated</h2>
      <p>Hi <strong>${eMember}</strong>,</p>
      <p>Your role in the <strong>${eWorkspace}</strong> workspace has been changed:</p>
      <div style="text-align: center; margin: 24px 0;">
        <span class="badge badge-yellow">${eOldRole}</span>
        <span style="margin: 0 12px; color: #9ca3af;">→</span>
        <span class="badge badge-blue">${eNewRole}</span>
      </div>
      <p>Your new permissions are effective immediately.</p>
      <div style="text-align: center;">
        <a href="${process.env.NEXTAUTH_URL}/dashboard" class="button">Go to Dashboard</a>
      </div>
    </div>
  `);
};

/**
 * Payment success email - sent when a subscription payment succeeds
 */
export const getPaymentSuccessEmailTemplate = (
  userName: string,
  workspaceName: string,
  planName: string,
  amount: string
) => {
  const eUser = escapeHtml(userName);
  const eWorkspace = escapeHtml(workspaceName);
  const ePlan = escapeHtml(planName);
  const eAmount = escapeHtml(amount);
  return emailWrapper(`
    <div class="content">
      <h2>Payment Received ✅</h2>
      <p>Hi <strong>${eUser}</strong>,</p>
      <p>We've successfully processed your payment for the <strong>${eWorkspace}</strong> workspace.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px 0; color: #6b7280;">Plan</td>
          <td style="padding: 12px 0; text-align: right; font-weight: 600;">${ePlan}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px 0; color: #6b7280;">Amount</td>
          <td style="padding: 12px 0; text-align: right; font-weight: 600;">${eAmount}</td>
        </tr>
        <tr>
          <td style="padding: 12px 0; color: #6b7280;">Status</td>
          <td style="padding: 12px 0; text-align: right;"><span class="badge badge-green">Paid</span></td>
        </tr>
      </table>
      <div style="text-align: center;">
        <a href="${process.env.NEXTAUTH_URL}/dashboard" class="button-secondary">View Billing</a>
      </div>
    </div>
  `);
};

/**
 * Payment failed email - sent when a subscription payment fails
 */
export const getPaymentFailedEmailTemplate = (
  userName: string,
  workspaceName: string,
  amount: string
) => {
  const eUser = escapeHtml(userName);
  const eWorkspace = escapeHtml(workspaceName);
  const eAmount = escapeHtml(amount);
  return emailWrapper(`
    <div class="content">
      <h2>Payment Failed ⚠️</h2>
      <p>Hi <strong>${eUser}</strong>,</p>
      <p>We were unable to process your payment of <strong>${eAmount}</strong> for the <strong>${eWorkspace}</strong> workspace.</p>
      <p>Please update your payment method to avoid service interruption. Your workspace will be downgraded to the Free plan if payment is not resolved within 7 days.</p>
      <div style="text-align: center;">
        <a href="${process.env.NEXTAUTH_URL}/dashboard" class="button">Update Payment Method</a>
      </div>
    </div>
  `);
};

/**
 * Subscription canceled email - sent when subscription is canceled
 */
export const getSubscriptionCanceledEmailTemplate = (
  userName: string,
  workspaceName: string,
  endDate: string
) => {
  const eUser = escapeHtml(userName);
  const eWorkspace = escapeHtml(workspaceName);
  const eEndDate = escapeHtml(endDate);
  return emailWrapper(`
    <div class="content">
      <h2>Subscription Canceled</h2>
      <p>Hi <strong>${eUser}</strong>,</p>
      <p>Your subscription for the <strong>${eWorkspace}</strong> workspace has been canceled.</p>
      <p>You will continue to have access to your current plan features until <strong>${eEndDate}</strong>. After that date, your workspace will be downgraded to the Free plan.</p>
      <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0; color: #854d0e; font-size: 14px;"><strong>Note:</strong> Downgrading to Free may limit your assets to 5, AI credits to 100/month, and storage to 1 GB. Data exceeding these limits will not be deleted but will become read-only.</p>
      </div>
      <div style="text-align: center;">
      </div>
  `);
};

/**
 * Password reset email - sent when user requests a password reset link
 */
export const getPasswordResetEmailTemplate = (resetUrl: string) =>
  emailWrapper(`
    <div class="content">
      <h2>Reset your password</h2>
      <p>We received a request to reset your Glanus password.</p>
      <p>Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
      <div style="text-align: center;">
        <a href="${resetUrl}" class="button">Reset Password</a>
      </div>
      <p style="font-size: 13px; color: #6b7280; margin-top: 24px;">
        If you didn't request a password reset, you can safely ignore this email. Your password will not change.
      </p>
      <p style="font-size: 12px; color: #9ca3af; word-break: break-all;">Or copy this link: ${resetUrl}</p>
    </div>
  `);

