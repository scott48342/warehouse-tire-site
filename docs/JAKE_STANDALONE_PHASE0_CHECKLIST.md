# Jake Standalone — Phase 0 Tracked Checklist
*Created: 2026-06-16. Scope: DOCUMENTATION / ANALYSIS ONLY. No code. No skeleton. No WTD changes.*

> **Purpose of Phase 0:** produce a precise, evidence-backed coupling map and extraction
> spec so Phase 1 (the empty `packages/jake-core` skeleton) can begin with zero ambiguity
> and zero risk to WTD production. Phase 0 writes **only Markdown docs** under `docs/`.

---

## 🔒 Hard Rules (apply to ALL Phase 0 tasks)
- ❌ No edits to the WTD production app.
- ❌ No edits to current Jake runtime (`src/lib/jake/*`, `src/app/api/jake/*`).
- ❌ No edits to live routes / pages / components.
- ❌ No provider implementations.
- ❌ No `packages/` or `apps/` directories created yet (that is Phase 1).
- ❌ No WTD migration work.
- ✅ Documentation/checklist/analysis only.
- ✅ Reading source code is allowed and encouraged (read-only).
- ✅ Running read-only inspection commands (grep, git status, build of EXISTING app for reference) is allowed.

---

## ✅ Allowed to touch (Phase 0 ONLY)
Create/edit ONLY these:
```
docs/JAKE_STANDALONE_PHASE0_CHECKLIST.md      (this file)
docs/JAKE_SAAS_ARCHITECTURE_REVIEW.md         (already exists — may reference)
docs/JAKE_STANDALONE_EXTRACTION_PLAN.md       (already exists — may reference)
docs/phase0/COUPLING_MAP.md                   (NEW — task output)
docs/phase0/EXTRACTION_INVENTORY.md           (NEW — task output)
docs/phase0/INTERFACE_DRAFT.md                (NEW — task output, types as text only)
docs/phase0/RISK_REGISTER.md                  (NEW — task output)
docs/phase0/PARITY_TEST_PLAN.md               (NEW — task output)
docs/phase0/BANNED_TOKENS.md                  (NEW — task output)
```
That's it. Everything else is read-only.

---

## ⛔ Forbidden to touch (Phase 0)
```
src/**                          (ALL application source — read-only)
src/lib/jake/**                 (current Jake runtime — read-only)
src/app/api/jake/**             (live Jake routes — read-only)
src/app/api/**                  (all live APIs — read-only)
src/components/**               (UI — read-only)
vercel.json                     (deploy config — DO NOT TOUCH)
.vercel/**                      (project link — DO NOT TOUCH)
package.json / package-lock     (no dependency changes in Phase 0)
.env* / any secrets             (DO NOT TOUCH)
Any file outside docs/          (forbidden to write)
packages/** , apps/**           (do not create yet — Phase 1)
```
**Also forbidden:** `git push` to `main`, any `vercel` deploy command, any DB write, any config patch, any gateway restart. Phase 0 produces local docs only.

---

## 📋 Phase 0 Tasks (tickets)

### P0-1 — Conversation engine inventory
- **Do:** Read `index.ts` and `stream.ts`. Document every responsibility, the duplication between them, model usage (`claude-sonnet-4-6` hardcoded), the tool-use loop shape, and what "core" must absorb.
- **Output:** section in `docs/phase0/EXTRACTION_INVENTORY.md`.
- **Touches:** read `src/lib/jake/index.ts`, `src/lib/jake/stream.ts`; write `docs/phase0/EXTRACTION_INVENTORY.md`.

### P0-2 — Tool registry & schema inventory
- **Do:** Enumerate all 8 tools in `tools.ts` (`JAKE_TOOLS`): name, schema, which provider it maps to, and the exact WTD URL each `executeTool` case calls.
- **Output:** table in `docs/phase0/COUPLING_MAP.md`.
- **Touches:** read `src/lib/jake/tools.ts`; write `docs/phase0/COUPLING_MAP.md`.

