# Jake Visual Mockup Feature

## Overview

Allow Jake to generate visual inspiration mockups when customers select wheels/tires/packages.

**Key Positioning**: This is for **visual inspiration only**, not exact fitment proof.

**Required Disclaimer**: "Mockup is for visual inspiration. I'll still verify exact fitment before checkout."

---

## Phase 1: Generic Vehicle Mockups

Generate mockups using year/make/model/build style to show approximate look.

### Trigger Points
- When Jake shows product recommendations
- User explicitly asks "what would this look like on my truck?"
- After package build, before checkout

### Inputs
- Vehicle: year, make, model, trim
- Build style: lifted, leveled, aggressive-street, stock
- Wheel style: brand, model, finish (matte black, chrome, etc.)
- Tire aggressiveness: all-terrain, mud-terrain, highway, performance
- Wheel size: 20", 22", etc.

### Generation Strategy

**Primary: DALL-E 3** (Always available)
- Fast, reliable, high quality
- No wheel-specific training
- Describe wheel style generically: "aggressive black aftermarket wheels"
- Good for inspiration-level mockups

**Secondary: SD WebUI + LoRAs** (When RunPod pod is running)
- 1,200+ wheel LoRAs trained
- More accurate wheel representation
- Requires pod to be active (~$0.74/hr)
- Fallback to DALL-E if pod unavailable

### Prompt Template (DALL-E 3)

```
A [color] [year] [make] [model] [trim] in a professional automotive photography setting.
[lift_context]
Equipped with [wheel_description] aftermarket wheels in [wheel_size] diameter.
Mounted with [tire_description] tires giving it a [style_vibe] appearance.
Side-front three-quarter view, studio lighting, white/gray gradient background.
8K, highly detailed, product photography, no watermarks, no text.
```

**lift_context examples:**
- "with a 6-inch lift kit, high stance"
- "leveled, aggressive rake removed"
- "lowered stance, aggressive fitment"

**tire_description examples:**
- "aggressive mud-terrain tires with deep treads"
- "all-terrain tires with rugged sidewalls"
- "low-profile performance tires"

### Output
- 1792x1024 image (DALL-E wide format)
- Display inline in Jake chat
- Include disclaimer text below image
- Save/share/add-to-build buttons

---

## Phase 2: Customer Photo Mockups (Future)

Allow customer to upload their own vehicle photo.

### Approach
- Image-to-image transformation
- Detect wheel positions using GPT-4 Vision
- Composite new wheel style into detected positions
- OR use ControlNet for guided generation

### Challenges
- Various photo angles and lighting
- Background removal/preservation
- Wheel position detection accuracy
- Quality depends heavily on source image

**Not in MVP scope.**

---

## Jake Integration

### New Tool: `generate_visual_mockup`

```typescript
{
  name: "generate_visual_mockup",
  description: "Generate a visual mockup showing approximate wheel/tire look on customer's vehicle. Use for visual inspiration, NOT fitment verification.",
  input_schema: {
    type: "object",
    properties: {
      year: { type: "number" },
      make: { type: "string" },
      model: { type: "string" },
      trim: { type: "string" },
      color: { type: "string", description: "Vehicle color" },
      buildStyle: { 
        type: "string", 
        enum: ["stock", "leveled", "lifted-2", "lifted-4", "lifted-6", "lowered"] 
      },
      wheelStyle: { type: "string", description: "Wheel description (brand, model, finish)" },
      wheelSize: { type: "number", description: "Wheel diameter in inches" },
      tireStyle: { 
        type: "string", 
        enum: ["all-terrain", "mud-terrain", "highway", "performance", "all-season"] 
      },
      tireSize: { type: "string", description: "Tire size for context" },
    },
    required: ["year", "make", "model", "color", "wheelStyle", "wheelSize", "tireStyle"]
  }
}
```

### Jake's Behavior

**Offering mockup:**
```
Jake: "I found some great options! Want to see a quick visual mockup of the Fuel Rebels on your Silverado? 
It's for visual inspiration – I'll still verify exact fitment before checkout."
```

**After generating:**
```
Jake: "Here's a mockup to give you an idea of the vibe! [IMAGE]

⚠️ This is for visual inspiration only. The actual wheel and tire may vary slightly.
I'll verify exact fitment specs before we build your cart.

What do you think – want to keep exploring or are we getting close?"
```

---

## API Endpoint

`POST /api/jake/mockup`

### Request
```json
{
  "vehicle": {
    "year": 2024,
    "make": "Chevrolet",
    "model": "Silverado 1500",
    "trim": "RST",
    "color": "black"
  },
  "build": {
    "style": "lifted-6",
    "wheelStyle": "Fuel Rebel D679 Matte Black",
    "wheelSize": 20,
    "tireStyle": "all-terrain",
    "tireSize": "35x12.50R20"
  }
}
```

### Response
```json
{
  "success": true,
  "imageUrl": "https://...",
  "disclaimer": "Mockup is for visual inspiration. Actual product may vary.",
  "generationMethod": "dalle3",
  "cached": false
}
```

---

## Caching Strategy

- Cache by: `{year}-{make}-{model}-{trim}-{color}-{buildStyle}-{wheelStyleHash}-{wheelSize}-{tireStyle}`
- TTL: 7 days
- Storage: Vercel Blob or S3

Benefits:
- Same customer asking again = instant
- Similar requests from other customers = fast
- Reduces DALL-E API costs

---

## Tracking

Events to track:
- `mockup_offered` - Jake offered a mockup
- `mockup_accepted` - User said yes to seeing mockup
- `mockup_generated` - Mockup created
- `mockup_saved` - User saved mockup
- `mockup_shared` - User shared mockup
- `mockup_to_cart` - User added products from mockup session

Goal: Determine if mockups improve conversion.

---

## Cost Estimate

DALL-E 3 (1792x1024 HD):
- ~$0.12 per image
- With caching, expect ~30% hit rate
- 1000 mockups = ~$84

SD WebUI via RunPod (when available):
- $0.74/hr pod cost
- ~20 seconds per image
- If pod runs 8hr/day = ~$6/day

---

## Implementation Priority

1. **Jake tool definition** - teach Jake to offer mockups
2. **DALL-E 3 generator** - always-available backend
3. **API endpoint** - `/api/jake/mockup`
4. **Chat UI component** - display image inline with disclaimer
5. **Caching layer** - reduce costs
6. **SD WebUI integration** - optional enhanced quality
7. **Tracking** - measure impact

---

## Files to Create/Modify

### New Files
- `src/lib/jake/mockup.ts` - Generation logic
- `src/app/api/jake/mockup/route.ts` - API endpoint
- `src/components/jake/JakeMockupCard.tsx` - UI component

### Modify
- `src/lib/jake/tools.ts` - Add generate_visual_mockup tool
- `src/lib/jake/stream.ts` - Handle mockup responses
- `src/components/jake/JakeChat.tsx` - Render mockup cards

