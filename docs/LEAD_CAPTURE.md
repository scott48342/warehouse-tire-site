# Lead Capture & Abandoned Cart/Build Recovery

## Overview

This system captures leads across all WTD properties:
- **National site** (shop.warehousetiredirect.com)
- **Local site** (shop.warehousetire.net)
- **Jake Garage** (/garage)

## Key Principles

1. **Never block checkout** - Email capture is always optional
2. **Value-focused messaging** - "Save your build" not "Give us your email"
3. **Personalized experience** - "Save Your 2021 Silverado Build"
4. **Full attribution** - Track source site, channel, and funnel events
5. **Auto-consent** - Customers providing email implies consent

## Messaging Strategy

The modal adapts its language based on context:

| Context | Headline | Example |
|---------|----------|---------|
| Jake Garage | Save Your {Vehicle} Build | "Save Your 2021 Silverado Build" |
| Wheel+Tire Package | Save Your {Vehicle} Setup | "Save Your F-150 Setup" |
| Traditional Cart | Save Your {Vehicle} Cart | "Save Your Cart" |

Value display:
- Jake Garage → "Build Value: $3,284"
- Packages → "Package Value: $2,950"
- Carts → "Cart Value: $1,500"

---

## Database Schema

### `leads` Table
Master lead table for all captured emails.

| Column | Purpose |
|--------|---------|
| email | Customer email (required) |
| source_site | national / local / garage |
| source_channel | cart_save / checkout / build_save / jake_package |
| vehicle_* | Year, make, model, trim |
| cart_id | Links to abandoned_carts |
| jake_build_id | Links to jake_builds |
| cart_value | Estimated cart value |
| status | new / contacted / converted / expired |

### `jake_builds` Table
Tracks Jake Garage conversations and build recommendations.

| Column | Purpose |
|--------|---------|
| conversation_id | Unique conversation identifier |
| vehicle_* | Detected vehicle from conversation |
| build_style | stock / leveled / lifted / performance |
| recommended_wheels | JSON array of wheel SKUs |
| recommended_tires | JSON array of tire SKUs |
| recommended_package_value | Estimated total value |
| lead_id | Links to leads table when email captured |
| status | active / cart_created / abandoned / converted |

---

## Components

### SaveCartModal

Non-blocking modal for capturing email.

```tsx
import { SaveCartModal } from "@/components/SaveCartModal";

<SaveCartModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  onSuccess={() => /* email captured */}
  vehicle={{ year: "2024", make: "Ford", model: "F-150" }}
  cartId="abc123"
  cartValue={1500}
  sourceSite="national"
  sourceChannel="cart_save"
/>
```

### CartSavePromptProvider

Wraps your app to automatically manage save cart prompts.

```tsx
// In your layout.tsx
import { CartSavePromptProvider } from "@/lib/cart/CartSavePromptProvider";

export default function RootLayout({ children }) {
  return (
    <CartProvider>
      <CartSavePromptProvider>
        {children}
      </CartSavePromptProvider>
    </CartProvider>
  );
}
```

### useCartSavePrompt Hook

Access save prompt state from anywhere.

```tsx
import { useCartSavePrompt } from "@/lib/cart/CartSavePromptProvider";

function CheckoutButton() {
  const { onCheckout, hasEmail } = useCartSavePrompt();
  
  const handleClick = () => {
    // This shows the save cart modal if applicable
    onCheckout();
    // Continue to checkout...
  };
  
  return <button onClick={handleClick}>Checkout</button>;
}
```

---

## API Endpoints

### POST /api/leads

Capture a new lead.

```json
{
  "email": "customer@example.com",
  "phone": "555-1234",
  "vehicle": {
    "year": "2024",
    "make": "Ford",
    "model": "F-150",
    "trim": "XLT"
  },
  "cartId": "abc123",
  "cartValue": 1500,
  "sourceSite": "national",
  "sourceChannel": "cart_save",
  "marketingConsent": true
}
```

Response:
```json
{
  "success": true,
  "isNew": true,
  "message": "Your cart has been saved! Check your email for the link."
}
```

### GET /api/leads?key=wtd-admin-2026

Get lead statistics (admin only).

Response:
```json
{
  "sourceStats": [
    {
      "sourceSite": "national",
      "sourceChannel": "cart_save",
      "totalLeads": 150,
      "convertedLeads": 25,
      "conversionRate": 17,
      "totalValue": 125000,
      "averageValue": 833
    }
  ],
  "funnelStats": {
    "newLeads": 100,
    "contactedLeads": 30,
    "convertedLeads": 25,
    "openRate": 45,
    "clickRate": 12,
    "conversionRate": 17
  },
  "recentLeads": [...]
}
```

### POST /api/jake/build

Track a Jake build.

```json
{
  "conversationId": "jake-123",
  "vehicle": {
    "year": "2024",
    "make": "Ford",
    "model": "F-150"
  },
  "buildStyle": "lifted",
  "recommendedWheels": [...],
  "recommendedTires": [...],
  "recommendedPackageValue": 2500
}
```

---

## Trigger Logic

### When to show Save Cart modal:

1. **View Cart** - Show after 1.5 second delay
2. **Checkout click** - Show immediately (non-blocking)
3. **Jake package recommendation** - Show when products displayed

### When NOT to show:

- Cart value < $100
- Already captured email for this cart
- User skipped < 24 hours ago
- Cart is empty

### localStorage Keys:

