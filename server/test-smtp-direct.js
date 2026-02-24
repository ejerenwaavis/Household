import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { getFrontendURL } from './src/utils/urlHelper.js';

dotenv.config();

console.log('🔍 Direct SMTP Test\n');

console.log('Environment Variables:');
console.log('- EMAIL_PROVIDER:', process.env.EMAIL_PROVIDER);
console.log('- SMTP_HOST:', process.env.SMTP_HOST);
console.log('- SMTP_PORT:', process.env.SMTP_PORT);
console.log('- SMTP_SECURE:', process.env.SMTP_SECURE);
console.log('- SMTP_USER:', process.env.SMTP_USER);
console.log('');

console.log('URL Helper:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- getFrontendURL():', getFrontendURL());
console.log('');

console.log('Creating SMTP transporter with config:');
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
console.log('- Port:', config.port);
console.log('- Secure:', config.secure);
console.log('- User:', config.auth.user);
console.log('');

const transporter = nodemailer.createTransport(config);

console.log('Testing SMTP connection...');
transporter.verify((error, success) => {
  if (error) {
    console.log('❌ SMTP verification failed:', error.message);
  } else {
    console.log('✅ SMTP connection verified!');
    console.log('  Ready to send emails via:', config.host);
  }
});
