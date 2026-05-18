/**
 * BMW Model Number Extraction Tests
 * 
 * Tests for extractBmwModelAndTrim() which handles BMW's model number convention:
 * - "328i" → model: "3 Series", trim: "328i"
 * - "535i" → model: "5 Series", trim: "535i"
 * - "M340i" → model: "3 Series", trim: "M340i"
 */

import { extractBmwModelAndTrim } from "../modelAliases";

describe("extractBmwModelAndTrim", () => {
  describe("3 Series variants", () => {
    it("should extract 328i correctly", () => {
      const result = extractBmwModelAndTrim("BMW", "328i");
      expect(result.isBmwModelNumber).toBe(true);
      expect(result.modelName).toBe("3 Series");
      expect(result.trimName).toBe("328i");
    });

    it("should extract 335i correctly", () => {
      const result = extractBmwModelAndTrim("BMW", "335i");
      expect(result.isBmwModelNumber).toBe(true);
      expect(result.modelName).toBe("3 Series");
      expect(result.trimName).toBe("335i");
    });

    it("should extract 330i correctly", () => {
      const result = extractBmwModelAndTrim("BMW", "330i");
      expect(result.isBmwModelNumber).toBe(true);
      expect(result.modelName).toBe("3 Series");
      expect(result.trimName).toBe("330i");
    });

    it("should extract M340i correctly", () => {
      const result = extractBmwModelAndTrim("BMW", "M340i");
      expect(result.isBmwModelNumber).toBe(true);
      expect(result.modelName).toBe("3 Series");
      expect(result.trimName).toBe("M340i");
    });

    it("should extract 328xi correctly", () => {
      const result = extractBmwModelAndTrim("BMW", "328xi");
      expect(result.isBmwModelNumber).toBe(true);
      expect(result.modelName).toBe("3 Series");
      expect(result.trimName).toBe("328xi");
    });

    it("should extract 330e correctly (PHEV)", () => {
      const result = extractBmwModelAndTrim("BMW", "330e");
      expect(result.isBmwModelNumber).toBe(true);
      expect(result.modelName).toBe("3 Series");
      expect(result.trimName).toBe("330e");
    });
  });

  describe("5 Series variants", () => {
    it("should extract 528i correctly", () => {
      const result = extractBmwModelAndTrim("BMW", "528i");
      expect(result.isBmwModelNumber).toBe(true);
      expect(result.modelName).toBe("5 Series");
      expect(result.trimName).toBe("528i");
    });

    it("should extract 535i correctly", () => {
      const result = extractBmwModelAndTrim("BMW", "535i");
      expect(result.isBmwModelNumber).toBe(true);
      expect(result.modelName).toBe("5 Series");
      expect(result.trimName).toBe("535i");
    });

    it("should extract 550i correctly", () => {
      const result = extractBmwModelAndTrim("BMW", "550i");
      expect(result.isBmwModelNumber).toBe(true);
      expect(result.modelName).toBe("5 Series");
      expect(result.trimName).toBe("550i");
    });

    it("should extract M550i correctly", () => {
      const result = extractBmwModelAndTrim("BMW", "M550i");
      expect(result.isBmwModelNumber).toBe(true);
      expect(result.modelName).toBe("5 Series");
      expect(result.trimName).toBe("M550i");
    });
  });

  describe("7 Series variants", () => {
    it("should extract 750i correctly", () => {
      const result = extractBmwModelAndTrim("BMW", "750i");
      expect(result.isBmwModelNumber).toBe(true);
      expect(result.modelName).toBe("7 Series");
      expect(result.trimName).toBe("750i");
    });

    it("should extract 750Li correctly", () => {
      const result = extractBmwModelAndTrim("BMW", "750Li");
      expect(result.isBmwModelNumber).toBe(true);
      expect(result.modelName).toBe("7 Series");
      expect(result.trimName).toBe("750Li");
    });
  });

  describe("xDrive variants", () => {
    it("should extract 328i xDrive correctly", () => {
      const result = extractBmwModelAndTrim("BMW", "328i xDrive");
      expect(result.isBmwModelNumber).toBe(true);
      expect(result.modelName).toBe("3 Series");
      expect(result.trimName).toBe("328i xDrive");
    });

    it("should extract 330i xDrive correctly", () => {
      const result = extractBmwModelAndTrim("BMW", "330i xDrive");
      expect(result.isBmwModelNumber).toBe(true);
      expect(result.modelName).toBe("3 Series");
      expect(result.trimName).toBe("330i xDrive");
    });

    it("should extract 535i xDrive correctly", () => {
      const result = extractBmwModelAndTrim("BMW", "535i xDrive");
      expect(result.isBmwModelNumber).toBe(true);
      expect(result.modelName).toBe("5 Series");
      expect(result.trimName).toBe("535i xDrive");
    });

    it("should normalize xdrive casing", () => {
      const result = extractBmwModelAndTrim("BMW", "328i XDRIVE");
      expect(result.isBmwModelNumber).toBe(true);
      expect(result.modelName).toBe("3 Series");
      expect(result.trimName).toBe("328i xDrive");
    });
  });

  describe("M-Series standalone models", () => {
    it("should NOT extract M3 as a model number (it's a direct model)", () => {
      const result = extractBmwModelAndTrim("BMW", "M3");
      expect(result.isBmwModelNumber).toBe(false);
      expect(result.modelName).toBeNull();
    });

    it("should NOT extract M4 as a model number (it's a direct model)", () => {
      const result = extractBmwModelAndTrim("BMW", "M4");
      expect(result.isBmwModelNumber).toBe(false);
      expect(result.modelName).toBeNull();
    });

    it("should NOT extract M5 as a model number (it's a direct model)", () => {
      const result = extractBmwModelAndTrim("BMW", "M5");
      expect(result.isBmwModelNumber).toBe(false);
      expect(result.modelName).toBeNull();
    });
  });

  describe("Non-BMW makes", () => {
    it("should NOT extract for non-BMW makes", () => {
      const result = extractBmwModelAndTrim("Ford", "328i");
      expect(result.isBmwModelNumber).toBe(false);
      expect(result.modelName).toBeNull();
    });

    it("should NOT extract for Audi", () => {
      const result = extractBmwModelAndTrim("Audi", "A4");
      expect(result.isBmwModelNumber).toBe(false);
    });

    it("should be case-insensitive for make", () => {
      const result = extractBmwModelAndTrim("bmw", "328i");
      expect(result.isBmwModelNumber).toBe(true);
      expect(result.modelName).toBe("3 Series");
    });
  });

  describe("Non-model-number inputs", () => {
    it("should NOT extract '3 Series' (already a model name)", () => {
      const result = extractBmwModelAndTrim("BMW", "3 Series");
      expect(result.isBmwModelNumber).toBe(false);
    });

    it("should NOT extract 'X5' (X-Series is a direct model)", () => {
      const result = extractBmwModelAndTrim("BMW", "X5");
      expect(result.isBmwModelNumber).toBe(false);
    });

    it("should NOT extract 'Z4' (Z-Series is a direct model)", () => {
      const result = extractBmwModelAndTrim("BMW", "Z4");
      expect(result.isBmwModelNumber).toBe(false);
    });

    it("should NOT extract invalid patterns", () => {
      const result = extractBmwModelAndTrim("BMW", "Sedan");
      expect(result.isBmwModelNumber).toBe(false);
    });
  });

  describe("Other series", () => {
    it("should extract 228i correctly (2 Series)", () => {
      const result = extractBmwModelAndTrim("BMW", "228i");
      expect(result.isBmwModelNumber).toBe(true);
      expect(result.modelName).toBe("2 Series");
      expect(result.trimName).toBe("228i");
    });

    it("should extract 430i correctly (4 Series)", () => {
      const result = extractBmwModelAndTrim("BMW", "430i");
      expect(result.isBmwModelNumber).toBe(true);
      expect(result.modelName).toBe("4 Series");
      expect(result.trimName).toBe("430i");
    });

    it("should extract 640i correctly (6 Series)", () => {
      const result = extractBmwModelAndTrim("BMW", "640i");
      expect(result.isBmwModelNumber).toBe(true);
      expect(result.modelName).toBe("6 Series");
      expect(result.trimName).toBe("640i");
    });

    it("should extract 840i correctly (8 Series)", () => {
      const result = extractBmwModelAndTrim("BMW", "840i");
      expect(result.isBmwModelNumber).toBe(true);
      expect(result.modelName).toBe("8 Series");
      expect(result.trimName).toBe("840i");
    });
  });
});
