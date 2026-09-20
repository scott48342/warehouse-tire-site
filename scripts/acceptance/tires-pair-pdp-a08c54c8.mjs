// Acceptance for a08c54c8 stack (d04dc84b..a08c54c8) on the read-only preview:
//   cart hand-off (19x8.5 / 20x9.5) -> trim gate -> GT Performance Pack -> click front 265/40R19
//   -> pairs' FRONT == selection -> "Select Staggered Set" -> pair PDP shows Front x2 / Rear x2 with
//   each price, NO square Add/qty/sticky -> Add -> cart line rearSku/rearSize/front+rear prices, qty 4,
//   total == 2F + 2R -> /cart and /checkout summary show both sizes and that total.
//   Then: incomplete pair URL (rearSize dropped) -> disabled "incomplete" button, no square Add.
//   Then: bare pair URL redirect keeps rearSku/rearSize/vehicle.
// Read-only GETs plus the site's own cart/analytics POSTs; no payment/order POST.
import puppeteer from "puppeteer";

const BASE = process.env.BASE_URL || "http://localhost:3002";
const HANDOFF = "/tires?year=2020&make=Ford&model=Mustang&trim=GT+Performance+Pack&wheelSku=TR04198551435BK&wheelDia=19&wheelWidth=8.5&setup=staggered&staggered=true&wheelSkuRear=TR04209551435BK&wheelDiaFront=19&wheelWidthFront=8.5&wheelDiaRear=20&wheelWidthRear=9.5&wheelOffsetRear=35";
const log = (k, v) => console.log(`${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`);
const PAIR_RE = /FRONT\s*[x×]\s*2\s*(\d{3}\/\d{2}Z?R\d{2})\s*REAR\s*[x×]\s*2\s*(\d{3}\/\d{2}Z?R\d{2})/gi;
const pairs = (body) => { const c = {}; for (const m of body.matchAll(PAIR_RE)) { const k = `${m[1]} / ${m[2]}`; c[k] = (c[k] || 0) + 1; } return c; };
const money = (s) => { const m = String(s || "").match(/\$([\d,]+\.\d{2})/); return m ? Number(m[1].replace(/,/g, "")) : null; };
const r2 = (n) => Math.round(n * 100) / 100;
const results = {};
const check = (name, ok, detail) => { results[name] = ok ? "PASS" : "FAIL"; log(`${ok ? "PASS" : "FAIL"} ${name}`, detail ?? ""); };

const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
page.setDefaultTimeout(240000);
const posts = [];
page.on("request", (r) => { const m = r.method(); if (m !== "GET" && m !== "HEAD" && /\/api\/(stripe|paypal|orders?|checkout\/(create|session)|supplier)/i.test(r.url())) posts.push(`${m} ${r.url()}`); });
const bodyText = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const enabledButtons = () => page.$$eval("button", (bs) => bs.filter((b) => !b.disabled).map((b) => b.textContent.replace(/\s+/g, " ").trim()));
const disabledButtons = () => page.$$eval("button", (bs) => bs.filter((b) => b.disabled).map((b) => b.textContent.replace(/\s+/g, " ").trim()));
const testid = (id) => page.$eval(`[data-testid="${id}"]`, (e) => e.textContent.replace(/\s+/g, " ").trim()).catch(() => null);

// 1) gate
await page.goto(`${BASE}${HANDOFF}`, { waitUntil: "networkidle2" });
const gtpp = await page.evaluate(() => { const a = [...document.querySelectorAll("a")].find((x) => /modification=/.test(x.getAttribute("href") || "") && /^GT Performance Pack/i.test(x.textContent.trim())); return a ? a.getAttribute("href") : null; });
check("gate.linkKeepsRearAxle", !!gtpp && /wheelSkuRear=TR04209551435BK/.test(gtpp) && /wheelDiaRear=20/.test(gtpp), gtpp);
if (!gtpp) { await browser.close(); process.exit(1); }

