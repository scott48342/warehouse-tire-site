import Client from 'ssh2-sftp-client';

const sftp = new Client();

const SFTP_CONFIG = {
  host: 'sftp.wheelpros.com',
  port: 22,
  username: 'Warehouse1',
  password: process.env.WHEELPROS_SFTP_PASS || 'Websters1!',
};

await sftp.connect(SFTP_CONFIG);
console.log('Connected to WheelPros SFTP\n');

// List root directory
const root = await sftp.list('/');
console.log('Root directory:');
root.forEach(f => console.log(`  ${f.type === 'd' ? '📁' : '📄'} ${f.name} (${f.size} bytes)`));

// Look for accessory/suspension related files
console.log('\n\nSearching for suspension/accessory files...');
for (const dir of root.filter(f => f.type === 'd')) {
  try {
    const files = await sftp.list('/' + dir.name);
    const relevant = files.filter(f => 
      f.name.toLowerCase().includes('access') ||
      f.name.toLowerCase().includes('suspension') ||
      f.name.toLowerCase().includes('fitment') ||
      f.name.toLowerCase().includes('ymm') ||
      f.name.toLowerCase().includes('vehicle')
    );
    if (relevant.length > 0) {
      console.log(`\n📁 /${dir.name}:`);
      relevant.forEach(f => console.log(`   📄 ${f.name} (${(f.size/1024).toFixed(0)} KB)`));
    }
  } catch (e) {
    // ignore permission errors
  }
}

await sftp.end();
console.log('\n\nDone.');
