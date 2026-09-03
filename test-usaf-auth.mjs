import * as dotenv from 'dotenv';

// Load production env
dotenv.config({ path: '.env.production' });

console.log('Loaded from .env.production:');
console.log('  Username:', process.env.USAUTOFORCE_USERNAME);
console.log('  Account:', process.env.USAUTOFORCE_ACCOUNT);
console.log('  Password:', process.env.USAUTOFORCE_PASSWORD);
console.log('  Password length:', process.env.USAUTOFORCE_PASSWORD?.length);

const { testConnection, serviceCheck, checkStockBySize } = await import('./src/lib/usautoforce/client.ts');

console.log('\n--- Testing Connection ---');
const test = await testConnection();
console.log(JSON.stringify(test, null, 2));

if (test.serviceCheckResult?.success) {
  console.log('\n--- Stock Check (single size) ---');
  const stock = await checkStockBySize('225/60R16', {
    branch: '4101',
    quantity: 1,
  });
  console.log('Success:', stock.success);
  console.log('Items:', stock.items?.length || 0);
  console.log('Error:', stock.errorMessage || 'none');
}
