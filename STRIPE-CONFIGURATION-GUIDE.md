# Dashboard Stripe Configuration - Implementation Guide

**Status:** ✅ COMPLETE  
**Date:** November 6, 2025  
**Version:** 2.0.0

---

## Overview

The external dashboard configuration tab has been enhanced with comprehensive Stripe payment configuration support. This allows administrators to securely manage all Stripe API keys and webhook settings from a single interface.

---

## Features Implemented

### 🎯 Stripe Configuration Tab

#### UI Components Added
1. **Publishable Key Field**
   - Type: Text input (masked)
   - Required: Yes
   - Placeholder: `pk_live_...`
   - Hint: Used for frontend Stripe.js checkout

2. **Secret Key Field**
   - Type: Password input (masked)
   - Required: Yes
   - Placeholder: `sk_live_...`
   - Hint: Used for backend payment processing

3. **Webhook Secret Field**
   - Type: Password input (masked)
   - Required: Yes
   - Placeholder: `whsec_...`
   - Hint: Used to verify Stripe webhook events

4. **Default Currency Dropdown**
   - Options: JPY (default), USD, EUR, GBP
   - Required: No
   - Default: JPY

5. **Operating Mode Dropdown**
   - Options: Test Mode, Live Mode
   - Required: Yes
   - Warning: Yellow alert when Live Mode is selected

6. **Platform Fee Percentage**
   - Type: Number input (0-100)
   - Allows decimals (0.1 increments)
   - Default: 0%
   - Optional

#### Action Buttons
1. **Save Stripe Configuration**
   - Validates all required fields
   - Sends config to backend
   - Shows success/error alerts
   - Reloads config after 1 second

2. **Test Connection**
   - Verifies Stripe API keys are valid
   - Retrieves account information
   - Shows account ID, email, and country
   - Provides clear error messages

3. **View Webhooks**
   - Displays all configured webhooks
   - Shows webhook URL and enabled events
   - Displays creation timestamp
   - Fetches from Stripe API in real-time

---

## Files Created/Modified

### 📁 New Files Created

#### 1. `models/StripeConfig.js` (160+ lines)
**Purpose:** Stripe configuration model with MongoDB integration

**Key Methods:**
- `getConfig()` - Retrieve current Stripe configuration
- `updateConfig(configData)` - Save new configuration
- `verifyConnection(publishableKey, secretKey)` - Test Stripe API keys
- `getWebhooks(secretKey)` - Fetch webhooks from Stripe
- `createWebhook(secretKey, url, events)` - Create webhook endpoint
- `validateKeys(publishableKey, secretKey)` - Validate key formats

**Features:**
- Singleton pattern (only one config stored)
- Secure credential validation
- Stripe API integration
- Webhook management

### 📝 Modified Files

#### 1. `views/dashboard/external/index.pug`
**Changes:**
- Split configuration tab into two cards
  - OpenAI Configuration (existing)
  - Stripe Payment Configuration (new)
- Added Stripe form with 6 input fields
- Added info alert with link to Stripe Dashboard
- Added 3 action buttons

#### 2. `routers/api/external-admin.js`
**Added Endpoints:**

1. **GET `/api/v1/admin/config/stripe`**
   - Retrieves current Stripe configuration
   - Masks sensitive keys for security
   - Returns masked versions for display

2. **PUT `/api/v1/admin/config/stripe`**
   - Updates Stripe configuration
   - Validates all required fields
   - Validates key formats (pk_, sk_)
   - Stores updated config in MongoDB

3. **POST `/api/v1/admin/config/stripe/test`**
   - Tests Stripe API connection
   - Verifies both publishable and secret keys
   - Returns account information if successful
   - Returns detailed error message if failed

4. **GET `/api/v1/admin/config/stripe/webhooks`**
   - Fetches all configured webhooks from Stripe
   - Shows webhook URLs and events
   - Displays webhook creation time

5. **POST `/api/v1/admin/config/stripe/webhooks`**
   - Creates new webhook endpoint in Stripe
   - Requires webhook URL and events array
   - Returns webhook secret for verification

#### 3. `public/js/external-dashboard.js`
**Added Methods:**
- `saveStripeConfig(e)` - Save Stripe configuration
- `testStripeConnection()` - Test Stripe API connectivity
- `viewStripeWebhooks()` - Display configured webhooks

**Updated Methods:**
- `bindEvents()` - Added event listeners for Stripe buttons
- `loadConfig()` - Added Stripe config loading

---

## Database Schema

### New MongoDB Collection: `stripe_configs`

```javascript
{
  _id: ObjectId,
  publishable_key: "pk_live_...",
  secret_key: "sk_live_...",
  webhook_secret: "whsec_...",
  default_currency: "jpy",        // jpy, usd, eur, gbp
  mode: "test",                   // test or live
  fee_percentage: 0,              // 0-100, decimal allowed
  updated_at: Date,
  updated_by: "admin@example.com"
}
```

