# Pass 3 — Bolt pattern / center bore / stud cross-check (roadkill cross-reference)

_Internal cross-check source. Never cite publicly. Read-only comparison; no DB writes._

- Roadkill rows: 2322 (cars/trucks with year ranges: 1816); unmatched to our DB: 883 (make-not-in-db 315, model-not-matched 568)
- Our rows compared: 14327 of 33753 (Y/M/M coverage 4079 / 10545 = 38.7%)
- Rows matched only via an OPEN-ENDED roadkill range (e.g. "1993 >") more than 8 years past its start: 7803 → their bolt/bore is a different generation; excluded from actionable disagreements (4292 such disagreements dropped)
- **Actionable (tight-range) bolt/bore disagreements: 1660 rows** → pass3/roadkill-disagree.csv

## Bolt pattern (tight-range rows only: 6524)
- agree: 5860
- disagree: 664

## Center bore (tight-range rows only)
- agree: 5072
- disagree: 1348
- rk-missing: 104

## Stud / thread (tight-range rows only)
- disagree: 1440
- agree: 4866
- rk-missing: 67
- ours-missing: 151

## Bolt agreement by our source family
| source | agree | disagree | ours-missing |
|---|---|---|---|
| manual_seed_spec | 45 | 70 | 0 |
| catalog-gap-fill | 75 | 45 | 0 |
| batch6-minivans-evs | 1 | 1 | 0 |
| batch2v2-trim-groups | 40 | 14 | 0 |
| generation_template | 336 | 79 | 0 |
| api_import | 376 | 56 | 0 |
| google-ai-overview | 328 | 45 | 0 |
| trim-research | 852 | 111 | 0 |
| cache-import | 1850 | 161 | 0 |
| generation_inherit | 302 | 20 | 0 |
| 90s-research-batch | 769 | 43 | 0 |
| generation-baseline | 210 | 11 | 0 |
| audit-2026-09-pass3-research | 47 | 2 | 0 |
| verified-research | 248 | 6 | 0 |
| cleanup_corvette_c5 | 12 | 0 | 0 |
| fix_cross_gen | 8 | 0 | 0 |
| batch4-suvs-sedans | 13 | 0 | 0 |
| wheelsize | 20 | 0 | 0 |
| luxury-gap-fill | 3 | 0 | 0 |
| tiresize.com | 11 | 0 | 0 |
| batch3-sports-cars | 6 | 0 | 0 |
| manual-research | 140 | 0 | 0 |
| final-gap-fill | 35 | 0 | 0 |
| backfill-gc | 6 | 0 | 0 |
| railway_import | 7 | 0 | 0 |
| inherited_from_2007_SAME_GENERATION | 6 | 0 | 0 |
| cleanup_cache-import | 5 | 0 | 0 |
| tier-a-import | 15 | 0 | 0 |
| manual-import | 1 | 0 | 0 |
| platform_inheritance_ld | 3 | 0 | 0 |
| manual_research | 3 | 0 | 0 |
| batch7-subcompacts-final | 6 | 0 | 0 |
| intrepid-gap-fill-2026-08-31 | 16 | 0 | 0 |
| alias-from-mazda3 | 18 | 0 | 0 |
| generation_inherit_2015 | 36 | 0 | 0 |
| batch5-sports-more | 6 | 0 | 0 |
| tire-guide-manual | 1 | 0 | 0 |
| tire-guide-pro | 4 | 0 | 0 |

## Top 30 models with bolt/bore disagreements
| make model | rows |
|---|---|
| lincoln town-car | 89 |
| ford explorer | 88 |
| jaguar xj | 87 |
| ford ranger | 76 |
| cadillac cts | 54 |
| lexus gx | 54 |
| toyota prius | 50 |
| cadillac escalade | 48 |
| bmw 5-series | 46 |
| volvo xc90 | 45 |
| ford mustang | 39 |
| honda pilot | 36 |
| nissan pathfinder | 36 |
| ford f-450-super-duty | 34 |
| nissan xterra | 30 |
| ford escape | 29 |
| scion tc | 27 |
| subaru impreza | 25 |
| acura tl | 25 |
| audi a4 | 24 |
| honda civic | 24 |
| audi a6 | 23 |
| honda odyssey | 20 |
| nissan armada | 20 |
| toyota corolla | 20 |
| toyota sequoia | 19 |
| acura mdx | 18 |
| ford explorer-sport-trac | 18 |
| lincoln aviator | 15 |
| bmw m5 | 14 |

