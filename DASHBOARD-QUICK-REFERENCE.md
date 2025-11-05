# Dashboard Integration - Quick Reference

**Status:** ✅ COMPLETE  
**Date:** November 6, 2025  
**Version:** 2.0.0

---

## What Was Updated

### 🎯 Core Updates

1. **Plugin Registration** ✅
   - Now returns `webhook_secret` for HMAC-SHA256 signing
   - ExternalSite model stores webhook secret securely
   - 256+ bits cryptographic entropy

2. **Payment Processing** ✅ NEW
   - `POST /api/v1/payments/create-intent` - Create Stripe payment intents
   - `POST /api/v1/payments/confirm` - Verify Stripe payment and add credits
   - Full integration with Stripe API
   - Atomic credit addition on payment success

3. **Webhook System** ✅ NEW
   - `services/webhookManager.js` - New webhook delivery system
   - HMAC-SHA256 signature verification
   - Event-based helpers for config, credits, enable/disable
   - Broadcast capability to multiple instances

### 📋 All Implemented Endpoints

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/plugins/register` | POST | Register plugin instance | ✅ Updated |
| `/users/credits` | GET | Get user credit balance | ✅ Existing |
| `/users/deduct-credits` | POST | Deduct credits after use | ✅ Existing |
| `/packages` | GET | List available packages | ✅ Existing |
| `/config/openai` | GET | Get OpenAI configuration | ✅ Existing |
| `/payments/create-intent` | POST | Create payment intent | ✅ **NEW** |
| `/payments/confirm` | POST | Confirm payment & add credits | ✅ **NEW** |
| `/analytics/generation` | POST | Log generation event | ✅ Existing |
| `/analytics/usage` | POST | Batch sync analytics | ✅ Existing |
| `/instances/:id` | GET | Get instance details | ✅ Existing |
| `/instances/:id` | PUT | Update instance info | ✅ Existing |

---

## Implementation Highlights

### Payment Flow
```
Plugin: create_payment_intent()
    ↓ (REST call)
Dashboard: Creates Stripe PaymentIntent
    ↓ (Returns client_secret)
Plugin: Shows Stripe.js checkout
    ↓ (User enters card)
Stripe: Confirms payment
    ↓ (Returns success)
Plugin: confirm_payment()
    ↓ (REST call with payment_intent_id)
Dashboard: Verifies with Stripe
    ↓ (Confirms "succeeded" status)
Dashboard: Adds credits to user
    ↓ (Returns new balance)
Plugin: Shows success message
```

### Webhook System
```
Dashboard Admin: Updates config
    ↓
Dashboard: Calls webhookManager.notifyConfigUpdated()
    ↓
webhookManager: Sends webhook to all plugin instances
    ├─ Generates HMAC-SHA256 signature
    ├─ Sends to: /wp-admin/admin-ajax.php?action=rakubun_webhook
    └─ Headers: X-Rakubun-Signature, X-Instance-ID
    ↓
Plugin: Receives webhook
    ├─ Verifies signature with webhook_secret
    ├─ Processes event
    └─ Clears cache, refreshes data
```

---

## Files Modified

### Created
- ✅ `services/webhookManager.js` (200+ lines)

### Updated
- ✅ `models/ExternalSite.js` (added webhook_secret)
- ✅ `routers/api/external.js` (payment endpoints + webhook_secret in registration)

### Verified
- ✅ `middleware/externalApiMiddleware.js` (already correct)

---

## Key Features

### Authentication ✅
- Bearer token in Authorization header
- X-Instance-ID header validation
- User-Agent check for "Rakubun-WordPress-Plugin"
- HTTPS enforcement

### Security ✅
- HMAC-SHA256 webhook signatures
- 256-bit cryptographic entropy for tokens
- Secure credential storage in MongoDB
- Rate limiting: 100 requests/minute per instance

### Error Handling ✅
- Consistent HTTP status codes
- JSON error responses
- Detailed error messages
- Proper payment failure handling

### Resilience ✅
- Payment verification with Stripe
- Atomic credit transactions
- Webhook retry capability
- Timeout handling (30 seconds)

---

## Testing Commands

### Quick Test 1: Plugin Registration
```bash
curl -X POST http://localhost:3000/api/v1/plugins/register \
  -H "Content-Type: application/json" \
  -d '{
    "instance_id": "test-uuid-123",
    "site_url": "https://example.com",
    "admin_email": "admin@example.com",
    "wordpress_version": "6.0",
    "plugin_version": "2.0.0"
  }'
```

Expected response includes: `api_token`, `instance_id`, `webhook_secret` ✅

### Quick Test 2: Get Credits
```bash
curl -X GET "http://localhost:3000/api/v1/users/credits?user_id=1&user_email=user@example.com" \
  -H "Authorization: Bearer <api_token>" \
  -H "X-Instance-ID: <instance_id>" \
  -H "User-Agent: Rakubun-WordPress-Plugin/2.0"
