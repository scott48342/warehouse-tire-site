# National Homepage Backup

Created: 2025-05-01

These are backups of the original national homepage components before the local homepage redesign.

## Files Backed Up
- PremiumHero.tsx
- BuildStyleCards.tsx  
- WhyUs.tsx

## To Restore
Copy these files back to the parent directory and remove LocalHomepage references from:
- src/app/page.tsx
- src/components/homepage/index.ts

## What Changed
The national homepage was NOT modified. We added a NEW LocalHomepage component that only renders when:
- Host includes "warehousetire.net"
- Or FORCE_LOCAL_MODE=true env var is set

The national homepage still uses the original components when accessed via:
- shop.warehousetiredirect.com
- localhost without FORCE_LOCAL_MODE
