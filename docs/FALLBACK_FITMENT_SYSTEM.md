# Fallback Fitment Intelligence System

## Overview

The Fallback Fitment System provides inferred/common OEM fitment data when a vehicle is missing from the primary WTD fitment database. This allows Jake to continue helping customers instead of dead-ending the conversation.

**IMPORTANT**: This system does NOT replace verified fitment data. Fallback results are clearly labeled with confidence levels.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      CUSTOMER REQUEST                            │
│                    "2009 Cadillac DTS"                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TIER 1: WTD Fitment DB                       │
│                    (Primary Source of Truth)                     │
│                                                                  │
│  ✓ Verified fitment data                                        │
│  ✓ Trim-specific specs                                          │
│  ✓ Staggered handling                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                    Vehicle found? ──────────► YES: Normal flow
                              │
                              ▼ NO
┌─────────────────────────────────────────────────────────────────┐
│              TIER 2: Fallback Fitment Service                   │
│                                                                  │
│  Step 1: Check curated OEM data (HIGH confidence)               │
│  Step 2: Platform inference (MEDIUM confidence)                  │
│  Step 3: Era-based inference (LOW confidence)                    │
│  Step 4: Ask customer to verify (UNKNOWN confidence)             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   JAKE CONVERSATION                             │
│                                                                  │
│  "I don't have verified fitment for the 2009 Cadillac DTS       │
│   in my main system yet, but the most commonly reported         │
│   OEM setup is:                                                  │
│   • 235/55R17                                                   │
│   • 5x115 bolt pattern                                          │
│                                                                  │
│   I can still help you find wheels or tires for it."            │
└─────────────────────────────────────────────────────────────────┘
```

## API Usage

### GET /api/fitment/fallback

Lookup fallback fitment data for a vehicle.

**Request:**
```
GET /api/fitment/fallback?year=2009&make=Cadillac&model=DTS
```

**Response:**
```json
{
  "success": true,
  "confidence": "high",
  "source": "curated_oem",
  "vehicle": {
    "year": 2009,
    "make": "Cadillac",
    "model": "DTS"
  },
  "fitment": {
    "boltPattern": "5x115",
    "centerBore": 70.3,
    "tireSizes": [
      { "size": "235/55R17", "isOem": true, "trimLevel": "Base, Luxury, Performance" },
      { "size": "245/50R18", "isOem": true, "trimLevel": "Platinum, Performance" }
    ],
    "wheelDiameters": [17, 18],
    "wheelWidths": [7, 7.5, 8],
    "offsetRange": { "min": 40, "max": 50 },
    "platform": "GM G-body (Sigma platform)",
    "sharedWith": ["Buick Lucerne"]
  },
  "searchCapabilities": {
    "canSearchTires": true,
    "canSearchWheels": true,
    "primaryTireSize": "235/55R17"
  },
  "messaging": {
    "confidence": "I don't have this exact vehicle in my verified database yet, but the 2009 Cadillac DTS commonly uses:",
    "formatted": "I don't have this exact vehicle in my verified database yet, but the 2009 Cadillac DTS commonly uses:\n• Bolt pattern: 5x115\n• Common tire sizes: 235/55R17, 245/50R18\n• OEM wheel sizes: 17\", 18\"\n\n(This vehicle shares a platform with Buick Lucerne)"
  }
}
```

### POST /api/fitment/fallback

For Jake to report fallback events with conversation context.

**Request:**
```json
{
  "year": 2009,
  "make": "Cadillac",
  "model": "DTS",
  "sessionId": "jake-session-123",
  "conversationId": "conv-456",
  "action": "search_tires"
}
```

## Confidence Levels

| Level | Score | Description | Jake Behavior |
|-------|-------|-------------|---------------|
| HIGH | 90%+ | Curated OEM data with verified specs | Use confidently, still label as "commonly reported" |
| MEDIUM | 70-90% | Platform-based inference | Use with caveats, recommend verifying |
| LOW | 50-70% | Era/class-based guess | Ask customer to verify tire size |
| UNKNOWN | <50% | No data available | Must get size from customer |

## Jake Integration

### When to Call Fallback

In the Jake backend (tire-fitment-ai on Render), call the fallback API when:

1. Vehicle lookup returns no results
2. Trim is missing but vehicle exists
3. Fitment data is incomplete

```javascript
// In Jake backend
async function getVehicleFitment(year, make, model, trim) {
  // Step 1: Try primary WTD database
  const primary = await wtdFitmentLookup(year, make, model, trim);
  
  if (primary.success && primary.hasCompleteFitment) {
    return { source: "verified", ...primary };
  }
  
  // Step 2: Fall back to inference system
  const fallback = await fetch(
    `https://shop.warehousetiredirect.com/api/fitment/fallback?year=${year}&make=${make}&model=${model}`
  ).then(r => r.json());
  
  if (fallback.success) {
    return { source: "fallback", ...fallback };
  }
  
  // Step 3: Ask customer
  return { 
    source: "customer_input_needed",
    prompt: "What size tires are on your vehicle? Check the door sticker or tire sidewall."
  };
}
```

### Messaging Guidelines

**DO say:**
- "I don't have fully verified fitment for that vehicle in my main system yet, but..."
- "Based on common OEM specifications..."
- "Most commonly reported setup..."
- "Let me look that up for you."

**DON'T say:**
- "I can't help with that vehicle."
- "My database doesn't contain that."
- "That vehicle is not supported."

### Continue the Flow

Even with fallback data, Jake should still:
- Ask about wheel goals
- Ask about ride quality  
- Recommend products
- Attempt package flow
- Create cart links

## Analytics & Gap Tracking

### Tracked Events

Every fallback request logs:
- Vehicle requested (year/make/model/trim)
- Fallback confidence level
- Whether search was attempted
- Whether cart was created
- Session/conversation IDs

### Admin Dashboard

View gap analytics at: `/admin/fitment-gaps`

**GET /api/admin/fitment-gaps**

Returns:
- Top missing vehicles by request count
- Fallback success rate
- Search conversion rate
- Cart conversion rate
- Enrichment priority recommendations

### Self-Healing System

Gap data enables:
1. **Prioritization** - Which vehicles to add to DB first
2. **Opportunity tracking** - Lost revenue from missing vehicles
3. **Conversion analysis** - Does fallback work well enough?

## Curated OEM Data

### Currently Supported

The fallback service includes curated OEM data for:

**Discontinued Brands:**
- Cadillac (DTS, DeVille, Seville, Eldorado)
- Buick (Lucerne, LeSabre, Park Avenue)
- Lincoln (Town Car, Continental)
- Mercury (Grand Marquis)
- Oldsmobile (Aurora, Alero)
- Pontiac (G8, Grand Prix, Bonneville)
- Saturn (Aura, Outlook)
- Hummer (H2, H3)
- Saab (9-3, 9-5)
- Suzuki (Grand Vitara, Kizashi)

### Adding New Vehicles

To add curated data, edit:
```
src/lib/fitment/fallbackFitmentService.ts
```

Add to `CURATED_FITMENTS` object:
```typescript
"make|model": [
  {
    yearRange: [2006, 2011],
    data: {
      boltPattern: "5x115",
      centerBore: 70.3,
      tireSizes: [
        { size: "235/55R17", trims: ["Base", "Luxury"] },
      ],
      wheelDiameters: [17, 18],
      wheelWidths: [7, 7.5],
      offsetRange: { min: 40, max: 50 },
      platform: "Platform name",
      sharedWith: ["Related Vehicle"],
    },
  },
],
```

## Safety Rules

**NEVER:**
- Invent bolt patterns
- Hallucinate tire sizes
- Guess offsets without data
- Present fallback as verified

**ALWAYS:**
- Label confidence level
- Suggest customer verification when confidence is low
- Log for future enrichment
- Continue helping the customer

## Database Tables

```sql
-- Main event log
CREATE TABLE fitment_gaps (
  id SERIAL PRIMARY KEY,
  year INTEGER NOT NULL,
  make VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  trim VARCHAR(100),
  session_id VARCHAR(100),
  source VARCHAR(50),
  action VARCHAR(50),
  fallback_success BOOLEAN,
  fallback_confidence VARCHAR(20),
  fallback_source VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Aggregated summary for dashboard
CREATE TABLE fitment_gap_summary (
  id SERIAL PRIMARY KEY,
  vehicle_key VARCHAR(200) NOT NULL,
  year INTEGER NOT NULL,
  make VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  request_count INTEGER DEFAULT 1,
  fallback_success_count INTEGER DEFAULT 0,
  search_attempts INTEGER DEFAULT 0,
  cart_created INTEGER DEFAULT 0,
  estimated_revenue DECIMAL(10, 2) DEFAULT 0,
  first_requested TIMESTAMP,
  last_requested TIMESTAMP,
  UNIQUE (vehicle_key, year)
);
```

## Test Cases

| Vehicle | Expected Confidence | Expected Source |
|---------|---------------------|-----------------|
| 2009 Cadillac DTS | HIGH | curated_oem |
| 2007 Pontiac G8 | HIGH | curated_oem |
| 2003 Mercury Grand Marquis | HIGH | curated_oem |
| 2015 Honda Accord | LOW | era_common |
| 1985 AMC Eagle | UNKNOWN | customer_verify |

## Files

| File | Purpose |
|------|---------|
| `src/lib/fitment/fallbackFitmentService.ts` | Core fallback logic + curated data |
| `src/app/api/fitment/fallback/route.ts` | API endpoint |
| `src/lib/analytics/fitmentGapTracker.ts` | Analytics tracking |
| `src/app/api/admin/fitment-gaps/route.ts` | Admin API |
| `prisma/migrations/20260520_fitment_gaps/migration.sql` | Database schema |