```

### Quick Test 3: Deduct Credits
```bash
curl -X POST http://localhost:3000/api/v1/users/deduct-credits \
  -H "Authorization: Bearer <api_token>" \
  -H "X-Instance-ID: <instance_id>" \
  -H "Content-Type: application/json" \
  -H "User-Agent: Rakubun-WordPress-Plugin/2.0" \
  -d '{
    "user_id": 1,
    "user_email": "user@example.com",
    "credit_type": "article",
    "amount": 1
  }'
```

### Quick Test 4: Create Payment Intent
```bash
curl -X POST http://localhost:3000/api/v1/payments/create-intent \
  -H "Authorization: Bearer <api_token>" \
  -H "X-Instance-ID: <instance_id>" \
  -H "Content-Type: application/json" \
  -H "User-Agent: Rakubun-WordPress-Plugin/2.0" \
  -d '{
    "user_id": 1,
    "user_email": "user@example.com",
    "credit_type": "article",
    "package_id": "pkg_article_10",
    "amount": 750,
    "currency": "JPY"
  }'
```

Expected response includes: `payment_intent_id`, `client_secret` ✅

---

## Webhook Usage Examples

### In Dashboard Admin/Controller Code

```javascript
// Import the webhook manager
const webhookManager = require('./services/webhookManager');

// Notify all sites that config was updated
await webhookManager.notifyConfigUpdated();

// Notify specific sites
await webhookManager.notifyConfigUpdated(['instance-id-1', 'instance-id-2']);

// Notify about user credit adjustment
await webhookManager.notifyCreditsUpdated(
  'user@example.com',
  10, // article credits
  20, // image credits
  5,  // rewrite credits
  'refund', // reason
  ['instance-id-1'] // optional: specific instances
);

// Disable a plugin instance
await webhookManager.notifyPluginDisabled('Payment overdue', ['instance-id-1']);

// Re-enable a plugin instance
await webhookManager.notifyPluginEnabled(['instance-id-1']);

// Notify about package updates
await webhookManager.notifyPackageUpdated('pkg_article_10');

// Test webhook connectivity
const site = await ExternalSite.findByInstanceId('instance-id');
const result = await webhookManager.sendTestWebhook(site);
console.log(result.success ? 'Webhook works!' : 'Webhook failed');
```

---

## Configuration Needed

### Environment Variables
```bash
# Required for Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLIC_KEY=pk_test_...

# Required for MongoDB
MONGODB_URL=mongodb://...
MONGODB_DATABASE=rakubun

# Optional
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Collections Auto-Created
- `external_sites` (includes webhook_secret)
- `external_users`
- `stripe_payment_intents` (new)
- `credit_packages`
- `credit_transactions`
- `generation_logs`

---

## Verification Checklist

- ✅ All endpoints implemented per spec
- ✅ Payment flow complete (intent → confirm)
- ✅ Webhook system implemented with HMAC signing
- ✅ Plugin registration returns webhook_secret
- ✅ Error handling consistent
- ✅ Rate limiting functional
- ✅ Authentication working
- ✅ Stripe integration ready
- ✅ Documentation complete

---

## What's Next

### For Production
1. Configure Stripe keys in environment
2. Run in staging with plugin
3. Test full payment flow end-to-end
4. Test webhook delivery
5. Deploy to production

### For Dashboard Admin Features
1. Create admin UI for webhook testing
2. Add analytics dashboard
3. Add refund interface
4. Add instance management UI
5. Add plugin monitoring dashboard

### For Monitoring
1. Set up error logging
2. Configure alerts for payment failures
3. Monitor webhook delivery rates
4. Track API response times
5. Monitor database performance

---

## Documentation Files

1. **`DASHBOARD-IMPLEMENTATION.md`** ← You are here  
   Detailed implementation guide

2. **`PLUGIN-DASHBOARD-INTEGRATION.md`**  
   API specification (what plugin expects)

3. **`IMPLEMENTATION-SUMMARY.md`**  
   High-level overview

4. **`IMPLEMENTATION-CHECKLIST.md`**  
   Detailed task checklist

---

## Support

### API Issues
- Check authentication headers (Bearer token, X-Instance-ID)
- Verify User-Agent includes "Rakubun-WordPress-Plugin"
- Check rate limiting (100 req/min)
- Verify HTTPS connection

### Webhook Issues
- Check webhook_secret in database
- Verify plugin webhook endpoint is accessible
- Check HMAC signature verification
- Monitor webhook timeout (30 seconds)

### Payment Issues
- Verify Stripe keys configured
- Check Stripe API connectivity
- Verify payment intent creation
- Confirm payment confirmation flow

---

**Version:** 2.0.0  
**Last Updated:** November 6, 2025  
**Status:** ✅ Ready for Staging
