/**
 * Safety Governor Tests
 * 
 * Validates that the Wheel-Size API governor:
 * 1. Dry-run makes zero external calls
 * 2. Hourly/daily caps block calls
 * 3. Cache prevents duplicate calls
 * 4. Kill switch stops all calls
 * 5. Frontend routes never call Wheel-Size
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock Redis before importing governor
const mockRedisGet = vi.fn();
const mockRedisSet = vi.fn();
const mockRedisSetex = vi.fn();
const mockRedisIncr = vi.fn();
const mockRedisExpire = vi.fn();
const mockRedisDel = vi.fn();
const mockRedisLpush = vi.fn();
const mockRedisLtrim = vi.fn();
const mockRedisLrange = vi.fn();

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn().mockImplementation(() => ({
    get: mockRedisGet,
    set: mockRedisSet,
    setex: mockRedisSetex,
    incr: mockRedisIncr,
    expire: mockRedisExpire,
    del: mockRedisDel,
    lpush: mockRedisLpush,
    ltrim: mockRedisLtrim,
    lrange: mockRedisLrange,
  })),
}));

// Set required env vars
process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
process.env.WHEEL_SIZE_API_KEY = "test-api-key";
process.env.WHEEL_SIZE_SYNC_ENABLED = "true";

import {
  governedCall,
  getGovernorState,
  getConfig,
  processVehicleAllowlist,
  activateKillSwitch,
  deactivateKillSwitch,
} from "../safetyGovernor";

describe("Wheel-Size Safety Governor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock returns
    mockRedisGet.mockResolvedValue(null);
    mockRedisIncr.mockResolvedValue(1);
    mockRedisLrange.mockResolvedValue([]);
    
    // Reset env
    delete process.env.WHEEL_SIZE_DRY_RUN;
    process.env.WHEEL_SIZE_SYNC_ENABLED = "true";
    process.env.WHEEL_SIZE_API_KEY = "test-api-key";
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  // =========================================================================
  // Test 1: Dry-run makes ZERO external calls
  // =========================================================================
  describe("Dry-run mode", () => {
    it("makes zero external calls in dry-run mode", async () => {
      process.env.WHEEL_SIZE_DRY_RUN = "true";
      
      const fetcherCalled = vi.fn();
      
      const result = await governedCall({
        endpoint: "/modifications",
        params: { year: "2024", make: "Ram", model: "1500" },
        vehicle: "2024 Ram 1500",
        fetcher: async () => {
          fetcherCalled();
          return new Response('{}', { status: 200 });
        },
      });
      
      expect(fetcherCalled).not.toHaveBeenCalled();
      expect(result.dryRun).toBe(true);
      expect(result.success).toBe(true);
      expect(result.data).toBeUndefined();
    });
    
    it("logs dry-run in audit log", async () => {
      process.env.WHEEL_SIZE_DRY_RUN = "true";
      
      await governedCall({
        endpoint: "/modifications",
        params: { year: "2024", make: "Ram", model: "1500" },
        vehicle: "2024 Ram 1500",
        fetcher: async () => new Response('{}'),
      });
      
      expect(mockRedisLpush).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"status":"dry-run"')
      );
    });
  });
  
  // =========================================================================
  // Test 2: Hourly/daily caps block calls
  // =========================================================================
  describe("Rate limiting", () => {
    it("blocks when daily cap reached", async () => {
      // Mock: 100 calls already made today
      mockRedisGet.mockImplementation((key: string) => {
        if (key.includes("calls:") && !key.includes("-")) {
          return "100"; // Daily calls
        }
        return null;
      });
      
      const fetcherCalled = vi.fn();
      
      const result = await governedCall({
        endpoint: "/modifications",
        params: { year: "2024", make: "Ram", model: "1500" },
        vehicle: "2024 Ram 1500",
        fetcher: async () => {
          fetcherCalled();
          return new Response('{}');
        },
      });
      
      expect(fetcherCalled).not.toHaveBeenCalled();
      expect(result.blocked).toBe(true);
      expect(result.blockedReason).toContain("Daily cap reached");
    });
    
    it("blocks when hourly cap reached", async () => {
      // Mock: 20 calls already made this hour
      mockRedisGet.mockImplementation((key: string) => {
        if (key.includes("calls:") && key.includes("-")) {
          const parts = key.split("-");
          if (parts.length === 4) { // YYYY-MM-DD-HH format
            return "20"; // Hourly calls
          }
        }
        return null;
      });
      
      const fetcherCalled = vi.fn();
      
      const result = await governedCall({
        endpoint: "/modifications",
        params: { year: "2024", make: "Ram", model: "1500" },
        vehicle: "2024 Ram 1500",
        fetcher: async () => {
          fetcherCalled();
          return new Response('{}');
        },
      });
      
      expect(fetcherCalled).not.toHaveBeenCalled();
      expect(result.blocked).toBe(true);
      expect(result.blockedReason).toContain("Hourly cap reached");
    });
  });
  
  // =========================================================================
  // Test 3: Cache prevents duplicate calls
  // =========================================================================
  describe("Caching", () => {
    it("returns cached data without calling API", async () => {
      const cachedData = { modifications: [{ id: 1, name: "Test" }] };
      
      // Mock: cache hit
      mockRedisGet.mockImplementation((key: string) => {
        if (key.startsWith("ws_cache:")) {
          return cachedData;
        }
        return null;
      });
      
      const fetcherCalled = vi.fn();
      
      const result = await governedCall({
        endpoint: "/modifications",
        params: { year: "2024", make: "Ram", model: "1500" },
        vehicle: "2024 Ram 1500",
        fetcher: async () => {
          fetcherCalled();
          return new Response('{}');
        },
      });
      
      expect(fetcherCalled).not.toHaveBeenCalled();
      expect(result.cached).toBe(true);
      expect(result.data).toEqual(cachedData);
    });
    
    it("caches successful responses", async () => {
      const responseData = { modifications: [{ id: 1 }] };
      
      await governedCall({
        endpoint: "/modifications",
        params: { year: "2024", make: "Ram", model: "1500" },
        vehicle: "2024 Ram 1500",
        fetcher: async () => new Response(JSON.stringify(responseData), { status: 200 }),
      });
      
      expect(mockRedisSetex).toHaveBeenCalledWith(
        expect.stringContaining("ws_cache:"),
        expect.any(Number), // TTL
        expect.any(String)  // JSON data
      );
    });
  });
  
  // =========================================================================
  // Test 4: Kill switch stops all calls
  // =========================================================================
  describe("Kill switch", () => {
    it("blocks all calls when kill switch is active", async () => {
      // Mock: kill switch active
      mockRedisGet.mockImplementation((key: string) => {
        if (key.includes("killSwitchReason")) {
          return "Manual deactivation for maintenance";
        }
        return null;
      });
      
      const fetcherCalled = vi.fn();
      
      const result = await governedCall({
        endpoint: "/modifications",
        params: { year: "2024", make: "Ram", model: "1500" },
        vehicle: "2024 Ram 1500",
        fetcher: async () => {
          fetcherCalled();
          return new Response('{}');
        },
      });
      
      expect(fetcherCalled).not.toHaveBeenCalled();
      expect(result.blocked).toBe(true);
      expect(result.blockedReason).toContain("Kill switch active");
    });
    
    it("activates kill switch on 401/403", async () => {
      await governedCall({
        endpoint: "/modifications",
        params: { year: "2024", make: "Ram", model: "1500" },
        vehicle: "2024 Ram 1500",
        fetcher: async () => new Response("Unauthorized", { status: 401 }),
      });
      
      expect(mockRedisSet).toHaveBeenCalledWith(
        expect.stringContaining("killSwitchReason"),
        expect.stringContaining("Fatal error: HTTP 401")
      );
    });
    
    it("activates kill switch on 429 rate limit", async () => {
      await governedCall({
        endpoint: "/modifications",
        params: { year: "2024", make: "Ram", model: "1500" },
        vehicle: "2024 Ram 1500",
        fetcher: async () => new Response("Rate limited", { status: 429 }),
      });
      
      expect(mockRedisSet).toHaveBeenCalledWith(
        expect.stringContaining("killSwitchReason"),
        expect.stringContaining("Rate limited: HTTP 429")
      );
    });
  });
  
  // =========================================================================
  // Test 5: WHEEL_SIZE_SYNC_ENABLED=false disables all calls
  // =========================================================================
  describe("Sync enabled flag", () => {
    it("blocks all calls when sync disabled", async () => {
      process.env.WHEEL_SIZE_SYNC_ENABLED = "false";
      
      const fetcherCalled = vi.fn();
      
      const result = await governedCall({
        endpoint: "/modifications",
        params: { year: "2024", make: "Ram", model: "1500" },
        vehicle: "2024 Ram 1500",
        fetcher: async () => {
          fetcherCalled();
          return new Response('{}');
        },
      });
      
      expect(fetcherCalled).not.toHaveBeenCalled();
      expect(result.blocked).toBe(true);
      expect(result.blockedReason).toContain("WHEEL_SIZE_SYNC_ENABLED=false");
    });
  });
  
  // =========================================================================
  // Test 6: Missing API key blocks calls
  // =========================================================================
  describe("API key validation", () => {
    it("blocks when API key missing", async () => {
      delete process.env.WHEEL_SIZE_API_KEY;
      
      const fetcherCalled = vi.fn();
      
      const result = await governedCall({
        endpoint: "/modifications",
        params: { year: "2024", make: "Ram", model: "1500" },
        vehicle: "2024 Ram 1500",
        fetcher: async () => {
          fetcherCalled();
          return new Response('{}');
        },
      });
      
      expect(fetcherCalled).not.toHaveBeenCalled();
      expect(result.blocked).toBe(true);
      expect(result.blockedReason).toContain("Missing WHEEL_SIZE_API_KEY");
    });
  });
  
  // =========================================================================
  // Test 7: Allowlist population respects limits
  // =========================================================================
  describe("Allowlist population", () => {
    it("processes only provided vehicles, no crawl", async () => {
      const processedVehicles: string[] = [];
      
      await processVehicleAllowlist(
        {
          vehicles: [
            { year: 2024, make: "Ram", model: "1500" },
            { year: 2024, make: "Ford", model: "F-150" },
          ],
          dryRun: true,
        },
        async (vehicle) => {
          processedVehicles.push(`${vehicle.year} ${vehicle.make} ${vehicle.model}`);
          return new Response('{}');
        }
      );
      
      expect(processedVehicles).toEqual([
        "2024 Ram 1500",
        "2024 Ford F-150",
      ]);
      expect(processedVehicles).toHaveLength(2); // Only the 2 provided, no extra crawl
    });
    
    it("stops on kill switch activation", async () => {
      let callCount = 0;
      
      // Activate kill switch after first call
      mockRedisGet.mockImplementation((key: string) => {
        if (key.includes("killSwitchReason") && callCount > 0) {
          return "Test kill switch";
        }
        return null;
      });
      
      const result = await processVehicleAllowlist(
        {
          vehicles: [
            { year: 2024, make: "Ram", model: "1500" },
            { year: 2024, make: "Ford", model: "F-150" },
            { year: 2024, make: "Chevy", model: "Silverado" },
          ],
        },
        async () => {
          callCount++;
          // Simulate kill switch activation after first call
          if (callCount === 1) {
            mockRedisSet.mockResolvedValueOnce("OK");
          }
          return new Response('{}', { status: 200 });
        }
      );
      
      expect(result.stoppedEarly).toBe(true);
    });
  });
  
  // =========================================================================
  // Test 8: Config respects environment variables
  // =========================================================================
  describe("Configuration", () => {
    it("uses default caps when env not set", () => {
      delete process.env.WHEEL_SIZE_DAILY_CAP;
      delete process.env.WHEEL_SIZE_HOURLY_CAP;
      delete process.env.WHEEL_SIZE_MIN_DELAY_MS;
      
      const config = getConfig();
      
      expect(config.dailyCap).toBe(100);
      expect(config.hourlyCap).toBe(20);
      expect(config.minDelayMs).toBe(5000);
    });
    
    it("respects env overrides", () => {
      process.env.WHEEL_SIZE_DAILY_CAP = "50";
      process.env.WHEEL_SIZE_HOURLY_CAP = "10";
      process.env.WHEEL_SIZE_MIN_DELAY_MS = "10000";
      
      const config = getConfig();
      
      expect(config.dailyCap).toBe(50);
      expect(config.hourlyCap).toBe(10);
      expect(config.minDelayMs).toBe(10000);
    });
  });
});

// =============================================================================
// Frontend Protection Tests
// =============================================================================
describe("Frontend Wheel-Size Protection", () => {
  it("wheels/fitment-search does NOT call Wheel-Size API", async () => {
    // This test verifies the code structure, not runtime
    const fs = await import("fs");
    const path = await import("path");
    
    const routePath = path.join(
      process.cwd(),
      "src/app/api/wheels/fitment-search/route.ts"
    );
    
    const content = fs.readFileSync(routePath, "utf-8");
    
    // Should NOT contain fetch to wheel-size
    expect(content).not.toMatch(/fetch\s*\(\s*["'`].*api\.wheel-size/);
    
    // Should contain the DB-FIRST block comment
    expect(content).toContain("Wheel-Size API is BLOCKED");
  });
  
  it("tires/search does NOT call Wheel-Size API", async () => {
    const fs = await import("fs");
    const path = await import("path");
    
    const routePath = path.join(
      process.cwd(),
      "src/app/api/tires/search/route.ts"
    );
    
    const content = fs.readFileSync(routePath, "utf-8");
    
    // Should NOT contain fetch to wheel-size
    expect(content).not.toMatch(/fetch\s*\(\s*["'`].*api\.wheel-size/);
  });
  
  it("vehicles/* APIs do NOT call Wheel-Size API", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const glob = await import("glob");
    
    const vehicleRoutes = glob.sync(
      path.join(process.cwd(), "src/app/api/vehicles/**/route.ts")
    );
    
    for (const routePath of vehicleRoutes) {
      const content = fs.readFileSync(routePath, "utf-8");
      
      // Should NOT contain fetch to wheel-size
      expect(content).not.toMatch(/fetch\s*\(\s*["'`].*api\.wheel-size/);
    }
  });
});
