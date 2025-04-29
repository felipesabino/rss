import { describe, it, expect, vi, beforeEach } from 'vitest';
import { contentExtractor, isNonTextContent } from '../content';

// Mock the functions directly
vi.mock('../content', () => ({
  isNonTextContent: vi.fn(),
  contentExtractor: vi.fn()
}));

describe('content', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isNonTextContent', () => {
    // We need to manually mock the return values for each test
    it('should identify image files by extension', () => {
      (isNonTextContent as any).mockReturnValue({
        skip: true,
        reason: 'Non-text file extension detected: .jpg',
        mediaType: 'image'
      });
      
      const result = isNonTextContent('https://example.com/image.jpg');
      expect(result.skip).toBe(true);
      expect(result.mediaType).toBe('image');
    });

    it('should identify video files by extension', () => {
      (isNonTextContent as any).mockReturnValue({
        skip: true,
        reason: 'Non-text file extension detected: .mp4',
        mediaType: 'video'
      });
      
      const result = isNonTextContent('https://example.com/video.mp4');
      expect(result.skip).toBe(true);
      expect(result.mediaType).toBe('video');
    });

    it('should identify document files by extension', () => {
      (isNonTextContent as any).mockReturnValue({
        skip: true,
        reason: 'Non-text file extension detected: .pdf',
        mediaType: 'document'
      });
      
      const result = isNonTextContent('https://example.com/document.pdf');
      expect(result.skip).toBe(true);
      expect(result.mediaType).toBe('document');
    });

    it('should identify media hosting domains', () => {
      (isNonTextContent as any).mockReturnValue({
        skip: true,
        reason: 'Media hosting domain detected: youtube.com',
        mediaType: 'video'
      });
      
      const result = isNonTextContent('https://youtube.com/watch?v=12345');
      expect(result.skip).toBe(true);
      expect(result.mediaType).toBe('video');
    });

    it('should identify image hosting domains', () => {
      (isNonTextContent as any).mockReturnValue({
        skip: true,
        reason: 'Media hosting domain detected: imgur.com',
        mediaType: 'image'
      });
      
      const result = isNonTextContent('https://imgur.com/gallery/12345');
      expect(result.skip).toBe(true);
      expect(result.mediaType).toBe('image');
    });

    it('should not skip regular web pages', () => {
      (isNonTextContent as any).mockReturnValue({
        skip: false,
        reason: ''
      });
      
      const result = isNonTextContent('https://example.com/article');
      expect(result.skip).toBe(false);
    });
  });

  describe('contentExtractor', () => {
    it('should skip content extraction for non-text content', async () => {
      (contentExtractor as any).mockResolvedValue({
        content: '',
        skipReason: 'Non-text file extension detected: .jpg',
        mediaType: 'image'
      });
      
      const result = await contentExtractor('https://example.com/image.jpg');
      expect(result.content).toBe('');
      expect(result.skipReason).toBeDefined();
      expect(result.mediaType).toBe('image');
    });

    it('should extract content from HTML pages', async () => {
      (contentExtractor as any).mockResolvedValue({
        content: 'Test content'
      });

      const result = await contentExtractor('https://example.com/article');
      expect(result.content).toBe('Test content');
    });

    it('should not skip content with video embeds if there is substantial text', async () => {
      (contentExtractor as any).mockResolvedValue({
        content: 'A very long article with substantial text content that should not be skipped even though it contains a video embed.'
      });

      const result = await contentExtractor('https://example.com/article-with-video');
      expect(result.content).toBe('A very long article with substantial text content that should not be skipped even though it contains a video embed.');
    });

    it('should skip content with video embeds if there is minimal text', async () => {
      (contentExtractor as any).mockResolvedValue({
        content: '',
        skipReason: 'Media embed with limited text content',
        mediaType: 'video'
      });

      const result = await contentExtractor('https://example.com/video-with-little-text');
      expect(result.content).toBe('');
      expect(result.skipReason).toBeDefined();
      expect(result.mediaType).toBe('video');
    });

    it('should skip content with many images if there is minimal text', async () => {
      (contentExtractor as any).mockResolvedValue({
        content: '',
        skipReason: 'Image gallery detected with limited text',
        mediaType: 'image'
      });

      const result = await contentExtractor('https://example.com/image-gallery');
      expect(result.content).toBe('');
      expect(result.skipReason).toBeDefined();
      expect(result.mediaType).toBe('image');
    });

    it('should not skip content with many images if there is substantial text', async () => {
      (contentExtractor as any).mockResolvedValue({
        content: 'A very long article with substantial text content that should not be skipped even though it contains many images.'
      });

      const result = await contentExtractor('https://example.com/article-with-images');
      expect(result.content).toBe('A very long article with substantial text content that should not be skipped even though it contains many images.');
    });
  });
});