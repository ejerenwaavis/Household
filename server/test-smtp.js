import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function testSMTP() {
  try {
    console.log('🔍 SMTP Connection Test\n');
    
    // Check environment
    console.log('Environment Variables:');
    console.log('EMAIL_PROVIDER:', process.env.EMAIL_PROVIDER);
    console.log('SMTP_HOST:', process.env.SMTP_HOST);
    console.log('SMTP_PORT:', process.env.SMTP_PORT, '(type:', typeof process.env.SMTP_PORT + ')');
    console.log('SMTP_SECURE:', process.env.SMTP_SECURE, '(type:', typeof process.env.SMTP_SECURE + ')');
    console.log('');

    // Import nodemailer directly
    import('nodemailer').then(async (nmModule) => {
      const nodemailer = nmModule.default;
      
      console.log('Creating transporter with settings:');
      const config = {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      };
      
      console.log('- Host:', config.host);
      console.log('- Port:', config.port, '(type:', typeof config.port + ')');
      console.log('- Secure:', config.secure, '(type:', typeof config.secure + ')');
      console.log('- User:', config.auth.user);
      console.log('- Pass:', config.auth.pass ? '***' : 'EMPTY');
      console.log('');

      console.log('Testing connection...');
      const transporter = nodemailer.createTransport(config);
      
      const verified = await transporter.verify();
      if (verified) {
        console.log('✅ SMTP connection successful!');
        console.log('');
        console.log('Now resending invite email...');
        
        // Get pending invite from DB
        await mongoose.connect(process.env.MONGO_URI);
        
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
        const pending = await HouseholdInvite.findOne({ status: 'pending' });
        
        if (pending) {
          const link = `${process.env.FRONTEND_URL}/invite/${pending.inviteToken}`;
          
          const result = await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: pending.email,
            subject: `${pending.invitedByName} invited you to join "${pending.householdName}"`,
            text: `You've been invited to join ${pending.householdName}. Click here: ${link}`,
            html: `<h2>Invitation</h2><p>You've been invited to join <strong>${pending.householdName}</strong></p><p><a href="${link}">Accept Invitation</a></p>`,
          });
          
          console.log('✅ EMAIL SENT SUCCESSFULLY!');
          console.log('Message ID:', result.messageId);
          console.log('To:', pending.email);
          console.log('Subject:', `${pending.invitedByName} invited you to join "${pending.householdName}"`);
        }
        
        await mongoose.connection.close();
      } else {
        console.log('❌ SMTP connection failed');
      }
    }).catch(error => {
      console.error('❌ Error:', error.message);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testSMTP();
