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
    document.getElementById('providerConfigForm').addEventListener('submit', (e) => this.saveProviderConfig(e));
    document.getElementById('stripeConfigForm').addEventListener('submit', (e) => this.saveStripeConfig(e));

    // Provider configuration
    document.getElementById('providerSelect').addEventListener('change', (e) => this.onProviderChanged(e));
    document.getElementById('saveProviderConfig').addEventListener('click', (e) => this.saveProviderConfig(e));
    document.getElementById('testProviderConfig').addEventListener('click', () => this.testProviderConfig());
    document.getElementById('testArticleGeneration').addEventListener('click', () => this.testArticleGeneration());
    document.getElementById('testImageGeneration').addEventListener('click', () => this.testImageGeneration());
    document.getElementById('switchProviderBtn').addEventListener('click', () => this.showSwitchProviderGuide());

    // Seed data
    document.getElementById('executeSeed').addEventListener('click', () => this.seedData());

    // Test Stripe config
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
      // Load current provider configuration
      await this.loadProviderConfig();

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

  async loadProviderConfig() {
    try {
      // Load current provider configuration
      const response = await fetch('/api/v1/config/provider');
      const data = await response.json();

      if (data.success && data.config) {
        const config = data.config;
        document.getElementById('providerSelect').value = config.provider || 'openai';
        document.getElementById('providerApiKey').value = config.api_key || '';
        document.getElementById('modelArticle').value = config.model_article || '';
        document.getElementById('modelImage').value = config.model_image || '';
        document.getElementById('maxTokens').value = config.max_tokens || 2000;
        document.getElementById('temperature').value = config.temperature || 0.7;
        document.getElementById('baseUrl').value = config.base_url || '';
        
        // Update provider info
        this.updateProviderInfo(config.provider);
        
        // Load provider-specific models
        await this.loadProviderModels(config.provider);
        
        // Load active providers for this site
        await this.loadActiveProviders();
      }
    } catch (error) {
      console.error('Error loading provider config:', error);
      this.showAlert('Error loading provider configuration', 'warning');
    }
  }

  async loadActiveProviders() {
    try {
      const response = await fetch('/api/v1/config/providers');
      const data = await response.json();

      if (data.success && data.active_providers) {
        const list = document.getElementById('activeProvidersList');
        
        if (data.active_providers.length === 0) {
          list.innerHTML = '<p class="text-muted">No active providers configured</p>';
          return;
        }

        list.innerHTML = data.active_providers.map(provider => `
          <a href="#" class="list-group-item list-group-item-action">
            <div class="d-flex w-100 justify-content-between">
              <h6 class="mb-1">${provider.name}</h6>
              <span class="badge bg-success">Active</span>
            </div>
            <p class="mb-1"><small>Base URL: ${provider.base_url || 'N/A'}</small></p>
            <p class="mb-0"><small class="text-muted">Models: ${provider.model_article || 'N/A'}</small></p>
          </a>
        `).join('');
      }
    } catch (error) {
      console.error('Error loading active providers:', error);
    }
  }

  async loadProviderModels(provider) {
    try {
      // Load article models
      const articleResponse = await fetch('/api/v1/config/article');
      const articleData = await articleResponse.json();

      if (articleData.success && articleData.config) {
        const modelArticle = document.getElementById('modelArticle');
        const articleModels = articleData.config.available_models || [];
        
        modelArticle.innerHTML = `
          <option value="">Select article model...</option>
          ${articleModels.map(model => `<option value="${model}">${model}</option>`).join('')}
        `;
        
        if (articleData.config.model) {
          modelArticle.value = articleData.config.model;
        }
      }

      // Load image models
      const imageResponse = await fetch('/api/v1/config/image');
      const imageData = await imageResponse.json();

      if (imageData.success && imageData.config) {
        const modelImage = document.getElementById('modelImage');
        const imageModels = imageData.config.available_models || [];
        
        modelImage.innerHTML = `
          <option value="">Select image model...</option>
          ${imageModels.map(model => `<option value="${model}">${model}</option>`).join('')}
        `;
        
        if (imageData.config.model) {
          modelImage.value = imageData.config.model;
        }
      }
    } catch (error) {
      console.error('Error loading provider models:', error);
    }
  }

  updateProviderInfo(provider) {
    const infoDiv = document.getElementById('providerInfo');
    
    const providerInfo = {
      openai: {
        name: 'OpenAI',
        description: 'OpenAI provides state-of-the-art models (GPT-4, GPT-3.5) for text generation and DALL-E 3 for image generation.',
        models: 'GPT-4, GPT-4 Turbo, GPT-3.5 Turbo | DALL-E 3, DALL-E 2',
        strengths: '✓ Highest quality ✓ Reliable ✓ Premium models'
      },
      novita: {
        name: 'Novita AI',
        description: 'Novita AI provides cost-effective alternatives with DeepSeek, Llama, and Mistral models.',
        models: 'DeepSeek, Llama 2 7B, Mistral 7B | DALL-E 3 (compatible)',
        strengths: '✓ Budget-friendly ✓ Fast ✓ Great variety'
      }
    };

    const info = providerInfo[provider] || providerInfo.openai;
    infoDiv.innerHTML = `
      <h6 class="mb-2">${info.name}</h6>
      <p class="mb-2">${info.description}</p>
      <p class="mb-1"><strong>Available Models:</strong></p>
      <small class="text-muted">${info.models}</small>
      <p class="mt-2 mb-0"><small>${info.strengths}</small></p>
    `;
  }

  onProviderChanged(e) {
    const provider = e.target.value;
    if (provider) {
      this.updateProviderInfo(provider);
      this.loadProviderModels(provider);
      
      // Update base URL
      const baseUrls = {
        openai: 'https://api.openai.com/v1',
        novita: 'https://api.novita.ai/openai/v1'
      };
      document.getElementById('baseUrl').value = baseUrls[provider] || '';
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
    
    // Get form data
    const formData = new FormData(e.target);
    const packageData = Object.fromEntries(formData);
    
    // Handle checkbox values (FormData doesn't include unchecked checkboxes)
    packageData.is_popular = document.getElementById('isPopular').checked;
    packageData.is_active = document.getElementById('isActive').checked;
    
    // Convert string numbers to actual numbers
    packageData.credits = parseInt(packageData.credits);
    packageData.price = parseFloat(packageData.price);
    
    try {
      const packageId = document.getElementById('packageId').value;
      const url = packageId ? `/api/v1/admin/packages/${packageId}` : '/api/v1/admin/packages';
      const method = packageId ? 'PUT' : 'POST';
      
      // Remove the packageId field from the data (it's in the URL)
      delete packageData.packageId;
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(packageData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        bootstrap.Modal.getInstance(document.getElementById('packageModal')).hide();
        // Clear the form
        document.getElementById('packageForm').reset();
        document.getElementById('packageId').value = '';
        this.loadPackages();
        this.showAlert('Package saved successfully', 'success');
      } else {
        this.showAlert(data.error || 'Failed to save package', 'danger');
      }
    } catch (error) {
      console.error('Error saving package:', error);
      this.showAlert('Error saving package: ' + error.message, 'danger');
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

  async saveProviderConfig(e) {
    e.preventDefault();
    
    const provider = document.getElementById('providerSelect').value;
    const apiKey = document.getElementById('providerApiKey').value;
    const modelArticle = document.getElementById('modelArticle').value;
    const modelImage = document.getElementById('modelImage').value;
    const maxTokens = parseInt(document.getElementById('maxTokens').value);
    const temperature = parseFloat(document.getElementById('temperature').value);

    // Validation
    if (!provider) {
      this.showAlert('Please select a provider', 'warning');
      return;
    }

    if (!apiKey) {
      this.showAlert('API key is required', 'warning');
      return;
    }

    if (!modelArticle || !modelImage) {
      this.showAlert('Both article and image models must be selected', 'warning');
      return;
    }

    const configData = {
      provider,
      api_key: apiKey,
      model_article: modelArticle,
      model_image: modelImage,
      max_tokens: maxTokens,
      temperature: temperature
    };
    
    try {
      const response = await fetch('/api/v1/config/provider', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.showAlert(`Provider configuration for ${data.provider_name} saved successfully`, 'success');
        // Reload configuration to confirm changes
        setTimeout(() => this.loadProviderConfig(), 1000);
      } else {
        this.showAlert(data.error || 'Error saving provider configuration', 'danger');
      }
    } catch (error) {
      console.error('Error saving provider config:', error);
      this.showAlert('Error saving provider configuration: ' + error.message, 'danger');
    }
  }

  async testProviderConfig() {
    const provider = document.getElementById('providerSelect').value;
    
    if (!provider) {
      this.showAlert('Please select a provider first', 'warning');
      return;
    }

    try {
      const response = await fetch('/api/v1/config/provider');
      const data = await response.json();

      if (data.success && data.config) {
        this.showAlert(`✓ ${data.config.provider || provider} provider configuration is valid!`, 'success');
      } else {
        this.showAlert('Provider configuration is invalid or not set', 'danger');
      }
    } catch (error) {
      console.error('Error testing provider config:', error);
      this.showAlert('Error testing provider configuration', 'danger');
    }
  }

  async testArticleGeneration() {
    const provider = document.getElementById('providerSelect').value;
    
    if (!provider) {
      this.showAlert('Please select a provider first', 'warning');
      return;
    }

    try {
      this.showAlert('Testing article generation with ' + provider + '...', 'info');
      
      // Call the article generation test endpoint
      const response = await fetch('/api/v1/config/test/article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider })
      });

      const data = await response.json();

      if (data.success) {
        this.showAlert('✓ Article generation test successful! Model: ' + data.model, 'success');
      } else {
        this.showAlert('✗ Article generation test failed: ' + (data.error || 'Unknown error'), 'danger');
      }
    } catch (error) {
      console.error('Error testing article generation:', error);
      this.showAlert('Error testing article generation: ' + error.message, 'danger');
    }
  }

  async testImageGeneration() {
    const provider = document.getElementById('providerSelect').value;
    
    if (!provider) {
      this.showAlert('Please select a provider first', 'warning');
      return;
    }

    try {
      this.showAlert('Testing image generation with ' + provider + '...', 'info');
      
      // Call the image generation test endpoint
      const response = await fetch('/api/v1/config/test/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider })
      });

      const data = await response.json();

      if (data.success) {
        this.showAlert('✓ Image generation test successful! Model: ' + data.model, 'success');
      } else {
        this.showAlert('✗ Image generation test failed: ' + (data.error || 'Unknown error'), 'danger');
      }
    } catch (error) {
      console.error('Error testing image generation:', error);
      this.showAlert('Error testing image generation: ' + error.message, 'danger');
    }
  }

  showSwitchProviderGuide() {
    const guide = `
PROVIDER SWITCHING GUIDE

1. BEFORE SWITCHING:
   • Backup your current API key
   • Note your current model settings
   • Ensure new provider API key is ready

2. SWITCHING STEPS:
   a) Get new provider API key
   b) Change provider in dropdown
   c) Enter new API key
   d) Select models specific to new provider
   e) Click "Test Configuration"
   f) If successful, click "Save Provider Configuration"

3. TESTING:
   • Click "Test Configuration" to verify API key
   • Click "Test Article Generation" to test with real API
   • Click "Test Image Generation" to test image models

4. ROLLING BACK:
   • Return to this page
   • Select previous provider from dropdown
   • Enter previous API key
   • Save configuration

5. MIGRATION TIMELINE:
   • No downtime required
   • Switch takes effect immediately
   • Both providers supported simultaneously

Need help? Check EXTERNAL_DASHBOARD_PROVIDER_GUIDE.md for detailed instructions.
    `;
    
    alert(guide);
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

  viewSiteDetails(siteId) {
    // Open site details modal
    document.getElementById('siteIdInput').value = siteId;
    const modal = new bootstrap.Modal(document.getElementById('siteDetailsModal'));
    modal.show();
  }

  editSite(siteId) {
    // Load site data for editing
    this.showAlert('Edit site functionality - loading site data...', 'info');
    // TODO: Implement site editing with API call
  }

  async deleteSite(siteId) {
    if (!confirm('Are you sure you want to delete this site? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/admin/sites/${siteId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (data.success) {
        this.showAlert('Site deleted successfully', 'success');
        this.loadSites();
      } else {
        this.showAlert(data.error || 'Error deleting site', 'danger');
      }
    } catch (error) {
      console.error('Error deleting site:', error);
      this.showAlert('Error deleting site', 'danger');
    }
  }

  async editPackage(packageId) {
    // Load package data for editing
    document.getElementById('packageId').value = packageId;
    
    try {
      const response = await fetch(`/api/v1/admin/packages/${packageId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.package) {
        const pkg = data.package;
        document.getElementById('packageName').value = pkg.name;
        document.getElementById('creditType').value = pkg.credit_type;
        document.getElementById('credits').value = pkg.credits;
        document.getElementById('price').value = pkg.price;
        document.getElementById('isPopular').checked = pkg.is_popular;
        document.getElementById('isActive').checked = pkg.is_active;
        
        const modal = new bootstrap.Modal(document.getElementById('packageModal'));
        modal.show();
      } else {
        this.showAlert(data.error || 'Failed to load package data', 'danger');
      }
    } catch (error) {
      console.error('Error loading package:', error);
      this.showAlert('Error loading package data: ' + error.message, 'danger');
    }
  }

  async deletePackage(packageId) {
    if (!confirm('Are you sure you want to delete this package? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/admin/packages/${packageId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (data.success) {
        this.showAlert('Package deleted successfully', 'success');
        this.loadPackages();
      } else {
        this.showAlert(data.error || 'Error deleting package', 'danger');
      }
    } catch (error) {
      console.error('Error deleting package:', error);
      this.showAlert('Error deleting package', 'danger');
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