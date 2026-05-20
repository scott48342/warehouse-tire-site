# Jake Missing-DB QA Test Report
**Generated:** 2026-05-20T17:32:35.804Z
**API:** https://tire-fitment-ai.onrender.com/api/ai/fitment

## Summary
- **Total Tests:** 8
- **Passed:** 0 ✅
- **Failed:** 8 ❌
- **Pass Rate:** 0.0%

## Results

| # | Test | Status | Fallback | Platform | Research | Dead-End | Duration |
|---|------|--------|----------|----------|----------|----------|----------|
| 1 | 2008 Cadillac DTS wanting 20s | ❌ FAIL | No | No | No | No | 323ms |
| 2 | 1998 Pontiac Firebird Formula wanting 20s | ❌ FAIL | No | No | No | No | 164ms |
| 3 | 1995 Toyota Camry tire size | ❌ FAIL | No | No | No | No | 88ms |
| 4 | 2015 Toyota Camry SE wheels and tires | ❌ FAIL | No | No | No | No | 87ms |
| 5 | 1998 Pontiac Transport tires | ❌ FAIL | No | No | No | No | 82ms |
| 6 | 2001 Oldsmobile Silhouette wheels | ❌ FAIL | No | No | No | No | 91ms |
| 7 | 1999 Toyota Avalon tires | ❌ FAIL | No | No | No | No | 94ms |
| 8 | 2024 Ford F-150 XLT (verified control) | ❌ FAIL | No | No | No | No | 89ms |

## Failures

### ❌ 2008 Cadillac DTS wanting 20s
**Prompt:** "I have a 2008 Cadillac DTS and want modern 20 inch wheels and tires."

**Failures:**
- API returned HTTP 400

**Response Preview:**
> (no response)...

### ❌ 1998 Pontiac Firebird Formula wanting 20s
**Prompt:** "I have a 1998 Pontiac Firebird Formula and want 20 inch wheels."

**Failures:**
- API returned HTTP 400

**Response Preview:**
> (no response)...

### ❌ 1995 Toyota Camry tire size
**Prompt:** "What tire size does a 1995 Toyota Camry take?"

**Failures:**
- API returned HTTP 400

**Response Preview:**
> (no response)...

### ❌ 2015 Toyota Camry SE wheels and tires
**Prompt:** "I need wheels and tires for a 2015 Toyota Camry SE."

**Failures:**
- API returned HTTP 400

**Response Preview:**
> (no response)...

### ❌ 1998 Pontiac Transport tires
**Prompt:** "I need tires for a 1998 Pontiac Transport."

**Failures:**
- API returned HTTP 400

**Response Preview:**
> (no response)...

### ❌ 2001 Oldsmobile Silhouette wheels
**Prompt:** "I need wheels for a 2001 Oldsmobile Silhouette."

**Failures:**
- API returned HTTP 400

**Response Preview:**
> (no response)...

### ❌ 1999 Toyota Avalon tires
**Prompt:** "What tires fit a 1999 Toyota Avalon?"

**Failures:**
- API returned HTTP 400

**Response Preview:**
> (no response)...

### ❌ 2024 Ford F-150 XLT (verified control)
**Prompt:** "What wheels fit a 2024 Ford F-150 XLT?"

**Failures:**
- API returned HTTP 400

**Response Preview:**
> (no response)...

## Detailed Results

### ❌ 2008 Cadillac DTS wanting 20s
- **ID:** dts-2008-20s
- **Duration:** 323ms
- **Used Fallback:** No
- **Fallback Source:** N/A
- **Fallback Confidence:** N/A
- **Platform Knowledge:** No
- **Trusted Research:** Not tried
- **Cache Hit:** No
- **Bolt Pattern:** Not detected
- **Products Returned:** 0
- **Has Good Continuation:** false
- **Dead-End Detected:** false

**Response:**
> (no response)

