// Live smoke after the a08c54c8 stack deploy (GETs only; no cart/checkout POSTs).
import puppeteer from "puppeteer";
const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
page.setDefaultTimeout(180000);
const txt = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const tid = (id) => page.$eval(`[data-testid="${id}"]`, (e) => e.textContent.replace(/\s+/g, " ").trim()).catch(() => null);
const addBtns = (enabled) => page.$$eval("button", (bs, en) => bs.filter((x) => x.disabled === !en && /add/i.test(x.textContent) && !/TPMS|sensor/i.test(x.textContent)).map((x) => x.textContent.replace(/\s+/g, " ").trim()), enabled);
const PAIR = "/tires/LXST201935050?size=245%2F35R19&year=2020&make=Ford&model=Mustang&staggeredPair=LXST201935050%3ALXST202035050&rearSku=LXST202035050&rearSize=275%2F35R20";
let fails = 0;
const check = (n, ok, d) => { if (!ok) fails++; console.log(`  ${ok ? "PASS" : "FAIL"} ${n}${d !== undefined ? ": " + (typeof d === "string" ? d : JSON.stringify(d)) : ""}`); };
for (const base of ["https://shop.warehousetiredirect.com", "https://shop.warehousetire.net"]) {
  console.log(base);
  await page.goto(base + PAIR, { waitUntil: "networkidle2" });
  const u = page.url().replace(base, "");
  const t = await txt();
  const buy = await tid("staggered-tire-set-buy");
  check("urlKeepsPairAndVehicle", /rearSku=/.test(u) && /rearSize=/.test(u) && /model=Mustang/.test(u), u);
  check("staggeredBuyRendered", !!buy, buy);
  check("buyShowsBothSizes", !!buy && buy.includes("245/35R19") && buy.includes("275/35R20"));
  const adds = await addBtns(true);
  check("onlyStaggeredAddEnabled", adds.length >= 1 && adds.every((x) => /Staggered Set/i.test(x)), adds);
  check("noSquareSetOf4", !/Add Set of 4/i.test(t));
  check("noClaims", !/verified fit|guaranteed fit|Sized for your wheels|ready to install/i.test(t), t.match(/verified fit|guaranteed fit|Sized for your wheels|ready to install/gi) || []);
  await page.goto(base + PAIR.replace(/&rearSize=[^&]+/, ""), { waitUntil: "networkidle2" });
  const dis = await page.$$eval("button", (bs) => bs.filter((x) => x.disabled && /incomplete/i.test(x.textContent)).map((x) => x.textContent.trim()));
  check("incomplete.disabledButton", dis.length === 1, dis);
  check("incomplete.noEnabledAdd", (await addBtns(true)).length === 0, await addBtns(true));
}
console.log(`SUMMARY fails=${fails}`);
await browser.close();
process.exit(fails ? 1 : 0);
