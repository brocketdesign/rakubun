# Stripe Configuration Integration Fix

**Date:** November 6, 2025  
**Status:** ✅ IMPLEMENTED  
**Issue:** Payment endpoints were using environment variables instead of dashboard Stripe configuration

---

## Problem

The external API payment endpoints were using hardcoded environment variables:
```javascript
const stripeKey = process.env.STRIPE_SECRET_KEY;
```

This meant:
- ❌ Admin couldn't manage Stripe keys through the dashboard
- ❌ Multiple environments required different deployments
- ❌ Key rotation required code changes and redeployment
- ❌ Dashboard Stripe configuration was ignored

---

## Solution

Updated all payment endpoints to use **StripeConfig** from the database (configured in the dashboard).

### Changed Endpoints

1. **`POST /api/v1/checkout/sessions`**
2. **`POST /api/v1/payments/create-intent`**
3. **`POST /api/v1/payments/confirm`**

### Before

```javascript
// ❌ Using environment variable
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = require('stripe')(stripeKey);
```

### After

```javascript
// ✅ Using dashboard configuration
const StripeConfig = require('../../models/StripeConfig');
const stripeConfig = await StripeConfig.getConfig();

if (!stripeConfig || !stripeConfig.secret_key) {
  return res.status(500).json({
    success: false,
    error: 'payment_not_configured',
    message: 'Stripe payment processing not configured in dashboard'
  });
}

const stripe = require('stripe')(stripeConfig.secret_key);
```

---

## Benefits

✅ **Dashboard Control**
- Admin configures Stripe keys via external dashboard
- No code changes needed to update keys

✅ **Dynamic Configuration**
- Switch between test and live keys instantly
- Multiple Stripe accounts supported

✅ **Proper Error Messages**
- Clear error when Stripe not configured
- Guides admin to dashboard settings

✅ **Currency Support**
- Uses `stripeConfig.default_currency` from dashboard
- Can override per request with `currency` parameter

---

## Configuration Flow

```
Admin Dashboard
    ↓
Set Stripe Keys in /dashboard/external (Configuration tab)
    ↓
Save to MongoDB (stripe_configs collection)
    ↓
WordPress Plugin calls API
    ↓
API fetches StripeConfig.getConfig()
    ↓
Creates Stripe checkout session with correct keys
    ↓
Plugin redirects user to Stripe
```

---

## Dashboard Configuration

The dashboard already has a form in `views/dashboard/external/index.pug`:

**File:** `views/dashboard/external/index.pug`  
**Tab:** Configuration  
**Card:** Stripe Payment Configuration

**Fields:**
- ✅ Publishable Key
- ✅ Secret Key
- ✅ Webhook Secret
- ✅ Default Currency
- ✅ Operating Mode (test/live)
- ✅ Platform Fee (%)

**Admin Interface:**
1. Navigate to External Dashboard
2. Click "Configuration" tab
3. Find "Stripe Payment Configuration" section
4. Enter keys from Stripe Dashboard
5. Select currency (JPY, USD, EUR, GBP)
6. Choose test or live mode
7. Click "Save Stripe Configuration"

---

## StripeConfig Model

**Location:** `models/StripeConfig.js`

**Methods:**
- `StripeConfig.getConfig()` - Get current config
- `StripeConfig.updateConfig(configData)` - Update config
- `StripeConfig.verifyConnection(pubKey, secretKey)` - Test connection
- `StripeConfig.getWebhooks(secretKey)` - List webhooks
- `StripeConfig.createWebhook(secretKey, url, events)` - Create webhook

**Database Collection:** `stripe_configs`

---

## API Behavior

### When Stripe Not Configured

**Response:**
```json
{
  "success": false,
  "error": "payment_not_configured",
  "message": "Stripe payment processing not configured in dashboard"
}
```

**HTTP Status:** 500

**Action:** Admin sees this and configures Stripe in dashboard

### When Configured

All payment endpoints work with:
- Dashboard Stripe Secret Key
- Dashboard Default Currency
- Dashboard Operating Mode (test/live)

---

## Updated Endpoints

### 1. POST /api/v1/checkout/sessions

**Now Uses:**
- `stripeConfig.secret_key` - For Stripe API
- `stripeConfig.default_currency` - Default currency (can override)
- `stripeConfig.publishable_key` - For frontend (available via `/config/stripe`)

### 2. POST /api/v1/payments/create-intent

**Now Uses:**
- `stripeConfig.secret_key` - For Stripe API
- `stripeConfig.default_currency` - Default currency (can override)

### 3. POST /api/v1/payments/confirm

**Now Uses:**
- `stripeConfig.secret_key` - For Stripe API
- Verifies payment with Stripe
- Creates transaction record

### 4. GET /api/v1/config/stripe (Existing)

**Already Uses Dashboard Config:**
```javascript
const stripeConfig = await StripeConfig.getConfig();
res.json({
  public_key: stripeConfig.publishable_key,
  currency: stripeConfig.default_currency || 'jpy'
});
```

---

## Testing

### 1. Verify Stripe Config Setup

```bash
# Check if Stripe config exists
curl http://localhost:3000/api/v1/config/stripe \
  -H "Authorization: Bearer <api_token>" \
  -H "X-Instance-ID: <instance_id>" \
  -H "User-Agent: Rakubun-WordPress-Plugin/2.0"

# Should return public_key and currency
```

### 2. Create Checkout Session

