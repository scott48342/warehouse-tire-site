# Tire Guide Pro reconcile â€” 2026-09-16

Script: `scripts/audit/pass3/tireguide/reconcile-tg.mjs` (plan: `reconcile-plan-2026-09-16.json`). Source: Tire Guide Pro prints scraped to
`scripts/audit/pass3/tireguide/out/<year>/<make>/<model>.json` (119 files). Tire Guide Pro is the authoritative OE source (HIGH).

## Totals
| metric | count |
|---|---|
| Y/M/M reconciled | 93 |
| rows inserted (wheel_specs_source=tireguide-pro, HIGH, last_modified_by=audit-tg-reconcile) | 339 |
| old live rows quarantined (last_modified_by=audit-tg-reconcile) | 570 |
| quarantined rows whose modification_id got the `~q-tg-2026-09-16` suffix (to free the clean id for the TG row) | 0 |

## Skipped
- empties / no parseable options (0): none
- already tireguide-pro (0): none
- no catalog_models entry (9): 2024 alfa romeo giulia; 2024 alfa romeo stelvio; 2024 bentley flying-spur; 2024 cadillac escalade-esv; 2024 ferrari roma; 2024 ferrari sf90; 2024 gmc hummer-ev-suv; 2024 land rover range-rover-sport; 2026 bentley bentayga
- TG print model â‰  our model (picker overshoot; 17): 2024 audi a4 (TG print = "Audi A4 allroad"); 2024 audi a6 (TG print = "Audi A6 allroad"); 2024 audi q5 (TG print = "Audi Trucks Q5 PHEV"); 2024 bmw 2-series (TG print = "BMW 228i Gran Coupe"); 2024 bmw 3-series (TG print = "BMW 330e"); 2024 bmw 4-series (TG print = "BMW 430i"); 2024 bmw 4-series-gran-coupe (TG print = "BMW 430i"); 2024 bmw 5-series (TG print = "BMW 530i"); 2024 bmw 7-series (TG print = "BMW 740i"); 2024 bmw 8-series (TG print = "BMW 840i"); 2024 bmw m2 (TG print = "BMW M235i xDrive Gran Coupe"); 2024 bmw m3 (TG print = "BMW M340i"); 2024 bmw m4 (TG print = "BMW M440i"); 2024 bmw m8 (TG print = "BMW M8 Gran Coupe"); 2024 buick encore (TG print = "Buick Trucks Encore GX"); 2024 chevrolet silverado (TG print = "Chevrolet Trucks Silverado 1500"); 2024 ford transit (TG print = "Ford Vans Transit-150")
- no offset source (0): none
- no center-bore source (0): none

## Bolt pattern conflicts (TG wins)
| Y/M/M | ours | Tire Guide Pro |
|---|---|---|
| 2024 buick enclave | 5x120 | 6x120 |
| 2024 chevrolet colorado | 6x120 | 6x139.7 |
| 2024 chevrolet silverado-3500hd | 8x180 | 8x180, 8x210 |
| 2024 chevrolet traverse | 5x120, 6x120 | 6x120 |
| 2024 ford f-350 | 8x170 | 8x170, 8x200 |
| 2024 ford mustang-mach-e | 5x114.3 | 5x108 |
| 2024 gmc canyon | 6x120 | 6x139.7 |
| 2024 gmc sierra-3500hd | 8x180 | 8x180, 8x210 |
| 2024 honda civic | 5x114.3 | 5x114.3, 5x120 |
| 2025 audi sq6-e-tron | 5x112, 5x130 | 5x112 |
| 2025 buick enclave | 5x120, 6x120 | 6x120 |
| 2025 porsche macan | 5x112 | 5x112, 5x130 |
| 2025 ram 3500 | 8x165.1 | 8x165.1, 8x200 |

## Notes
- 2024 chevrolet silverado-2500hd: year 2024 missing from catalog_models.years (picker may not list it)
- 2024 chevrolet silverado-3500hd: year 2024 missing from catalog_models.years (picker may not list it)
- 2024 gmc sierra-2500hd: year 2024 missing from catalog_models.years (picker may not list it)
- 2024 gmc sierra-3500hd: year 2024 missing from catalog_models.years (picker may not list it)
- 2024 hyundai santa-fe: TG print has no bolt circle; carried our bolt 5x114.3
- 2025 chevrolet silverado-2500hd: year 2025 missing from catalog_models.years (picker may not list it)
- 2025 land rover range-rover: year 2025 missing from catalog_models.years (picker may not list it)

## Reconciled Y/M/M
### 1998 ford ranger â€” TG "Ford Trucks Ranger"
old: 4 rows (5x114.3) [2WD; 4WD; Splash 2WD; Splash 4WD] â†’ quarantined 4, inserted 5; offset/CB carry: same-year
- **EV 4x2 / XL 4x2 / XLT 4x2** â€” 14x5.5@20 | 205/75R14 215/75R14 | 5x114.3 cb=70.6 off=-6..45 | trim-match "2WD" | `1998-ford-ranger-ev-4x2-xl-4x2-xlt-4x2`
- **Splash 4x2 / Splash 4x2 Super Cab** â€” 15x7@20 | 235/60R15 | 5x114.3 cb=70.6 off=-6..45 | trim-match "Splash 2WD" | `1998-ford-ranger-splash-4x2-splash-4x2-super-cab`
- **Splash 4x4 / Splash 4x4 Super Cab** â€” 15x7@20 | 235/75R15 | 5x114.3 cb=70.6 off=-6..45 | trim-match "Splash 4WD" | `1998-ford-ranger-splash-4x4-splash-4x4-super-cab`
- **XL 4x2 (70 Series Option) / XLT 4x2 (70 Series Option)** â€” 14x6@20 | 225/70R14 | 5x114.3 cb=70.6 off=-6..45 | trim-match "2WD" | `1998-ford-ranger-xl-4x2-70-series-option-xlt-4x2-70-series-option`
- **XL 4x4 / XLT 4x4** â€” 15x6@10 | 215/75R15 | 5x114.3 cb=70.6 off=-12..31 | trim-match "4WD" | `1998-ford-ranger-xl-4x4-xlt-4x4`

### 2021 chevrolet silverado-1500 â€” TG "Chevrolet Trucks Silverado 1500"
old: 9 rows (6x139.7) [2.7T; Base; Custom; High Country; LT; LT Trail Boss; LTZ; RST; WT] â†’ quarantined 9, inserted 7; offset/CB carry: same-year
- **Custom** â€” 20x9@23 | 275/60R20 | 6x139.7 cb=78.1 off=0..46 | trim-match "Custom" | `2021-chevrolet-silverado-1500-custom`
- **Custom Trail Boss / LT Trail Boss** â€” 18x8.5@23 20x8.5@23 | 275/65R18 265/60R20 | 6x139.7 cb=78.1 off=0..46 | trim-match "LT Trail Boss" | `2021-chevrolet-silverado-1500-custom-trail-boss-lt-trail-boss`
- **High Country / LTZ** â€” 20x9@23 22x9@23 | 275/60R20 275/50R22 | 6x139.7 cb=78.1 off=0..46 | trim-match "High Country" | `2021-chevrolet-silverado-1500-high-country-ltz`
- **LT** â€” 17x8@23 18x8.5@23 20x9@23 | 255/70R17 265/70R17 265/65R18 275/60R20 275/65R18 | 6x139.7 cb=78.1 off=0..46 | trim-match "LT" | `2021-chevrolet-silverado-1500-lt`
- **RST** â€” 18x8.5@23 20x9@23 22x9@23 | 265/65R18 275/60R20 275/50R22 | 6x139.7 cb=78.1 off=0..46 | trim-match "RST" | `2021-chevrolet-silverado-1500-rst`
- **SSV** â€” 17xnull@23 18xnull@23 | 255/70R17 265/70R17 275/65R18 | 6x139.7 cb=78.1 off=0..46 | same-year mode | bolt missing on TG print for this trim; used file-level TG bolt 6x139.7; rim width missing on TG print (diameter from tire) | `2021-chevrolet-silverado-1500-ssv`
- **WT** â€” 17x8@23 18x8.5@23 | 255/70R17 265/70R17 275/65R18 | 6x139.7 cb=78.1 off=0..46 | trim-match "WT" | `2021-chevrolet-silverado-1500-wt`

### 2023 bmw xm â€” TG "BMW Trucks XM"
old: 1 rows (5x112) [Base] â†’ quarantined 1, inserted 1; offset/CB carry: same-year
- **Base** â€” f:23x10@40 r:23x11@40 f:22x10@40 r:22x11@40 | 275/35R23 315/30R23 275/40R22 315/35R22 | 5x112 cb=66.6 off=30..50 | trim-match "Base" | tire/rim salvaged from _unparsed | `2023-bmw-xm-base`

### 2023 chevrolet trailblazer â€” TG "Chevrolet Trucks Trailblazer"
old: 7 rows (5x115) [Activ; Activ, RS; L; L, LS, LT; LS; LT; RS] â†’ quarantined 7, inserted 3; offset/CB carry: same-year
- **ACTIV / LS** â€” 17x7.5@45 | 225/60R17 | 5x115 cb=70.3 off=40..50 | trim-match "Activ" | `2023-chevrolet-trailblazer-activ-ls`
- **LT** â€” 17x7.5@45 18x7.5@45 | 225/60R17 225/55R18 | 5x115 cb=70.3 off=40..50 | trim-match "LT" | `2023-chevrolet-trailblazer-lt`
- **RS** â€” 18x7.5@45 | 225/55R18 | 5x115 cb=70.3 off=40..50 | trim-match "RS" | `2023-chevrolet-trailblazer-rs`

### 2023 dodge challenger â€” TG "Dodge Challenger"
old: 13 rows (5x115) [Base; GT; R/T; R/T; R/T Scat Pack; R/T Scat Pack; R/T Scat Pack Widebody; SRT Hellcat; SRT Hellcat Redeye Widebody; SRT Hellcat Widebody; SRT Super Stock; SXT; SXT] â†’ quarantined 13, inserted 9; offset/CB carry: same-year
- **GT (AWD)** â€” 20x8@23 | 245/45R20 | 5x115 cb=71.5 off=5..40 | trim-match "GT" | `2023-dodge-challenger-gt-awd`
- **GT (RWD)** â€” 20x8@23 20x9@23 | 245/45R20 | 5x115 cb=71.5 off=5..40 | trim-match "GT" | `2023-dodge-challenger-gt-rwd`
- **R/T** â€” 20x8@23 20x9@23 20x9.5@23 | 245/45R20 275/40R20 | 5x115 cb=71.5 off=5..40 | trim-match "R/T" | `2023-dodge-challenger-r-t`
- **R/T Scat Pack** â€” 20x9@23 20x9.5@23 | 245/45R20 275/40R20 | 5x115 cb=71.5 off=11..34 | trim-match "R/T Scat Pack" | `2023-dodge-challenger-r-t-scat-pack`
- **R/T Scat Pack Widebody / SRT Hellcat Jailbreak / SRT Hellcat Redeye Widebody / SRT Hellcat Widebody** â€” 20x11@23 | 305/35R20 | 5x115 cb=71.5 off=5..40 | trim-match "R/T Scat Pack Widebody" | `2023-dodge-challenger-r-t-scat-pack-widebody-srt-hellcat-jailbreak-srt-hellcat-redeye-widebody-srt-hellcat-widebody`
- **SRT Hellcat / SRT Hellcat Redeye** â€” 20x9.5@23 | 275/40R20 | 5x115 cb=71.5 off=5..40 | trim-match "SRT Hellcat" | `2023-dodge-challenger-srt-hellcat-srt-hellcat-redeye`
- **SRT Super Stock** â€” 18x11@18 | 315/40R18 | 5x115 cb=71.5 off=8..28 | trim-match "SRT Super Stock" | `2023-dodge-challenger-srt-super-stock`
- **SXT (AWD)** â€” 19x7.5@23 20x8@23 | 235/55R19 245/45R20 | 5x115 cb=71.5 off=5..40 | trim-match "SXT" | `2023-dodge-challenger-sxt-awd`
- **SXT (RWD)** â€” 18x7.5@23 20x8@23 | 235/55R18 245/45R20 | 5x115 cb=71.5 off=5..40 | trim-match "SXT" | `2023-dodge-challenger-sxt-rwd`

### 2024 acura mdx â€” TG "Acura Trucks MDX"
old: 6 rows (5x120) [A-Spec; Advance; Base; Base, Technology, A-Spec, Advance, Type S; Technology; Type S] â†’ quarantined 6, inserted 3; offset/CB carry: same-year
- **Base / SH-AWD** â€” 19x8.5@48 | 255/55R19 | 5x120 cb=64.1 off=40..55 | trim-match "Base" | `2024-acura-mdx-base-sh-awd`
- **SH-AWD A-Spec / SH-AWD Advance Pkg. / SH-AWD Tech Pkg. / Tech Pkg.** â€” 20x9@48 | 255/50R20 | 5x120 cb=64.1 off=40..55 | trim-match "Base, Technology, A-Spec, Advance, Type S" | `2024-acura-mdx-sh-awd-a-spec-sh-awd-advance-pkg-sh-awd-tech-pkg-tech-pkg`
- **Type S** â€” 21x9.5@48 | 275/40R21 | 5x120 cb=64.1 off=40..55 | trim-match "Type S" | `2024-acura-mdx-type-s`

### 2024 acura rdx â€” TG "Acura Trucks RDX"
old: 5 rows (5x114.3) [A-Spec; Advance; Base; Base, Technology, A-Spec, Advance; Technology] â†’ quarantined 5, inserted 2; offset/CB carry: same-year
- **SH-AWD / SH-AWD Advance Pkg. / SH-AWD Tech Pkg.** â€” 19x8@48 | 235/55R19 | 5x114.3 cb=64.1 off=40..55 | trim-match "Advance" | `2024-acura-rdx-sh-awd-sh-awd-advance-pkg-sh-awd-tech-pkg`
- **SH-AWD A-Spec / SH-AWD A-Spec Advance** â€” 20x8@48 | 255/45R20 | 5x114.3 cb=64.1 off=40..55 | trim-match "Base, Technology, A-Spec, Advance" | `2024-acura-rdx-sh-awd-a-spec-sh-awd-a-spec-advance`

