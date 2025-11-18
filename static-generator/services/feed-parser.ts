import Parser from 'rss-parser';
import got from 'got';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';

/**
 * Feed Parser Module
 * 
 * This module provides robust feed parsing capabilities to handle various feed formats
 * including RSS 1.0, RSS 2.0, and Atom. It implements multiple fallback strategies to
 * work around the "Feed not recognized as RSS 1 or 2" error that can occur with some feeds.
 * 
 * The fallback strategies include:
 * 1. Standard RSS parser with custom options
 * 2. Cheerio-based XML parsing for both RSS and Atom formats
 * 3. HTML page parsing to find RSS links
 */

// Types
export interface FeedItem {
  title: string;
  link: string;
  pubDate: string;
  content?: string;
  comments?: string;
}

export interface FeedMetadata {
  title?: string;
  description?: string;
  siteUrl?: string;
  iconUrl?: string;
  language?: string;
  lastBuildDate?: string;
}

export interface HttpResponse {
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
}

export interface FeedParser {
  parseURL(url: string): Promise<Parser.Output<any>>;
  parseString(content: string): Promise<Parser.Output<any>>;
}

export interface HttpClient {
  get(url: string, options: any): Promise<HttpResponse>;
}

export interface HtmlParser {
  load(content: string, options?: any): any;
}

// Map common encodings to Node.js BufferEncoding values
const ENCODING_MAP: Record<string, BufferEncoding> = {
  'utf-8': 'utf-8',
  'utf8': 'utf-8',
  'latin1': 'latin1',
  'iso-8859-1': 'latin1',
  'iso8859-1': 'latin1',
  'iso_8859-1': 'latin1',
  'windows-1252': 'latin1', // Windows-1252 is similar to Latin-1
  'windows1252': 'latin1',
  'cp1252': 'latin1',
  'ascii': 'ascii',
  'ucs2': 'ucs2',
  'ucs-2': 'ucs2',
  'utf16le': 'utf16le',
  'utf-16le': 'utf16le'
};

// Default implementations
export class DefaultFeedParser implements FeedParser {
  private parser: Parser;
  private originalParseURL: (url: string) => Promise<any>;

