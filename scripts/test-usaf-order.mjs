/**
 * Test US AutoForce order placement
 * 
 * Run: node scripts/test-usaf-order.mjs
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env.local
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Dynamic import after env is loaded
const { placeOrder, serviceCheck } = await import('../src/lib/usautoforce/client.js');

async function testOrder() {
  console.log('\n=== US AutoForce Order Test ===\n');
  
  // Step 1: Check connection
  console.log('1. Testing connection...');
  const checkResult = await serviceCheck();
  console.log('   Connection:', checkResult.success ? '✅ OK' : '❌ FAILED');
  console.log('   Message:', checkResult.errorMessage);
  
  if (!checkResult.success) {
    console.log('\n❌ Cannot proceed - connection failed');
    return;
  }
  
  // Step 2: Place test order
  console.log('\n2. Placing test order...');
  
  const testOrder = {
    purchaseOrderNumber: `TEST-${Date.now()}`,
    items: [
      {
        partNumber: '356260',  // Toyo Open Country A/T III
        quantity: 4,
      }
    ],
    shipTo: {
      name: 'Test Customer',
      address1: '123 Test Street',
      city: 'Appleton',
      state: 'WI',
      zip: '54913',
      phone: '555-555-5555',
    },
    notes: 'TEST ORDER - DO NOT SHIP',
  };
  
  console.log('   Order:', JSON.stringify(testOrder, null, 2));
  
  const result = await placeOrder(testOrder);
  
  console.log('\n3. Result:');
  console.log('   Success:', result.success ? '✅' : '❌');
  console.log('   Order Number:', result.orderNumber || 'N/A');
  console.log('   Error:', result.errorMessage || 'None');
  
  if (result.success) {
    console.log('\n✅ TEST ORDER PLACED SUCCESSFULLY');
    console.log('   ⚠️  This was a TEST order - it should not ship');
    console.log('   Order Number:', result.orderNumber);
  } else {
    console.log('\n❌ Order failed:', result.errorMessage);
  }
}

testOrder().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
