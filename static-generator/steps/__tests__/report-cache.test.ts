import { describe, expect, it } from 'vitest';
import { canReuseReport, CategoryReport } from '../5-generate-reports';

const now = 1_000_000_000;
const report = (prompt: string | undefined, ageMs: number): CategoryReport => ({
    category: 'paris',
    report: {} as CategoryReport['report'],
    generatedAt: now - ageMs,
    usedItemIds: [],
    prompt
});

describe('canReuseReport', () => {
    it('reuses a recent report written with the same prompt', () => {
        expect(canReuseReport(report('v1', 60_000), 'v1', now)).toBe(true);
    });

    it('regenerates when the prompt changed', () => {
        expect(canReuseReport(report('v1', 60_000), 'v2', now)).toBe(false);
    });

    it('regenerates old-format reports that stored no prompt', () => {
        expect(canReuseReport(report(undefined, 60_000), 'v1', now)).toBe(false);
    });

    it('regenerates reports older than an hour', () => {
        expect(canReuseReport(report('v1', 2 * 60 * 60 * 1000), 'v1', now)).toBe(false);
    });
});
