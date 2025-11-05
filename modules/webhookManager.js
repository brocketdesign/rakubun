const crypto = require('crypto');

class WebhookManager {
  constructor() {
    this.webhooks = new Map();
    this.secretKey = process.env.WEBHOOK_SECRET || 'default-webhook-secret';
  }

  /**
   * Register a webhook for a site
   */
  registerWebhook(siteId, webhookUrl, events = []) {
    this.webhooks.set(siteId, {
      url: webhookUrl,
      events: events,
      secret: this.generateSecret(),
      active: true,
      created_at: new Date()
    });
  }

  /**
   * Generate webhook secret
   */
  generateSecret() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create webhook signature
   */
  createSignature(payload, secret) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return 'sha256=' + hmac.digest('hex');
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload, signature, secret) {
    const expectedSignature = this.createSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Send webhook to site
   */
  async sendWebhook(siteId, event, data = {}) {
    const webhook = this.webhooks.get(siteId);
    
    if (!webhook || !webhook.active) {
      console.log(`No active webhook found for site ${siteId}`);
      return false;
    }

    if (webhook.events.length > 0 && !webhook.events.includes(event)) {
      console.log(`Event ${event} not registered for site ${siteId}`);
      return false;
    }

    const payload = {
      event,
      site_id: siteId,
      timestamp: new Date().toISOString(),
      data
    };

    const signature = this.createSignature(payload, webhook.secret);

    try {
      const fetch = require('node-fetch');
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': event,
          'User-Agent': 'Rakubun-Webhook/1.0'
        },
        body: JSON.stringify(payload),
        timeout: 10000 // 10 seconds timeout
      });

      if (response.ok) {
        console.log(`Webhook sent successfully to site ${siteId} for event ${event}`);
        return true;
      } else {
        console.error(`Webhook failed for site ${siteId}: ${response.status} ${response.statusText}`);
        return false;
      }
    } catch (error) {
      console.error(`Webhook error for site ${siteId}:`, error);
      return false;
    }
  }

  /**
   * Send config updated webhook
   */
  async notifyConfigUpdated(siteId, configType, changes = []) {
    return await this.sendWebhook(siteId, 'config_updated', {
      config_type: configType,
      changes
    });
  }

  /**
   * Send credits updated webhook
   */
  async notifyCreditsUpdated(siteId, userId, creditType, newBalance) {
    return await this.sendWebhook(siteId, 'credits_updated', {
      user_id: userId,
      credit_type: creditType,
      new_balance: newBalance
    });
  }

  /**
   * Send plugin disabled webhook
   */
  async notifyPluginDisabled(siteId, reason = null) {
    return await this.sendWebhook(siteId, 'plugin_disabled', {
      reason
    });
  }

  /**
   * Send plugin enabled webhook
   */
  async notifyPluginEnabled(siteId) {
    return await this.sendWebhook(siteId, 'plugin_enabled', {});
  }

  /**
   * Send package updated webhook
   */
  async notifyPackageUpdated(siteId, packageId) {
    return await this.sendWebhook(siteId, 'package_updated', {
      package_id: packageId
    });
  }

  /**
   * Broadcast webhook to all sites
   */
  async broadcastWebhook(event, data = {}) {
    const promises = [];
    
    for (const [siteId, webhook] of this.webhooks) {
      if (webhook.active) {
        promises.push(this.sendWebhook(siteId, event, data));
      }
    }

    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
    
    console.log(`Broadcast webhook ${event}: ${successful}/${results.length} successful`);
    return { successful, total: results.length };
  }

  /**
   * Get webhook status for a site
   */
  getWebhookStatus(siteId) {
    return this.webhooks.get(siteId) || null;
  }

  /**
   * Update webhook configuration
   */
  updateWebhook(siteId, updates) {
    const webhook = this.webhooks.get(siteId);
    if (webhook) {
      Object.assign(webhook, updates);
      webhook.updated_at = new Date();
      this.webhooks.set(siteId, webhook);
      return true;
    }
    return false;
  }

  /**
   * Remove webhook
   */
  removeWebhook(siteId) {
    return this.webhooks.delete(siteId);
  }

  /**
   * Get all webhooks
   */
  getAllWebhooks() {
    return Array.from(this.webhooks.entries()).map(([siteId, webhook]) => ({
      site_id: siteId,
      ...webhook
    }));
  }
}

// Create singleton instance
const webhookManager = new WebhookManager();

module.exports = webhookManager;