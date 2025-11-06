# Checkout Session Endpoint Fix

**Date:** November 6, 2025  
**Status:** ✅ IMPLEMENTED  
**Issue:** `/api/v1/checkout/sessions` endpoint was missing

---

## Problem

WordPress plugin calls `POST /api/v1/checkout/sessions` but the endpoint didn't exist, resulting in 404 errors.

### Log Error
```
2025-11-06T00:15:45.948491+00:00 app[web.1]: [HTTPS Redirect] URL: /api/v1/checkout/sessions, MODE: production, Protocol: https
2025-11-06T00:15:45.948849+00:00 app[web.1]: [REQUEST] POST /api/v1/checkout/sessions - User: Not authenticated
```

### Note About "User: Not authenticated"
This message is **NORMAL and NOT an error**. It simply means:
- The request uses **Bearer token authentication** (plugin API auth)
- NOT session-based authentication (`req.user`)
- The logging middleware checks for `req.user` which is `undefined` for API requests
- Authentication is actually handled by `authenticatePlugin` middleware

---

## Solution

Added new endpoint: `POST /api/v1/checkout/sessions`

### Endpoint Details

**Route:** `POST /api/v1/checkout/sessions`  
**Authentication:** ✅ Requires `authenticatePlugin` middleware  
**Purpose:** Create Stripe Checkout Session for WordPress plugin payment flow

### Request Body

```json
{
  "user_id": 123,
  "user_email": "user@example.com",
  "credit_type": "article",
  "package_id": "pkg_article_10",
  "amount": 750,
  "currency": "JPY",
  "return_url": "https://example.com/success",
  "cancel_url": "https://example.com/cancel"
}
```

### Response (Success)

```json
{
  "success": true,
  "session_id": "cs_test_abc123...",
  "url": "https://checkout.stripe.com/pay/cs_test_abc123...",
  "amount": 750,
  "currency": "JPY"
}
```

### Response (Error - Missing Fields)

```json
{
  "success": false,
  "error": "invalid_request",
  "message": "Missing required fields: user_id, user_email, credit_type, package_id, amount"
}
```

**Status Code:** 400

### Response (Error - Stripe Not Configured)

```json
{
  "success": false,
  "error": "payment_not_configured",
  "message": "Payment processing not configured"
}
```

**Status Code:** 500

---

## Implementation Details

### Database Collections

**New Collection:** `stripe_checkout_sessions`

Stores:
- `site_id` - ExternalSite ID
- `user_id` - WordPress user ID
- `user_email` - User email
- `session_id` - Stripe Checkout Session ID
- `package_id` - Credit package ID
- `credit_type` - Type of credits (article/image/rewrite)
- `amount` - Amount in currency
- `currency` - Currency code (JPY, USD, etc.)
- `status` - Session status (pending, completed, expired)
- `created_at` - Creation timestamp
- `expires_at` - Expiration timestamp (24 hours)

### Features

✅ **Full Stripe Integration**
- Creates checkout session via Stripe API
- Stores session info for webhook processing
- 24-hour expiration

✅ **Proper Authentication**
- Requires Bearer token from plugin
- Validates instance ID
- Validates user agent

✅ **Error Handling**
- Validates all required fields
- Validates credit types
- Handles Stripe configuration errors
- Consistent error response format

✅ **Metadata Tracking**
- Stores user information
- Stores site information
- Stores package information
- Enables webhook processing

---

## Plugin Payment Flow

### Sequence Diagram

```
WordPress Plugin (User)
    ↓
1. User clicks "Buy Credits" button
    ↓
2. Plugin calls: POST /api/v1/checkout/sessions
    ↓
3. Dashboard creates Stripe Checkout Session
    ↓
4. Returns: { session_id, url }
    ↓
5. Plugin redirects user to Stripe checkout URL
    ↓
6. User completes payment on Stripe
    ↓
7. Stripe webhook: payment_intent.succeeded
    ↓
8. Dashboard webhook handler confirms payment
    ↓
9. Credits added to user account
    ↓
10. Webhook notifies plugin: credits_updated
```

