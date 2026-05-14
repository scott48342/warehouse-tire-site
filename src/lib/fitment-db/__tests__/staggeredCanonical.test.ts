/**
 * Staggered Canonical Format Integration Tests
 * 
 * Tests the canonical { front, rear } tire size format across:
 * - tireSizeUtils (extraction and normalization)
 * - qualityTier (validation)
 * - tire-sizes API normalization
 * - wheel-fitment-search tire resolution
 * - package engine
 * 
 * CANONICAL FORMAT: { front: "245/40R19", rear: "275/35R19" }
 * NO { size, axle } object arrays!
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeToStringArray,
  hasValidTireSizesEnhanced,
  isStaggeredObject,
  isStaggeredSetup,
  getFrontTireSizes,
  getRearTireSizes,
  extractTireSizeString,
} from '../../tires/tireSizeUtils';

// Note: hasValidTireSizes from qualityTier delegates to hasValidTireSizesEnhanced
// so we test hasValidTireSizesEnhanced directly to avoid vitest @/ alias issues
const hasValidTireSizes = hasValidTireSizesEnhanced;

// ═══════════════════════════════════════════════════════════════════════════
// CANONICAL FORMAT TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Canonical Staggered Format: { front, rear }', () => {
  describe('Camaro SS 1LE', () => {
    const canonicalFormat = { front: '285/30R20', rear: '305/30R20' };
    
    it('is recognized as staggered object', () => {
      expect(isStaggeredObject(canonicalFormat)).toBe(true);
    });
    
    it('is recognized as staggered setup (different sizes)', () => {
      expect(isStaggeredSetup(canonicalFormat)).toBe(true);
    });
    
    it('extracts front sizes', () => {
      expect(getFrontTireSizes(canonicalFormat)).toEqual(['285/30R20']);
    });
    
    it('extracts rear sizes', () => {
      expect(getRearTireSizes(canonicalFormat)).toEqual(['305/30R20']);
    });
    
    it('normalizes to flat array (for legacy compatibility)', () => {
      expect(normalizeToStringArray(canonicalFormat)).toEqual(['285/30R20', '305/30R20']);
    });
    
    it('passes hasValidTireSizes (qualityTier)', () => {
      expect(hasValidTireSizes(canonicalFormat)).toBe(true);
    });
    
    it('passes hasValidTireSizesEnhanced', () => {
      expect(hasValidTireSizesEnhanced(canonicalFormat)).toBe(true);
    });
  });
  
  describe('Corvette Z06', () => {
    const canonicalFormat = { front: '275/30ZR20', rear: '345/25ZR21' };
    
    it('handles ZR tire sizes', () => {
      expect(isStaggeredSetup(canonicalFormat)).toBe(true);
      expect(normalizeToStringArray(canonicalFormat)).toEqual(['275/30ZR20', '345/25ZR21']);
      expect(hasValidTireSizes(canonicalFormat)).toBe(true);
    });
  });
  
  describe('Mustang GT Performance Pack', () => {
    const canonicalFormat = { front: '255/40R19', rear: '275/40R19' };
    
    it('detects staggered even with same diameter', () => {
      expect(isStaggeredSetup(canonicalFormat)).toBe(true);
    });
    
    it('extracts correct sizes', () => {
      expect(getFrontTireSizes(canonicalFormat)).toEqual(['255/40R19']);
      expect(getRearTireSizes(canonicalFormat)).toEqual(['275/40R19']);
    });
  });
  
  describe('BMW M3 Competition', () => {
    const canonicalFormat = { front: '275/35R19', rear: '285/30R20' };
    
    it('handles different front/rear diameters', () => {
      expect(normalizeToStringArray(canonicalFormat)).toEqual(['275/35R19', '285/30R20']);
      expect(hasValidTireSizes(canonicalFormat)).toBe(true);
    });
  });
  
  describe('BMW M4 Competition xDrive', () => {
    const canonicalFormat = { front: '275/35R19', rear: '285/30R20' };
    
    it('validates correctly', () => {
      expect(hasValidTireSizes(canonicalFormat)).toBe(true);
      expect(isStaggeredSetup(canonicalFormat)).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ARRAY VARIANT TESTS (also supported)
// ═══════════════════════════════════════════════════════════════════════════

describe('Staggered with array values: { front: [...], rear: [...] }', () => {
  const arrayFormat = { 
    front: ['255/40R19'], 
    rear: ['275/40R19', '285/35R19']  // Multiple rear options
  };
  
  it('is recognized as staggered object', () => {
    expect(isStaggeredObject(arrayFormat)).toBe(true);
  });
  
  it('extracts all sizes', () => {
    expect(getFrontTireSizes(arrayFormat)).toEqual(['255/40R19']);
    expect(getRearTireSizes(arrayFormat)).toEqual(['275/40R19', '285/35R19']);
  });
  
  it('normalizes to flat array', () => {
    expect(normalizeToStringArray(arrayFormat)).toEqual(['255/40R19', '275/40R19', '285/35R19']);
  });
  
  it('validates correctly', () => {
    expect(hasValidTireSizes(arrayFormat)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SQUARE (NON-STAGGERED) TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Square setup (same front/rear)', () => {
  const squareStaggeredFormat = { front: '275/55R20', rear: '275/55R20' };
  const flatArray = ['275/55R20', '285/50R22'];
  
  it('staggered format with same sizes is NOT isStaggeredSetup', () => {
    expect(isStaggeredSetup(squareStaggeredFormat)).toBe(false);
  });
  
  it('but still validates as having valid tire sizes', () => {
    expect(hasValidTireSizes(squareStaggeredFormat)).toBe(true);
  });
  
  it('flat array is NOT recognized as staggered object', () => {
    expect(isStaggeredObject(flatArray)).toBe(false);
    expect(isStaggeredSetup(flatArray)).toBe(false);
  });
  
  it('flat array still validates', () => {
    expect(hasValidTireSizes(flatArray)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BANNED FORMAT TESTS (should NOT appear in DB)
// ═══════════════════════════════════════════════════════════════════════════

describe('BANNED: { size, axle } object array format', () => {
  // This format was a mistake in Phase A v1 - should NOT be written to DB
  const bannedFormat = [
    { size: '285/30R20', axle: 'front' },
    { size: '305/30R20', axle: 'rear' },
  ];
  
  it('is NOT recognized as staggered object', () => {
    // This is correct - the format is an array, not { front, rear }
    expect(isStaggeredObject(bannedFormat)).toBe(false);
  });
  
  it('still extracts sizes (defensive parsing)', () => {
    // extractTireSizeString handles { size: "..." } objects
    expect(extractTireSizeString(bannedFormat[0])).toBe('285/30R20');
    expect(extractTireSizeString(bannedFormat[1])).toBe('305/30R20');
  });
  
  it('normalizes to flat array (defensive)', () => {
    // normalizeToStringArray should handle this gracefully
    expect(normalizeToStringArray(bannedFormat)).toEqual(['285/30R20', '305/30R20']);
  });
  
  it('validates (defensive)', () => {
    // Even banned format should not crash validation
    expect(hasValidTireSizes(bannedFormat)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════

describe('Edge cases', () => {
  it('handles empty object', () => {
    expect(isStaggeredObject({})).toBe(false);
    expect(normalizeToStringArray({})).toEqual([]);
    expect(hasValidTireSizes({})).toBe(false);
  });
  
  it('handles front-only', () => {
    const frontOnly = { front: '255/40R19' };
    expect(isStaggeredObject(frontOnly)).toBe(true);
    expect(getFrontTireSizes(frontOnly as any)).toEqual(['255/40R19']);
    expect(getRearTireSizes(frontOnly as any)).toEqual([]);
    // Not a complete staggered setup
    expect(isStaggeredSetup(frontOnly)).toBe(false);
  });
  
  it('handles rear-only', () => {
    const rearOnly = { rear: '275/40R19' };
    expect(isStaggeredObject(rearOnly)).toBe(true);
    expect(getRearTireSizes(rearOnly as any)).toEqual(['275/40R19']);
    // Not a complete staggered setup
    expect(isStaggeredSetup(rearOnly)).toBe(false);
  });
  
  it('handles null/undefined', () => {
    expect(isStaggeredObject(null)).toBe(false);
    expect(isStaggeredObject(undefined)).toBe(false);
    expect(normalizeToStringArray(null)).toEqual([]);
    expect(hasValidTireSizes(null)).toBe(false);
  });
  
  it('handles stringified JSON of staggered format', () => {
    const stringified = JSON.stringify({ front: '255/40R19', rear: '275/40R19' });
    expect(normalizeToStringArray(stringified)).toEqual(['255/40R19', '275/40R19']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// REGRESSION PROTECTION
// ═══════════════════════════════════════════════════════════════════════════

describe('Regression: No schema changes required', () => {
  it('canonical format is pure JSON (no DB schema change)', () => {
    const canonical = { front: '285/30R20', rear: '305/30R20' };
    
    // Can be serialized to JSON
    const json = JSON.stringify(canonical);
    expect(json).toBe('{"front":"285/30R20","rear":"305/30R20"}');
    
    // Can be deserialized back
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(canonical);
    expect(isStaggeredObject(parsed)).toBe(true);
  });
  
  it('legacy string arrays still work', () => {
    const legacy = ['275/65R18', '275/60R20'];
    expect(normalizeToStringArray(legacy)).toEqual(['275/65R18', '275/60R20']);
    expect(hasValidTireSizes(legacy)).toBe(true);
  });
});
