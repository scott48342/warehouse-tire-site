// Acceptance for hotfix 2c87b324 against the local read-only preview (no payment, no POST beyond page loads).
// Scenarios: (1) real Add Set on the observed 19/20 PDP -> cart/slideout/checkout/review labels + tires URL;
// (2) LEGACY persisted cart line (no rearDiameter) -> "not confirmed" + tire hand-off withheld;
// (3) known 20/20 set -> coherent.
import puppeteer from "puppeteer";

const BASE = process.env.BASE_URL || "http://localhost:3002";
const V = "year=2020&make=Ford&model=Mustang&trim=GT%20Performance%20Pack";
const out = [];
const log = (k, v) => { out.push([k, v]); console.log(`${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`); };

const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
page.setDefaultTimeout(90000);
const posts = [];
page.on("request", (r) => { if (r.method() !== "GET" && r.method() !== "HEAD") posts.push(`${r.method()} ${new URL(r.url()).pathname}`); });

const text = async (sel) => page.$eval(sel, (e) => e.textContent.trim()).catch(() => null);
const href = async (sel) => page.$eval(sel, (e) => e.getAttribute("href")).catch(() => null);
const staggeredBlock = async () => page.$eval('[data-testid="cart-wheel-staggered"]', (e) => e.innerText.replace(/\s+/g, " ")).catch(() => null);

// ---------- Scenario 1: real Add Set on the observed PDP ----------
await page.goto(`${BASE}/wheels/TR04198551435BK?${V}&wheelDia=19&wheelWidth=8.5&rearSku=TR04209551435BK`, { waitUntil: "networkidle2" });
await page.evaluate(() => localStorage.removeItem("wt_cart"));
await page.reload({ waitUntil: "networkidle2" });
const addBtn = await page.$$eval("button", (bs) => bs.map((b) => b.textContent.trim()).filter((t) => /add/i.test(t) && /set|cart|package/i.test(t)));
log("s1.pdp.addButtons", addBtn);
const clicked = await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => /add/i.test(x.textContent) && /set|cart|package/i.test(x.textContent) && !x.disabled);
  if (!b) return null; b.click(); return b.textContent.trim();
});
log("s1.pdp.clicked", clicked);
await new Promise((r) => setTimeout(r, 2500));
// Dismiss accessory modal / skip if present
const skipped = await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => /skip|no thanks|continue without/i.test(x.textContent));
  if (!b) return null; b.click(); return b.textContent.trim();
});
log("s1.pdp.skip", skipped);
await new Promise((r) => setTimeout(r, 1500));
const cart1 = await page.evaluate(() => JSON.parse(localStorage.getItem("wt_cart") || "[]"));
const w1 = cart1.find((i) => i.type === "wheel");
log("s1.cartLine", w1 ? { sku: w1.sku, rearSku: w1.rearSku, diameter: w1.diameter, width: w1.width, rearDiameter: w1.rearDiameter, rearWidth: w1.rearWidth, frontUnitPrice: w1.frontUnitPrice, rearUnitPrice: w1.rearUnitPrice, unitPrice: w1.unitPrice, quantity: w1.quantity, staggered: w1.staggered } : null);
// Slide-out text (if open)
const slide = await page.evaluate(() => { const el = [...document.querySelectorAll("span")].filter((s) => /^R: /.test(s.textContent)); return el.map((s) => s.textContent.trim()); });
log("s1.slideout.rearLabels", slide);
const selectTires = await page.evaluate(() => { const a = [...document.querySelectorAll("a")].find((x) => /select tires|confirm rear/i.test(x.textContent)); return a ? { text: a.textContent.trim(), href: a.getAttribute("href") } : null; });
log("s1.slideout.tiresCta", selectTires);

