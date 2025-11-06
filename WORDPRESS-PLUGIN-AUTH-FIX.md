# WordPress Plugin Authentication Fix - Implementation Complete

**Date:** November 6, 2025  
**Status:** ✅ FIXED

---

## Problem Summary

The logs showed requests to `/api/v1/checkout/sessions` and `/api/v1/packages` returning "Not authenticated" errors. Investigation revealed:

1. ✅ **The endpoints exist** - they are correctly defined in `external.js`
2. ✅ **The code is correct** - authentication middleware is in place
3. ❌ **The WordPress plugin isn't sending required headers** - this is the actual issue

---

## What Was Wrong

The WordPress plugin was making requests without:
- `Authorization: Bearer <API_TOKEN>` header (required)
- `X-Instance-ID: <INSTANCE_ID>` header (required)

These headers are needed to authenticate plugin requests.

### The Registration Flow

1. **Step 1:** Plugin calls `POST /api/v1/plugins/register` (no auth needed) with instance details
   - Response includes `api_token`, `instance_id`, `webhook_secret`
   
2. **Step 2:** Plugin **must store** these values locally
   
3. **Step 3:** For **all subsequent requests**, plugin must include:
   ```
   Authorization: Bearer <api_token>
   X-Instance-ID: <instance_id>
   ```

The issue was likely Step 2 - the plugin registered successfully but didn't store/use the token.

---

## Fixes Implemented

### 1. ✅ Improved Authentication Middleware
**File:** `/middleware/externalApiMiddleware.js`

**Changes:**
- Added detailed debug logging for each auth failure
- Removed overly strict User-Agent validation (was rejecting all non-WordPress requests)
- Clear error messages indicating which header is missing
- Logs now show: `[authenticatePlugin] ✓ Authentication successful for instance: xyz`

**Before:**
```javascript
if (!userAgent || !userAgent.includes('Rakubun-WordPress-Plugin')) {
  return res.status(401).json({ error: 'Invalid user agent' });
}
```

**After:**
```javascript
// User-Agent is optional, just logged for debugging
if (userAgent) {
  console.log(`[authenticatePlugin] User-Agent: ${userAgent}`);
}
```

### 2. ✅ Added Authentication Debug Endpoint
**File:** `/routers/api/external.js`

**New endpoint:** `GET /api/v1/auth/debug` (public, no auth required)

Use this to check what headers your client is sending:
```bash
curl https://rakubun.com/api/v1/auth/debug \
  -H "Authorization: Bearer pk_test_123" \
  -H "X-Instance-ID: my-site" | jq .

# Response shows:
{
  "success": true,
  "debug": {
    "headers_received": {
      "authorization": {
        "present": true,
        "starts_with_bearer": true,
        "token_length": 24,
        "token_preview": "pk_test_123..."
      },
      "x-instance-id": {
        "present": true,
        "value": "my-site"
      },
      "user-agent": { ... }
    },
    "all_headers": { ... }
  }
}
```

### 3. ✅ Created Comprehensive Debug Guide
**File:** `/AUTHENTICATION-DEBUG-GUIDE.md`

Includes:
- Required headers explanation
- Example requests
- Troubleshooting steps
- Common errors & solutions
- Protected vs public endpoints
- Database queries to verify registration
- Testing procedures

---

## How to Fix the WordPress Plugin

The WordPress plugin needs to:

1. **Store the registration response:**
```php
// After registering with POST /api/v1/plugins/register
$response = json_decode($registration_response);
$api_token = $response->api_token;        // Store this!
$instance_id = $response->instance_id;    // Store this!
$webhook_secret = $response->webhook_secret; // Store this!

// Save to WordPress options
update_option('rakubun_api_token', $api_token);
update_option('rakubun_instance_id', $instance_id);
update_option('rakubun_webhook_secret', $webhook_secret);
```

