/**
 * FedEx Track API Client
 * 
 * Uses the Track API (Basic Integrated Visibility) to check package delivery status.
 * Docs: https://developer.fedex.com/api/en-us/catalog/track/v1/docs.html
 */

interface FedExAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface FedExTrackingEvent {
  date: string;
  eventType: string;
  eventDescription: string;
  scanLocation?: {
    city: string;
    stateOrProvinceCode: string;
    countryCode: string;
  };
}

interface FedExTrackResult {
  trackingNumber: string;
  status: 'in_transit' | 'delivered' | 'exception' | 'pending' | 'unknown';
  statusDescription: string;
  deliveryDate?: string;
  estimatedDeliveryDate?: string;
  signedForName?: string;
  events?: FedExTrackingEvent[];
  error?: string;
}

// Cache for OAuth token
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Get OAuth token for FedEx API
 */
async function getAccessToken(): Promise<string> {
  const apiKey = process.env.FEDEX_TRACK_API_KEY;
  const secret = process.env.FEDEX_TRACK_SECRET;
  const baseUrl = process.env.FEDEX_TRACK_URL || 'https://apis.fedex.com';

  if (!apiKey || !secret) {
    throw new Error('Missing FEDEX_TRACK_API_KEY or FEDEX_TRACK_SECRET');
  }

  // Check if we have a valid cached token
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    return cachedToken.token;
  }

  const response = await fetch(`${baseUrl}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: apiKey,
      client_secret: secret,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`FedEx OAuth failed: ${response.status} - ${text}`);
  }

  const data: FedExAuthResponse = await response.json();
  
  // Cache the token
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  };

  return data.access_token;
}

/**
 * Track a single package by tracking number
 */
export async function trackPackage(trackingNumber: string): Promise<FedExTrackResult> {
  const baseUrl = process.env.FEDEX_TRACK_URL || 'https://apis.fedex.com';

  try {
    const token = await getAccessToken();

    const response = await fetch(`${baseUrl}/track/v1/trackingnumbers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-locale': 'en_US',
      },
      body: JSON.stringify({
        includeDetailedScans: true,
        trackingInfo: [
          {
            trackingNumberInfo: {
              trackingNumber: trackingNumber,
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[fedex-track] API error: ${response.status} - ${text}`);
      return {
        trackingNumber,
        status: 'unknown',
        statusDescription: 'API Error',
        error: `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    
    // Parse the response
    const trackResult = data?.output?.completeTrackResults?.[0]?.trackResults?.[0];
    
    if (!trackResult) {
      return {
        trackingNumber,
        status: 'unknown',
        statusDescription: 'No tracking data',
        error: 'No tracking data returned',
      };
    }

    // Check for errors in the track result
    if (trackResult.error) {
      return {
        trackingNumber,
        status: 'unknown',
        statusDescription: trackResult.error.message || 'Tracking error',
        error: trackResult.error.code,
      };
    }

    // Extract status
    const latestStatus = trackResult.latestStatusDetail;
    const statusCode = latestStatus?.code || '';
    const statusDescription = latestStatus?.description || '';
    
    // Map FedEx status to our simplified status
    let status: FedExTrackResult['status'] = 'unknown';
    
    if (['DL', 'DEX'].includes(statusCode) || statusDescription.toLowerCase().includes('delivered')) {
      status = 'delivered';
    } else if (['IT', 'AR', 'DP', 'OD', 'PU'].includes(statusCode) || 
               statusDescription.toLowerCase().includes('transit') ||
               statusDescription.toLowerCase().includes('out for delivery')) {
      status = 'in_transit';
    } else if (['DE', 'CA', 'RS', 'HP'].includes(statusCode) ||
               statusDescription.toLowerCase().includes('exception')) {
      status = 'exception';
    } else if (['PL', 'LB', 'IP'].includes(statusCode)) {
      status = 'pending';
    }

    // Extract dates
    const deliveryDate = trackResult.dateAndTimes?.find(
      (d: any) => d.type === 'ACTUAL_DELIVERY'
    )?.dateTime;
    
    const estimatedDeliveryDate = trackResult.dateAndTimes?.find(
      (d: any) => d.type === 'ESTIMATED_DELIVERY'
    )?.dateTime;

    // Extract delivery signature if delivered
    const signedForName = latestStatus?.ancillaryDetails?.find(
      (d: any) => d.reason === 'SIGNED_FOR_BY'
    )?.reasonDetail;

    // Extract scan events
    const events: FedExTrackingEvent[] = (trackResult.scanEvents || []).slice(0, 10).map((scan: any) => ({
      date: scan.date,
      eventType: scan.eventType,
      eventDescription: scan.eventDescription,
      scanLocation: scan.scanLocation ? {
        city: scan.scanLocation.city,
        stateOrProvinceCode: scan.scanLocation.stateOrProvinceCode,
        countryCode: scan.scanLocation.countryCode,
      } : undefined,
    }));

    return {
      trackingNumber,
      status,
      statusDescription,
      deliveryDate,
      estimatedDeliveryDate,
      signedForName,
      events,
    };
  } catch (error) {
    console.error(`[fedex-track] Error tracking ${trackingNumber}:`, error);
    return {
      trackingNumber,
      status: 'unknown',
      statusDescription: 'Tracking failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Track multiple packages at once (max 30 per request)
 */
export async function trackPackages(trackingNumbers: string[]): Promise<FedExTrackResult[]> {
  // FedEx allows up to 30 tracking numbers per request
  const results: FedExTrackResult[] = [];
  
  // Process in batches of 30
  for (let i = 0; i < trackingNumbers.length; i += 30) {
    const batch = trackingNumbers.slice(i, i + 30);
    
    // For now, track individually to handle errors gracefully
    // Could optimize to batch if needed
    for (const trackingNumber of batch) {
      const result = await trackPackage(trackingNumber);
      results.push(result);
      
      // Small delay between requests
      await new Promise(r => setTimeout(r, 100));
    }
  }
  
  return results;
}

/**
 * Check if a tracking number is likely a FedEx number
 * FedEx tracking numbers are typically 12-22 digits or contain "DT" prefix
 */
export function isFedExTrackingNumber(trackingNumber: string): boolean {
  const cleaned = trackingNumber.replace(/\s/g, '');
  
  // Standard FedEx Ground/Express: 12-15 digits
  if (/^\d{12,15}$/.test(cleaned)) return true;
  
  // FedEx Express: 12 digits
  if (/^\d{12}$/.test(cleaned)) return true;
  
  // FedEx Ground (96/98 prefix): 20-22 digits
  if (/^(96|98)\d{18,20}$/.test(cleaned)) return true;
  
  // Door Tag Number: starts with DT
  if (/^DT\d{12}$/.test(cleaned)) return true;
  
  // FedEx SmartPost: 22 digits starting with 9261 or 9269
  if (/^926[19]\d{18}$/.test(cleaned)) return true;
  
  return false;
}
