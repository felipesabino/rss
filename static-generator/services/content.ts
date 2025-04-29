import * as cheerio from 'cheerio';
import { got } from 'got';
import path from 'path';
import { URL } from 'url';
import { NON_TEXT_DOMAINS, NON_TEXT_EXTENSIONS } from '../../config/constants';

/**
 * Check if a URL points to non-text content that should be skipped for analysis
 */
export function isNonTextContent(url: string): { skip: boolean; reason: string; mediaType?: string } {
  try {
    // Parse the URL
    const parsedUrl = new URL(url);
    
    // Check domain
    const domain = parsedUrl.hostname.replace('www.', '');
    
    // Media hosting domains
    if (NON_TEXT_DOMAINS.some(nonTextDomain => domain.includes(nonTextDomain))) {
      // Determine media type based on domain
      let mediaType = 'media';
      
      if (domain.includes('youtube') || domain.includes('vimeo') || domain.includes('dailymotion') || domain.includes('twitch')) {
        mediaType = 'video';
      } else if (domain.includes('spotify') || domain.includes('soundcloud')) {
        mediaType = 'audio';
      } else if (domain.includes('flickr') || domain.includes('imgur') || domain.includes('instagram') || domain.includes('pinterest')) {
        mediaType = 'image';
      } else if (domain.includes('drive.google') || domain.includes('docs.google') || domain.includes('dropbox')) {
        mediaType = 'document';
      }
      
      return { 
        skip: true, 
        reason: `Media hosting domain detected: ${domain}`,
        mediaType
      };
    }
    
    // Check file extension
    const extension = path.extname(parsedUrl.pathname).toLowerCase();
    if (extension && NON_TEXT_EXTENSIONS.includes(extension)) {
      // Determine media type based on extension
      let mediaType = 'media';
      
      if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico'].includes(extension)) {
        mediaType = 'image';
      } else if (['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm'].includes(extension)) {
        mediaType = 'video';
      } else if (['.mp3', '.wav', '.ogg'].includes(extension)) {
        mediaType = 'audio';
      } else if (['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'].includes(extension)) {
        mediaType = 'document';
      } else if (['.zip', '.rar', '.tar', '.gz', '.7z'].includes(extension)) {
        mediaType = 'archive';
      }
      
      return { 
        skip: true, 
        reason: `Non-text file extension detected: ${extension}`,
        mediaType
      };
    }
    
    // Check for query parameters that might indicate media content
    if (parsedUrl.searchParams.has('v') && domain === 'youtube.com') {
      return { 
        skip: true, 
        reason: 'YouTube video detected',
        mediaType: 'video'
      };
    }
    
    return { skip: false, reason: '' };
  } catch (error) {
    console.error(`Error checking URL ${url}:`, error);
    return { skip: false, reason: '' };
  }
}