### 2024 acura tlx â€” TG "Acura TLX"
old: 6 rows (5x120) [A-Spec; Advance; Base; Base, Technology, A-Spec, Advance, Type S; Technology; Type S] â†’ quarantined 6, inserted 2; offset/CB carry: same-year
- **A-Spec / Technology** â€” 19x8.5@48 | 255/40R19 | 5x120 cb=64.1 off=40..55 | trim-match "A-Spec" | `2024-acura-tlx-a-spec-technology`
- **Type S** â€” 20x9@48 | 255/35R20 | 5x120 cb=64.1 off=40..55 | trim-match "Type S" | `2024-acura-tlx-type-s`

### 2024 audi a7 â€” TG "Audi A7 Sportback"
old: 1 rows (5x112) [Base] â†’ quarantined 1, inserted 2; offset/CB carry: same-year
- **Premium / Premium Plus / Prestige** â€” 20x8.5@45 | 255/40R20 | 5x112 cb=66.5 off=35..55 | trim-match "Base" | `2024-audi-a7-premium-premium-plus-prestige`
- **Prestige w/Black Optic Pkg.** â€” 20x8.5@45 21x8.5@45 | 255/40R20 255/35R21 | 5x112 cb=66.5 off=35..55 | same-year mode | `2024-audi-a7-prestige-w-black-optic-pkg`

### 2024 audi a8 â€” TG "Audi A8 Quattro"
old: 1 rows (5x112) [Base] â†’ quarantined 1, inserted 3; offset/CB carry: same-year
- **L** â€” 19x9@45 | 255/45R19 | 5x112 cb=66.5 off=35..55 | same-year mode | `2024-audi-a8-l`
- **L w/Black Optic Pkg.** â€” 21x9@45 | 265/35R21 | 5x112 cb=66.5 off=35..55 | same-year mode | `2024-audi-a8-l-w-black-optic-pkg`
- **L w/Executive Pkg.** â€” 20x9@45 | 265/40R20 | 5x112 cb=66.5 off=35..55 | same-year mode | `2024-audi-a8-l-w-executive-pkg`

### 2024 audi q3 â€” TG "Audi Trucks Q3"
old: 4 rows (5x112) [Premium; Premium Plus; Premium, Premium Plus, Prestige; Prestige] â†’ quarantined 4, inserted 2; offset/CB carry: same-year
- **Premium / Premium Plus 40 TFSI** â€” 18x7@45 19x7@45 | 235/55R18 235/50R19 255/45R19 | 5x112 cb=57.1 off=40..50 | trim-match "Premium" | `2024-audi-q3-premium-premium-plus-40-tfsi`
- **Premium Plus 45 TFSI** â€” 18x7@45 19x7@45 20x8.5@45 | 235/55R18 235/50R19 255/45R19 255/40R20 | 5x112 cb=57.1 off=40..50 | trim-match "Premium Plus" | `2024-audi-q3-premium-plus-45-tfsi`

### 2024 audi rs7 â€” TG "Audi RS7 Sportback"
old: 1 rows (5x112) [Base] â†’ quarantined 1, inserted 2; offset/CB carry: same-year
- **(155 mph) / (190 mph) w/Ceramic Brake Pkg.** â€” 21x10.5@45 22x10.5@45 | 275/35R21 285/30R22 | 5x112 cb=66.5 off=35..55 | same-year mode | `2024-audi-rs7-155-mph-190-mph-w-ceramic-brake-pkg`
- **(155 mph) w/Black Optic Pkg. / (190 mph) w/Black Optic Pkg.** â€” 22x10.5@45 | 285/30R22 | 5x112 cb=66.5 off=35..55 | same-year mode | `2024-audi-rs7-155-mph-w-black-optic-pkg-190-mph-w-black-optic-pkg`

### 2024 buick enclave â€” TG "Buick Trucks Enclave"
old: 5 rows (5x120) [Avenir; Essence; Preferred; Preferred, Essence, Avenir; Premium] â†’ quarantined 5, inserted 2; offset/CB carry: same-year
- **Avenir / Essence Sport Touring Edition** â€” 20x8@45 | 255/55R20 | 6x120 cb=67.1 off=40..50 | trim-match "Avenir" | `2024-buick-enclave-avenir-essence-sport-touring-edition`
- **Essence / Premium** â€” 18x7.5@45 20x8@45 | 255/65R18 255/55R20 | 6x120 cb=67.1 off=40..50 | trim-match "Essence" | `2024-buick-enclave-essence-premium`

### 2024 buick envision â€” TG "Buick Trucks Envision"
old: 4 rows (5x120) [Avenir; Essence; Preferred; Preferred, Essence, Avenir] â†’ quarantined 4, inserted 2; offset/CB carry: same-year
- **Avenir / Sport Touring** â€” 20x8.5@43 | 245/45R20 | 5x120 cb=66.9 off=38..48 | trim-match "Avenir" | `2024-buick-envision-avenir-sport-touring`
- **Preferred** â€” 18x8@43 | 235/60R18 | 5x120 cb=66.9 off=38..48 | trim-match "Preferred" | `2024-buick-envision-preferred`

### 2024 cadillac escalade â€” TG "Cadillac Trucks Escalade"
old: 6 rows (6x139.7) [Luxury; Luxury, Premium Luxury, Sport, Platinum, V; Platinum; Premium Luxury; Sport; V] â†’ quarantined 6, inserted 1; offset/CB carry: same-year
- **Luxury / Premium Luxury / Premium Luxury Platinum / Sport / Sport Platinum / V** â€” 22x9@34 | 275/50R22 | 6x139.7 cb=78.1 off=24..44 | trim-match "Luxury" | `2024-cadillac-escalade-luxury-premium-luxury-premium-luxury-platinum-sport-sport-platinum-v`

### 2024 cadillac xt4 â€” TG "Cadillac Trucks XT4"
old: 4 rows (5x120) [Luxury; Luxury, Premium Luxury, Sport; Premium Luxury; Sport] â†’ quarantined 4, inserted 1; offset/CB carry: same-year
- **Luxury / Premium Luxury / Sport** â€” 18x8@45 20x8.5@45 | 235/60R18 245/45R20 | 5x120 cb=66.9 off=40..50 | trim-match "Luxury" | `2024-cadillac-xt4-luxury-premium-luxury-sport`

### 2024 chevrolet camaro â€” TG "Chevrolet Camaro"
old: 12 rows (5x120) [Base; LS; LT; LT RS Package; LT1; SS; SS 1LE; SS 1LE Track Package; ZL1; ZL1 1LE; ZL1 1LE Extreme Track; ZL1 1LE Extreme Track Package] â†’ quarantined 12, inserted 5; offset/CB carry: same-year
- **LT** â€” 18x7.5@40 20x8.5@40 | 245/50R18 245/40R20 | 5x120 cb=67.1 off=25..55 | trim-match "LT" | `2024-chevrolet-camaro-lt`
- **LT1** â€” 20x8.5@35 | 245/40R20 | 5x120 cb=67.1 off=25..45 | trim-match "LT1" | `2024-chevrolet-camaro-lt1`
- **SS 1LE Pkg. / ZL1** â€” f:20x10@30 r:20x11@30 | 285/30R20 305/30R20 | 5x120 cb=67.1 off=20..40 | trim-match "ZL1" | `2024-chevrolet-camaro-ss-1le-pkg-zl1`
- **SS** â€” f:20x8.5@35 r:20x9.5@35 | 245/40R20 275/35R20 | 5x120 cb=67.1 off=25..45 | trim-match "SS" | `2024-chevrolet-camaro-ss`
- **ZL1 1LE Pkg.** â€” f:19x11@40 r:19x12@40 | 305/30R19 325/30R19 | 5x120 cb=67.1 off=25..55 | trim-match "ZL1 1LE Extreme Track Package" | `2024-chevrolet-camaro-zl1-1le-pkg`

### 2024 chevrolet colorado â€” TG "Chevrolet Trucks Colorado"
old: 6 rows (6x120) [LT; Trail Boss; WT; WT, LT, Z71, ZR2, Trail Boss; Z71; ZR2] â†’ quarantined 6, inserted 6; offset/CB carry: same-year
- **LT** â€” 17x8@34 18x8.5@34 | 255/65R17 265/60R18 | 6x139.7 cb=67.1 off=22..45 | trim-match "LT" | `2024-chevrolet-colorado-lt`
- **Trail Boss** â€” 18x8.5@34 20x9@34 | 265/65R18 275/60R20 275/65R18 | 6x139.7 cb=67.1 off=22..45 | trim-match "Trail Boss" | `2024-chevrolet-colorado-trail-boss`
- **WT** â€” 17x8@34 | 255/65R17 | 6x139.7 cb=67.1 off=22..45 | trim-match "WT" | `2024-chevrolet-colorado-wt`
- **Z71** â€” 18x8.5@34 20x9@34 | 265/65R18 255/55R20 | 6x139.7 cb=67.1 off=22..45 | trim-match "Z71" | `2024-chevrolet-colorado-z71`
- **ZR2** â€” 17x8@34 | 285/70R17 | 6x139.7 cb=67.1 off=22..45 | trim-match "ZR2" | `2024-chevrolet-colorado-zr2`
- **ZR2 Bison Edition** â€” 17x8.5@34 | 315/70R17 | 6x139.7 cb=67.1 off=22..45 | trim-match "ZR2" | `2024-chevrolet-colorado-zr2-bison-edition`

### 2024 chevrolet corvette â€” TG "Chevrolet Corvette"
old: 12 rows (5x120) [Base; E-Ray; E-Ray 1LZ; E-Ray 3LZ; Stingray; Stingray 1LT; Stingray 2LT; Stingray 3LT; Stingray Z51; Z06; Z06 1LZ; Z06 3LZ] â†’ quarantined 12, inserted 2; offset/CB carry: same-year
- **E-RAY / E-RAY w/ZER Performance Pkg. / Z06 / Z06 w/Z07 Performance Pkg.** â€” f:20x10@38 r:21x13@38 | 275/30R20 345/25R21 | 5x120 cb=70.3 off=18..58 | trim-match "E-Ray" | `2024-chevrolet-corvette-e-ray-e-ray-w-zer-performance-pkg-z06-z06-w-z07-performance-pkg`
- **Stingray / Stingray w/Z51 Performance Pkg.** â€” f:19x8.5@38 r:20x11@38 | 245/35R19 305/30R20 | 5x120 cb=70.3 off=18..58 | trim-match "Stingray" | `2024-chevrolet-corvette-stingray-stingray-w-z51-performance-pkg`

### 2024 chevrolet equinox â€” TG "Chevrolet Trucks Equinox"
old: 5 rows (5x115) [LS; LS, LT, RS, Premier; LT; Premier; RS] â†’ quarantined 5, inserted 5; offset/CB carry: same-year
- **LS** â€” 17x7@43 | 225/65R17 | 5x115 cb=70.3 off=38..47 | trim-match "LS" | `2024-chevrolet-equinox-ls`
- **LS Midnight Edition / LS Sport Edition** â€” 18x7@43 | 225/60R18 | 5x115 cb=70.3 off=38..47 | trim-match "LS" | `2024-chevrolet-equinox-ls-midnight-edition-ls-sport-edition`
- **LT** â€” 17x7@43 18x7@43 19x7.5@43 | 225/65R17 225/60R18 235/50R19 | 5x115 cb=70.3 off=38..47 | trim-match "LT" | `2024-chevrolet-equinox-lt`
- **Premier** â€” 18x7@43 19x7.5@43 | 225/60R18 235/50R19 | 5x115 cb=70.3 off=38..47 | trim-match "Premier" | `2024-chevrolet-equinox-premier`
- **RS** â€” 19x7.5@43 | 235/50R19 | 5x115 cb=70.3 off=38..47 | trim-match "RS" | `2024-chevrolet-equinox-rs`

### 2024 chevrolet equinox-ev â€” TG "Chevrolet Trucks Equinox EV"
old: 4 rows (6x120) [1LT; 2LT; 3LT; RS] â†’ quarantined 4, inserted 2; offset/CB carry: same-year
- **1LT / 2LT** â€” 19x8.5@38 | 245/55R19 | 6x120 cb=70.3 off=20..55 | trim-match "1LT" | `2024-chevrolet-equinox-ev-1lt-2lt`
- **3LT / RS** â€” 21x9@38 | 275/40R21 | 6x120 cb=70.3 off=20..55 | trim-match "3LT" | `2024-chevrolet-equinox-ev-3lt-rs`

### 2024 chevrolet express-2500 â€” TG "Chevrolet Vans Express 2500"
old: 4 rows (8x165.1) [Cargo; LS; LT; Passenger] â†’ quarantined 4, inserted 1; offset/CB carry: same-year
- **Base / LS / LT** â€” 16x6.5@39 | 245/75R16 | 8x165.1 cb=121 off=28..50 | trim-match "LS" | `2024-chevrolet-express-2500-base-ls-lt`

### 2024 chevrolet express-3500 â€” TG "Chevrolet Vans Express 3500"
old: 5 rows (8x165.1) [Cargo; Cutaway; LS; LT; Passenger] â†’ quarantined 5, inserted 1; offset/CB carry: same-year
- **Base / LS / LT** â€” 16x6.5@39 | 245/75R16 | 8x165.1 cb=121 off=28..50 | trim-match "LS" | `2024-chevrolet-express-3500-base-ls-lt`

### 2024 chevrolet malibu â€” TG "Chevrolet Malibu"
old: 5 rows (5x115) [LS; LS, RS, LT, Premier; LT; Premier; RS] â†’ quarantined 5, inserted 4; offset/CB carry: same-year
- **2LT** â€” 19x8@44 | 245/40R19 | 5x115 cb=70.3 off=38..50 | same-year mode | `2024-chevrolet-malibu-2lt`
- **LS** â€” 16x7.5@44 | 205/65R16 | 5x115 cb=70.3 off=38..50 | trim-match "LS" | `2024-chevrolet-malibu-ls`
- **LT** â€” 17x8@44 16x7.5@44 18x8@44 19x8@44 | 225/55R17 205/65R16 245/45R18 245/40R19 | 5x115 cb=70.3 off=38..50 | trim-match "LT" | `2024-chevrolet-malibu-lt`
- **RS** â€” 18x8@44 | 245/45R18 | 5x115 cb=70.3 off=38..50 | trim-match "RS" | `2024-chevrolet-malibu-rs`