### ❌ 1998 Pontiac Firebird Formula wanting 20s
- **ID:** firebird-1998-20s
- **Duration:** 164ms
- **Used Fallback:** No
- **Fallback Source:** N/A
- **Fallback Confidence:** N/A
- **Platform Knowledge:** No
- **Trusted Research:** Not tried
- **Cache Hit:** No
- **Bolt Pattern:** Not detected
- **Products Returned:** 0
- **Has Good Continuation:** false
- **Dead-End Detected:** false

**Response:**
> (no response)

### ❌ 1995 Toyota Camry tire size
- **ID:** camry-1995-tires
- **Duration:** 88ms
- **Used Fallback:** No
- **Fallback Source:** N/A
- **Fallback Confidence:** N/A
- **Platform Knowledge:** No
- **Trusted Research:** Not tried
- **Cache Hit:** No
- **Bolt Pattern:** Not detected
- **Products Returned:** 0
- **Has Good Continuation:** false
- **Dead-End Detected:** false

**Response:**
> (no response)

### ❌ 2015 Toyota Camry SE wheels and tires
- **ID:** camry-2015-se
- **Duration:** 87ms
- **Used Fallback:** No
- **Fallback Source:** N/A
- **Fallback Confidence:** N/A
- **Platform Knowledge:** No
- **Trusted Research:** Not tried
- **Cache Hit:** No
- **Bolt Pattern:** Not detected
- **Products Returned:** 0
- **Has Good Continuation:** false
- **Dead-End Detected:** false

**Response:**
> (no response)

### ❌ 1998 Pontiac Transport tires
- **ID:** transport-1998-tires
- **Duration:** 82ms
- **Used Fallback:** No
- **Fallback Source:** N/A
- **Fallback Confidence:** N/A
- **Platform Knowledge:** No
- **Trusted Research:** Not tried
- **Cache Hit:** No
- **Bolt Pattern:** Not detected
- **Products Returned:** 0
- **Has Good Continuation:** false
- **Dead-End Detected:** false

**Response:**
> (no response)

### ❌ 2001 Oldsmobile Silhouette wheels
- **ID:** silhouette-2001-wheels
- **Duration:** 91ms
- **Used Fallback:** No
- **Fallback Source:** N/A
- **Fallback Confidence:** N/A
- **Platform Knowledge:** No
- **Trusted Research:** Not tried
- **Cache Hit:** No
- **Bolt Pattern:** Not detected
- **Products Returned:** 0
- **Has Good Continuation:** false
- **Dead-End Detected:** false

**Response:**
> (no response)

### ❌ 1999 Toyota Avalon tires
- **ID:** avalon-1999-tires
- **Duration:** 94ms
- **Used Fallback:** No
- **Fallback Source:** N/A
- **Fallback Confidence:** N/A
- **Platform Knowledge:** No
- **Trusted Research:** Not tried
- **Cache Hit:** No
- **Bolt Pattern:** Not detected
- **Products Returned:** 0
- **Has Good Continuation:** false
- **Dead-End Detected:** false

**Response:**
> (no response)

### ❌ 2024 Ford F-150 XLT (verified control)
- **ID:** f150-2024-control
- **Duration:** 89ms
- **Used Fallback:** No
- **Fallback Source:** N/A
- **Fallback Confidence:** N/A
- **Platform Knowledge:** No
- **Trusted Research:** Not tried
- **Cache Hit:** No
- **Bolt Pattern:** Not detected
- **Products Returned:** 0
- **Has Good Continuation:** false
- **Dead-End Detected:** false

**Response:**
> (no response)

## Recommendations

### Platform Knowledge Issues (1)
Platform knowledge not being used when expected:
- 1998 Pontiac Firebird Formula wanting 20s
**Fix:** Check platform matching in platformKnowledgeService.ts

### Fallback Issues (7)
Fallback mechanisms not triggering:
- 2008 Cadillac DTS wanting 20s
- 1998 Pontiac Firebird Formula wanting 20s
- 1995 Toyota Camry tire size
- 2015 Toyota Camry SE wheels and tires
- 1998 Pontiac Transport tires
- 2001 Oldsmobile Silhouette wheels
- 1999 Toyota Avalon tires
**Fix:** Review fallbackFitmentService.ts lookup chain
