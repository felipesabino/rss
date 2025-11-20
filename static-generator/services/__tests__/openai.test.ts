import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OpenAI from 'openai';
import { analyzeItem, generateCategoryReport } from '../openai';
import type { Report, ReportItem } from '../openai';

const { openAIMocks } = vi.hoisted(() => ({
  openAIMocks: {
    parse: vi.fn(),
    constructor: vi.fn()
  }
}));

vi.mock('openai', () => ({
  default: openAIMocks.constructor
}));

function buildMockReport(): Report {
  return {
    header: 'Morning intel',
    mainStories: [
      {
        sectionTag: 'TECH',
        headline: 'Robotics boom',
        sourceName: 'Example',
        sourceUrl: 'https://example.com/story',
        whatHappened: 'Robotics headline',
        whyItMatters: 'Because automation',
        shortTermImpact: 'next quarter',
        longTermImpact: 'next year',
        sentiment: 'Positive',
        sentimentRationale: 'optimistic momentum'
      }
    ],
    whatElseIsGoingOn: [
      {
        text: 'Another story',
        sourceName: 'Example',
        sourceUrl: 'https://example.com'
      }
    ],
    byTheNumbers: {
      number: '42%',
      commentary: 'growth'
    },
    signOff: 'See you tomorrow'
  };
}

describe('OpenAI service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    openAIMocks.parse.mockReset();
    openAIMocks.constructor.mockReset();
    openAIMocks.constructor.mockImplementation(() => ({
      beta: {
        chat: {
          completions: {
            parse: openAIMocks.parse
          }
        }
      }
    }));

    process.env.OPENAI_API_KEY = 'test-key';
    process.env.OPENAI_API_BASE_URL = 'https://api.test';
    process.env.OPENAI_MODEL_NAME = 'test-model';
    process.env.OPENAI_REPORT_MODEL_NAME = 'report-model';
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_BASE_URL;
    delete process.env.OPENAI_MODEL_NAME;
    delete process.env.OPENAI_REPORT_MODEL_NAME;
  });

  describe('analyzeItem', () => {
    it('sends structured output request and returns parsed analysis', async () => {
      openAIMocks.parse.mockResolvedValueOnce({
        choices: [
          {
            message: {
              parsed: { summary: 'Concise summary', isPositive: true }
            }
          }
        ]
      });

      const response = await analyzeItem('a'.repeat(500), 'Busy Day');

      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: 'test-key',
        baseURL: 'https://api.test'
      });

      expect(openAIMocks.parse).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'test-model',
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ role: 'user' })
          ]),
          response_format: expect.any(Object)
        }),
        { timeout: 15 * 60 * 1000, maxRetries: 3 }
      );
      expect(response).toEqual({ summary: 'Concise summary', isPositive: true });
    });

    it('falls back to title context for very short text', async () => {
      openAIMocks.parse.mockResolvedValueOnce({
        choices: [
          {
            message: {
              parsed: { summary: 'ok', isPositive: false }
            }
          }
        ]
      });

      await analyzeItem('short', 'Breaking News');
      const userMessage = openAIMocks.parse.mock.calls[0][0].messages[1].content as string;
      expect(userMessage).toContain('Title: Breaking News');
      expect(userMessage).toContain('short');
    });

    it('truncates extremely long content to 50k characters', async () => {
      openAIMocks.parse.mockResolvedValueOnce({
        choices: [
          {
            message: {
              parsed: { summary: 'ok', isPositive: false }
            }
          }
        ]
      });

      const long = 'a'.repeat(60000);
      await analyzeItem(long, 'Title');
      const content = openAIMocks.parse.mock.calls[0][0].messages[1].content as string;
      expect(content.length).toBe(50000);
    });

    it('returns default response when API key is missing', async () => {
      delete process.env.OPENAI_API_KEY;
      const result = await analyzeItem('content', 'Title');
      expect(result).toEqual({
        summary: 'Summary not available (API key not configured).',
        isPositive: false
      });
      expect(openAIMocks.parse).not.toHaveBeenCalled();
    });

    it('returns fallback summary on API error', async () => {
      openAIMocks.parse.mockRejectedValueOnce(new Error('boom'));
      const result = await analyzeItem('content'.repeat(100), 'Title');
      expect(result).toEqual({
        summary: 'Error generating summary.',
        isPositive: false
      });
    });
  });

  describe('generateCategoryReport', () => {
    const baseItems: ReportItem[] = [
      {
        title: 'Story 1',
        summary: 'Summary 1',
        url: 'https://example.com/1',
        published: new Date('2024-01-01T00:00:00.000Z'),
        sourceName: 'Example Source',
        score: 50
      },
      {
        title: 'Story 2',
        summary: 'Summary 2',
        url: 'https://example.com/2',
        published: new Date('2024-01-02T00:00:00.000Z'),
        sourceName: 'Example Source',
        score: 40
      }
    ];

    it('generates a report using at most 20 stories and custom instructions', async () => {
      openAIMocks.parse.mockResolvedValueOnce({
        choices: [
          {
            message: {
              parsed: buildMockReport()
            }
          }
        ]
      });

      const items = Array.from({ length: 25 }, (_, index) => ({
        ...baseItems[index % baseItems.length],
        title: `Story ${index + 1}`,
        url: `https://example.com/${index + 1}`,
        published: new Date('2024-01-01T00:00:00.000Z'),
        score: 100 - index
      }));

      const result = await generateCategoryReport('Tech', items, 'Focus on robotics');

      expect(result?.header).toBe('Morning intel');
      expect(openAIMocks.parse).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'report-model'
        }),
        expect.objectContaining({
          timeout: 5 * 60 * 1000
        })
      );

      const userMessage = openAIMocks.parse.mock.calls[0][0].messages[1].content as string;
      expect(userMessage).toContain('Category: "Tech"');
      expect(userMessage).toContain('SPECIFIC INSTRUCTIONS FOR CATEGORY "Tech"');
      const itemOccurrences = userMessage.match(/Item \d+:/g) || [];
      expect(itemOccurrences.length).toBe(20); // trimmed to top 20 items
    });

    it('returns null when API key is missing', async () => {
      delete process.env.OPENAI_API_KEY;
      const result = await generateCategoryReport('Tech', baseItems, undefined);
      expect(result).toBeNull();
      expect(openAIMocks.parse).not.toHaveBeenCalled();
    });
  });
});