---

## Related Endpoints

1. **`GET /api/v1/packages`** ✅
   - Public endpoint (no auth required)
   - Returns available credit packages

2. **`POST /api/v1/checkout/sessions`** ✅
   - Creates Stripe checkout session
   - Requires plugin authentication

3. **`POST /api/v1/payments/create-intent`** ✅
   - Alternative payment flow using PaymentIntent
   - For direct integration

4. **`POST /api/v1/payments/confirm`** ✅
   - Confirms payment after user completes it
   - Adds credits to user account

---

## Database Setup

Ensure the `stripe_checkout_sessions` collection exists:

```javascript
// MongoDB collection creation
db.createCollection('stripe_checkout_sessions', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['site_id', 'user_id', 'session_id', 'package_id', 'created_at'],
      properties: {
        site_id: { bsonType: 'objectId' },
        user_id: { bsonType: 'int' },
        user_email: { bsonType: 'string' },
        session_id: { bsonType: 'string' },
        package_id: { bsonType: 'string' },
        credit_type: { bsonType: 'string', enum: ['article', 'image', 'rewrite'] },
        amount: { bsonType: 'number' },
        currency: { bsonType: 'string' },
        status: { bsonType: 'string', enum: ['pending', 'completed', 'expired'] },
        created_at: { bsonType: 'date' },
        expires_at: { bsonType: 'date' }
      }
    }
  }
});

// Create index for expiration
db.stripe_checkout_sessions.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });

// Create index for queries
db.stripe_checkout_sessions.createIndex({ site_id: 1, user_id: 1 });
db.stripe_checkout_sessions.createIndex({ session_id: 1 });
```

---

## Testing

### Manual Test

```bash
# 1. Get API token from plugin registration
curl -X POST https://your-domain/api/v1/plugins/register \
  -H "Content-Type: application/json" \
  -d '{
    "instance_id": "test-uuid",
    "site_url": "https://example.com",
    "admin_email": "admin@example.com",
    "wordpress_version": "6.0",
    "plugin_version": "2.0.0"
  }'

# Response includes api_token

# 2. Create checkout session
curl -X POST https://your-domain/api/v1/checkout/sessions \
  -H "Authorization: Bearer <api_token>" \
  -H "X-Instance-ID: <instance_id>" \
  -H "User-Agent: Rakubun-WordPress-Plugin/2.0" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 123,
    "user_email": "user@example.com",
    "credit_type": "article",
    "package_id": "article_starter",
    "amount": 750,
    "currency": "JPY"
  }'

# Response:
# {
#   "success": true,
#   "session_id": "cs_test_abc123...",
#   "url": "https://checkout.stripe.com/pay/...",
#   "amount": 750,
#   "currency": "JPY"
# }

# 3. User goes to url and completes payment
# 4. Stripe sends webhook to dashboard
# 5. Dashboard confirms and adds credits
```

---

## Files Modified

- **`routers/api/external.js`**
  - Added `POST /api/v1/checkout/sessions` endpoint
  - ~120 lines of code
  - Full error handling
  - Database integration

---

## Environment Variables Required

```bash
# Stripe configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLIC_KEY=pk_test_...

# Dashboard URL (optional, defaults to app.rakubun.com)
DASHBOARD_URL=https://app.rakubun.com

# MongoDB must be configured for database storage
MONGODB_URL=mongodb://...
```

---

## What's Next

1. **Webhook Handler** - Process Stripe webhook events
2. **Session Verification** - Verify session_id on client
3. **Credit Update** - Add credits after payment
4. **Analytics** - Track purchase patterns
5. **Refunds** - Handle refund requests

---

## Status Summary

✅ **Checkout Session Endpoint** - IMPLEMENTED  
✅ **Authentication** - REQUIRED  
✅ **Error Handling** - COMPLETE  
✅ **Database** - READY  
❌ **Webhook Processing** - PENDING  
❌ **Credit Addition** - PENDING  

---

**Last Updated:** November 6, 2025  
**Version:** 1.0.0
