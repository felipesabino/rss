import axios from 'axios';
import { contentExtractor } from './content';

const GOOGLE_ENDPOINT = 'https://www.googleapis.com/customsearch/v1';

export interface GoogleSearchItem {
    title: string;
    link: string;
    displayLink: string;
    snippet?: string;
    htmlSnippet?: string;
    pagemap?: any;
    pubDate?: string; // Normalized
}

export async function searchGoogleForQuery(query: string, num: number = 10, dateRestrict: string = 'd1'): Promise<GoogleSearchItem[]> {
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const cx = process.env.GOOGLE_SEARCH_CX_DEFAULT;

    if (!apiKey) {
        throw new Error('GOOGLE_SEARCH_API_KEY is required.');
    }
    if (!cx) {
        throw new Error('GOOGLE_SEARCH_CX_DEFAULT is required.');
    }

    const params = {
        key: apiKey,
        cx,
        q: query,
        num: Math.min(Math.max(num, 1), 10),
        safe: 'off',
        dateRestrict, // Use the provided dateRestrict
    };

    try {
        console.log(`Searching Google for: "${query}"`);
        const response = await axios.get(GOOGLE_ENDPOINT, { params });
        const items = response.data?.items || [];
        console.log(`Google search returned ${items.length} items`);

        return items.map((item: any) => {
            return {
                ...item,
                pubDate: extractPublishedAt(item)
            };
        });
        if (items.length === 0) {
            console.log(`Google search returned 0 items. response: ${JSON.stringfy(response)}`);
        }
    } catch (error: any) {
        const msg = error.response?.data?.error?.message || error.message;
        console.warn(`Google search failed for "${query}": ${msg}`);
        return [];
    }
}

function extractPublishedAt(item: any): string | undefined {
    const meta = item.pagemap?.metatags?.[0];
    const news = item.pagemap?.newsarticle?.[0];
    const candidates = [
        meta?.['article:published_time'],
        meta?.['og:updated_time'],
        news?.datepublished,
        news?.datemodified,
    ].filter(Boolean);

    if (!candidates.length) return undefined;

    const parsed = Date.parse(candidates[0]);
    return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
}
