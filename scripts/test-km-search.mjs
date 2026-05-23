// Test K&M part lookup

const apiKey = process.env.KM_API_KEY || "5#K@Mce7$voGP64aerM1zQ1S";
const partNumber = process.argv[2] || "LXST2071755030";

const body = `<?xml version="1.0" encoding="UTF-8"?>
<InventoryRequest>
  <Credentials><APIKey>${apiKey}</APIKey></Credentials>
  <Item>
    <PartNumber>${partNumber}</PartNumber>
    <VendorName>Lexani</VendorName>
  </Item>
</InventoryRequest>`;

console.log("Searching K&M for:", partNumber);

const res = await fetch("https://api.kmtire.com/v1/inventory", {
  method: "POST",
  headers: {
    "Content-Type": "application/xml",
    "Accept": "application/xml, text/xml, */*",
  },
  body,
});

console.log("Status:", res.status);
const text = await res.text();
console.log("Response:");
console.log(text);