### 2024 chevrolet silverado-1500 â€” TG "Chevrolet Trucks Silverado 1500"
old: 11 rows (6x139.7) [2.7 TurboMax; Base; Custom; Custom Trail Boss; High Country; LT; LT Trail Boss; LTZ; RST; WT; ZR2] â†’ quarantined 11, inserted 10; offset/CB carry: same-year
- **Custom** â€” 20x9@19 | 275/60R20 | 6x139.7 cb=78.1 off=-6..44 | trim-match "Custom" | `2024-chevrolet-silverado-1500-custom`
- **Custom Trail Boss / LT Trail Boss** â€” 18x8.5@19 20x9@19 | 275/65R18 275/60R20 265/60R20 | 6x139.7 cb=78.1 off=-6..44 | trim-match "Custom Trail Boss" | `2024-chevrolet-silverado-1500-custom-trail-boss-lt-trail-boss`
- **High Country / LTZ** â€” 20x9@19 22x9@19 | 275/60R20 275/50R22 | 6x139.7 cb=78.1 off=-6..44 | trim-match "High Country" | `2024-chevrolet-silverado-1500-high-country-ltz`
- **LT** â€” 17x8@19 18x8.5@19 22x9@19 20x9@19 | 255/70R17 265/70R17 265/65R18 275/50R22 275/60R20 | 6x139.7 cb=78.1 off=-6..44 | trim-match "LT" | `2024-chevrolet-silverado-1500-lt`
- **PPV** â€” 20xnull@19 | 275/60R20 | 6x139.7 cb=78.1 off=-6..44 | same-year mode | bolt missing on TG print for this trim; used file-level TG bolt 6x139.7; rim width missing on TG print (diameter from tire) | `2024-chevrolet-silverado-1500-ppv`
- **RST** â€” 18x8.5@19 20x9@19 22x9@19 | 265/65R18 275/60R20 275/50R22 | 6x139.7 cb=78.1 off=-6..44 | trim-match "RST" | `2024-chevrolet-silverado-1500-rst`
- **SSV** â€” 17xnull@19 18xnull@19 | 255/70R17 265/70R17 275/65R18 | 6x139.7 cb=78.1 off=-6..44 | same-year mode | bolt missing on TG print for this trim; used file-level TG bolt 6x139.7; rim width missing on TG print (diameter from tire) | `2024-chevrolet-silverado-1500-ssv`
- **WT** â€” 17x8@19 | 255/70R17 265/70R17 | 6x139.7 cb=78.1 off=-6..44 | trim-match "WT" | `2024-chevrolet-silverado-1500-wt`
- **WT 4x4 Double/Crew Cab** â€” 17x8@19 18x8.5@19 | 255/70R17 265/70R17 275/65R18 | 6x139.7 cb=78.1 off=-6..44 | trim-match "WT" | `2024-chevrolet-silverado-1500-wt-4x4-double-crew-cab`
- **ZR2** â€” 18x8.5@19 | 275/70R18 | 6x139.7 cb=78.1 off=-6..44 | trim-match "ZR2" | `2024-chevrolet-silverado-1500-zr2`

### 2024 chevrolet silverado-2500hd â€” TG "Chevrolet Trucks Silverado 2500 HD"
old: 8 rows (8x180) [Base; Custom; High Country; LT; LTZ; WT; ZR2; ZR2 Bison] â†’ quarantined 8, inserted 5; offset/CB carry: same-year
- **Custom / High Country** â€” 20x8.5@8 | 275/65R20 | 8x180 cb=124.1 off=-44..60 | trim-match "Custom" | `2024-chevrolet-silverado-2500hd-custom-high-country`
- **LT** â€” 17x7.5@8 18x8@8 20x8.5@8 | 245/75R17 265/70R17 275/70R18 275/65R20 | 8x180 cb=124.1 off=-44..60 | trim-match "LT" | `2024-chevrolet-silverado-2500hd-lt`
- **LTZ** â€” 18x8@45 20x8.5@45 | 275/70R18 275/65R20 | 8x180 cb=124.1 off=35..55 | trim-match "LTZ" | `2024-chevrolet-silverado-2500hd-ltz`
- **WT** â€” 17x7.5@8 18x8@8 | 245/75R17 265/70R17 275/70R18 | 8x180 cb=124.1 off=-44..60 | trim-match "WT" | `2024-chevrolet-silverado-2500hd-wt`
- **ZR2 / ZR2 Bison / ZR2 Bison Diesel / ZR2 Diesel** â€” 18x9@45 | 305/70R18 | 8x180 cb=124.1 off=35..55 | trim-match "ZR2" | `2024-chevrolet-silverado-2500hd-zr2-zr2-bison-zr2-bison-diesel-zr2-diesel`

### 2024 chevrolet silverado-3500hd â€” TG "Chevrolet Trucks Silverado 3500 HD"
old: 5 rows (8x180) [Base; Custom; High Country; LT; WT] â†’ quarantined 5, inserted 5; offset/CB carry: same-year
- **High Country** â€” 20x8.5@8 | 275/65R20 | 8x180 cb=124.1 off=-44..60 | trim-match "High Country" | `2024-chevrolet-silverado-3500hd-high-country`
- **High Country (DRW) / LTZ (Regular Cab)(2WD)(DRW) / WT (Regular Cab)(2WD)(DRW)** â€” 18x6.5@8 | 235/80R18 | 8x210 cb=124.1 off=-44..60 | trim-match "High Country" | `2024-chevrolet-silverado-3500hd-high-country-drw-ltz-regular-cab-2wd-drw-wt-regular-cab-2wd-drw`
- **LT / LTZ** â€” 18x8@8 20x8.5@8 | 275/70R18 275/65R20 | 8x180 cb=124.1 off=-44..60 | trim-match "LT" | `2024-chevrolet-silverado-3500hd-lt-ltz`
- **LT (DRW) / LTZ (DRW) / WT (DRW)** â€” 17x6.5@8 | 235/80R17 | 8x210 cb=124.1 off=-44..60 | trim-match "LT" | `2024-chevrolet-silverado-3500hd-lt-drw-ltz-drw-wt-drw`
- **WT** â€” 18x8@8 | 275/70R18 | 8x180 cb=124.1 off=-44..60 | trim-match "WT" | `2024-chevrolet-silverado-3500hd-wt`

### 2024 chevrolet suburban â€” TG "Chevrolet Trucks Suburban"
old: 1 rows (6x139.7) [LS] â†’ quarantined 1, inserted 4; offset/CB carry: same-year
- **High Country / RST** â€” 22x9@34 | 275/50R22 | 6x139.7 cb=78.1 off=24..44 | same-year mode | `2024-chevrolet-suburban-high-country-rst`
- **LS / LT** â€” 18x8.5@34 20x9@34 22x9@34 | 265/65R18 275/60R20 275/50R22 | 6x139.7 cb=78.1 off=24..44 | trim-match "LS" | `2024-chevrolet-suburban-ls-lt`
- **Premier** â€” 20x9@34 22x9@34 | 275/60R20 275/50R22 | 6x139.7 cb=78.1 off=24..44 | same-year mode | `2024-chevrolet-suburban-premier`
- **Z71** â€” 20x9@34 | 275/60R20 | 6x139.7 cb=78.1 off=24..44 | same-year mode | `2024-chevrolet-suburban-z71`

### 2024 chevrolet tahoe â€” TG "Chevrolet Trucks Tahoe"
old: 7 rows (6x139.7) [High Country; LS; LS, LT, RST, Z71, Premier, High Country; LT; Premier; RST; Z71] â†’ quarantined 7, inserted 6; offset/CB carry: same-year
- **High Country / RST** â€” 22x9@34 | 275/50R22 | 6x139.7 cb=78.1 off=24..44 | trim-match "High Country" | `2024-chevrolet-tahoe-high-country-rst`
- **LS / LT** â€” 18x8.5@34 20x9@34 22x9@34 | 265/65R18 275/60R20 275/50R22 | 6x139.7 cb=78.1 off=24..44 | trim-match "LS" | `2024-chevrolet-tahoe-ls-lt`
- **PPV / RST w/RST Performance Edition** â€” 20x9@34 | 275/55R20 | 6x139.7 cb=78.1 off=24..44 | trim-match "RST" | `2024-chevrolet-tahoe-ppv-rst-w-rst-performance-edition`
- **Premier** â€” 20x9@34 22x9@34 | 275/60R20 275/50R22 | 6x139.7 cb=78.1 off=24..44 | trim-match "Premier" | `2024-chevrolet-tahoe-premier`
- **SSV** â€” 20xnull@34 | 275/60R20 | 6x139.7 cb=78.1 off=24..44 | same-year mode | bolt missing on TG print for this trim; used file-level TG bolt 6x139.7; rim width missing on TG print (diameter from tire) | `2024-chevrolet-tahoe-ssv`
- **Z71** â€” 20x9@34 | 275/60R20 | 6x139.7 cb=78.1 off=24..44 | trim-match "Z71" | `2024-chevrolet-tahoe-z71`

### 2024 chevrolet traverse â€” TG "Chevrolet Trucks Traverse"
old: 6 rows (6x120/5x120) [High Country; LS; LS, LT, RS, Premier, High Country; LT; Premier; RS] â†’ quarantined 6, inserted 4; offset/CB carry: same-year
- **LS / LT** â€” 18x7.5@45 | 255/65R18 | 6x120 cb=67.1 off=40..50 | trim-match "LS" | `2024-chevrolet-traverse-ls-lt`
- **LS w/Midnight/Sport Edition / LT w/Midnight/Sport Edition** â€” 20x8@45 | 255/55R20 | 6x120 cb=67.1 off=40..50 | trim-match "LS, LT, RS, Premier, High Country" | `2024-chevrolet-traverse-ls-w-midnight-sport-edition-lt-w-midnight-sport-edition`
- **RS** â€” 22x8.5@45 | 275/45R22 | 6x120 cb=67.1 off=40..50 | trim-match "RS" | `2024-chevrolet-traverse-rs`
- **Z71** â€” 18x8@45 | 265/65R18 | 6x120 cb=67.1 off=40..50 | same-year mode | `2024-chevrolet-traverse-z71`

### 2024 chevrolet trax â€” TG "Chevrolet Trucks Trax"
old: 6 rows (5x115) [1RS; ACTIV; Base; LS; LT; RS] â†’ quarantined 6, inserted 4; offset/CB carry: same-year
- **ACTIV** â€” 18x7.5@43 | 225/55R18 | 5x115 cb=70.3 off=35..50 | trim-match "ACTIV" | `2024-chevrolet-trax-activ`
- **LS w/Aluminum Wheels / LT** â€” 17x7.5@43 | 225/60R17 | 5x115 cb=70.3 off=35..50 | trim-match "LT" | `2024-chevrolet-trax-ls-w-aluminum-wheels-lt`
- **LS w/Steel Wheels** â€” 17x7@43 | 225/60R17 | 5x115 cb=70.3 off=35..50 | trim-match "LS" | `2024-chevrolet-trax-ls-w-steel-wheels`
- **RS** â€” 18x7.5@43 19x8@43 | 225/55R18 245/45R19 | 5x115 cb=70.3 off=35..50 | trim-match "RS" | `2024-chevrolet-trax-rs`

### 2024 ford bronco â€” TG "Ford Trucks Bronco"
old: 7 rows (6x139.7) [Badlands; Base; Big Bend; Black Diamond; Outer Banks; Raptor; Wildtrak] â†’ quarantined 7, inserted 6; offset/CB carry: same-year
- **Badlands** â€” 17x8@35 | 285/70R17 | 6x139.7 cb=93.1 off=15..55 | trim-match "Badlands" | `2024-ford-bronco-badlands`
- **Badlands w/Sasquatch Pkg. / Big Bend w/Sasquatch Pkg. / Black Diamond w/Sasquatch Pkg. / Everglades / Heritage Edition / Heritage Limited Edition / Outer Banks w/Sasquatch Pkg. / Wildtrak** â€” 17x8.5@35 | 315/70R17 | 6x139.7 cb=93.1 off=15..55 | trim-match "Wildtrak" | `2024-ford-bronco-badlands-w-sasquatch-pkg-big-bend-w-sasquatch-pkg-black-diamond-w-sasquatch-pkg-everglades-heritage-edition-heritage-limited-edition-outer-banks-w-sasquatch-pkg-wildtrak`
- **Big Bend** â€” 17x7.5@35 | 255/75R17 | 6x139.7 cb=93.1 off=15..55 | trim-match "Big Bend" | `2024-ford-bronco-big-bend`
- **Black Diamond** â€” 17x7.5@35 | 265/70R17 | 6x139.7 cb=93.1 off=15..55 | trim-match "Black Diamond" | `2024-ford-bronco-black-diamond`
- **Outer Banks** â€” 18x7.5@35 | 255/70R18 | 6x139.7 cb=93.1 off=15..55 | trim-match "Outer Banks" | `2024-ford-bronco-outer-banks`
- **Raptor** â€” 17x8.5@35 | 37x12.50R17 | 6x139.7 cb=93.1 off=15..55 | trim-match "Raptor" | `2024-ford-bronco-raptor`

### 2024 ford bronco-sport â€” TG "Ford Trucks Bronco Sport"
old: 4 rows (5x108) [Badlands; Base; Big Bend; Outer Banks] â†’ quarantined 4, inserted 4; offset/CB carry: same-year
- **Badlands** â€” 17x7@48 | 225/65R17 235/65R17 | 5x108 cb=63.4 off=40..55 | trim-match "Badlands" | `2024-ford-bronco-sport-badlands`
- **Big Bend** â€” 17x7@48 18x7@48 | 225/65R17 225/60R18 | 5x108 cb=63.4 off=40..55 | trim-match "Big Bend" | `2024-ford-bronco-sport-big-bend`
- **Free Wheeling / Heritage Edition / Outer Banks w/Black Diamond Off-Road Pkg.** â€” 17x7@48 | 225/65R17 | 5x108 cb=63.4 off=40..55 | trim-match "Outer Banks" | `2024-ford-bronco-sport-free-wheeling-heritage-edition-outer-banks-w-black-diamond-off-road-pkg`
- **Outer Banks** â€” 18x7@48 | 225/60R18 | 5x108 cb=63.4 off=40..55 | trim-match "Outer Banks" | `2024-ford-bronco-sport-outer-banks`

### 2024 ford edge â€” TG "Ford Trucks Edge"
old: 4 rows (5x108) [SE; SEL; ST; Titanium] â†’ quarantined 4, inserted 5; offset/CB carry: same-year
- **SE** â€” 18x8@48 19x8@48 | 245/60R18 245/55R19 | 5x108 cb=63.4 off=40..55 | trim-match "SE" | `2024-ford-edge-se`
- **SEL** â€” 18x8@48 | 245/60R18 | 5x108 cb=63.4 off=40..55 | trim-match "SEL" | `2024-ford-edge-sel`
- **ST** â€” 20x8@48 21x9@48 | 245/50R20 265/40R21 | 5x108 cb=63.4 off=40..55 | trim-match "ST" | `2024-ford-edge-st`
- **ST-Line** â€” 20x8@48 | 245/50R20 | 5x108 cb=63.4 off=40..55 | trim-match "ST" | `2024-ford-edge-st-line`
- **Titanium** â€” 19x8@48 20x8@48 20x8.5@48 | 245/55R19 245/50R20 | 5x108 cb=63.4 off=40..55 | trim-match "Titanium" | `2024-ford-edge-titanium`

