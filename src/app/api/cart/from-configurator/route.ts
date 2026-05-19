import { NextRequest, NextResponse } from 'next/server';

/**
 * iConfigurator Cart Integration Endpoint
 * 
 * Receives POST data from iConfigurator when user clicks "Add to Package"
 * Extracts wheel/tire data and redirects to client page to add to cart
 * 
 * Expected POST fields (from iConfigurator):
 * - aces_id: Vehicle ACES ID
 * - tire_width, tire_height, tire_rim: Tire size components
 * - wheel_brand[]: Brand name(s)
 * - wheel_product_name[]: Model name(s)
 * - wheel_part_number[]: SKU(s) - KEY FIELD
 * - wheel_quantity[]: Quantities
 * - wheel_price[]: Prices
 * - wheel_image[]: Image URLs
 * - wheel_desc[]: Descriptions
 */

export async function POST(request: NextRequest) {
  try {
    // Parse form data (iConfigurator sends as form-urlencoded or multipart)
    const contentType = request.headers.get('content-type') || '';
    
    let formData: Record<string, string | string[]> = {};
    
    if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const fd = await request.formData();
      
      // Convert FormData to object, handling arrays
      fd.forEach((value, key) => {
        const strValue = value.toString();
        
        // Handle array fields (wheel_brand[], wheel_part_number[], etc.)
        const baseKey = key.replace('[]', '');
        
        if (key.includes('[]') || formData[baseKey]) {
          // It's an array field
          const existing = formData[baseKey];
          if (Array.isArray(existing)) {
            existing.push(strValue);
          } else if (existing) {
            formData[baseKey] = [existing, strValue];
          } else {
            formData[baseKey] = [strValue];
          }
        } else {
          formData[key] = strValue;
        }
      });
    } else if (contentType.includes('application/json')) {
      formData = await request.json();
    } else {
      // Try to parse as text/form data anyway
      const text = await request.text();
      const params = new URLSearchParams(text);
      params.forEach((value, key) => {
        const baseKey = key.replace('[]', '');
        const existing = formData[baseKey];
        if (Array.isArray(existing)) {
          existing.push(value);
        } else if (existing) {
          formData[baseKey] = [existing as string, value];
        } else {
          formData[baseKey] = value;
        }
      });
    }

    console.log('[from-configurator] Received data:', JSON.stringify(formData, null, 2));

    // Extract wheel data
    const wheelPartNumbers = toArray(formData['wheel_part_number']);
    const wheelBrands = toArray(formData['wheel_brand']);
    const wheelNames = toArray(formData['wheel_product_name']);
    const wheelPrices = toArray(formData['wheel_price']);
    const wheelQuantities = toArray(formData['wheel_quantity']);
    const wheelImages = toArray(formData['wheel_image']);
    const wheelDescs = toArray(formData['wheel_desc']);

    // Extract tire size
    const tireWidth = formData['tire_width'] as string;
    const tireHeight = formData['tire_height'] as string;
    const tireRim = formData['tire_rim'] as string;
    const tireSize = tireWidth && tireHeight && tireRim 
      ? `${tireWidth}/${tireHeight}R${tireRim}` 
      : null;

    // Extract vehicle info
    const acesId = formData['aces_id'] as string;

    // Build cart items
    const items = wheelPartNumbers.map((partNumber, i) => ({
      sku: partNumber,
      brand: wheelBrands[i] || 'Unknown',
      model: wheelNames[i] || 'Wheel',
      price: parseFloat(wheelPrices[i] || '0'),
      quantity: parseInt(wheelQuantities[i] || '4', 10),
      imageUrl: wheelImages[i] || '',
      description: wheelDescs[i] || '',
    })).filter(item => item.sku); // Filter out empty SKUs

    if (items.length === 0) {
      console.error('[from-configurator] No valid wheel items found');
      return NextResponse.redirect(new URL('/cart?error=no_items', request.url));
    }

    // Encode cart data for client-side processing
    const cartData = {
      items,
      tireSize,
      acesId,
      source: 'iconfigurator',
      timestamp: Date.now(),
    };

    const encodedData = Buffer.from(JSON.stringify(cartData)).toString('base64url');

    // Redirect to client page that will add items to cart
    const redirectUrl = new URL('/cart/from-configurator', request.url);
    redirectUrl.searchParams.set('data', encodedData);

    console.log('[from-configurator] Redirecting with', items.length, 'items');
    
    return NextResponse.redirect(redirectUrl, { status: 303 }); // 303 = See Other (POST→GET redirect)

  } catch (error) {
    console.error('[from-configurator] Error processing request:', error);
    return NextResponse.redirect(new URL('/cart?error=processing_failed', request.url));
  }
}

// GET handler for testing
export async function GET(request: NextRequest) {
  return NextResponse.json({
    endpoint: '/api/cart/from-configurator',
    method: 'POST',
    description: 'iConfigurator cart integration endpoint',
    expectedFields: [
      'wheel_part_number[]',
      'wheel_brand[]',
      'wheel_product_name[]',
      'wheel_price[]',
      'wheel_quantity[]',
      'wheel_image[]',
      'tire_width',
      'tire_height',
      'tire_rim',
      'aces_id',
    ],
  });
}

// Helper to convert value to array
function toArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}
