import pg from 'pg';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function sendTestEmail() {
  const { rows } = await pool.query("SELECT value FROM admin_settings WHERE key = 'email'");
  
  if (rows.length === 0) {
    console.log('No email settings found');
    return;
  }
  
  const settings = rows[0].value;
  console.log('SMTP Config:');
  console.log('  Host:', settings.smtpHost);
  console.log('  Port:', settings.smtpPort);
  console.log('  User:', settings.smtpUser);
  console.log('  From:', settings.fromEmail);
  console.log('  To:', settings.notifyEmail);
  console.log('');
  
  const transporter = nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: false,
    auth: {
      user: settings.smtpUser,
      pass: settings.smtpPass,
    },
    requireTLS: true,
    tls: {
      ciphers: 'SSLv3',
      rejectUnauthorized: false,
    },
  });
  
  console.log('Sending test email...');
  
  try {
    const result = await transporter.sendMail({
      from: `"Warehouse Tire Direct" <${settings.fromEmail}>`,
      to: settings.notifyEmail,
      subject: '✅ Test Email - Office 365 SMTP Working',
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>✅ Email Configuration Working</h2>
          <p>This is a test email from Warehouse Tire Direct.</p>
          <p>Your Office 365 SMTP settings are configured correctly!</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">
            Sent from: ${settings.fromEmail}<br>
            SMTP: ${settings.smtpHost}:${settings.smtpPort}
          </p>
        </div>
      `,
      text: 'Test email - Office 365 SMTP is working correctly!',
    });
    
    console.log('✅ Email sent successfully!');
    console.log('Message ID:', result.messageId);
  } catch (err) {
    console.error('❌ Failed to send email:');
    console.error(err.message);
    if (err.response) {
      console.error('Server response:', err.response);
    }
  }
  
  await pool.end();
}

sendTestEmail();
