# External Dashboard API Documentation
## WordPress Plugin Integration Requirements

This document specifies what the WordPress plugin expects from the external dashboard API, and what the dashboard should implement.

---

## Core Concept

**The Dashboard is the Server. The Plugin is the Client.**

- Dashboard = Authority (single source of truth)
- Plugin = Consumer (requests data from dashboard)
- Communication = REST API over HTTPS
- Authentication = API Token + Instance ID

---

## Plugin Registration

### On Plugin Activation

**Plugin Action:**
```php
$external_api = new Rakubun_AI_External_API();
$external_api->register_plugin();
```

**Expected Dashboard Response:**
```json
{
  "success": true,
  "api_token": "sk_live_4b0f...generated...token",
  "instance_id": "550e8400-e29b-41d4-a716-446655440000",
  "webhook_secret": "whsec_test...for...signature...verification",
  "message": "Plugin registered successfully"
}
```

**What Plugin Does:**
- Stores `api_token` in option: `rakubun_ai_api_token`
- Stores `instance_id` in option: `rakubun_ai_instance_id`
- Stores `webhook_secret` in option: `rakubun_ai_webhook_secret`
- Stores site URL for context
- Enables analytics sync cron

**Dashboard Should:**
- Generate unique API token (500+ chars, use cryptographically secure random)
- Generate webhook secret for HMAC signing
- Store instance information (site URL, admin email, WordPress version, etc.)
- Create webhook endpoint configuration
- Initialize empty credit balances for instance

---

## Credit Management

### 1. Get User Credits

**Plugin Request:**
```php
GET /api/v1/users/credits
  ?user_id=123
  &user_email=user@example.com
  &site_url=https://example.com

Headers:
  Authorization: Bearer {api_token}
  X-Instance-ID: {instance_id}
```

**Dashboard Should:**
- Look up user by user_id + user_email + site_url
- Return current credit balance
- Consider manual adjustments (refunds, bonuses)
- Apply time-based expiration if configured

**Dashboard Response:**
```json
{
  "success": true,
  "credits": {
    "article_credits": 5,
    "image_credits": 10,
    "rewrite_credits": 2
  },
  "last_updated": "2025-11-06T10:00:00Z",
  "expires_at": null
}
```

**Plugin Behavior:**
- Caches response in transient for 5 minutes
- Falls back to local DB if request fails
- Never trusts local DB as source of truth
- Forces fresh fetch after deduction

### 2. Deduct Credits

**Plugin Request (after successful generation):**
```php
POST /api/v1/users/deduct-credits
{
  "user_id": 123,
  "user_email": "user@example.com",
  "site_url": "https://example.com",
  "credit_type": "article",  // or "image" or "rewrite"
  "amount": 1
}

Headers:
  Authorization: Bearer {api_token}
  X-Instance-ID: {instance_id}
```

**Dashboard Should:**
- Verify user has sufficient credits
- Deduct the amount atomically
- Return new remaining balance
- Log transaction
- NOT deduct if insufficient (return error)

**Dashboard Response (Success):**
```json
{
  "success": true,
  "remaining_credits": {
    "article_credits": 4,
    "image_credits": 10,
    "rewrite_credits": 2
  },
  "transaction_id": "txn_1234567890"
}
```

**Dashboard Response (Failure):**
```json
{
  "success": false,
  "error": "insufficient_credits",
  "message": "User has 0 article credits, need 1"
}
```

**Plugin Behavior:**
- If success: Clear credit cache, show remaining
- If failure: Block generation, show error, prompt to buy
- Never deduct locally if dashboard returns error
- Conservative: Deny if unsure

---

## Packages & Pricing

### Get Packages

**Plugin Request:**
```php
GET /api/v1/packages

Headers:
  Authorization: Bearer {api_token}
  X-Instance-ID: {instance_id}
```

**Dashboard Should:**
- Return all active packages globally
- Or return site-specific packages if configured

**Dashboard Response:**
```json
{
  "success": true,
  "packages": {
    "articles": [
      {
        "id": "pkg_article_10",
        "name": "10 Articles",
        "credits": 10,
        "price": 750,
        "currency": "JPY",
        "description": "Perfect for small blogs"
      }
    ],
    "images": [
      {
        "id": "pkg_image_20",
        "name": "20 Images",
        "credits": 20,
        "price": 300,
        "currency": "JPY"
      }
    ],
    "rewrites": [
      {
        "id": "pkg_rewrite_50",
        "name": "50 Rewrites",
        "credits": 50,
        "price": 3000,
        "currency": "JPY"
      }
    ]
  }
}
```

**Plugin Behavior:**
- Caches packages for 1 hour
- Displays in purchase page
- Uses package_id for payment creation

---

## Payment Processing

### 1. Create Payment Intent