### 2024 ford escape â€” TG "Ford Trucks Escape"
old: 7 rows (5x108) [Plug-In Hybrid; S; S, SE, SEL, ST-Line, Titanium, Plug-In Hybrid; SE; SEL; ST-Line; Titanium] â†’ quarantined 7, inserted 6; offset/CB carry: same-year
- **Active** â€” 17x7@50 | 225/65R17 | 5x108 cb=63.4 off=45..55 | same-year mode | `2024-ford-escape-active`
- **Platinum / Platinum Hybrid** â€” 19x7@50 19x7.5@50 | 225/55R19 | 5x108 cb=63.4 off=45..55 | trim-match "Plug-In Hybrid" | `2024-ford-escape-platinum-platinum-hybrid`
- **Plug-In Hybrid** â€” 18x7.5@50 | 225/60R18 | 5x108 cb=63.4 off=45..55 | trim-match "Plug-In Hybrid" | `2024-ford-escape-plug-in-hybrid`
- **ST-Line / ST-Line Hybrid** â€” 18x7@50 | 225/60R18 | 5x108 cb=63.4 off=45..55 | trim-match "ST-Line" | `2024-ford-escape-st-line-st-line-hybrid`
- **ST-Line Elite / ST-Line Elite Hybrid** â€” 19x7@50 | 225/55R19 | 5x108 cb=63.4 off=45..55 | trim-match "S, SE, SEL, ST-Line, Titanium, Plug-In Hybrid" | `2024-ford-escape-st-line-elite-st-line-elite-hybrid`
- **ST-Line Select / ST-Line Select Hybrid** â€” 18x7@50 19x7.5@50 | 225/60R18 225/55R19 | 5x108 cb=63.4 off=45..55 | trim-match "S, SE, SEL, ST-Line, Titanium, Plug-In Hybrid" | `2024-ford-escape-st-line-select-st-line-select-hybrid`

### 2024 ford expedition â€” TG "Ford Trucks Expedition"
old: 7 rows (6x135) [King Ranch; Limited; Platinum; Timberline; XL; XL, XLT, Limited, King Ranch, Platinum, Timberline; XLT] â†’ quarantined 7, inserted 5; offset/CB carry: same-year
- **King Ranch / Max King Ranch / Max Platinum / Platinum** â€” 22x9.5@35 | 285/45R22 | 6x135 cb=87.1 off=25..44 | trim-match "King Ranch" | `2024-ford-expedition-king-ranch-max-king-ranch-max-platinum-platinum`
- **Limited / Max Limited** â€” 20x8.5@35 22x9.5@35 | 275/55R20 285/45R22 | 6x135 cb=87.1 off=25..44 | trim-match "Limited" | `2024-ford-expedition-limited-max-limited`
- **Max XLT / XLT** â€” 18x8.5@35 20x8.5@35 | 275/65R18 275/55R20 | 6x135 cb=87.1 off=25..44 | trim-match "XLT" | `2024-ford-expedition-max-xlt-xlt`
- **Timberline** â€” 18x8.5@35 | 265/70R18 | 6x135 cb=87.1 off=25..44 | trim-match "Timberline" | `2024-ford-expedition-timberline`
- **XL STX** â€” 18x8.5@35 | 275/65R18 | 6x135 cb=87.1 off=25..44 | trim-match "XL" | `2024-ford-expedition-xl-stx`

### 2024 ford explorer â€” TG "Ford Trucks Explorer"
old: 8 rows (5x114.3) [Base; Base, XLT, Limited, ST, Platinum, King Ranch, Timberline; King Ranch; Limited; Platinum; ST; Timberline; XLT] â†’ quarantined 8, inserted 6; offset/CB carry: same-year
- **Base** â€” 18x7.5@48 | 255/65R18 | 5x114.3 cb=63.4 off=40..55 | trim-match "Base" | `2024-ford-explorer-base`
- **King Ranch / Limited / XLT w/Sport Appearance Pkg.** â€” 20x8@48 | 255/55R20 | 5x114.3 cb=63.4 off=40..55 | trim-match "King Ranch" | `2024-ford-explorer-king-ranch-limited-xlt-w-sport-appearance-pkg`
- **Platinum / ST w/High-Performance Pkg. / ST w/Street Pack** â€” 21x9@48 | 275/45R21 | 5x114.3 cb=63.4 off=40..55 | trim-match "Platinum" | `2024-ford-explorer-platinum-st-w-high-performance-pkg-st-w-street-pack`
- **ST / ST-Line** â€” 20x8.5@48 21x9@48 | 255/55R20 275/45R21 | 5x114.3 cb=63.4 off=40..55 | trim-match "ST" | `2024-ford-explorer-st-st-line`
- **Timberline** â€” 18x8@48 | 265/65R18 | 5x114.3 cb=63.4 off=40..55 | trim-match "Timberline" | `2024-ford-explorer-timberline`
- **XLT** â€” 18x7.5@48 20x8@48 | 255/65R18 255/55R20 | 5x114.3 cb=63.4 off=40..55 | trim-match "XLT" | `2024-ford-explorer-xlt`

### 2024 ford f-150 â€” TG "Ford Trucks F-150"
old: 11 rows (6x135) [Base; King Ranch; Lariat; Lightning; Limited; Platinum; Raptor; Raptor R; Tremor; XL; XLT] â†’ quarantined 11, inserted 10; offset/CB carry: same-year
- **King Ranch / Lariat / Platinum** â€” 20x8.5@36 22x8.5@36 | 275/60R20 275/50R22 | 6x135 cb=87.1 off=25..46 | trim-match "King Ranch" | `2024-ford-f-150-king-ranch-lariat-platinum`
- **Police Responder / STX FX4 Off-Road Pkg. / XLT FX4 Off-Road Pkg.** â€” 18x8.5@36 | 265/70R18 | 6x135 cb=87.1 off=25..46 | trim-match "XLT" | `2024-ford-f-150-police-responder-stx-fx4-off-road-pkg-xlt-fx4-off-road-pkg`
- **Raptor** â€” 17x8.5@36 | 315/70R17 37x12.50R17 | 6x135 cb=87.1 off=25..46 | trim-match "Raptor" | `2024-ford-f-150-raptor`
- **Raptor R** â€” 17x8.5@36 | 37x12.50R17 | 6x135 cb=87.1 off=25..46 | trim-match "Raptor R" | `2024-ford-f-150-raptor-r`
- **STX 4x2 / STX 4x4** â€” 20x8.5@36 | 275/60R20 | 6x135 cb=87.1 off=25..46 | same-year mode | `2024-ford-f-150-stx-4x2-stx-4x4`
- **Tremor** â€” 18x7.5@36 | 275/70R18 | 6x135 cb=87.1 off=25..46 | trim-match "Tremor" | `2024-ford-f-150-tremor`
- **XL 4x2** â€” 17x7.5@39 | 245/70R17 | 6x135 cb=87.1 off=34..44 | trim-match "XL" | `2024-ford-f-150-xl-4x2`
- **XL 4x4** â€” 17x7.5@39 | 265/70R17 | 6x135 cb=87.1 off=34..44 | trim-match "XL" | `2024-ford-f-150-xl-4x4`
- **XLT 4x2** â€” 18x7.5@36 18x8.5@36 20x8.5@36 | 265/60R18 275/60R20 | 6x135 cb=87.1 off=25..46 | trim-match "XLT" | `2024-ford-f-150-xlt-4x2`
- **XLT 4x4** â€” 18x7.5@36 18x8.5@36 20x8.5@36 | 275/65R18 275/60R20 | 6x135 cb=87.1 off=25..46 | trim-match "XLT" | `2024-ford-f-150-xlt-4x4`

### 2024 ford f-250 â€” TG "Ford Trucks F-250 Super Duty"
old: 7 rows (8x170) [King Ranch; Lariat; Limited; Platinum; Tremor; XL; XLT] â†’ quarantined 7, inserted 7; offset/CB carry: same-year
- **King Ranch / Lariat w/Sport/Chrome/Black Pkg. / Limited / Platinum / XLT w/Black Appearance Pkg.** â€” 20x8@43 | 275/65R20 | 8x170 cb=124.9 off=25..60 | trim-match "King Ranch" | `2024-ford-f-250-king-ranch-lariat-w-sport-chrome-black-pkg-limited-platinum-xlt-w-black-appearance-pkg`
- **King Ranch w/Tremor Off-Road Pkg. / Lariat w/Tremor Off-Road Pkg. / Platinum w/Tremor Off-Road Pkg. / XLT w/Tremor Off-Road Pkg.** â€” 18x8@43 | 285/75R18 | 8x170 cb=124.9 off=25..60 | trim-match "King Ranch" | `2024-ford-f-250-king-ranch-w-tremor-off-road-pkg-lariat-w-tremor-off-road-pkg-platinum-w-tremor-off-road-pkg-xlt-w-tremor-off-road-pkg`
- **Lariat / XL Reg. Cab w/STX Appearance Pkg.** â€” 18x8@43 | 275/70R18 | 8x170 cb=124.9 off=25..60 | trim-match "Lariat" | `2024-ford-f-250-lariat-xl-reg-cab-w-stx-appearance-pkg`
- **XL 4x2 / XL 4x4** â€” 17x7.5@43 | 245/75R17 | 8x170 cb=124.9 off=25..60 | trim-match "XL" | `2024-ford-f-250-xl-4x2-xl-4x4`
- **XL w/Off-Road Pkg.** â€” 17x7.5@43 | 285/70R17 | 8x170 cb=124.9 off=25..60 | trim-match "XL" | `2024-ford-f-250-xl-w-off-road-pkg`
- **XL w/STX Appearance Pkg. / XLT w/Sport Appearance Pkg.** â€” 18x8@43 20x8@43 | 275/70R18 275/65R20 | 8x170 cb=124.9 off=25..60 | trim-match "XL" | `2024-ford-f-250-xl-w-stx-appearance-pkg-xlt-w-sport-appearance-pkg`
- **XLT** â€” 18x8@43 | 275/65R18 275/70R18 | 8x170 cb=124.9 off=25..60 | trim-match "XLT" | `2024-ford-f-250-xlt`

### 2024 ford f-350 â€” TG "Ford Trucks F-350 Super Duty"
old: 6 rows (8x170) [King Ranch; Lariat; Limited; Platinum; XL; XLT] â†’ quarantined 6, inserted 8; offset/CB carry: same-year
- **King Ranch / Lariat w/Sport/Chrome Pkg. / Limited / Platinum** â€” 20x8@43 | 275/65R20 | 8x170 cb=124.9 off=25..60 | trim-match "King Ranch" | `2024-ford-f-350-king-ranch-lariat-w-sport-chrome-pkg-limited-platinum`
- **King Ranch (DRW) / Lariat (DRW) / Limited (DRW) / Platinum (DRW) / XL 4x2 (DRW) / XL 4x4 (DRW) / XLT (DRW)** â€” 17x6.5@43 | 245/75R17 | 8x200 cb=124.9 off=25..60 | trim-match "King Ranch" | `2024-ford-f-350-king-ranch-drw-lariat-drw-limited-drw-platinum-drw-xl-4x2-drw-xl-4x4-drw-xlt-drw`
- **King Ranch w/Tremor Off-Road Pkg. / Platinum w/Tremor Off-Road Pkg.** â€” 18x8@43 | 285/75R18 | 8x170 cb=124.9 off=25..60 | trim-match "King Ranch" | `2024-ford-f-350-king-ranch-w-tremor-off-road-pkg-platinum-w-tremor-off-road-pkg`
- **Lariat** â€” 18x8@43 | 275/70R18 | 8x170 cb=124.9 off=25..60 | trim-match "Lariat" | `2024-ford-f-350-lariat`
- **XL 4x2** â€” 18x8@43 | 275/65R18 | 8x170 cb=124.9 off=25..60 | trim-match "XL" | `2024-ford-f-350-xl-4x2`
- **XL 4x4** â€” 18x8@43 | 275/65R18 275/70R18 | 8x170 cb=124.9 off=25..60 | trim-match "XL" | `2024-ford-f-350-xl-4x4`
- **XL 4x4 w/Off-Road Pkg.** â€” 17x7.5@43 | 285/70R17 | 8x170 cb=124.9 off=25..60 | trim-match "XL" | `2024-ford-f-350-xl-4x4-w-off-road-pkg`
- **XLT** â€” 18x8@43 20x8@43 | 275/65R18 275/70R18 275/65R20 | 8x170 cb=124.9 off=25..60 | trim-match "XLT" | `2024-ford-f-350-xlt`

### 2024 ford mustang â€” TG "Ford Mustang"
old: 9 rows (5x114.3) [Dark Horse; Dark Horse; Dark Horse Handling Package; EcoBoost; GT; GT Performance Pack; GT Performance Package; Mach 1; Shelby GT500] â†’ quarantined 9, inserted 5; offset/CB carry: same-year
- **Dark Horse / Dark Horse Premium** â€” f:19x9.5@41 r:19x10@41 f:19x10.5@41 r:19x11@41 | 255/40R19 275/40R19 305/30R19 315/30R19 | 5x114.3 cb=70.5 off=30..52 | trim-match "Dark Horse" | `2024-ford-mustang-dark-horse-dark-horse-premium`
- **EcoBoost** â€” 17x7.5@43 18x8@43 19x9@43 19x8.5@43 | 235/55R17 235/50R18 255/40R19 | 5x114.3 cb=70.5 off=30..55 | trim-match "EcoBoost" | `2024-ford-mustang-ecoboost`
- **EcoBoost Premium** â€” 18x8@43 19x8.5@43 19x9@43 20x9@43 | 235/50R18 255/40R19 265/35R20 | 5x114.3 cb=70.5 off=30..55 | trim-match "EcoBoost" | `2024-ford-mustang-ecoboost-premium`
- **GT** â€” 18x8.5@40 19x8.5@40 f:19x9@40 r:19x9.5@40 | 255/45R18 255/40R19 275/40R19 | 5x114.3 cb=70.5 off=28..52 | trim-match "GT" | `2024-ford-mustang-gt`
- **GT Premium** â€” 19x8.5@40 f:19x9@40 r:19x9.5@40 20x9@40 | 255/40R19 275/40R19 265/35R20 | 5x114.3 cb=70.5 off=28..52 | trim-match "GT" | `2024-ford-mustang-gt-premium`

