import * as cheerio from 'cheerio';
import { got } from 'got';

export async function contentExtractor(url: string): Promise<string> {
  
  //handle reddit
  let urlProcessed = url;
  if (url.includes('www.reddit.com')) {
    urlProcessed = url.replace('www.reddit.com', 'old.reddit.com');
  };
  
  try {
    const response = await got(urlProcessed, {
      timeout: {
        request: 10000 // 10 seconds timeout
      }
    });
    const html = response.body;
    const $ = cheerio.load(html);

    // Remove script tags, style tags, and comments
    $('script').remove();
    $('style').remove();
    $('noscript').remove();
    $('iframe').remove();
    $('header').remove();
    $('footer').remove();
    $('nav').remove();
    $('aside').remove();
    
    // Find the main content
    let content = '';
    const possibleContainers = [
      'article',
      '[role="main"]',
      '.post-content',
      '.article-content',
      '.entry-content',
      '.content',
      'main',
    ];

    for (const selector of possibleContainers) {
      const element = $(selector);
      if (element.length > 0) {
        content = element.text().trim();
        break;
      }
    }

    // Fallback to body if no content found
    if (!content) {
      content = $('body').text().trim();
    }

    return content;
  } catch (error) {
    console.error(`Error extracting content from ${url}:`, error);
    return '';
  }
}
