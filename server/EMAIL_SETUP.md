# Email Notifications Setup Guide

The email notification service has been integrated to automatically send invite links to invited household members and welcome emails when they join.

## Configuration

Email can be configured using one of three providers. Set the `EMAIL_PROVIDER` environment variable to choose which one to use.

### Option 1: SMTP (Recommended for Production)

**Why SMTP?**
- ✅ Zero cost - use your own mail server or hosting provider
- ✅ Full control with SSL/TLS encryption
- ✅ No third-party dependencies or quotas
- ✅ Perfect for self-hosted deployments
- ✅ Enterprise-grade security

**Setup Options:**

#### A) Self-Hosted Mail Server (Postfix, Sendmail, etc.)
If you have your own mail server:
```bash
EMAIL_PROVIDER=smtp
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@yourdomain.com
SMTP_PASSWORD=your-mail-server-password
EMAIL_FROM=noreply@yourdomain.com
FRONTEND_URL=https://yourdomain.com
```

#### B) Mail Hosting Provider (Includes SMTP Relay)
Many hosting providers include SMTP relay:
- Bluehost, GoDaddy, NameCheap (with hosting plans)
- Linode, DigitalOcean (mail server templates)
- Amazon SES (free tier: 62,000 emails/month)

Get SMTP credentials from your provider's control panel:
```bash
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.yourhostingprovider.com  # Check provider docs
SMTP_PORT=587 or 465                    # Usually 587 for TLS
SMTP_SECURE=false or true               # false for 587, true for 465
SMTP_USER=your-mail-username
SMTP_PASSWORD=your-mail-password
EMAIL_FROM=noreply@yourdomain.com
FRONTEND_URL=https://yourdomain.com
```

#### C) Amazon SES (Free Tier)
Amazon SES offers 62,000 free emails/month:
```bash
EMAIL_PROVIDER=smtp
SMTP_HOST=email-smtp.region.amazonaws.com  # e.g., us-east-1
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-SES-SMTP-username
SMTP_PASSWORD=your-SES-SMTP-password
EMAIL_FROM=noreply@yourdomain.com
FRONTEND_URL=https://yourdomain.com
```

**SSL/TLS Configuration Explained:**
- `SMTP_PORT=587` with `SMTP_SECURE=false` → STARTTLS (recommended, widely supported)
- `SMTP_PORT=465` with `SMTP_SECURE=true` → SMTPS (legacy but secure)
- `SMTP_PORT=25` → Usually unencrypted, not recommended for production

### Option 2: Gmail (Development Only)

**⚠️ Note:** Gmail limits free tier to 100 emails/day. Use SMTP for production.

