import nodemailer from 'nodemailer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getFrontendURL } from '../utils/urlHelper.js';
import dotenv from 'dotenv';

// Ensure environment variables are loaded
dotenv.config();

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
};