### 2024 ford mustang-mach-e â€” TG "Ford Trucks Mustang Mach-E"
old: 1 rows (5x114.3) [Base] â†’ quarantined 1, inserted 4; offset/CB carry: same-year
- **GT** â€” 20x8@50 | 245/45R20 | 5x108 cb=63.4 off=45..55 | trim-match "Base" | `2024-ford-mustang-mach-e-gt`
- **Premium** â€” 19x7.5@50 | 225/55R19 | 5x108 cb=63.4 off=45..55 | same-year mode | `2024-ford-mustang-mach-e-premium`
- **Rally** â€” 19x7.5@50 | 235/55R19 | 5x108 cb=63.4 off=45..55 | same-year mode | `2024-ford-mustang-mach-e-rally`
- **Select** â€” 19x7@50 | 225/55R19 | 5x108 cb=63.4 off=45..55 | same-year mode | `2024-ford-mustang-mach-e-select`

### 2024 ford ranger â€” TG "Ford Trucks Ranger"
old: 6 rows (6x139.7) [Lariat; Raptor; Tremor; XL; XL, XLT, Lariat, Tremor, Raptor; XLT] â†’ quarantined 6, inserted 4; offset/CB carry: same-year
- **Lariat 4x2 / Lariat 4x4** â€” 18x7.5@35 | 255/65R18 | 6x139.7 cb=93.1 off=20..50 | trim-match "Lariat" | `2024-ford-ranger-lariat-4x2-lariat-4x4`
- **Raptor** â€” 17x8.5@35 | 285/70R17 | 6x139.7 cb=93.1 off=20..50 | trim-match "Raptor" | `2024-ford-ranger-raptor`
- **XL 4x2 / XL 4x4** â€” 17x7.5@35 | 255/70R17 | 6x139.7 cb=93.1 off=20..50 | trim-match "XL" | `2024-ford-ranger-xl-4x2-xl-4x4`
- **XLT 4x2 / XLT 4x4** â€” 17x7.5@35 18x7.5@35 | 255/70R17 255/65R18 | 6x139.7 cb=93.1 off=20..50 | trim-match "XLT" | `2024-ford-ranger-xlt-4x2-xlt-4x4`

### 2024 genesis gv70 â€” TG "Genesis Trucks GV70"
old: 5 rows (5x114.3) [2.5T; 2.5T, 3.5T, Sport Prestige, Electrified; 3.5T; Electrified; Sport Prestige] â†’ quarantined 5, inserted 2; offset/CB carry: same-year
- **2.5T AWD / Advanced 2.5T AWD / Select 2.5T AWD / Sport 3.5T AWD** â€” 19x8@46 | 235/55R19 | 5x114.3 cb=67.1 off=40..52 | trim-match "2.5T, 3.5T, Sport Prestige, Electrified" | `2024-genesis-gv70-2-5t-awd-advanced-2-5t-awd-select-2-5t-awd-sport-3-5t-awd`
- **Sport Advanced 3.5T AWD / Sport Prestige 2.5T AWD / Sport Prestige 3.5T AWD** â€” 21x9@46 | 255/40R21 | 5x114.3 cb=67.1 off=40..52 | trim-match "2.5T, 3.5T, Sport Prestige, Electrified" | `2024-genesis-gv70-sport-advanced-3-5t-awd-sport-prestige-2-5t-awd-sport-prestige-3-5t-awd`

### 2024 gmc canyon â€” TG "GMC Trucks Canyon"
old: 5 rows (6x120) [AT4; AT4X; Denali; Elevation; Elevation, AT4, AT4X, Denali] â†’ quarantined 5, inserted 5; offset/CB carry: same-year
- **AT4** â€” 18x8.5@34 20x9@34 | 265/65R18 275/65R18 275/60R20 | 6x139.7 cb=67.1 off=22..45 | trim-match "AT4" | `2024-gmc-canyon-at4`
- **AT4X** â€” 17x8@34 | 285/70R17 | 6x139.7 cb=67.1 off=22..45 | trim-match "AT4X" | `2024-gmc-canyon-at4x`
- **AT4X AEV Edition** â€” 17x8.5@34 | 315/70R17 | 6x139.7 cb=67.1 off=22..45 | trim-match "AT4X" | `2024-gmc-canyon-at4x-aev-edition`
- **Denali** â€” 20x9@34 | 275/60R20 | 6x139.7 cb=67.1 off=22..45 | trim-match "Denali" | `2024-gmc-canyon-denali`
- **Elevation** â€” 18x8.5@34 | 265/65R18 | 6x139.7 cb=67.1 off=22..45 | trim-match "Elevation" | `2024-gmc-canyon-elevation`

### 2024 gmc savana-2500 â€” TG "GMC Vans Savana 2500"
old: 4 rows (8x165.1) [Cargo; Passenger; SL; SLE] â†’ quarantined 4, inserted 1; offset/CB carry: same-year
- **Base / LS / LT** â€” 16x6.5@39 | 245/75R16 | 8x165.1 cb=121 off=28..50 | same-year mode | `2024-gmc-savana-2500-base-ls-lt`

### 2024 gmc savana-3500 â€” TG "GMC Vans Savana 3500"
old: 5 rows (8x165.1) [Cargo; Cutaway; Passenger; SL; SLE] â†’ quarantined 5, inserted 1; offset/CB carry: same-year
- **Base / LS / LT** â€” 16x6.5@39 | 245/75R16 | 8x165.1 cb=121 off=28..50 | same-year mode | `2024-gmc-savana-3500-base-ls-lt`

### 2024 gmc sierra-1500 â€” TG "GMC Trucks Sierra 1500"
old: 9 rows (6x139.7) [AT4; AT4X; Base; Denali; Denali Ultimate; Elevation; Pro; SLE; SLT] â†’ quarantined 9, inserted 8; offset/CB carry: same-year
- **AT4** â€” 18x8.5@19 20x9@19 | 275/65R18 275/60R20 265/60R20 | 6x139.7 cb=78.1 off=-6..44 | trim-match "AT4" | `2024-gmc-sierra-1500-at4`
- **AT4X / AT4X AEV Edition / Pro 4x4 w/X31 Off-Road Pkg.** â€” 18x8.5@19 | 275/65R18 | 6x139.7 cb=78.1 off=-6..44 | trim-match "AT4X" | `2024-gmc-sierra-1500-at4x-at4x-aev-edition-pro-4x4-w-x31-off-road-pkg`
- **Denali** â€” 20x9@19 22x9@19 | 275/60R20 275/50R22 | 6x139.7 cb=78.1 off=-6..44 | trim-match "Denali" | `2024-gmc-sierra-1500-denali`
- **Denali Ultimate** â€” 22x9@19 | 275/50R22 | 6x139.7 cb=78.1 off=-6..44 | trim-match "Denali Ultimate" | `2024-gmc-sierra-1500-denali-ultimate`
- **Elevation / Pro Graphite Edition** â€” 20x9@19 | 275/60R20 | 6x139.7 cb=78.1 off=-6..44 | trim-match "Elevation" | `2024-gmc-sierra-1500-elevation-pro-graphite-edition`
- **Pro** â€” 17x8@19 | 255/70R17 265/70R17 | 6x139.7 cb=78.1 off=-6..44 | trim-match "Pro" | `2024-gmc-sierra-1500-pro`
- **SLE** â€” 17x8@19 18x8.5@19 20x9@19 | 255/70R17 265/70R17 265/65R18 275/60R20 | 6x139.7 cb=78.1 off=-6..44 | trim-match "SLE" | `2024-gmc-sierra-1500-sle`
- **SLT** â€” 18x8.5@19 20x9@19 22x9@19 | 265/65R18 275/60R20 275/50R22 | 6x139.7 cb=78.1 off=-6..44 | trim-match "SLT" | `2024-gmc-sierra-1500-slt`

### 2024 gmc sierra-2500hd â€” TG "GMC Trucks Sierra 2500 HD"
old: 7 rows (8x180) [AT4; Base; Denali; Denali Ultimate; Pro; SLE; SLT] â†’ quarantined 7, inserted 6; offset/CB carry: same-year
- **AT4** â€” 20x8.5@8 18x8@8 | 275/65R20 275/70R18 | 8x180 cb=124.1 off=-44..60 | trim-match "AT4" | `2024-gmc-sierra-2500hd-at4`
- **AT4X / AT4X AEV Edition / AT4X AEV Edition Diesel / AT4X Diesel** â€” 18x9@8 | 305/70R18 | 8x180 cb=124.1 off=-44..60 | same-year mode | `2024-gmc-sierra-2500hd-at4x-at4x-aev-edition-at4x-aev-edition-diesel-at4x-diesel`
- **Denali / Denali Ultimate** â€” 20x8.5@8 | 275/65R20 | 8x180 cb=124.1 off=-44..60 | trim-match "Denali" | `2024-gmc-sierra-2500hd-denali-denali-ultimate`
- **Pro** â€” 17x7.5@8 18x8@8 | 245/75R17 265/70R17 275/70R18 | 8x180 cb=124.1 off=-44..60 | trim-match "Pro" | `2024-gmc-sierra-2500hd-pro`
- **SLE** â€” 17x7.5@8 18x8@8 20x8.5@8 | 245/75R17 265/70R17 275/70R18 275/65R20 | 8x180 cb=124.1 off=-44..60 | trim-match "SLE" | `2024-gmc-sierra-2500hd-sle`
- **SLT** â€” 18x8@8 20x8.5@8 | 275/70R18 275/65R20 | 8x180 cb=124.1 off=-44..60 | trim-match "SLT" | `2024-gmc-sierra-2500hd-slt`

### 2024 gmc sierra-3500hd â€” TG "GMC Trucks Sierra 3500 HD"
old: 6 rows (8x180) [AT4; Base; Denali; Pro; SLE; SLT] â†’ quarantined 6, inserted 6; offset/CB carry: same-year
- **AT4 / Denali / Denali Ultimate** â€” 20x8.5@8 | 275/65R20 | 8x180 cb=124.1 off=-44..60 | trim-match "AT4" | `2024-gmc-sierra-3500hd-at4-denali-denali-ultimate`
- **Denali (DRW) / Denali Ultimate (DRW)** â€” 18x6.5@8 | 235/80R18 | 8x210 cb=124.1 off=-44..60 | trim-match "Denali" | `2024-gmc-sierra-3500hd-denali-drw-denali-ultimate-drw`
- **Pro** â€” 18x8@8 | 275/70R18 | 8x180 cb=124.1 off=-44..60 | trim-match "Pro" | `2024-gmc-sierra-3500hd-pro`
- **Pro (DRW) / SLE (DRW)** â€” 17x6.5@8 | 235/80R17 | 8x210 cb=124.1 off=-44..60 | trim-match "Pro" | `2024-gmc-sierra-3500hd-pro-drw-sle-drw`
- **Pro (Regular Cab)(2WD)(DRW) / SLT (DRW)** â€” 17x6.5@8 18x6.5@8 | 235/80R17 235/80R18 | 8x210 cb=124.1 off=-44..60 | trim-match "Pro" | `2024-gmc-sierra-3500hd-pro-regular-cab-2wd-drw-slt-drw`
- **SLE / SLT** â€” 18x8@8 20x8.5@8 | 275/70R18 275/65R20 | 8x180 cb=124.1 off=-44..60 | trim-match "SLE" | `2024-gmc-sierra-3500hd-sle-slt`

### 2024 gmc yukon â€” TG "GMC Trucks Yukon"
old: 11 rows (6x139.7) [AT4; Denali; Denali Ultimate; SLE; SLE, SLT, AT4, Denali, Denali Ultimate; SLT; XL AT4; XL Denali; XL Denali Ultimate; XL SLE; XL SLT] â†’ quarantined 11, inserted 4; offset/CB carry: same-year
- **AT4** â€” 20x9@34 | 275/60R20 | 6x139.7 cb=78.1 off=24..44 | trim-match "AT4" | `2024-gmc-yukon-at4`
- **Denali / SLT** â€” 20x9@34 22x9@34 | 275/60R20 275/50R22 | 6x139.7 cb=78.1 off=24..44 | trim-match "Denali" | `2024-gmc-yukon-denali-slt`
- **Denali Ultimate** â€” 22x9@34 | 275/50R22 | 6x139.7 cb=78.1 off=24..44 | trim-match "Denali Ultimate" | `2024-gmc-yukon-denali-ultimate`
- **SLE** â€” 18x8.5@34 20x9@34 22x9@34 | 265/65R18 275/60R20 275/50R22 | 6x139.7 cb=78.1 off=24..44 | trim-match "SLE" | `2024-gmc-yukon-sle`

### 2024 honda accord â€” TG "Honda Accord"
old: 10 rows (5x114.3) [EX; EX-L; EX-L Hybrid; LX; LX, Sport, EX, EX-L, Touring; Sport; Sport Hybrid; Sport-L Hybrid; Touring; Touring Hybrid] â†’ quarantined 10, inserted 2; offset/CB carry: same-year
- **EX / Hybrid EX-L / LX** â€” 17x7.5@50 | 225/50R17 | 5x114.3 cb=64.1 off=45..55 | trim-match "EX" | `2024-honda-accord-ex-hybrid-ex-l-lx`
- **Hybrid Sport / Hybrid Sport-L / Hybrid Touring** â€” 19x8.5@50 | 235/40R19 | 5x114.3 cb=64.1 off=45..55 | trim-match "Sport-L Hybrid" | `2024-honda-accord-hybrid-sport-hybrid-sport-l-hybrid-touring`

### 2024 honda civic â€” TG "Honda Civic"
old: 17 rows (5x114.3) [EX; EX-L; Hatchback EX-L; Hatchback LX; Hatchback Sport; Hatchback Sport Touring; LX; LX, Sport, EX, EX-L, Touring, Si; Sedan EX; Sedan LX; Sedan Si; Sedan Sport; Sedan Touring; Si; Sport; Touring; Type R] â†’ quarantined 17, inserted 4; offset/CB carry: same-year
- **EX Sedan / EX-L Hatchback** â€” 17x7@50 | 215/50R17 | 5x114.3 cb=64.1 off=45..55 | trim-match "Hatchback EX-L" | `2024-honda-civic-ex-sedan-ex-l-hatchback`
- **LX Hatchback / LX Sedan** â€” 16x7@50 | 215/55R16 | 5x114.3 cb=64.1 off=45..55 | trim-match "Hatchback LX" | `2024-honda-civic-lx-hatchback-lx-sedan`
- **Si / Sport Hatchback / Sport Sedan / Sport Touring Hatchback / Touring Sedan** â€” 18x8@50 | 235/40R18 | 5x114.3 cb=64.1 off=45..55 | trim-match "Si" | `2024-honda-civic-si-sport-hatchback-sport-sedan-sport-touring-hatchback-touring-sedan`
- **Type R** â€” 19x9.5@50 | 265/30R19 | 5x120 cb=64.1 off=45..55 | trim-match "Type R" | `2024-honda-civic-type-r`

