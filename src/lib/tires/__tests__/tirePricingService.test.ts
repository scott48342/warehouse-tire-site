/**
 * Unit tests for tire pricing service
 * 
 * Tests the isCommercialTruckSize classifier to ensure:
 * - Standard metric sizes are NOT classified as commercial
 * - Medium truck sizes ARE classified as commercial
 * - Flotation sizes ARE classified as commercial (40"+ diameter)
 */

import { describe, it, expect } from 'vitest';
import { 
  isCommercialTruckSize, 
  STANDARD_TIRE_ADDER, 
  COMMERCIAL_TIRE_ADDER,
  calculateTireSellPrice,
} from '../tirePricingService';

describe('isCommercialTruckSize', () => {
  describe('Standard Metric Sizes - MUST be false', () => {
    const standardMetricSizes = [
      '205/55R16',
      '215/55R16',
      '225/65R17',
      '235/55R20',
      '245/45R20',
      '265/70R17',
      '275/70R18',
      '285/45R22',
      '195/65R15',
      '225/45R18',
      '255/35R19',
      '305/30R20',
    ];

    it.each(standardMetricSizes)('"%s" should NOT be commercial', (size) => {
      expect(isCommercialTruckSize(size)).toBe(false);
    });
  });

  describe('LT Metric Sizes - should be false (standard pricing)', () => {
    const ltMetricSizes = [
      'LT245/75R16',
      'LT275/70R18',
      'LT285/65R20',
      'LT265/70R17',
      'LT315/70R17',
    ];

    it.each(ltMetricSizes)('"%s" should NOT be commercial (LT uses standard adder)', (size) => {
      expect(isCommercialTruckSize(size)).toBe(false);
    });
  });

  describe('ST Trailer Sizes - should be false (standard pricing)', () => {
    const stSizes = [
      'ST225/75R15',
      'ST205/75R15',
      'ST235/80R16',
    ];

    it.each(stSizes)('"%s" should NOT be commercial (ST uses standard adder)', (size) => {
      expect(isCommercialTruckSize(size)).toBe(false);
    });
  });

  describe('Medium Truck R-Style - MUST be true', () => {
    const mediumTruckRStyle = [
      '11R22.5',
      '12R22.5',
      '11R24.5',
      '12R24.5',
      '10R22.5',
    ];

    it.each(mediumTruckRStyle)('"%s" should be commercial', (size) => {
      expect(isCommercialTruckSize(size)).toBe(true);
    });
  });

  describe('Medium Truck Metric with Decimal Rim - MUST be true', () => {
    const mediumTruckMetric = [
      '225/70R19.5',
      '245/70R19.5',
      '255/70R22.5',
      '275/70R22.5',
      '295/75R22.5',
    ];

    it.each(mediumTruckMetric)('"%s" should be commercial', (size) => {
      expect(isCommercialTruckSize(size)).toBe(true);
    });
  });

  describe('Compact Numeric Formats - Commercial', () => {
    const compactCommercial = [
      '11225',      // 11R22.5
      '12225',      // 12R22.5
      '11245',      // 11R24.5
      '22570195',   // 225/70R19.5
      '24570195',   // 245/70R19.5
      '25570225',   // 255/70R22.5
    ];

    it.each(compactCommercial)('"%s" should be commercial', (size) => {
      expect(isCommercialTruckSize(size)).toBe(true);
    });
  });

  describe('Compact Numeric Formats - Standard', () => {
    const compactStandard = [
      '2155516',    // 215/55R16
      '2256517',    // 225/65R17
      '2754518',    // 275/45R18
    ];

    it.each(compactStandard)('"%s" should NOT be commercial', (size) => {
      expect(isCommercialTruckSize(size)).toBe(false);
    });
  });

  describe('Flotation Sizes - 40"+ diameter is commercial', () => {
    const flotationCommercial = [
      '40X15.50R22',
      '42X15.50R26',
      '44X19.50R26',
    ];

    it.each(flotationCommercial)('"%s" should be commercial (40"+ diameter)', (size) => {
      expect(isCommercialTruckSize(size)).toBe(true);
    });
  });

  describe('Flotation Sizes - Under 40" is standard', () => {
    const flotationStandard = [
      '35X12.50R20',
      '37X12.50R20',
      '37X13.50R22',
      '38X15.50R20',
      '33X12.50R18',
    ];

    it.each(flotationStandard)('"%s" should NOT be commercial (under 40")', (size) => {
      expect(isCommercialTruckSize(size)).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('empty string should be false', () => {
      expect(isCommercialTruckSize('')).toBe(false);
    });

    it('null/undefined should be false', () => {
      expect(isCommercialTruckSize(null as unknown as string)).toBe(false);
      expect(isCommercialTruckSize(undefined as unknown as string)).toBe(false);
    });

    it('lowercase should work the same', () => {
      expect(isCommercialTruckSize('215/55r16')).toBe(false);
      expect(isCommercialTruckSize('11r22.5')).toBe(true);
    });
  });
});

describe('Pricing Constants', () => {
  it('STANDARD_TIRE_ADDER should be $50', () => {
    expect(STANDARD_TIRE_ADDER).toBe(50);
  });

  it('COMMERCIAL_TIRE_ADDER should be $100', () => {
    expect(COMMERCIAL_TIRE_ADDER).toBe(100);
  });
});

describe('calculateTireSellPrice', () => {
  it('should add $50 for standard size 215/55R16', () => {
    const cost = 53.35;
    const price = calculateTireSellPrice(cost, '215/55R16');
    expect(price).toBe(103.35);
  });

  it('should add $100 for commercial size 11R22.5', () => {
    const cost = 200;
    const price = calculateTireSellPrice(cost, '11R22.5');
    expect(price).toBe(300);
  });

  it('should add $100 for commercial size 225/70R19.5', () => {
    const cost = 250;
    const price = calculateTireSellPrice(cost, '225/70R19.5');
    expect(price).toBe(350);
  });

  it('should return null for zero cost', () => {
    expect(calculateTireSellPrice(0, '215/55R16')).toBe(null);
  });

  it('should return null for negative cost', () => {
    expect(calculateTireSellPrice(-10, '215/55R16')).toBe(null);
  });

  it('should return null for null cost', () => {
    expect(calculateTireSellPrice(null, '215/55R16')).toBe(null);
  });
});

describe('Specific Bug Regression: LXST2031655020', () => {
  it('215/55R16 should NOT be commercial', () => {
    expect(isCommercialTruckSize('215/55R16')).toBe(false);
  });

  it('cost $53.35 + standard $50 = $103.35 (not $153.35)', () => {
    const cost = 53.35;
    const price = calculateTireSellPrice(cost, '215/55R16');
    expect(price).toBe(103.35);
    expect(price).not.toBe(153.35);
  });
});
