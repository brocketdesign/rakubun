function generatePrompt(data, type) {
    let result = { prompt: '', max_tokens: 0 };
    switch (type) {
        case '4':
            // Setting up for tweet generation
            const { SECTION, COUNT, TITLE, WRITING_STYLE, LANGUAGE, WRITING_TONE } = data;
            result.prompt = `Write ${COUNT} tweets in ${LANGUAGE} with a ${WRITING_STYLE} style. It is to promote a blog post titled "${TITLE}" and the topic I want to focus on is ${SECTION}. The tweets should be composed in a ${WRITING_TONE} tone.`;
            result.max_tokens = 50; // Assuming max length of a tweet
            break;
        case '1':
            // Setting up for title generation
            const { KEYWORDS,COUNT:titleCount, LANGUAGE : titleLanguage,WRITING_STYLE: titleStyle, WRITING_TONE : titleTone } = data;
            result.prompt = `Generate ${titleCount} creative and SEO-friendly ${titleCount>1?'titles':'title'} in ${titleLanguage} for a blog post related to the following keywords: ${KEYWORDS}. Style: ${titleStyle}. Use a ${titleTone} tone. Use Markdown for the title (# ).`;
            result.max_tokens = 100; // Titles are usually short and sweet
            break;
        case '2':
            // Setting up for section heading generation
            const { SECTIONS_COUNT,SECTION_SUBJECT, TITLE: sectionTitle, WRITING_STYLE: sectionStyle, LANGUAGE: sectionLanguage, WRITING_TONE: sectionTone } = data;
            result.prompt = `I’m writing a blog post with the title [${sectionTitle}]. Write ${SECTIONS_COUNT} headings for a blog post outline in ${sectionLanguage}.${SECTION_SUBJECT[0].length>0?`The heading subjects are : ${SECTION_SUBJECT}`:''} Style: ${sectionStyle}. Tone: ${sectionTone}. Each heading is between 40 and 60 characters. Use Markdown for the headings (# ).`;
            result.max_tokens = 200; // Approximation for section headings
            break;
        case '3':
            // Setting up for article paragraph generation
            const { SECTION: articleSection, TITLE: articleTitle, WRITING_STYLE: articleStyle, LANGUAGE: articleLanguage, WRITING_TONE: articleTone } = data;
            result.prompt = `Write a paragraph about "${articleSection}" for an article "${articleTitle}" in ${articleLanguage}. Use Markdown for formatting. Style: ${articleStyle}. Tone: ${articleTone}.`;
            result.max_tokens = 1000; // A decent length for a paragraph
            break;
        default:
            result.prompt = 'Oops! You need to specify a valid type for the prompt.';
            result.max_tokens = 0;
    }
    return result;
}

module.exports = { generatePrompt };
