import React from 'react';
import { motionValue } from 'framer-motion';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_THEME } from '@/services/baseThemes';
import type { Line } from '@/types';
import VisualizerVetro from '@/components/visualizer/vetro/VisualizerVetro';
import {
    VETRO_INK,
    VETRO_MIN_CONTRAST,
    buildVetroTimeline,
    contrastRatio,
    countSungGraphemes,
    resolveShownLineIndex,
    resolveVetroFontSizes,
    resolveVetroRows,
    splitSungText,
} from '@/components/visualizer/vetro/vetroLayout';

// test/unit/visualizer/vetro.test.ts
// Vetro（透屏）的约定：每种字对白底都 ≥ 7:1；iPad 2 面板上当前句字高 ≥ 12mm；
// 唱到哪个字就把哪个字变黑；间奏不清屏；整屏是白底、不挂背景。
vi.mock('@/components/visualizer/backgrounds/VisualizerBackgroundRenderer', () => ({
    default: () => React.createElement('div', { 'data-testid': 'background-renderer' }),
}));

const createAudioBands = () => ({
    bass: motionValue(0),
    lowMid: motionValue(0),
    mid: motionValue(0),
    vocal: motionValue(0),
    treble: motionValue(0),
});

const line = (fullText: string, startTime: number, endTime: number, words: Line['words'] = [], translation?: string): Line => ({
    fullText, startTime, endTime, words, translation,
});

const LINES: Line[] = [
    line('first line', 0, 2),
    line('真実のために', 2, 5, [
        { text: '真実', startTime: 2, endTime: 3 },
        { text: 'のために', startTime: 3, endTime: 5 },
    ], 'for the truth'),
    line('third line', 5, 7),
];

// iPad 2 的 9.7" 面板：1024×768 像素，可视区约 197mm × 148mm。
const PANEL_MM_PER_PX = 197 / 1024;

describe('vetro ink', () => {
    it('keeps every ink at or above 7:1 against the white background', () => {
        for (const [name, ink] of Object.entries(VETRO_INK)) {
            if (name === 'background') continue;
            expect(contrastRatio(ink, VETRO_INK.background), name).toBeGreaterThanOrEqual(VETRO_MIN_CONTRAST);
        }
    });

    it('computes WCAG contrast like the reference values', () => {
        expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
        expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
        expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
        expect(() => contrastRatio('white', '#ffffff')).toThrow();
    });
});

describe('vetro font sizes', () => {
    it('makes the current line at least 12mm tall on the iPad 2 panel', () => {
        const sizes = resolveVetroFontSizes(1024, 768);
        expect(sizes.current * PANEL_MM_PER_PX).toBeGreaterThanOrEqual(12);
        expect(sizes.context).toBeLessThan(sizes.current);
        expect(sizes.translation).toBeLessThan(sizes.current);
    });

    it('keeps the physical size when the box renders at a higher resolution and scales down', () => {
        const panel = resolveVetroFontSizes(1024, 768).current / 1024;
        const fullHd = resolveVetroFontSizes(1440, 1080).current / 1440;
        expect(fullHd).toBeCloseTo(panel, 5);
    });

    it('follows the lyric font scale and stays within bounds', () => {
        expect(resolveVetroFontSizes(1024, 768, 1.2).current).toBeCloseTo(resolveVetroFontSizes(1024, 768).current * 1.2, 5);
        expect(resolveVetroFontSizes(1024, 768, Number.NaN).current).toBe(resolveVetroFontSizes(1024, 768).current);
        expect(resolveVetroFontSizes(100, 80).current).toBe(24);
        expect(resolveVetroFontSizes(10000, 10000, 3).current).toBe(400);
    });
});

describe('vetro sung text', () => {
    it('turns the graphemes black as their words start', () => {
        const timeline = buildVetroTimeline(LINES[1]);
        expect(timeline.map(g => g.char).join('')).toBe('真実のために');
        expect(countSungGraphemes(timeline, 1.9)).toBe(0);
        expect(splitSungText(timeline, countSungGraphemes(timeline, 2.1))).toEqual({ sung: '真', unsung: '実のために' });
        expect(splitSungText(timeline, countSungGraphemes(timeline, 3))).toEqual({ sung: '真実の', unsung: 'ために' });
        expect(splitSungText(timeline, countSungGraphemes(timeline, 9))).toEqual({ sung: '真実のために', unsung: '' });
    });

    it('handles no line and out-of-range counts', () => {
        expect(buildVetroTimeline(null)).toEqual([]);
        const timeline = buildVetroTimeline(LINES[0]);
        expect(splitSungText(timeline, -3)).toEqual({ sung: '', unsung: 'first line' });
        expect(splitSungText(timeline, 99)).toEqual({ sung: 'first line', unsung: '' });
    });
});

describe('vetro rows', () => {
    it('shows the previous, current and next line', () => {
        expect(resolveVetroRows(LINES, 1)).toEqual({ previous: LINES[0], current: LINES[1], next: LINES[2] });
        expect(resolveVetroRows(LINES, 0).previous).toBeNull();
        expect(resolveVetroRows(LINES, 2).next).toBeNull();
        expect(resolveVetroRows([], 3)).toEqual({ previous: null, current: null, next: null });
    });

    it('keeps the last line on screen through an interlude', () => {
        expect(resolveShownLineIndex(-1, 1, 3)).toBe(1);
        expect(resolveShownLineIndex(2, 1, 3)).toBe(2);
        expect(resolveShownLineIndex(-1, 7, 3)).toBe(0);
        expect(resolveShownLineIndex(5, 0, 3)).toBe(2);
        expect(resolveShownLineIndex(-1, 0, 0)).toBe(0);
    });
});

describe('VisualizerVetro', () => {
    const render = (time: number, overrides: Partial<React.ComponentProps<typeof VisualizerVetro>> = {}) => renderToStaticMarkup(
        React.createElement(VisualizerVetro, {
            currentTime: motionValue(time),
            currentLineIndex: 1,
            lines: LINES,
            theme: DEFAULT_THEME,
            audioPower: motionValue(0),
            audioBands: createAudioBands(),
            ...overrides,
        }),
    );

    it('draws a white page with the three rows and no background renderer', () => {
        const markup = render(3);
        expect(markup).toContain('visualizer-vetro');
        expect(markup).toContain('background-color:#ffffff');
        expect(markup).toContain('data-vetro-row="previous"');
        expect(markup).toContain('data-vetro-row="next"');
        expect(markup).toContain('for the truth');
        expect(markup).toContain('>真実の</span>');
        expect(markup).toContain('>ために</span>');
        expect(markup).not.toContain('background-renderer');
    });

    it('ignores the song theme colors', () => {
        const markup = render(3.5, { theme: { ...DEFAULT_THEME, primaryColor: '#ff00ff', secondaryColor: '#00ff00' } });
        expect(markup).not.toContain('#ff00ff');
        expect(markup).not.toContain('#00ff00');
    });

    it('hides the translation and the text when asked', () => {
        expect(render(3.5, { hideTranslationSubtitle: true })).not.toContain('for the truth');
        expect(render(3.5, { showText: false })).not.toContain('data-vetro-row');
    });
});
