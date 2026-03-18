import nodemailer from 'nodemailer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getFrontendURL } from '../utils/urlHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure email transporter
let transporter;

const initializeEmailService = () => {
  // Production: Use SMTP (zero cost, full control)
  // Development: Gmail is convenient (free, 100 emails/day)
  // Optional: SendGrid (free tier: 100 emails/day, then paid)
  const emailProvider = process.env.EMAIL_PROVIDER || 'smtp';
  
  console.log('[email service] Initializing with EMAIL_PROVIDER:', emailProvider);
  
  if (emailProvider === 'smtp') {
    // SMTP configuration (recommended for production)
    // Works with: self-hosted mail servers, hosting providers, Amazon SES, etc.
    console.log('[email service] Configuring SMTP...');
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465', // true for 465 (SMTPS), false for 587 (STARTTLS)
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
    console.log('[email service] SMTP transporter created:', { 
      host: process.env.SMTP_HOST, 
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER ? '***' : 'NOT SET'
    });
  } else if (emailProvider === 'gmail') {
    // Gmail configuration (development only - limited to 100 emails/day)
    console.log('[email service] Configuring Gmail...');
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_EMAIL,
        pass: process.env.GMAIL_APP_PASSWORD, // Use app-specific password, not regular password
      },
    });
  } else if (emailProvider === 'sendgrid') {
    // SendGrid configuration
    console.log('[email service] Configuring SendGrid...');
    transporter = nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY,
      },
    });
  }

  if (!transporter) {
    console.warn('[email service] Email service NOT configured. Email notifications disabled.');
  } else {
    console.log('[email service] Email service initialized successfully.');
  }
};

// Initialize on module load
initializeEmailService();

/**
 * Generate household invite email HTML
 */
