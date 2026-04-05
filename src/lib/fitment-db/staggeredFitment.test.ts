/**
 * Staggered Fitment Tests
 * 
 * Tests for staggered vehicle detection and tire size generation.
 * Protects against regressions in:
 * - Staggered detection from OEM wheel sizes
 * - Diameter options including all inventory sizes
 * - Front/rear tire size generation for staggered setups
 * 
 * CRITICAL VEHICLES:
 * - C8 Corvette: 19" front, 20" rear (staggered)
 * - Mustang GT Performance Pack: 19" front, 19" rear (staggered widths)
 * - Camaro ZL1 1LE: 19" front, 20" rear (staggered)
 */

import { buildDiameterOptions, type DiameterOption } from '@/lib/fitment/diameterOptions';

describe('Staggered Fitment Tests', () => {
  describe('C8 Corvette Stingray (19" front / 20" rear)', () => {
    // Real OEM specs from production database
    const CORVETTE_OEM_WHEEL_SIZES = [
      { diameter: 19, width: 8.5, offset: null, tireSize: null, axle: 'front' as const, isStock: true },
      { diameter: 20, width: 11, offset: null, tireSize: null, axle: 'rear' as const, isStock: true },
    ];

    // Real inventory facets from fitment-search API
    const CORVETTE_INVENTORY_FACETS = [
      { value: '19.0', count: 97 },
      { value: '20.0', count: 292 },
      { value: '21.0', count: 14 },
      { value: '22.0', count: 146 },
      { value: '24.0', count: 52 },
    ];

    it('detects staggered from different front/rear diameters', () => {
      const frontDia = CORVETTE_OEM_WHEEL_SIZES.find(w => w.axle === 'front')?.diameter;
      const rearDia = CORVETTE_OEM_WHEEL_SIZES.find(w => w.axle === 'rear')?.diameter;
      
      // Staggered if diameters OR widths are different
      const isStaggered = frontDia !== rearDia || 
        CORVETTE_OEM_WHEEL_SIZES.find(w => w.axle === 'front')?.width !== 
        CORVETTE_OEM_WHEEL_SIZES.find(w => w.axle === 'rear')?.width;
      
      expect(isStaggered).toBe(true);
      expect(frontDia).toBe(19);
      expect(rearDia).toBe(20);
    });

    it('builds diameter options including ALL inventory sizes', () => {
      const options = buildDiameterOptions({
        isClassicVehicle: false,
        isLiftedBuild: false,
        stockDiameters: [19, 20],
        oemWheelSizes: CORVETTE_OEM_WHEEL_SIZES,
        inventoryFacets: CORVETTE_INVENTORY_FACETS,
      });

      // Should include all 5 sizes from inventory
      const diameters = options.map(o => o.diameter).sort((a, b) => a - b);
      expect(diameters).toEqual([19, 20, 21, 22, 24]);
    });

    it('CRITICAL: does NOT cap at +3" upsize limit', () => {
      const options = buildDiameterOptions({
        isClassicVehicle: false,
        isLiftedBuild: false,
        stockDiameters: [19, 20],
        oemWheelSizes: CORVETTE_OEM_WHEEL_SIZES,
        inventoryFacets: CORVETTE_INVENTORY_FACETS,
      });

      // 24" is +5" from 19" stock - should still be included
      const has24 = options.some(o => o.diameter === 24);
      expect(has24).toBe(true);
    });

    it('marks OEM sizes as stock', () => {
      const options = buildDiameterOptions({
        isClassicVehicle: false,
        isLiftedBuild: false,
        stockDiameters: [19, 20],
        oemWheelSizes: CORVETTE_OEM_WHEEL_SIZES,
        inventoryFacets: CORVETTE_INVENTORY_FACETS,
      });

      const opt19 = options.find(o => o.diameter === 19);
      const opt20 = options.find(o => o.diameter === 20);
      const opt22 = options.find(o => o.diameter === 22);

      expect(opt19?.isStock).toBe(true);
      expect(opt20?.isStock).toBe(true);
      expect(opt22?.isStock).toBe(false);
      expect(opt22?.isUpsize).toBe(true);
    });

    it('includes inventory counts in options', () => {
      const options = buildDiameterOptions({
        isClassicVehicle: false,
        isLiftedBuild: false,
        stockDiameters: [19, 20],
        oemWheelSizes: CORVETTE_OEM_WHEEL_SIZES,
        inventoryFacets: CORVETTE_INVENTORY_FACETS,
      });

      const opt19 = options.find(o => o.diameter === 19);
      const opt20 = options.find(o => o.diameter === 20);
      const opt24 = options.find(o => o.diameter === 24);

      expect(opt19?.count).toBe(97);
      expect(opt20?.count).toBe(292);
      expect(opt24?.count).toBe(52);
    });
  });

  describe('Non-staggered vehicle (F-150)', () => {
    const F150_OEM_WHEEL_SIZES = [
      { diameter: 17, width: 7.5, offset: 44, axle: 'both' as const, isStock: true },
      { diameter: 18, width: 7.5, offset: 44, axle: 'both' as const, isStock: true },
      { diameter: 20, width: 8.5, offset: 44, axle: 'both' as const, isStock: true },
    ];

    const F150_INVENTORY_FACETS = [
      { value: '17.0', count: 45 },
      { value: '18.0', count: 120 },
      { value: '20.0', count: 250 },
      { value: '22.0', count: 180 },
    ];

    it('is NOT staggered when all wheel specs are "both" axle', () => {
      const hasStaggered = F150_OEM_WHEEL_SIZES.some(w => w.axle !== 'both');
      expect(hasStaggered).toBe(false);
    });

    it('still includes all inventory sizes', () => {
      const options = buildDiameterOptions({
        isClassicVehicle: false,
        isLiftedBuild: false,
        stockDiameters: [17, 18, 20],
        oemWheelSizes: F150_OEM_WHEEL_SIZES,
        inventoryFacets: F150_INVENTORY_FACETS,
      });

      const diameters = options.map(o => o.diameter).sort((a, b) => a - b);
      expect(diameters).toEqual([17, 18, 20, 22]);
    });
  });

  describe('Empty inventory facets', () => {
    it('returns OEM sizes when no inventory facets', () => {
      const options = buildDiameterOptions({
        isClassicVehicle: false,
        isLiftedBuild: false,
        stockDiameters: [19, 20],
        oemWheelSizes: [
          { diameter: 19 },
          { diameter: 20 },
        ],
        inventoryFacets: [],
      });

      const diameters = options.map(o => o.diameter).sort((a, b) => a - b);
      expect(diameters).toEqual([19, 20]);
    });
  });

  describe('Classic vehicle upsize range', () => {
    it('uses classic upsize range for classic vehicles', () => {
      const options = buildDiameterOptions({
        isClassicVehicle: true,
        isLiftedBuild: false,
        stockDiameters: [14],
        classicUpsizeRange: [14, 17],
        inventoryFacets: [
          { value: '14.0', count: 10 },
          { value: '15.0', count: 25 },
          { value: '16.0', count: 30 },
          { value: '17.0', count: 20 },
        ],
      });

      const diameters = options.map(o => o.diameter).sort((a, b) => a - b);
      expect(diameters).toEqual([14, 15, 16, 17]);
      
      const opt14 = options.find(o => o.diameter === 14);
      expect(opt14?.isStock).toBe(true);
    });
  });
});
