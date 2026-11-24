import type { CommentInsights } from '../steps/2-extract-content';

const HN_API = 'https://hacker-news.firebaseio.com/v0/item';
const MAX_COMMENT_CHARS = 600;

interface HnItem {
    id: number;
    by?: string;
    text?: string;
    kids?: number[];
    descendants?: number;
    dead?: boolean;
    deleted?: boolean;
}

async function getItem(id: number): Promise<HnItem | null> {
    const response = await fetch(`${HN_API}/${id}.json`);
    return response.ok ? (await response.json()) as HnItem | null : null;
}

/** HN comment bodies are HTML with entity-encoded text; the page shows them as plain text. */
export function hnCommentHtmlToText(html: string): string {
    return html
        .replace(/<p>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&#x27;/g, "'")
        .replace(/&#x2F;/g, '/')
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
        .replace(/&amp;/g, '&')
        .trim();
}

function truncate(text: string): string {
    if (text.length <= MAX_COMMENT_CHARS) return text;
    const cut = text.slice(0, MAX_COMMENT_CHARS);
    return `${cut.slice(0, cut.lastIndexOf(' ') > 0 ? cut.lastIndexOf(' ') : cut.length)}…`;
}

/**
 * Top-level comments of an HN discussion, in the order HN ranks them (the order of `kids`).
 * Returns undefined for non-HN URLs or when the API fails, so callers can just skip comments.
 */
export async function fetchTopHnComments(commentsUrl: string, limit = 5): Promise<CommentInsights | undefined> {
    const id = commentsUrl.match(/news\.ycombinator\.com\/item\?id=(\d+)/)?.[1];
    if (!id) return undefined;

    try {
        const story = await getItem(Number(id));
        if (!story?.kids?.length) return undefined;

        // Fetch a few extra in case some top comments are dead or deleted
        const candidates = await Promise.all(story.kids.slice(0, limit + 3).map(getItem));
        const comments = candidates
            .filter((c): c is HnItem => !!c && !c.dead && !c.deleted && !!c.text)
            .slice(0, limit)
            .map(c => ({
                author: c.by,
                text: truncate(hnCommentHtmlToText(c.text!)),
                url: `https://news.ycombinator.com/item?id=${c.id}`,
            }));

        return comments.length ? { totalComments: story.descendants, highlightedComments: comments } : undefined;
    } catch (error: any) {
        console.error(`Failed to fetch HN comments for ${commentsUrl}: ${error.message}`);
        return undefined;
    }
}
