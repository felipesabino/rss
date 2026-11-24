import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchTopHnComments, hnCommentHtmlToText } from '../hn-comments';

function mockHnApi(items: Record<number, unknown>) {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
        const id = Number(url.match(/item\/(\d+)\.json/)?.[1]);
        return { ok: true, json: async () => items[id] ?? null };
    }));
}

afterEach(() => vi.unstubAllGlobals());

describe('hn-comments', () => {
    it('converts HN comment HTML to plain text', () => {
        expect(hnCommentHtmlToText('It&#x27;s <i>fast</i>.<p>See <a href="https:&#x2F;&#x2F;x.io">x.io</a> &amp; more'))
            .toBe("It's fast.\n\nSee x.io & more");
    });

    it('returns top-level comments in HN rank order, skipping dead and deleted ones', async () => {
        mockHnApi({
            1: { id: 1, descendants: 42, kids: [10, 11, 12, 13] },
            10: { id: 10, by: 'alice', text: 'First' },
            11: { id: 11, deleted: true },
            12: { id: 12, by: 'bob', text: 'Flagged', dead: true },
            13: { id: 13, by: 'carol', text: 'Second' },
        });

        const insights = await fetchTopHnComments('https://news.ycombinator.com/item?id=1', 5);

        expect(insights?.totalComments).toBe(42);
        expect(insights?.highlightedComments?.map(c => [c.author, c.text, c.url])).toEqual([
            ['alice', 'First', 'https://news.ycombinator.com/item?id=10'],
            ['carol', 'Second', 'https://news.ycombinator.com/item?id=13'],
        ]);
    });

    it('ignores URLs that are not HN discussions', async () => {
        mockHnApi({});
        expect(await fetchTopHnComments('https://example.com/post/1')).toBeUndefined();
        expect(fetch).not.toHaveBeenCalled();
    });
});
