import mongoose from 'mongoose';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

async function diagnosticCheck() {
  try {
    console.log('🔍 Email Configuration Diagnostic\n');
    console.log('Current Settings:');
    console.log('- EMAIL_PROVIDER:', process.env.EMAIL_PROVIDER || 'NOT SET (defaults to smtp)');
    console.log('- SMTP_HOST:', process.env.SMTP_HOST || 'NOT SET');
    console.log('- SMTP_PORT:', process.env.SMTP_PORT || 'NOT SET (defaults to 587)');
    console.log('- SMTP_SECURE:', process.env.SMTP_SECURE || 'NOT SET (defaults to false)');
    console.log('- SMTP_USER:', process.env.SMTP_USER ? '***configured***' : 'NOT SET');
    console.log('- SMTP_PASSWORD:', process.env.SMTP_PASSWORD ? '***configured***' : 'NOT SET');
    console.log('- FRONTEND_URL:', process.env.FRONTEND_URL);
    console.log('');

    // Check if email provider is configured
    if (!process.env.EMAIL_PROVIDER && (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD)) {
      if (!process.env.GMAIL_EMAIL && !process.env.SENDGRID_API_KEY) {
        console.log('⚠️  EMAIL NOT CONFIGURED');
        console.log('Set EMAIL_PROVIDER in .env and add required credentials\n');
      }
    }

    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected\n');

    // Import models
    const HouseholdInviteSchema = new mongoose.Schema({
      householdId: String,
      householdName: String,
      email: String,
      invitedBy: String,
      invitedByName: String,
      inviteToken: String,
      status: String,
      expiresAt: Date,
      createdAt: { type: Date, default: Date.now }
    });

    const HouseholdInvite = mongoose.model('HouseholdInvite', HouseholdInviteSchema);

    // Find pending invites
    console.log('🔎 Searching for pending invites...\n');
    const pendingInvites = await HouseholdInvite.find({ status: 'pending' }).limit(5);

    if (pendingInvites.length === 0) {
      console.log('❌ No pending invites found in database');
      console.log('   Create an invite first via: POST /api/households/{householdId}/invite');
      await mongoose.connection.close();
      process.exit(1);
    }

    console.log(`✅ Found ${pendingInvites.length} pending invite(s):\n`);
    pendingInvites.forEach((invite, idx) => {
      console.log(`${idx + 1}. Email: ${invite.email}`);
      console.log(`   Household: ${invite.householdName}`);
      console.log(`   Inviter: ${invite.invitedByName}`);
      console.log(`   Token: ${invite.inviteToken.substring(0, 10)}...`);
      console.log(`   Expires: ${invite.expiresAt}`);
      console.log('');
    });

    // Test email with first pending invite
    const testInvite = pendingInvites[0];
    console.log('📧 Testing email send with first pending invite...\n');
    
    // Create fresh transporter (not cached)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const inviteLink = `${frontendUrl}/invite/${testInvite.inviteToken}`;

    const result = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: testInvite.email,
      subject: `${testInvite.invitedByName} invited you to join "${testInvite.householdName}"`,
      text: `You've been invited to join ${testInvite.householdName}. Here's your invite link:\n\n${inviteLink}`,
      html: `<h2>You're invited!</h2><p><strong>${testInvite.invitedByName}</strong> invited you to join <strong>${testInvite.householdName}</strong></p><p><a href="${inviteLink}" style="background:#667eea;color:white;padding:10px 20px;border-radius:4px;text-decoration:none">Accept Invitation</a></p>`,
    });

    console.log('✅ EMAIL SENT SUCCESSFULLY!');
    console.log(`   To: ${testInvite.email}`);
    console.log(`   Subject: ${testInvite.invitedByName} invited you to join "${testInvite.householdName}"`);
    console.log(`   Message ID: ${result.messageId}`);

    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('   Cannot connect to MongoDB. Is it running?');
    }
    process.exit(1);
  }
}

diagnosticCheck();
