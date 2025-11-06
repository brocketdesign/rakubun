# WordPress Plugin Integration Guide

**For WordPress Plugin Developers**  
**Updated:** November 6, 2025

---

## Quick Start: 3 Steps to Fix Authentication

### Step 1: Register the Plugin
```php
<?php
// On plugin activation or first setup
function rakubun_register_plugin() {
    $response = wp_remote_post('https://rakubun.com/api/v1/plugins/register', [
        'method' => 'POST',
        'headers' => ['Content-Type' => 'application/json'],
        'body' => wp_json_encode([
            'instance_id' => get_option('siteurl'), // Use site URL as unique ID
            'site_url' => get_option('siteurl'),
            'site_title' => get_option('blogname'),
            'admin_email' => get_option('admin_email'),
            'wordpress_version' => get_bloginfo('version'),
            'plugin_version' => RAKUBUN_PLUGIN_VERSION, // Define this
            'php_version' => phpversion(),
            'theme' => wp_get_theme()->get('Name'),
            'timezone' => get_option('timezone_string'),
            'language' => get_bloginfo('language'),
        ])
    ]);

    if (is_wp_error($response)) {
        error_log('Rakubun registration failed: ' . $response->get_error_message());
        return false;
    }

    $body = json_decode(wp_remote_retrieve_body($response), true);
    
    // CRITICAL: Save these values!
    update_option('rakubun_api_token', $body['api_token']);
    update_option('rakubun_instance_id', $body['instance_id']);
    update_option('rakubun_webhook_secret', $body['webhook_secret']);
    update_option('rakubun_registered', true);
    
    error_log('Rakubun plugin registered successfully');
    return true;
}
```

### Step 2: Create a Helper Function for API Calls
```php
<?php
// Helper function to make authenticated API calls
function rakubun_api_call($endpoint, $method = 'GET', $data = []) {
    $api_token = get_option('rakubun_api_token');
    $instance_id = get_option('rakubun_instance_id');
    
    // Check if plugin is registered
    if (!$api_token || !$instance_id) {
        error_log('Rakubun: Plugin not registered. api_token=' . ($api_token ? 'set' : 'missing') . ', instance_id=' . ($instance_id ? 'set' : 'missing'));
        return false;
    }
    
    // Build request
    $args = [
        'method' => $method,
        'headers' => [
            'Authorization' => 'Bearer ' . $api_token,
            'X-Instance-ID' => $instance_id,
            'Content-Type' => 'application/json',
            'User-Agent' => 'Rakubun-WordPress-Plugin/' . RAKUBUN_PLUGIN_VERSION
        ],
        'timeout' => 30
    ];
    
    if (!empty($data) && $method !== 'GET') {
        $args['body'] = wp_json_encode($data);
    }
    
    $url = 'https://rakubun.com' . $endpoint;
    
    // Log request for debugging
    error_log('[Rakubun API] ' . $method . ' ' . $url);
    
    $response = wp_remote_request($url, $args);
    
    if (is_wp_error($response)) {
        error_log('Rakubun API error: ' . $response->get_error_message());
        return false;
    }
    
    $status = wp_remote_retrieve_response_code($response);
    $body = json_decode(wp_remote_retrieve_body($response), true);
    
    if ($status !== 200 && $status !== 201) {
        error_log('Rakubun API error (HTTP ' . $status . '): ' . json_encode($body));
    }
    
    return [
        'status' => $status,
        'body' => $body
    ];
}
```

### Step 3: Use the Helper in Your Plugin
```php
<?php
// Example: Get user credits
function rakubun_get_user_credits($user_id) {
    global $current_user;
    
    if (!$current_user->ID) {
        return false;
    }
    
    $result = rakubun_api_call('/api/v1/users/credits', 'GET', [
        'user_id' => $user_id,
        'user_email' => $current_user->user_email
    ]);
    
    if ($result['status'] === 200) {
        return $result['body']['credits'];
    }
    
    return false;
}

// Example: Create checkout session
function rakubun_create_checkout_session($user_id, $user_email, $package_id) {
    $result = rakubun_api_call('/api/v1/checkout/sessions', 'POST', [
        'user_id' => $user_id,
        'user_email' => $user_email,
        'credit_type' => 'article', // or 'image', 'rewrite'
        'package_id' => $package_id,
        'amount' => 1000, // Amount in currency units
        'currency' => 'JPY',
        'return_url' => admin_url('admin.php?page=rakubun-checkout-success'),
        'cancel_url' => admin_url('admin.php?page=rakubun')
    ]);
    
    if ($result['status'] === 200) {
        return $result['body']['session_id']; // Redirect user to Stripe checkout
    }
    
    return false;
}

// Example: Deduct credits
function rakubun_deduct_credits($user_id, $user_email, $credit_type, $amount = 1) {
    $result = rakubun_api_call('/api/v1/users/deduct-credits', 'POST', [
        'user_id' => $user_id,
        'user_email' => $user_email,
        'credit_type' => $credit_type,
        'amount' => $amount
    ]);
    
    if ($result['status'] === 200) {
        return $result['body']['remaining_credits'];
    }
    
    // Handle insufficient credits
    if ($result['status'] === 402) {
        error_log('Rakubun: Insufficient credits for user ' . $user_id);
        return false;
    }
    
    return false;
}
```

