# Dashboard Integration - Configuration Endpoints Quick Reference

**For:** Dashboard API Developers  
**Purpose:** Quick implementation guide for new config endpoints  
**Date:** November 6, 2025

---

## Quick Summary

The plugin now requires 4 new read-only configuration endpoints to support development testing and configuration retrieval:

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/v1/config/article` | GET | Article generation config | ✅ Required |
| `/api/v1/config/image` | GET | Image generation config | ✅ Required |
| `/api/v1/config/rewrite` | GET | Content rewrite config | ✅ Required |
| `/api/v1/config/stripe` | GET | Stripe payment config | ✅ Required |

---

## Endpoint 1: Article Configuration

### Request
```http
GET /api/v1/config/article HTTP/1.1
Host: app.rakubun.com
Authorization: Bearer {api_token}
X-Instance-ID: {instance_id}
User-Agent: Rakubun-WordPress-Plugin/2.0
```

### Response (Success)
```json
{
  "success": true,
  "config": {
    "api_key": "sk_...",
    "model": "gpt-4-turbo",
    "temperature": 0.7,
    "max_tokens": 2000,
    "system_prompt": "You are a professional content writer specialized in SEO..."
  },
  "models": [
    "gpt-4-turbo",
    "gpt-4",
    "gpt-3.5-turbo"
  ]
}
```

### Response (Failure)
```json
{
  "success": false,
  "error": "no_openai_key",
  "message": "OpenAI API key not configured for this instance"
}
```

### Status Codes
- `200 OK` - Configuration retrieved successfully
- `401 Unauthorized` - Invalid API token
- `403 Forbidden` - Instance disabled
- `404 Not Found` - Instance not found
- `500 Internal Server Error` - Server error

---

## Endpoint 2: Image Configuration

### Request
```http
GET /api/v1/config/image HTTP/1.1
Host: app.rakubun.com
Authorization: Bearer {api_token}
X-Instance-ID: {instance_id}
User-Agent: Rakubun-WordPress-Plugin/2.0
```

### Response (Success)
```json
{
  "success": true,
  "config": {
    "api_key": "sk_...",
    "model": "dall-e-3",
    "quality": "hd"
  },
  "models": [
    "dall-e-3",
    "dall-e-2"
  ],
  "sizes": [
    "1024x1024",
    "1024x1792",
    "1792x1024"
  ]
}
```

### Response (Failure)
```json
{
  "success": false,
  "error": "no_openai_key",
  "message": "OpenAI API key not configured for image generation"
}
```

### Status Codes
- `200 OK` - Configuration retrieved successfully
- `401 Unauthorized` - Invalid API token
- `403 Forbidden` - Instance disabled
- `404 Not Found` - Instance not found
- `500 Internal Server Error` - Server error

---

## Endpoint 3: Rewrite Configuration

### Request
```http
GET /api/v1/config/rewrite HTTP/1.1
Host: app.rakubun.com
Authorization: Bearer {api_token}
X-Instance-ID: {instance_id}
User-Agent: Rakubun-WordPress-Plugin/2.0
```

### Response (Success)
```json
{
  "success": true,
  "config": {
    "api_key": "sk_...",
    "model": "gpt-4-turbo",
    "temperature": 0.6,
    "strategies": [
      "improve_seo",
      "simplify",
      "expand",
      "formal_to_casual"
    ]
  },
  "models": [
    "gpt-4-turbo",
    "gpt-4",
    "gpt-3.5-turbo"
  ]
}
```

### Response (Failure)
```json
{
  "success": false,
  "error": "no_openai_key",
  "message": "OpenAI API key not configured for content rewriting"
}
```

### Status Codes
- `200 OK` - Configuration retrieved successfully
- `401 Unauthorized` - Invalid API token
- `403 Forbidden` - Instance disabled
- `404 Not Found` - Instance not found
- `500 Internal Server Error` - Server error

---

## Endpoint 4: Stripe Configuration

### Request
```http
GET /api/v1/config/stripe HTTP/1.1
Host: app.rakubun.com
Authorization: Bearer {api_token}
X-Instance-ID: {instance_id}
User-Agent: Rakubun-WordPress-Plugin/2.0
```

### Response (Success)
```json
{
  "success": true,
  "public_key": "pk_live_...",
  "currency": "JPY",
  "test_mode": false,
  "webhooks_enabled": true
}
```

### Response (Failure)
```json
{
  "success": false,
  "error": "no_stripe_key",
  "message": "Stripe public key not configured"
}
```

### Status Codes
- `200 OK` - Configuration retrieved successfully
- `401 Unauthorized` - Invalid API token
- `403 Forbidden` - Instance disabled
- `404 Not Found` - Instance not found
- `500 Internal Server Error` - Server error

---

## Implementation Checklist

### Required for All Endpoints

- [ ] Authentication: Check Bearer token
- [ ] Header validation: Verify X-Instance-ID
- [ ] Rate limiting: Apply 100 req/min per instance
- [ ] HTTPS only: Enforce secure connection
- [ ] Logging: Log all API access
- [ ] CORS: Set appropriate headers if needed

### Article Configuration Endpoint

- [ ] Query database for article config
- [ ] Verify OpenAI API key exists
- [ ] Get configured model name
- [ ] Get model parameters (temperature, max_tokens)
- [ ] Retrieve system prompt
- [ ] Return list of available models
- [ ] Handle missing configuration gracefully

### Image Configuration Endpoint

- [ ] Query database for image config
- [ ] Verify OpenAI API key exists
- [ ] Get configured DALL-E model
- [ ] Get quality settings
- [ ] Return list of available models
- [ ] Return supported image sizes
- [ ] Handle missing configuration gracefully

### Rewrite Configuration Endpoint

- [ ] Query database for rewrite config
- [ ] Verify OpenAI API key exists
- [ ] Get configured model name
- [ ] Get rewrite strategies
- [ ] Get model parameters (temperature)
- [ ] Return list of available models
- [ ] Handle missing configuration gracefully

### Stripe Configuration Endpoint

- [ ] Query database for Stripe settings
- [ ] Get Stripe public key
- [ ] Get currency setting (usually JPY for Japan)
- [ ] Determine test/live mode
- [ ] Check webhook status
- [ ] Verify key format (starts with pk_)
- [ ] Handle missing Stripe configuration gracefully

---

## Testing Endpoints with cURL

### Test Article Config
```bash
curl -X GET https://app.rakubun.com/api/v1/config/article \
  -H "Authorization: Bearer your_api_token" \
  -H "X-Instance-ID: your_instance_id" \
  -H "User-Agent: Rakubun-WordPress-Plugin/2.0"
