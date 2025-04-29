import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractYouTubeVideoId, isYouTubeUrl } from '../youtube-transcript';

describe('youtube-transcript', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractYouTubeVideoId', () => {
    it('should extract video ID from standard YouTube URL', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      const videoId = extractYouTubeVideoId(url);
      expect(videoId).toBe('dQw4w9WgXcQ');
    });

    it('should extract video ID from YouTube URL with additional parameters', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s';
      const videoId = extractYouTubeVideoId(url);
      expect(videoId).toBe('dQw4w9WgXcQ');
    });

    it('should extract video ID from YouTube embed URL', () => {
      const url = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
      const videoId = extractYouTubeVideoId(url);
      expect(videoId).toBe('dQw4w9WgXcQ');
    });

    it('should extract video ID from YouTube shortened URL', () => {
      const url = 'https://youtu.be/dQw4w9WgXcQ';
      const videoId = extractYouTubeVideoId(url);
      expect(videoId).toBe('dQw4w9WgXcQ');
    });

    it('should return null for non-YouTube URL', () => {
      const url = 'https://example.com/video';
      const videoId = extractYouTubeVideoId(url);
      expect(videoId).toBeNull();
    });
  });

  describe('isYouTubeUrl', () => {
    it('should return true for YouTube URLs', () => {
      expect(isYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
      expect(isYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
      expect(isYouTubeUrl('https://youtube.com/embed/dQw4w9WgXcQ')).toBe(true);
    });

    it('should return false for non-YouTube URLs', () => {
      expect(isYouTubeUrl('https://example.com/video')).toBe(false);
      expect(isYouTubeUrl('https://vimeo.com/123456')).toBe(false);
    });

    it('should handle invalid URLs gracefully', () => {
      expect(isYouTubeUrl('not a url')).toBe(false);
    });
  });

  // Note: We're not testing fetchYouTubeTranscript and extractYouTubeContent directly
  // as they require external dependencies (youtube-transcript-api) and would be too complex
  // to mock effectively. These would typically be integration tests rather than unit tests.
});