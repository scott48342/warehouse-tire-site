# Wheel Image Guidelines for Visualizer

## Required Format

All wheel images used in the visualizer must follow these specifications:

### Image Specifications

| Property | Requirement |
|----------|-------------|
| **Dimensions** | 500×500 pixels |
| **Format** | PNG with transparency |
| **Content** | Wheel ONLY (no tire) |
| **Fill** | Wheel MUST fill exactly ~85% of canvas (critical for plus-sizing!) |
| **Background** | Transparent |
| **Shape** | Circular (use circular mask if needed) |

### ⚠️ CRITICAL: 85% Fill Rule

**All wheels MUST fill ~85% of the canvas with padding around edges.**

If a wheel fills 100% of its canvas (edge-to-edge), it will appear LARGER than other wheels when plus-sizing. This breaks the visual consistency.

To fix an edge-to-edge wheel image:
```javascript
sharp('wheel-too-big.png')
  .resize(425, 425)  // Shrink to 85% of 500
  .extend({ top: 38, bottom: 37, left: 38, right: 37, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .toFile('wheel-fixed.png');
```

### Why These Standards?

1. **Wheel only (no tire)**: The visualizer renders the tire separately as a black ring behind the wheel. This allows independent control of tire size and sidewall thickness.

2. **Consistent 85% sizing**: All wheel images MUST fill the same percentage of their canvas (~85%). This is critical for plus-sizing - when you select 22" vs 18", all wheels must scale identically.

3. **500×500 canvas**: Large enough for quality but small enough for fast loading. Square format ensures consistent scaling.

### Wheel Diameter Scaling

The visualizer uses 18" as the reference diameter. Other sizes are scaled automatically:

| Wheel Size | Scale Factor |
|------------|--------------|
| 17" | 0.944 (17/18) |
| 18" | 1.000 (reference) |
| 20" | 1.111 (20/18) |
| 22" | 1.222 (22/18) |
| 24" | 1.333 (24/18) |

### Processing Existing Images

If you have a wheel image that includes the tire, use this script to extract just the wheel:

```javascript
const sharp = require('sharp');

async function processWheel(inputPath, outputPath) {
  const size = 500;
  const circleRadius = 220;
  
  // Get input dimensions
  const metadata = await sharp(inputPath).metadata();
  const inputSize = Math.min(metadata.width, metadata.height);
  
  // Estimate wheel portion (center 50-60% of image)
  const cropSize = Math.floor(inputSize * 0.5);
  const offset = Math.floor((inputSize - cropSize) / 2);
  
  // Create circular mask
  const circleMask = Buffer.from(
    `<svg width="${size}" height="${size}">
      <circle cx="${size/2}" cy="${size/2}" r="${circleRadius}" fill="white"/>
    </svg>`
  );
  
  // Crop, resize, and apply mask
  const croppedWheel = await sharp(inputPath)
    .extract({ left: offset, top: offset, width: cropSize, height: cropSize })
    .resize(size, size)
    .toBuffer();
  
  const mask = await sharp(circleMask).resize(size, size).greyscale().toBuffer();
  
  await sharp(croppedWheel)
    .composite([{ input: mask, blend: 'dest-in' }])
    .toFile(outputPath);
}
```

### File Naming Convention

Use descriptive names that include brand and style:
- `fuel-assault-black.png`
- `american-force-rebel-chrome.png`
- `asanti-black-ab039-machined.png`

### Quality Checklist

Before adding a wheel image to the visualizer:

- [ ] Image is 500×500 pixels
- [ ] PNG format with transparency
- [ ] Contains ONLY the wheel (no tire visible)
- [ ] Wheel fills 85-95% of canvas
- [ ] Circular shape (no square corners)
- [ ] Good resolution (not pixelated)
- [ ] Center cap and lug holes visible
- [ ] File size under 100KB (optimize if larger)

### Example Images

See these reference files:
- `test-wheel.png` - Correctly formatted wheel
- `wheel-basic.png` - Correctly formatted wheel

---

Last updated: 2026-05-18