await page.goto(`${BASE}/cart`, { waitUntil: "networkidle2" });
log("s1.cart.staggeredBlock", await staggeredBlock());
log("s1.cart.rearSize", await text('[data-testid="cart-wheel-rear-size"]'));
log("s1.cart.rearUnconfirmed", await text('[data-testid="cart-wheel-rear-unconfirmed"]'));
log("s1.cart.addTires", { text: await text('[data-testid="cart-add-tires"]'), href: await href('[data-testid="cart-add-tires"]') });
const total1 = await page.evaluate(() => { const m = document.body.innerText.match(/\$1,?346\.80/g); return m ? m.length : 0; });
log("s1.cart.count_1346.80", total1);

await page.goto(`${BASE}/checkout`, { waitUntil: "networkidle2" });
log("s1.checkout.staggered", await page.$eval('[data-testid="checkout-wheel-staggered"]', (e) => e.innerText.replace(/\s+/g, " ")).catch(() => null));
await page.goto(`${BASE}/package/review`, { waitUntil: "networkidle2" });
log("s1.review.staggered", await page.$eval('[data-testid="review-wheel-staggered"]', (e) => e.innerText.replace(/\s+/g, " ")).catch(() => null));

// ---------- Scenario 2: LEGACY line (no rearDiameter) exactly as an older build persisted it ----------
if (w1) {
  const legacy = { ...w1 }; delete legacy.rearDiameter;
  await page.evaluate((l) => localStorage.setItem("wt_cart", JSON.stringify([l])), legacy);
  await page.goto(`${BASE}/cart`, { waitUntil: "networkidle2" });
  log("s2.cart.staggeredBlock", await staggeredBlock());
  log("s2.cart.rearSize", await text('[data-testid="cart-wheel-rear-size"]'));
  log("s2.cart.rearUnconfirmed", await text('[data-testid="cart-wheel-rear-unconfirmed"]'));
  const at2 = { text: await text('[data-testid="cart-add-tires"]'), href: await href('[data-testid="cart-add-tires"]') };
  log("s2.cart.addTires", at2);
  log("s2.cart.tiresHref_mentions_19_rear_or_wheelDiaRear", /wheelDiaRear|wheelDia=/.test(at2.href || ""));
  await page.goto(`${BASE}/checkout`, { waitUntil: "networkidle2" });
  log("s2.checkout.staggered", await page.$eval('[data-testid="checkout-wheel-staggered"]', (e) => e.innerText.replace(/\s+/g, " ")).catch(() => null));
}

// ---------- Scenario 3: known 20/20 set via PDP Add Set ----------
await page.goto(`${BASE}/wheels/TR04208551435HB?${V}&wheelDia=20&wheelWidth=8.5&rearSku=TR04209551435HB`, { waitUntil: "networkidle2" });
await page.evaluate(() => localStorage.removeItem("wt_cart"));
await page.reload({ waitUntil: "networkidle2" });
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /add/i.test(x.textContent) && /set|cart|package/i.test(x.textContent) && !x.disabled); b && b.click(); });
await new Promise((r) => setTimeout(r, 2500));
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /skip|no thanks|continue without/i.test(x.textContent)); b && b.click(); });
await new Promise((r) => setTimeout(r, 1500));
const cart3 = await page.evaluate(() => JSON.parse(localStorage.getItem("wt_cart") || "[]"));
const w3 = cart3.find((i) => i.type === "wheel");
log("s3.cartLine", w3 ? { sku: w3.sku, rearSku: w3.rearSku, diameter: w3.diameter, rearDiameter: w3.rearDiameter, rearWidth: w3.rearWidth, frontUnitPrice: w3.frontUnitPrice, rearUnitPrice: w3.rearUnitPrice } : null);
await page.goto(`${BASE}/cart`, { waitUntil: "networkidle2" });
log("s3.cart.rearSize", await text('[data-testid="cart-wheel-rear-size"]'));
log("s3.cart.addTires", { text: await text('[data-testid="cart-add-tires"]'), href: await href('[data-testid="cart-add-tires"]') });

log("nonGET_requests", posts);
await browser.close();
