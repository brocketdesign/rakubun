const wordpress = require('wordpress');

async function checkLoginInfo(blogInfo) {
  blogInfo.username = blogInfo.blogUsername;
  blogInfo.url = blogInfo.blogUrl;
  blogInfo.password = blogInfo.blogPassword;

  const client = wordpress.createClient(blogInfo);

  try {
      const posts = await new Promise((resolve, reject) => {
          client.getPosts({ number: 1 }, (err, posts) => {
              if (err) {
                  return reject(err);
              }
              if (!Array.isArray(posts)) {
                  return reject(new Error('Invalid response: posts is not an array.'));
              }
              resolve(posts);
          });
      });
      return { success: true, message: 'Login successful', posts };
  } catch (error) {
      return { success: false, message: 'Login failed', error: error.message };
  }
}

async function getPostLink(postId, client) {
  return new Promise((resolve, reject) => {
    client.getPost(postId, ['link'], (err, post) => {
      if (err) {
        reject(err);
      } else {
        resolve(post.link);
      }
    });
  });
}

async function getCategoryId(type, client) {

  return new Promise((resolve, reject) => {
    client.getTerms(type, function(err, terms) {
      if (err) {
        reject(err);
      } else {
        resolve(terms);
      }
    });
  });
}
async function categoryExists(name,type, client) {

  return new Promise((resolve, reject) => {
    client.getTerms(type, function(err, terms) {
      if (err) {
        reject(err);
      } else {
        const existingCategory = terms.find(term => term.name === name);
        resolve(existingCategory ? existingCategory.termId : false);
      }
    });
  });
}

async function ensureCategory(category,type, client) {
  try {
    const existingCategoryId = await categoryExists(category.name,type, client);
    if (existingCategoryId) return existingCategoryId; // If exists, return the ID
    // If the category doesn't exist, create a new one
    return new Promise((resolve, reject) => {
      client.newTerm({
        name: category.name,
        description: category.description,
        taxonomy: type
      }, function(error, term) {
        if (error) reject(error);
        else resolve(term.termId);
      });
    });
  } catch (error) {
    console.error(`Error ensuring category: ${error}`);
    throw error; // Rethrow error to handle it in the calling function
  }
}

async function createCategories(categories,type, client) {
  const categoryIds = [];
  for (let category of categories) {
    const categoryId = await ensureCategory(category,type, client);
    categoryIds.push(categoryId);
  }
  return categoryIds;
}

async function getTermDetails(id, type, client) {

  return new Promise((resolve, reject) => {
    client.getTerms(type, function(err, terms) {
      if (err) {
        reject(err);
      } else {
        const term = terms.find(t => t.termId === id);
        if (term) {
          resolve({ name: term.name, description: term.description });
        } else {
          reject(new Error(`Term with ID ${id} not found in taxonomy '${type}'.`));
        }
      }
    });
  });
}

async function post(title, slug, content, categories, tags, image, postStatus, client) {
  try {
    const categoryIds = await createCategories(categories,'category',client);
    const tagIds = await createCategories(tags, 'post_tag', client);
    // Create a new post with all the category IDs
    const postObject = {
      title: title,
      name: slug,
      status: postStatus,
      type: 'post',
      terms: {
        'category': categoryIds, 
        'post_tag': tagIds 
      },        
      commentStatus: 'closed',
      content: content,
      thumbnail:image?image.attachment_id:null
    }
    return new Promise((resolve, reject) => {
      client.newPost(postObject, function(error, id) {
        if (error) {
          console.error(`Error creating new post: ${error}`);
          reject(error);
        } else {
          console.log(`Post created successfully: ${id}`);
          resolve(id);
        }
      });
    });
  } catch (error) {
    console.error(`Error posting content: ${error}`);
    throw error; // Allows the caller to handle the error
  }
}

async function fetchBlogPosts(blogInfo, limit = 20, order = 'desc') {
  console.log(`[WordPress] 記事一覧取得開始: limit=${limit}, order=${order}`);
  console.log(`[WordPress] 接続先:`, {
    url: blogInfo.blogUrl,
    username: blogInfo.blogUsername ? '***' : 'undefined'
  });

  const client = wordpress.createClient({
    username: blogInfo.blogUsername,
    url: blogInfo.blogUrl,
    password: blogInfo.blogPassword,
    timeout: 15000 // 15 seconds timeout
  });

  return new Promise((resolve, reject) => {
    const options = { 
      number: limit,
      orderby: 'date',
      order: order // 'asc' for oldest first, 'desc' for newest first
    };
    
    console.log(`[WordPress] 記事取得オプション:`, options);
    
    // Set a timeout for the request
    const timeoutId = setTimeout(() => {
      console.error(`[WordPress] 記事取得タイムアウト (15秒)`);
      reject(new Error('WordPress API request timeout after 15 seconds'));
    }, 15000);
    
    client.getPosts(options, (err, posts) => {
      clearTimeout(timeoutId);
      
      if (err) {
        console.error(`[WordPress] 記事取得エラー:`, err);
        return reject(err);
      }
      
      if (!Array.isArray(posts)) {
        console.error(`[WordPress] 無効なレスポンス: posts is not an array`);
        return reject(new Error('Invalid response: posts is not an array.'));
      }
      
      console.log(`[WordPress] 記事取得成功: ${posts.length}件`);
      resolve(posts);
    });
  });
}

