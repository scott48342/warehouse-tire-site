/**
 * Test WheelPros Vehicle API to find trim/submodel endpoints
 */
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
function getEnv(key) {
  const match = envContent.match(new RegExp(`${key}="?([^"\\n]+)`));
  return match ? match[1].trim() : null;
}

const authUrl = getEnv('WHEELPROS_AUTH_URL');
const username = getEnv('WHEELPROS_PDP_USERNAME');
const password = getEnv('WHEELPROS_PDP_PASSWORD');
const baseUrl = getEnv('WHEELPROS_VEHICLE_API_BASE_URL') || "https://api.wheelpros.com/vehicles";

async function getToken() {
  const res = await fetch(authUrl, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ userName: username, password }),
  });
  if (!res.ok) throw new Error(`Auth failed: HTTP ${res.status}`);
  const data = await res.json();
  return data.accessToken || data.token || data.access_token;
}

async function testEndpoint(token, path, description) {
  console.log(`\n--- ${description} ---`);
  console.log(`GET ${baseUrl}${path}`);
  
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    
    console.log(`Status: ${res.status}`);
    
    if (res.ok) {
      const data = await res.json();
      console.log('Response sample:', JSON.stringify(data, null, 2).slice(0, 1500));
      return data;
    } else {
      const text = await res.text();
      console.log('Error:', text.slice(0, 500));
    }
  } catch (err) {
    console.log('Error:', err.message);
  }
  return null;
}

async function main() {
  console.log('Getting WheelPros API token...');
  const token = await getToken();
  console.log('Token obtained:', token.slice(0, 20) + '...');
  
  // Test various potential endpoints
  await testEndpoint(token, '/v1/years', 'Get Years');
  await testEndpoint(token, '/v1/makes?year=2024', 'Get Makes for 2024');
  await testEndpoint(token, '/v1/models?year=2024&make=Buick', 'Get Models for 2024 Buick');
  await testEndpoint(token, '/v1/submodels?year=2024&make=Buick&model=Enclave', 'Get Submodels for 2024 Buick Enclave');
  await testEndpoint(token, '/v1/trims?year=2024&make=Buick&model=Enclave', 'Get Trims for 2024 Buick Enclave');
  await testEndpoint(token, '/v1/modifications?year=2024&make=Buick&model=Enclave', 'Get Modifications for 2024 Buick Enclave');
  
  // Try vehicle info with submodel
  await testEndpoint(token, '/v1/info?year=2024&make=Buick&model=Enclave&submodel=Avenir', 'Get Fitment for 2024 Buick Enclave Avenir');
  await testEndpoint(token, '/v1/fitment?year=2024&make=Buick&model=Enclave&submodel=Avenir', 'Alt Fitment endpoint');
  
  // Try with Encore
  await testEndpoint(token, '/v1/submodels?year=2022&make=Buick&model=Encore', 'Get Submodels for 2022 Buick Encore');
  
  console.log('\n=== Done ===');
}

main().catch(console.error);
