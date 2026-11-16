import type { Line } from '../../../types';
import { buildLineGraphemeTimeline, type GraphemeTiming } from '../../../utils/lyrics/graphemeTiming';

// src/components/visualizer/vetro/vetroLayout.ts
// Vetro（透屏）的纯函数：配色、按视口算字号、当前句唱到第几个字、屏上留哪几句。
// Vetro 是给去掉背光的液晶面板（LyricBox 的 iPad 2 屏，1024×768）用的：面板白的地方透光、
// 深的地方遮光，所以整屏是纯白底，字一律是够深的墨色，和背景的对比度都在 WCAG 的 7:1 以上。

/** 透屏的固定配色：不跟歌曲主题走，主题色在透光面板上大多太浅、对比不够。 */
export const VETRO_INK = {
    /** 整屏底色：面板上最透光的白。 */
    background: '#ffffff',
    /** 当前句已经唱到的字。 */
    sung: '#000000',
    /** 当前句还没唱到的字：比纯黑浅一档，对白底仍有 10:1。 */
    unsung: '#3f3f3f',
    /** 上一句和下一句。 */
    context: '#4d4d4d',
    /** 当前句的翻译。 */
    translation: '#3f3f3f',
} as const;

/** 屏上每一种字和底色的对比度下限（WCAG AAA 正文）。 */
export const VETRO_MIN_CONTRAST = 7;

const channel = (value: number): number => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** `#rrggbb` 的 WCAG 相对亮度。 */
export const relativeLuminance = (hex: string): number => {
    const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    if (!match) {
        throw new Error(`not a #rrggbb color: ${hex}`);
    }
    const [r, g, b] = match.slice(1).map(part => channel(Number.parseInt(part, 16)));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** 两个颜色的 WCAG 对比度，1..21。 */
export const contrastRatio = (a: string, b: string): number => {
    const la = relativeLuminance(a);
    const lb = relativeLuminance(b);
    const [high, low] = la >= lb ? [la, lb] : [lb, la];
    return (high + 0.05) / (low + 0.05);
};

export interface VetroFontSizes {
    /** 当前句，px。 */
    current: number;
    /** 上一句、下一句，px。 */
    context: number;
    /** 当前句的翻译，px。 */
    translation: number;
}

/**
 * 当前句的字号占视口的比例：取「高的 11%」和「宽的 7.5%」里小的那个。iPad 2 面板 1024×768
 * 上是 76.8px，面板高 148mm、宽 197mm，合 14.8mm，满足方案 N10 的「字高 ≥ 12mm」。
 * 按视口比例算，电视盒子不管输出 1024×768 还是更高的分辨率再缩到面板上，实际字高都一样。
 */
const CURRENT_HEIGHT_SHARE = 0.11;
const CURRENT_WIDTH_SHARE = 0.075;
const MIN_CURRENT_PX = 24;
const MAX_CURRENT_PX = 400;

export const resolveVetroFontSizes = (viewportWidth: number, viewportHeight: number, fontScale = 1): VetroFontSizes => {
    const scale = Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
    const base = Math.min(viewportHeight * CURRENT_HEIGHT_SHARE, viewportWidth * CURRENT_WIDTH_SHARE) * scale;
    const current = Math.min(MAX_CURRENT_PX, Math.max(MIN_CURRENT_PX, base));
    return {
        current,
        context: current * 0.6,
        translation: current * 0.55,
    };
};

/** 当前句按字（grapheme）拆开的时间线；没有字时为空。 */
export const buildVetroTimeline = (line: Line | null | undefined): GraphemeTiming[] => (
    line ? buildLineGraphemeTimeline(line) : []
);

/** 到 `time` 秒为止唱到了几个字：开始时间不晚于 `time` 的字都算唱到。 */
export const countSungGraphemes = (timeline: GraphemeTiming[], time: number): number => {
    let count = 0;
    for (const grapheme of timeline) {
        if (grapheme.startTime <= time) {
            count += 1;
        } else {
            break;
        }
    }
    return count;
};

/** 把当前句拆成「已唱」「未唱」两段文字。 */
export const splitSungText = (timeline: GraphemeTiming[], sungCount: number): { sung: string; unsung: string } => {
    const cut = Math.max(0, Math.min(sungCount, timeline.length));
    return {
        sung: timeline.slice(0, cut).map(g => g.char).join(''),
        unsung: timeline.slice(cut).map(g => g.char).join(''),
    };
};

export interface VetroRows {
    previous: Line | null;
    current: Line | null;
    next: Line | null;
}

/**
 * 屏上留哪几句：上一句、当前句、下一句。`shownIndex` 是最后一次有效的当前句下标
 * （间奏时 currentLineIndex 是 -1，画面停在上一句，不清屏）。
 */
export const resolveVetroRows = (lines: Line[], shownIndex: number): VetroRows => {
    if (lines.length === 0) {
        return { previous: null, current: null, next: null };
    }
    const index = Math.max(0, Math.min(shownIndex, lines.length - 1));
    return {
        previous: lines[index - 1] ?? null,
        current: lines[index] ?? null,
        next: lines[index + 1] ?? null,
    };
};

/** 间奏或歌曲开头（currentLineIndex 为 -1）时，屏上仍显示的那一句的下标。 */
export const resolveShownLineIndex = (currentLineIndex: number, previousShown: number, lineCount: number): number => {
    if (lineCount <= 0) {
        return 0;
    }
    if (currentLineIndex >= 0) {
        return Math.min(currentLineIndex, lineCount - 1);
    }
    return previousShown >= lineCount ? 0 : Math.max(0, previousShown);
};
