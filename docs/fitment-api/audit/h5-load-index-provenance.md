# H5 - Minimum Load Index: provenance write-up (DECISION NEEDED)

Audit: `website-fitment-audit-2026-09-18.md` § H5. Evidence gathered 2026-09-18 22:15 ET, read-only
(`scripts/audit/h5-load-index-provenance.cjs`, `node --env-file=.env.local`). No DB writes; touching
`oem_load_index` is a non-bolt field and needs Scott's approval per the 2026-09-17 standing approvals.

## Where the displayed value comes from

`serviceSpecs.oemLoadIndex` -> `vehicle_fitments.oem_load_index`, filled DB-wide on **2026-09-17** by
`scripts/audit/pass4/usaf-load-index/run.mjs` from US AutoForce `GetVehicleOptions`:

| `load_index_source` | rows | meaning |
|---|---|---|
| `usaf` | 26,414 | LI of the row's **first** OE tire size (`oem_tire_sizes[0]`) as reported by USAF |
| `usaf-max` | 1,448 | same size listed twice at USAF with different LIs -> higher one kept (Scott, 09-17) |
| `tireguide-pro` | 365 | from TG Pro PDF loop (kept where present; USAF agreed/disagreed counts in `out/reconcile.json`) |
| `tireguide-print` | 11 | hand-read from a TG print |
| NULL | 10,272 (157 with an LI) | no LI, or 157 legacy values with no provenance |

Total 38,510 rows; 28,395 have an LI (73.7%). Provenance is therefore **not unclear** - it is
recorded on every 09-17 row. The 157 unstamped legacy values are the only truly unknown ones.

## The actual problem: one LI per row, taken from size[0]

The backfill keys on the *first* OE size only. **13,946 of 28,149 live LI rows (49.5%) list OE sizes
spanning more than one rim diameter**, so for half the DB the stored LI describes one of several OE
tires. Two cases:

1. **Option sizes (same axle, different trims/packages)** - e.g. 2016 Fusion S `215/60R16, 225/50R17`
   LI 95. Usually close, occasionally 2-4 points apart. Low risk, but the value is still "one of the OE
   sizes", not "the minimum for this trim".
2. **Staggered (front ≠ rear)** - the value is *front-only*. Verified live:
   - 2020 Corvette Stingray (all 5 trims): stored **89** = front 245/35R19. OE rear 305/30R20 is **103**.
     A rear tire with LI 90 currently passes `loadIndexOk` and stays `packageEligible`. **This is the
     unsafe direction.**
   - 2022 M4 Competition: stored **100** = front 275/35R19; rear 285/30R20 is 99. Conservative by luck.
   - 2020 F-150 Raptor: 119 `usaf-max` across 4 listed sizes (option sizes, not staggered).

So the audit's guess ("may be the higher of two axle values") is wrong in the dangerous way: it's the
**first** value, which for staggered cars is the *front*, which is usually the *lower* one.

## What the runtime does today (after C2/F3 + Batch 1)

- `requiredLoadIndexSource` is **always** `vehicle_record_unverified`; `VERIFIED_LOAD_SOURCES`
  (`verified_manufacturer`) is never emitted. So no tire is ever badge-certified on load index - the
  gate fails closed. Good.
- But `loadIndexOk:false` / `packageExclusionReason:"load_index_below_required"` **is enforced** against
  that single number, and the PDP/Jake show it as "Minimum Tire Load Index". On staggered vehicles the
  rear axle is checked against the front number.

## Options (pick one)

**A. Per-size LI (recommended).** USAF already returns `LoadIndex` *per size* in the same
`GetVehicleOptions` payload the 09-17 run fetched (cached in `pass4/usaf-load-index/out`). Add
`oem_load_index_by_size jsonb` (`{"245/35R19":89,"305/30R20":103}`) - a Drizzle migration per the WTD
migration skill - and backfill from the cached responses (no new supplier calls for rows already
fetched; a small refetch for cache misses). Runtime: required LI = LI of the OE size matched for the
axle/diameter being searched; for a mixed-diameter search each axle gets its own requirement; fall
back to `max(by_size)` when no OE size matches. Keep `oem_load_index` = `max(by_size)` for display
(re-stamp `usaf-max`), so the single displayed number is at least never *under* an axle's requirement.
Rows affected by the re-stamp: <=13,946 -> **>100 rows, needs your OK**.

**B. Cheap conservative re-stamp only.** No schema change: set `oem_load_index = max LI over all listed
OE sizes` (from cached USAF data), `load_index_source='usaf-max'`. Fixes the Corvette under-spec risk;
overstates the requirement for front tires on staggered cars and for the smaller option size (a customer
may be told a legitimately OE-spec 89 is "below minimum 103"). Also >100 rows.

