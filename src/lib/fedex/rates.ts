/**
 * FedEx Rates and Transit Times API
 * Get shipping quotes for packages
 */

import { getFedExToken } from './auth';

export interface ShippingAddress {
  streetLines?: string[];
  city: string;
  stateOrProvinceCode: string;
  postalCode: string;
  countryCode: string;
  residential?: boolean;
}

export interface PackageInfo {
  weight: number; // in LBS
  length: number; // in inches
  width: number;
  height: number;
}

export interface ShippingRate {
  serviceType: string;
  serviceName: string;
  totalCharge: number;
  currency: string;
  transitDays: number | null;
  deliveryDate: string | null;
  deliveryDayOfWeek: string | null;
}

export interface RateQuoteRequest {
  origin: ShippingAddress;
  destination: ShippingAddress;
  packages: PackageInfo[];
  shipDate?: string; // YYYY-MM-DD, defaults to today
}

// Warehouse Tire origin address (Pontiac, MI)
export const WAREHOUSE_ORIGIN: ShippingAddress = {
  streetLines: ['550 S Blvd E'],
  city: 'Pontiac',
  stateOrProvinceCode: 'MI',
  postalCode: '48341',
  countryCode: 'US',
  residential: false,
};

// Service type display names
const SERVICE_NAMES: Record<string, string> = {
  FEDEX_GROUND: 'FedEx Ground',
  GROUND_HOME_DELIVERY: 'FedEx Home Delivery',
  FEDEX_EXPRESS_SAVER: 'FedEx Express Saver (3 Day)',
  FEDEX_2_DAY: 'FedEx 2Day',
  FEDEX_2_DAY_AM: 'FedEx 2Day A.M.',
  STANDARD_OVERNIGHT: 'FedEx Standard Overnight',
  PRIORITY_OVERNIGHT: 'FedEx Priority Overnight',
  FIRST_OVERNIGHT: 'FedEx First Overnight',
};

export async function getShippingRates(
  request: RateQuoteRequest
): Promise<ShippingRate[]> {
  const token = await getFedExToken();
  const apiUrl = process.env.FEDEX_API_URL || 'https://apis.fedex.com';
  const accountNumber = process.env.FEDEX_ACCOUNT_NUMBER;

  if (!accountNumber) {
    throw new Error('FedEx account number not configured');
  }

  // Build the rate request
  const rateRequest = {
    accountNumber: {
      value: accountNumber,
    },
    requestedShipment: {
      shipper: {
        address: {
          streetLines: request.origin.streetLines,
          city: request.origin.city,
          stateOrProvinceCode: request.origin.stateOrProvinceCode,
          postalCode: request.origin.postalCode,
          countryCode: request.origin.countryCode,
          residential: request.origin.residential ?? false,
        },
      },
      recipient: {
        address: {
          streetLines: request.destination.streetLines,
          city: request.destination.city,
          stateOrProvinceCode: request.destination.stateOrProvinceCode,
          postalCode: request.destination.postalCode,
          countryCode: request.destination.countryCode,
          residential: request.destination.residential ?? true,
        },
      },
      shipDateStamp: request.shipDate || new Date().toISOString().split('T')[0],
      pickupType: 'DROPOFF_AT_FEDEX_LOCATION',
      rateRequestType: ['ACCOUNT', 'LIST'],
      requestedPackageLineItems: request.packages.map((pkg, index) => ({
        groupPackageCount: 1,
        weight: {
          units: 'LB',
          value: pkg.weight,
        },
        dimensions: {
          length: Math.ceil(pkg.length),
          width: Math.ceil(pkg.width),
          height: Math.ceil(pkg.height),
          units: 'IN',
        },
        sequenceNumber: index + 1,
      })),
    },
  };

  const response = await fetch(`${apiUrl}/rate/v1/rates/quotes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(rateRequest),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('FedEx rate error:', error);
    throw new Error(`FedEx rate request failed: ${response.status}`);
  }

  const data = await response.json();

  // Parse the rate options
  const rates: ShippingRate[] = [];

  if (data.output?.rateReplyDetails) {
    for (const detail of data.output.rateReplyDetails) {
      // Get the account rate (discounted) or list rate
      const ratedShipmentDetails = detail.ratedShipmentDetails || [];
      const accountRate = ratedShipmentDetails.find(
        (r: any) => r.rateType === 'ACCOUNT'
      );
      const listRate = ratedShipmentDetails.find(
        (r: any) => r.rateType === 'LIST'
      );
      const bestRate = accountRate || listRate;

      if (bestRate) {
        const totalCharge =
          bestRate.totalNetCharge || bestRate.totalNetFedExCharge;

        rates.push({
          serviceType: detail.serviceType,
          serviceName:
            SERVICE_NAMES[detail.serviceType] ||
            detail.serviceName ||
            detail.serviceType,
          totalCharge: parseFloat(totalCharge),
          currency: bestRate.currency || 'USD',
          transitDays: detail.commit?.transitDays?.value ?? null,
          deliveryDate: detail.commit?.dateDetail?.dayFormat ?? null,
          deliveryDayOfWeek: detail.commit?.dateDetail?.dayOfWeek ?? null,
        });
      }
    }
  }

  // Sort by price
  rates.sort((a, b) => a.totalCharge - b.totalCharge);

  return rates;
}

/**
 * Get rates for a typical tire shipment
 */
export async function getTireShippingRates(
  destinationZip: string,
  destinationState: string,
  tireCount: number,
  weightPerTire: number = 25 // Default tire weight in LBS
): Promise<ShippingRate[]> {
  // Typical tire box dimensions (per tire)
  const tirePackage: PackageInfo = {
    weight: weightPerTire,
    length: 28,
    width: 28,
    height: 10,
  };

  // Create packages (one box per tire for accuracy)
  const packages = Array(tireCount).fill(tirePackage);

  return getShippingRates({
    origin: WAREHOUSE_ORIGIN,
    destination: {
      city: '', // FedEx will resolve from zip
      stateOrProvinceCode: destinationState,
      postalCode: destinationZip,
      countryCode: 'US',
      residential: true,
    },
    packages,
  });
}

/**
 * Get rates for a typical wheel shipment
 * Ships 2 wheels per box (wheels-only orders) for cost savings
 */
export async function getWheelShippingRates(
  destinationZip: string,
  destinationState: string,
  wheelCount: number,
  wheelDiameter: number = 18, // inches
  weightPerWheel: number = 25, // Default wheel weight in LBS
  wheelsPerBox: number = 2 // Pack 2 wheels per box for wheels-only orders
): Promise<ShippingRate[]> {
  // Wheel box dimensions scale with diameter
  const boxSize = wheelDiameter + 4; // Padding for packaging
  
  // 2 wheels per box: stack them, double the weight and height
  const wheelPackage: PackageInfo = {
    weight: weightPerWheel * wheelsPerBox,
    length: boxSize,
    width: boxSize,
    height: 12 * wheelsPerBox, // Stacked wheels
  };

  // Calculate number of boxes needed
  const boxCount = Math.ceil(wheelCount / wheelsPerBox);
  const packages = Array(boxCount).fill(wheelPackage);

  return getShippingRates({
    origin: WAREHOUSE_ORIGIN,
    destination: {
      city: '',
      stateOrProvinceCode: destinationState,
      postalCode: destinationZip,
      countryCode: 'US',
      residential: true,
    },
    packages,
  });
}
