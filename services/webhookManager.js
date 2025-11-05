const axios = require('axios');
const crypto = require('crypto');

/**
 * Webhook Manager for sending webhooks to plugin instances
 * Handles HMAC-SHA256 signature verification
 */

/**
 * Send webhook to a plugin instance
 * @param {Object} site - The ExternalSite object with webhook_secret
 * @param {String} event - The event type (config_updated, credits_updated, etc.)
 * @param {Object} data - The event data payload
 * @returns {Promise}
 */
async function sendWebhook(site, event, data) {
  try {
    if (!site.webhook_secret) {
      console.error(`[Webhook] No webhook secret for site ${site.instance_id}`);
      return {
        success: false,
        error: 'No webhook secret configured'
      };
    }

    // Build webhook URL - append to WordPress admin-ajax endpoint
    const webhookUrl = new URL(site.site_url);
    webhookUrl.pathname = '/wp-admin/admin-ajax.php';
    webhookUrl.search = 'action=rakubun_webhook';

    // Build payload
    const payload = {
      event: event,
      timestamp: new Date().toISOString(),
      data: data
    };

    const payloadJson = JSON.stringify(payload);

    // Generate HMAC-SHA256 signature
    const signature = crypto
      .createHmac('sha256', site.webhook_secret)
      .update(payloadJson)
      .digest('hex');

    // Send webhook
    const response = await axios.post(webhookUrl.toString(), payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Rakubun-Signature': `sha256=${signature}`,
        'X-Instance-ID': site.instance_id,
        'User-Agent': 'Rakubun-Dashboard/1.0'
      },
      timeout: 30000, // 30 second timeout
      validateStatus: () => true // Don't throw on any status code
    });

    console.log(
      `[Webhook] Event: ${event}, Site: ${site.instance_id}, Status: ${response.status}`
    );

    return {
      success: response.status >= 200 && response.status < 300,
      status: response.status,
      response: response.data
    };

  } catch (error) {
    console.error(
      `[Webhook] Error sending to ${site.instance_id}:`,
      error.message
    );
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Send webhook to all sites or specific sites
 * @param {String} event - The event type
 * @param {Object} data - The event data
 * @param {Array} instanceIds - (Optional) List of instance IDs to send to. If empty, send to all.
 * @returns {Promise}
 */
async function broadcastWebhook(event, data, instanceIds = []) {
  try {
    const db = global.db;
    const sitesCollection = db.collection('external_sites');

    // Build query
    let query = { status: 'active' };
    if (instanceIds && instanceIds.length > 0) {
      query.instance_id = { $in: instanceIds };
    }

    // Get all sites
    const sites = await sitesCollection.find(query).toArray();

    console.log(
      `[Webhook] Broadcasting '${event}' to ${sites.length} site(s)`
    );

    // Send webhooks in parallel
    const results = await Promise.allSettled(
      sites.map(site => sendWebhook(site, event, data))
    );

    // Count successes and failures
    let successCount = 0;
    let failureCount = 0;

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        successCount++;
      } else {
        failureCount++;
        console.error(
          `[Webhook] Failed for site ${sites[index]?.instance_id}:`,
          result.reason || result.value?.error
        );
      }
    });

    console.log(
      `[Webhook] Broadcast complete - Success: ${successCount}, Failed: ${failureCount}`
    );

    return {
      success: true,
      total: sites.length,
      successful: successCount,
      failed: failureCount,
      results: results
    };

  } catch (error) {
    console.error('[Webhook] Broadcast error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Send config_updated webhook
 * Updates plugin configuration cache
 */
async function notifyConfigUpdated(instanceIds = []) {
  return await broadcastWebhook(
    'config_updated',
    {
      config_type: 'openai',
      changes: ['api_key', 'model_article', 'model_image']
    },
    instanceIds
  );
}

/**
 * Send credits_updated webhook
 * Notifies plugin about user credit changes
 */
async function notifyCreditsUpdated(userEmail, articleCredits, imageCredits, rewriteCredits, reason = 'manual_adjustment', instanceIds = []) {
  return await broadcastWebhook(
    'credits_updated',
    {
      user_email: userEmail,
      article_credits: articleCredits,
      image_credits: imageCredits,
      rewrite_credits: rewriteCredits,
      reason: reason
    },
    instanceIds
  );
}

/**
 * Send plugin_disabled webhook
 * Disables plugin instance on all sites or specific sites
 */
async function notifyPluginDisabled(reason = 'admin_action', instanceIds = []) {
  return await broadcastWebhook(
    'plugin_disabled',
    {
      reason: reason
    },
    instanceIds
  );
}

/**
 * Send plugin_enabled webhook
 * Re-enables plugin instance
 */
async function notifyPluginEnabled(instanceIds = []) {
  return await broadcastWebhook(
    'plugin_enabled',
    {},
    instanceIds
  );
}

/**
 * Send package_updated webhook
 * Notifies about package/pricing changes
 */
async function notifyPackageUpdated(packageId = null, instanceIds = []) {
  return await broadcastWebhook(
    'package_updated',
    {
      package_id: packageId
    },
    instanceIds
  );
}

/**
 * Send test_webhook for testing connectivity
 */
async function sendTestWebhook(site) {
  return await sendWebhook(site, 'test_webhook', {
    test_data: 'This is a test webhook',
    timestamp: new Date().toISOString()
  });
}

module.exports = {
  sendWebhook,
  broadcastWebhook,
  notifyConfigUpdated,
  notifyCreditsUpdated,
  notifyPluginDisabled,
  notifyPluginEnabled,
  notifyPackageUpdated,
  sendTestWebhook
};
