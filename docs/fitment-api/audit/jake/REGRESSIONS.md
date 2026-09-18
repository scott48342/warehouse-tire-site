# Jake regressions (from Codex browser review on :3002 preview, 2026-09-18)

Owner: Clawd (handoff from Codex 16:24 EDT; zero Codex writes). Each case becomes a regression test before deploy.

## J1 - DEPLOYMENT BLOCKER: fabricated bolt-pattern confirmation on HD truck
Conversation: "will 35s fit my Silverado" -> Jake asked year/trim/suspension (correct) ->
"2024 Chevrolet Silverado 2500 HD LTZ 4WD, stock suspension. I found 6x139.7 wheels. Do those fit? Verify bolt pattern."
Jake: "yes, 6x139.7 fits ... perfectly", "correct bolt pattern straight from fitment data", "confirmed match", then offered six-lug wheels.
Truth: 2011+ GM 2500HD/3500HD SRW = 8x180 (DRW 8x210). 6x139.7 is the 1500 pattern. Wrong lug COUNT sold as verified.
Also: blanket lift table "2in level 35 fits well; 4in+ 35-37 no issues" - unsupported.
Required: platform match must be exact model+class (2500 HD != 1500); a user-supplied pattern is compared against DB, never echoed; any mismatch = refuse + explain; no lift/tire-size table without a fitment source.

## J2 - Raptor prompt: unverified data asserted as VERIFIED
Prompt: stock 2020 Raptor, min load index, 245/70R17 + 110T.
Jake called FOUR sizes "VERIFIED exact Raptor data", later admitted generic. Called 315/70R17 "37-inch-equivalent" (nominal ~34.4").
Invented a Ford Load Range E requirement while saying minimum LI unverified. Said T (118 mph) is lower than S (112 mph).
Required: `verified` only from a verified source flag on the tool result; diameter math from parsed size; no GVWR/4 shortcut; speed-rating ordering from a table; contradictions = refuse.

## J3 - Mach-E: cautious answer but New-Chat suggestion chips are muscle-car/staggered/deep-dish
Required: suggestion chips keyed to vehicle class (EV crossover != muscle car).

## Website (lifted flow, same review) - tracked in fix-batch1-progress.md
- /tires lifted: "Fitment Guarantee - Everything shown will fit" + "Fits 2020 Ford F-150" on every card while also "Fitment Unverified". Gate ALL assurance surfaces.
- Tire links/PDP drop vehicle + lift context.

## J4 - M4 Competition xDrive 2024: disputed DB bolt pattern asserted as "confirmed"
Prompt: stock 2024 BMW M4 Competition xDrive; verify OEM axles/bolt; user questioned the site's 5x120.
Jake: "both data sources agree", "5x120 confirmed genuinely correct for G82 M4", explicitly denied 5x112.
G8x M3/M4 = 5x112 (F8x was 5x120). The DB row is disputed/uncertified; Jake echoed it as verified with an invented second source.
Preserved 19F/20R + 275/35R19 / 285/30R20 but no widths/offsets. No cart created.
Required: Jake reads certification state (certifiable/fitBadgeAllowed/source) and says "unverified/disputed" when the row is; never invents corroborating sources; quarantine + certification gates apply to Jake tools identically to the site.
