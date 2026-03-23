import { NextResponse } from "next/server";
import { getTirewireCredentials, getEnabledConnections, searchTiresTirewire } from "@/lib/tirewire/client";

export const runtime = "nodejs";

/**
 * Debug endpoint to test TireWire API directly
 * GET /api/admin/suppliers/tireweb/debug?size=225/65R17
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const size = url.searchParams.get("size") || "225/65R17";

  const debug: Record<string, any> = {
    size,
    timestamp: new Date().toISOString(),
  };

  try {
    // 1. Check credentials
    const creds = await getTirewireCredentials();
    debug.credentials = creds
      ? {
          hasAccessKey: !!creds.accessKey,
          accessKeyLength: creds.accessKey?.length || 0,
          hasGroupToken: !!creds.groupToken,
          groupTokenLength: creds.groupToken?.length || 0,
          // Show first/last 4 chars for verification
          accessKeyPreview: creds.accessKey ? `${creds.accessKey.slice(0, 4)}...${creds.accessKey.slice(-4)}` : null,
          groupTokenPreview: creds.groupToken ? `${creds.groupToken.slice(0, 4)}...${creds.groupToken.slice(-4)}` : null,
        }
      : null;

    if (!creds) {
      debug.error = "No credentials found in database";
      return NextResponse.json(debug);
    }

    // 2. Check enabled connections
    const connections = await getEnabledConnections();
    debug.connections = connections;

    if (connections.length === 0) {
      debug.error = "No enabled connections found";
      return NextResponse.json(debug);
    }

    // 3. Try searching
    debug.searching = true;
    const results = await searchTiresTirewire(size);
    debug.results = {
      connectionCount: results.length,
      connections: results.map((r) => ({
        provider: r.provider,
        connectionId: r.connectionId,
        tireCount: r.tires.length,
        unmappedCount: r.unmappedCount,
        message: r.message,
        sampleTire: r.tires[0]
          ? {
              make: r.tires[0].make,
              pattern: r.tires[0].pattern,
              imageUrl: r.tires[0].imageUrl,
              buyPrice: r.tires[0].buyPrice,
              quantity: r.tires[0].quantity,
            }
          : null,
      })),
      totalTires: results.reduce((sum, r) => sum + r.tires.length, 0),
    };

    return NextResponse.json(debug);
  } catch (err: any) {
    debug.error = err.message;
    debug.stack = err.stack;
    return NextResponse.json(debug, { status: 500 });
  }
}
