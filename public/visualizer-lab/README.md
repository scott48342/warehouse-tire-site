# Visualizer Lab Assets

**Internal R&D tool - NOT for public use**

## Folder Structure

```
visualizer-lab/
├── families/
│   ├── half_ton_truck_v1/
│   │   ├── stock.png       # Stock stance template
│   │   ├── leveled.png     # 2" level template
│   │   ├── lift_4.png      # 4" lift template
│   │   ├── lift_6.png      # 6" lift template
│   │   └── lift_8.png      # 8" lift template
│   ├── hd_truck_v1/        # (future)
│   ├── offroad_suv_v1/     # (future)
│   └── ...
└── README.md
```

## Template Generation Rules

All vehicle templates MUST follow these rules for consistent overlay placement:

1. **Canvas Size:** 1600 × 900 pixels
2. **Camera Angle:** 3/4 front view
3. **Camera Height:** Mid-level (eye height)
4. **Framing:** Vehicle centered, wheels clearly visible
5. **Background:** Neutral (transparent or solid color)
6. **Wheel Visibility:** Both front and rear wheels unobstructed
7. **Consistent FOV:** Same field of view across all templates in a family

## Generating Templates

Templates can be generated via:
- AI image generation (DALL-E, Midjourney, etc.)
- Professional photography with background removal
- 3D renders from vehicle models

The visualizer-lab calibration tool allows fine-tuning anchor positions after generation.
