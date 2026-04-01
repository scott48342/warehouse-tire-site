/**
 * Regression tests for fitment resolution
 * 
 * These tests verify that specific vehicles with known data formats
 * resolve correctly through the entire fitment pipeline.
 * 
 * CRITICAL: The 2020 Camaro test guards against the string wheel size
 * parsing regression where "8.5Jx18" was not parsed, causing fake 17x8
 * wheel specs to be generated.
 */

import { parseWheelSizes, type WheelSize } from './profileService';
import { buildFitmentEnvelope, type OEMSpecs } from '@/lib/aftermarketFitment';

describe('Fitment Regression Tests', () => {
  describe('2020 Chevrolet Camaro Base (generation_template source)', () => {
    // This is the EXACT data format stored in production Vercel Postgres
    const CAMARO_RAW_WHEEL_SIZES = ['8.5Jx18', '8.5Jx19', '8.5Jx20', '10Jx20'];
    const CAMARO_BOLT_PATTERN = '5x120';
    const CAMARO_CENTER_BORE = 67.1;

    let parsedWheelSizes: WheelSize[];
    let envelope: ReturnType<typeof buildFitmentEnvelope>;

    beforeAll(() => {
      // Step 1: Parse wheel sizes (this is where the bug was)
      parsedWheelSizes = parseWheelSizes(CAMARO_RAW_WHEEL_SIZES);

      // Step 2: Build OEM specs from parsed sizes
      const wheelSpecs = parsedWheelSizes.map((ws) => ({
        rimDiameter: ws.diameter,
        rimWidth: ws.width,
        offset: ws.offset,
      }));

      const oemSpecs: OEMSpecs = {
        boltPattern: CAMARO_BOLT_PATTERN,
        centerBore: CAMARO_CENTER_BORE,
        wheelSpecs,
      };

      // Step 3: Build fitment envelope
      envelope = buildFitmentEnvelope(oemSpecs, 'aftermarket_safe');
    });

    it('parses all 4 wheel sizes from string format', () => {
      expect(parsedWheelSizes).toHaveLength(4);
    });

    it('extracts correct OEM diameters: 18, 19, 20', () => {
      const diameters = [...new Set(parsedWheelSizes.map((ws) => ws.diameter))].sort((a, b) => a - b);
      expect(diameters).toEqual([18, 19, 20]);
    });

    it('extracts correct OEM widths: 8.5, 10', () => {
      const widths = [...new Set(parsedWheelSizes.map((ws) => ws.width))].sort((a, b) => a - b);
      expect(widths).toEqual([8.5, 10]);
    });

    it('CRITICAL: does NOT contain fake 17x8 fallback values', () => {
      const has17Diameter = parsedWheelSizes.some((ws) => ws.diameter === 17);
      const has8Width = parsedWheelSizes.some((ws) => ws.width === 8);
      
      expect(has17Diameter).toBe(false);
      expect(has8Width).toBe(false);
    });

    it('builds envelope with correct OEM diameter range: 18-20', () => {
      expect(envelope.oemMinDiameter).toBe(18);
      expect(envelope.oemMaxDiameter).toBe(20);
    });

    it('builds envelope with correct allowed diameter range: 18-22 (+2 rule)', () => {
      expect(envelope.allowedMinDiameter).toBe(18);
      expect(envelope.allowedMaxDiameter).toBe(22);
    });

    it('builds envelope with correct OEM width range: 8.5-10', () => {
      expect(envelope.oemMinWidth).toBe(8.5);
      expect(envelope.oemMaxWidth).toBe(10);
    });

    it('REGRESSION: envelope should NOT show 17-19 (the buggy range)', () => {
      // Before the fix, fake 17x8 values caused:
      // - oemMinDiameter: 17
      // - oemMaxDiameter: 17
      // - allowedMaxDiameter: 19
      expect(envelope.oemMinDiameter).not.toBe(17);
      expect(envelope.oemMaxDiameter).not.toBe(17);
      expect(envelope.allowedMaxDiameter).not.toBe(19);
    });
  });

  describe('Object-format wheel sizes (backward compatibility)', () => {
    it('processes object-format wheel sizes without modification', () => {
      const objectWheelSizes = [
        { diameter: 17, width: 7.5, offset: 44, tireSize: '245/70R17', axle: 'both' as const, isStock: true },
        { diameter: 18, width: 7.5, offset: 34, tireSize: '265/60R18', axle: 'both' as const, isStock: true },
        { diameter: 20, width: 8.5, offset: 44, tireSize: '275/60R20', axle: 'both' as const, isStock: true },
      ];

      const parsed = parseWheelSizes(objectWheelSizes);

      expect(parsed).toHaveLength(3);
      expect(parsed[0].diameter).toBe(17);
      expect(parsed[0].width).toBe(7.5);
      expect(parsed[0].offset).toBe(44);
      expect(parsed[0].tireSize).toBe('245/70R17');
      expect(parsed[2].diameter).toBe(20);
    });
  });

  describe('Empty/missing wheel sizes', () => {
    it('returns empty array for empty wheel sizes', () => {
      const parsed = parseWheelSizes([]);
      expect(parsed).toEqual([]);
    });

    it('returns empty array for null wheel sizes', () => {
      const parsed = parseWheelSizes(null);
      expect(parsed).toEqual([]);
    });

    it('returns empty array for {} (empty object, not array)', () => {
      // This was the Railway DB scenario where oem_wheel_sizes was {}
      const parsed = parseWheelSizes({});
      expect(parsed).toEqual([]);
    });
  });
});
