import { parseCapitalInventory, searchCapitalTires } from "./client";

const soap = `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><InventorySearchResponse><InventorySearchResult><InventorySearch>
<PriceData ItemNumber="C-100" QtyAvail="4" Description="225/65R17~MIL~MS932 Sport~SL BW" FET="0.00" Manufacturer="Milestar" MANUFACTURER_SKU_CODE="24557001" TIRE_SIZE="225/65R17" Price="89.25" />
<PriceData ItemNumber="C-200" QtyAvail="0" Description="225/65R17~GOO~Integrity" FET="0.00" Manufacturer="Goodyear" MANUFACTURER_SKU_CODE="402479047" TIRE_SIZE="225/65R17" Price="100.00" />
<PriceData ItemNumber="C-300" QtyAvail="6" Description="225/65R17~GOO~Other" FET="0.00" Manufacturer="Goodyear" MANUFACTURER_SKU_CODE="OTHER" TIRE_SIZE="225/60R17" Price="100.00" />
</InventorySearch></InventorySearchResult></InventorySearchResponse></soap:Body></soap:Envelope>`;

test("normalizes Capital stock and dealer cost and excludes unavailable or wrong sizes", () => {
  expect(parseCapitalInventory(soap, "225/65R17")).toEqual([{
    itemNumber: "C-100", manufacturerSku: "24557001", brand: "Milestar",
    model: "MS932 Sport", description: "225/65R17 MIL MS932 Sport SL BW",
    size: "225/65R17", quantity: 4, cost: 89.25, fet: 0,
  }]);
});

test("adds separately reported FET to dealer cost", () => {
  const withFet = soap.replace('FET="0.00"', 'FET="12.50"');
  expect(parseCapitalInventory(withFet, "225/65R17")[0].cost).toBe(101.75);
});

test("uses only read-only InventorySearch with account-scoped size fields", async () => {
  const previous = {
    uid: process.env.CAPITAL_TIRE_APPLICATION_UID,
    company: process.env.CAPITAL_TIRE_COMPANY_ID,
    location: process.env.CAPITAL_TIRE_LOCATION_ID,
    customer: process.env.CAPITAL_TIRE_CUSTOMER_ID,
    address: process.env.CAPITAL_TIRE_ADDRESS_ID,
  };
  process.env.CAPITAL_TIRE_APPLICATION_UID = "test-uid";
  process.env.CAPITAL_TIRE_COMPANY_ID = "1";
  process.env.CAPITAL_TIRE_LOCATION_ID = "1";
  process.env.CAPITAL_TIRE_CUSTOMER_ID = "customer";
  process.env.CAPITAL_TIRE_ADDRESS_ID = "PRIMARY";
  const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({ ok: true, text: async () => soap } as Response);
  try {
    const items = await searchCapitalTires("225/65R17");
    expect(items).toHaveLength(1);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toContain("/TDWebServices/Service.asmx");
    expect(options?.method).toBe("POST");
    expect(String(options?.body)).toContain("<InventorySearch xmlns=");
    expect(String(options?.body)).toContain("<Width>225</Width><Aspect>65</Aspect><Rim>17</Rim>");
    expect(String(options?.body)).not.toContain("PlaceOrder");
  } finally {
    fetchSpy.mockRestore();
    for (const [key, value] of Object.entries({
      CAPITAL_TIRE_APPLICATION_UID: previous.uid,
      CAPITAL_TIRE_COMPANY_ID: previous.company,
      CAPITAL_TIRE_LOCATION_ID: previous.location,
      CAPITAL_TIRE_CUSTOMER_ID: previous.customer,
      CAPITAL_TIRE_ADDRESS_ID: previous.address,
    })) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
