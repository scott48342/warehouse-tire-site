/**
 * 2026-09-20 (Codex hydrated CUA on aea23385): /checkout printed "245/35R19 • Qty: 4" + blended
 * total for a 19/20 staggered TIRE set - rear size/SKU and the 2 + 2 prices were invisible at payment;
 * the cart offered a 1/2/4/5/6/8 quantity picker and "$131 each" on a pair; cart/checkout claimed
 * "Ready for Install" / "Complete wheel & tire package - ready to install" unconditionally.
 * Contract: every surface that renders a tire line shows a staggered set as exactly 2 front + 2 rear
 * (both sizes, SKUs and prices, fixed quantity) via the shared StaggeredTireLineDetails; no
 * install/complete-package claims; heuristic pairs carry neutral copy only.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { isStaggeredTireLine } from "@/components/cart/StaggeredTireLineDetails";
import { cartLineTotal, type CartTireItem } from "@/lib/cart/CartContext";

const read = (p: string) => readFileSync(resolve(__dirname, "../../../", p), "utf-8");

const pair: CartTireItem = {
  type: "tire", sku: "1035144", rearSku: "1035212", brand: "Continental", model: "ExtremeContact",
  size: "265/40R19", rearSize: "275/35R20", unitPrice: 284.96, frontUnitPrice: 293.28, rearUnitPrice: 276.65,
  quantity: 4, staggered: true, source: "tireweb:atd",
};

describe("isStaggeredTireLine", () => {
  test("true only with staggered + rearSku + rearSize", () => {
    expect(isStaggeredTireLine(pair)).toBe(true);
    expect(isStaggeredTireLine({ ...pair, staggered: false })).toBe(false);
    expect(isStaggeredTireLine({ ...pair, rearSku: undefined })).toBe(false);
    expect(isStaggeredTireLine({ ...pair, rearSize: undefined })).toBe(false);
  });
  test("line total is exact 2F + 2R (1139.86), not blended x4 (1139.84)", () => {
    expect(cartLineTotal(pair)).toBe(1139.86);
    expect(pair.unitPrice * 4).not.toBe(1139.86);
  });
});

describe("shared display wired into every tire-line surface", () => {
  test("component: both sizes, both SKUs, both prices, split line", () => {
    const src = read("components/cart/StaggeredTireLineDetails.tsx");
    for (const pin of ["Staggered set · 2 front + 2 rear", "Front ×2:", "Rear ×2:", "{tire.rearSku}", "{tire.rearSize}", "data-testid=\"tire-line-split-price\"", "front + 2 ×"]) expect(src).toContain(pin);
  });
  test("cart page: fixed qty on a pair (no 1/2/4/5/6/8 picker), no blended 'each', header shows both sizes, no 'Ready for Install'", () => {
    const src = read("app/cart/page.tsx");
    expect(src).toMatch(/const staggered = isStaggeredTireLine\(item\);/);
    expect(src).toMatch(/data-testid="cart-tire-fixed-qty"/);
    expect(src).toMatch(/\{staggered \? null : <div className="text-xs text-neutral-500">\$\{item\.unitPrice\.toFixed\(2\)\} each<\/div>\}/);
    expect(src).toMatch(/\{staggered \? \(\s*\n\s*<div className="mt-1"><StaggeredTireLineDetails tire=\{item\} \/><\/div>/);
    expect(src).toMatch(/isStaggeredTireLine\(t\) \? `\$\{t\.size\} \/ \$\{t\.rearSize\}` : t\.size/);
    expect(src).not.toMatch(/Ready for Install/);
    expect(src).toMatch(/data-testid="cart-package-neutral"/);
  });
  test("cart slide-out: shared display, '(set of 4: 2 front + 2 rear)' instead of qty x blended", () => {
    const src = read("components/CartSlideout.tsx");
    expect(src).toMatch(/<StaggeredTireLineDetails tire=\{item\} compact \/>/);
    expect(src).toMatch(/\(set of 4: 2 front \+ 2 rear\)/);
  });
  test("checkout: BOTH order summaries (mobile collapsible + desktop sidebar) use the shared display; no package/install claim", () => {
    const src = read("app/checkout/page.tsx");
    expect((src.match(/<StaggeredTireLineDetails tire=\{(t|tire)\} compact \/>/g) || []).length).toBe(2);
    expect(src).not.toMatch(/Complete wheel & tire package/);
    expect(src).not.toMatch(/ready to install/);
    expect(src).toMatch(/data-testid="checkout-wheels-and-tires"/);
  });
  test("package review + local mobile checkout: shared display, fixed set label, exact line total", () => {
    const review = read("app/package/review/page.tsx");
    expect(review).toMatch(/<StaggeredTireLineDetails tire=\{item\} compact \/>/);
    expect(review).toMatch(/isStaggeredTireLine\(item\) \? "Set of 4 \(2 \+ 2\)" : `Qty: \$\{item\.quantity\}`/);
    const local = read("components/local/LocalMobileCheckout.tsx");
    expect(local).toMatch(/<StaggeredTireLineDetails tire=\{item as CartTireItem\} compact \/>/);
    expect(local).toMatch(/data-testid="local-tire-fixed-qty"/);
    expect(local).toMatch(/\$\{lineTotal\.toFixed\(2\)\}/);
    expect(local).not.toMatch(/\(item\.unitPrice \|\| 0\) \* qty/);
  });
  test("tire results cards: neutral copy only - pair 'Front and rear sizes as selected', single 'Fit not yet confirmed'; no 'Sized for'", () => {
    const src = read("app/tires/page.tsx");
    expect(src).not.toMatch(/Sized for \{year\} \{make\} \{model\}/);
    expect(src).not.toMatch(/Matched to your wheel sizes/);
    expect(src).toMatch(/Front and rear sizes as selected · fit not yet confirmed/);
    expect(src).toMatch(/: <>Fit not yet confirmed<\/>\}/);
  });
});
