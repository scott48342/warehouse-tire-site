import { config } from 'dotenv';
config({ path: '.env.local' });

import Client from 'ssh2-sftp-client';

const sftp = new Client();

async function main() {
  await sftp.connect({
    host: 'sftp.wheelpros.com',
    port: 22,
    username: 'Warehouse1',
    password: process.env.WHEELPROS_SFTP_PASS
  });
  
  console.log('Connected to SFTP!');
  
  // List accessory folder
  console.log('\n=== /TechFeed/ACCESSORIES/ ===');
  const accFiles = await sftp.list('/TechFeed/ACCESSORIES/');
  accFiles.forEach(f => console.log(`  ${f.name} (${(f.size/1024/1024).toFixed(1)}MB)`));
  
  // Check if there's pricing data in accessory files
  console.log('\n=== Sampling Accessory_TechGuide.csv ===');
  const csv = await sftp.get('/TechFeed/ACCESSORIES/Accessory_TechGuide.csv');
  const lines = csv.toString().split('\n').slice(0, 5);
  console.log('Headers:', lines[0]);
  console.log('\nSample row:', lines[1]);
  
  // Check for inventory files
  console.log('\n=== Looking for inventory/pricing files ===');
  const dirs = ['/', '/TechFeed/', '/TechFeed/WHEELS/', '/TechFeed/INVENTORY/'];
  for (const dir of dirs) {
    try {
      const files = await sftp.list(dir);
      const relevant = files.filter(f => 
        f.name.toLowerCase().includes('access') || 
        f.name.toLowerCase().includes('price') ||
        f.name.toLowerCase().includes('invent')
      );
      if (relevant.length > 0) {
        console.log(`\n${dir}:`);
        relevant.forEach(f => console.log(`  ${f.name} (${(f.size/1024/1024).toFixed(1)}MB)`));
      }
    } catch (e) {
      // Directory doesn't exist
    }
  }
  
  await sftp.end();
}

main().catch(e => console.error('Error:', e.message));
