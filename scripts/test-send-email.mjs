/**
 * Test sending a recovery email to dustin's cart
 * Run: node scripts/test-send-email.mjs
 */

const cartId = 'mq78w49f-1s645dva';

async function testSend() {
  console.log('Triggering send-email action for cart:', cartId);
  
  const response = await fetch('http://localhost:3001/api/admin/abandoned-carts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'send-email',
      cartId: cartId,
      step: 'first'
    })
  });
  
  const data = await response.json();
  console.log('Response:', JSON.stringify(data, null, 2));
}

testSend().catch(console.error);
