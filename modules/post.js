var wordpress = require("wordpress");

async function categoryExists(name,type, option) {
  const client = wordpress.createClient(option);

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

async function ensureCategory(category,type, option) {
  try {
    const existingCategoryId = await categoryExists(category.name,type, option);
    if (existingCategoryId) return existingCategoryId; // If exists, return the ID
    // If the category doesn't exist, create a new one
    const client = wordpress.createClient(option);
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

async function createCategories(categories,type, option) {
  const categoryIds = [];
  for (let category of categories) {
    const categoryId = await ensureCategory(category,type, option);
    categoryIds.push(categoryId);
  }
  return categoryIds;
}

async function getTermDetails(id, type, option) {
  const client = wordpress.createClient(option);

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

async function post(title, content, categories, tags, option) {
  try {
    const categoryIds = await createCategories(categories,'category',option);
    const tagIds = await createCategories(tags, 'post_tag', option);
    // Create a new post with all the category IDs
    const client = wordpress.createClient(option);
    return new Promise((resolve, reject) => {
      client.newPost({
        title: title,
        status: 'publish',
        type: 'post',
        terms: {
          'category': categoryIds, 
          'post_tag': tagIds 
        },        
        commentStatus: 'closed',
        content: content
      }, function(error, data) {
        if (error) {
          console.error(`Error creating new post: ${error}`);
          reject(error);
        } else {
          console.log(`Post created successfully: ${data}`);
          resolve(data);
        }
      });
    });
  } catch (error) {
    console.error(`Error posting content: ${error}`);
    throw error; // Allows the caller to handle the error
  }
}

module.exports = { categoryExists,ensureCategory,getTermDetails, post };
