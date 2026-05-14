/**
 * Tests for trim explosion logic
 */

import { isGroupedTrim, explodeTrim } from '../trimExplosion';

describe('trimExplosion', () => {
  describe('isGroupedTrim', () => {
    // Comma-separated trims (always grouped)
    it('detects comma-separated trims as grouped', () => {
      expect(isGroupedTrim('LX, Sport, EX')).toBe(true);
      expect(isGroupedTrim('Base, Technology, A-Spec')).toBe(true);
      expect(isGroupedTrim('LS, LT, Premier')).toBe(true);
    });

    // Spaced slash trims (always grouped)
    it('detects spaced slash trims as grouped', () => {
      expect(isGroupedTrim('SXT / SXT Plus')).toBe(true);
      expect(isGroupedTrim('Base / Sport')).toBe(true);
    });

    // Compact slash - grouped (NEW behavior)
    describe('compact slash - grouped cases', () => {
      it('detects Titanium/Sport as grouped', () => {
        expect(isGroupedTrim('Titanium/Sport')).toBe(true);
      });

      it('detects LT/Premier as grouped', () => {
        expect(isGroupedTrim('LT/Premier')).toBe(true);
      });

      it('detects Limited/Touring as grouped', () => {
        expect(isGroupedTrim('Limited/Touring')).toBe(true);
      });

      it('detects EX/SX as grouped', () => {
        expect(isGroupedTrim('EX/SX')).toBe(true);
      });

      it('detects LX/Touring as grouped', () => {
        expect(isGroupedTrim('LX/Touring')).toBe(true);
      });

      it('detects XL/XLE as grouped', () => {
        expect(isGroupedTrim('XL/XLE')).toBe(true);
      });

      it('detects SE/Hybrid as grouped', () => {
        expect(isGroupedTrim('SE/Hybrid')).toBe(true);
      });

      it('detects GLS/GT as grouped', () => {
        expect(isGroupedTrim('GLS/GT')).toBe(true);
      });

      it('detects multi-slash trims as grouped', () => {
        expect(isGroupedTrim('LX/Sport/EX')).toBe(true);
        expect(isGroupedTrim('Base/LE/XLE')).toBe(true);
      });
    });

    // Compact slash - NOT grouped (known patterns)
    describe('compact slash - single trim cases (not grouped)', () => {
      it('does NOT detect R/T as grouped', () => {
        expect(isGroupedTrim('R/T')).toBe(false);
      });

      it('does NOT detect R/T variants as grouped', () => {
        expect(isGroupedTrim('R/T Scat Pack')).toBe(false);
        expect(isGroupedTrim('R/T Scat Pack Widebody')).toBe(false);
        expect(isGroupedTrim('R/T Classic')).toBe(false);
        expect(isGroupedTrim('Daytona R/T')).toBe(false);
      });

      it('does NOT detect T/A as grouped', () => {
        expect(isGroupedTrim('T/A')).toBe(false);
      });

      it('does NOT detect Z/28 as grouped', () => {
        expect(isGroupedTrim('Z/28')).toBe(false);
      });

      it('does NOT detect GT/CS as grouped', () => {
        expect(isGroupedTrim('GT/CS')).toBe(false);
      });

      it('does NOT detect w/ notation as grouped', () => {
        expect(isGroupedTrim('SE w/Tech')).toBe(false);
        expect(isGroupedTrim('Adventure w/All-Terrain Pkg')).toBe(false);
        expect(isGroupedTrim('LT w/RS Pkg.')).toBe(false);
      });

      it('does NOT detect drive type notations as grouped', () => {
        expect(isGroupedTrim('2WD/4WD')).toBe(false);
      });

      it('does NOT detect engine notations as grouped', () => {
        expect(isGroupedTrim('DB11 V8/V12')).toBe(false);
      });

      it('does NOT detect short alphanumeric patterns as grouped', () => {
        expect(isGroupedTrim('B3/B4')).toBe(false);
      });
    });

    // Non-grouped (no separators)
    it('does NOT detect single trims as grouped', () => {
      expect(isGroupedTrim('Sport')).toBe(false);
      expect(isGroupedTrim('GT Performance Pack')).toBe(false);
      expect(isGroupedTrim('SRT Hellcat')).toBe(false);
    });

    // Edge cases
    it('handles empty/null input', () => {
      expect(isGroupedTrim('')).toBe(false);
      expect(isGroupedTrim(null as any)).toBe(false);
      expect(isGroupedTrim(undefined as any)).toBe(false);
    });
  });

  describe('explodeTrim', () => {
    // Comma-separated
    it('explodes comma-separated trims', () => {
      expect(explodeTrim('LX, Sport, EX')).toEqual(['LX', 'Sport', 'EX']);
      expect(explodeTrim('Base, Technology, A-Spec')).toEqual(['Base', 'Technology', 'A-Spec']);
    });

    // Spaced slash
    it('explodes spaced slash trims', () => {
      expect(explodeTrim('SXT / SXT Plus')).toEqual(['SXT', 'SXT Plus']);
    });

    // Compact slash - grouped
    describe('compact slash - grouped cases', () => {
      it('explodes Titanium/Sport', () => {
        expect(explodeTrim('Titanium/Sport')).toEqual(['Titanium', 'Sport']);
      });

      it('explodes LT/Premier', () => {
        expect(explodeTrim('LT/Premier')).toEqual(['LT', 'Premier']);
      });

      it('explodes multi-slash trims', () => {
        expect(explodeTrim('LX/Sport/EX')).toEqual(['LX', 'Sport', 'EX']);
        expect(explodeTrim('Base/LE/XLE')).toEqual(['Base', 'LE', 'XLE']);
      });
    });

    // Compact slash - NOT grouped (known patterns)
    describe('compact slash - single trim cases (not exploded)', () => {
      it('does NOT explode R/T', () => {
        expect(explodeTrim('R/T')).toEqual(['R/T']);
      });

      it('does NOT explode R/T variants', () => {
        expect(explodeTrim('R/T Scat Pack')).toEqual(['R/T Scat Pack']);
      });

      it('does NOT explode w/ notation', () => {
        expect(explodeTrim('SE w/Tech')).toEqual(['SE w/Tech']);
      });

      it('does NOT explode Z/28', () => {
        expect(explodeTrim('Z/28')).toEqual(['Z/28']);
      });
    });

    // Single trim (no separators)
    it('returns single trim as array', () => {
      expect(explodeTrim('Sport')).toEqual(['Sport']);
      expect(explodeTrim('GT Performance Pack')).toEqual(['GT Performance Pack']);
    });

    // Edge cases
    it('handles empty input', () => {
      expect(explodeTrim('')).toEqual([]);
    });
  });
});
