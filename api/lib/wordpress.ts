import { marked } from 'marked';

export interface WordPressSite {
  url: string;
  username: string;
  applicationPassword: string;
}

// ─── Reliability helpers ────────────────────────────────────────────────────

/** Default timeout (ms) for WordPress REST API calls */
const WP_DEFAULT_TIMEOUT_MS = 30_000;

/** Default timeout (ms) for image download/upload operations */
const WP_IMAGE_TIMEOUT_MS = 60_000;

/** Maximum number of automatic retries for transient failures */
const WP_MAX_RETRIES = 2;

/** Classify whether an error is transient (worth retrying) */
function isTransientError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (error instanceof TypeError) return true; // network-level failure
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: string }).code;
    if (['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'EPIPE'].includes(code || '')) {
      return true;
    }
  }
  return false;
}

/** Whether an HTTP status code indicates a transient server-side issue */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

interface FetchWithRetryOptions {
  /** Timeout in ms (default: WP_DEFAULT_TIMEOUT_MS) */
  timeoutMs?: number;
  /** Max retries on transient failures (default: WP_MAX_RETRIES) */
  maxRetries?: number;
  /** Label used in log messages */
  label?: string;
}

/**
 * Wrapper around `fetch` that adds:
 * - Per-request AbortController timeout
 * - Automatic retries with exponential backoff for transient network /
 *   server errors (429, 502, 503, 504, ECONNRESET, etc.)
 * - Structured logging via `[WP]` prefix
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  opts: FetchWithRetryOptions = {},
): Promise<Response> {
  const { timeoutMs = WP_DEFAULT_TIMEOUT_MS, maxRetries = WP_MAX_RETRIES, label = 'request' } = opts;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);

      // If the server returned a retryable status and we have attempts left, retry
      if (isRetryableStatus(response.status) && attempt < maxRetries) {
        const backoff = Math.min(1000 * 2 ** attempt, 8000);
        console.warn(
          `[WP] ${label} received ${response.status}, retrying in ${backoff}ms (attempt ${attempt + 1}/${maxRetries})`,
        );
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }

      return response;
    } catch (error) {
      clearTimeout(timer);
      lastError = error;

      if (isTransientError(error) && attempt < maxRetries) {
        const backoff = Math.min(1000 * 2 ** attempt, 8000);
        console.warn(
          `[WP] ${label} transient error, retrying in ${backoff}ms (attempt ${attempt + 1}/${maxRetries}):`,
          error instanceof Error ? error.message : error,
        );
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }

      throw error;
    }
  }

  // Should not reach here, but just in case
  throw lastError;
}

/**
 * Convert markdown content to HTML for WordPress.
 * Keeps content that is already HTML unchanged.
 */
function markdownToHtml(content: string): string {
  // If the content already looks like HTML, return as-is
  if (/^<[a-z][\s\S]*>/i.test(content.trim())) {
    return content;
  }
  return marked.parse(content, { async: false }) as string;
}

/**
 * Upload an image to WordPress Media Library.
 * Returns the attachment ID and source URL, or null on failure.
 */
