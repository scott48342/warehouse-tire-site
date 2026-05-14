import { describe, it, expect } from 'vitest';
import {
  extractTireSizeString,
  isStaggeredObject,
  normalizeToStringArray,
  hasValidTireSizesEnhanced,
  createStaggeredObject,
  isStaggeredSetup,
  parseStaggeredData,
  parseTireSize,
  getFrontTireSizes,
  getRearTireSizes,
} from '../tireSizeUtils';

describe('extractTireSizeString', () => {
  it('handles string input', () => {
    expect(extractTireSizeString('275/65R18')).toBe('275/65R18');
    expect(extractTireSizeString('  285/30R20  ')).toBe('285/30R20');
  });
  
  it('handles object with size property', () => {
    expect(extractTireSizeString({ size: '275/65R18' })).toBe('275/65R18');
    expect(extractTireSizeString({ size: '285/30R20', axle: 'front' })).toBe('285/30R20');
  });
  
  it('handles object with tireSize property', () => {
    expect(extractTireSizeString({ tireSize: '275/65R18' })).toBe('275/65R18');
  });
  
  it('handles object with width/aspectRatio/diameter', () => {
    expect(extractTireSizeString({ width: 275, aspectRatio: 65, diameter: 18 })).toBe('275/65R18');
  });
  
  it('returns null for invalid inputs', () => {
    expect(extractTireSizeString(null)).toBeNull();
    expect(extractTireSizeString(undefined)).toBeNull();
    expect(extractTireSizeString({})).toBeNull();
    expect(extractTireSizeString({ foo: 'bar' })).toBeNull();
    expect(extractTireSizeString(123)).toBeNull();
  });
});

describe('isStaggeredObject', () => {
  it('returns true for staggered objects', () => {
    expect(isStaggeredObject({ front: '245/40R19', rear: '275/35R19' })).toBe(true);
    expect(isStaggeredObject({ front: ['245/40R19'], rear: ['275/35R19'] })).toBe(true);
    expect(isStaggeredObject({ front: '245/40R19' })).toBe(true); // front only
    expect(isStaggeredObject({ rear: '275/35R19' })).toBe(true);  // rear only
  });
  
  it('returns false for non-staggered objects', () => {
    expect(isStaggeredObject(null)).toBe(false);
    expect(isStaggeredObject(undefined)).toBe(false);
    expect(isStaggeredObject('275/65R18')).toBe(false);
    expect(isStaggeredObject(['275/65R18'])).toBe(false);
    expect(isStaggeredObject({ size: '275/65R18' })).toBe(false);
    expect(isStaggeredObject({})).toBe(false);
  });
});

describe('normalizeToStringArray', () => {
  it('handles string array input', () => {
    expect(normalizeToStringArray(['275/65R18', '285/30R20'])).toEqual(['275/65R18', '285/30R20']);
  });
  
  it('handles object array input', () => {
    expect(normalizeToStringArray([{ size: '275/65R18' }, { size: '285/30R20' }]))
      .toEqual(['275/65R18', '285/30R20']);
  });
  
  it('handles staggered object input', () => {
    expect(normalizeToStringArray({ front: '245/40R19', rear: '275/35R19' }))
      .toEqual(['245/40R19', '275/35R19']);
  });
  
  it('handles staggered array input', () => {
    expect(normalizeToStringArray({ front: ['245/40R19'], rear: ['275/35R19'] }))
      .toEqual(['245/40R19', '275/35R19']);
  });
  
  it('handles stringified JSON', () => {
    expect(normalizeToStringArray('["275/65R18", "285/30R20"]'))
      .toEqual(['275/65R18', '285/30R20']);
  });
  
  it('deduplicates sizes', () => {
    expect(normalizeToStringArray(['275/65R18', '275/65R18', '285/30R20']))
      .toEqual(['275/65R18', '285/30R20']);
  });
  
  it('handles mixed format arrays', () => {
    expect(normalizeToStringArray([
      '275/65R18',
      { size: '285/30R20' },
      { tireSize: '305/30R20' },
    ])).toEqual(['275/65R18', '285/30R20', '305/30R20']);
  });
  
  it('returns empty array for null/undefined', () => {
    expect(normalizeToStringArray(null)).toEqual([]);
    expect(normalizeToStringArray(undefined)).toEqual([]);
  });
});

describe('hasValidTireSizesEnhanced', () => {
  it('returns true for valid string arrays', () => {
    expect(hasValidTireSizesEnhanced(['275/65R18'])).toBe(true);
    expect(hasValidTireSizesEnhanced(['P255/40R19'])).toBe(true);
  });
  
  it('returns true for valid staggered objects', () => {
    expect(hasValidTireSizesEnhanced({ front: '245/40R19', rear: '275/35R19' })).toBe(true);
  });
  
  it('returns false for empty/invalid inputs', () => {
    expect(hasValidTireSizesEnhanced(null)).toBe(false);
    expect(hasValidTireSizesEnhanced([])).toBe(false);
    expect(hasValidTireSizesEnhanced(['invalid'])).toBe(false);
    expect(hasValidTireSizesEnhanced({ front: 'invalid' })).toBe(false);
  });
});

describe('createStaggeredObject', () => {
  it('creates canonical staggered format', () => {
    expect(createStaggeredObject('245/40R19', '275/35R19')).toEqual({
      front: '245/40R19',
      rear: '275/35R19',
    });
  });
});

