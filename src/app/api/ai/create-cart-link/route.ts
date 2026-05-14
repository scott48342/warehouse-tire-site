import { NextRequest, NextResponse } from "next/server";

/**
 * Creates a cart prefill link for AI-assisted sales.
 * 
 * POST /api/ai/create-cart-link
 * Body: { items: [{ sku, quantity, type, brand, model, size, price, imageUrl }] }
 * Returns: { url: "https://shop.warehousetiredirect.com/cart/prefill?data=..." }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { items, vehicle } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Items array required" }, { status: 400 });
    }

    // Build cart data object
    const cartData = {
      items: items.map((item: Record<string, unknown>) => ({
        sku: item.sku || item.partNumber,
        quantity: item.quantity || 4,
        type: item.type || "tire",
        brand: item.brand,
        model: item.model,
        size: item.size,
        price: item.price,
        imageUrl: item.imageUrl,
      })),
      vehicle: vehicle || null,
      source: "ai-assistant",
      created: Date.now(),
    };

    // Encode as base64 for URL safety
    const encoded = Buffer.from(JSON.stringify(cartData)).toString("base64url");
    
    // Build the prefill URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://shop.warehousetiredirect.com";
    const prefillUrl = `${baseUrl}/cart/prefill?data=${encoded}`;

    return NextResponse.json({ 
      url: prefillUrl,
      itemCount: items.length,
      success: true 
    });

  } catch (err) {
    console.error("[AI Cart Link] Error:", err);
    return NextResponse.json({ error: "Failed to create cart link" }, { status: 500 });
  }
}
