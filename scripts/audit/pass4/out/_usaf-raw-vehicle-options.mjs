// Scratch: dump raw USAF GetVehicleOptions XML (and probe WSDL for other vehicle methods).
// Usage: node scripts/audit/pass4/out/_usaf-raw-vehicle-options.mjs 2024 Ford "Mustang Mach-E"
import fs from "node:fs";
import path from "node:path";

const envFile = path.resolve(".env.local");
for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const user = process.env.USAUTOFORCE_USERNAME, pass = process.env.USAUTOFORCE_PASSWORD;
const isTest = user.toLowerCase().includes("test");
const url = isTest ? "https://servicesstage.usautoforce.com/integrationservice.asmx" : "https://services.usautoforce.com/integrationservice.asmx";
const NS = "https://services.usautoforce.com";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function call(method, body) {
  const env = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Header><Authentication xmlns="${NS}"><User>${esc(user)}</User><Password>${esc(pass)}</Password></Authentication></soap:Header><soap:Body><${method} xmlns="${NS}">${body}</${method}></soap:Body></soap:Envelope>`;
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: `${NS}/${method}` }, body: env });
  return { status: r.status, text: await r.text() };
}

const [year, make, model] = process.argv.slice(2);
console.log(`account mode: ${isTest ? "TEST" : "PROD"} user=${user}`);

// 1) WSDL: list every operation name
const wsdl = await fetch(url + "?WSDL").then((r) => r.text());
const ops = [...new Set([...wsdl.matchAll(/<wsdl:operation name="([^"]+)"/g)].map((m) => m[1]))];
console.log("WSDL operations:", ops.join(", "));

// 2) raw GetVehicleOptions
const { status, text } = await call("GetVehicleOptions", `<year>${year}</year><make>${esc(make)}</make><model>${esc(model)}</model>`);
console.log(`GetVehicleOptions HTTP ${status}, ${text.length} bytes`);
const out = path.resolve("scripts/audit/pass4/out/_usaf-vehicle-options-raw.xml");
fs.writeFileSync(out, text);
// distinct element names in the response body
const tags = [...new Set([...text.matchAll(/<([A-Za-z][A-Za-z0-9]*)[ >]/g)].map((m) => m[1]))].filter((t) => !/^(soap|xs|xsd|xsi)/i.test(t));
console.log("element names:", tags.join(", "));
console.log(text.slice(0, 3000));