### 2024 honda odyssey â€” TG "Honda Minivans Odyssey"
old: 6 rows (5x120) [Base; EX; EX-L; Elite; Sport; Touring] â†’ quarantined 6, inserted 2; offset/CB carry: same-year
- **Elite / Sport / Touring** â€” 19x7.5@48 | 235/55R19 | 5x120 cb=64.1 off=40..55 | trim-match "Elite" | `2024-honda-odyssey-elite-sport-touring`
- **EX / EX-L** â€” 18x7.5@48 | 235/60R18 | 5x120 cb=64.1 off=40..55 | trim-match "EX" | `2024-honda-odyssey-ex-ex-l`

### 2024 honda passport â€” TG "Honda Trucks Passport"
old: 6 rows (5x120) [Base; EX-L; Elite; Sport; Touring; TrailSport] â†’ quarantined 6, inserted 2; offset/CB carry: same-year
- **Black Edition / EX-L** â€” 20x8.5@45 | 265/45R20 | 5x120 cb=64.1 off=35..55 | trim-match "EX-L" | `2024-honda-passport-black-edition-ex-l`
- **TrailSport** â€” 18x8@45 | 245/60R18 | 5x120 cb=64.1 off=35..55 | trim-match "TrailSport" | `2024-honda-passport-trailsport`

### 2024 honda pilot â€” TG "Honda Trucks Pilot"
old: 8 rows (5x120) [EX; EX-L; Elite; LX; LX, EX, EX-L, Touring, Elite, TrailSport; Sport; Touring; TrailSport] â†’ quarantined 8, inserted 3; offset/CB carry: same-year
- **Elite / Sport / Touring** â€” 20x8@48 | 255/50R20 | 5x120 cb=64.1 off=40..55 | trim-match "Elite" | `2024-honda-pilot-elite-sport-touring`
- **EX-L / LX** â€” 18x8@48 | 255/60R18 | 5x120 cb=64.1 off=40..55 | trim-match "EX-L" | `2024-honda-pilot-ex-l-lx`
- **TrailSport** â€” 18x8@48 | 265/60R18 | 5x120 cb=64.1 off=40..55 | trim-match "TrailSport" | `2024-honda-pilot-trailsport`

### 2024 honda ridgeline â€” TG "Honda Trucks Ridgeline"
old: 6 rows (5x120) [Black Edition; RTL; RTL-E; Sport; Sport, RTL, RTL-E, Black Edition, TrailSport; TrailSport] â†’ quarantined 6, inserted 1; offset/CB carry: same-year
- **Black Edition / RTL / Sport / TrailSport** â€” 18x8@43 | 245/60R18 | 5x120 cb=64.1 off=35..50 | trim-match "Black Edition" | `2024-honda-ridgeline-black-edition-rtl-sport-trailsport`

### 2024 hyundai elantra â€” TG "Hyundai Elantra"
old: 5 rows (5x114.3) [Limited; N Line; SE; SE, SEL, N Line, Limited; SEL] â†’ quarantined 5, inserted 5; offset/CB carry: same-year
- **Blue Hybrid** â€” 16x6.5@50 | 205/55R16 | 5x114.3 cb=67.1 off=45..55 | same-year mode | `2024-hyundai-elantra-blue-hybrid`
- **Limited / Limited Hybrid** â€” 17x7@50 | 225/45R17 | 5x114.3 cb=67.1 off=45..55 | trim-match "Limited" | `2024-hyundai-elantra-limited-limited-hybrid`
- **N Line** â€” 18x8@50 | 235/40R18 | 5x114.3 cb=67.1 off=45..55 | trim-match "N Line" | `2024-hyundai-elantra-n-line`
- **SE** â€” 15x6@50 | 195/65R15 | 5x114.3 cb=67.1 off=45..55 | trim-match "SE" | `2024-hyundai-elantra-se`
- **SEL** â€” 16x6.5@50 17x7@50 | 205/55R16 225/45R17 | 5x114.3 cb=67.1 off=45..55 | trim-match "SEL" | `2024-hyundai-elantra-sel`

### 2024 hyundai kona â€” TG "Hyundai Trucks Kona"
old: 5 rows (5x114.3) [Limited; N Line; SE; SE, SEL, N Line, Limited; SEL] â†’ quarantined 5, inserted 3; offset/CB carry: same-year
- **Limited / N Line** â€” 19x7.5@46 | 235/45R19 | 5x114.3 cb=67.1 off=40..52 | trim-match "Limited" | `2024-hyundai-kona-limited-n-line`
- **SE** â€” 17x7@46 | 215/60R17 | 5x114.3 cb=67.1 off=40..52 | trim-match "SE" | `2024-hyundai-kona-se`
- **SEL** â€” 18x7@46 | 215/55R18 | 5x114.3 cb=67.1 off=40..52 | trim-match "SEL" | `2024-hyundai-kona-sel`

### 2024 hyundai palisade â€” TG "Hyundai Trucks Palisade"
old: 6 rows (5x114.3) [Calligraphy; Limited; SE; SE, SEL, XRT, Limited, Calligraphy; SEL; XRT] â†’ quarantined 6, inserted 3; offset/CB carry: same-year
- **Calligraphy / Calligraphy Night Edition / Limited / XRT** â€” 20x7.5@48 | 245/50R20 | 5x114.3 cb=67.1 off=40..55 | trim-match "Calligraphy" | `2024-hyundai-palisade-calligraphy-calligraphy-night-edition-limited-xrt`
- **SE** â€” 18x7.5@48 | 245/60R18 | 5x114.3 cb=67.1 off=40..55 | trim-match "SE" | `2024-hyundai-palisade-se`
- **SEL** â€” 18x7.5@48 20x7.5@48 | 245/60R18 245/50R20 | 5x114.3 cb=67.1 off=40..55 | trim-match "SEL" | `2024-hyundai-palisade-sel`

### 2024 hyundai santa-fe â€” TG "Hyundai Trucks Santa Fe"
old: 8 rows (5x114.3) [1.6 T-GDi HEV; Base; Calligraphy; Limited; SE; SE, SEL, XRT, Limited, Calligraphy; SEL; XRT] â†’ quarantined 8, inserted 4; offset/CB carry: same-year
- **Calligraphy** â€” 21x8.5@50 | 245/45R21 | 5x114.3 cb=67.1 off=45..55 | trim-match "Calligraphy" | bolt carried from our rows (5x114.3) - TG print had none | `2024-hyundai-santa-fe-calligraphy`
- **Hybrid Calligraphy / Hybrid Limited / Limited** â€” 20x8.5@50 | 255/45R20 | 5x114.3 cb=67.1 off=45..55 | trim-match "Limited" | bolt carried from our rows (5x114.3) - TG print had none | `2024-hyundai-santa-fe-hybrid-calligraphy-hybrid-limited-limited`
- **Hybrid SEL / SE / SEL** â€” 18x7.5@50 | 235/60R18 | 5x114.3 cb=67.1 off=45..55 | trim-match "SE" | bolt carried from our rows (5x114.3) - TG print had none | `2024-hyundai-santa-fe-hybrid-sel-se-sel`
- **XRT** â€” 18x7.5@50 | 245/60R18 | 5x114.3 cb=67.1 off=45..55 | trim-match "XRT" | bolt carried from our rows (5x114.3) - TG print had none | `2024-hyundai-santa-fe-xrt`

### 2024 hyundai sonata â€” TG "Hyundai Sonata"
old: 6 rows (5x114.3) [Limited; N Line; SE; SE, SEL, SEL Plus, Limited, N Line; SEL; SEL Plus] â†’ quarantined 6, inserted 3; offset/CB carry: same-year
- **Hybrid Limited / Hybrid SEL / SEL** â€” 17x7@50 | 215/55R17 | 5x114.3 cb=67.1 off=45..55 | trim-match "SEL" | `2024-hyundai-sonata-hybrid-limited-hybrid-sel-sel`
- **N Line** â€” 19x8@50 | 245/40R19 | 5x114.3 cb=67.1 off=45..55 | trim-match "N Line" | `2024-hyundai-sonata-n-line`
- **SEL w/Convenience Pkg.** â€” 18x7.5@50 | 235/45R18 | 5x114.3 cb=67.1 off=45..55 | trim-match "SEL" | `2024-hyundai-sonata-sel-w-convenience-pkg`

### 2024 hyundai tucson â€” TG "Hyundai Trucks Tucson"
old: 6 rows (5x114.3) [Limited; N Line; SE; SE, SEL, XRT, Limited, N Line; SEL; XRT] â†’ quarantined 6, inserted 2; offset/CB carry: same-year
- **Blue Hybrid / SE / SEL** â€” 17x7@50 | 235/65R17 | 5x114.3 cb=67.1 off=45..55 | trim-match "SE" | `2024-hyundai-tucson-blue-hybrid-se-sel`
- **Limited / Limited Hybrid / Limited Plug-In Hybrid / N Line Hybrid / SEL Convenience Hybrid / SEL Plug-In Hybrid / SEL w/Convenience Pkg. / XRT** â€” 19x7.5@50 | 235/55R19 | 5x114.3 cb=67.1 off=45..55 | trim-match "Limited" | `2024-hyundai-tucson-limited-limited-hybrid-limited-plug-in-hybrid-n-line-hybrid-sel-convenience-hybrid-sel-plug-in-hybrid-sel-w-convenience-pkg-xrt`

### 2024 infiniti qx50 â€” TG "Infiniti Trucks QX50"
old: 6 rows (5x114.3) [Autograph; Essential; Luxe; Pure; Pure, Luxe, Essential, Sensory, Autograph; Sensory] â†’ quarantined 6, inserted 2; offset/CB carry: same-year
- **Autograph / Sensory / Sport** â€” 20x8.5@45 | 255/45R20 | 5x114.3 cb=66.1 off=35..55 | trim-match "Autograph" | tire/rim salvaged from _unparsed | `2024-infiniti-qx50-autograph-sensory-sport`
- **Luxe / Pure** â€” 19x7.5@45 | 235/55R19 | 5x114.3 cb=66.1 off=35..55 | trim-match "Luxe" | tire/rim salvaged from _unparsed | `2024-infiniti-qx50-luxe-pure`

### 2024 infiniti qx55 â€” TG "Infiniti Trucks QX55"
old: 1 rows (5x114.3) [2.0 VC-Turbo] â†’ quarantined 1, inserted 1; offset/CB carry: same-year
- **Essential / Luxe / Sensory** â€” 20x8.5@44 | 255/45R20 | 5x114.3 cb=66.1 off=44..44 | trim-match "2.0 VC-Turbo" | tire/rim salvaged from _unparsed | `2024-infiniti-qx55-essential-luxe-sensory`

### 2024 infiniti qx60 â€” TG "Infiniti Trucks QX60"
old: 5 rows (5x114.3) [Autograph; Luxe; Pure; Pure, Luxe, Sensory, Autograph; Sensory] â†’ quarantined 5, inserted 2; offset/CB carry: same-year
- **Autograph / Luxe / Sensory** â€” 20x8@45 | 255/50R20 | 5x114.3 cb=66.1 off=35..55 | trim-match "Autograph" | `2024-infiniti-qx60-autograph-luxe-sensory`
- **Pure** â€” 18x8@45 | 255/60R18 | 5x114.3 cb=66.1 off=35..55 | trim-match "Pure" | `2024-infiniti-qx60-pure`

### 2024 infiniti qx80 â€” TG "Infiniti Trucks QX80"
old: 4 rows (6x139.7) [Luxe; Luxe, Premium Select, Sensory; Premium Select; Sensory] â†’ quarantined 4, inserted 2; offset/CB carry: same-year
- **Luxe** â€” 20x8@33 | 275/60R20 | 6x139.7 cb=78.1 off=20..45 | trim-match "Luxe" | `2024-infiniti-qx80-luxe`
- **Premium Select / Sensory** â€” 22x8@33 | 275/50R22 | 6x139.7 cb=78.1 off=20..45 | trim-match "Premium Select" | `2024-infiniti-qx80-premium-select-sensory`

### 2024 jeep compass â€” TG "Jeep Trucks Compass"
old: 7 rows (5x110) [High Altitude; Latitude; Latitude Lux; Limited; Sport; Sport, Latitude, Trailhawk, Limited, High Altitude; Trailhawk] â†’ quarantined 7, inserted 4; offset/CB carry: same-year
- **Latitude / Sport** â€” 17x7@44 | 225/60R17 | 5x110 cb=65.1 off=38..50 | trim-match "Latitude" | `2024-jeep-compass-latitude-sport`
- **Latitude Lux** â€” 18x7@44 | 225/55R18 | 5x110 cb=65.1 off=38..50 | trim-match "Latitude Lux" | `2024-jeep-compass-latitude-lux`
- **Limited** â€” 18x7@44 19x7.5@44 | 225/55R18 235/45R19 | 5x110 cb=65.1 off=38..50 | trim-match "Limited" | `2024-jeep-compass-limited`
- **Trailhawk** â€” 17x6.5@44 | 215/65R17 | 5x110 cb=65.1 off=38..50 | trim-match "Trailhawk" | `2024-jeep-compass-trailhawk`

### 2024 jeep gladiator â€” TG "Jeep Trucks Gladiator"
old: 12 rows (5x127) [3.6 Pentastar; Base; High Tide; Mojave; Mojave X; Nighthawk; Rubicon; Rubicon X; Sport; Sport S; Texas Trail; Willys] â†’ quarantined 12, inserted 4; offset/CB carry: same-year
- **High Tide / Texas Trail / Willys** â€” 17x7.5@45 | 255/75R17 | 5x127 cb=71.5 off=45..45 | trim-match "High Tide" | `2024-jeep-gladiator-high-tide-texas-trail-willys`
- **Mojave / Mojave X / Rubicon / Rubicon X** â€” 17x7.5@41 | 285/70R17 | 5x127 cb=71.6 off=37.17..44.45 | trim-match "Mojave" | `2024-jeep-gladiator-mojave-mojave-x-rubicon-rubicon-x`
- **Nighthawk** â€” 20x8@41 | 275/55R20 | 5x127 cb=71.6 off=37.17..44.45 | trim-match "Nighthawk" | `2024-jeep-gladiator-nighthawk`
- **Sport / Sport S** â€” 17x7.5@41 | 245/75R17 | 5x127 cb=71.6 off=37.17..44.45 | trim-match "Sport" | `2024-jeep-gladiator-sport-sport-s`

