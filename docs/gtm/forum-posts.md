# Fitment API — Forum & Community Posts (Ready to Paste)

**Voice:** Scott, owner of Warehouse Tire (Pontiac + Waterford, MI, since 1998). Shop owner first, self-taught builder second. Story first, link last. Never salesy.

**Landing page (every post points here):** https://shop.warehousetiredirect.com/fitment-api

**Reminder:** Every signup / sandbox request on that page fires an **email + SMS alert to Scott**. Expect pings within an hour of posting. Reply to comments fast in the first 2–3 hours — that's when Reddit decides whether a post lives or dies.

---

## Table of Contents

1. r/tires
2. r/wheels
3. r/shopify
4. r/webdev / r/SideProject
5. Tire Business / Modern Tire Dealer community
6. SEMA member forums / SEMA Garage
7. LinkedIn (Scott's personal)
8. Comment reply cheat sheet
9. Posting schedule
10. Rules for every post

---

## 1. r/tires

**Title:** I audited 12,000 vehicle fitment records for my tire shop. Here's the bad data I found.

**Body:**

I've owned a tire shop in Michigan since 1998. A couple years ago I built an online store for it, which meant I needed a vehicle fitment database — what bolt pattern, what OEM wheel and tire sizes, by year/make/model/trim.

The commercial options were priced for companies a lot bigger than two stores. Scraping the big retailers is a legal problem I didn't want. So I built my own from OEM specs and a lot of manual checking.

Then I ran a verification sweep across 12,006 records to see how bad my own data was. Some of what turned up:

- **Chevy Astro and S10** had full-size truck bolt patterns (6x139.7) mixed in. Astro is 5x127. S10 is 5x120.65. That's the kind of mistake that sends a customer home with wheels that don't bolt on.
- **GR Corolla** was carrying economy Corolla tire sizes. Very different car.
- **Prius** generations had bled into each other.
- **Phantom years** — Beetle 2020+, Yaris 2021+ — vehicles that don't exist in the US, sitting in the database like they do.
- Trim-level splits were flattened. Highlander XLE runs an 18", Limited runs a 20". Mustang EcoBoost and GT don't share wheels. If your data says "Highlander = 18" you're wrong for half the trims.

The big lesson: **model-level data applied to every trim is wrong more often than people think.** That's where most of the bad fitment I see online comes from.

Current state: 37,800 records, 81 makes, 1950–2026, trim-level, with staggered detection. It runs my store every day, so when it's wrong I hear about it from a real customer.

Happy to answer questions about the process or specific vehicles. I'm sure there are still errors in there — that's the nature of this stuff.

*(If anyone runs a shop site and wants to use it, I opened it up as an API. Link in comments so this doesn't read like an ad.)*

**Posting notes:**
r/tires has an active mod team and a no-promo posture. Post with **no link in the body** — drop the landing page in a comment only if someone asks or after the post has traction. Flair as **Discussion** (or whatever non-question flair exists). Best time: weekday morning 8–10 AM ET. Don't argue with the "just use wheel-size" replies — agree it's a good product and move on.

---

## 2. r/wheels

**Title:** Bolt pattern and staggered gotchas I keep hitting building a fitment database (HD trucks especially)

**Body:**

Tire shop owner here, 28 years in. I built my own fitment database for my store because the commercial ones cost more than made sense for two locations, and scraping retailer sites is a lawsuit I don't need.

Along the way I've collected a list of the fitment traps that catch people. Posting in case it helps somebody.

**GM HD trucks, 2011+:** Single rear wheel is 8x180. Dual rear wheel is **8x210**. Same truck, same year, different bolt pattern depending on SRW/DRW. Ford (8x170) and Ram (8x165.1) don't split like that — on those you filter DRW by offset instead. Lot of "fits Silverado 2500HD" listings out there that only fit half of them.

**Pre-2011 GM HD** was 8x165.1 across the board. So a 2010 and a 2011 Silverado 2500 look identical on the lot and share nothing.

**Staggered setups** get flattened constantly. Mustang GT Performance Pack, Camaro SS 1LE, Challenger Demon — different front and rear. If a database gives one size per vehicle, it's guessing.

**Trim matters more than model.** Highlander XLE is 18", Limited is 20". Mustang EcoBoost vs GT. A "model-level" spec is wrong for a chunk of the trims every time.

**Compact trucks contaminated by full-size:** I found Astro and S10 records in my own data carrying 6x139.7. Astro is 5x127. S10 is 5x120.65. Nobody caught it until I ran a full audit.

**Phantom years:** Beetle 2020+, Yaris 2021+ — not sold in the US, but they show up in datasets because someone extended a range.

I'm at 37,800 records / 81 makes / 1950–2026 now, trim-level with staggered flags. It runs my store live so I get corrected by customers, which is humbling and effective.

What other traps should I be checking for? Genuinely asking.

**Posting notes:**
r/wheels is smaller and more enthusiast-driven — technical content does well, promo does not. Same rule: **no link in body**, offer it in a comment if asked. No flair needed usually. Post a day or two after r/tires, not the same day (crosspost fatigue is real and mods notice). Engage with anyone who corrects you — a correction thread is good content.

---

## 3. r/shopify

**Title:** Two-store tire shop owner. Built my own fitment API instead of paying enterprise pricing. Would like other merchants' feedback.

**Body:**

I run a tire shop with two locations in Michigan. Been doing it since 1998. A few years ago I taught myself to build software (with a lot of AI help, I'm not going to pretend otherwise) and put my store online.

Problem: if you sell wheels or tires online, you need vehicle fitment data. Year, make, model, trim → bolt pattern, center bore, OEM sizes. The main API for this is good but priced for enterprises. I'm two stores. The other option people use is scraping the big retailers, which is a legal risk I wasn't willing to take.

So I built my own from OEM specs and manual research. Took a long time. I audited 12,000 records and found plenty of my own mistakes — compact trucks with full-size bolt patterns, trims all flattened to one size, model years that don't exist in the US. Fixed what I found. It's at 37,800 records, 81 makes, 1950–2026 now, and it runs my live store every day.

Recently I opened it up as a REST API for other shops. Plain JSON, API key in a header, five endpoints (years → makes → models → trims → specs). There's a free sandbox key to kick the tires.

What I'd like from this sub:

- If you sell automotive stuff, how are you handling fitment right now?
- Is a per-month tier with a call cap ($99 / $249 / $499) the right shape, or do merchants prefer something else?
- What would make you *not* trust a small shop's data over a big vendor's?

Not trying to sell anybody here — I want to know if I built something other merchants actually want or just something I needed.

**Posting notes:**
r/shopify **bans self-promo hard** — the ask-for-feedback framing is what keeps this alive. **No link in the body.** If someone asks where to find it, reply with the landing page in a comment. Flair: **Feedback** or **Discussion** (not "App" — that flair invites removal). Post midweek, mid-morning ET. Answer the "why not just use an app from the app store" question honestly: there isn't a good independent one at small-shop pricing.

---

## 4. r/webdev / r/SideProject

**Title:** Built a vehicle fitment REST API for my tire shop (37,800 records, trim-level). Looking for API design feedback.

**Body:**

Background: I own a tire shop in Michigan. Not a developer by trade — I taught myself over the last few years, AI did a lot of the heavy lifting. My store needed vehicle fitment data (year/make/model/trim → bolt pattern, center bore, OEM wheel + tire sizes) and the commercial options were enterprise-priced. Scraping retailers is a legal problem. So I built the dataset from OEM specs and manual validation.

**Data:** 37,800 fitment records, 81 makes, model years 1950–2026. Trim-level (Highlander XLE ≠ Limited), staggered detection, HD truck SRW/DRW bolt pattern splits. I ran a 12,006-record verification sweep and caught a bunch of my own bad data — contaminated bolt patterns, flattened trims, phantom model years. Cleaned it up. It powers my live store, so real orders depend on it daily.

**API:** REST, JSON, `X-API-Key` header. Cascading lookups:

```
GET /api/public/fitment/years
GET /api/public/fitment/makes?year=
GET /api/public/fitment/models?year=&make=
GET /api/public/fitment/trims?year=&make=&model=
GET /api/public/fitment/specs?year=&make=&model=&trim=
```

Free sandbox key for testing. Paid tiers are call-capped monthly.

**What I'd like feedback on:**

- Is the cascading years → makes → models → trims → specs pattern the right call, or would you want a single fuzzy `lookup?q=2024 highlander xle` endpoint too?
- Rate limiting / error format conventions — anything you'd expect that I'm probably missing?
- Versioning: I haven't put `/v1/` in the path yet. Mistake?
- How would you handle "no data for that trim" — 404, or 200 with an explicit `null` and a confidence flag?

Docs and sandbox signup: https://shop.warehousetiredirect.com/fitment-api

Be blunt. I'd rather hear it here than from a paying customer.

**Posting notes:**
r/SideProject is friendlier to links than r/webdev — post there first with the link in body. For r/webdev, use **Showoff Saturday** (link allowed on that day only) or the feedback flair; otherwise expect removal. Don't post to both the same week. The specific design questions are the hook — devs love answering "should I add /v1/". Take the answers seriously and say so in the thread.

---

## 5. Tire Business / Modern Tire Dealer community

**Title:** Dealer to dealer: I built my own vehicle fitment lookup after the commercial pricing didn't fit a two-store shop

**Body:**

Scott here, Warehouse Tire, Pontiac and Waterford, Michigan. Two stores, in business since 1998.

Like a lot of you, I put my shop online and hit the fitment wall right away. Customers want to type in their year/make/model and see what fits. The data behind that — bolt pattern, center bore, OEM wheel and tire sizes by trim — comes from a handful of vendors, and the pricing is built for national chains. Not for two stores in Oakland County.

The shortcut everyone whispers about is pulling data off the big retailers' sites. I wasn't going to do that. Too much legal exposure for a small business.

So I built my own. OEM specs, manual research, a lot of validation. I audited 12,000 records and found the exact mistakes that get us in trouble at the counter: compact trucks tagged with full-size bolt patterns, trims flattened to one wheel size (Highlander XLE is 18", Limited is 20"), GM HD trucks not split by SRW/DRW (8x180 vs 8x210 on 2011+). Fixed all that.

It's at 37,800 records, 81 makes, 1950–2026 now. It runs my store live. Real customers, real orders, every day.

I've opened it up as a lookup service for other dealers. If you've got a website — or your web guy does — it plugs in with a simple API key. There's a free test key so you can check your own problem vehicles before you spend a dollar. Paid plans start at $99/month.

I'm not a software company. I'm a tire dealer who got tired of the options. If you've been wanting fitment lookup on your site and the quotes scared you off, take a look: shop.warehousetiredirect.com/fitment-api

Happy to talk shop with anyone about it — the data side or the website side.

**Posting notes:**
Industry forums are the one place a direct link in the body is fine — this is a trade audience and you're a peer. Post in the **Technology / E-commerce / Dealer Tools** section if there is one, otherwise General. Also worth sending to the MTD or Tire Business editor as a possible story pitch ("dealer builds own fitment database") — trade pubs love this angle. Don't bash the incumbents by name beyond what's here.

---

## 6. SEMA member forums / SEMA Garage

**Title:** Independent fitment data for aftermarket shops — built by a dealer, not licensed from a retailer

**Body:**

Quick intro: Scott, Warehouse Tire, two stores in Michigan since 1998. Also a SEMA member who got frustrated enough to build something.

If you sell wheels or run a shop site, you know the fitment data problem. The good commercial API is priced for enterprises. The stuff people scrape off big retailer sites is a legal landmine. And the free datasets floating around are wrong in exactly the ways that cost you a return — model-level specs slapped onto every trim, staggered setups flattened to one size, HD trucks not split by SRW/DRW.

I built my own from OEM specs and manual research. Then I audited it — 12,006 records — and found my own bad data. Astro and S10 with 6x139.7 (wrong, they're 5x127 and 5x120.65). GR Corolla with base Corolla tire sizes. Phantom years that were never sold here. All cleaned up now.

Where it's at: **37,800 records, 81 makes, 1950–2026.** Trim-level. Staggered flags. 2011+ GM HD split correctly (8x180 SRW / 8x210 DRW). Bolt pattern, center bore, OEM wheel and tire sizes.

It's not a side project I'm hoping to launch someday — it runs my live store and real orders depend on it daily.

I've opened it as a REST API for other aftermarket businesses. Plain JSON, API key, five endpoints. Free sandbox key to test your problem vehicles first. Plans from $99/month.

The point isn't to compete with the big data vendors. It's that independent shops should have an independent option — data that isn't owned by a retailer you compete with, at a price a real shop can pay.

Details: shop.warehousetiredirect.com/fitment-api

If you've got vehicles you know are wrong everywhere, tell me. I'd rather find them from you than from a customer.

**Posting notes:**
SEMA forums are member-to-member and generally fine with a link when the post is substantive. Post in **Business / Technology** or the retailer/wholesaler section. Lean on the "independent data, not owned by a competitor" angle — that resonates with aftermarket shops who feel squeezed by the big online retailers. Don't oversell the record count; SEMA folks know how deep the long tail is.

---

## 7. LinkedIn (Scott's personal)

**Body:**

I've owned a tire shop in Michigan since 1998. A few years ago I taught myself to build software — with a lot of help from AI, I'm not shy about that.

The reason: I needed vehicle fitment data for my online store, and the commercial API was priced for companies a lot bigger than two locations. The shortcut — scraping the big retailers — wasn't something I was willing to risk legally.

So I built my own database from OEM specs. Then I audited it: 12,000 records. Found compact trucks tagged with full-size bolt patterns. Trims flattened to one wheel size. Model years that were never sold in the US. Fixed all of it.

Today it's 37,800 records across 81 makes, 1950 to 2026, down to the trim level. It runs my store every day. Real orders depend on it.

Last month I opened it up as an API for other shops.

Not because I want to be a software company. Because independent shops should have an independent option.

If you run a tire or wheel business and want to try it, there's a free test key here: shop.warehousetiredirect.com/fitment-api

**Posting notes:**
LinkedIn rewards short paragraphs and a personal arc — this is the one place the "taught myself with AI" line is an asset, not a liability. Post Tuesday–Thursday, 7–9 AM ET. Put the link in the body (LinkedIn's link-penalty is real but modest; alternatively put it in the first comment). Tag nothing, hashtag sparingly (#tireindustry #smallbusiness at most). Reply to every comment for the first day.

---

## 8. Comment Reply Cheat Sheet

1. **"$99/month is a lot for a small shop."** — "Fair. It's 10,000 lookups. If you're doing fewer than that, the free sandbox key might honestly be enough for you to test with. Tell me your volume and I'll tell you straight if it's worth it."
2. **"Why not just use wheel-size?"** — "It's a good product, no complaints. It's priced for enterprises and I wanted data I controlled. Different tool for a different size business."
3. **"How do I know your data's accurate?"** — "You don't, yet. Grab the free key and hit your ten worst vehicles. If I'm wrong, tell me — I'd rather fix it than argue. It runs my store live, so I find out fast when something's off."
4. **"Do you have [obscure vehicle]?"** — "Check with the sandbox key — takes two minutes. 81 makes, 1950–2026, but the long tail is long. If it's missing I'll add it to the research queue."
5. **"This is just an ad."** — "Partly, sure. Mostly I wanted to share the audit findings because the bad-data patterns apply to everyone's fitment data, not just mine. Link's in a comment, not the post, on purpose."

---

## 9. Posting Schedule

Don't blanket everything in one day. Reddit mods talk, and you can't reply to five threads at once.

| Day | Venue | Notes |
|---|---|---|
| **Week 1, Tue** | LinkedIn | Lowest risk, warms up the landing page. |
| **Week 1, Wed** | r/tires | Biggest reach. Clear the morning to reply. |
| **Week 1, Fri** | Tire Business / MTD forums | Trade audience, link in body OK. Also pitch editors. |
| **Week 2, Tue** | r/wheels | Different enough angle from r/tires. |
| **Week 2, Wed** | SEMA forums | Business/tech section. |
| **Week 2, Sat** | r/webdev (Showoff Saturday) **or** r/SideProject | Pick one. Do the other in Week 3 if the first went well. |
| **Week 3, Wed** | r/shopify | Last, because it's the strictest — by now you'll have real feedback to reference. |

If any post gets removed, don't repost the same day. Message the mods, ask what flair/format they want, wait a week.

---

## 10. Rules for Every Post

- **Every post links to** https://shop.warehousetiredirect.com/fitment-api — in the body where allowed (LinkedIn, trade forums, SEMA, r/SideProject), in a comment where not (r/tires, r/wheels, r/shopify, r/webdev outside Showoff Saturday).
- **Leads trigger email + SMS to Scott.** Have your phone on. Reply to sandbox signups same day — a personal note from the owner is the whole differentiator.
- Story first. Numbers only where true. No invented customer quotes.
- Never trash wheel-size.com. "Fine product, priced for enterprises" — that's the whole line.
- If you don't know a vehicle, say so and go check. Don't guess in a thread.
- Every correction someone posts is free QA. Thank them, fix it, come back and say you fixed it.