```

### Test Image Config
```bash
curl -X GET https://app.rakubun.com/api/v1/config/image \
  -H "Authorization: Bearer your_api_token" \
  -H "X-Instance-ID: your_instance_id" \
  -H "User-Agent: Rakubun-WordPress-Plugin/2.0"
```

### Test Rewrite Config
```bash
curl -X GET https://app.rakubun.com/api/v1/config/rewrite \
  -H "Authorization: Bearer your_api_token" \
  -H "X-Instance-ID: your_instance_id" \
  -H "User-Agent: Rakubun-WordPress-Plugin/2.0"
```

### Test Stripe Config
```bash
curl -X GET https://app.rakubun.com/api/v1/config/stripe \
  -H "Authorization: Bearer your_api_token" \
  -H "X-Instance-ID: your_instance_id" \
  -H "User-Agent: Rakubun-WordPress-Plugin/2.0"
```

---

## Common Error Responses

### 401 Unauthorized
```json
{
  "success": false,
  "error": "unauthorized",
  "message": "Invalid or missing API token"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": "forbidden",
  "message": "This instance has been disabled"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "not_found",
  "message": "Instance not found"
}
```

### 429 Too Many Requests
```json
{
  "success": false,
  "error": "rate_limited",
  "message": "Too many requests. Please retry after 60 seconds."
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "server_error",
  "message": "Internal server error"
}
```

---

## Data Storage Model

### Suggested Database Schema

```javascript
// External Sites Collection
{
  _id: ObjectId,
  instance_id: String,
  site_url: String,
  api_token: String,
  webhook_secret: String,
  
  // Configuration
  article_config: {
    openai_api_key: String (encrypted),
    model: String,
    temperature: Number,
    max_tokens: Number,
    system_prompt: String
  },
  
  image_config: {
    openai_api_key: String (encrypted),
    model: String,
    quality: String
  },
  
  rewrite_config: {
    openai_api_key: String (encrypted),
    model: String,
    temperature: Number,
    strategies: [String]
  },
  
  stripe_config: {
    public_key: String,
    currency: String,
    test_mode: Boolean,
    webhooks_enabled: Boolean
  }
}
```

---

## Performance Considerations

### Caching Strategy

- **Article config:** Cache for 1 hour (or when webhook sent)
- **Image config:** Cache for 1 hour (or when webhook sent)
- **Rewrite config:** Cache for 1 hour (or when webhook sent)
- **Stripe config:** Cache for 24 hours (rarely changes)

### Query Optimization

- Index on `instance_id` for quick lookups
- Index on `api_token` for authentication
- Use projections to return only needed fields

### Response Time Target

- < 200ms for config retrieval
- < 500ms for full response including overhead

---

## Monitoring & Alerts

Monitor these metrics:

- [ ] Config endpoint response times
- [ ] 401 (auth failure) rate
- [ ] 404 (instance not found) rate
- [ ] 5xx error rate
- [ ] Cache hit/miss ratio
- [ ] Rate limiting triggers

Alert on:

- [ ] Response time > 1 second
- [ ] Error rate > 1%
- [ ] Repeated 401 errors from same instance
- [ ] Repeated 404 errors

---

## Support & Questions

For questions about implementation:

1. Check `PLUGIN-DASHBOARD-INTEGRATION.md` for full spec
2. Review `SETTINGS-PAGE-REDESIGN.md` for plugin usage
3. Check test responses in WordPress plugin settings
4. Review this quick reference document

---

**Last Updated:** November 6, 2025  
**Version:** 1.0 - Configuration Endpoints
