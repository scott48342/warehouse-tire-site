/**
 * Tests for wheel grouping utility
 * 
 * Run with: npx vitest run src/lib/wheels/groupWheelsBySpec.test.ts
 */

import { describe, it, expect } from "vitest";
import { groupWheelsBySpec, type WheelVariantInput } from "./groupWheelsBySpec";

describe("groupWheelsBySpec", () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // Test Case 1: Same style + same size + different finish => MERGED
  // ═══════════════════════════════════════════════════════════════════════════
  it("should merge same style + same size with different finishes into one card", () => {
    const wheels: WheelVariantInput[] = [
      {
        sku: "FUEL-D538-2090-BLK",
        brand: "Fuel",
        model: "Maverick D538",
        diameter: "20",
        width: "9",
        offset: "-12",
        boltPattern: "6x135",
        centerbore: "87.1",
        finish: "Matte Black",
        imageUrl: "https://example.com/black.jpg",
        price: 299,
        stockQty: 10,
      },
      {
        sku: "FUEL-D538-2090-BRZ",
        brand: "Fuel",
        model: "Maverick D538",
        diameter: "20",
        width: "9",
        offset: "-12",
        boltPattern: "6x135",
        centerbore: "87.1",
        finish: "Bronze",
        imageUrl: "https://example.com/bronze.jpg",
        price: 319,
        stockQty: 5,
      },
      {
        sku: "FUEL-D538-2090-CHR",
        brand: "Fuel",
        model: "Maverick D538",
        diameter: "20",
        width: "9",
        offset: "-12",
        boltPattern: "6x135",
        centerbore: "87.1",
        finish: "Chrome",
        imageUrl: "https://example.com/chrome.jpg",
        price: 349,
        stockQty: 3,
      },
    ];

    const result = groupWheelsBySpec(wheels);

    // Should produce ONE grouped card
    expect(result).toHaveLength(1);

    const card = result[0];
    
    // Should have 3 finish options
    expect(card.finishOptions).toHaveLength(3);
    
    // Each finish should have correct data
    const finishes = card.finishOptions.map(f => f.finish);
    expect(finishes).toContain("Matte Black");
    expect(finishes).toContain("Bronze");
    expect(finishes).toContain("Chrome");
    
    // Variant count should be 3
    expect(card.variantCount).toBe(3);
    
    // Default should prefer cheapest with image (Matte Black at $299)
    expect(card.selectedFinish).toBe("Matte Black");
    expect(card.price).toBe(299);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test Case 2: Same style + different size => SEPARATE cards
  // ═══════════════════════════════════════════════════════════════════════════
  it("should keep separate cards for different sizes (same style)", () => {
    const wheels: WheelVariantInput[] = [
      {
        sku: "FUEL-D538-1890-BLK",
        brand: "Fuel",
        model: "Maverick D538",
        diameter: "18",
        width: "9",
        offset: "-12",
        boltPattern: "6x135",
        centerbore: "87.1",
        finish: "Matte Black",
        imageUrl: "https://example.com/18x9-black.jpg",
        price: 269,
      },
      {
        sku: "FUEL-D538-1895-BLK",
        brand: "Fuel",
        model: "Maverick D538",
        diameter: "18",
        width: "9.5",
        offset: "-12",
        boltPattern: "6x135",
        centerbore: "87.1",
        finish: "Matte Black",
        imageUrl: "https://example.com/18x95-black.jpg",
        price: 279,
      },
      {
        sku: "FUEL-D538-2090-BLK",
        brand: "Fuel",
        model: "Maverick D538",
        diameter: "20",
        width: "9",
        offset: "-12",
        boltPattern: "6x135",
        centerbore: "87.1",
        finish: "Matte Black",
        imageUrl: "https://example.com/20x9-black.jpg",
        price: 299,
      },
    ];

    const result = groupWheelsBySpec(wheels);

    // Should produce THREE separate cards (different sizes)
    expect(result).toHaveLength(3);

    // Each card should have its own size
    const sizes = result.map(r => `${r.diameter}x${r.width}`);
    expect(sizes).toContain("18x9");
    expect(sizes).toContain("18x9.5");
    expect(sizes).toContain("20x9");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test Case 3: Missing image on one finish
  // ═══════════════════════════════════════════════════════════════════════════
  it("should prefer finish with image as default", () => {
    const wheels: WheelVariantInput[] = [
      {
        sku: "FUEL-D538-2090-BLK",
        brand: "Fuel",
        model: "Maverick D538",
        diameter: "20",
        width: "9",
        offset: "-12",
        boltPattern: "6x135",
        finish: "Matte Black",
        imageUrl: undefined, // No image!
        price: 299,
        stockQty: 10,
      },
      {
        sku: "FUEL-D538-2090-BRZ",
        brand: "Fuel",
        model: "Maverick D538",
        diameter: "20",
        width: "9",
        offset: "-12",
        boltPattern: "6x135",
        finish: "Bronze",
        imageUrl: "https://example.com/bronze.jpg", // Has image
        price: 319,
        stockQty: 5,
      },
    ];

    const result = groupWheelsBySpec(wheels);

    expect(result).toHaveLength(1);
    
    // Should select Bronze as default (has image)
    expect(result[0].selectedFinish).toBe("Bronze");
    expect(result[0].imageUrl).toBe("https://example.com/bronze.jpg");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test Case 4: Different price by finish
  // ═══════════════════════════════════════════════════════════════════════════
  it("should track different prices for each finish option", () => {
    const wheels: WheelVariantInput[] = [
      {
        sku: "WHEEL-BLK",
        brand: "Brand",
        model: "Model",
        diameter: "20",
        width: "9",
        finish: "Black",
        imageUrl: "https://example.com/black.jpg",
        price: 200,
      },
      {
        sku: "WHEEL-CHR",
        brand: "Brand",
        model: "Model",
        diameter: "20",
        width: "9",
        finish: "Chrome",
        imageUrl: "https://example.com/chrome.jpg",
        price: 350,
      },
    ];

    const result = groupWheelsBySpec(wheels);

    expect(result).toHaveLength(1);
    
    const blackOpt = result[0].finishOptions.find(f => f.finish === "Black");
    const chromeOpt = result[0].finishOptions.find(f => f.finish === "Chrome");
    
    expect(blackOpt?.price).toBe(200);
    expect(chromeOpt?.price).toBe(350);
    
    // Default should be cheaper Black
    expect(result[0].selectedFinish).toBe("Black");
    expect(result[0].price).toBe(200);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test Case 5: Selected finish SKU correctly used for package
  // ═══════════════════════════════════════════════════════════════════════════
  it("should have correct SKU for each finish option (for Add to Package)", () => {
    const wheels: WheelVariantInput[] = [
      {
        sku: "SKU-001",
        brand: "Brand",
        model: "Model",
        diameter: "20",
        width: "9",
        finish: "Black",
        imageUrl: "https://example.com/black.jpg",
        price: 200,
      },
      {
        sku: "SKU-002",
        brand: "Brand",
        model: "Model",
        diameter: "20",
        width: "9",
        finish: "Silver",
        imageUrl: "https://example.com/silver.jpg",
        price: 200,
      },
    ];

    const result = groupWheelsBySpec(wheels);

    expect(result).toHaveLength(1);
    
    const blackOpt = result[0].finishOptions.find(f => f.finish === "Black");
    const silverOpt = result[0].finishOptions.find(f => f.finish === "Silver");
    
    // Each finish has its own SKU
    expect(blackOpt?.sku).toBe("SKU-001");
    expect(silverOpt?.sku).toBe("SKU-002");
    
    // When user selects Silver, Add to Package should use SKU-002
    // (This is handled by WheelsStyleCard which uses finishThumbs[].sku)
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test Case 6: Normalize near-identical finish names
  // ═══════════════════════════════════════════════════════════════════════════
  it("should dedupe near-identical finish names", () => {
    const wheels: WheelVariantInput[] = [
      {
        sku: "SKU-001",
        brand: "Brand",
        model: "Model",
        diameter: "20",
        width: "9",
        finish: "Matte Black",
        imageUrl: "https://example.com/black1.jpg",
        price: 200,
      },
      {
        sku: "SKU-002",
        brand: "Brand",
        model: "Model",
        diameter: "20",
        width: "9",
        finish: "MATTE BLACK", // Same, different case
        imageUrl: "https://example.com/black2.jpg",
        price: 200,
      },
      {
        sku: "SKU-003",
        brand: "Brand",
        model: "Model",
        diameter: "20",
        width: "9",
        finish: "matte black", // Same, lowercase
        price: 200,
      },
    ];

    const result = groupWheelsBySpec(wheels);

    expect(result).toHaveLength(1);
    
    // Should only have ONE finish option (deduplicated)
    expect(result[0].finishOptions).toHaveLength(1);
    expect(result[0].finishOptions[0].finish).toBe("Matte Black");
    
    // Should use the SKU with image
    expect(result[0].finishOptions[0].imageUrl).toBe("https://example.com/black1.jpg");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test Case 7: Different offsets = separate cards
  // ═══════════════════════════════════════════════════════════════════════════
  it("should keep separate cards for different offsets", () => {
    const wheels: WheelVariantInput[] = [
      {
        sku: "WHEEL-OFFSET-0",
        brand: "Brand",
        model: "Model",
        diameter: "20",
        width: "9",
        offset: "0",
        finish: "Black",
        price: 200,
      },
      {
        sku: "WHEEL-OFFSET-NEG12",
        brand: "Brand",
        model: "Model",
        diameter: "20",
        width: "9",
        offset: "-12",
        finish: "Black",
        price: 220,
      },
    ];

    const result = groupWheelsBySpec(wheels);

    // Different offsets = separate cards
    expect(result).toHaveLength(2);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test Case 8: Empty/missing SKU = ungrouped
  // ═══════════════════════════════════════════════════════════════════════════
  it("should not crash on missing SKU", () => {
    const wheels: WheelVariantInput[] = [
      {
        sku: undefined, // Missing SKU
        brand: "Brand",
        model: "Model",
        diameter: "20",
        width: "9",
        finish: "Black",
      },
      {
        sku: "VALID-SKU",
        brand: "Brand",
        model: "Model",
        diameter: "20",
        width: "9",
        finish: "Silver",
      },
    ];

    const result = groupWheelsBySpec(wheels);

    // Should still return valid results
    expect(result.length).toBeGreaterThan(0);
    
    // Valid SKU should be grouped
    const validCard = result.find(r => r.sku === "VALID-SKU");
    expect(validCard).toBeDefined();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test Case 9: In-stock preference for default
  // ═══════════════════════════════════════════════════════════════════════════
  it("should prefer in-stock finishes over out-of-stock for default", () => {
    const wheels: WheelVariantInput[] = [
      {
        sku: "WHEEL-BLK",
        brand: "Brand",
        model: "Model",
        diameter: "20",
        width: "9",
        finish: "Black",
        imageUrl: "https://example.com/black.jpg",
        price: 200,
        stockQty: 0, // Out of stock
        inventoryType: "SO", // Special Order
      },
      {
        sku: "WHEEL-SIL",
        brand: "Brand",
        model: "Model",
        diameter: "20",
        width: "9",
        finish: "Silver",
        imageUrl: "https://example.com/silver.jpg",
        price: 220, // More expensive
        stockQty: 10, // In stock
        inventoryType: "ST", // Stock
      },
    ];

    const result = groupWheelsBySpec(wheels);

    expect(result).toHaveLength(1);
    
    // Should prefer in-stock Silver despite higher price
    expect(result[0].selectedFinish).toBe("Silver");
  });
});