- `wtd_save_prompt_saved_{cartId}` - Email captured
- `wtd_save_prompt_skipped_{cartId}` - User skipped
- `wtd_save_prompt_skipped_at_{cartId}` - Skip timestamp

---

## Jake Build Tracking

Jake chat automatically tracks builds. Pass `conversationId` in API calls:

```tsx
const response = await fetch("/api/jake/chat", {
  method: "POST",
  body: JSON.stringify({
    query: userMessage,
    history: conversationHistory,
    conversationId: "unique-conversation-id", // Required for tracking
    sessionId: sessionId,
    vehicle: currentVehicle,
    isLocal: isLocalSite,
  }),
});
```

The API automatically:
1. Creates/updates jake_builds record
2. Extracts vehicle, build style from conversation
3. Tracks recommended products and estimated value
4. Links to leads table when email is captured

---

## Analytics Views

Run these SQL queries for reporting:

```sql
-- Lead source breakdown
SELECT * FROM lead_source_stats;

-- Daily lead capture
SELECT * FROM daily_lead_stats WHERE date >= CURRENT_DATE - 30;

-- Jake build stats
SELECT * FROM jake_build_stats;
```

---

## Migration

Run the migration to create tables:

```bash
psql $POSTGRES_URL -f migrations/2026-07-18-lead-capture.sql
```

Or with Drizzle:

```bash
npx drizzle-kit push
```

---

## Admin Dashboard API

### GET /api/admin/leads?key=wtd-admin-2026

Comprehensive lead capture analytics.

**Parameters:**
- `key` - Admin API key (required)
- `days` - Lookback period (default: 30)
- `includeTest` - Include test data (default: false)

**Response:**
```json
{
  "success": true,
  "period": "Last 30 days",
  "data": {
    "summary": {
      "totalLeads": 150,
      "newLeads": 120,
      "convertedLeads": 25,
      "conversionRate": 17,
      "totalValue": 125000,
      "avgValue": 833,
      "emailCaptureRate": 35
    },
    "bySource": [
      {
        "sourceSite": "national",
        "totalLeads": 100,
        "convertedLeads": 20,
        "conversionRate": 20,
        "totalValue": 85000,
        "avgValue": 850
      }
    ],
    "byChannel": [...],
    "topVehicles": [...],
    "jakeFunnel": {
      "totalBuilds": 500,
      "buildsWithEmail": 75,
      "emailCaptureRate": 15,
      "buildsToCart": 50,
      "cartRate": 10,
      "buildsToCheckout": 25,
      "checkoutRate": 5
    },
    "recentLeads": [...],
    "dailyTrend": [...]
  }
}
```

### Dashboard Metrics

| Metric | Description |
|--------|-------------|
| Lead Capture Rate | Leads / Total visitors |
| Email Capture Rate | Carts with email / Total carts |
| Leads by Source | Breakdown by national/local/garage |
| Top Vehicles | Most common vehicles in leads |
| Average Build Value | Mean value of Jake builds |
| Average Cart Value | Mean value of saved carts |
| Jake Builds Created | Total Jake conversations tracked |
| Jake Builds → Cart | Conversions from build to cart |
| Jake Builds → Checkout | Full funnel conversions |

---

## Funnel Events Tracking

Track key conversion events for analytics.

### Event Types

| Event | When Fired |
|-------|------------|
| `save_modal_shown` | Modal displayed to user |
| `save_modal_skipped` | User clicked Skip/X |
| `save_modal_submitted` | User submitted email |
| `lead_created` | New lead record created |
| `build_saved` | Jake build saved with email |
| `cart_saved` | Cart saved with email |
| `checkout_started` | User began checkout |
| `checkout_completed` | Order completed |

### Client-side Tracking

```tsx
import { trackModalShown, trackModalSubmitted } from "@/lib/leads";

// Automatically tracked by CartSavePromptProvider
// Manual tracking if needed:
trackModalShown({
  sessionId: "abc123",
  cartId: "cart-456",
  sourceSite: "national",
  sourceChannel: "cart_save",
  cartValue: 1500,
  modalContext: "package",
});
```

### API Endpoint

```bash
# Track event
POST /api/analytics/funnel
{
  "event": "save_modal_shown",
  "sourceSite": "national",
  "sourceChannel": "cart_save",
  "cartValue": 1500
}

# Get stats (admin)
GET /api/analytics/funnel?key=wtd-admin-2026&days=30
```

---

## Recovery Email Flow

**IMPORTANT:** Collect 2-4 weeks of data before building email automation.

Leads integrate with the existing abandoned cart email system:

1. **1 hour** - "Your cart is still waiting"
2. **24 hours** - "Questions about fitment?"
3. **48 hours** - "Final reminder"

Emails are sent automatically via the existing cron job at `/api/cron/abandoned-cart-emails`.

---

## Success Metrics

After launch, answer these questions:

1. Which site captures the most leads?
2. Which site produces the highest-value leads?
3. What percentage of Jake builds become carts?
4. What percentage of carts become checkouts?
5. Which vehicles generate the highest revenue?
6. Which build styles convert best?
7. What is the modal submit rate by context (garage/package/cart)?

---

## Future Enhancements

1. **Exit Intent** - Show modal when cursor leaves viewport
2. **SMS Recovery** - Text abandoned cart links
3. **Personalized Recovery** - Include product images in emails
4. **Jake Build Emails** - Separate email flow for Jake builds
5. **A/B Testing** - Test different modal copy/timing
6. **Jake Concierge Prompt** - "Want me to save this build for later?"
