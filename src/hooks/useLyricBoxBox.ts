import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getVisualizerModeLabel } from '../components/visualizer/registry';
import { getVisualizerBackgroundModeLabel, VISUALIZER_BACKGROUND_REGISTRY } from '../components/visualizer/backgrounds/registry';
import { setStatusMessage } from '../stores/useStatusMessageStore';
import { useVisualizerSettingsStore } from '../stores/useVisualizerSettingsStore';
import { resolveVisualizerBackgroundMode } from '../stores/visualizerSettingsPersistence';
import type { VisualizerBackgroundMode, VisualizerMode } from '../types';
import {
    BOX_FALLBACK_BACKGROUND,
    BOX_FALLBACK_VISUALIZER,
    boxAllowsBackground,
    boxAllowsVisualizer,
    filterBoxBackgrounds,
    isLyricBoxBox,
    summarizeFrames,
} from '../utils/lyricboxBox';

// src/hooks/useLyricBoxBox.ts
// LyricBox 盒子性能档（只在盒子播放器里生效，见 utils/lyricboxBox.ts）：
// 1. 选中的歌词样式 / 背景不在盒子名单里时，换成透屏 / 能跑的背景并提示一次；
// 2. F10 依次换背景（只在名单里换，供实测和不方便点面板时用）；
// 3. 每 5 秒在控制台写一行 [lyricbox-perf]（GeckoView 转到 logcat），记录当前样式、背景与页面帧率。

const PERF_WINDOW_MS = 5000;

export const useLyricBoxBox = () => {
    const { t } = useTranslation();

    useEffect(() => {
        if (!isLyricBoxBox()) return undefined;
        const label = (key: string) => t(key);
        const guard = () => {
            const s = useVisualizerSettingsStore.getState();
            if (!boxAllowsVisualizer(s.visualizerMode)) {
                const from = getVisualizerModeLabel(s.visualizerMode, label);
                s.handleSetVisualizerMode(BOX_FALLBACK_VISUALIZER as VisualizerMode, { notify: false, preserveRandom: true });
                setStatusMessage({ type: 'info', text: `「${from}」在这台盒子上太卡，已换成「${getVisualizerModeLabel(BOX_FALLBACK_VISUALIZER as VisualizerMode, label)}」` });
            }
            const bg = resolveVisualizerBackgroundMode(s.visualizerBackgroundMode, s.visualizerMode);
            if (!boxAllowsBackground(bg)) {
                const from = getVisualizerBackgroundModeLabel(bg, label);
                s.handleSetVisualizerBackgroundMode(BOX_FALLBACK_BACKGROUND as VisualizerBackgroundMode);
                setStatusMessage({ type: 'info', text: `背景「${from}」在这台盒子上太卡，已换成「${getVisualizerBackgroundModeLabel(BOX_FALLBACK_BACKGROUND as VisualizerBackgroundMode, label)}」` });
            }
        };
        guard();
        return useVisualizerSettingsStore.subscribe(guard);
    }, [t]);

    useEffect(() => {
        if (!isLyricBoxBox() || typeof window === 'undefined') return undefined;
        const handleKey = (event: KeyboardEvent) => {
            if (event.key !== 'F10' || event.repeat || event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
            event.preventDefault();
            const s = useVisualizerSettingsStore.getState();
            const modes = filterBoxBackgrounds(VISUALIZER_BACKGROUND_REGISTRY.map(entry => entry.mode));
            if (modes.length === 0) return;
            const current = resolveVisualizerBackgroundMode(s.visualizerBackgroundMode, s.visualizerMode);
            const next = modes[(modes.indexOf(current) + 1) % modes.length];
            s.handleSetVisualizerBackgroundMode(next);
            setStatusMessage({ type: 'info', text: `背景：${getVisualizerBackgroundModeLabel(next, key => t(key))}` });
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [t]);

    useEffect(() => {
        if (!isLyricBoxBox() || typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') return undefined;
        let stamps: number[] = [];
        let windowStart = performance.now();
        let raf = 0;
        const tick = (now: number) => {
            stamps.push(now);
            if (now - windowStart >= PERF_WINDOW_MS) {
                const s = useVisualizerSettingsStore.getState();
                const stats = summarizeFrames(stamps);
                console.info('[lyricbox-perf]', JSON.stringify({
                    mode: s.randomVisualizerModePerSong ? `random:${s.visualizerMode}` : s.visualizerMode,
                    bg: resolveVisualizerBackgroundMode(s.visualizerBackgroundMode, s.visualizerMode),
                    ...stats,
                }));
                stamps = [now];
                windowStart = now;
            }
            raf = window.requestAnimationFrame(tick);
        };
        raf = window.requestAnimationFrame(tick);
        return () => window.cancelAnimationFrame(raf);
    }, []);
};
