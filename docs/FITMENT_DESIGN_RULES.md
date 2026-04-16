# Fitment Design Rules

Internal design rules for wheel and tire fitment resolution across all surfaces (retail, POS).

---

## Rule 1: Wheel-Driven Tire Resolution

**If wheel diameters are explicitly selected, tire resolution must follow selected wheel diameters, not OEM tire-size overrides.**

### Context

When a customer or salesperson selects aftermarket wheels with specific diameters, the tire search must return tires that match those selected wheel diameters — even if the vehicle's OEM staggered setup uses different tire sizes.

### Examples

| Vehicle | OEM Setup | User Selection | Correct Tire Search |
|---------|-----------|----------------|---------------------|
| Mustang GT PP | 19F/19R (255/40R19, 275/40R19) | 19F/20R wheels | R19 front, R20 rear |
| Camaro SS 1LE | 20F/20R (285/30R20, 305/30R20) | 20F/21R wheels | R20 front, R21 rear |
| Corvette C8 | 19F/20R (245/35R19, 305/30R20) | 19F/20R wheels | R19 front, R20 rear |

### Incorrect Behavior (Fixed 2026-04-16)

Previously, POS used OEM tire sizes from the fitment API even when user-selected wheel diameters differed:
- User selects 19F/20R wheels on Mustang
- POS searched for 255/40R19 + 275/40R19 (both R19) ❌
- Should search for R19 front + R20 rear ✅

### Implementation

Both retail and POS must call the tire search API with explicit wheel diameter parameters:

```
/api/tires/search?wheelDiameter={front}&rearWheelDiameter={rear}
```

The API returns `tireSizesSearched` with front/rear breakdown:
```json
{
  "tireSizesSearched": {
    "front": ["255/40R19"],
    "rear": ["275/35R20"]
  }
}
```

### When OEM Tire Sizes Apply

OEM tire sizes from the fitment API should ONLY be used when:
1. No wheel selection has been made yet
2. User explicitly chooses OEM wheel sizes
3. Browsing/discovery flows before wheel commitment

Once wheels are selected, **wheel diameters are the source of truth** for tire resolution.

---

## Rule 2: Staggered Detection

Staggered fitment is detected when front and rear specs differ in:
- Wheel diameter (e.g., 19F/20R)
- Wheel width (e.g., 8.5" front / 11" rear)
- Tire size (e.g., 255/40R19 front / 275/40R19 rear)

### Detection Sources (Priority Order)

1. **Explicit axle labels** in DB (`axle: "front"` / `axle: "rear"`)
2. **Wheel width inference** (2"+ width difference → staggered)
3. **Tire width inference** (20mm+ tire width difference → staggered)

### Known Staggered Vehicles

| Vehicle | Type | Front | Rear |
|---------|------|-------|------|
| Corvette C7/C8 | Mixed diameter | 19×8.5 | 20×11 |
| Mustang GT PP/Dark Horse | Same diameter | 19×9 | 19×9.5 |
| Camaro SS 1LE | Same diameter | 20×10 | 20×11 |
| BMW M3/M4 | Same diameter | Varies | Varies |

---

## Rule 3: Surface Consistency

**Retail and POS must produce identical tire search results for the same wheel selection.**

The consumer retail site is the source of truth for fitment behavior. POS adds:
- Out-the-door pricing
- Labor costs
- Tax calculation
- Quote formatting

POS does NOT override:
- Tire size resolution
- Staggered detection
- Wheel fitment validation

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-04-16 | Added Rule 1: Wheel-Driven Tire Resolution | Clawd |
| 2026-04-16 | Fixed POS to use retail-style tire search | Clawd |
| 2026-04-16 | Added mixed-diameter stagger support to tire search API | Clawd |
