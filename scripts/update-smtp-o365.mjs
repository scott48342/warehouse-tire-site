import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

// Get password from command line arg
const newPassword = process.argv[2];

async function updateSMTP() {
  const { rows } = await pool.query("SELECT value FROM admin_settings WHERE key = 'email'");
  
  if (rows.length > 0) {
    const current = rows[0].value;
    console.log('Current SMTP:', current.smtpHost, ':', current.smtpPort);
    console.log('Current User:', current.smtpUser);
    
    const updated = {
      ...current,
      smtpHost: 'smtp.office365.com',
      smtpPort: 587,
      smtpUser: 'scott@warehousetire.net',
      fromEmail: 'scott@warehousetire.net',
    };
    
    // Only update password if provided
    if (newPassword) {
      updated.smtpPass = newPassword;
      console.log('Password: [provided]');
    } else {
      console.log('Password: [keeping existing - provide as argument to update]');
    }
    
    await pool.query(
      "UPDATE admin_settings SET value = $1, updated_at = NOW() WHERE key = 'email'",
      [JSON.stringify(updated)]
    );
    
    // Verify
    const { rows: verify } = await pool.query("SELECT value FROM admin_settings WHERE key = 'email'");
    const v = verify[0]?.value;
    console.log('\n✓ Updated SMTP settings:');
    console.log('  Host:', v.smtpHost);
    console.log('  Port:', v.smtpPort);
    console.log('  User:', v.smtpUser);
    console.log('  From:', v.fromEmail);
  }
  
  await pool.end();
}

updateSMTP().catch(e => { console.error(e); process.exit(1); });
