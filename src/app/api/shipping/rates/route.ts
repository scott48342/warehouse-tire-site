import { NextRequest, NextResponse } from 'next/server';
import {
  getShippingRates,
  getTireShippingRates,
  getWheelShippingRates,
  WAREHOUSE_ORIGIN,
  type PackageInfo,
} from '@/lib/fedex';

export const dynamic = 'force-dynamic';

/**
 * GET /api/shipping/rates
 * 
 * Quick rate lookup for tires or wheels
 * 
 * Query params:
 * - zip: destination zip code (required)
 * - state: destination state code (required)
 * - type: 'tire' | 'wheel' (required)
 * - qty: quantity (default: 4)
 * - weight: weight per item in LBS (optional)
 * - diameter: wheel diameter for wheels (optional, default: 18)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const zip = searchParams.get('zip');
    const state = searchParams.get('state');
    const type = searchParams.get('type');
    const qty = parseInt(searchParams.get('qty') || '4', 10);
    const weight = searchParams.get('weight')
      ? parseFloat(searchParams.get('weight')!)
      : undefined;
    const diameter = parseInt(searchParams.get('diameter') || '18', 10);

    if (!zip || !state) {
      return NextResponse.json(
        { error: 'Missing required params: zip, state' },
        { status: 400 }
      );
    }

    if (!type || !['tire', 'wheel'].includes(type)) {
      return NextResponse.json(
        { error: 'type must be "tire" or "wheel"' },
        { status: 400 }
      );
    }

    let rates;
    if (type === 'tire') {
      rates = await getTireShippingRates(zip, state, qty, weight);
    } else {
      rates = await getWheelShippingRates(zip, state, qty, diameter, weight);
    }

    return NextResponse.json({
      success: true,
      destination: { zip, state },
      itemCount: qty,
      rates,
    });
  } catch (error) {
    console.error('Shipping rates error:', error);
    return NextResponse.json(
      { error: 'Failed to get shipping rates', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/shipping/rates
 * 
 * Full rate request with custom packages
 * 
 * Body:
 * {
 *   destination: {
 *     city?: string,
 *     stateOrProvinceCode: string,
 *     postalCode: string,
 *     countryCode?: string,
 *     residential?: boolean
 *   },
 *   packages: [
 *     { weight: number, length: number, width: number, height: number }
 *   ],
 *   shipDate?: string  // YYYY-MM-DD
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { destination, packages, shipDate } = body;

    if (!destination?.postalCode || !destination?.stateOrProvinceCode) {
      return NextResponse.json(
        { error: 'destination.postalCode and destination.stateOrProvinceCode required' },
        { status: 400 }
      );
    }

    if (!packages || !Array.isArray(packages) || packages.length === 0) {
      return NextResponse.json(
        { error: 'packages array required with at least one package' },
        { status: 400 }
      );
    }

    // Validate packages
    for (const pkg of packages) {
      if (!pkg.weight || !pkg.length || !pkg.width || !pkg.height) {
        return NextResponse.json(
          { error: 'Each package needs weight, length, width, height' },
          { status: 400 }
        );
      }
    }

    const rates = await getShippingRates({
      origin: WAREHOUSE_ORIGIN,
      destination: {
        city: destination.city || '',
        stateOrProvinceCode: destination.stateOrProvinceCode,
        postalCode: destination.postalCode,
        countryCode: destination.countryCode || 'US',
        residential: destination.residential ?? true,
      },
      packages: packages as PackageInfo[],
      shipDate,
    });

    return NextResponse.json({
      success: true,
      destination,
      packageCount: packages.length,
      rates,
    });
  } catch (error) {
    console.error('Shipping rates error:', error);
    return NextResponse.json(
      { error: 'Failed to get shipping rates', details: String(error) },
      { status: 500 }
    );
  }
}
