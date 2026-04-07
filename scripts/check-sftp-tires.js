/**
 * Check what tire-related feeds exist on WheelPros SFTP
 */
const Client = require('ssh2-sftp-client');
require('dotenv').config({ path: '.env.local' });

const SFTP_CONFIG = {
  host: "sftp.wheelpros.com",
  port: 22,
  username: process.env.WHEELPROS_SFTP_USER || "Warehouse1",
  password: process.env.WHEELPROS_SFTP_PASS || "",
};

async function main() {
  const sftp = new Client();
  
  try {
    console.log('Connecting to SFTP...');
    await sftp.connect(SFTP_CONFIG);
    console.log('Connected!\n');
    
    // Check CommonFeed structure
    console.log('=== /CommonFeed/USD/ ===');
    const usdContents = await sftp.list('/CommonFeed/USD/');
    for (const item of usdContents) {
      console.log(`  ${item.type === 'd' ? '[DIR]' : '[FILE]'} ${item.name}`);
    }
    
    // Check if TIRE folder exists
    console.log('\n=== /CommonFeed/USD/TIRE/ ===');
    try {
      const tireContents = await sftp.list('/CommonFeed/USD/TIRE/');
      for (const item of tireContents) {
        const size = item.size ? `(${(item.size / 1024 / 1024).toFixed(2)} MB)` : '';
        console.log(`  ${item.type === 'd' ? '[DIR]' : '[FILE]'} ${item.name} ${size}`);
      }
    } catch (e) {
      console.log('  TIRE folder does not exist or not accessible');
    }
    
    // Check WHEEL folder for reference
    console.log('\n=== /CommonFeed/USD/WHEEL/ ===');
    const wheelContents = await sftp.list('/CommonFeed/USD/WHEEL/');
    for (const item of wheelContents) {
      const size = item.size ? `(${(item.size / 1024 / 1024).toFixed(2)} MB)` : '';
      console.log(`  ${item.type === 'd' ? '[DIR]' : '[FILE]'} ${item.name} ${size}`);
    }
    
    // Check for any *tire* or *Tire* files anywhere
    console.log('\n=== Looking for tire-related files ===');
    const allUsd = await sftp.list('/CommonFeed/USD/');
    for (const folder of allUsd.filter(f => f.type === 'd')) {
      try {
        const contents = await sftp.list(`/CommonFeed/USD/${folder.name}/`);
        const tireFiles = contents.filter(f => 
          f.name.toLowerCase().includes('tire') || 
          f.name.toLowerCase().includes('inv')
        );
        if (tireFiles.length > 0) {
          console.log(`  ${folder.name}/:`);
          for (const f of tireFiles) {
            const size = f.size ? `(${(f.size / 1024 / 1024).toFixed(2)} MB)` : '';
            console.log(`    ${f.name} ${size}`);
          }
        }
      } catch (e) {
        // Skip folders we can't access
      }
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sftp.end();
  }
}

main();