// 2) results -> click front 265/40R19
await page.goto(`${BASE}${gtpp}`, { waitUntil: "networkidle2" });
let body = await bodyText();
log("results.pairs", pairs(body));
const sizeLinks = await page.evaluate(() => [...document.querySelectorAll("a")].map((a) => a.getAttribute("href") || "").filter((h) => /^\/tires(\/v\/[^?]*)?\?.*size=/.test(h)));
check("results.sizeLinksKeepRearAxle", sizeLinks.length > 0 && sizeLinks.every((h) => /wheelSkuRear=TR04209551435BK/.test(h) && /wheelDiaRear=20/.test(h)), `${sizeLinks.length} links`);
const pick = sizeLinks.find((h) => /size=265(%2F|\/)40R19/.test(h));
check("results.has265Link", !!pick, pick);
if (!pick) { await browser.close(); process.exit(1); }
await page.goto(`${BASE}${pick}`, { waitUntil: "networkidle2" });
body = await bodyText();
const p265 = pairs(body);
log("after265.pairs", p265);
const fronts = Object.keys(p265).map((k) => k.split(" / ")[0]);
check("after265.pairFrontEqualsSelection", fronts.length > 0 && fronts.every((f) => f === "265/40R19"), fronts);
check("after265.rearsAreR20", Object.keys(p265).every((k) => /R20$/.test(k)), Object.keys(p265));
const headerPair = (body.match(/Front:\s*(\d{3}\/\d{2}Z?R\d{2}).{1,4}Rear:\s*(\d{3}\/\d{2}Z?R\d{2})/) || []).slice(1, 3);
check("after265.headerPairMatches", headerPair[0] === "265/40R19" && /R20$/.test(headerPair[1] || ""), headerPair);

// 3) Select Staggered Set -> PDP
const setHref = await page.evaluate(() => { const a = [...document.querySelectorAll("a")].find((x) => /Select Staggered Set/i.test(x.textContent)); return a ? a.getAttribute("href") : null; });
log("pair.selectHref", setHref);
check("pair.hrefHasRearSkuAndSize", !!setHref && /rearSku=/.test(setHref) && /rearSize=/.test(setHref) && /staggeredPair=/.test(setHref));
if (!setHref) { await browser.close(); process.exit(1); }
const hrefFrontSku = (setHref.match(/\/tires\/(?:km\/)?([^/?]+)/) || [])[1];
const hrefRearSku = decodeURIComponent((setHref.match(/rearSku=([^&]+)/) || [])[1] || "");
const hrefRearSize = decodeURIComponent((setHref.match(/rearSize=([^&]+)/) || [])[1] || "");
const hrefFrontSize = decodeURIComponent((setHref.match(/[?&]size=([^&]+)/) || [])[1] || "");
await page.evaluate(() => localStorage.setItem("wt_cart", JSON.stringify([])));
await page.goto(`${BASE}${setHref}`, { waitUntil: "networkidle2" });
const pdpUrl = page.url().replace(BASE, "");
log("pdp.url", pdpUrl);
check("pdp.urlKeepsPairAndVehicle", /rearSku=/.test(pdpUrl) && /rearSize=/.test(pdpUrl) && /make=Ford/.test(pdpUrl), pdpUrl);
body = await bodyText();
const buyBox = await testid("staggered-tire-set-buy");
log("pdp.staggeredBuy", buyBox);
check("pdp.staggeredBuyRendered", !!buyBox);
const frontEa = money((buyBox || "").match(/Front[^$]*\$[\d,.]+/)?.[0]);
const rearEa = money(await testid("staggered-rear-price"));
const setTotal = money(await testid("staggered-set-total"));
log("pdp.prices", { frontEa, rearEa, setTotal });
check("pdp.showsFrontAndRearSizes", new RegExp(`Front[^|]{0,40}${hrefFrontSize.replace("/", "\\/")}`).test(buyBox || "") && new RegExp(`Rear[^|]{0,40}${hrefRearSize.replace("/", "\\/")}`).test(buyBox || ""), { hrefFrontSize, hrefRearSize });
check("pdp.setTotalIs2F2R", frontEa && rearEa && setTotal != null && r2(2 * frontEa + 2 * rearEa) === setTotal, { expected: frontEa && rearEa ? r2(2 * frontEa + 2 * rearEa) : null, setTotal });
check("pdp.setTotalNot4xFront", frontEa && setTotal != null && setTotal !== r2(4 * frontEa), r2(4 * (frontEa || 0)));
const en = await enabledButtons();
const addBtns = en.filter((t) => /add/i.test(t) && !/TPMS|sensor/i.test(t));
log("pdp.enabledAddButtons", addBtns);
check("pdp.onlyStaggeredAdd", addBtns.length >= 1 && addBtns.every((t) => /Staggered Set/i.test(t) && /2 front \+ 2 rear/i.test(t)), addBtns);
check("pdp.noSquareSetOf4", !/Add Set of 4|Set of 4 tires|Set of 4:/i.test(body) && !/Quantity/i.test(buyBox || ""), (body.match(/Set of 4[^|]{0,30}/) || [""])[0]);
check("pdp.noFitClaims", !/verified fit|fitment guaranteed|guaranteed fit|Sized for your wheels/i.test(body), (body.match(/verified fit|guaranteed fit|Sized for your wheels/i) || [""])[0]);
check("pdp.neutralFitCopy", /fit not yet confirmed/i.test(body));