const generateInviteEmailHTML = (inviteLink, householdName, inviterName, isExistingUser = false) => {
  const actionText = isExistingUser 
    ? 'Log in to accept the invitation' 
    : 'Create your account and join';
  
  const explanationText = isExistingUser
    ? `You already have an account with us. Log in and accept the invitation to join <strong>${householdName}</strong>.`
    : `Create a new account to join <strong>${householdName}</strong> and start managing your household budget.`;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .invite-box { background: white; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 4px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; border-radius: 4px; text-decoration: none; margin: 20px 0; font-weight: bold; }
          .button:hover { background: #764ba2; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; }
          .link-block { background: #f0f0f0; padding: 15px; border-radius: 4px; word-break: break-all; font-family: monospace; font-size: 12px; margin: 15px 0; }
          .badge { display: inline-block; background: #667eea; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; margin-left: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>You're Invited! 👋</h1>
            ${isExistingUser ? '<p style="font-size: 14px;">Log in to accept this invitation</p>' : '<p style="font-size: 14px;">Create your account to join</p>'}
          </div>
          <div class="content">
            <p>Hi there,</p>
            <p><strong>${inviterName}</strong> has invited you to join <strong>${householdName}</strong> <span class="badge">${isExistingUser ? 'EXISTING USER' : 'NEW USER'}</span></p>
            
            <div class="invite-box">
              <p><strong>What's next?</strong></p>
              <p>${explanationText}</p>
              <center>
                <a href="${inviteLink}" class="button">${actionText}</a>
              </center>
            </div>

            <p><strong>Or copy this link:</strong></p>
            <div class="link-block">${inviteLink}</div>

            <p style="color: #666; font-size: 13px;">
              <strong>Note:</strong> This invitation will expire in 30 days. Make sure to accept it before then.
            </p>

            <p>If you didn't expect this invitation or have questions, you can safely ignore this email.</p>

            <p>Best regards,<br/>The Household Team</p>

            <div class="footer">
              <p>This is an automated message. Please don't reply to this email.</p>
              <p>&copy; 2026 Household Budget Manager. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
};

/**
 * Generate household invite email plain text
 */
const generateInviteEmailText = (inviteLink, householdName, inviterName, isExistingUser = false) => {
  const action = isExistingUser ? 'log in' : 'create your account';
  const instruction = isExistingUser 
    ? `${inviterName} has invited you to join ${householdName}. Log in to accept the invitation.`
    : `${inviterName} has invited you to join ${householdName}. Create your account to accept the invitation.`;

  return `
You're Invited to Join ${householdName}!

Hi there,

${instruction}

${isExistingUser ? 'LOG IN AND ACCEPT:' : 'CREATE YOUR ACCOUNT:'}
${inviteLink}

This invitation will expire in 30 days.

If you didn't expect this invitation, you can safely ignore this email.

---
This is an automated message. Please don't reply to this email.
© 2026 Household Budget Manager. All rights reserved.
  `.trim();
};

/**
 * Send household invite email
 */
export const sendInviteEmail = async (email, householdName, inviterName, inviteToken, isExistingUser = false) => {
  if (!transporter) {
    console.warn('Email service not configured. Skipping email send for:', email);
    return false;
  }

  try {
    // Get dynamic frontend URL (uses local IP in development)
    const frontendUrl = getFrontendURL();
    
    // Route based on whether user already has account
    const inviteLink = isExistingUser 
      ? `${frontendUrl}/login?inviteToken=${inviteToken}`  // Existing user - go to login
      : `${frontendUrl}/register/${inviteToken}`; // New user - go to register with token

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.GMAIL_EMAIL || 'noreply@household.local',
      to: email,
      subject: `${inviterName} invited you to join "${householdName}"`,
      text: generateInviteEmailText(inviteLink, householdName, inviterName, isExistingUser),
      html: generateInviteEmailHTML(inviteLink, householdName, inviterName, isExistingUser),
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('[email service] Invite email sent successfully:', { email, messageId: result.messageId, inviteLink, isExistingUser });
    return true;
  } catch (error) {
    console.error('[email service] Failed to send invite email:', { email, error: error.message });
    return false;
  }
};

/**
 * Send welcome email to new member
 */
export const sendWelcomeEmail = async (email, memberName, householdName) => {
  if (!transporter) {
    console.warn('Email service not configured. Skipping email send for:', email);
    return false;
  }

  try {
    // Get dynamic frontend URL (uses local IP in development)
    const frontendUrl = getFrontendURL();

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.GMAIL_EMAIL || 'noreply@household.local',
      to: email,
      subject: `Welcome to ${householdName}! 🎉`,
      text: `
Welcome to ${householdName}, ${memberName}!

You've successfully joined the household. You can now start managing your budget together.

Get started: ${frontendUrl}

Best regards,
The Household Team
      `.trim(),
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; border-radius: 4px; text-decoration: none; margin: 20px 0; font-weight: bold; }
              .button:hover { background: #764ba2; }
              .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome, ${memberName}! 🎉</h1>
              </div>
              <div class="content">
                <p>You've successfully joined <strong>${householdName}</strong>!</p>
                <p>You can now start managing your household budget together with your family members.</p>
                <center>
                  <a href="${frontendUrl}" class="button">Get Started</a>
                </center>
                <p style="color: #666; font-size: 13px;">
                  If you have any questions, feel free to reach out to your household members.
                </p>
                <p>Best regards,<br/>The Household Team</p>
                <div class="footer">
                  <p>This is an automated message. Please don't reply to this email.</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('[email service] Welcome email sent successfully:', { email, messageId: result.messageId, link: frontendUrl });
    return true;
  } catch (error) {
    console.error('[email service] Failed to send welcome email:', { email, error: error.message });
    return false;
  }
};

/**
 * Test email configuration
 */
export const testEmailConfiguration = async (testEmail) => {
  if (!transporter) {
    return { success: false, message: 'Email service not configured' };
  }

  try {
    const result = await transporter.verify();
    if (result) {
      // Try sending a test email
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.GMAIL_EMAIL || 'noreply@household.local',
        to: testEmail,
        subject: 'Household Email Configuration Test',
        text: 'If you received this email, your email configuration is working correctly!',
      });
      return { success: true, message: 'Email configuration test passed' };
    } else {
      return { success: false, message: 'Email transporter verification failed' };
    }
  } catch (error) {
    return { success: false, message: error.message };
  }
};

export default {
  sendInviteEmail,
  sendWelcomeEmail,
  testEmailConfiguration,
  sendVerificationEmail,
};

/**
 * Send email address verification email.
 * @param {string} email
 * @param {string} name
 * @param {string} token  — raw hex token (not hashed)
 */
export async function sendVerificationEmail(email, name, token) {
  if (!transporter) {
    console.warn('[email service] Not configured — skipping verification email for:', email);
    return false;
  }

  try {
    const frontendUrl = getFrontendURL();
    const link = `${frontendUrl}/verify-email/${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 14px 36px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px; margin: 20px 0; }
            .footer { text-align: center; color: #888; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; }
            .link-block { background: #f0f0f0; padding: 12px; border-radius: 4px; word-break: break-all; font-family: monospace; font-size: 12px; margin: 15px 0; color: #555; }
            .warning { background: #fff8e1; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; font-size: 13px; color: #92400e; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin:0">Verify Your Email ✉️</h1>
            </div>
            <div class="content">
              <p>Hi <strong>${name}</strong>,</p>
              <p>Thanks for creating your Household account. Please verify your email address to keep your account active.</p>
              <center>
                <a href="${link}" class="button">Verify My Email</a>
              </center>
              <p style="font-size:13px; color:#666;">Button not working? Copy and paste this link into your browser:</p>
              <div class="link-block">${link}</div>
              <div class="warning">
                ⚠️ <strong>Important:</strong> If you don't verify within <strong>7 days</strong>, your account will be frozen until verified.
              </div>
              <p style="color:#666; font-size:13px; margin-top:20px;">
                If you didn't create this account, you can safely ignore this email.
              </p>
            </div>
            <div class="footer">
              <p>This is an automated message. Please don't reply to this email.</p>
              <p>© ${new Date().getFullYear()} Household Budget Manager. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Hi ${name},

Please verify your email address to keep your Household account active.

Verification link: ${link}

IMPORTANT: If you don't verify within 7 days, your account will be frozen until verified.

If you didn't create this account, you can safely ignore this email.
    `.trim();

    const result = await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@household.local',
      to: email,
      subject: 'Verify your Household email address',
      text,
      html,
    });

    console.log('[email service] Verification email sent:', { email, messageId: result.messageId });
    return true;
  } catch (err) {
    console.error('[email service] Failed to send verification email:', { email, error: err.message });
    return false;
  }
}