export async function contentExtractor(url: string): Promise<{ content: string; skipReason?: string; mediaType?: string }> {
  // Check if the URL points to non-text content
  const nonTextCheck = isNonTextContent(url);
  if (nonTextCheck.skip) {
    console.log(`Skipping content extraction for ${url}: ${nonTextCheck.reason}`);
    return { 
      content: '', 
      skipReason: nonTextCheck.reason 
    };
  }
  
  //handle reddit
  let urlProcessed = url;
  if (url.includes('www.reddit.com')) {
    urlProcessed = url.replace('www.reddit.com', 'old.reddit.com');
  };
  
  try {
    const response = await got(urlProcessed, {
      timeout: {
        request: 10000 // 10 seconds timeout
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    // Check content type header to avoid processing binary files
    const contentType = response.headers['content-type'] || '';
    if (contentType.includes('image/') || 
        contentType.includes('video/') || 
        contentType.includes('audio/') ||
        contentType.includes('application/pdf') ||
        contentType.includes('application/zip') ||
        contentType.includes('application/x-rar')) {
      
      let mediaType = 'media';
      if (contentType.includes('image/')) {
        mediaType = 'image';
      } else if (contentType.includes('video/')) {
        mediaType = 'video';
      } else if (contentType.includes('audio/')) {
        mediaType = 'audio';
      } else if (contentType.includes('application/pdf')) {
        mediaType = 'document';
      } else if (contentType.includes('application/zip') || contentType.includes('application/x-rar')) {
        mediaType = 'archive';
      }
      
      console.log(`Skipping content extraction for ${url}: Non-text content type detected: ${contentType}`);
      return { 
        content: '', 
        skipReason: `Non-text content type: ${contentType}`,
        mediaType
      };
    }
    
    const html = response.body;
    const $ = cheerio.load(html);

    // Check for common indicators of non-text content
    const iframeCount = $('iframe').length;
    const videoEmbeds = $('video, .video-container, .youtube-container, [class*="video"], [id*="video"]').length;
    const imageCount = $('img').length;
    const audioEmbeds = $('audio, [class*="audio"], [id*="audio"]').length;
    
    // Check for media-heavy content
    if (iframeCount > 0 || videoEmbeds > 0) {
      // Check specifically for video embeds
      const youtubeEmbed = $('iframe[src*="youtube"], iframe[src*="youtu.be"]').length > 0;
      const vimeoEmbed = $('iframe[src*="vimeo"]').length > 0;
      
      if (youtubeEmbed || vimeoEmbed) {
        const platform = youtubeEmbed ? 'YouTube' : 'Vimeo';
        console.log(`Skipping content extraction for ${url}: ${platform} video embed detected`);
        return {
          content: '',
          skipReason: `${platform} video embed detected`,
          mediaType: 'video'
        };
      }
      
      // Generic iframe or video embed
      if (iframeCount > 0 || videoEmbeds > 0) {
        console.log(`Skipping content extraction for ${url}: Media embed detected (${iframeCount} iframes, ${videoEmbeds} videos)`);
        return {
          content: '',
          skipReason: `Media embed detected`,
          mediaType: 'video'
        };
      }
    }
    
    // Check for image galleries or audio content
    const bodyText = $('body').text().trim();
    if ((imageCount > 5 && bodyText.length < 500) || audioEmbeds > 0) {
      const mediaType = imageCount > 5 ? 'image' : 'audio';
      console.log(`Skipping content extraction for ${url}: Likely ${mediaType} content`);
      return {
        content: '',
        skipReason: imageCount > 5 ? `Image gallery detected (${imageCount} images)` : `Audio content detected`,
        mediaType
      };
    }

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
    
    // Check if the extracted content is too short or likely not meaningful
    if (content.length < 100) {
      console.log(`Extracted content from ${url} is very short (${content.length} chars), may not be suitable for analysis`);
      
      // If content is extremely short, treat it as non-text
      if (content.length < 50) {
        return {
          content: '',
          skipReason: `Insufficient text content (${content.length} chars)`,
          mediaType: 'unknown'
        };
      }
    }

    // Check for content that's mostly whitespace or punctuation
    const textualContent = content.replace(/[\s\n\r\t.,;:!?()[\]{}'"\/\\<>+\-=_*&^%$#@~`|]/g, '');
    if (textualContent.length < 50) {
      console.log(`Content from ${url} has insufficient textual content (${textualContent.length} chars)`);
      return {
        content: '',
        skipReason: `Insufficient textual content (${textualContent.length} meaningful chars)`,
        mediaType: 'unknown'
      };
    }

    return { content };
  } catch (error: any) {
    console.error(`Error extracting content from ${url}:`, error.message || error.toString().substring(0, 100) || 'Unknown error');
    
    // Try to determine if it's a non-text URL based on the error
    const errorMessage = error.toString().toLowerCase();
    if (errorMessage.includes('unsupported protocol') || 
        errorMessage.includes('invalid content-type') ||
        errorMessage.includes('content-length')) {
      
      return {
        content: '',
        skipReason: 'Error suggesting non-text content',
        mediaType: 'unknown'
      };
    }
    
    return { content: '' };
  }
}