export async function uploadImageToWordPress(
  site: WordPressSite,
  imageUrl: string,
): Promise<{ id: number; sourceUrl: string } | null> {
  if (!site || !site.url || !site.username || !site.applicationPassword) {
    return null;
  }

  try {
    const imageResponse = await fetchWithRetry(imageUrl, {}, {
      timeoutMs: WP_IMAGE_TIMEOUT_MS,
      label: 'downloadImage',
    });
    if (!imageResponse.ok) {
      console.error('[WP] Failed to download image from URL:', imageUrl, 'status:', imageResponse.status);
      return null;
    }
    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    const extension = contentType.includes('png') ? 'png' : 'jpg';
    const filename = `image-${Date.now()}.${extension}`;

    const baseUrl = site.url.startsWith('http') ? site.url : `https://${site.url}`;
    const mediaEndpoint = `${baseUrl.replace(/\/$/, '')}/wp-json/wp/v2/media`;
    const authHeader = 'Basic ' + Buffer.from(`${site.username}:${site.applicationPassword}`).toString('base64');

    const wpResponse = await fetchWithRetry(mediaEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Type': contentType,
      },
      body: imageBuffer,
    }, { timeoutMs: WP_IMAGE_TIMEOUT_MS, label: 'uploadImage' });

    if (!wpResponse.ok) {
      const errorText = await wpResponse.text();
      console.error('[WP] Failed to upload image:', wpResponse.status, errorText);
      return null;
    }

    const wpData = await wpResponse.json() as any;
    console.log('[WP] Image uploaded, ID:', wpData.id, 'URL:', wpData.source_url);
    return { id: wpData.id, sourceUrl: wpData.source_url };
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === 'AbortError';
    console.error('[WP] Error uploading image:', isTimeout ? 'TIMEOUT' : error);
    return null;
  }
}

/**
 * Upload a base64-encoded image to WordPress Media Library.
 * Returns the attachment ID and source URL, or null on failure.
 */
export async function uploadBase64ImageToWordPress(
  site: WordPressSite,
  base64Data: string,
  filename?: string,
  altText?: string,
): Promise<{ id: number; sourceUrl: string } | null> {
  if (!site || !site.url || !site.username || !site.applicationPassword) {
    return null;
  }

  try {
    // Strip data URI prefix if present (e.g. "data:image/png;base64,...")
    const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Clean, 'base64');

    // Detect content type from data URI or default to jpeg
    let contentType = 'image/jpeg';
    const dataUriMatch = base64Data.match(/^data:(image\/\w+);base64,/);
    if (dataUriMatch) {
      contentType = dataUriMatch[1];
    }
    const extension = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    const finalFilename = filename || `image-${Date.now()}.${extension}`;

    const baseUrl = site.url.startsWith('http') ? site.url : `https://${site.url}`;
    const mediaEndpoint = `${baseUrl.replace(/\/$/, '')}/wp-json/wp/v2/media`;
    const authHeader = 'Basic ' + Buffer.from(`${site.username}:${site.applicationPassword}`).toString('base64');

    const wpResponse = await fetchWithRetry(mediaEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Disposition': `attachment; filename="${finalFilename}"`,
        'Content-Type': contentType,
      },
      body: imageBuffer,
    }, { timeoutMs: WP_IMAGE_TIMEOUT_MS, label: 'uploadBase64Image' });

    if (!wpResponse.ok) {
      const errorText = await wpResponse.text();
      console.error('[WP] Failed to upload base64 image:', wpResponse.status, errorText);
      return null;
    }

    const wpData = await wpResponse.json() as any;

    // Set alt text if provided
    if (altText && wpData.id) {
      try {
        await fetchWithRetry(`${mediaEndpoint}/${wpData.id}`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ alt_text: altText }),
        }, { timeoutMs: WP_DEFAULT_TIMEOUT_MS, maxRetries: 1, label: 'setAltText' });
      } catch (e) {
        console.warn('[WP] Non-critical: failed to set alt text:', e instanceof Error ? e.message : e);
      }
    }

    console.log('[WP] Base64 image uploaded, ID:', wpData.id, 'URL:', wpData.source_url);
    return { id: wpData.id, sourceUrl: wpData.source_url };
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === 'AbortError';
    console.error('[WP] Error uploading base64 image:', isTimeout ? 'TIMEOUT' : error);
    return null;
  }
}

