import { describe, it, expect, vi, beforeEach } from 'vitest';
import { summarizeText, analyzeSentiment } from '../openai';
import OpenAI from 'openai';

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn()
        }
      }
    }))
  };
});

describe('openai', () => {
  let mockOpenAI: any;
  let mockCreate: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up environment variables
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.OPENAI_API_BASE_URL = 'https://api.test';
    process.env.OPENAI_MODEL_NAME = 'test-model';
    
    // Set up the mock
    mockCreate = vi.fn();
    mockOpenAI = {
      chat: {
        completions: {
          create: mockCreate
        }
      }
    };
    
    (OpenAI as any).mockImplementation(() => mockOpenAI);
  });

  describe('summarizeText', () => {
    it('should call OpenAI API with correct parameters', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'Test summary' } }]
      });
      
      const result = await summarizeText('Test content');
      
      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: 'test-key',
        baseURL: 'https://api.test'
      });
      
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'test-model',
        messages: [
          {
            role: 'system',
            content: expect.stringContaining('summarizer')
          },
          {
            role: 'user',
            content: 'Test content'
          }
        ]
      }, expect.any(Object));
      
      expect(result).toBe('Test summary');
    });
    
    it('should truncate long text', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'Test summary' } }]
      });
      
      const longText = 'a'.repeat(60000);
      await summarizeText(longText);
      
      expect(mockCreate.mock.calls[0][0].messages[1].content.length).toBe(50000);
    });
    
    it('should handle API errors', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API error'));
      
      const result = await summarizeText('Test content');
      
      expect(result).toBe('Error generating summary.');
    });
    
    it('should handle empty response', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: []
      });
      
      const result = await summarizeText('Test content');
      
      expect(result).toBe('Summary not available.');
    });
  });

  describe('analyzeSentiment', () => {
    it('should call OpenAI API with correct parameters', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'true' } }]
      });
      
      const result = await analyzeSentiment('Test content');
      
      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: 'test-key',
        baseURL: 'https://api.test'
      });
      
      expect(mockCreate).toHaveBeenCalledWith({
        model: expect.any(String),
        messages: [
          {
            role: 'system',
            content: expect.stringContaining('sentiment')
          },
          {
            role: 'user',
            content: 'Test content'
          }
        ]
      }, expect.any(Object));
      
      expect(result).toBe(true);
    });
    
    it('should handle different positive response formats', async () => {
      // Test 'true'
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'true' } }]
      });
      expect(await analyzeSentiment('Positive content')).toBe(true);
      
      // Test '"true"'
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: '"true"' } }]
      });
      expect(await analyzeSentiment('Positive content')).toBe(true);
      
      // Test text containing 'true'
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'The sentiment is true.' } }]
      });
      expect(await analyzeSentiment('Positive content')).toBe(true);
      
      // Test text containing 'positive'
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'positive' } }]
      });
      expect(await analyzeSentiment('Positive content')).toBe(true);
    });
    
    it('should handle different negative response formats', async () => {
      // Test 'false'
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'false' } }]
      });
      expect(await analyzeSentiment('Negative content')).toBe(false);
      
      // Test '"false"'
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: '"false"' } }]
      });
      expect(await analyzeSentiment('Negative content')).toBe(false);
      
      // Test other text
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'negative' } }]
      });
      expect(await analyzeSentiment('Negative content')).toBe(false);
    });
    
    it('should truncate long text', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'true' } }]
      });
      
      const longText = 'a'.repeat(60000);
      await analyzeSentiment(longText);
      
      expect(mockCreate.mock.calls[0][0].messages[1].content.length).toBe(50000);
    });
    
    it('should handle API errors', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API error'));
      
      const result = await analyzeSentiment('Test content');
      
      expect(result).toBe(false); // Default to not positive on error
    });
  });
});