  constructor(private httpClient: HttpClient) {
    this.parser = new Parser({
      customFields: {
        item: ['comments']
      },
      defaultRSS: 2.0,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml; q=0.8, */*; q=0.5'
      }
    });

    this.originalParseURL = this.parser.parseURL.bind(this.parser);
    this.parser.parseURL = this.parseURL.bind(this);
  }

  async parseURL(url: string): Promise<{ items: any[] }> {
    try {
      // Always download the feed content using DefaultHttpClient
      const response = await this.httpClient.get(url, {
        responseType: 'buffer',
        resolveBodyOnly: false,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      // Try to detect encoding from XML declaration
      const xmlDeclaration = response.body.toString('ascii', 0, 200).match(/<\?xml[^>]*encoding=["']([^"']+)["'][^>]*\?>/i);
      let encoding = 'utf-8';

      if (xmlDeclaration && xmlDeclaration[1]) {
        encoding = xmlDeclaration[1].toLowerCase();
        console.log(`XML declaration encoding detected: ${encoding}`);
      } else {
        // Fall back to content-type header
        encoding = this.detectEncoding(response);
      }

      // Use iconv-lite to decode with the detected encoding
      let content: string;
      try {
        content = iconv.decode(response.body, encoding);
        console.log(`Successfully decoded content with encoding: ${encoding}`);
      } catch (iconvError: any) {
        console.error(`Error decoding with iconv-lite: ${iconvError.message}, falling back to utf-8`);
        content = response.body.toString('utf-8');
      }

      // Parse the content as a string
      return await this.parser.parseString(content);
    } catch (error: any) {
      // If all fails, try the original parser as a last resort
      console.log(`Custom parsing failed, trying original parser as last resort: ${error.message}`);
      return await this.originalParseURL(url);
    }
  }

  async parseString(content: string): Promise<{ items: any[] }> {
    return await this.parser.parseString(content);
  }

  private detectEncoding(response: HttpResponse): BufferEncoding {
    const contentType = response.headers['content-type'] || '';
    let encoding: BufferEncoding = 'utf-8'; // Default encoding

    // Try to extract charset from content-type header
    const charsetMatch = typeof contentType === 'string' ?
      contentType.match(/charset=([^;]+)/i) : null;

    if (charsetMatch && charsetMatch[1]) {
      const detectedEncoding = charsetMatch[1].trim().toLowerCase();

      if (detectedEncoding in ENCODING_MAP) {
        encoding = ENCODING_MAP[detectedEncoding];
      } else {
        console.log(`Unsupported encoding detected: ${detectedEncoding}, falling back to UTF-8`);
      }
    }

    return encoding;
  }
}

export class DefaultHttpClient implements HttpClient {
  async get(url: string, options: any): Promise<HttpResponse> {
    // Ensure User-Agent is set if not provided
    if (!options.headers) {
      options.headers = {};
    }
    if (!options.headers['User-Agent']) {
      options.headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    }

    // Cast the response to match our HttpResponse interface
    const response = await got(url, options);
    return response as unknown as HttpResponse;
  }
}

export class DefaultHtmlParser implements HtmlParser {
  load(content: string, options?: any): any {
    return cheerio.load(content, options);
  }
}

// Service class
export class FeedParserService {
  constructor(
    private feedParser: FeedParser,
    private httpClient: HttpClient,
    private htmlParser: HtmlParser
  ) { }

  /**
   * Parse a feed URL using multiple strategies to handle different feed formats
   * 
   * @param feedUrl The URL of the feed to parse
   * @param feedName The name of the feed (for logging purposes)
   * @returns An array of normalized feed items
   */
  async parseFeed(feedUrl: string, feedName: string): Promise<FeedItem[]> {
    try {
      // Initialize metadata object
      const metadata: FeedMetadata = {
        siteUrl: '',
        iconUrl: ''
      };

      // Strategy 1: Try the standard parser first
      try {
        const parsedFeed = await this.feedParser.parseURL(feedUrl);
        if (parsedFeed.items && Array.isArray(parsedFeed.items)) {
          console.log(`Successfully parsed with rss-parser: ${parsedFeed.items.length} items`);

          // Extract metadata from the parsed feed (for internal use)
          if (parsedFeed.link) {
            metadata.siteUrl = parsedFeed.link;
          }
          if (parsedFeed.image && parsedFeed.image.url) {
            metadata.iconUrl = parsedFeed.image.url;
          }
          if (parsedFeed.title) {
            metadata.title = parsedFeed.title;
          }
          if (parsedFeed.description) {
            metadata.description = parsedFeed.description;
          }
          if ((parsedFeed as any).language) {
            metadata.language = (parsedFeed as any).language;
          }
          if ((parsedFeed as any).lastBuildDate) {
            metadata.lastBuildDate = (parsedFeed as any).lastBuildDate;
          }

          // Store metadata for later retrieval
          this._lastMetadata = metadata;

          return parsedFeed.items;
        }
      } catch (parseError: any) {
        console.log(`Standard parsing failed for ${feedName}: ${parseError.message}`);

        // Strategy 2: If standard parsing fails, try our custom cheerio parser
        const result = await this.parseFeedWithCheerio(feedUrl);

        if (Array.isArray(result)) {
          return result;
        } else if (result.items.length > 0) {
          // Store metadata for later retrieval
          this._lastMetadata = result.metadata;
          return result.items;
        }

        // Strategy 3: Try to fetch as plain text and look for RSS links
        console.log(`Cheerio parsing failed to find items for ${feedName}, trying direct HTTP request...`);
        const response = await this.httpClient.get(feedUrl, {
          responseType: 'buffer',
          resolveBodyOnly: false
        });

        // Convert buffer to string with proper encoding
        const encoding = this.detectEncoding(response);
        const content = response.body.toString(encoding);

        // Check if it's an HTML page with RSS link
        const $ = this.htmlParser.load(content);
        const rssLink = $('link[type="application/rss+xml"]').attr('href');

        if (rssLink) {
          console.log(`Found RSS link in HTML: ${rssLink}`);
          // Resolve relative URL if needed
          const resolvedUrl = new URL(rssLink, feedUrl).toString();
          const cheerioResult = await this.parseFeedWithCheerio(resolvedUrl);

          if (Array.isArray(cheerioResult)) {
            return cheerioResult;
          } else {
            // Store metadata for later retrieval
            this._lastMetadata = cheerioResult.metadata;
            return cheerioResult.items;
          }
        }
      }

      // If all strategies fail, return empty array
      return [];
    } catch (error: any) {
      console.error(`Failed to parse feed ${feedName}: ${error.message}`);
      return [];
    }
  }

  // Store the last parsed metadata for retrieval by parseFeedWithMetadata
  private _lastMetadata: FeedMetadata = {
    siteUrl: '',
    iconUrl: ''
  };

  /**
   * Get the metadata from the last parsed feed
   */
  getLastMetadata(): FeedMetadata {
    return this._lastMetadata;
  }

  /**
   * Parse a feed URL and return both items and metadata
   * 
   * @param feedUrl The URL of the feed to parse
   * @param feedName The name of the feed (for logging purposes)
   * @returns An object containing feed items and metadata
   */
  async parseFeedWithMetadata(feedUrl: string, feedName: string): Promise<{ items: FeedItem[], metadata: FeedMetadata }> {
    const items = await this.parseFeed(feedUrl, feedName);
    return {
      items,
      metadata: this._lastMetadata
    };
  }

  /**
   * Parse feed content using cheerio to handle different feed formats
   * This is a fallback method when the standard RSS parser fails
   * 
   * @param feedUrl The URL of the feed to parse
   * @returns An array of feed items
   */
  private async parseFeedWithCheerio(feedUrl: string): Promise<FeedItem[] | { items: FeedItem[], metadata: FeedMetadata }> {
    try {
      console.log(`Fetching feed with cheerio: ${feedUrl}`);
      const response = await this.httpClient.get(feedUrl, {
        responseType: 'buffer',
        resolveBodyOnly: false
      });

      // Convert buffer to string with proper encoding
      const encoding = this.detectEncoding(response);
      const content = response.body.toString(encoding);
      const $ = this.htmlParser.load(content, { xmlMode: true });

      const feedItems: FeedItem[] = [];
      const metadata: FeedMetadata = {
        siteUrl: '',
        iconUrl: ''
      };

      // Extract feed metadata
      // Try to get site URL from alternate link
      const alternateLink = $('link[rel="alternate"]').attr('href');
      if (alternateLink) {
        metadata.siteUrl = alternateLink;
      }

      // Try to get icon URL
      const iconUrl = $('icon').text();
      if (iconUrl) {
        metadata.iconUrl = iconUrl;
      }

      // Try to get feed title
      const feedTitle = $('channel > title').text() || $('feed > title').text();
      if (feedTitle) {
        metadata.title = feedTitle;
      }

      // Try to get feed description
      const feedDescription = $('channel > description').text() || $('feed > subtitle').text();
      if (feedDescription) {
        metadata.description = feedDescription;
      }

      // Try to parse as RSS
      $('item').each((index: number, element: any) => {
        const $el = $(element);
        feedItems.push({
          title: $el.find('title').text(),
          link: $el.find('link').text(),
          pubDate: $el.find('pubDate').text() || new Date().toISOString(),
          content: $el.find('description').text() || $el.find('content\\:encoded').text(),
          comments: $el.find('comments').text()
        });
      });

      // If no items found, try to parse as Atom
      if (feedItems.length === 0) {
        $('entry').each((index: number, element: any) => {
          const $el = $(element);
          let link = $el.find('link').attr('href') || '';

          // If link is not found with href attribute, try text content
          if (!link) {
            link = $el.find('link').text();
          }

          feedItems.push({
            title: $el.find('title').text(),
            link: link,
            pubDate: $el.find('published').text() || $el.find('updated').text() || new Date().toISOString(),
            content: $el.find('content').text() || $el.find('summary').text(),
            comments: ''
          });
        });
      }

      console.log(`Parsed ${feedItems.length} items with cheerio`);
      return { items: feedItems, metadata };
    } catch (error: any) {
      console.error(`Error parsing feed with cheerio: ${error.message}`);
      return {
        items: [],
        metadata: {
          siteUrl: '',
          iconUrl: ''
        }
      };
    }
  }

  private detectEncoding(response: HttpResponse): BufferEncoding {
    const contentType = response.headers['content-type'] || '';
    let encoding: BufferEncoding = 'utf-8'; // Default encoding

    // Try to extract charset from content-type header
    const charsetMatch = typeof contentType === 'string' ?
      contentType.match(/charset=([^;]+)/i) : null;

    if (charsetMatch && charsetMatch[1]) {
      const detectedEncoding = charsetMatch[1].trim().toLowerCase();

      if (detectedEncoding in ENCODING_MAP) {
        encoding = ENCODING_MAP[detectedEncoding];
        console.log(`Encoding detected: ${detectedEncoding}`);
      } else {
        console.log(`Unsupported encoding detected: ${detectedEncoding}, falling back to UTF-8`);
      }
    } else {
      console.log(`charsetMatch not found in content-type: ${contentType}`);
    }

    return encoding;
  }
}

// Create default instances
const httpClient = new DefaultHttpClient();
const htmlParser = new DefaultHtmlParser();
const feedParser = new DefaultFeedParser(httpClient);
const feedParserService = new FeedParserService(feedParser, httpClient, htmlParser);

/**
 * Parse a feed URL using multiple strategies to handle different feed formats
 * 
 * @param feedUrl The URL of the feed to parse
 * @param feedName The name of the feed (for logging purposes)
 * @returns An array of normalized feed items
 */
export async function parseFeed(feedUrl: string, feedName: string): Promise<FeedItem[]> {
  return await feedParserService.parseFeed(feedUrl, feedName);
}

/**
 * Parse a feed URL and return both items and metadata
 * 
 * @param feedUrl The URL of the feed to parse
 * @param feedName The name of the feed (for logging purposes)
 * @returns An object containing feed items and metadata
 */
export async function parseFeedWithMetadata(feedUrl: string, feedName: string): Promise<{ items: FeedItem[], metadata: FeedMetadata }> {
  return await feedParserService.parseFeedWithMetadata(feedUrl, feedName);
}