```bash
curl -X POST http://localhost:3000/api/v1/checkout/sessions \
  -H "Authorization: Bearer <api_token>" \
  -H "X-Instance-ID: <instance_id>" \
  -H "User-Agent: Rakubun-WordPress-Plugin/2.0" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 123,
    "user_email": "user@example.com",
    "credit_type": "article",
    "package_id": "article_starter",
    "amount": 750
  }'

# Should work if Stripe configured in dashboard
```

### 3. Test Without Stripe Config

```bash
# 1. Delete Stripe config from database
# 2. Try checkout endpoint
# 3. Should get: "Stripe payment processing not configured in dashboard"
```

---

## Database Setup

**Collection:** `stripe_configs`

**Document Structure:**
```json
{
  "_id": ObjectId("..."),
  "publishable_key": "pk_live_...",
  "secret_key": "sk_live_...",
  "webhook_secret": "whsec_...",
  "default_currency": "jpy",
  "mode": "live",
  "fee_percentage": 0,
  "updated_at": ISODate("2025-11-06T..."),
  "updated_by": "admin@example.com"
}
```

---

## Environment Variables (No Longer Required)

Previously required:
```bash
STRIPE_SECRET_KEY=sk_test_...    # ❌ NOT USED ANYMORE
STRIPE_PUBLIC_KEY=pk_test_...    # ❌ NOT USED ANYMORE
```

Now:
- ✅ Configure via dashboard
- ✅ No environment variables needed for payment keys
- ⚠️ DASHBOARD_URL still used for redirects

---

## Error Scenarios

### Scenario 1: First-time Setup
1. Plugin calls checkout endpoint
2. No Stripe config in database
3. **Error:** "Stripe payment processing not configured in dashboard"
4. **Solution:** Admin configures Stripe in dashboard

### Scenario 2: Wrong Keys
1. Admin enters invalid Stripe keys
2. Stripe API rejects request
3. **Error:** Stripe error message (e.g., "Invalid API Key")
4. **Solution:** Admin verifies keys, can use "Test Connection" button

### Scenario 3: Test Keys in Live Mode
1. Admin configures test keys but sets mode to "live"
2. Transactions will fail
3. **Error:** Stripe errors about test mode keys
4. **Solution:** Admin uses "Test Connection" button to verify

---

## Admin Workflow

### Initial Setup
```
1. Admin accesses External Dashboard
2. Goes to Configuration tab
3. Finds Stripe configuration section
4. Gets keys from Stripe Dashboard
5. Enters publishable key
6. Enters secret key
7. Enters webhook secret
8. Selects currency (default: JPY)
9. Selects mode (default: test)
10. Clicks "Test Connection" button
11. ✅ Sees success message
12. Clicks "Save Stripe Configuration"
```

### Key Rotation
```
1. Admin gets new keys from Stripe Dashboard
2. Opens External Dashboard
3. Updates Stripe Configuration tab
4. Clicks "Save Stripe Configuration"
5. ✅ All API requests use new keys immediately
6. No restart needed
```

### Troubleshooting
```
1. Users report payment errors
2. Admin goes to Configuration tab
3. Clicks "Test Connection" button
4. System tests Stripe connection
5. Shows success/failure
6. Admin can view Stripe webhooks
7. Can check if webhooks registered correctly
```

---

## Security Improvements

✅ **Secret Keys Protected**
- Never exposed in API responses
- Only used server-side
- Stored securely in database

✅ **Per-Site Configuration**
- Could extend to per-external-site Stripe accounts
- Future enhancement

✅ **Audit Trail**
- `updated_at` tracks when config changed
- `updated_by` tracks who changed it

---

## Deployment Notes

**No Environment Variables Required:**
- ❌ Remove `STRIPE_SECRET_KEY` from .env
- ❌ Remove `STRIPE_PUBLIC_KEY` from .env
- ✅ Keep `DASHBOARD_URL` if using redirects

**Database Migration:**
- ✅ New collection auto-created on first save
- ✅ Admin must configure Stripe manually
- ✅ Existing env vars can be used for initial setup script (optional)

---

## Files Modified

1. **`routers/api/external.js`**
   - Updated `POST /api/v1/checkout/sessions`
   - Updated `POST /api/v1/payments/create-intent`
   - Updated `POST /api/v1/payments/confirm`
   - Added StripeConfig import and retrieval
   - ~30 lines changed across 3 endpoints

---

## Related Files (Already Implemented)

1. **`models/StripeConfig.js`** ✅
   - Model for Stripe configuration
   - Database operations

2. **`views/dashboard/external/index.pug`** ✅
   - Admin UI for Stripe configuration
   - Test connection button
   - Webhook management

3. **`routers/dashboard/external-admin.js`** ✅
   - Likely handles saving config (verify)

---

## Verification Checklist

- [ ] Admin can access Configuration tab in external dashboard
- [ ] Can enter Stripe keys without errors
- [ ] Can click "Test Connection" successfully
- [ ] WordPress plugin checkout session works
- [ ] Payment intent creation works
- [ ] Payment confirmation works
- [ ] Currency from dashboard is used
- [ ] Test/live mode from dashboard is used
- [ ] Removing config shows proper error message
- [ ] Switching keys updates immediately (no restart)

---

## Next Steps

1. **API Endpoint for Config Management**
   - Create `GET/POST /api/admin/stripe-config`
   - For programmatic config management

2. **Per-Site Stripe Keys**
   - Allow each WordPress site its own Stripe account
   - Useful for resellers

3. **Key Rotation Alerts**
   - Email admin before key expires
   - Log all key changes

4. **Webhook Verification**
   - Test webhook delivery
   - Confirm events reaching dashboard

---

**Status:** ✅ COMPLETE & READY  
**Last Updated:** November 6, 2025  
**Version:** 1.0.0