export async function publishToWordPress(
  site: WordPressSite,
  article: {
    title: string;
    content: string;
    excerpt?: string;
    status: 'publish' | 'draft' | 'future';
    wpPostId?: number;
    date?: string;
    thumbnailUrl?: string;
  }
): Promise<{ wpPostId: number; url: string } | null> {
  console.log('[WP] publishToWordPress called with site:', {
    url: site?.url,
    username: site?.username,
    hasPassword: !!site?.applicationPassword,
    passwordLength: site?.applicationPassword?.length,
  });
  console.log('[WP] Article status:', article.status, 'wpPostId:', article.wpPostId);

  if (!site || !site.url || !site.username || !site.applicationPassword) {
    console.error('[WP] Missing credentials:', {
      hasSite: !!site,
      hasUrl: !!site?.url,
      hasUsername: !!site?.username,
      hasPassword: !!site?.applicationPassword,
    });
    return null;
  }

  try {
    const baseUrl = site.url.startsWith('http') ? site.url : `https://${site.url}`;
    const endpoint = article.wpPostId 
      ? `${baseUrl}/wp-json/wp/v2/posts/${article.wpPostId}`
      : `${baseUrl}/wp-json/wp/v2/posts`;

    console.log('[WP] Endpoint:', endpoint);

    const authHeader = 'Basic ' + Buffer.from(`${site.username}:${site.applicationPassword}`).toString('base64');

    const htmlContent = markdownToHtml(article.content);

    const body: Record<string, unknown> = {
      title: article.title,
      content: htmlContent,
      excerpt: article.excerpt,
      status: article.status,
    };

    // Set the post date for scheduling or timestamping
    if (article.date) {
      body.date = article.date;
      body.date_gmt = new Date(article.date).toISOString();
    }

    // Upload thumbnail and set as featured image
    if (article.thumbnailUrl) {
      console.log('[WP] Uploading thumbnail:', article.thumbnailUrl);
      const mediaResult = await uploadImageToWordPress(site, article.thumbnailUrl);
      if (mediaResult) {
        body.featured_media = mediaResult.id;
        console.log('[WP] Featured media set to:', mediaResult.id);
      } else {
        console.error('[WP] Failed to upload thumbnail, skipping featured_media');
      }
    }

    console.log('[WP] Sending request...');
    const response = await fetchWithRetry(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }, { timeoutMs: WP_DEFAULT_TIMEOUT_MS, label: 'publishPost' });

    console.log('[WP] Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[WP] API error body:', errorText);
      return null;
    }

    const data = await response.json() as any;
    console.log('[WP] Success! Post ID:', data.id, 'Link:', data.link);
    return {
      wpPostId: data.id,
      url: data.link,
    };
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === 'AbortError';
    console.error('[WP] Network/fetch error:', isTimeout ? 'TIMEOUT – WordPress did not respond within 30s' : error);
    return null;
  }
}

/**
 * Fetch the current status of a WordPress post by its ID.
 * Returns the WP status string (e.g. 'publish', 'draft', 'future', 'pending', 'private', 'trash')
 * or null if the request fails.
 */
export async function getWordPressPostStatus(
  site: WordPressSite,
  wpPostId: number,
): Promise<{ status: string; link: string } | null> {
  if (!site || !site.url || !site.username || !site.applicationPassword) {
    console.error('[WP] getPostStatus: Missing credentials');
    return null;
  }

  try {
    const baseUrl = site.url.startsWith('http') ? site.url : `https://${site.url}`;
    const endpoint = `${baseUrl}/wp-json/wp/v2/posts/${wpPostId}?context=edit`;

    const authHeader =
      'Basic ' +
      Buffer.from(`${site.username}:${site.applicationPassword}`).toString('base64');

    const response = await fetchWithRetry(endpoint, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
      },
    }, { timeoutMs: WP_DEFAULT_TIMEOUT_MS, label: 'getPostStatus' });

    if (!response.ok) {
      console.error('[WP] getPostStatus error:', response.status, response.statusText);
      return null;
    }

    const data = (await response.json()) as any;
    return {
      status: data.status, // 'publish' | 'draft' | 'future' | 'pending' | 'private' | 'trash'
      link: data.link || '',
    };
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === 'AbortError';
    console.error('[WP] getPostStatus network error:', isTimeout ? 'TIMEOUT' : error);
    return null;
  }
}
