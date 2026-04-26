/**
 * Analytics Event Tracking API
 * 
 * POST /api/analytics/track
 * 
 * Receives funnel events from client-side tracker.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      eventName,
      sessionId,
      userId,
      trafficSource,
      deviceType,
      storeMode,
      pageUrl,
      productSku,
      productType,
      cartValue,
      orderId,
      couponCode,
      discountAmount,
      discountType,
      utmSource,
      utmMedium,
      utmCampaign,
      metadata,
    } = body;
    
    // Validate required fields
    if (!eventName || !sessionId) {
      return NextResponse.json(
        { ok: false, error: 'Missing eventName or sessionId' },
        { status: 400 }
      );
    }
    
    // Get IP and user agent from headers
    const userAgent = request.headers.get('user-agent') || '';
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
               request.headers.get('x-real-ip') || '';
    const referrer = request.headers.get('referer') || '';
    
    // Build metadata with discount info
    const enrichedMetadata = {
      ...metadata,
      // Include discount info in metadata for analysis
      ...(discountAmount !== undefined && { discountAmount }),
      ...(discountType && { discountType }),
    };
    
    // Insert event
    await pool.query(`
      INSERT INTO funnel_events (
        event_name, session_id, user_id,
        traffic_source, device_type, store_mode,
        page_url, product_sku, product_type,
        cart_value, order_id, coupon_code,
        user_agent, ip_address, referrer,
        utm_source, utm_medium, utm_campaign,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
    `, [
      eventName,
      sessionId,
      userId || null,
      trafficSource || null,
      deviceType || null,
      storeMode || null,
      pageUrl || null,
      productSku || null,
      productType || null,
      cartValue || null,
      orderId || null,
      couponCode || null,
      userAgent,
      ip,
      referrer,
      utmSource || null,
      utmMedium || null,
      utmCampaign || null,
      JSON.stringify(enrichedMetadata),
    ]);
    
    return NextResponse.json({ ok: true });
    
  } catch (error) {
    console.error('[analytics/track] Error:', error);
    // Return 200 even on error - don't break client
    return NextResponse.json({ ok: false });
  }
}