### P0-3 — Coupling map (the core deliverable)
- **Do:** For every concern (conversation, prompt, tools, fitment, inventory, pricing, checkout, leads, analytics, branding, mockup, model) record: where it lives, coupling level, the exact code reference (file:line), and target provider.
- **Output:** `docs/phase0/COUPLING_MAP.md` (master table).
- **Touches:** read `src/lib/jake/*`, `src/app/api/jake/*`; write `docs/phase0/COUPLING_MAP.md`.

### P0-4 — Prompt/persona split spec
- **Do:** Read `systemPrompt.ts`. Classify each section as **dealer-agnostic (→ core philosophy)** vs **WTD-specific (→ BrandingProvider config)**. List every WTD literal (phone numbers, store names, tone lines).
- **Output:** section in `docs/phase0/EXTRACTION_INVENTORY.md`.
- **Touches:** read `src/lib/jake/systemPrompt.ts`; write doc.

### P0-5 — Checkout/cart coupling spec
- **Do:** Trace `productUrl` construction (`tools.ts`) and `cartUrl` passthrough (`stream.ts`). Document every WTD storefront assumption that a `CheckoutProvider` must replace.
- **Output:** section in `docs/phase0/COUPLING_MAP.md`.
- **Touches:** read `src/lib/jake/tools.ts`, `src/lib/jake/stream.ts`; write doc.

### P0-6 — Pricing-location investigation
- **Do:** Document where pricing actually comes from (embedded in WTD API responses vs computed in Jake). Flag the "pricing is hidden in WTD APIs" unknown and what a standalone `PricingProvider` would need.
- **Output:** entry in `docs/phase0/RISK_REGISTER.md` + note in coupling map.
- **Touches:** read `src/lib/jake/tools.ts` (search/tire mapping); write docs. *(Do NOT open or modify the WTD pricing APIs — reference only.)*

### P0-7 — Interface draft (TEXT ONLY)
- **Do:** Refine the 8 provider interfaces from the extraction plan into a reviewed draft. **As Markdown code blocks only — NOT compiled `.ts` files.**
- **Output:** `docs/phase0/INTERFACE_DRAFT.md`.
- **Touches:** write `docs/phase0/INTERFACE_DRAFT.md` only.

### P0-8 — Banned-tokens list (for future lint gate)
- **Do:** Define the exact strings that must NEVER appear in `@jake/core` (e.g. `warehousetiredirect`, `warehousetire.net`, store phone numbers, `stripe`, supplier names, `shop.`). This becomes the Phase 1 lint/grep test spec.
- **Output:** `docs/phase0/BANNED_TOKENS.md`.
- **Touches:** write doc only.

### P0-9 — Risk register
- **Do:** Consolidate all risks/unknowns (pricing hidden, fitment licensing, checkout diversity, index/stream duplication drift, UI portability, mockup cost at scale) with likelihood/impact/mitigation.
- **Output:** `docs/phase0/RISK_REGISTER.md`.
- **Touches:** write doc only.

### P0-10 — Parity test plan
- **Do:** Define the fixed script of ~10 conversations that the standalone engine + WTD adapter must reproduce vs current live Jake (Phase 3 acceptance). Specify inputs and what "equivalent output" means.
- **Output:** `docs/phase0/PARITY_TEST_PLAN.md`.
- **Touches:** write doc only.

### P0-11 — Extraction order + workspace decision
- **Do:** Confirm dependency-safe extraction order and record the monorepo-vs-sibling-repo + pnpm/npm-workspace decision (decision only, no setup).
- **Output:** section in `docs/phase0/EXTRACTION_INVENTORY.md`.
- **Touches:** write doc only.

---

## ✔️ Definition of Done (Phase 0)
- [ ] All six `docs/phase0/*.md` files exist and are complete.
- [ ] Coupling map cites real `file:line` references for every concern.
- [ ] Every one of the 8 tools mapped to a provider + its current WTD URL.
- [ ] Prompt split spec lists every WTD literal to externalize.
- [ ] Interface draft reviewed and agreed (text only).
- [ ] Banned-tokens list finalized.
- [ ] Risk register + parity test plan complete.
- [ ] **Zero changes** outside `docs/` (verified by validation commands below).
- [ ] No `git push`, no deploy, no WTD edits occurred.

