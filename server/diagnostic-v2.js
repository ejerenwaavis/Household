import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { sendInviteEmail } from './src/services/emailService.js';
import { getFrontendURL, getDisplayURL } from './src/utils/urlHelper.js';

dotenv.config();

async function diagnosticCheck() {
  try {
    console.log('🔍 Email Configuration Diagnostic\n');
    console.log('Current Settings:');
    console.log('- EMAIL_PROVIDER:', process.env.EMAIL_PROVIDER || 'NOT SET (defaults to smtp)');
    console.log('- SMTP_HOST:', process.env.SMTP_HOST || 'NOT SET');
    console.log('- SMTP_PORT:', process.env.SMTP_PORT || 'NOT SET (defaults to 587)');
    console.log('- NODE_ENV:', process.env.NODE_ENV);
    console.log('');
    
    // Show URL detection
    console.log('📍 Frontend URL Resolution:');
    console.log('- FRONTEND_URL .env:', process.env.FRONTEND_URL);
    console.log('- getFrontendURL():', getFrontendURL());
    console.log('- getDisplayURL():', getDisplayURL());
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
    
    const emailSent = await sendInviteEmail(
      testInvite.email,
      testInvite.householdName,
      testInvite.invitedByName,
      testInvite.inviteToken
    );

    if (emailSent) {
      const inviteLink = `${getFrontendURL()}/invite/${testInvite.inviteToken}`;
      console.log('✅ EMAIL SENT SUCCESSFULLY!');
      console.log(`   To: ${testInvite.email}`);
      console.log(`   Subject: ${testInvite.invitedByName} invited you to join "${testInvite.householdName}"`);
      console.log(`   Invite Link: ${inviteLink}`);
      console.log(`   Also accessible from: ${getDisplayURL()}/invite/${testInvite.inviteToken.substring(0, 10)}...`);
    } else {
      console.log('❌ EMAIL FAILED TO SEND');
      console.log('   Check your EMAIL_PROVIDER configuration in .env');
      console.log('   See EMAIL_SETUP.md for configuration help');
    }

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
