import React, { useEffect, useMemo, useState } from 'react';
import { useMotionValueEvent } from 'framer-motion';
import { resolveThemeFontStack, resolveThemeFontWeight, resolveThemeTranslationFontStack } from '../../../utils/fontStacks';
import type { VisualizerSharedProps } from '../definition';
import VisualizerShell from '../VisualizerShell';
import {
    VETRO_INK,
    buildVetroTimeline,
    countSungGraphemes,
    resolveShownLineIndex,
    resolveVetroFontSizes,
    resolveVetroRows,
    splitSungText,
} from './vetroLayout';

// src/components/visualizer/vetro/VisualizerVetro.tsx
// 透屏：给去掉背光的液晶面板（白处透光、深处遮光）画的歌词。纯白底、不画背景、没有动画，
// 只有上一句、当前句（按唱到的字由深灰变黑）和下一句，字号按视口算（vetroLayout.ts）。
// 每帧什么都不画：只在唱到新的字、换句或窗口变大小时重渲染，电视盒子上也很省。

const useViewportSize = () => {
    const [size, setSize] = useState(() => ({
        width: typeof window === 'undefined' ? 1024 : window.innerWidth,
        height: typeof window === 'undefined' ? 768 : window.innerHeight,
    }));
    useEffect(() => {
        const handleResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    return size;
};

const VisualizerVetro: React.FC<VisualizerSharedProps> = ({
    currentTime,
    currentLineIndex,
    lines,
    theme,
    subtitleTheme,
    lyricsFontScale = 1,
    hideTranslationSubtitle = false,
    showText = true,
    audioPower,
    audioBands,
    ...sharedProps
}) => {
    const [shownIndex, setShownIndex] = useState(() => resolveShownLineIndex(currentLineIndex, 0, lines.length));
    useEffect(() => {
        setShownIndex(previous => resolveShownLineIndex(currentLineIndex, previous, lines.length));
    }, [currentLineIndex, lines.length]);

    const rows = resolveVetroRows(lines, shownIndex);
    const timeline = useMemo(() => buildVetroTimeline(rows.current), [rows.current]);
    const [sungCount, setSungCount] = useState(() => countSungGraphemes(timeline, currentTime.get()));
    useEffect(() => {
        setSungCount(countSungGraphemes(timeline, currentTime.get()));
    }, [timeline, currentTime]);
    useMotionValueEvent(currentTime, 'change', (latest) => {
        const next = countSungGraphemes(timeline, latest);
        setSungCount(previous => (previous === next ? previous : next));
    });

    const viewport = useViewportSize();
    const fontSizes = resolveVetroFontSizes(viewport.width, viewport.height, lyricsFontScale);
    const fontFamily = resolveThemeFontStack(theme);
    const translationTheme = subtitleTheme ?? theme;
    const { sung, unsung } = splitSungText(timeline, sungCount);

    const contextLine = (line: typeof rows.previous, key: string) => (
        <div
            key={key}
            data-vetro-row={key}
            className="w-full text-center leading-tight"
            style={{
                color: VETRO_INK.context,
                fontFamily,
                fontSize: `${fontSizes.context.toFixed(1)}px`,
                fontWeight: resolveThemeFontWeight(theme, 600),
                minHeight: `${(fontSizes.context * 1.25).toFixed(1)}px`,
            }}
        >
            {line?.fullText ?? ''}
        </div>
    );

    return (
        <VisualizerShell
            theme={theme}
            audioPower={audioPower}
            audioBands={audioBands}
            sharedProps={sharedProps}
            renderBackground={false}
            className="visualizer-vetro"
        >
            <div className="absolute inset-0 z-0" style={{ backgroundColor: VETRO_INK.background }} />
            {showText && (
                <div
                    className="absolute inset-0 z-0 flex flex-col items-center justify-center pointer-events-none px-[4vw] gap-[3vh]"
                    style={{ textWrap: 'balance' } as React.CSSProperties}
                >
                    {contextLine(rows.previous, 'previous')}
                    {rows.current && (
                        <div data-vetro-row="current" className="w-full flex flex-col items-center">
                            <div
                                className="w-full text-center leading-tight"
                                style={{
                                    fontFamily,
                                    fontSize: `${fontSizes.current.toFixed(1)}px`,
                                    fontWeight: resolveThemeFontWeight(theme, 800),
                                }}
                            >
                                <span style={{ color: VETRO_INK.sung }}>{sung}</span>
                                <span style={{ color: VETRO_INK.unsung }}>{unsung}</span>
                            </div>
                            {rows.current.translation && !hideTranslationSubtitle && (
                                <div
                                    data-vetro-row="translation"
                                    className="w-full text-center leading-snug mt-[1vh]"
                                    style={{
                                        color: VETRO_INK.translation,
                                        fontFamily: resolveThemeTranslationFontStack(translationTheme),
                                        fontSize: `${fontSizes.translation.toFixed(1)}px`,
                                        fontWeight: resolveThemeFontWeight(translationTheme, 600),
                                    }}
                                >
                                    {rows.current.translation}
                                </div>
                            )}
                        </div>
                    )}
                    {contextLine(rows.next, 'next')}
                </div>
            )}
        </VisualizerShell>
    );
};

export default VisualizerVetro;