**Indexes Recommended:**
- `updated_at` (descending) for retrieval efficiency

---

## API Endpoints

### Get Stripe Configuration
```bash
GET /api/v1/admin/config/stripe
```

**Response:**
```json
{
  "success": true,
  "config": {
    "publishable_key": "pk_live_4b0f...",
    "publishable_key_full": "pk_live_4b0f1234567890abcdef",
    "secret_key": "••••••••ef00",
    "webhook_secret": "••••••••h5x2",
    "default_currency": "jpy",
    "mode": "test",
    "fee_percentage": 0,
    "updated_at": "2025-11-06T10:30:00Z"
  }
}
```

### Save Stripe Configuration
```bash
PUT /api/v1/admin/config/stripe
Content-Type: application/json

{
  "publishable_key": "pk_live_...",
  "secret_key": "sk_live_...",
  "webhook_secret": "whsec_...",
  "default_currency": "jpy",
  "mode": "test",
  "fee_percentage": 0.5
}
```

**Response:**
```json
{
  "success": true,
  "message": "Stripe configuration updated successfully",
  "config": {
    "publishable_key": "pk_live_4b0f...",
    "default_currency": "jpy",
    "mode": "test",
    "fee_percentage": 0.5
  }
}
```

### Test Stripe Connection
```bash
POST /api/v1/admin/config/stripe/test
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Stripe connection successful",
  "account": {
    "id": "acct_1234567890",
    "email": "admin@stripe.example.com",
    "country": "JP"
  }
}
```

**Response (Failure):**
```json
{
  "success": false,
  "error": "Invalid API Key provided"
}
```

### Get Stripe Webhooks
```bash
GET /api/v1/admin/config/stripe/webhooks
```

**Response:**
```json
{
  "success": true,
  "webhooks": [
    {
      "id": "we_1234567890",
      "url": "https://example.com/webhook",
      "events": ["payment_intent.succeeded", "payment_intent.payment_failed"],
      "enabled": true,
      "created_at": "2025-11-06T10:30:00Z"
    }
  ]
}
```

---

## Security Considerations

### 🔐 Key Protection
1. **Secret Keys Masked in Responses**
   - Full secret keys never returned to frontend
   - Displayed as `••••••••` + last 4 chars
   - Only used internally by backend

2. **Frontend Masking**
   - Password input type for secret fields
   - Masks as dots during input

3. **Database Storage**
   - Stored in secure MongoDB collection
   - Access controlled by authentication middleware

4. **Validation**
   - Key format validation (pk_, sk_, whsec_ prefixes)
   - Required field validation
   - Mode switching warning

### 🔄 Webhook Security
1. **HMAC-SHA256 Signatures**
   - All Stripe webhooks signed
   - Signature verification required
   - Webhook secret stored separately

2. **Event Verification**
   - Events verified against Stripe API
   - Prevents webhook spoofing
   - Detailed error logging

---

## Frontend User Interface

### Configuration Tab Layout
```
┌─────────────────────────────────────────┐
│ OpenAI Configuration                    │
├─────────────────────────────────────────┤
│ [API Key]      [Article Model]          │
│ [Image Model]  [Max Tokens]  [Temp]    │
│ [Save Config]  [Test Config]            │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Stripe Payment Configuration            │
├─────────────────────────────────────────┤
│ ℹ️ Get keys from Stripe Dashboard       │
│                                         │
│ [Publishable Key]    [Secret Key]       │
│ [Webhook Secret]     [Currency]         │
│ [Operating Mode]     [Fee %]            │
│                                         │
│ [Save Config] [Test Connection] [View] │
└─────────────────────────────────────────┘
```

---

## Getting Stripe Keys

### Step 1: Create Stripe Account
- Visit: https://dashboard.stripe.com/register
- Enter business information

### Step 2: Get API Keys
- Navigate to: Developers → API Keys
- Find: Publishable Key (starts with `pk_`)
- Find: Secret Key (starts with `sk_`)

### Step 3: Get Webhook Secret
- Navigate to: Developers → Webhooks
- Create new endpoint or use existing
- Copy: Signing Secret (starts with `whsec_`)

### Step 4: Configure Dashboard
1. Go to Configuration tab
2. Select "Test Mode" for testing
3. Enter all three keys
4. Click "Test Connection"
5. Click "Save Configuration"
6. Later, switch to "Live Mode" for production

---

## Testing & Verification

### Manual Testing Steps

#### Test 1: Save Configuration
```javascript
1. Fill in test Stripe keys
   - pk_test_... (publishable)
   - sk_test_... (secret)
   - whsec_test_... (webhook secret)

2. Select "Test Mode"

3. Click "Save Configuration"

4. Expected: Success alert ✓
```

#### Test 2: Test Connection
```javascript
1. Ensure configuration is saved

2. Click "Test Connection" button

3. Expected: Modal with Stripe account info
   - Account ID: acct_...
   - Email: verified@stripe.com
   - Country: JP
```

