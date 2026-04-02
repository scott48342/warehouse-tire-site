#!/usr/bin/env node
require('dotenv').config({path: '.env.local'});

const apiKey = process.env.KM_API_KEY || process.env.KMTIRE_API_KEY || '';
console.log('API Key length:', apiKey.length);

async function test() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<InventoryRequest>
<Credentials><APIKey>${apiKey}</APIKey></Credentials>
<Item><TireSize>2656518</TireSize></Item>
</InventoryRequest>`;

  try {
    const res = await fetch('https://api.kmtire.com/v1/tiresizesearch', {
      method: 'POST',
      headers: { 'content-type': 'application/xml' },
      body: xml,
    });
    
    console.log('Status:', res.status);
    const text = await res.text();
    
    // Find first Item and show all fields
    const itemMatch = text.match(/<Item>([\s\S]*?)<\/Item>/);
    if (itemMatch) {
      console.log('\nSample K&M Item fields:');
      const fields = itemMatch[1].match(/<([A-Za-z_]+)>[^<]*<\/[A-Za-z_]+>/g) || [];
      fields.forEach(f => console.log(' ', f.replace(/>.*</, '>...<')));
    } else {
      console.log('No Item found. Response preview:', text.slice(0, 500));
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}
test();
