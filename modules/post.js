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

module.exports = { getCategoryId, categoryExists, ensureCategory, getPostLink, getTermDetails,checkLoginInfo, post };