// 4) Add -> cart
const clicked = await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /Add Staggered Set/i.test(x.textContent) && !x.disabled); if (!b) return null; b.click(); return b.textContent.replace(/\s+/g, " ").trim(); });
log("pdp.clicked", clicked);
await new Promise((r) => setTimeout(r, 2500));
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /skip|no thanks|continue without/i.test(x.textContent)); b && b.click(); });
await new Promise((r) => setTimeout(r, 1200));
const cart = await page.evaluate(() => JSON.parse(localStorage.getItem("wt_cart") || "[]"));
const t = cart.find((i) => i.type === "tire");
log("cart.tireLine", t ? { sku: t.sku, rearSku: t.rearSku, size: t.size, rearSize: t.rearSize, quantity: t.quantity, unitPrice: t.unitPrice, frontUnitPrice: t.frontUnitPrice, rearUnitPrice: t.rearUnitPrice, staggered: t.staggered, source: t.source } : null);
check("cart.oneTireLine", cart.filter((i) => i.type === "tire").length === 1, cart.length);
check("cart.lineHasBothSkus", !!t && t.sku === hrefFrontSku && t.rearSku === hrefRearSku, { hrefFrontSku, hrefRearSku });
check("cart.lineHasBothSizes", !!t && t.size === hrefFrontSize && t.rearSize === hrefRearSize);
check("cart.lineQty4Staggered", !!t && t.quantity === 4 && t.staggered === true);
check("cart.linePrices2F2R", !!t && t.frontUnitPrice === frontEa && t.rearUnitPrice === rearEa && r2(2 * t.frontUnitPrice + 2 * t.rearUnitPrice) === setTotal);

await page.goto(`${BASE}/cart`, { waitUntil: "networkidle2" });
body = await bodyText();
const cartSplit = (body.match(/2 × \$[\d,.]+ front \+ 2 × \$[\d,.]+ rear/) || [""])[0];
log("cartPage.split", cartSplit);
log("cartPage.rear", (body.match(/Rear:\s*\d{3}\/\d{2}Z?R\d{2}/) || [""])[0]);
check("cartPage.showsRearSize", new RegExp(`Rear (\\u00d7|x)2:\\s*${hrefRearSize.replace("/", "\\/")}`).test(body), (body.match(/Rear[^|]{0,30}R20/) || [""])[0]);
check("cartPage.showsTotal2F2R", body.includes(`$${setTotal.toFixed(2)}`) || body.includes(`$${setTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}`), setTotal);
check("cartPage.noFitClaims", !/verified fit|guaranteed fit/i.test(body));
const cartLine = await testid("tire-line-staggered");
log("cartPage.tireLine", cartLine);
check("cartPage.sharedStaggeredLine", !!cartLine && cartLine.includes(hrefFrontSize) && cartLine.includes(hrefRearSize) && cartLine.includes(hrefRearSku) && /2 × \$[\d,.]+ front \+ 2 × \$[\d,.]+ rear/.test(cartLine));
check("cartPage.fixedQtyNoPicker", !!(await testid("cart-tire-fixed-qty")) && !(await page.$$eval("select", (s) => s.some((el) => [...el.options].map((o) => o.value).join(",") === "1,2,4,5,6,8"))));
check("cartPage.noBlendedEach", !new RegExp(`\\$${String(t.unitPrice.toFixed(2)).replace(".", "\\.")} each`).test(body), t.unitPrice);
check("cartPage.headerBothSizes", body.includes(`${hrefFrontSize} / ${hrefRearSize} Tires`) || !/Tires/.test((body.match(/Wheels[^|]{0,60}Tires/) || [""])[0]), (body.match(/[^|]{0,40}\/ \d{3}\/\d{2}Z?R\d{2} Tires/) || [""])[0]);
check("cartPage.noReadyForInstall", !/Ready for Install|ready to install/i.test(body));

