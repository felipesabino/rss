import * as cheerio from 'cheerio';
import { got } from 'got';
import path from 'path';
import { URL } from 'url';
import { NON_TEXT_DOMAINS, NON_TEXT_EXTENSIONS } from '../../config/constants';

/**
 * Check if a URL points to non-text content that should be skipped for analysis
 */
export function isNonTextContent(url: string): { skip: boolean; reason: string; mediaType?: string; mediaUrl?: string } {
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
        mediaType,
        mediaUrl: url
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
        mediaType,
        mediaUrl: url
      };
    }
    
    // Check for query parameters that might indicate media content
    if (parsedUrl.searchParams.has('v') && domain === 'youtube.com') {
      return { 
        skip: true, 
        reason: 'YouTube video detected',
        mediaType: 'video',
        mediaUrl: url
      };
    }
    
    return { skip: false, reason: '' };
  } catch (error) {
    console.error(`Error checking URL ${url}:`, error);
    return { skip: false, reason: '' };
  }
}

export async function contentExtractor(url: string): Promise<{ content: string; skipReason?: string; mediaType?: string; mediaUrl?: string }> {
  // Check if the URL points to non-text content
  const nonTextCheck = isNonTextContent(url);
  if (nonTextCheck.skip) {
    console.log(`Skipping content extraction for ${url}: ${nonTextCheck.reason}`);
    return { 
      content: '', 
      skipReason: nonTextCheck.reason,
      mediaType: nonTextCheck.mediaType,
      mediaUrl: nonTextCheck.mediaUrl
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
        mediaType,
        mediaUrl: url
      };
    }
    
    const html = response.body;
    const $ = cheerio.load(html);

    // Check for common indicators of non-text content
    const iframeCount = $('iframe').length;
    const videoEmbeds = $('video, .video-container, .youtube-container, [class*="video"], [id*="video"]').length;
    const imageCount = $('img').length;
    const audioEmbeds = $('audio, [class*="audio"], [id*="audio"]').length;
    
    // Extract the body text first to evaluate content amount
    const bodyText = $('body').text().trim();
    const textLength = bodyText.length;
    
    // Check for media-heavy content, but only skip if there's not enough text
    if (iframeCount > 0 || videoEmbeds > 0) {
      // Check specifically for video embeds
      const youtubeEmbed = $('iframe[src*="youtube"], iframe[src*="youtu.be"]').length > 0;
      const vimeoEmbed = $('iframe[src*="vimeo"]').length > 0;
      
      // If it's a YouTube or Vimeo embed with very little text, skip extraction
      // but use a higher threshold (1000 chars) to ensure we're not missing substantial content
      if ((youtubeEmbed || vimeoEmbed) && textLength < 1000) {
        const platform = youtubeEmbed ? 'YouTube' : 'Vimeo';
        
        // Extract the embed URL
        let mediaUrl = url;
        if (youtubeEmbed) {
          const embedElement = $('iframe[src*="youtube"], iframe[src*="youtu.be"]').first();
          const embedSrc = embedElement.attr('src');
          if (embedSrc) {
            mediaUrl = embedSrc;
          }
        } else if (vimeoEmbed) {
          const embedElement = $('iframe[src*="vimeo"]').first();
          const embedSrc = embedElement.attr('src');
          if (embedSrc) {
            mediaUrl = embedSrc;
          }
        }
        
        console.log(`Skipping content extraction for ${url}: ${platform} video embed detected with limited text (${textLength} chars)`);
        return {
          content: '',
          skipReason: `${platform} video embed with limited text content`,
          mediaType: 'video',
          mediaUrl
        };
      }
      
      // For generic iframe or video embed, only skip if there's very little text
      // Use a threshold based on the number of embeds - more embeds require more text to justify extraction
      const textThreshold = Math.max(500, (iframeCount + videoEmbeds) * 200);
      if (textLength < textThreshold) {
        // Try to extract a media URL from any iframe or video element
        let mediaUrl = url;
        const firstIframe = $('iframe').first();
        if (firstIframe.length > 0 && firstIframe.attr('src')) {
          mediaUrl = firstIframe.attr('src') || url;
        } else {
          const firstVideo = $('video source').first();
          if (firstVideo.length > 0 && firstVideo.attr('src')) {
            mediaUrl = firstVideo.attr('src') || url;
          }
        }
        
        console.log(`Skipping content extraction for ${url}: Media embed detected (${iframeCount} iframes, ${videoEmbeds} videos) with limited text (${textLength} chars)`);
        return {
          content: '',
          skipReason: `Media embed with limited text content (${textLength} chars)`,
          mediaType: 'video',
          mediaUrl
        };
      } else {
        console.log(`Found media embeds (${iframeCount} iframes, ${videoEmbeds} videos) but also substantial text (${textLength} chars), proceeding with extraction`);
      }
    }
    
    // Check for image galleries or audio content, but only skip if there's not enough text
    if (imageCount > 5 && textLength < 1000) {
      // Try to extract the first image URL
      let mediaUrl = url;
      const firstImage = $('img').first();
      if (firstImage.length > 0 && firstImage.attr('src')) {
        mediaUrl = firstImage.attr('src') || url;
        // Make sure the URL is absolute
        if (!mediaUrl.startsWith('http')) {
          try {
            mediaUrl = new URL(mediaUrl, url).toString();
          } catch (e) {
            mediaUrl = url;
          }
        }
      }
      
      console.log(`Skipping content extraction for ${url}: Likely image gallery (${imageCount} images) with limited text (${textLength} chars)`);
      return {
        content: '',
        skipReason: `Image gallery detected (${imageCount} images) with limited text`,
        mediaType: 'image',
        mediaUrl
      };
    }
    
    // For audio embeds, require more text to justify extraction
    if (audioEmbeds > 0 && textLength < 800) {
      // Try to extract the audio URL
      let mediaUrl = url;
      const audioElement = $('audio source').first();
      if (audioElement.length > 0 && audioElement.attr('src')) {
        mediaUrl = audioElement.attr('src') || url;
        // Make sure the URL is absolute
        if (!mediaUrl.startsWith('http')) {
          try {
            mediaUrl = new URL(mediaUrl, url).toString();
          } catch (e) {
            mediaUrl = url;
          }
        }
      }
      
      console.log(`Skipping content extraction for ${url}: Audio content detected with limited text (${textLength} chars)`);
      return {
        content: '',
        skipReason: `Audio content with limited text`,
        mediaType: 'audio',
        mediaUrl
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
        mediaType: 'unknown',
        mediaUrl: url
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
        mediaType: 'unknown',
        mediaUrl: url
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
        mediaType: 'unknown',
        mediaUrl: url
      };
    }
    
    return { content: '', mediaUrl: url };
  }
}
