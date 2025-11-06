const ExternalSite = require('../models/ExternalSite');

/**
 * Middleware to authenticate WordPress plugin API requests
 * Checks for Bearer token and Instance ID header
 */
const authenticatePlugin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const instanceId = req.headers['x-instance-id'];
    const userAgent = req.headers['user-agent'];

    console.log(`[authenticatePlugin] URL: ${req.url}, Auth Header: ${authHeader ? 'Present' : 'Missing'}, Instance ID: ${instanceId ? 'Present' : 'Missing'}, User-Agent: ${userAgent || 'Missing'}`);

    // Check if authorization header exists and has Bearer token
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log(`[authenticatePlugin] ❌ Missing or invalid authorization header`);
      return res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization header'
      });
    }

    // Extract token
    const apiToken = authHeader.substring(7); // Remove 'Bearer '

    // Check if instance ID is provided
    if (!instanceId) {
      console.log(`[authenticatePlugin] ❌ Missing X-Instance-ID header`);
      return res.status(401).json({
        success: false,
        error: 'Missing X-Instance-ID header'
      });
    }

    // Note: User-Agent validation is optional - allow requests from various clients
    // Previously enforced Rakubun-WordPress-Plugin, but now more lenient
    if (userAgent) {
      console.log(`[authenticatePlugin] User-Agent: ${userAgent}`);
    }

    // Find site by API token
    const site = await ExternalSite.findByApiToken(apiToken);
    if (!site) {
      console.log(`[authenticatePlugin] ❌ Invalid API token`);
      return res.status(401).json({
        success: false,
        error: 'Invalid API token'
      });
    }

    // Verify instance ID matches
    if (site.instance_id !== instanceId) {
      console.log(`[authenticatePlugin] ❌ Instance ID mismatch. Expected: ${site.instance_id}, Got: ${instanceId}`);
      return res.status(401).json({
        success: false,
        error: 'Instance ID mismatch'
      });
    }

    // Check if site is active
    if (site.status !== 'active') {
      console.log(`[authenticatePlugin] ❌ Site is not active. Status: ${site.status}`);
      return res.status(403).json({
        success: false,
        error: 'Site is not active'
      });
    }

    // Update last activity
    await ExternalSite.updateActivity(instanceId);

    // Attach site to request object
    req.site = site;
    
    console.log(`[authenticatePlugin] ✓ Authentication successful for instance: ${instanceId}`);
    next();
  } catch (error) {
    console.error('Plugin authentication error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Middleware to authenticate dashboard admin users (for API routes)
 */
const authenticateAdmin = (req, res, next) => {
  // Check if user is authenticated and is admin
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  // Check if user is admin (you may want to implement proper admin role checking)
  const adminEmails = ['japanclassicstore@gmail.com']; // Add your admin emails
  if (!adminEmails.includes(req.user.email)) {
    return res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
  }

  next();
};

/**
 * Middleware to authenticate dashboard admin users (for web routes)
 */
const authenticateWebAdmin = (req, res, next) => {
  console.log(`[authenticateWebAdmin] Request URL: ${req.url}, User: ${req.user ? req.user.email : 'Not authenticated'}`);
  
  // Check if user is authenticated and is admin
  if (!req.user) {
    console.log('[authenticateWebAdmin] User not authenticated, redirecting to /');
    req.flash('error', 'Please log in to access this page');
    return res.redirect('/');
  }

  // Check if user is admin (you may want to implement proper admin role checking)
  const adminEmails = ['japanclassicstore@gmail.com']; // Add your admin emails
  if (!adminEmails.includes(req.user.email)) {
    console.log(`[authenticateWebAdmin] User ${req.user.email} is not admin, redirecting to /dashboard`);
    req.flash('error', 'Access denied - Admin privileges required');
    return res.redirect('/dashboard');
  }

  console.log(`[authenticateWebAdmin] Admin user ${req.user.email} authenticated, proceeding`);
  next();
};

/**
 * Rate limiting middleware for API requests
 */
const rateLimit = (maxRequests = 100, windowMinutes = 1) => {
  const requests = new Map();

  return (req, res, next) => {
    const key = req.site ? req.site.instance_id : req.ip;
    const now = Date.now();
    const windowMs = windowMinutes * 60 * 1000;

    // Clean old entries
    for (const [k, v] of requests.entries()) {
      if (now - v.firstRequest > windowMs) {
        requests.delete(k);
      }
    }

    // Check current requests
    if (!requests.has(key)) {
      requests.set(key, {
        count: 1,
        firstRequest: now
      });
    } else {
      const requestData = requests.get(key);
      if (now - requestData.firstRequest > windowMs) {
        // Reset window
        requests.set(key, {
          count: 1,
          firstRequest: now
        });
      } else {
        requestData.count++;
        if (requestData.count > maxRequests) {
          return res.status(429).json({
            success: false,
            error: 'Rate limit exceeded'
          });
        }
      }
    }

    next();
  };
};

/**
 * Error handler middleware for API routes
 */
const apiErrorHandler = (err, req, res, next) => {
  console.error('API Error:', err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: err.message
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'Invalid ID format'
    });
  }

  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
};

module.exports = {
  authenticatePlugin,
  authenticateAdmin,
  authenticateWebAdmin,
  rateLimit,
  apiErrorHandler
};