await page.setViewport({ width: 1400, height: 1000 });
await page.goto(`${BASE}/checkout`, { waitUntil: "networkidle2" });
body = await bodyText();
const coLines = await page.$$eval('[data-testid="tire-line-staggered"]', (els) => els.map((e) => e.textContent.replace(/\s+/g, " ").trim()));
log("checkout.staggeredLines", coLines);
check("checkout.summaryHasSharedStaggeredLine", coLines.length >= 1 && coLines.every((l) => l.includes(hrefFrontSize) && l.includes(hrefRearSize) && l.includes(hrefRearSku)));
check("checkout.noPackageInstallClaim", !/Complete wheel & tire package|ready to install/i.test(body));
log("checkout.tireSummary", (body.match(new RegExp(`[^|]{0,80}${hrefFrontSize.replace("/", "\\/")}[^|]{0,160}`)) || [""])[0]);
check("checkout.showsBothSizes", body.includes(hrefFrontSize) && body.includes(hrefRearSize), (body.match(/Order Summary.{0,300}/) || [""])[0]);
check("checkout.showsSetTotal", body.includes(`$${setTotal.toFixed(2)}`) || body.includes(`$${setTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}`), setTotal);

// 5) incomplete pair intent (rearSize dropped) -> fail closed
const incompleteHref = setHref.replace(/&?rearSize=[^&]+/, "");
await page.goto(`${BASE}${incompleteHref}`, { waitUntil: "networkidle2" });
body = await bodyText();
const dis = await disabledButtons();
const enI = await enabledButtons();
log("incomplete.url", page.url().replace(BASE, ""));
log("incomplete.disabled", dis.filter((x) => /staggered|incomplete/i.test(x)));
check("incomplete.disabledIncompleteButton", dis.some((x) => /Staggered set incomplete/i.test(x)));
check("incomplete.noEnabledAdd", !enI.some((x) => /add/i.test(x) && /set|cart|tires/i.test(x) && !/TPMS|sensor/i.test(x)), enI.filter((x) => /add/i.test(x)));
check("incomplete.noSquareSetOf4", !/Add Set of 4/i.test(body));
check("incomplete.rearNotSpecified", /not specified/i.test(await testid("staggered-rear-price") || ""));

// 6) bare pair URL (the live repro) -> redirect keeps pair + vehicle
const bare = `/tires/${hrefFrontSku}?size=${encodeURIComponent(hrefFrontSize)}&year=2020&make=Ford&model=Mustang&staggeredPair=${encodeURIComponent(`${hrefFrontSku}:${hrefRearSku}`)}&rearSku=${hrefRearSku}&rearSize=${encodeURIComponent(hrefRearSize)}`;
await page.goto(`${BASE}${bare}`, { waitUntil: "networkidle2" });
const bareUrl = page.url().replace(BASE, "");
log("bare.finalUrl", bareUrl);
check("bare.redirectKeepsPairAndVehicle", /rearSku=/.test(bareUrl) && /rearSize=/.test(bareUrl) && /model=Mustang/.test(bareUrl));
check("bare.staggeredBuyRendered", !!(await testid("staggered-tire-set-buy")));
const bareAdd = (await enabledButtons()).filter((x) => /add/i.test(x) && !/TPMS|sensor/i.test(x));
check("bare.onlyStaggeredAdd", bareAdd.length >= 1 && bareAdd.every((x) => /Staggered Set/i.test(x)), bareAdd);

log("payment_or_order_POSTs", posts);
check("safety.noPaymentOrOrderPOST", posts.length === 0);
const fails = Object.entries(results).filter(([, v]) => v === "FAIL").map(([k]) => k);
log("SUMMARY", { pass: Object.values(results).filter((v) => v === "PASS").length, fail: fails.length, fails });
await browser.close();
process.exit(fails.length ? 1 : 0);