**Setup Steps:**
1. Go to [Google Account Security Settings](https://myaccount.google.com/security)
2. Enable 2-Step Verification
3. Generate an [App Password](https://myaccount.google.com/apppasswords) (select Mail and Windows Computer)
4. Copy the 16-character app password

**Environment Variables:**
```bash
EMAIL_PROVIDER=gmail
GMAIL_EMAIL=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-char-app-password
EMAIL_FROM=your-email@gmail.com
FRONTEND_URL=http://localhost:3000
```

### Option 3: SendGrid (Optional - If Free Tier Sufficient)

**⚠️ Note:** Free tier limited to 100 emails/day, paid plans start at $20/month.

**Setup Steps:**
1. Create a [SendGrid account](https://sendgrid.com/)
2. Verify a Sender Email address
3. Create an API key in Settings → API Keys
4. Copy the API key

**Environment Variables:**
```bash
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.your-api-key-here
EMAIL_FROM=noreply@yourdomain.com
FRONTEND_URL=https://yourdomain.com
```

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `EMAIL_PROVIDER` | No | `smtp` (production), `gmail` (dev only), or `sendgrid` (optional) |
| `FRONTEND_URL` | No | URL for invite links (default: `http://localhost:3000`) |
| `EMAIL_FROM` | No | From address for emails (recommended: noreply@yourdomain.com) |
| **SMTP Variables** | | |
| `SMTP_HOST` | Yes if `smtp` | SMTP server hostname (e.g., mail.yourdomain.com or Amazon SES) |
| `SMTP_PORT` | Yes if `smtp` | SMTP server port (587 for STARTTLS, 465 for SMTPS) |
| `SMTP_SECURE` | Yes if `smtp` | Set to `false` for port 587 (STARTTLS), `true` for 465 (SMTPS) |
| `SMTP_USER` | Yes if `smtp` | SMTP authentication username/email |
| `SMTP_PASSWORD` | Yes if `smtp` | SMTP authentication password |
| **Gmail Variables** | | |
| `GMAIL_EMAIL` | Yes if `gmail` | Gmail address for sending (dev only) |
| `GMAIL_APP_PASSWORD` | Yes if `gmail` | Gmail app-specific password (NOT account password) |
| **SendGrid Variables** | | |
| `SENDGRID_API_KEY` | Yes if `sendgrid` | SendGrid API key (free tier: 100/day limit) |

## Example .env Configurations

### Production (SMTP with Self-Hosted Mail)
```bash
# Email Configuration
EMAIL_PROVIDER=smtp
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@yourdomain.com
SMTP_PASSWORD=your-mail-server-password
EMAIL_FROM=noreply@yourdomain.com

# Frontend URL for invite links
FRONTEND_URL=https://yourdomain.com

# Database
MONGO_URI=mongodb://your-production-mongodb
JWT_SECRET=your-long-secret-key
NODE_ENV=production
```

### Development (Gmail with 100 emails/day)
```bash
# Email Configuration
EMAIL_PROVIDER=gmail
GMAIL_EMAIL=your-development-email@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
EMAIL_FROM=your-development-email@gmail.com

# Frontend URL for invite links
FRONTEND_URL=http://localhost:3000

# Database
MONGO_URI=mongodb://localhost:27017/household
JWT_SECRET=your-jwt-secret
NODE_ENV=development
```

### Local Testing (No Email)
```bash
# Email disabled - invites still work, emails just won't send
# (Remove EMAIL_PROVIDER or comment it out)

FRONTEND_URL=http://localhost:3000
MONGO_URI=mongodb://localhost:27017/household
JWT_SECRET=your-jwt-secret
NODE_ENV=development
```

## Testing Email Configuration

To test your email setup, use the development endpoint:

```bash
POST /api/dev/test-email
Content-Type: application/json

{
  "testEmail": "test@example.com"
}
```

## How It Works

### Invite Email Flow
1. Head of household sends invite via `/api/households/:householdId/invite`
2. System creates HouseholdInvite record with token
3. **Email is automatically sent** to invited person with:
   - Personalized greeting from inviter
   - Clickable accept button
   - Full invite link for manual copying
   - 30-day expiration notice

### Welcome Email Flow
1. Invited person accepts invite via `/api/households/invite/accept/:inviteToken`
2. System adds them to household members
3. **Welcome email is automatically sent** with:
   - Personalized greeting
   - Household name confirmation
   - Link to get started

## Email Templates

Emails are automatically generated with:
- **Professional HTML formatting** with gradient headers
- **Mobile-responsive design**
- **Plain text fallback** for compatibility
- **Clear calls-to-action** with buttons
- **Expiration notices** for invites

## Troubleshooting

### "Email service not configured"
- Check `EMAIL_PROVIDER` is set to `smtp`, `gmail`, or `sendgrid`
- Verify all required environment variables are set
- Restart the server after changing .env

### SMTP: "Connection refused"
- Verify `SMTP_HOST` and `SMTP_PORT` are correct
- Check firewall allows outbound connections to SMTP port (587 or 465)
- Verify `SMTP_SECURE` matches your setup:
  - Use `false` for port 587 (STARTTLS)
  - Use `true` for port 465 (SMTPS)
- Test connection from command line:
  ```bash
  telnet mail.yourdomain.com 587
  # Should show "Trying...", then success message
  ```

### SMTP: "Authentication failed"
- Verify `SMTP_USER` and `SMTP_PASSWORD` credentials
- Check for spaces or typos in credentials
- Confirm mail server user account is enabled
- Some mail servers require full email format: `noreply@yourdomain.com`

### SMTP: "Relaying denied" or "Sender not allowed"
- Mail server may require authentication from specific IP
- Ask your hosting provider about SMTP relay availability
- May need to whitelist your application server's IP

### SMTP: "Emails sent but marked as spam"
- Missing SPF/DKIM/DMARC records (see Production Deployment section)
- Check your domain's DNS records
- Add authentication records to prevent spam filtering

### Gmail: "Bad credentials"
- Verify you're using an **app-specific password**, not your account password
- 2-Step Verification must be enabled
- Check password for typos or extra spaces

### Email not being sent
1. Check server logs for email service errors: `grep -i email logs/server.log`
2. Verify EMAIL_PROVIDER is configured correctly
3. Test with `/api/dev/test-email` endpoint
4. Check spam/junk folder for emails
5. Verify SPF/DKIM/DMARC records if in production

## Disabling Email (Development/Testing)

If you want to run without email configured, the system will log a warning and continue. Emails simply won't be sent. This is useful for local development if you don't want to configure credentials.

## Production Deployment

For production with SMTP:
1. **Setup mail server with strong SSL/TLS encryption**
   - Use TLS on port 587 (STARTTLS) for maximum compatibility
   - Or SMTPS on port 465 if supported by your mail server
2. **Configure all SMTP variables** in production environment
3. **Set `FRONTEND_URL` to your production domain**
4. **Use environment-specific secrets** (never commit .env)
5. **Monitor mail server logs** for delivery issues
6. **Set up SPF, DKIM, DMARC records** for email authentication
   - Prevents emails from being marked as spam
   - Essential for professional appearance
7. **Optional:** Set up monitoring/alerting for mail delivery failures

**SPF/DKIM/DMARC Quick Setup:**
- SPF: Add `v=spf1 mx ~all` to your domain's DNS
- DKIM: Generate keys in your mail server, add public key to DNS
- DMARC: Add `v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com`

These prevent your emails from being flagged as spam by recipients' mail servers.

## Security Notes

- Never commit `.env` files with real credentials
- Use environment-specific secrets management (AWS Secrets Manager, Azure Key Vault, etc.)
- For Gmail: App passwords are safer than account passwords
- For SendGrid: Restricted API keys can be limited to sending only
- Regenerate API keys if compromised

## SMTP Hosting Provider Recommendations

**Free/Low-Cost Options:**
- **Amazon SES** - 62,000 free emails/month, then $0.10 per 1,000
- **Self-Hosted Mail (cost of server/hosting)**
- **Included with Web Hosting** - Check if your provider includes SMTP relay

**Finding Your Mail Server:**
1. Check your hosting control panel (cPanel, Plesk, etc.)
2. Look for "Mail" or "Email" settings
3. SMTP hostname often looks like:
   - `mail.yourdomain.com`
   - `smtp.yourdomain.com`
   - `mailserver.yourhostingprovider.com`
4. Contact support if unsure

## Further Reading

- [Nodemailer SMTP Configuration](https://nodemailer.com/smtp/)
- [SMTP Security (TLS vs SMTPS)](https://nodemailer.com/smtp/#tls-options)
- [Gmail App Passwords](https://support.google.com/accounts/answer/185833)
- [SPF/DKIM Setup Guide](https://mxtoolbox.com/)
- [Amazon SES SMTP Setup](https://docs.aws.amazon.com/ses/latest/dg/send-email-set-up-smtp.html)
