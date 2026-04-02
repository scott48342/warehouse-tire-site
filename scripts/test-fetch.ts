import * as https from 'https';

const url = "https://shop.warehousetiredirect.com/api/vehicles/models?make=acura";

console.log("Testing fetch to:", url);

https.get(url, { headers: { 'Accept': 'application/json' } }, (res) => {
  console.log("Status:", res.statusCode);
  let data = '';
  res.on('data', chunk => { data += chunk; console.log("Got chunk:", chunk.length, "bytes"); });
  res.on('end', () => {
    console.log("Response complete:", data.length, "bytes");
    console.log("Data:", data);
    process.exit(0);
  });
}).on('error', (e) => {
  console.error("Error:", e.message);
  process.exit(1);
});

console.log("Request sent, waiting...");
