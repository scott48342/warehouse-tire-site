/**
 * Conversion Funnel Analytics Types
 */

export type FunnelEventName =
  | 'session_start'
  | 'product_view'
  | 'add_to_cart'
  | 'begin_checkout'
  | 'checkout_step2'
  | 'add_shipping_info'
  | 'add_payment_info'
  | 'purchase'
  | 'first_order_popup_shown'
  | 'first_order_popup_submit'
  | 'first_order_coupon_applied'
  | 'first_order_coupon_redeemed';

export type DeviceType = 'mobile' | 'desktop' | 'tablet';
export type StoreMode = 'local' | 'national';

export interface FunnelEvent {
  eventName: FunnelEventName;
  sessionId: string;
  userId?: string;
  trafficSource?: string;
  deviceType?: DeviceType;
  storeMode?: StoreMode;
  pageUrl?: string;
  productSku?: string;
  productType?: 'wheel' | 'tire' | 'accessory' | 'package';
  cartValue?: number;
  orderId?: string;
  couponCode?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  metadata?: Record<string, any>;
}

export interface FunnelStep {
  name: FunnelEventName;
  label: string;
  count: number;
  rate?: number;        // % of previous step
  overallRate?: number; // % of sessions
}

export interface FunnelReport {
  period: '7d' | '30d' | 'all';
  startDate: Date;
  endDate: Date;
  steps: FunnelStep[];
  segments: {
    byDevice: Record<DeviceType, FunnelStep[]>;
    byStoreMode: Record<StoreMode, FunnelStep[]>;
    byTrafficSource: Record<string, FunnelStep[]>;
  };
}

export const FUNNEL_STEPS: Array<{ name: FunnelEventName; label: string }> = [
  { name: 'session_start', label: 'Sessions' },
  { name: 'product_view', label: 'Product Views' },
  { name: 'add_to_cart', label: 'Add to Cart' },
  { name: 'begin_checkout', label: 'Begin Checkout' },
  { name: 'checkout_step2', label: 'Step 2 (Shipping)' },
  { name: 'add_shipping_info', label: 'Shipping Info' },
  { name: 'add_payment_info', label: 'Payment Info' },
  { name: 'purchase', label: 'Purchase' },
];

export const POPUP_STEPS: Array<{ name: FunnelEventName; label: string }> = [
  { name: 'first_order_popup_shown', label: 'Popup Shown' },
  { name: 'first_order_popup_submit', label: 'Email Submitted' },
  { name: 'first_order_coupon_applied', label: 'Coupon Applied' },
  { name: 'first_order_coupon_redeemed', label: 'Coupon Redeemed' },
];
