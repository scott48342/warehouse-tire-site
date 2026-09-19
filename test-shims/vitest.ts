// Jest-side shim for test files written against the vitest API.
// Mapped via jest.config.js moduleNameMapper ("^vitest$"). Lets the 8 legacy
// vitest suites (groupWheelsBySpec, staggeredFitment, universalFitmentResolver,
// tirePricingService, ...) execute under the repo's jest runner instead of
// failing with "Vitest cannot be imported in a CommonJS module".
// Note: vitest hoists vi.mock; jest only hoists literal `jest.mock(...)` calls,
// so a suite relying on hoisting must call jest.mock directly.
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as J from "@jest/globals";
export const describe = J.describe;
export const it = J.it;
export const test = J.test;
export const expect = J.expect;
export const beforeAll = J.beforeAll;
export const afterAll = J.afterAll;
export const beforeEach = J.beforeEach;
export const afterEach = J.afterEach;
const jj: any = J.jest;
export const vi = {
  fn: (...a: any[]) => jj.fn(...a),
  mock: (...a: any[]) => jj.mock(...a),
  spyOn: (...a: any[]) => jj.spyOn(...a),
  clearAllMocks: () => jj.clearAllMocks(),
  resetAllMocks: () => jj.resetAllMocks(),
  restoreAllMocks: () => jj.restoreAllMocks(),
  useFakeTimers: () => jj.useFakeTimers(),
  useRealTimers: () => jj.useRealTimers(),
  advanceTimersByTime: (ms: number) => jj.advanceTimersByTime(ms),
};