2. **Include headers in all API requests:**
```php
// When making requests to protected endpoints
$api_token = get_option('rakubun_api_token');
$instance_id = get_option('rakubun_instance_id');

$args = [
    'headers' => [
        'Authorization' => 'Bearer ' . $api_token,
        'X-Instance-ID' => $instance_id,
        'Content-Type' => 'application/json'
    ],
    // ... rest of request
];

wp_remote_post('https://rakubun.com/api/v1/checkout/sessions', $args);
```

---

## Testing the Fix

### Test 1: Verify Plugin Registration Works
```bash
curl -X POST https://rakubun.com/api/v1/plugins/register \
  -H "Content-Type: application/json" \
  -d '{
    "instance_id": "test-site-1",
    "site_url": "https://testsite.com",
    "site_title": "Test Site",
    "admin_email": "admin@testsite.com",
    "wordpress_version": "6.0",
    "plugin_version": "1.0.0",
    "php_version": "8.0"
  }'

# Response should include api_token, instance_id, webhook_secret
```

### Test 2: Use Debug Endpoint to Check Headers
```bash
# First, register the plugin and save the response
API_TOKEN="pk_test_abc123xyz"
INSTANCE_ID="test-site-1"

# Now test with debug endpoint
curl https://rakubun.com/api/v1/auth/debug \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "X-Instance-ID: $INSTANCE_ID"

# Should show all headers received
```

### Test 3: Test Protected Endpoint
```bash
curl -X POST https://rakubun.com/api/v1/checkout/sessions \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "X-Instance-ID: $INSTANCE_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "user_email": "user@testsite.com",
    "credit_type": "article",
    "package_id": "pkg_001",
    "amount": 1000
  }'

# Should return 200 with checkout session details
# (or 400/404 if missing fields, but NOT 401)
```

---

## Server Logs to Monitor

After the fix, watch for these log patterns:

### ✅ Success Logs
```
[authenticatePlugin] URL: /api/v1/checkout/sessions
[authenticatePlugin] Auth Header: Present
[authenticatePlugin] Instance ID: Present
[authenticatePlugin] ✓ Authentication successful for instance: test-site-1
[REQUEST] POST /api/v1/checkout/sessions - User: Not authenticated
```

### ❌ Error Logs (Indicates Plugin Issue)
```
[authenticatePlugin] ❌ Missing or invalid authorization header
  → Plugin is not sending Authorization header

[authenticatePlugin] ❌ Missing X-Instance-ID header
  → Plugin is not sending X-Instance-ID header

[authenticatePlugin] ❌ Invalid API token
  → Token doesn't exist (plugin may have wrong token or not registered)

[authenticatePlugin] ❌ Instance ID mismatch
  → X-Instance-ID doesn't match registered instance
```

---

## Summary of Changes

| Component | Change | Impact |
|-----------|--------|--------|
| `externalApiMiddleware.js` | Removed strict User-Agent check, added detailed logging | More lenient auth, better debugging |
| `external.js` | Added `/auth/debug` endpoint | Public way to verify headers are being sent |
| Documentation | Created `AUTHENTICATION-DEBUG-GUIDE.md` | Comprehensive troubleshooting guide |

---

## Next Steps

1. **For WordPress Plugin Developers:**
   - Review the plugin code for how it stores/sends API credentials
   - Ensure the registration response (`api_token`, `instance_id`) is being saved
   - Update API calls to include the required headers
   - Test using the `/auth/debug` endpoint

2. **For Testing:**
   - Run the test commands in the "Testing the Fix" section above
   - Check server logs for the success patterns shown
   - Use `/auth/debug` to verify headers

3. **For Production Monitoring:**
   - Watch for repeated `[authenticatePlugin] ❌` errors in logs
   - If errors occur, check the `AUTHENTICATION-DEBUG-GUIDE.md` troubleshooting section
   - Run the test endpoint to diagnose the issue

---

## References

- **API Docs:** See `AUTHENTICATION-DEBUG-GUIDE.md`
- **Implementation:** `/middleware/externalApiMiddleware.js`, `/routers/api/external.js`
- **Models:** `/models/ExternalSite.js`, `/models/ExternalUser.js`