## Disagreement samples
- 2000 daewoo leganza [Base] bolt ours=5x114.3 rk=4x100|5x114.3 (agree); bore ours=67.1 rk=56.1 (disagree) — DAEWOO LEGANZA, PRINCE 1997 >
- 2001 daewoo leganza [Base] bolt ours=5x114.3 rk=4x100|5x114.3 (agree); bore ours=67.1 rk=56.1 (disagree) — DAEWOO LEGANZA, PRINCE 1997 >
- 2002 daewoo leganza [Base] bolt ours=5x114.3 rk=4x100|5x114.3 (agree); bore ours=67.1 rk=56.1 (disagree) — DAEWOO LEGANZA, PRINCE 1997 >
- 1999 daewoo nubira [Base] bolt ours=4x114.3 rk=4x100 (disagree); bore ours=56.6 rk=56.1 (disagree) — DAEWOO LANOS, NUBIRA 1997 >
- 1991 chevrolet caprice [Base] bolt ours=5x127 rk=5x127 (agree); bore ours=78.3 rk=78.1 (disagree) — CHEVROLET CAPRICE CLASSIC 1991-97
- 1992 chevrolet caprice [Base] bolt ours=5x127 rk=5x127 (agree); bore ours=78.3 rk=78.1 (disagree) — CHEVROLET CAPRICE CLASSIC 1991-97
- 1993 chevrolet caprice [Base] bolt ours=5x127 rk=5x127 (agree); bore ours=78.3 rk=78.1 (disagree) — CHEVROLET CAPRICE CLASSIC 1991-97
- 1994 chevrolet caprice [Base] bolt ours=5x127 rk=5x127 (agree); bore ours=78.3 rk=78.1 (disagree) — CHEVROLET CAPRICE CLASSIC 1991-97
- 1996 chevrolet caprice [Base] bolt ours=5x127 rk=5x127 (agree); bore ours=78.3 rk=78.1 (disagree) — CHEVROLET CAPRICE CLASSIC 1991-97
- 2003 audi s8 [Base] bolt ours=5x112 rk=5x112 (agree); bore ours=66.5 rk=57.1 (disagree) — AUDI S8 (LARGER CALIPERS) 2001 > ; AUDI S8 (LARGER CALIPERS) 2001-07
- 2006 hummer h3 [Base] bolt ours=6x139.7 rk=6x139.7 (agree); bore ours=108 rk=100 (disagree) — HUMMER H3, H3X, H3 ALPHA, BASE, LUXURY 2006-08
- 2007 hummer h3 [Base] bolt ours=6x139.7 rk=6x139.7 (agree); bore ours=108 rk=100 (disagree) — HUMMER H3, H3X, H3 ALPHA, BASE, LUXURY 2006-08
- 2006 cadillac escalade [Base] bolt ours=6x139.7 rk=6x139.7 (agree); bore ours=78.1 rk=78.3 (disagree) — CADILLAC ESCALADE, EXT & ESV 1998 >
- 2009 acura mdx [Advance] bolt ours=5x120 rk=5x114.3 (disagree); bore ours=64.1 rk=64.1 (agree) — ACURA MDX 2001 >
- 2007 bmw m5 [M5] bolt ours=5x120 rk=5x120 (agree); bore ours=72.6 rk=74.1 (disagree) — BMW M5 2001 > ; BMW M5 (E60) 2001-07
- 2008 bmw m5 [M5] bolt ours=5x120 rk=5x120 (agree); bore ours=72.6 rk=74.1 (disagree) — BMW M5 2001 >
- 2009 bmw m5 [Base] bolt ours=5x120 rk=5x120 (agree); bore ours=72.6 rk=74.1 (disagree) — BMW M5 2001 >
- 2007 audi a6 [45 TFSI] bolt ours=5x112 rk=5x112 (agree); bore ours=66.5 rk=57.1 (disagree) — AUDI A6 2.7T, 4.2 (LARGER CALIPERS) 1995-08 ; AUDI A6, 6.8, 3.0, 3.2 1995-08
- 2009 ford e-350-econoline [Base] bolt ours=8x165.1 rk=8x170 (disagree); bore ours=124.1 rk= (rk-missing) — Ford E350/450 (4 Vent Hole) 2008 >
- 1994 ford mustang [Cobra R] bolt ours=4x108 rk=5x114.3 (disagree); bore ours=63.4 rk=70.3 (disagree) — FORD MUSTANG / GT 1994 > ; FORD MUSTANG / GT 1994-08
- 1999 ford mustang [Cobra] bolt ours=4x108 rk=5x114.3 (disagree); bore ours=63.4 rk=70.3 (disagree) — FORD MUSTANG / GT 1994 > ; FORD MUSTANG / GT 1994-08 ; FORD MUSTANG GT (OPT.), COBRA 1997 > ; FORD MUSTANG GT (OPT.), COBRA 1997-08
- 2008 ford mustang [GT] bolt ours=5x114.3 rk=5x114.3 (agree); bore ours=70.5 rk=70.3 (disagree) — FORD MUSTANG / GT 1994-08 ; FORD MUSTANG GT (OPT.), COBRA 1997-08
- 2004 cadillac cts [Base] bolt ours=5x120 rk=5x115|6x115 (disagree); bore ours=67.1 rk=70.3|78.3 (disagree) — CADILLAC CTS 2003 > ; CADILLAC CTS 2003-07 ; CADILLAC CTS TYPE-V 2004 > ; CADILLAC CTS TYPE-V 2004-07
- 2003 cadillac escalade [Luxury] bolt ours=6x139.7 rk=6x139.7 (agree); bore ours=78.1 rk=78.3 (disagree) — CADILLAC ESCALADE, EXT & ESV 1998 >
- 2005 cadillac escalade [Base] bolt ours=6x139.7 rk=6x139.7 (agree); bore ours=78.1 rk=78.3 (disagree) — CADILLAC ESCALADE, EXT & ESV 1998 >

Files: pass3/roadkill-disagree.csv, roadkill-fill-candidates.csv, roadkill-agree.csv, roadkill-unmatched-rk.csv