async function fetchSingleBlogPost(blogInfo, postId) {
  console.log(`[WordPress] 単一記事取得開始: postId=${postId}`);
  console.log(`[WordPress] 接続先:`, {
    url: blogInfo.blogUrl,
    username: blogInfo.blogUsername ? '***' : 'undefined'
  });

  const client = wordpress.createClient({
    username: blogInfo.blogUsername,
    url: blogInfo.blogUrl,
    password: blogInfo.blogPassword,
    timeout: 15000 // 15 seconds timeout
  });

  return new Promise((resolve, reject) => {
    // Set a timeout for the request
    const timeoutId = setTimeout(() => {
      console.error(`[WordPress] 単一記事取得タイムアウト (15秒)`);
      reject(new Error('WordPress API request timeout after 15 seconds'));
    }, 15000);

    client.getPost(postId, (err, post) => {
      clearTimeout(timeoutId);
      
      if (err) {
        console.error(`[WordPress] 単一記事取得エラー:`, err);
        return reject(err);
      }
      
      console.log(`[WordPress] 単一記事取得成功: ${post.title}`);
      resolve(post);
    });
  });
}

async function updatePostContent(blogInfo, postId, content) {
  console.log(`[WordPress] 記事更新開始: postId=${postId}`);
  console.log(`[WordPress] ブログ設定:`, {
    url: blogInfo.blogUrl,
    username: blogInfo.blogUsername ? '***' : 'undefined'
  });
  
  const client = wordpress.createClient({
    username: blogInfo.blogUsername,
    url: blogInfo.blogUrl,
    password: blogInfo.blogPassword,
    timeout: 20000 // 20 seconds timeout for update operations
  });

  // Check if post exists and user can edit
  try {
    const existingPost = await new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        console.error(`[WordPress] 記事存在確認タイムアウト (15秒)`);
        reject(new Error('WordPress API request timeout after 15 seconds'));
      }, 15000);

      client.getPost(postId, (err, post) => {
        clearTimeout(timeoutId);
        
        if (err) {
          console.error(`[WordPress] 記事取得エラー: ${err.message}`);
          return reject(new Error('Post not found or access denied.'));
        }
        console.log(`[WordPress] 記事取得成功: ${post.title}`);
        resolve(post);
      });
    });
    
    console.log(`[WordPress] 現在の記事内容長: ${existingPost.content ? existingPost.content.length : 0}文字`);
    console.log(`[WordPress] 新しい記事内容長: ${content ? content.length : 0}文字`);
    
  } catch (err) {
    throw new Error(`Cannot update: ${err.message}`);
  }

  return new Promise((resolve, reject) => {
    console.log(`[WordPress] 記事更新実行中...`);
    
    const timeoutId = setTimeout(() => {
      console.error(`[WordPress] 記事更新タイムアウト (20秒)`);
      reject(new Error('WordPress API update timeout after 20 seconds'));
    }, 20000);
    
    client.editPost(postId, { content: content }, (err, result) => {
      clearTimeout(timeoutId);
      
      if (err) {
        console.error(`[WordPress] 記事更新エラー:`, err);
        return reject(err);
      }
      
      console.log(`[WordPress] 記事更新結果:`, result);
      console.log(`[WordPress] 記事更新成功: postId=${postId}`);
      resolve(result);
    });
  });
}

/**
 * Get WordPress site language
 * @param {Object} blog - Blog configuration object
 * @returns {Promise<string>} Language code (e.g., 'ja', 'en', 'zh', etc.)
 */
