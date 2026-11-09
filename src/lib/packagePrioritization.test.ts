import { applySupplierPrioritization } from "./packagePrioritization";

test("shows local Capital inventory on the first search page", () => {
  const results = applySupplierPrioritization([
    { source: "tireweb:atd", price: 100, partNumber: "A" },
    { source: "wheelpros", price: 95, partNumber: "W" },
    { source: "capital", price: 110, partNumber: "C" },
  ]);
  expect(results.map((result) => result.partNumber)).toEqual(["C", "A", "W"]);
});
