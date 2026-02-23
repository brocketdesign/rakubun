import { marked } from 'marked';

export interface WordPressSite {
  url: string;
  username: string;
  applicationPassword: string;
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
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      console.error('[WP] Failed to download image from URL:', imageUrl);
      return null;
    }
    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    const extension = contentType.includes('png') ? 'png' : 'jpg';
    const filename = `image-${Date.now()}.${extension}`;

    const baseUrl = site.url.startsWith('http') ? site.url : `https://${site.url}`;
    const mediaEndpoint = `${baseUrl.replace(/\/$/, '')}/wp-json/wp/v2/media`;
    const authHeader = 'Basic ' + Buffer.from(`${site.username}:${site.applicationPassword}`).toString('base64');

    const wpResponse = await fetch(mediaEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Type': contentType,
      },
      body: imageBuffer,
    });

    if (!wpResponse.ok) {
      const errorText = await wpResponse.text();
      console.error('[WP] Failed to upload image:', wpResponse.status, errorText);
      return null;
    }

    const wpData = await wpResponse.json() as any;
    console.log('[WP] Image uploaded, ID:', wpData.id, 'URL:', wpData.source_url);
    return { id: wpData.id, sourceUrl: wpData.source_url };
  } catch (error) {
    console.error('[WP] Error uploading image:', error);
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

    const wpResponse = await fetch(mediaEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Disposition': `attachment; filename="${finalFilename}"`,
        'Content-Type': contentType,
      },
      body: imageBuffer,
    });

    if (!wpResponse.ok) {
      const errorText = await wpResponse.text();
      console.error('[WP] Failed to upload base64 image:', wpResponse.status, errorText);
      return null;
    }

    const wpData = await wpResponse.json() as any;

    // Set alt text if provided
    if (altText && wpData.id) {
      try {
        await fetch(`${mediaEndpoint}/${wpData.id}`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ alt_text: altText }),
        });
      } catch {
        // Non-critical, continue
      }
    }

    console.log('[WP] Base64 image uploaded, ID:', wpData.id, 'URL:', wpData.source_url);
    return { id: wpData.id, sourceUrl: wpData.source_url };
  } catch (error) {
    console.error('[WP] Error uploading base64 image:', error);
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
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

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
    console.error('[WP] Network/fetch error:', error);
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

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
      },
    });

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
    console.error('[WP] getPostStatus network error:', error);
    return null;
  }
}
