/**
 * Unit tests for wheel size parsing functions
 * 
 * These tests guard against regression where string-format wheel sizes
 * (e.g., "8.5Jx18" from generation_template source) were not parsed,
 * causing fallback to fake 17x8 values.
 */

import { parseWheelSizeEntry, parseWheelSizes, type WheelSize } from './profileService';

describe('parseWheelSizeEntry', () => {
  describe('string format parsing', () => {
    it('parses "8.5Jx18" correctly', () => {
      const result = parseWheelSizeEntry('8.5Jx18');
      expect(result).not.toBeNull();
      expect(result!.diameter).toBe(18);
      expect(result!.width).toBe(8.5);
      expect(result!.axle).toBe('both');
      expect(result!.isStock).toBe(true);
    });

    it('parses "10Jx20" correctly', () => {
      const result = parseWheelSizeEntry('10Jx20');
      expect(result).not.toBeNull();
      expect(result!.diameter).toBe(20);
      expect(result!.width).toBe(10);
    });

    it('parses "8.5Jx19" correctly', () => {
      const result = parseWheelSizeEntry('8.5Jx19');
      expect(result).not.toBeNull();
      expect(result!.diameter).toBe(19);
      expect(result!.width).toBe(8.5);
    });

    it('parses without J suffix: "8.5x18"', () => {
      const result = parseWheelSizeEntry('8.5x18');
      expect(result).not.toBeNull();
      expect(result!.diameter).toBe(18);
      expect(result!.width).toBe(8.5);
    });

    it('parses lowercase j: "8.5jx18"', () => {
      const result = parseWheelSizeEntry('8.5jx18');
      expect(result).not.toBeNull();
      expect(result!.diameter).toBe(18);
      expect(result!.width).toBe(8.5);
    });

    it('handles whitespace: " 8.5Jx18 "', () => {
      const result = parseWheelSizeEntry(' 8.5Jx18 ');
      expect(result).not.toBeNull();
      expect(result!.diameter).toBe(18);
    });

    it('parses uppercase X: "8.5JX18"', () => {
      const result = parseWheelSizeEntry('8.5JX18');
      expect(result).not.toBeNull();
      expect(result!.diameter).toBe(18);
    });
  });

  describe('object format parsing', () => {
    it('passes through valid object with diameter/width', () => {
      const input = { diameter: 20, width: 9.5, offset: 35, tireSize: '275/40R20', axle: 'rear' as const, isStock: true };
      const result = parseWheelSizeEntry(input);
      expect(result).not.toBeNull();
      expect(result!.diameter).toBe(20);
      expect(result!.width).toBe(9.5);
      expect(result!.offset).toBe(35);
      expect(result!.tireSize).toBe('275/40R20');
      expect(result!.axle).toBe('rear');
    });

    it('handles rimDiameter/rimWidth aliases', () => {
      const input = { rimDiameter: 18, rimWidth: 8 };
      const result = parseWheelSizeEntry(input);
      expect(result).not.toBeNull();
      expect(result!.diameter).toBe(18);
      expect(result!.width).toBe(8);
    });

    it('defaults axle to "both" when not specified', () => {
      const input = { diameter: 18, width: 8 };
      const result = parseWheelSizeEntry(input);
      expect(result).not.toBeNull();
      expect(result!.axle).toBe('both');
    });

    it('defaults isStock to true when not specified', () => {
      const input = { diameter: 18, width: 8 };
      const result = parseWheelSizeEntry(input);
      expect(result).not.toBeNull();
      expect(result!.isStock).toBe(true);
    });
  });

  describe('invalid input handling', () => {
    it('returns null for empty string', () => {
      expect(parseWheelSizeEntry('')).toBeNull();
    });

    it('returns null for random text', () => {
      expect(parseWheelSizeEntry('not a wheel size')).toBeNull();
    });

    it('returns null for null input', () => {
      expect(parseWheelSizeEntry(null)).toBeNull();
    });

    it('returns null for undefined input', () => {
      expect(parseWheelSizeEntry(undefined)).toBeNull();
    });

    it('returns null for number input', () => {
      expect(parseWheelSizeEntry(18)).toBeNull();
    });

    it('returns null for object with no diameter/width', () => {
      expect(parseWheelSizeEntry({ foo: 'bar' })).toBeNull();
    });

    it('returns null for diameter out of range (too small)', () => {
      expect(parseWheelSizeEntry('8x10')).toBeNull(); // 10 < 13
    });

    it('returns null for diameter out of range (too large)', () => {
      expect(parseWheelSizeEntry('8x35')).toBeNull(); // 35 > 30
    });

    // CRITICAL: This tests the exact regression scenario
    it('DOES NOT return fake 17x8 fallback for invalid input', () => {
      const result = parseWheelSizeEntry('invalid');
      expect(result).toBeNull();
      // Previously, code would return {diameter: 17, width: 8} as fallback
      // Now it must return null so the caller knows parsing failed
    });
  });
});

describe('parseWheelSizes', () => {
  it('parses array of string wheel sizes (Camaro production data)', () => {
    const input = ['8.5Jx18', '8.5Jx19', '8.5Jx20', '10Jx20'];
    const result = parseWheelSizes(input);
    
    expect(result).toHaveLength(4);
    expect(result.map(ws => ws.diameter)).toEqual([18, 19, 20, 20]);
    expect(result.map(ws => ws.width)).toEqual([8.5, 8.5, 8.5, 10]);
  });

  it('parses array of object wheel sizes', () => {
    const input = [
      { diameter: 18, width: 8 },
      { diameter: 20, width: 9, offset: 35 },
    ];
    const result = parseWheelSizes(input);
    
    expect(result).toHaveLength(2);
    expect(result[0].diameter).toBe(18);
    expect(result[1].diameter).toBe(20);
    expect(result[1].offset).toBe(35);
  });

  it('handles mixed valid and invalid entries (filters out invalid)', () => {
    const input = ['8.5Jx18', 'invalid', '10Jx20', null, { diameter: 19, width: 8.5 }];
    const result = parseWheelSizes(input);
    
    expect(result).toHaveLength(3);
    expect(result.map(ws => ws.diameter)).toEqual([18, 20, 19]);
  });

  it('returns empty array for non-array input', () => {
    expect(parseWheelSizes(null)).toEqual([]);
    expect(parseWheelSizes(undefined)).toEqual([]);
    expect(parseWheelSizes('8.5Jx18')).toEqual([]);
    expect(parseWheelSizes({})).toEqual([]);
  });

  it('returns empty array for empty array input', () => {
    expect(parseWheelSizes([])).toEqual([]);
  });

  // CRITICAL: Regression test - no silent fallbacks creating fake data
  it('does NOT create fake entries for unparseable data', () => {
    const input = ['invalid1', 'invalid2', 'notawheel'];
    const result = parseWheelSizes(input);
    
    expect(result).toHaveLength(0);
    // Previously, this might have returned [{diameter:17, width:8}, ...] 
    // due to silent fallbacks. Now it must return empty array.
  });
});
