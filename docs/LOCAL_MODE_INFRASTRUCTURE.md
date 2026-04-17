# Local Mode Infrastructure Checklist

## Domain: shop.warehousetire.net

### Step 1: Vercel Domain Setup

1. Go to: https://vercel.com/dashboard
2. Select project: `warehouse-tire-site`
3. Click: **Settings** → **Domains**
4. Click: **Add**
5. Enter: `shop.warehousetire.net`
6. Click: **Add**

Vercel will show DNS instructions. Note the CNAME value (should be `cname.vercel-dns.com`).

### Step 2: GoDaddy DNS Configuration

1. Go to: https://dcc.godaddy.com/
2. Find domain: `warehousetire.net`
3. Click: **DNS** (or Manage DNS)
4. Click: **Add** (or Add Record)
5. Configure:

| Field | Value |
|-------|-------|
| Type | CNAME |
| Name | shop |
| Value | cname.vercel-dns.com |
| TTL | 600 (or Auto) |

6. Click: **Save**

### Step 3: Verify in Vercel

1. Return to Vercel Domains page
2. Wait 1-5 minutes for DNS propagation
3. Status should show: ✅ Valid Configuration
4. SSL certificate auto-provisions (additional 1-2 minutes)

### Step 4: Test Access

Visit: https://shop.warehousetire.net

- [ ] Page loads without SSL errors
- [ ] Shows the shop (not WordPress)
- [ ] Response headers include `x-robots-tag: noindex, nofollow`

---

## Environment Variables

No new environment variables required. Local mode detection uses host headers.

---

## Rollback Plan

If issues occur:

1. **Remove domain from Vercel:**
   - Settings → Domains → Remove `shop.warehousetire.net`

2. **Remove DNS record from GoDaddy:**
   - Delete the CNAME record for `shop`

3. **Traffic will fail gracefully:**
   - `shop.warehousetire.net` becomes unreachable
   - National site (`shop.warehousetiredirect.com`) unaffected

---

## Monitoring

After go-live, monitor:

- [ ] Vercel deployment logs for errors
- [ ] Google Search Console for unexpected indexing (should see none for local domain)
- [ ] Order volume from local mode (check admin orders for 🔧 badges)
- [ ] Customer complaints about checkout flow

---

## Future Enhancements (Optional)

### Path-Based Routing (warehousetire.net/shop)

If you want `warehousetire.net/shop` instead of subdomain:

1. Configure WordPress/server to reverse proxy `/shop/*` to Vercel
2. Add header: `X-Shop-Mode: local`
3. Code already supports this - just needs proxy config

### Multiple Store Domains

If needed later (e.g., `pontiac.warehousetire.net`):

1. Add domain to Vercel
2. Update `shopContext.ts` to detect store from subdomain
3. Pre-select store based on host

---

## Contact

- **Vercel Support:** https://vercel.com/support
- **GoDaddy Support:** https://www.godaddy.com/help

---

## Sign-Off

| Step | Completed | Date | Notes |
|------|-----------|------|-------|
| Vercel domain added | | | |
| DNS configured | | | |
| SSL verified | | | |
| Test access | | | |
| QA complete | | | |
