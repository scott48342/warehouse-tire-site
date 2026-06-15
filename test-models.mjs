import Anthropic from '@anthropic-ai/sdk';

async function testModel(modelName) {
  const client = new Anthropic();
  try {
    const msg = await client.messages.create({
      model: modelName,
      max_tokens: 10,
      messages: [{ role: 'user', content: 'hi' }]
    });
    console.log(`OK: ${modelName}`);
    return true;
  } catch (err) {
    console.log(`FAIL: ${modelName} - ${err.status} ${err.message}`);
    return false;
  }
}

const models = [
  'claude-sonnet-4-20250514',
  'claude-3-5-sonnet-20241022',
  'claude-3-sonnet-20240229'
];

for (const m of models) {
  await testModel(m);
}