/**
 * Send a budget alert email to all household members.
 * @param {string[]} emails
 * @param {{ householdName, category, spent, budget, percent, status }} data
 */
export async function sendBudgetAlertEmail(emails, { householdName, category, spent, budget, percent, status }) {
  if (!transporter) {
    console.warn('[email service] Not configured — skipping budget alert');
    return false;
  }

  const isExceeded = status === 'exceeded';
  const color      = isExceeded ? '#ef4444' : '#f59e0b';
  const label      = isExceeded ? 'BUDGET EXCEEDED' : 'BUDGET WARNING';
  const subject    = isExceeded
    ? `\u26a0\ufe0f Budget Exceeded: ${category} — ${householdName}`
    : `\u26a0\ufe0f Budget Warning: ${category} at ${percent}% — ${householdName}`;

  const frontendUrl = process.env.FRONTEND_URL || 'https://household.aceddivision.com';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f8fafc; margin:0; padding:0; }
    .container { max-width:560px; margin:40px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,.08); }
    .header { background:${color}; padding:28px 32px; }
    .header h1 { color:#fff; margin:0; font-size:20px; font-weight:700; }
    .body { padding:32px; }
    .stat-row { display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid #f1f5f9; }
    .stat-label { color:#64748b; font-size:14px; }
    .stat-value { font-weight:600; font-size:16px; color:#0f172a; }
    .bar-bg { background:#f1f5f9; border-radius:8px; height:12px; margin:18px 0; overflow:hidden; }
    .bar-fill { height:100%; border-radius:8px; background:${color}; width:${Math.min(percent, 100)}%; transition:width .4s; }
    .percent { text-align:center; font-size:28px; font-weight:800; color:${color}; margin:8px 0 4px; }
    .cta { display:block; text-align:center; margin:24px 0 0; background:#6366f1; color:#fff; padding:13px 24px; border-radius:8px; text-decoration:none; font-weight:600; font-size:15px; }
    .footer { text-align:center; padding:18px 32px; color:#94a3b8; font-size:12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${label}: ${category}</h1>
    </div>
    <div class="body">
      <p style="color:#475569;margin:0 0 20px;">
        ${isExceeded
          ? `Your <strong>${householdName}</strong> household has <strong>exceeded</strong> the budget for <strong>${category}</strong> this month.`
          : `Your <strong>${householdName}</strong> household is approaching the budget limit for <strong>${category}</strong> this month.`
        }
      </p>
      <div class="percent">${percent}%</div>
      <div class="bar-bg"><div class="bar-fill"></div></div>
      <div class="stat-row">
        <span class="stat-label">Spent this month</span>
        <span class="stat-value" style="color:${color};">$${spent.toFixed(2)}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Monthly budget</span>
        <span class="stat-value">$${budget.toFixed(2)}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Remaining</span>
        <span class="stat-value" style="color:${spent > budget ? '#ef4444' : '#22c55e'};">
          ${spent > budget ? '-' : ''}$${Math.abs(budget - spent).toFixed(2)}
        </span>
      </div>
      <a href="${frontendUrl}/expenses" class="cta">View Expenses &rarr;</a>
    </div>
    <div class="footer">Household &bull; Budget Alert &bull; ${new Date().toLocaleDateString()}</div>
  </div>
</body>
</html>
  `.trim();

  const text = `${label} — ${category}\n\nSpent: $${spent.toFixed(2)} / Budget: $${budget.toFixed(2)} (${percent}%)\n\nView expenses: ${frontendUrl}/expenses`;

  try {
    for (const email of emails) {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@household.local',
        to: email,
        subject,
        text,
        html,
      });
    }
    console.log('[email service] Budget alert sent to', emails.length, 'recipient(s):', category, percent + '%');
    return true;
  } catch (err) {
    console.error('[email service] Failed to send budget alert:', err.message);
    return false;
  }
}
