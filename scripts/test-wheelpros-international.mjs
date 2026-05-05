/**
 * Test WheelPros Order API with international addresses
 * Check if they accept Canada, Australia, EU addresses
 */

const AUTH_URL = "https://api.wheelpros.com/auth/v1/authorize";
const ORDER_URL = "https://api.wheelpros.com/orders/v1/create";

const USERNAME = "scott@warehousetire.net";
const PASSWORD = "Websters1!";

async function getToken() {
  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName: USERNAME, password: PASSWORD }),
  });
  return (await res.json()).accessToken;
}

async function testAddress(token, name, address) {
  console.log(`\n🌍 Testing: ${name}`);
  console.log(`   ${address.address1}, ${address.city}, ${address.stateOrProvinceCode} ${address.postalCode}, ${address.countryCode}`);
  
  const payload = {
    purchaseOrderNumber: `TEST-INTL-${Date.now()}`,
    warehouseCode: 1001,
    items: [{ partNumber: "KM54989063518", quantity: 1 }],
    shipping: {
      shipToName: "TEST DO NOT SHIP",
      ...address,
      phone: "5555555555",
    }
  };
  
  try {
    const res = await fetch(`${ORDER_URL}?orderType=edi`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    
    const data = await res.json();
    console.log(`   Status: ${res.status}`);
    
    if (res.status === 200 && data.message === "success") {
      console.log(`   ✅ ACCEPTED! Order #: ${data.supplierOrderNumber}`);
      console.log(`   ⚠️  Need to cancel this test order!`);
      return { accepted: true, orderNumber: data.supplierOrderNumber };
    } else {
      console.log(`   ❌ Rejected: ${data.errorMessage || data.message || JSON.stringify(data)}`);
      return { accepted: false, error: data.errorMessage };
    }
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    return { accepted: false, error: err.message };
  }
}

async function main() {
  const token = await getToken();
  console.log("✅ Got token");
  
  const testAddresses = [
    {
      name: "🇨🇦 Canada (Ontario)",
      address: {
        address1: "123 Test Street",
        city: "Toronto",
        stateOrProvinceCode: "ON",
        postalCode: "M5V 1A1",
        countryCode: "CA",
      }
    },
    {
      name: "🇨🇦 Canada (Alberta)", 
      address: {
        address1: "456 Test Ave",
        city: "Calgary",
        stateOrProvinceCode: "AB",
        postalCode: "T2P 1A1",
        countryCode: "CA",
      }
    },
    {
      name: "🇦🇺 Australia (NSW)",
      address: {
        address1: "789 Test Road",
        city: "Sydney",
        stateOrProvinceCode: "NSW",
        postalCode: "2000",
        countryCode: "AU",
      }
    },
    {
      name: "🇬🇧 United Kingdom",
      address: {
        address1: "10 Test Lane",
        city: "London",
        stateOrProvinceCode: "LND",
        postalCode: "SW1A 1AA",
        countryCode: "GB",
      }
    },
    {
      name: "🇩🇪 Germany",
      address: {
        address1: "Teststraße 1",
        city: "Berlin",
        stateOrProvinceCode: "BE",
        postalCode: "10115",
        countryCode: "DE",
      }
    },
    {
      name: "🇲🇽 Mexico",
      address: {
        address1: "Calle Test 123",
        city: "Mexico City",
        stateOrProvinceCode: "CMX",
        postalCode: "06600",
        countryCode: "MX",
      }
    },
  ];
  
  const results = [];
  for (const test of testAddresses) {
    const result = await testAddress(token, test.name, test.address);
    results.push({ ...test, ...result });
    
    // Small delay between requests
    await new Promise(r => setTimeout(r, 500));
  }
  
  // Summary
  console.log("\n" + "═".repeat(60));
  console.log("SUMMARY");
  console.log("═".repeat(60));
  
  const accepted = results.filter(r => r.accepted);
  const rejected = results.filter(r => !r.accepted);
  
  if (accepted.length > 0) {
    console.log("\n✅ ACCEPTED:");
    accepted.forEach(r => console.log(`   ${r.name} → Order #${r.orderNumber}`));
    console.log("\n⚠️  IMPORTANT: Contact WheelPros to cancel these test orders!");
  }
  
  if (rejected.length > 0) {
    console.log("\n❌ REJECTED:");
    rejected.forEach(r => console.log(`   ${r.name} → ${r.error}`));
  }
}

main().catch(console.error);