describe('isStaggeredSetup', () => {
  it('returns true when front and rear are different', () => {
    expect(isStaggeredSetup({ front: '245/40R19', rear: '275/35R19' })).toBe(true);
    expect(isStaggeredSetup({ front: ['245/40R19'], rear: ['275/35R19'] })).toBe(true);
  });
  
  it('returns false when front and rear are same', () => {
    expect(isStaggeredSetup({ front: '275/65R18', rear: '275/65R18' })).toBe(false);
    expect(isStaggeredSetup({ front: ['275/65R18'], rear: ['275/65R18'] })).toBe(false);
  });
  
  it('returns false for non-staggered formats', () => {
    expect(isStaggeredSetup(['275/65R18'])).toBe(false);
    expect(isStaggeredSetup('275/65R18')).toBe(false);
  });
});

describe('getFrontTireSizes / getRearTireSizes', () => {
  const staggered = { front: '245/40R19', rear: '275/35R19' };
  const staggeredArrays = { front: ['245/40R19', '255/40R19'], rear: ['275/35R19'] };
  
  it('extracts front sizes', () => {
    expect(getFrontTireSizes(staggered)).toEqual(['245/40R19']);
    expect(getFrontTireSizes(staggeredArrays)).toEqual(['245/40R19', '255/40R19']);
  });
  
  it('extracts rear sizes', () => {
    expect(getRearTireSizes(staggered)).toEqual(['275/35R19']);
    expect(getRearTireSizes(staggeredArrays)).toEqual(['275/35R19']);
  });
  
  it('returns empty array when property missing', () => {
    expect(getFrontTireSizes({ rear: '275/35R19' } as any)).toEqual([]);
    expect(getRearTireSizes({ front: '245/40R19' } as any)).toEqual([]);
  });
});

describe('parseStaggeredData', () => {
  it('parses staggered object', () => {
    const result = parseStaggeredData({ front: '245/40R19', rear: '275/35R19' });
    expect(result).toEqual({
      front: ['245/40R19'],
      rear: ['275/35R19'],
      isStaggered: true,
    });
  });
  
  it('returns null for non-staggered input', () => {
    expect(parseStaggeredData(['275/65R18'])).toBeNull();
    expect(parseStaggeredData('275/65R18')).toBeNull();
  });
});

describe('parseTireSize', () => {
  it('parses standard metric sizes', () => {
    expect(parseTireSize('275/65R18')).toEqual({
      original: '275/65R18',
      width: 275,
      aspectRatio: 65,
      rimDiameter: 18,
    });
  });
  
  it('parses P-metric sizes', () => {
    expect(parseTireSize('P255/40R19')).toEqual({
      original: 'P255/40R19',
      width: 255,
      aspectRatio: 40,
      rimDiameter: 19,
    });
  });
  
  it('parses ZR sizes', () => {
    expect(parseTireSize('285/30ZR20')).toEqual({
      original: '285/30ZR20',
      width: 285,
      aspectRatio: 30,
      rimDiameter: 20,
    });
  });
  
  it('returns null for invalid sizes', () => {
    expect(parseTireSize('invalid')).toBeNull();
    expect(parseTireSize('35x12.50R20')).toBeNull(); // flotation format not supported by this regex
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// REGRESSION TESTS - Phase A scenarios
// ═══════════════════════════════════════════════════════════════════════════

describe('Phase A Regression Tests', () => {
  describe('Camaro SS 1LE staggered data', () => {
    const staggeredFormat = { front: '285/30R20', rear: '305/30R20' };
    
    it('normalizes to string array', () => {
      expect(normalizeToStringArray(staggeredFormat))
        .toEqual(['285/30R20', '305/30R20']);
    });
    
    it('validates as having valid tire sizes', () => {
      expect(hasValidTireSizesEnhanced(staggeredFormat)).toBe(true);
    });
    
    it('detects as staggered setup', () => {
      expect(isStaggeredSetup(staggeredFormat)).toBe(true);
    });
  });
  
  describe('Corvette Z06 staggered data', () => {
    const staggeredFormat = { front: '275/30ZR20', rear: '345/25ZR21' };
    
    it('normalizes to string array', () => {
      expect(normalizeToStringArray(staggeredFormat))
        .toEqual(['275/30ZR20', '345/25ZR21']);
    });
    
    it('validates as having valid tire sizes', () => {
      expect(hasValidTireSizesEnhanced(staggeredFormat)).toBe(true);
    });
  });
  
  describe('BMW M4 Competition staggered data', () => {
    const staggeredFormat = { front: '275/35R19', rear: '285/30R20' };
    
    it('normalizes correctly', () => {
      expect(normalizeToStringArray(staggeredFormat))
        .toEqual(['275/35R19', '285/30R20']);
    });
  });
  
  describe('Backward compatibility with string arrays', () => {
    it('still works with plain string arrays', () => {
      const legacy = ['285/30R20', '305/30R20'];
      expect(normalizeToStringArray(legacy)).toEqual(['285/30R20', '305/30R20']);
      expect(hasValidTireSizesEnhanced(legacy)).toBe(true);
    });
  });
  
  describe('No crash on object array format (Phase A mistake)', () => {
    // This was the format that broke things
    const objectArrayFormat = [
      { size: '285/30R20', axle: 'front' },
      { size: '305/30R20', axle: 'rear' },
    ];
    
    it('extracts sizes without crashing', () => {
      expect(normalizeToStringArray(objectArrayFormat))
        .toEqual(['285/30R20', '305/30R20']);
    });
    
    it('validates correctly', () => {
      expect(hasValidTireSizesEnhanced(objectArrayFormat)).toBe(true);
    });
  });
});
