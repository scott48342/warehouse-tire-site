/**
 * 2026-09-20: the /tires trim gate must keep the wheel hand-off (both axles of a staggered
 * set, lifted context, size) while adding the chosen trim's modification. Live: the cart's
 * "Add Tires" for a 19x8.5 / 20x9.5 set reached the gate, and every trim button rebuilt the
 * URL from year/make/model only - the shopper would have landed on OEM 19/19 sizes.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { trimGateHref } from "@/lib/tires/trimGateHref";

const CART_HANDOFF = {
  year: "2020", make: "Ford", model: "Mustang", trim: "GT Performance Pack",
  wheelSku: "TR04198551435BK", wheelDia: "19", wheelWidth: "8.5",
  setup: "staggered", staggered: "true",
  wheelSkuRear: "TR04209551435BK", wheelDiaFront: "19", wheelWidthFront: "8.5",
  wheelDiaRear: "20", wheelWidthRear: "9.5", wheelOffsetRear: "35",
};

describe("trimGateHref", () => {
  test("adds the modification and keeps BOTH wheel axles from the cart hand-off", () => {
    const href = trimGateHref(CART_HANDOFF, "ford-mustang-gt-performance-pack-1db4ea26c6");
    const p = new URLSearchParams(href.replace(/^\/tires\?/, ""));
    expect(href.startsWith("/tires?")).toBe(true);
    expect(p.get("modification")).toBe("ford-mustang-gt-performance-pack-1db4ea26c6");
    expect(p.get("year")).toBe("2020");
    expect(p.get("wheelSku")).toBe("TR04198551435BK");
    expect(p.get("wheelSkuRear")).toBe("TR04209551435BK");
    expect(p.get("wheelDiaFront")).toBe("19");
    expect(p.get("wheelDiaRear")).toBe("20");
    expect(p.get("wheelWidthRear")).toBe("9.5");
    expect(p.get("setup")).toBe("staggered");
    // the gate's own trim input is replaced by the modification, not duplicated
    expect(p.has("trim")).toBe(false);
  });

  test("array-valued and empty params: first value kept, empties dropped, page reset", () => {
    const href = trimGateHref({ year: "2020", make: "Ford", model: "Mustang", size: ["255/40R19", "x"], liftedSource: "", page: "3" }, "m1");
    const p = new URLSearchParams(href.replace(/^\/tires\?/, ""));
    expect(p.get("size")).toBe("255/40R19");
    expect(p.has("liftedSource")).toBe(false);
    expect(p.has("page")).toBe(false);
    expect(p.get("modification")).toBe("m1");
  });

  test("tires page wires both trim gates through trimGateHref (no hand-built /tires?year=... links remain)", () => {
    const src = readFileSync(resolve(__dirname, "../../../app/tires/page.tsx"), "utf-8");
    expect(src).toMatch(/import \{ trimGateHref \} from "@\/lib\/tires\/trimGateHref";/);
    expect((src.match(/href=\{trimGateHref\(sp, /g) || []).length).toBe(2);
    expect(src).not.toMatch(/href=\{`\/tires\?year=\$\{year\}&make=\$\{encodeURIComponent\(make\)\}&model=\$\{encodeURIComponent\(model\)\}&modification=/);
  });
});
