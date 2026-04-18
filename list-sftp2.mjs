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

// List TechFeed directory recursively
async function listDir(path, indent = '') {
  try {
    const files = await sftp.list(path);
    for (const f of files) {
      const size = f.size > 1024*1024 ? `${(f.size/1024/1024).toFixed(1)} MB` : `${(f.size/1024).toFixed(0)} KB`;
      console.log(`${indent}${f.type === 'd' ? '📁' : '📄'} ${f.name} (${size})`);
      if (f.type === 'd') {
        await listDir(path + '/' + f.name, indent + '  ');
      }
    }
  } catch (e) {
    console.log(`${indent}⚠️ Error: ${e.message}`);
  }
}

console.log('TechFeed directory:');
await listDir('/TechFeed');

console.log('\n\nCommonFeed directory:');
await listDir('/CommonFeed');

console.log('\n\nWareHouseFeed directory:');
await listDir('/WareHouseFeed');

await sftp.end();
console.log('\n\nDone.');