### 2024 jeep grand-cherokee â€” TG "Jeep Trucks Grand Cherokee"
old: 16 rows (5x127) [2.0 T4 PHEV; 4xe; Altitude; Altitude; Base; Laredo; Laredo; Limited; Limited; Overland; Overland; Summit; Summit; Summit Reserve; Summit Reserve; Trailhawk] â†’ quarantined 16, inserted 5; offset/CB carry: same-year
- **4xe / Altitude / Altitude X / Limited** â€” 18x8@16 20x8.5@16 | 265/60R18 265/50R20 | 5x127 cb=71.5 off=-25..56.4 | trim-match "4xe" | `2024-jeep-grand-cherokee-4xe-altitude-altitude-x-limited`
- **4xe w/Black Appearance Pkg. / Limited w/Black Appearance Pkg. / Overland / Overland 4xe / Summit / Summit 4xe** â€” 20x8.5@16 | 265/50R20 | 5x127 cb=71.5 off=-25..56.4 | trim-match "Overland" | `2024-jeep-grand-cherokee-4xe-w-black-appearance-pkg-limited-w-black-appearance-pkg-overland-overland-4xe-summit-summit-4xe`
- **Laredo / Laredo A** â€” 17x6.5@16 | 245/70R17 | 5x127 cb=71.5 off=-25..56.4 | trim-match "Laredo" | `2024-jeep-grand-cherokee-laredo-laredo-a`
- **Laredo X / Trailhawk 4xe** â€” 18x8@16 | 265/60R18 | 5x127 cb=71.5 off=-25..56.4 | trim-match "4xe" | `2024-jeep-grand-cherokee-laredo-x-trailhawk-4xe`
- **Summit Reserve / Summit Reserve 4xe** â€” 21x9@16 | 275/45R21 | 5x127 cb=71.5 off=-25..56.4 | trim-match "Summit Reserve" | `2024-jeep-grand-cherokee-summit-reserve-summit-reserve-4xe`

### 2024 jeep wrangler â€” TG "Jeep Trucks Wrangler"
old: 11 rows (5x127) [3.6 Pentastar; 4xe; Base; Rubicon; Rubicon 392; Rubicon X; Sahara; Sport; Sport S; Willys; Xtreme Tire Package] â†’ quarantined 11, inserted 7; offset/CB carry: same-year
- **Rubicon / Rubicon X / Unlimited Rubicon / Unlimited Rubicon 4xe / Unlimited Rubicon X 4xe / Unlimited Willys / Unlimited Willys 4xe / Willys** â€” 17x7.5@16 | 285/70R17 | 5x127 cb=71.5 off=-25..56.4 | trim-match "Rubicon" | `2024-jeep-wrangler-rubicon-rubicon-x-unlimited-rubicon-unlimited-rubicon-4xe-unlimited-rubicon-x-4xe-unlimited-willys-unlimited-willys-4xe-willys`
- **Sport I4 / Sport S I4 / Sport S V6 / Sport V6 / Unlimited Sport I4 / Unlimited Sport S I4 / Unlimited Sport S V6 / Unlimited Sport V6** â€” 17x7.5@16 | 245/75R17 | 5x127 cb=71.5 off=-25..56.4 | trim-match "Sport S" | `2024-jeep-wrangler-sport-i4-sport-s-i4-sport-s-v6-sport-v6-unlimited-sport-i4-unlimited-sport-s-i4-unlimited-sport-s-v6-unlimited-sport-v6`
- **Unlimited High Altitude 4xe** â€” 20x8@16 | 275/55R20 | 5x127 cb=71.5 off=-25..56.4 | trim-match "4xe" | `2024-jeep-wrangler-unlimited-high-altitude-4xe`
- **Unlimited Rubicon 392 / Unlimited Rubicon 392 Final Edition / Unlimited Rubicon w/Xtreme Recon Tire Pkg. / Unlimited Willys w/Xtreme Recon Tire Pkg.** â€” 17x8@16 | 315/70R17 | 5x127 cb=71.5 off=-25..56.4 | trim-match "Xtreme Tire Package" | `2024-jeep-wrangler-unlimited-rubicon-392-unlimited-rubicon-392-final-edition-unlimited-rubicon-w-xtreme-recon-tire-pkg-unlimited-willys-w-xtreme-recon-tire-pkg`
- **Unlimited Rubicon X** â€” 17x7.5@16 17x8@16 | 255/75R17 315/70R17 | 5x127 cb=71.5 off=-25..56.4 | trim-match "Rubicon X" | `2024-jeep-wrangler-unlimited-rubicon-x`
- **Unlimited Sahara** â€” 18x7.5@16 | 255/70R18 | 5x127 cb=71.5 off=-25..56.4 | trim-match "Sahara" | `2024-jeep-wrangler-unlimited-sahara`
- **Unlimited Sahara 4xe / Unlimited Sport S 4xe** â€” 20x8@16 | 255/60R20 | 5x127 cb=71.5 off=-25..56.4 | trim-match "Sport S" | `2024-jeep-wrangler-unlimited-sahara-4xe-unlimited-sport-s-4xe`

### 2024 kia forte â€” TG "Kia Forte"
old: 5 rows (5x114.3) [FE; FE, LXS, GT-Line, GT; GT; GT-Line; LXS] â†’ quarantined 5, inserted 4; offset/CB carry: same-year
- **FE / LX** â€” 15x6@50 | 195/65R15 | 5x114.3 cb=67.1 off=45..55 | trim-match "FE" | `2024-kia-forte-fe-lx`
- **GT / GT M/T** â€” 18x7.5@50 | 225/40R18 | 5x114.3 cb=67.1 off=45..55 | trim-match "GT" | `2024-kia-forte-gt-gt-m-t`
- **GT-Line** â€” 17x7@50 | 225/45R17 | 5x114.3 cb=67.1 off=45..55 | trim-match "GT-Line" | `2024-kia-forte-gt-line`
- **LXS** â€” 16x6.5@50 | 205/55R16 | 5x114.3 cb=67.1 off=45..55 | trim-match "LXS" | `2024-kia-forte-lxs`

### 2024 kia soul â€” TG "Kia Soul"
old: 6 rows (5x114.3) [EX; GT-Line; LX; LX, S, GT-Line, EX, Turbo; S; Turbo] â†’ quarantined 6, inserted 3; offset/CB carry: same-year
- **EX** â€” 17x7@46 | 215/55R17 | 5x114.3 cb=67.1 off=40..52 | trim-match "EX" | `2024-kia-soul-ex`
- **GT-Line** â€” 18x7.5@46 | 235/45R18 | 5x114.3 cb=67.1 off=40..52 | trim-match "GT-Line" | `2024-kia-soul-gt-line`
- **LX / S** â€” 16x6.5@46 | 205/60R16 | 5x114.3 cb=67.1 off=40..52 | trim-match "LX" | `2024-kia-soul-lx-s`

### 2024 nissan altima â€” TG "Nissan Altima"
old: 6 rows (5x114.3) [Platinum; S; S, SV, SL, SR, Platinum; SL; SR; SV] â†’ quarantined 6, inserted 3; offset/CB carry: same-year
- **S** â€” 16x7@48 | 215/60R16 | 5x114.3 cb=66.1 off=40..55 | trim-match "S" | `2024-nissan-altima-s`
- **SL / SR** â€” 19x8@48 | 235/40R19 | 5x114.3 cb=66.1 off=40..55 | trim-match "SL" | `2024-nissan-altima-sl-sr`
- **SV** â€” 17x7.5@48 | 215/55R17 | 5x114.3 cb=66.1 off=40..55 | trim-match "SV" | `2024-nissan-altima-sv`

### 2024 nissan rogue â€” TG "Nissan Trucks Rogue"
old: 5 rows (5x114.3) [Platinum; S; S, SV, SL, Platinum; SL; SV] â†’ quarantined 5, inserted 3; offset/CB carry: same-year
- **Platinum / SL** â€” 19x7.5@48 | 235/55R19 | 5x114.3 cb=66.1 off=40..55 | trim-match "Platinum" | `2024-nissan-rogue-platinum-sl`
- **S** â€” 17x7.5@48 | 235/65R17 | 5x114.3 cb=66.1 off=40..55 | trim-match "S" | `2024-nissan-rogue-s`
- **SV** â€” 18x7.5@48 | 235/60R18 | 5x114.3 cb=66.1 off=40..55 | trim-match "SV" | `2024-nissan-rogue-sv`

### 2024 nissan titan â€” TG "Nissan Trucks Titan"
old: 12 rows (6x139.7) [PRO-4X; Platinum Reserve; Platinum Reserve; Pro-4X; S; S; S, SV, SL, Platinum Reserve, PRO-4X; SL; SL; SV; SV; XD] â†’ quarantined 12, inserted 3; offset/CB carry: same-year
- **Platinum Reserve / SV Bronze Edition** â€” 20x8@27 | 275/60R20 | 6x139.7 cb=78.1 off=18..35 | trim-match "Platinum Reserve" | `2024-nissan-titan-platinum-reserve-sv-bronze-edition`
- **PRO-4X** â€” 18x8@27 | 275/70R18 | 6x139.7 cb=78.1 off=18..35 | trim-match "PRO-4X" | `2024-nissan-titan-pro-4x`
- **SV** â€” 18x8@28 20x8@28 | 265/70R18 275/60R20 | 6x139.7 cb=78.1 off=10..45 | trim-match "SV" | `2024-nissan-titan-sv`

### 2024 nissan titan-xd â€” TG "Nissan Trucks Titan XD"
old: 4 rows (6x139.7) [PRO-4X; Platinum Reserve; S; SV] â†’ quarantined 4, inserted 3; offset/CB carry: same-year
- **Platinum Reserve** â€” 20x7.5@32 | 265/60R20 | 6x139.7 cb=78.1 off=18..45 | trim-match "Platinum Reserve" | `2024-nissan-titan-xd-platinum-reserve`
- **PRO-4X** â€” 18x7.5@32 | 275/65R18 | 6x139.7 cb=78.1 off=18..45 | trim-match "PRO-4X" | `2024-nissan-titan-xd-pro-4x`
- **SV** â€” 17x7.5@32 20x7.5@32 | 245/75R17 265/60R20 | 6x139.7 cb=78.1 off=18..45 | trim-match "SV" | `2024-nissan-titan-xd-sv`

### 2025 audi a7 â€” TG "Audi A7 Sportback"
old: 1 rows (5x112) [Base] â†’ quarantined 1, inserted 2; offset/CB carry: same-year
- **Premium / Premium Plus / Prestige** â€” 20x8.5@45 | 255/40R20 | 5x112 cb=66.5 off=35..55 | trim-match "Base" | `2025-audi-a7-premium-premium-plus-prestige`
- **Prestige w/Black Optic Pkg.** â€” 20x8.5@45 21x8.5@45 | 255/40R20 255/35R21 | 5x112 cb=66.5 off=35..55 | same-year mode | `2025-audi-a7-prestige-w-black-optic-pkg`

### 2025 audi a8 â€” TG "Audi A8 Quattro"
old: 1 rows (5x112) [Base] â†’ quarantined 1, inserted 2; offset/CB carry: same-year
- **L** â€” 20x9@45 | 265/40R20 | 5x112 cb=66.6 off=35..55 | same-year mode | `2025-audi-a8-l`
- **L w/Black Optic Pkg.** â€” 21x9@45 | 265/35R21 | 5x112 cb=66.6 off=35..55 | same-year mode | `2025-audi-a8-l-w-black-optic-pkg`

### 2025 audi q6-e-tron â€” TG "Audi Trucks Q6 e-tron"
old: 1 rows (5x112) [Base] â†’ quarantined 1, inserted 2; offset/CB carry: same-year
- **Premium / Premium Plus / Prestige** â€” f:19x8@45 r:19x9@45 f:20x8.5@45 r:20x10@45 | 235/60R19 255/55R19 255/50R20 285/45R20 | 5x112 cb=57.1 off=35..55 | same-year mode | `2025-audi-q6-e-tron-premium-premium-plus-prestige`
- **Premium w/Ultra Pkg.** â€” f:18x8@45 r:18x9@45 | 235/65R18 255/60R18 | 5x112 cb=57.1 off=35..55 | same-year mode | `2025-audi-q6-e-tron-premium-w-ultra-pkg`

### 2025 audi sq6-e-tron â€” TG "Audi Trucks SQ6 e-tron"
old: 2 rows (5x112/5x130) [Base; Base] â†’ quarantined 2, inserted 3; offset/CB carry: same-year
- **Premium** â€” f:20x8.5@45 r:20x10@45 | 255/50R20 285/45R20 | 5x112 cb=71.6 off=35..55 | trim-match "Base" | `2025-audi-sq6-e-tron-premium`
- **Premium Plus / Premium Plus w/Black Optic Pkg. / Prestige** â€” f:20x8.5@34 r:20x10@34 f:21x9@34 r:21x10@34 | 255/50R20 285/45R20 255/45R21 285/40R21 | 5x112 cb=66.5 off=13..55 | trim-match "Base" | `2025-audi-sq6-e-tron-premium-plus-premium-plus-w-black-optic-pkg-prestige`
- **Prestige w/Black Optic Pkg. / Prestige w/Edition One** â€” f:21x9@34 r:21x10@34 | 255/45R21 285/40R21 | 5x112 cb=66.5 off=13..55 | trim-match "Base" | `2025-audi-sq6-e-tron-prestige-w-black-optic-pkg-prestige-w-edition-one`

### 2025 buick enclave â€” TG "Buick Trucks Enclave"
old: 5 rows (5x120/6x120) [Avenir; Essence; Preferred; Preferred, Essence, Avenir; Premium] â†’ quarantined 5, inserted 2; offset/CB carry: same-year
- **Avenir** â€” 22x8.5@45 | 275/45R22 | 6x120 cb=67.1 off=40..50 | trim-match "Avenir" | `2025-buick-enclave-avenir`
- **Preferred / Sport Touring** â€” 20x8@45 22x8.5@45 | 255/55R20 275/45R22 | 6x120 cb=67.1 off=40..50 | trim-match "Preferred" | `2025-buick-enclave-preferred-sport-touring`