async function getWordPressLanguage(blog) {
    try {
        // Map database field names to expected field names
        const blogConfig = {
            blogUrl: blog.blogUrl || blog.url,
            blogUsername: blog.blogUsername || blog.username,
            blogPassword: blog.blogPassword || blog.password
        };

        console.log(`[WordPress] Language detection for blog:`, {
            url: blogConfig.blogUrl,
            username: blogConfig.blogUsername ? '***' : 'undefined'
        });

        // Validate blog configuration
        if (!blogConfig.blogUrl || blogConfig.blogUrl === 'undefined' || !blogConfig.blogUrl.startsWith('http')) {
            console.log(`[WordPress] Invalid blog URL: ${blogConfig.blogUrl}, using default language: en`);
            return 'en';
        }

        if (!blogConfig.blogUsername || !blogConfig.blogPassword) {
            console.log('[WordPress] Missing blog credentials, using default language: en');
            return 'en';
        }

        const axios = require('axios');
        
        // Clean and validate the blog URL
        let baseUrl = blogConfig.blogUrl.trim();
        if (baseUrl.endsWith('/')) {
            baseUrl = baseUrl.slice(0, -1);
        }
        
        console.log(`[WordPress] Attempting language detection for: ${baseUrl}`);
        
        // Try to get site settings first (requires authentication)
        try {
            const settingsUrl = `${baseUrl}/wp-json/wp/v2/settings`;
            
            const response = await axios.get(settingsUrl, {
                auth: {
                    username: blogConfig.blogUsername,
                    password: blogConfig.blogPassword
                },
                timeout: 5000,
                validateStatus: function (status) {
                    return status < 500; // Accept any status code below 500
                }
            });
            
            if (response.status === 200 && response.data && response.data.language) {
                const lang = response.data.language.split('_')[0]; // Extract language code from locale
                console.log(`[WordPress] Detected language from settings: ${lang}`);
                return lang;
            }
        } catch (settingsError) {
            console.log(`[WordPress] Settings API not accessible: ${settingsError.message}`);
        }
        
        // Fallback: Try to detect from site content (no authentication required)
        try {
            const postsUrl = `${baseUrl}/wp-json/wp/v2/posts?per_page=1`;
            const postsResponse = await axios.get(postsUrl, {
                timeout: 5000,
                validateStatus: function (status) {
                    return status < 500; // Accept any status code below 500
                }
            });
            
            if (postsResponse.status === 200 && postsResponse.data && postsResponse.data.length > 0) {
                const content = postsResponse.data[0].content.rendered || postsResponse.data[0].title.rendered;
                const detectedLang = detectLanguageFromContent(content);
                console.log(`[WordPress] Detected language from content: ${detectedLang}`);
                return detectedLang;
            }
        } catch (postsError) {
            console.log(`[WordPress] Posts API not accessible: ${postsError.message}`);
        }
        
        // Last fallback: Try to detect from the existing post content using WordPress client
        try {
            console.log('[WordPress] Trying to detect language from existing posts using WordPress client');
            const client = wordpress.createClient({
                username: blogConfig.blogUsername,
                url: blogConfig.blogUrl,
                password: blogConfig.blogPassword
            });
            
            const posts = await new Promise((resolve, reject) => {
                client.getPosts({ number: 1 }, (err, posts) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(posts);
                    }
                });
            });
            
            if (posts && posts.length > 0) {
                const content = posts[0].content || posts[0].title;
                const detectedLang = detectLanguageFromContent(content);
                console.log(`[WordPress] Detected language from WordPress client: ${detectedLang}`);
                return detectedLang;
            }
        } catch (clientError) {
            console.log(`[WordPress] WordPress client detection failed: ${clientError.message}`);
        }
        
        // Ultimate fallback
        console.log('[WordPress] All detection methods failed, using default language: en');
        return 'en';
        
    } catch (error) {
        console.error('[WordPress] Language detection error:', error.message);
        return 'en'; // Default to English on any error
    }
}

/**
 * Detect language from content using simple heuristics
 * @param {string} content - Content to analyze
 * @returns {string} Detected language code
 */
function detectLanguageFromContent(content) {
    if (!content) return 'en';
    
    // Remove HTML tags
    const cleanContent = content.replace(/<[^>]*>/g, '').trim();
    
    // Japanese detection (Hiragana, Katakana, Kanji)
    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(cleanContent)) {
        return 'ja';
    }
    
    // Chinese detection (traditional and simplified)
    if (/[\u4E00-\u9FFF]/.test(cleanContent)) {
        return 'zh';
    }
    
    // Korean detection
    if (/[\uAC00-\uD7AF]/.test(cleanContent)) {
        return 'ko';
    }
    
    // Spanish detection (common Spanish words and characters)
    if (/[ñáéíóúü]/.test(cleanContent.toLowerCase()) || 
        /\b(el|la|los|las|un|una|de|en|con|por|para|que|no|se|es|muy|más)\b/.test(cleanContent.toLowerCase())) {
        return 'es';
    }
    
    // French detection
    if (/[àâäéèêëïîôöùûüÿç]/.test(cleanContent.toLowerCase()) || 
        /\b(le|la|les|un|une|de|du|des|et|en|avec|pour|que|ne|se|est|très|plus)\b/.test(cleanContent.toLowerCase())) {
        return 'fr';
    }
    
    // German detection
    if (/[äöüß]/.test(cleanContent.toLowerCase()) || 
        /\b(der|die|das|ein|eine|und|in|mit|für|dass|nicht|sich|ist|sehr|mehr)\b/.test(cleanContent.toLowerCase())) {
        return 'de';
    }
    
    // Default to English
    return 'en';
}