---

## Debugging: Use the Debug Endpoint

If things aren't working, test what headers your plugin is sending:

```php
<?php
// Add this to your plugin for testing
function rakubun_test_auth() {
    $result = rakubun_api_call('/api/v1/auth/debug', 'GET');
    
    echo '<pre>';
    echo 'Headers sent by plugin:' . "\n";
    echo json_encode($result['body'], JSON_PRETTY_PRINT);
    echo '</pre>';
    
    // You should see something like:
    // {
    //   "success": true,
    //   "debug": {
    //     "headers_received": {
    //       "authorization": {
    //         "present": true,
    //         "starts_with_bearer": true,
    //         "token_length": 24,
    //         "token_preview": "pk_test_123..."
    //       },
    //       "x-instance-id": {
    //         "present": true,
    //         "value": "https://myblog.com"
    //       }
    //     }
    //   }
    // }
}
```

---

## Common Issues & Solutions

### Issue: "Invalid API token"
**Cause:** Token not saved after registration  
**Solution:** Verify Step 1 completed successfully. Check WordPress options:
```php
$token = get_option('rakubun_api_token');
if (empty($token)) {
    error_log('Token not saved! Re-run registration.');
}
```

### Issue: "Missing X-Instance-ID header"
**Cause:** Instance ID not included in API call  
**Solution:** The helper function should include it automatically. Check `rakubun_api_call()` has the header.

### Issue: "Site is not active"
**Cause:** Site status in database is not 'active'  
**Solution:** Contact server admin to activate the site, or check admin dashboard.

### Issue: All requests return 401
**Cause:** Headers aren't being sent at all  
**Solution:** 
1. Run `rakubun_test_auth()` to see what headers are received
2. Check that `api_token` and `instance_id` are actually saved in WordPress options
3. Verify registration completed successfully in Step 1

---

## Complete Plugin Skeleton

```php
<?php
/**
 * Plugin Name: Rakubun Content Generator
 * Plugin URI: https://rakubun.com
 * Description: AI-powered content generation for WordPress
 * Version: 1.0.0
 * Author: Your Name
 */

define('RAKUBUN_PLUGIN_VERSION', '1.0.0');

// On activation: Register plugin
register_activation_hook(__FILE__, 'rakubun_activate');
function rakubun_activate() {
    rakubun_register_plugin();
}

// Include the functions
require_once plugin_dir_path(__FILE__) . 'includes/api-functions.php';
require_once plugin_dir_path(__FILE__) . 'includes/admin-page.php';

// Add admin menu
add_action('admin_menu', 'rakubun_add_menu');
function rakubun_add_menu() {
    add_menu_page(
        'Rakubun',
        'Rakubun',
        'manage_options',
        'rakubun',
        'rakubun_admin_page',
        'dashicons-edit'
    );
}

// Show admin page
function rakubun_admin_page() {
    if (!current_user_can('manage_options')) {
        wp_die('Access denied');
    }
    
    if (!get_option('rakubun_registered')) {
        echo '<h2>Rakubun is not registered yet</h2>';
        echo '<button onclick="rakubun_register_plugin()">Activate Plugin</button>';
        return;
    }
    
    echo '<h2>Rakubun Content Generator</h2>';
    echo '<p>Your credits:</p>';
    
    $credits = rakubun_get_user_credits(get_current_user_id());
    if ($credits) {
        echo '<pre>' . json_encode($credits, JSON_PRETTY_PRINT) . '</pre>';
    }
}
```

---

## Deployment Checklist

- [ ] Plugin registration works and returns `api_token`, `instance_id`
- [ ] These values are saved to WordPress options
- [ ] API calls include `Authorization: Bearer <token>` header
- [ ] API calls include `X-Instance-ID: <instance_id>` header
- [ ] Test debug endpoint shows headers are being sent
- [ ] Protected endpoints return 200 (not 401) when called
- [ ] Error handling for 402 (insufficient credits)
- [ ] Error handling for 404 (site not found)
- [ ] Error handling for 500 (server errors)
- [ ] Logging for troubleshooting

---

## Support

If you encounter issues:

1. **Check server logs:**
   ```
   [authenticatePlugin] ✓ Authentication successful for instance: xyz
   ```
   This means the headers are correct!

2. **Use debug endpoint:**
   ```bash
   curl https://rakubun.com/api/v1/auth/debug \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "X-Instance-ID: YOUR_INSTANCE_ID"
   ```

3. **Review the full guide:**
   See `/AUTHENTICATION-DEBUG-GUIDE.md` on the server

4. **Check API documentation:**
   All endpoints are documented with required parameters and responses