### 2025 chevrolet silverado-2500hd â€” TG "Chevrolet Trucks Silverado 2500 HD"
old: 7 rows (8x180) [Base; Custom; High Country; LT; LTZ; WT; ZR2] â†’ quarantined 7, inserted 6; offset/CB carry: same-year
- **Custom / Custom (Inflation Option) / LT (Inflation Option) / LTZ (Inflation Option)** â€” 20x8.5@8 | 275/65R20 | 8x180 cb=124.1 off=-44..60 | trim-match "Custom" | `2025-chevrolet-silverado-2500hd-custom-custom-inflation-option-lt-inflation-option-ltz-inflation-option`
- **High Country** â€” 20x8.5@8 22x8.5@8 | 275/65R20 265/60R22 | 8x180 cb=124.1 off=-44..60 | trim-match "High Country" | `2025-chevrolet-silverado-2500hd-high-country`
- **LT** â€” 17x7.5@8 18x8@8 22x8.5@8 20x8.5@8 | 245/75R17 265/70R17 275/70R18 265/60R22 275/65R20 | 8x180 cb=124.1 off=-44..60 | trim-match "LT" | `2025-chevrolet-silverado-2500hd-lt`
- **LTZ** â€” 18x8@45 20x8.5@45 22x8.5@45 | 275/70R18 275/65R20 265/60R22 | 8x180 cb=124.1 off=35..55 | trim-match "LTZ" | `2025-chevrolet-silverado-2500hd-ltz`
- **WT** â€” 17x7.5@8 18x8@8 | 245/75R17 265/70R17 275/70R18 | 8x180 cb=124.1 off=-44..60 | trim-match "WT" | `2025-chevrolet-silverado-2500hd-wt`
- **ZR2 / ZR2 Diesel** â€” 18x9@45 | 305/70R18 | 8x180 cb=124.1 off=35..55 | trim-match "ZR2" | `2025-chevrolet-silverado-2500hd-zr2-zr2-diesel`

### 2025 chevrolet trax â€” TG "Chevrolet Trucks Trax"
old: 5 rows (5x115) [ACTIV; Base; LS; LT; RS] â†’ quarantined 5, inserted 4; offset/CB carry: same-year
- **1RS / ACTIV** â€” 18x7.5@45 | 225/55R18 | 5x115 cb=70.3 off=35..55 | trim-match "ACTIV" | `2025-chevrolet-trax-1rs-activ`
- **2RS** â€” 19x8@45 | 245/45R19 | 5x115 cb=70.3 off=35..55 | same-year mode | `2025-chevrolet-trax-2rs`
- **LS w/Aluminum Wheels / LT** â€” 17x7.5@45 | 225/60R17 | 5x115 cb=70.3 off=35..55 | trim-match "LT" | `2025-chevrolet-trax-ls-w-aluminum-wheels-lt`
- **LS w/Steel Wheels** â€” 17x7@45 | 225/60R17 | 5x115 cb=70.3 off=35..55 | trim-match "LS" | `2025-chevrolet-trax-ls-w-steel-wheels`

### 2025 jeep grand-wagoneer â€” TG "Jeep Trucks Grand Wagoneer"
old: 2 rows (6x139.7) [Base; Base] â†’ quarantined 2, inserted 1; offset/CB carry: same-year
- **Base / Obsidian / Series III / Series III Obsidian** â€” 22x9@45 | 285/45R22 | 6x139.7 cb=77.8 off=35..55 | trim-match "Base" | `2025-jeep-grand-wagoneer-base-obsidian-series-iii-series-iii-obsidian`

### 2025 land rover range-rover â€” TG "Land Rover Trucks Range Rover"
old: 6 rows (5x120) [Autobiography; HSE; SE; SE, HSE, Autobiography, SV Autobiography, SVAutobiography Dynamic; SV Autobiography; SVAutobiography Dynamic] â†’ quarantined 6, inserted 4; offset/CB carry: same-year
- **Autobiography / Autobiography PHEV w/7 Seats / SV** â€” 22x9.5@35 23x9.5@35 21x8.5@35 | 285/45R22 285/40R23 275/50R21 | 5x120 cb=72.6 off=12..58 | trim-match "Autobiography" | tire/rim salvaged from _unparsed | `2025-land-rover-range-rover-autobiography-autobiography-phev-w-7-seats-sv`
- **Autobiography PHEV** â€” 22x9.5@35 21x8.5@35 | 285/45R22 275/50R21 | 5x120 cb=72.6 off=12..58 | trim-match "Autobiography" | `2025-land-rover-range-rover-autobiography-phev`
- **SE** â€” 21x8.5@35 22x9.5@35 23x9.5@35 | 275/50R21 285/45R22 285/40R23 | 5x120 cb=72.6 off=12..58 | trim-match "SE" | tire/rim salvaged from _unparsed | `2025-land-rover-range-rover-se`
- **SE Plug-In Hybrid** â€” 21x8.5@35 22x9.5@35 | 275/50R21 285/45R22 | 5x120 cb=72.6 off=12..58 | trim-match "SE" | `2025-land-rover-range-rover-se-plug-in-hybrid`

### 2025 nissan rogue â€” TG "Nissan Trucks Rogue"
old: 6 rows (5x114.3) [Platinum; Rock Creek; S; S, SV, SL, Platinum; SL; SV] â†’ quarantined 6, inserted 3; offset/CB carry: same-year
- **Platinum / SL** â€” 19x7.5@48 | 235/55R19 | 5x114.3 cb=66.1 off=40..55 | trim-match "Platinum" | `2025-nissan-rogue-platinum-sl`
- **Rock Creek / S** â€” 17x7.5@48 | 235/65R17 | 5x114.3 cb=66.1 off=40..55 | trim-match "Rock Creek" | `2025-nissan-rogue-rock-creek-s`
- **SV** â€” 18x7.5@48 | 235/60R18 | 5x114.3 cb=66.1 off=40..55 | trim-match "SV" | `2025-nissan-rogue-sv`

### 2025 porsche cayenne â€” TG "Porsche Trucks Cayenne"
old: 7 rows (5x130) [Base; Base, S, E-Hybrid, GTS, Turbo, Turbo S; E-Hybrid; GTS; S; Turbo; Turbo S] â†’ quarantined 7, inserted 3; offset/CB carry: same-year
- **Base / Coupe / E-Hybrid Coupe / E-Hybrid / S Coupe / S E-Hybrid Coupe / S E-Hybrid / S** â€” f:20x9@37 r:20x10.5@37 f:21x9.5@37 r:21x11@37 f:22x10@37 r:22x11.5@37 | 255/55R20 295/45R20 285/45R21 315/40R21 285/40R22 315/35R22 | 5x130 cb=71.6 off=17..56 | trim-match "Base" | `2025-porsche-cayenne-base-coupe-e-hybrid-coupe-e-hybrid-s-coupe-s-e-hybrid-coupe-s-e-hybrid-s`
- **GTS Coupe / GTS / Turbo E-Hybrid Coupe / Turbo E-Hybrid** â€” f:21x9.5@37 r:21x11@37 f:22x10@37 r:22x11.5@37 | 285/45R21 315/40R21 285/40R22 315/35R22 | 5x130 cb=71.6 off=17..56 | trim-match "GTS" | `2025-porsche-cayenne-gts-coupe-gts-turbo-e-hybrid-coupe-turbo-e-hybrid`
- **Turbo GT Coupe** â€” f:22x10.5@37 r:22x11.5@37 | 285/40R22 315/35R22 | 5x130 cb=71.6 off=17..56 | trim-match "Turbo" | `2025-porsche-cayenne-turbo-gt-coupe`

### 2025 porsche macan â€” TG "Porsche Trucks Macan"
old: 5 rows (5x112) [Base; Base, S, GTS, Turbo; GTS; S; Turbo] â†’ quarantined 5, inserted 4; offset/CB carry: same-year
- **4 Electric / 4S Electric / Electric / Turbo Electric** â€” f:20x7.5@39 r:20x10@39 f:21x8.5@39 r:21x10.5@39 f:22x9@39 r:22x11@39 | 235/55R20 285/45R20 255/45R21 295/40R21 255/40R22 295/35R22 | 5x130 cb=66.5 off=23..55 | trim-match "Turbo" | `2025-porsche-macan-4-electric-4s-electric-electric-turbo-electric`
- **Base** â€” f:19x8.5@39 r:19x9@39 f:20x9@39 r:20x10@39 f:21x9.5@39 r:21x10@39 | 235/55R19 255/50R19 265/45R20 295/40R20 265/40R21 295/35R21 | 5x112 cb=66.5 off=23..55 | trim-match "Base" | `2025-porsche-macan-base`
- **GTS** â€” f:21x9.5@39 r:21x10@39 | 265/40R21 295/35R21 | 5x112 cb=66.5 off=23..55 | trim-match "GTS" | `2025-porsche-macan-gts`
- **S / T** â€” f:20x9@39 r:20x10@39 f:21x9.5@39 r:21x10@39 | 265/45R20 295/40R20 265/40R21 295/35R21 | 5x112 cb=66.5 off=23..55 | trim-match "S" | `2025-porsche-macan-s-t`

### 2025 ram 3500 â€” TG "RAM Trucks 3500"
old: 19 rows (8x165.1) [Base; Big Horn; Big Horn; Big Horn Dual Rear Wheel; Laramie; Laramie; Laramie Dual Rear Wheel; Laramie Longhorn; Limited; Limited; Limited Dual Rear Wheel; Limited Longhorn; Limited Longhorn Dual Rear Wheel; Longhorn; Power Wagon; Tradesman; Tradesman; Tradesman Dual Rear Wheel; Tradesman, Big Horn, Laramie, Limited, Longhorn] â†’ quarantined 19, inserted 3; offset/CB carry: same-year
- **Big Horn / Laramie / Tradesman** â€” 18x8@48 | 275/70R18 | 8x165.1 cb=121.3 off=35..60 | trim-match "Big Horn" | `2025-ram-3500-big-horn-laramie-tradesman`
- **Big Horn (DRW) / Big Horn (DRW) w/Night Edition / Laramie (DRW) / Laramie (DRW) w/Night Edition / Limited (DRW) / Limited Longhorn (DRW) / Tradesman (DRW) / Tradesman 4x4 (DRW)** â€” 17x6@48 | 235/80R17 | 8x200 cb=121.3 off=35..60 | trim-match "Tradesman, Big Horn, Laramie, Limited, Longhorn" | `2025-ram-3500-big-horn-drw-big-horn-drw-w-night-edition-laramie-drw-laramie-drw-w-night-edition-limited-drw-limited-longhorn-drw-tradesman-drw-tradesman-4x4-drw`
- **Big Horn w/Night Edition / Laramie w/Night/Sport Pkg. / Limited / Limited Longhorn** â€” 20x8@48 | 285/60R20 | 8x165.1 cb=121.3 off=35..60 | trim-match "Limited" | `2025-ram-3500-big-horn-w-night-edition-laramie-w-night-sport-pkg-limited-limited-longhorn`

### 2025 subaru wrx â€” TG "Subaru WRX"
old: 9 rows (5x114.3) [Base; Base, Premium, Limited, GT; GT; Limited; Premium; WRX; WRX GT; WRX Limited; WRX Premium] â†’ quarantined 9, inserted 2; offset/CB carry: same-year
- **GT / Limited / Premium** â€” 18x8.5@52 | 245/40R18 | 5x114.3 cb=56.1 off=48..55 | trim-match "GT" | `2025-subaru-wrx-gt-limited-premium`
- **tS** â€” 19x8.5@52 | 245/35R19 | 5x114.3 cb=56.1 off=48..55 | same-year mode | `2025-subaru-wrx-ts`

### 2026 audi a5 â€” TG "Audi A5 Quattro"
old: 1 rows (5x112) [Base] â†’ quarantined 1, inserted 2; offset/CB carry: same-year
- **Premium / Premium Plus / Prestige** â€” 18x8@45 19x8@45 | 235/45R18 245/40R19 | 5x112 cb=66.6 off=35..55 | trim-match "Base" | `2026-audi-a5-premium-premium-plus-prestige`
- **Premium Plus w/S Line Black Optic Pkg. / Premium w/S Line Black Optic Pkg. / Prestige w/S Line Black Optic Pkg.** â€” 19x8@45 | 245/40R19 | 5x112 cb=66.6 off=35..55 | trim-match "Base" | `2026-audi-a5-premium-plus-w-s-line-black-optic-pkg-premium-w-s-line-black-optic-pkg-prestige-w-s-line-black-optic-pkg`

### 2026 audi a8 â€” TG "Audi A8 Quattro"
old: 1 rows (5x112) [Base] â†’ quarantined 1, inserted 2; offset/CB carry: same-year
- **L** â€” 20x9@45 | 265/40R20 | 5x112 cb=57.1 off=35..55 | same-year mode | `2026-audi-a8-l`
- **L w/Black Optic Pkg.** â€” 21x9@45 | 265/35R21 | 5x112 cb=57.1 off=35..55 | same-year mode | `2026-audi-a8-l-w-black-optic-pkg`

## Verification (DB)
- live TG rows by audit-tg-reconcile: 339; quarantined by audit-tg-reconcile: 570
- PASS no live TG row with null offset / center bore / bolt / per-wheel offset
- PASS no duplicate live (year, make, model, modification_id)
- checked 93 reconciled Y/M/M: every live row is tireguide-pro and at least one exists (PASS)

## Live verification (storefront)
_(filled in after apply â€” see below)_

## Rollback
```sql
-- 1. pull the TG rows
update vehicle_fitments set quarantined_at = now(), last_modified_reason = last_modified_reason || ' [ROLLED BACK]'
 where last_modified_by = 'audit-tg-reconcile' and wheel_specs_source = 'tireguide-pro' and quarantined_at is null;
-- 2. restore the old rows (and their original modification_id where it was suffixed)
update vehicle_fitments set quarantined_at = null, modification_id = regexp_replace(modification_id, '\~q-tg-2026-09-16$', '')
 where last_modified_by = 'audit-tg-reconcile' and last_modified_reason like 'replaced by Tire Guide Pro%';
-- 3. any row suffixed that had been quarantined by an earlier pass (not stamped by us):
update vehicle_fitments set modification_id = regexp_replace(modification_id, '\~q-tg-2026-09-16$', '') where modification_id like '%~q-tg-2026-09-16';
```
Original field values of every quarantined row are preserved in `audit_original_data` (COALESCE â€” first snapshot wins).