**Plugin Request (user clicks "Buy"):**
```php
POST /api/v1/payments/create-intent
{
  "user_id": 123,
  "user_email": "user@example.com",
  "site_url": "https://example.com",
  "credit_type": "article",
  "package_id": "pkg_article_10",
  "amount": 750,
  "currency": "JPY",
  "instance_id": "550e8400-e29b-41d4-a716-446655440000"
}

Headers:
  Authorization: Bearer {api_token}
  X-Instance-ID: {instance_id}
```

**Dashboard Should:**
- Create Stripe PaymentIntent with amount
- Store payment_intent_id for later verification
- Return client_secret for frontend Stripe.js
- Don't add credits yet!

**Dashboard Response:**
```json
{
  "success": true,
  "payment_intent_id": "pi_1234567890abcdef",
  "client_secret": "pi_1234567890abcdef_secret_ghijklmnop",
  "amount": 750,
  "currency": "JPY"
}
```

**Plugin Behavior:**
- Passes `client_secret` to frontend
- Stripe.js confirms payment
- On Stripe success: Plugin calls confirm endpoint

### 2. Confirm Payment

**Plugin Request (after Stripe.js success):**
```php
POST /api/v1/payments/confirm
{
  "payment_intent_id": "pi_1234567890abcdef",
  "user_id": 123,
  "credit_type": "article",
  "site_url": "https://example.com",
  "instance_id": "550e8400-e29b-41d4-a716-446655440000"
}

Headers:
  Authorization: Bearer {api_token}
  X-Instance-ID: {instance_id}
```

**Dashboard Should:**
- Verify payment_intent_id with Stripe
- If Stripe confirms: "succeeded"
  - Add credits to user
  - Log transaction
  - Return success + new balance
- If Stripe says: anything else
  - Return error
  - Don't add credits

**Dashboard Response (Success):**
```json
{
  "success": true,
  "credits_added": 10,
  "transaction_id": "txn_buy_1234567890",
  "remaining_credits": {
    "article_credits": 15,
    "image_credits": 10,
    "rewrite_credits": 2
  }
}
```

**Plugin Behavior:**
- If success: Show "Purchase complete" + new balance
- Clear credit cache
- Log transaction locally too
- If failure: Show error, let user retry

---

## Analytics & Usage Logging

### 1. Log Individual Generation

**Plugin Request (immediately after generation):**
```php
POST /api/v1/analytics/generation
{
  "user_id": 123,
  "user_email": "user@example.com",
  "site_url": "https://example.com",
  "content_type": "article",
  "prompt": "First 500 chars of prompt...",
  "result_length": 1247,
  "credits_used": 1,
  "timestamp": "2025-11-06 10:30:00"
}

Headers:
  Authorization: Bearer {api_token}
  X-Instance-ID: {instance_id}
```

**Note:** Plugin sends this async (non-blocking)

**Dashboard Should:**
- Store generation record
- Use for analytics

**Dashboard Response:**
```json
{
  "success": true
}
```

### 2. Sync Batch Analytics

**Plugin Request (hourly via cron):**
```php
POST /api/v1/analytics/usage
{
  "site_url": "https://example.com",
  "instance_id": "550e8400-e29b-41d4-a716-446655440000",
  "sync_period": {
    "from": "2025-11-06 12:00:00",
    "to": "2025-11-06 13:00:00"
  },
  "generations": [
    {
      "user_id": 1,
      "content_type": "article",
      "prompt": "...",
      "result_length": 1500,
      "created_at": "2025-11-06 12:30:00"
    }
  ],
  "transactions": [
    {
      "user_id": 1,
      "transaction_type": "purchase",
      "credit_type": "article",
      "amount": 10,
      "created_at": "2025-11-06 12:15:00"
    }
  ],
  "total_users": 25,
  "plugin_version": "2.0.0"
}

Headers:
  Authorization: Bearer {api_token}
  X-Instance-ID: {instance_id}
```

**Dashboard Should:**
- Store batch data
- Aggregate for analytics
- Track usage trends
- Monitor revenue

**Dashboard Response:**
```json
{
  "success": true,
  "records_stored": 147
}
```

---

## Webhooks

### Webhook Format

**Dashboard sends to plugin:**
```
POST https://example.com/wp-admin/admin-ajax.php?action=rakubun_webhook

Headers:
  X-Rakubun-Signature: hmac-sha256 signature
  Content-Type: application/json

Body:
{
  "event": "config_updated",  // Event type
  "timestamp": "2025-11-06T10:00:00Z",
  "data": {
    // Event-specific data
  }
}
```

**Signature Verification:**
```php
$secret = get_option('rakubun_ai_webhook_secret');
$payload = file_get_contents('php://input');
$hash = hash_hmac('sha256', $payload, $secret);
// Plugin verifies: hash_equals($hash, $signature_from_header)
```

### Webhook Events

#### 1. config_updated
**Dashboard:** Admin updated configuration

**Payload:**
```json
{
  "event": "config_updated",
  "data": {
    "config_type": "openai",
    "changes": ["api_key", "model_article"]
  }
}
```

**Plugin Action:**
```php
delete_transient('rakubun_ai_openai_config_cache');
// Next request fetches fresh config from dashboard
```

