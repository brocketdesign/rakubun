import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ObjectId } from 'mongodb';
import { google } from 'googleapis';
import { getDb } from './lib/mongodb.js';
import { authenticateRequest, AuthError } from './lib/auth.js';

// ─── Google OAuth2 Client Setup ────────────────────────────────────────────────

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const APP_URL = (process.env.APP_URL 
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL 
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` 
    : 'http://localhost:3000')).replace(/\/+$/, '');

const REDIRECT_URI = `${APP_URL}/api/analytics/oauth/callback`;

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  REDIRECT_URI
);

// ─── Types ─────────────────────────────────────────────────────────────────────

interface GA4Property {
  id: string; // "properties/123456789"
  name: string;
  account: string;
}

interface AnalyticsData {
  date: string;
  pageTitle: string;
  pagePath: string;
  pageViews: number;
  totalUsers: number;
  avgEngagementTime: number;
  bounceRate: number;
}

// ─── Main Handler ──────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = (req.query._action as string) || '';
  const siteId = (req.query._siteId as string) || '';

  // OAuth routes
  if (action === 'oauth-init') {
    return handleOAuthInit(req, res); // Returns OAuth URL (requires auth header)
  }
  if (action === 'oauth') {
    return handleOAuthRedirect(req, res); // Legacy redirect endpoint
  }
  if (action === 'oauth/callback') {
    return handleOAuthCallback(req, res);
  }

  // All other routes require authentication
  try {
    switch (action) {
      case 'properties':
        return handleListProperties(req, res);
      case 'connect':
        return handleConnectProperty(req, res);
      case 'disconnect':
        return handleDisconnectProperty(req, res);
      case 'data':
        return handleFetchAnalyticsData(req, res);
      case 'status':
        return handleGetConnectionStatus(req, res);
      default:
        return res.status(404).json({ error: 'Not found' });
    }
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('[Analytics]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── OAuth Flow ────────────────────────────────────────────────────────────────

/**
 * Step 1a: Initialize OAuth flow - returns OAuth URL for frontend to redirect
 */
async function handleOAuthInit(req: VercelRequest, res: VercelResponse) {
  try {
    const userId = await authenticateRequest(req);
    const siteId = req.query.siteId as string;
    
    if (!siteId) {
      return res.status(400).json({ error: 'siteId is required' });
    }

    // Store userId and siteId in state to retrieve after callback
    const state = Buffer.from(JSON.stringify({ userId, siteId })).toString('base64');

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/analytics.readonly',
      ],
      prompt: 'consent', // Always show consent to get refresh token
      state,
    });

    return res.status(200).json({ url });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('[Analytics OAuth Init]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Step 1b: Legacy OAuth redirect endpoint (redirects to Google directly)
 * Note: This requires session-based auth since browser redirects don't include Authorization header
 */
async function handleOAuthRedirect(req: VercelRequest, res: VercelResponse) {
  // Redirect to the new flow - this endpoint is deprecated
  return res.status(400).json({ 
    error: 'This endpoint requires browser session auth. Use /api/analytics/oauth-init instead.' 
  });
}

/**
 * Step 2: Handle OAuth callback from Google
 */
async function handleOAuthCallback(req: VercelRequest, res: VercelResponse) {
  try {
    const { code, state, error } = req.query;

    if (error) {
      console.error('[Analytics OAuth] Error from Google:', error);
      return res.redirect(`${APP_URL}/dashboard/sites?error=oauth_denied`);
    }

    if (!code || !state) {
      return res.redirect(`${APP_URL}/dashboard/sites?error=invalid_callback`);
    }

    // Decode state to get userId and siteId
    let stateData: { userId: string; siteId: string };
    try {
      stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
    } catch {
      return res.redirect(`${APP_URL}/dashboard/sites?error=invalid_state`);
    }

    const { userId, siteId } = stateData;

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code as string);

    if (!tokens.refresh_token) {
      console.warn('[Analytics OAuth] No refresh token received');
    }

    // Store tokens in database
    const db = await getDb();
    await db.collection('analytics_connections').updateOne(
      { userId, siteId },
      {
        $set: {
          userId,
          siteId,
          googleRefreshToken: tokens.refresh_token,
          googleAccessToken: tokens.access_token,
          tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          propertyId: null, // Will be set after user selects property
          connectedAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    // Redirect to property selection page
    res.redirect(`${APP_URL}/dashboard/sites?ga_auth=success&siteId=${siteId}`);
  } catch (err) {
    console.error('[Analytics OAuth Callback]', err);
    res.redirect(`${APP_URL}/dashboard/sites?error=oauth_failed`);
  }
}

// ─── API Endpoints ─────────────────────────────────────────────────────────────

/**
 * List available GA4 properties for the connected user
 */
async function handleListProperties(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await authenticateRequest(req);
  const siteId = req.query.siteId as string;

  if (!siteId) {
    return res.status(400).json({ error: 'siteId is required' });
  }

  const db = await getDb();
  const connection = await db.collection('analytics_connections').findOne({ userId, siteId });

  if (!connection?.googleRefreshToken) {
    return res.status(404).json({ error: 'No Google Analytics connection found' });
  }

  try {
    // Set up OAuth client with refresh token
    oauth2Client.setCredentials({ refresh_token: connection.googleRefreshToken });

    // Get access token (auto-refreshes if needed)
    const accessTokenResponse = await oauth2Client.getAccessToken();
    const accessToken = accessTokenResponse.token;

    if (!accessToken) {
      throw new Error('Failed to get access token');
    }

    // List GA4 properties using Analytics Admin API
    const analyticsAdmin = google.analyticsadmin({ version: 'v1beta', auth: oauth2Client });
    const accountSummaries = await analyticsAdmin.accountSummaries.list();

    const properties: GA4Property[] = [];
    
    for (const account of accountSummaries.data.accountSummaries || []) {
      for (const prop of account.propertySummaries || []) {
        if (prop.property && prop.displayName) {
          properties.push({
            id: prop.property, // "properties/123456789"
            name: prop.displayName,
            account: account.displayName || 'Unknown Account',
          });
        }
      }
    }

    return res.status(200).json({ properties });
  } catch (err) {
    console.error('[Analytics List Properties]', err);
    
    // Check if token is invalid
    if (err instanceof Error && err.message.includes('invalid_grant')) {
      // Clear the connection
      await db.collection('analytics_connections').deleteOne({ userId, siteId });
      return res.status(401).json({ error: 'Google connection expired. Please reconnect.' });
    }
    
    return res.status(500).json({ error: 'Failed to fetch GA4 properties' });
  }
}

/**
 * Connect a specific GA4 property to a site
 */
async function handleConnectProperty(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await authenticateRequest(req);
  const siteId = req.query.siteId as string;
  const { propertyId } = req.body || {};

  if (!siteId || !propertyId) {
    return res.status(400).json({ error: 'siteId and propertyId are required' });
  }
  
  const propertyIdStr = String(propertyId);

  const db = await getDb();
  
  // Verify the connection exists
  const connection = await db.collection('analytics_connections').findOne({ userId, siteId });
  if (!connection) {
    return res.status(404).json({ error: 'No Google Analytics connection found. Please authenticate first.' });
  }

  // Update the site document with property info
  await db.collection('analytics_connections').updateOne(
    { userId, siteId },
    {
      $set: {
        propertyId: propertyIdStr,
        connectedAt: new Date(),
        updatedAt: new Date(),
      },
    }
  );

  // Also update the sites collection for quick reference
  if (ObjectId.isValid(siteId)) {
    await db.collection('sites').updateOne(
      { _id: new ObjectId(siteId), userId },
      {
        $set: {
          'analytics.propertyId': propertyIdStr,
          'analytics.connected': true,
          'analytics.connectedAt': new Date(),
        },
      }
    );
  }

  return res.status(200).json({ 
    success: true, 
    propertyId: propertyIdStr,
    message: 'Google Analytics property connected successfully' 
  });
}

/**
 * Disconnect Google Analytics from a site
 */
async function handleDisconnectProperty(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await authenticateRequest(req);
  const siteId = req.query.siteId as string;

  if (!siteId) {
    return res.status(400).json({ error: 'siteId is required' });
  }
  
  const db = await getDb();

  // Remove the connection
  await db.collection('analytics_connections').deleteOne({ userId, siteId });

  // Update the site document
  if (ObjectId.isValid(siteId)) {
    await db.collection('sites').updateOne(
      { _id: new ObjectId(siteId), userId },
      {
        $set: {
          'analytics.connected': false,
          'analytics.disconnectedAt': new Date(),
        },
        $unset: {
          'analytics.propertyId': '',
        },
      }
    );
  }

  return res.status(200).json({ success: true, message: 'Google Analytics disconnected' });
}

/**
 * Get connection status for a site
 */
async function handleGetConnectionStatus(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await authenticateRequest(req);
  const siteId = req.query.siteId as string;

  if (!siteId) {
    return res.status(400).json({ error: 'siteId is required' });
  }
  
  const db = await getDb();
  const connection = await db.collection('analytics_connections').findOne({ userId, siteId });

  if (!connection) {
    return res.status(200).json({ 
      connected: false,
      propertyId: null,
      propertyName: null,
    });
  }

  // Get property name if connected
  let propertyName = null;
  if (connection.propertyId && connection.googleRefreshToken) {
    try {
      oauth2Client.setCredentials({ refresh_token: connection.googleRefreshToken });
      const analyticsAdmin = google.analyticsadmin({ version: 'v1beta', auth: oauth2Client });
      const property = await analyticsAdmin.properties.get({
        name: connection.propertyId,
      });
      propertyName = property.data.displayName || null;
    } catch {
      // Property might not exist or token expired
    }
  }

  return res.status(200).json({
    connected: !!connection.propertyId,
    propertyId: connection.propertyId,
    propertyName,
    connectedAt: connection.connectedAt,
  });
}

/**
 * Fetch analytics data for a site
 */
async function handleFetchAnalyticsData(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await authenticateRequest(req);
  const siteId = req.query.siteId as string;
  const startDate = req.query.startDate as string || '7daysAgo';
  const endDate = req.query.endDate as string || 'today';

  if (!siteId) {
    return res.status(400).json({ error: 'siteId is required' });
  }

  const db = await getDb();
  const connection = await db.collection('analytics_connections').findOne({ 
    userId, 
    siteId,
    propertyId: { $exists: true, $ne: null }
  });

  if (!connection?.googleRefreshToken || !connection.propertyId) {
    return res.status(404).json({ error: 'Google Analytics not connected for this site' });
  }
  
  const propertyIdStr = String(connection.propertyId);

  try {
    // Set up OAuth client with refresh token
    oauth2Client.setCredentials({ refresh_token: connection.googleRefreshToken });

    // Fetch analytics data
    const analyticsData = google.analyticsdata({ version: 'v1beta', auth: oauth2Client });

    const [overviewResponse, pagesResponse] = await Promise.all([
      // Overview metrics
      analyticsData.properties.runReport({
        property: connection.propertyId,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          metrics: [
            { name: 'screenPageViews' },
            { name: 'totalUsers' },
            { name: 'averageEngagementTime' },
            { name: 'bounceRate' },
          ],
        },
      }),
      // Top pages
      analyticsData.properties.runReport({
        property: connection.propertyId,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [
            { name: 'pageTitle' },
            { name: 'pagePath' },
          ],
          metrics: [
            { name: 'screenPageViews' },
            { name: 'totalUsers' },
          ],
          orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
          limit: '10',
        },
      }),
    ]);

    // Process overview metrics
    const overviewRow = overviewResponse.data.rows?.[0];
    const overview = {
      pageViews: parseInt(overviewRow?.metricValues?.[0]?.value || '0', 10),
      totalUsers: parseInt(overviewRow?.metricValues?.[1]?.value || '0', 10),
      avgEngagementTime: parseFloat(overviewRow?.metricValues?.[2]?.value || '0'),
      bounceRate: parseFloat(overviewRow?.metricValues?.[3]?.value || '0'),
    };

    // Process top pages
    const topPages = (pagesResponse.data.rows || []).map(row => ({
      pageTitle: row.dimensionValues?.[0]?.value || 'Unknown',
      pagePath: row.dimensionValues?.[1]?.value || '/',
      pageViews: parseInt(row.metricValues?.[0]?.value || '0', 10),
      totalUsers: parseInt(row.metricValues?.[1]?.value || '0', 10),
    }));

    // Fetch daily trend data
    const trendResponse = await analyticsData.properties.runReport({
      property: propertyIdStr,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'screenPageViews' }],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
      },
    });

    const dailyTrend = (trendResponse.data.rows || []).map(row => ({
      date: row.dimensionValues?.[0]?.value || '',
      pageViews: parseInt(row.metricValues?.[0]?.value || '0', 10),
    }));

    return res.status(200).json({
      overview,
      topPages,
      dailyTrend,
      dateRange: { startDate, endDate },
      propertyId: propertyIdStr,
    });
  } catch (err) {
    console.error('[Analytics Fetch Data]', err);
    
    if (err instanceof Error && err.message.includes('invalid_grant')) {
      await db.collection('analytics_connections').deleteOne({ userId, siteId });
      return res.status(401).json({ error: 'Google connection expired. Please reconnect.' });
    }
    
    return res.status(500).json({ error: 'Failed to fetch analytics data' });
  }
}
