// External Dashboard JavaScript
class ExternalDashboard {
  constructor() {
    this.currentPage = {
      sites: 1,
      users: 1
    };
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadStats();
    this.loadSites();
    this.loadUsers();
    this.loadPackages();
    this.loadConfig();
    this.loadAnalytics();
  }

  bindEvents() {
    // Refresh button
    document.getElementById('refreshData').addEventListener('click', () => {
      this.loadStats();
      this.loadCurrentTab();
    });

    // Tab changes
    document.querySelectorAll('#dashboardTabs a[data-bs-toggle="tab"]').forEach(tab => {
      tab.addEventListener('shown.bs.tab', (e) => {
        const target = e.target.getAttribute('href').substring(1);
        this.loadCurrentTab(target);
      });
    });

    // Search functionality
    document.getElementById('searchSites').addEventListener('click', () => this.searchSites());
    document.getElementById('siteSearch').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.searchSites();
    });

    document.getElementById('searchUsers').addEventListener('click', () => this.searchUsers());
    document.getElementById('userSearch').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.searchUsers();
    });

    // Forms
    document.getElementById('packageForm').addEventListener('submit', (e) => this.savePackage(e));
    document.getElementById('userCreditsForm').addEventListener('submit', (e) => this.updateUserCredits(e));
    document.getElementById('openaiConfigForm').addEventListener('submit', (e) => this.saveOpenAIConfig(e));
    document.getElementById('stripeConfigForm').addEventListener('submit', (e) => this.saveStripeConfig(e));

    // Seed data
    document.getElementById('executeSeed').addEventListener('click', () => this.seedData());

    // Test config
    document.getElementById('testConfig').addEventListener('click', () => this.testOpenAIConfig());
    document.getElementById('testStripeConnection').addEventListener('click', () => this.testStripeConnection());
    document.getElementById('viewStripeWebhooks').addEventListener('click', () => this.viewStripeWebhooks());
  }

  loadCurrentTab(tab = null) {
    if (!tab) {
      tab = document.querySelector('#dashboardTabs .nav-link.active').getAttribute('href').substring(1);
    }

    switch (tab) {
      case 'sites':
        this.loadSites();
        break;
      case 'users':
        this.loadUsers();
        break;
      case 'packages':
        this.loadPackages();
        break;
      case 'config':
        this.loadConfig();
        break;
      case 'analytics':
        this.loadAnalytics();
        break;
    }
  }

  async loadStats() {
    try {
      const response = await fetch('/api/v1/admin/stats');
      const data = await response.json();

      if (data.success) {
        document.getElementById('totalSites').textContent = data.stats.total_sites;
        document.getElementById('totalUsers').textContent = data.stats.total_users;
        document.getElementById('generationsToday').textContent = data.stats.generations_today;
        document.getElementById('creditsToday').textContent = data.stats.credits_used_today;
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  async loadSites(page = 1, search = '') {
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (search) params.append('search', search);

      const response = await fetch(`/api/v1/admin/sites?${params}`);
      const data = await response.json();

      if (data.success) {
        this.renderSitesTable(data.sites);
        this.renderPagination('sites', data.pagination);
      }
    } catch (error) {
      console.error('Error loading sites:', error);
    }
  }

  renderSitesTable(sites) {
    const tbody = document.querySelector('#sitesTable tbody');
    
    if (sites.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center">No sites found</td></tr>';
      return;
    }

    tbody.innerHTML = sites.map(site => `
      <tr>
        <td>${site.site_title || 'N/A'}</td>
        <td><a href="${site.site_url}" target="_blank">${site.site_url}</a></td>
        <td>${site.admin_email}</td>
        <td><span class="badge bg-info">${site.user_count}</span></td>
        <td><span class="badge bg-${site.status === 'active' ? 'success' : 'danger'}">${site.status}</span></td>
        <td>${site.last_activity ? new Date(site.last_activity).toLocaleDateString() : 'Never'}</td>
        <td>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-primary" onclick="dashboard.viewSiteDetails('${site._id}')">
              <i class="fas fa-eye"></i>
            </button>
            <button class="btn btn-outline-warning" onclick="dashboard.editSite('${site._id}')">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-outline-danger" onclick="dashboard.deleteSite('${site._id}')">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  async loadUsers(page = 1, search = '', siteId = '') {
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (search) params.append('search', search);
      if (siteId) params.append('site_id', siteId);

      const response = await fetch(`/api/v1/admin/users?${params}`);
      const data = await response.json();

      if (data.success) {
        this.renderUsersTable(data.users);
        this.renderPagination('users', data.pagination);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  }

  renderUsersTable(users) {
    const tbody = document.querySelector('#usersTable tbody');
    
    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center">No users found</td></tr>';
      return;
    }

    tbody.innerHTML = users.map(user => `
      <tr>
        <td>${user.user_email}</td>
        <td>${user.site.site_title}</td>
        <td><span class="badge bg-primary">${user.article_credits}</span></td>
        <td><span class="badge bg-success">${user.image_credits}</span></td>
        <td><span class="badge bg-info">${user.rewrite_credits}</span></td>
        <td>${user.total_articles_generated + user.total_images_generated + user.total_rewrites_generated}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary" onclick="dashboard.manageUserCredits('${user.site_id}', '${user.user_id}', '${user.user_email}', '${user.site.site_title}')">
            <i class="fas fa-coins"></i> Manage Credits
          </button>
        </td>
      </tr>
    `).join('');
  }

  async loadPackages() {
    try {
      const response = await fetch('/api/v1/admin/packages');
      const data = await response.json();

      if (data.success) {
        this.renderPackagesTable(data.packages);
      }
    } catch (error) {
      console.error('Error loading packages:', error);
    }
  }

  renderPackagesTable(packages) {
    const tbody = document.querySelector('#packagesTable tbody');
    
    if (packages.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center">No packages found</td></tr>';
      return;
    }

    tbody.innerHTML = packages.map(pkg => `
      <tr>
        <td><code>${pkg.package_id}</code></td>
        <td>${pkg.name}</td>
        <td><span class="badge bg-secondary">${pkg.credit_type}</span></td>
        <td>${pkg.credits}</td>
        <td>¥${pkg.price}</td>
        <td>${pkg.is_popular ? '<span class="badge bg-warning">Popular</span>' : ''}</td>
        <td><span class="badge bg-${pkg.is_active ? 'success' : 'danger'}">${pkg.is_active ? 'Active' : 'Inactive'}</span></td>
        <td>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-primary" onclick="dashboard.editPackage('${pkg._id}')">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-outline-danger" onclick="dashboard.deletePackage('${pkg._id}')">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  async loadConfig() {
    try {
      // Load OpenAI config
      const response = await fetch('/api/v1/admin/config/openai');
      const data = await response.json();

      if (data.success && data.configs.length > 0) {
        const globalConfig = data.configs.find(c => !c.site);
        if (globalConfig) {
          document.getElementById('modelArticle').value = globalConfig.model_article || 'gpt-4';
          document.getElementById('modelImage').value = globalConfig.model_image || 'dall-e-3';
          document.getElementById('maxTokens').value = globalConfig.max_tokens || 2000;
          document.getElementById('temperature').value = globalConfig.temperature || 0.7;
        }
      }

      // Load Stripe config
      const stripeResponse = await fetch('/api/v1/admin/config/stripe');
      const stripeData = await stripeResponse.json();

      if (stripeData.success && stripeData.config) {
        document.getElementById('stripePublishableKey').value = stripeData.config.publishable_key || '';
        document.getElementById('stripeSecretKey').value = stripeData.config.secret_key || '';
        document.getElementById('stripeWebhookSecret').value = stripeData.config.webhook_secret || '';
        document.getElementById('defaultCurrency').value = stripeData.config.default_currency || 'jpy';
        document.getElementById('stripeMode').value = stripeData.config.mode || 'test';
        document.getElementById('stripeFeePercentage').value = stripeData.config.fee_percentage || 0;
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  }

  async loadAnalytics() {
    try {
      const response = await fetch('/api/v1/admin/stats');
      const data = await response.json();

      if (data.success) {
        this.renderRecentActivity(data.stats.recent_activity);
        this.renderTopSites(data.stats.top_sites);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  }

  renderRecentActivity(activities) {
    const container = document.getElementById('recentActivity');
    
    if (!activities || activities.length === 0) {
      container.innerHTML = '<p class="text-muted">No recent activity</p>';
      return;
    }

    container.innerHTML = activities.map(activity => `
      <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
        <div>
          <small class="text-muted">${new Date(activity.created_at).toLocaleString()}</small>
          <br>
          <span class="badge bg-${activity.content_type === 'article' ? 'primary' : activity.content_type === 'image' ? 'success' : 'info'}">${activity.content_type}</span>
          ${activity.site.site_title}
        </div>
        <div class="text-end">
          <small class="text-muted">${activity.user?.user_email || 'Unknown'}</small>
        </div>
      </div>
    `).join('');
  }

  renderTopSites(sites) {
    const container = document.getElementById('topSites');
    
    if (!sites || sites.length === 0) {
      container.innerHTML = '<p class="text-muted">No data available</p>';
      return;
    }

    container.innerHTML = sites.map((site, index) => `
      <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
        <div>
          <span class="badge bg-primary me-2">#${index + 1}</span>
          ${site.site.site_title}
          <br>
          <small class="text-muted">${site.site.site_url}</small>
        </div>
        <div class="text-end">
          <strong>${site.total_generations}</strong> generations
          <br>
          <small class="text-muted">${site.total_credits} credits</small>
        </div>
      </div>
    `).join('');
  }

  // Event handlers
  searchSites() {
    const search = document.getElementById('siteSearch').value;
    this.loadSites(1, search);
  }

  searchUsers() {
    const search = document.getElementById('userSearch').value;
    const siteId = document.getElementById('siteFilter').value;
    this.loadUsers(1, search, siteId);
  }

  async savePackage(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const packageData = Object.fromEntries(formData);
    
    // Convert checkboxes
    packageData.is_popular = document.getElementById('isPopular').checked;
    packageData.is_active = document.getElementById('isActive').checked;
    
    try {
      const isEdit = document.getElementById('packageId').value;
      const url = isEdit ? `/api/v1/admin/packages/${isEdit}` : '/api/v1/admin/packages';
      const method = isEdit ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(packageData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        bootstrap.Modal.getInstance(document.getElementById('packageModal')).hide();
        this.loadPackages();
        this.showAlert('Package saved successfully', 'success');
      } else {
        this.showAlert(data.error, 'danger');
      }
    } catch (error) {
      this.showAlert('Error saving package', 'danger');
    }
  }

  async updateUserCredits(e) {
    e.preventDefault();
    
    const siteId = document.getElementById('userSiteId').value;
    const userId = document.getElementById('userIdInput').value;
    const creditType = document.getElementById('creditTypeSelect').value;
    const amount = parseInt(document.getElementById('creditAmount').value);
    const operation = document.querySelector('input[name="operation"]:checked').value;
    
    try {
      const response = await fetch(`/api/v1/admin/users/${siteId}/${userId}/credits`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credit_type: creditType, amount, operation })
      });
      
      const data = await response.json();
      
      if (data.success) {
        bootstrap.Modal.getInstance(document.getElementById('userCreditsModal')).hide();
        this.loadUsers();
        this.showAlert('Credits updated successfully', 'success');
      } else {
        this.showAlert(data.error, 'danger');
      }
    } catch (error) {
      this.showAlert('Error updating credits', 'danger');
    }
  }

  async saveOpenAIConfig(e) {
    e.preventDefault();
    
    const configData = {
      api_key: document.getElementById('apiKey').value,
      model_article: document.getElementById('modelArticle').value,
      model_image: document.getElementById('modelImage').value,
      max_tokens: parseInt(document.getElementById('maxTokens').value),
      temperature: parseFloat(document.getElementById('temperature').value)
    };
    
    try {
      const response = await fetch('/api/v1/admin/config/openai/global', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.showAlert('Configuration saved successfully', 'success');
      } else {
        this.showAlert(data.error, 'danger');
      }
    } catch (error) {
      this.showAlert('Error saving configuration', 'danger');
    }
  }

  async saveStripeConfig(e) {
    e.preventDefault();
    
    const configData = {
      publishable_key: document.getElementById('stripePublishableKey').value,
      secret_key: document.getElementById('stripeSecretKey').value,
      webhook_secret: document.getElementById('stripeWebhookSecret').value,
      default_currency: document.getElementById('defaultCurrency').value,
      mode: document.getElementById('stripeMode').value,
      fee_percentage: parseFloat(document.getElementById('stripeFeePercentage').value) || 0
    };
    
    // Validate required fields
    if (!configData.publishable_key || !configData.secret_key || !configData.webhook_secret) {
      this.showAlert('All Stripe keys are required', 'warning');
      return;
    }
    
    try {
      const response = await fetch('/api/v1/admin/config/stripe', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.showAlert('Stripe configuration saved successfully', 'success');
        // Reload config to confirm changes
        setTimeout(() => this.loadConfig(), 1000);
      } else {
        this.showAlert(data.error || 'Error saving Stripe configuration', 'danger');
      }
    } catch (error) {
      console.error('Error saving Stripe config:', error);
      this.showAlert('Error saving Stripe configuration', 'danger');
    }
  }

  async testStripeConnection() {
    try {
      const response = await fetch('/api/v1/admin/config/stripe/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.showAlert('✓ Stripe connection successful!', 'success');
      } else {
        this.showAlert('✗ Stripe connection failed: ' + (data.error || 'Unknown error'), 'danger');
      }
    } catch (error) {
      console.error('Error testing Stripe connection:', error);
      this.showAlert('Error testing Stripe connection', 'danger');
    }
  }

  async viewStripeWebhooks() {
    try {
      const response = await fetch('/api/v1/admin/config/stripe/webhooks', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Show webhooks in a modal or alert
        const webhooks = data.webhooks || [];
        if (webhooks.length === 0) {
          this.showAlert('No Stripe webhooks configured', 'info');
        } else {
          let webhookList = 'Configured Stripe Webhooks:\n\n';
          webhooks.forEach((webhook, index) => {
            webhookList += `${index + 1}. ${webhook.url}\n   Events: ${webhook.events?.join(', ') || 'N/A'}\n   Status: ${webhook.enabled_events ? 'Active' : 'Inactive'}\n\n`;
          });
          alert(webhookList);
        }
      } else {
        this.showAlert('Error fetching webhooks: ' + (data.error || 'Unknown error'), 'danger');
      }
    } catch (error) {
      console.error('Error fetching webhooks:', error);
      this.showAlert('Error fetching Stripe webhooks', 'danger');
    }
  }

  async seedData() {
    try {
      const response = await fetch('/api/v1/admin/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packages: document.getElementById('seedPackages').checked,
          config: document.getElementById('seedConfig').checked
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        bootstrap.Modal.getInstance(document.getElementById('seedDataModal')).hide();
        this.loadPackages();
        this.loadConfig();
        this.showAlert('Data seeded successfully', 'success');
      } else {
        this.showAlert(data.error, 'danger');
      }
    } catch (error) {
      this.showAlert('Error seeding data', 'danger');
    }
  }

  manageUserCredits(siteId, userId, userEmail, siteTitle) {
    document.getElementById('userSiteId').value = siteId;
    document.getElementById('userIdInput').value = userId;
    document.getElementById('userEmail').textContent = userEmail;
    document.getElementById('userSite').textContent = siteTitle;
    
    const modal = new bootstrap.Modal(document.getElementById('userCreditsModal'));
    modal.show();
  }

  showAlert(message, type = 'info') {
    // Create and show bootstrap alert
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    alertDiv.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
      if (alertDiv.parentNode) {
        alertDiv.parentNode.removeChild(alertDiv);
      }
    }, 5000);
  }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.dashboard = new ExternalDashboard();
});