---

## 🧪 Validation Commands (read-only / verification)
Run from repo root `C:\Users\Scott-Pc\backup clawd\warehouse-tire-site`.

**1. Confirm only docs/ changed (the critical safety check):**
```powershell
git status --short
# EXPECT: only files under docs/ (specifically docs/JAKE_STANDALONE_PHASE0_CHECKLIST.md and docs/phase0/*)
# FAIL if ANY src/, app, route, config, package.json, vercel.json, or .env appears.
```

**2. Hard assert no source/config was modified:**
```powershell
git diff --name-only | Select-String -Pattern "^src/|^vercel.json|^package.json|^.vercel/|^.env" 
# EXPECT: no output. Any output = STOP, you touched forbidden files.
```

**3. Confirm no new packages/apps dirs were created:**
```powershell
Test-Path packages; Test-Path apps
# EXPECT: False ; False  (Phase 1 only)
```

**4. Confirm live Jake runtime untouched:**
```powershell
git diff --stat -- src/lib/jake src/app/api/jake
# EXPECT: no output (no changes).
```

**5. (Optional) Reference build of EXISTING app still green — proves we didn't break anything by reading:**
```powershell
npx tsc --noEmit
# EXPECT: clean. This builds the CURRENT app only; we changed nothing, so it must pass.
```

---

## 🛟 Rollback / No-Risk Explanation
- Phase 0 writes **only** Markdown under `docs/`. There is nothing to deploy and nothing in the runtime path.
- WTD production (`shop.warehousetiredirect.com`, `shop.warehousetire.net`, `/garage`, Jake, fitment, cart, suppliers) is **physically untouched** — no source, route, config, env, or dependency file is edited.
- **Rollback if needed:** `git checkout -- docs/` (or delete `docs/phase0/`). Because nothing was pushed or deployed, there is no production state to revert.
- No `git push`, no `vercel` deploy, no DB write, no gateway/config change happens in Phase 0.
- Worst case of a mistake = an unwanted Markdown file, removable with one `git` command.

---

## 🚦 Next-Step Gate (before Phase 1 skeleton)
Phase 1 (creating the empty `packages/jake-core` skeleton with types/interfaces only) may begin **ONLY when ALL of these are true:**
1. ✅ All Phase 0 docs complete and reviewed by Scott.
2. ✅ Interface draft (`INTERFACE_DRAFT.md`) explicitly approved.
3. ✅ Banned-tokens list approved.
4. ✅ Workspace decision (monorepo vs sibling repo) made and recorded.
5. ✅ Validation command #1 and #2 show **only docs/ changed**.
6. ✅ Scott gives explicit "proceed to Phase 1" approval.

Until all six are checked, **do not create `packages/` or `apps/`, and do not write any `.ts`.**

---

## Task tracking table
| ID | Task | Output file | Status |
|----|------|-------------|--------|
| P0-1 | Conversation engine inventory | EXTRACTION_INVENTORY.md | ☐ Not started |
| P0-2 | Tool registry & schema inventory | COUPLING_MAP.md | ☐ Not started |
| P0-3 | Coupling map (master) | COUPLING_MAP.md | ☐ Not started |
| P0-4 | Prompt/persona split spec | EXTRACTION_INVENTORY.md | ☐ Not started |
| P0-5 | Checkout/cart coupling spec | COUPLING_MAP.md | ☐ Not started |
| P0-6 | Pricing-location investigation | RISK_REGISTER.md | ☐ Not started |
| P0-7 | Interface draft (text only) | INTERFACE_DRAFT.md | ☐ Not started |
| P0-8 | Banned-tokens list | BANNED_TOKENS.md | ☐ Not started |
| P0-9 | Risk register | RISK_REGISTER.md | ☐ Not started |
| P0-10 | Parity test plan | PARITY_TEST_PLAN.md | ☐ Not started |
| P0-11 | Extraction order + workspace decision | EXTRACTION_INVENTORY.md | ☐ Not started |