/**
 * Get language-specific prompt for AI summarization
 * @param {string} language - Language code
 * @returns {string} Localized prompt
 */
function getLanguageSpecificPrompt(language) {
    const prompts = {
        'ja': `以下の記事を簡潔で分かりやすく要約してください。主要なポイントを3-5つの箇条書きで示し、読者にとって有益な情報を抽出してください。

要約の条件:
- 記事の核心となる3-5つのポイントを抽出
- 各ポイントは簡潔で分かりやすい日本語で表現
- 読者にとって価値のある情報を優先
- 不要な詳細は省略し、本質的な内容に焦点

記事タイトル: {{TITLE}}

記事内容:
{{CONTENT}}

要約:`,

        'zh': `请简洁明了地总结以下文章。用3-5个要点列出主要内容，提取对读者有价值的信息。

总结要求:
- 提取文章的3-5个核心要点
- 每个要点用简洁易懂的中文表达
- 优先考虑对读者有价值的信息
- 省略不必要的细节，专注于本质内容

文章标题: {{TITLE}}

文章内容:
{{CONTENT}}

总结:`,

        'ko': `다음 기사를 간결하고 이해하기 쉽게 요약해 주세요. 주요 포인트를 3-5개의 항목으로 나열하고, 독자에게 유익한 정보를 추출해 주세요.

요약 조건:
- 기사의 핵심이 되는 3-5개 포인트 추출
- 각 포인트는 간결하고 이해하기 쉬운 한국어로 표현
- 독자에게 가치 있는 정보를 우선시
- 불필요한 세부사항은 생략하고 본질적인 내용에 집중

기사 제목: {{TITLE}}

기사 내용:
{{CONTENT}}

요약:`,

        'es': `Resume el siguiente artículo de manera concisa y comprensible. Presenta los puntos principales en 3-5 viñetas y extrae información valiosa para los lectores.

Condiciones del resumen:
- Extraer 3-5 puntos centrales del artículo
- Cada punto debe expresarse en español claro y conciso
- Priorizar información valiosa para los lectores
- Omitir detalles innecesarios y enfocarse en el contenido esencial

Título del artículo: {{TITLE}}

Contenido del artículo:
{{CONTENT}}

Resumen:`,

        'fr': `Veuillez résumer l'article suivant de manière concise et compréhensible. Présentez les points principaux en 3-5 puces et extrayez les informations précieuses pour les lecteurs.

Conditions du résumé:
- Extraire 3-5 points centraux de l'article
- Chaque point doit être exprimé en français clair et concis
- Prioriser les informations précieuses pour les lecteurs
- Omettre les détails inutiles et se concentrer sur le contenu essentiel

Titre de l'article: {{TITLE}}

Contenu de l'article:
{{CONTENT}}

Résumé:`,

        'de': `Fassen Sie den folgenden Artikel prägnant und verständlich zusammen. Stellen Sie die Hauptpunkte in 3-5 Stichpunkten dar und extrahieren Sie wertvolle Informationen für die Leser.

Zusammenfassungsbedingungen:
- 3-5 zentrale Punkte des Artikels extrahieren
- Jeder Punkt soll in klarem und prägnanten Deutsch ausgedrückt werden
- Wertvolle Informationen für die Leser priorisieren
- Unnötige Details weglassen und sich auf den wesentlichen Inhalt konzentrieren

Artikeltitel: {{TITLE}}

Artikelinhalt:
{{CONTENT}}

Zusammenfassung:`,

        'en': `Please summarize the following article concisely and clearly. Present the main points in 3-5 bullet points and extract valuable information for readers.

Summary conditions:
- Extract 3-5 core points from the article
- Each point should be expressed in clear and concise English
- Prioritize valuable information for readers
- Omit unnecessary details and focus on essential content

Article title: {{TITLE}}

Article content:
{{CONTENT}}

Summary:`
    };

    return prompts[language] || prompts['en'];
}

async function fetchSingleBlogPost(blogInfo, postId) {
  const client = wordpress.createClient({
    username: blogInfo.blogUsername,
    url: blogInfo.blogUrl,
    password: blogInfo.blogPassword
  });

  return new Promise((resolve, reject) => {
    client.getPost(postId, (err, post) => {
      if (err) {
        return reject(err);
      }
      resolve(post);
    });
  });
}

module.exports = { getCategoryId, categoryExists, ensureCategory, getPostLink, getTermDetails, checkLoginInfo, post, fetchBlogPosts, fetchSingleBlogPost, updatePostContent, getWordPressLanguage, getLanguageSpecificPrompt };