#### Test 3: View Webhooks
```javascript
1. Click "View Webhooks" button

2. Expected: Shows list of webhooks or message
   - Webhook URLs
   - Enabled events
   - Creation timestamps
```

#### Test 4: Form Validation
```javascript
1. Try to save without Publishable Key

2. Expected: Error alert "All Stripe keys are required"

3. Try key with wrong prefix (abc123)

4. Expected: Error alert "Invalid publishable key format"
```

---

## Configuration Examples

### Test Mode Setup
```json
{
  "publishable_key": "pk_test_51234567890abcdefghij",
  "secret_key": "sk_test_51234567890abcdefghij",
  "webhook_secret": "whsec_1234567890abcdefghij",
  "default_currency": "jpy",
  "mode": "test",
  "fee_percentage": 0
}
```

### Live Mode Setup
```json
{
  "publishable_key": "pk_live_51234567890abcdefghij",
  "secret_key": "sk_live_51234567890abcdefghij",
  "webhook_secret": "whsec_1234567890abcdefghij",
  "default_currency": "jpy",
  "mode": "live",
  "fee_percentage": 2.5
}
```

### Multi-Currency Setup
```json
{
  "publishable_key": "pk_live_...",
  "secret_key": "sk_live_...",
  "webhook_secret": "whsec_...",
  "default_currency": "usd",
  "mode": "live",
  "fee_percentage": 2.9
}
```

---

## Error Handling

### Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Invalid API Key | Wrong secret key | Copy again from Stripe Dashboard |
| Invalid Publishable Key Format | Missing pk_ prefix | Ensure key starts with `pk_` |
| Missing Webhook Secret | Not provided | Get from Stripe Webhooks page |
| 401 Unauthorized | Keys don't match | Verify keys match same Stripe account |
| Mode mismatch | Test key in Live mode | Use pk_test_ for test, pk_live_ for live |

---

## Webhook Events Configuration

### Recommended Events to Enable
```javascript
const recommendedEvents = [
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'charge.failed',
  'charge.refunded',
  'customer.created',
  'customer.deleted'
];
```

### Setup Webhook Endpoint
1. Stripe Dashboard → Developers → Webhooks
2. Add Endpoint
3. URL: `https://your-domain.com/webhook/stripe`
4. Select events above
5. Copy signing secret
6. Add to dashboard configuration

---

## Production Deployment

### Pre-Deployment Checklist
- [ ] All Stripe keys obtained from production account
- [ ] Mode set to "Live"
- [ ] Connection test successful
- [ ] Webhooks configured and verified
- [ ] SSL certificate valid (HTTPS)
- [ ] Backup database configured
- [ ] Monitoring/alerts set up
- [ ] Team trained on configuration
- [ ] Documentation reviewed

### Deployment Steps
1. Update environment if needed
2. Go to Configuration tab
3. Switch to Live Mode keys
4. Test Connection button
5. Save Configuration
6. Monitor webhook delivery

---

## Monitoring

### Key Metrics to Track
- Stripe API response times
- Payment success rate
- Webhook delivery rate
- Configuration update frequency
- Error rates by error type

### Health Checks
```bash
# Check configuration status
curl https://domain/api/v1/admin/config/stripe

# Test Stripe connection
curl -X POST https://domain/api/v1/admin/config/stripe/test

# Get webhook status
curl https://domain/api/v1/admin/config/stripe/webhooks
```

---

## Support & Troubleshooting

### Debug Mode
To enable detailed logging:
1. Check browser console (F12)
2. Check server logs at `/var/log/app.log`
3. Look for "Stripe" entries

### Common Questions

**Q: Can I use test and live keys at the same time?**
A: No, only one configuration is stored. Switch mode to use different keys.

**Q: Are my keys saved securely?**
A: Yes, MongoDB secures them and backend masks them in responses.

**Q: What if I lose my webhook secret?**
A: Get a new one from Stripe Dashboard and update the configuration.

**Q: Can I change currency per payment?**
A: Yes, this is the default currency. Per-payment currency can be set at payment intent creation.

---

## API Integration with Payment Endpoints

The Stripe configuration integrates with:

1. **`POST /api/v1/payments/create-intent`**
   - Uses publishable_key for frontend
   - Uses default_currency setting
   - Uses fee_percentage for pricing

2. **`POST /api/v1/payments/confirm`**
   - Uses secret_key to verify with Stripe
   - Confirms payment succeeded
   - Adds credits to user

3. **Webhook Processing**
   - Uses webhook_secret to verify signatures
   - Processes payment events
   - Updates transaction status

---

## References

- **Stripe Documentation:** https://stripe.com/docs/api
- **Stripe Keys:** https://dashboard.stripe.com/apikeys
- **Stripe Webhooks:** https://dashboard.stripe.com/webhooks
- **API Endpoints:** See `routers/api/external-admin.js`
- **Model:** See `models/StripeConfig.js`

---

**Status:** ✅ Production Ready  
**Last Updated:** November 6, 2025  
**Version:** 2.0.0
