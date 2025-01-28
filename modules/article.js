/**
 * Generates a complete article based on the provided title and blog information.
 *
 * @param {string} fetchTitle - The title of the article.
 * @param {object} blogInfo - Additional blog information.
 * @param {string} modelGPT - The GPT model to use.
 * @returns {Promise<string>} - The complete article.
 */
const { sendNotificationToUser } = require('../modules/websocket.js');
const { generateCompletion } = require('../modules/openai.js')

const generateSimpleArticle = async (fetchTitle, blogInfo, modelGPT) => {
  const userId = blogInfo.userId
  const statusSelector = `#status_${blogInfo.botId}`
  // Generate the prompt for the article
  const generatePrompt = (title, info) => {
    return `Write a comprehensive article titled "${title}". Include an introduction, body, and conclusion. The article should be informative and engaging. Use the following blog information: ${JSON.stringify(info)}.`;
  };

  // Create messages for OpenAI API
  const createMessages = (prompt) => {
    return [
      {
        role: 'system',
        content: 'You are a professional writer. Write a clear, concise, and logical article. Avoid repetition and provide consistent content.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ];
  };

  // Generate the article
  const generateArticle = async (title, info, model) => {
    const prompt = generatePrompt(title, info);
    const messages = createMessages(prompt);
    const article = await generateCompletion(
      messages,
      1500, 
      null,
      info.postLanguage
    );
    return article.trim();
  };

  // Start generating the article
  console.log(`Generating Article`);
  await sendNotificationToUser(userId, 'updateElementText', {selector:statusSelector, message:'Generating Article'})
  const article = await generateArticle(fetchTitle, blogInfo, modelGPT);

  console.log(`Article Generation Complete`);
  await sendNotificationToUser(userId, 'updateElementText', {selector:statusSelector, message:'Article Generation Complete'})
  return article;
};

module.exports = { generateSimpleArticle };