#### 2. credits_updated
**Dashboard:** User credits manually adjusted

**Payload:**
```json
{
  "event": "credits_updated",
  "data": {
    "user_email": "user@example.com",
    "article_credits": 10,
    "reason": "refund"
  }
}
```

**Plugin Action:**
```php
$user = get_user_by('email', 'user@example.com');
delete_transient('rakubun_ai_credits_' . $user->ID);
// Next credit check fetches from dashboard
```

#### 3. plugin_disabled
**Dashboard:** Admin disabled this plugin instance

**Payload:**
```json
{
  "event": "plugin_disabled",
  "data": {
    "reason": "Payment overdue"
  }
}
```

**Plugin Action:**
```php
update_option('rakubun_ai_status', 'disabled');
// Generation requests blocked, show message
```

#### 4. plugin_enabled
**Dashboard:** Admin re-enabled plugin

**Payload:**
```json
{
  "event": "plugin_enabled",
  "data": {}
}
```

**Plugin Action:**
```php
update_option('rakubun_ai_status', 'enabled');
// Resume normal operation
```

#### 5. package_updated
**Dashboard:** Admin updated packages/pricing

**Payload:**
```json
{
  "event": "package_updated",
  "data": {
    "package_id": "pkg_article_10"
  }
}
```

**Plugin Action:**
```php
delete_transient('rakubun_ai_packages_cache');
// Next package fetch gets updated prices
```

---

## Error Codes

### HTTP Status Codes

| Code | Meaning | Plugin Action |
|------|---------|---|
| 200 | Success | Process response |
| 400 | Bad request | Log error, retry later |
| 401 | Unauthorized | Invalid token, re-register |
| 403 | Forbidden | Instance disabled by admin |
| 404 | Not found | Resource doesn't exist |
| 429 | Rate limited | Backoff and retry |
| 500 | Server error | Fallback to local DB |

### Response Error Format

```json
{
  "success": false,
  "error": "error_code",
  "message": "Human readable message"
}
```

---

## Security Requirements

### 1. API Token
- Minimum 256 bits entropy
- Rotatable by admin
- Expires if unused for 90 days (optional)
- Logged for audit trail

### 2. Webhook Signature
- HMAC-SHA256
- Secret shared during registration
- Checked on every webhook delivery

### 3. Rate Limiting
- 100 requests per minute per plugin instance
- Per-endpoint limits if needed

### 4. HTTPS Enforcement
- All communication must be HTTPS
- Certificate verification
- No HTTP fallback

### 5. Data Protection
- Encrypt sensitive data (API keys) at rest
- GDPR compliance for EU users
- Data retention policies

---

## Monitoring & Alerts

Dashboard should track:

- Plugin connectivity (last successful request)
- Failed deduction attempts
- Suspicious activity (rapid purchases, etc.)
- Payment failures
- High credit balances

And provide:
- Connection status dashboard
- Usage statistics
- Revenue reports
- Alert configuration

---

## Implementation Checklist

### Phase 1: Registration & Auth
- [ ] Generate API tokens securely
- [ ] Store instance information
- [ ] Generate webhook secrets
- [ ] Return credentials to plugin

### Phase 2: Credit Management
- [ ] Implement get_credits endpoint
- [ ] Implement deduct_credits endpoint
- [ ] Track credit balances
- [ ] Log all transactions

### Phase 3: Packages & Payments
- [ ] Define package management
- [ ] Stripe integration
- [ ] Payment intent creation
- [ ] Payment confirmation
- [ ] Credit addition on success

### Phase 4: Analytics
- [ ] Store generation logs
- [ ] Store transaction history
- [ ] Batch sync endpoint
- [ ] Analytics dashboard

### Phase 5: Webhooks
- [ ] Webhook endpoint
- [ ] Signature verification
- [ ] Event routing
- [ ] Delivery retry logic

### Phase 6: Monitoring
- [ ] Connection status tracking
- [ ] Error alerting
- [ ] Usage monitoring
- [ ] Admin dashboards

---

## Testing

### Test Endpoints

Use these for development/testing:

```
POST /api/v1/plugins/register
POST /api/v1/users/credits (test user)
POST /api/v1/users/deduct-credits (test deduction)
GET  /api/v1/packages
POST /api/v1/payments/create-intent (test mode)
POST /api/v1/payments/confirm (test mode)
```

### Test Webhook

```bash
curl -X POST https://app.rakubun.com/webhook/test \
  -H "X-Instance-ID: {instance_id}" \
  -H "Authorization: Bearer {api_token}" \
  -d '{"event": "test_webhook"}'
```

---

## References

- **Plugin Code:** `class-rakubun-ai-external-api.php`
- **Webhook Handler:** `class-rakubun-ai-webhook-handler.php`
- **Main Plugin:** `rakubun-ai-content-generator.php`

---

**Last Updated:** November 6, 2025
**Version:** 2.0 API Spec