**C. Runtime-only.** When the OE list spans >1 rim diameter, stop enforcing `load_index_below_required`
(annotate `loadIndexChecked:false`, note "OE load index varies by size/axle") and relabel the display
"OE load index (primary size)". Zero DB writes, ~40 lines, but it *removes* protection on the 50% of
rows where it's most needed.

**D. Leave it.** Display stays; Corvette rears can pass at 89.

My call: **A**, with **C's relabel** shipped now as an interim so the page doesn't call a front-only
number a "minimum" (that part is copy + a flag, inside my lane). The 157 unstamped legacy LIs should
be nulled or re-sourced in the same pass.

## Not done here
- No writes. Script is read-only survey only.
- The `verified_manufacturer` path stays unreachable until a source you sign off on (TG Pro feed in
  writing, or manufacturer placards) is wired - USAF is a distributor catalog, not a manufacturer.

---

## Option A - PREPARED FOR REVIEW (2026-09-19, nothing applied)

| Piece | Where | State |
|---|---|---|
| Migration (additive) | `drizzle/migrations/0051_fitment_load_index_by_size.sql` (fix branch `77d20e48`) | not applied |
| Rollback | `drizzle/migrations/0051_rollback.sql` | - |
| Backfill, dry-run first | `scripts/audit/pass5/h5-load-index-by-size/dry-run.mjs` - reads ONLY the USAF payloads cached 2026-09-17 (main checkout, read-only); `--apply` refuses without `--approved-by scott` **and** 0051; never touches the scalar; snapshots to `audit_h5_load_index_by_size_original` | dry run done |
| Runtime read path | branch **`h5-option-a-runtime`** `f65f0e9a` (worktree `F:\clawd\wt-h5-runtime`) - schema, `serviceSpecs.oemLoadIndexBySize`, cache v8, `tires/search` scope `per_size` | tsc 0, **not** on the deploy branch |
| Interim (already on fix branch) | `09e18766` - scope `per_axle_unknown` fails closed | live on :3002 |

### Dry-run numbers (`out/summary.json`, `out/diff.csv` local)
- 32,740 live rows -> **28,268** would get a per-size map (27,774 complete, 494 partial - a size USAF lacks).
- 16,453 of those list more than one OE size. Stored scalar == first size on 28,134 (confirms the "first size" finding). Scalar **below** `max(by_size)` on **12,188**.
- Staggered (axle-tagged wheel sizes; no row stores a `{front, rear}` tire object): **576** rows; rear LI > stored scalar on **402** (C5 Corvette Z51 stored 89 / rear 94; C8 stored 89 / rear 103).
- Skipped: 2,911 no pass-2 name match, 1,558 no OE size matched at USAF, 3,478 sizes where USAF reports LI 0 (vintage VR). Those stay on the fail-closed path.
- 365 TG-Pro / 11 print rows: scalar kept as-is; per-size map added from USAF alongside (source tag distinguishes).

### Runtime rule on the `per_size` path
- Result with an exact OE size -> that size's own OE LI.
- OE-staggered vehicle, result on a rear-only rim diameter -> min over rear OE options; front-only -> front; ambiguous -> the higher axle.
- Otherwise -> min over OE options. `requiredLoadIndexSource` stays `vehicle_record_unverified` (USAF is a distributor catalog) -> still no load-index badge; `packageEligible` returns to true for tires that meet their own requirement.
- Rows without a complete map -> unchanged interim behaviour (`per_axle_unknown`, package-ineligible, no minimum shown).

### Exact procedure when you approve (no step runs without your go)
1. `node scripts/apply-fitment-migration.mjs drizzle/migrations/0051_fitment_load_index_by_size.sql` (or the repo's usual `scripts/apply-*.mjs` runner against `POSTGRES_URL`) - additive, safe with the current deploy.
2. `node --env-file=.env.local scripts/audit/pass5/h5-load-index-by-size/dry-run.mjs` - re-check `out/summary.json` matches the numbers above.
3. `node --env-file=.env.local scripts/audit/pass5/h5-load-index-by-size/dry-run.mjs --apply --approved-by scott` - 28,268 rows, one transaction, snapshot table first. Verify: `select count(*) from vehicle_fitments where oem_load_index_by_size is not null` = 28,268.
4. Merge `h5-option-a-runtime` (`f65f0e9a`) into the deploy branch; deploy. Cache key bumps to v8 automatically.
5. Optional, separate decision: re-stamp scalar `oem_load_index = max(by_size)`, source `usaf-max` (<=12,188 rows) so the single displayed number is never under an axle's requirement.
Rollback at any point: revert `f65f0e9a` first if deployed, then `0051_rollback.sql`.