import { useEffect, useMemo } from 'react';
import { VISUALIZER_REGISTRY } from '../components/visualizer/registry';
import { RANDOM_VISUALIZER_CHOICE } from '../components/visualizer/random/lyricStyleChoices';
import type { VisualizerMode } from '../types';
import { resolveLyricStyleStep } from '../utils/lyricStyleKeys';
import { useVisualizerModeStepper } from './useVisualizerModeStepper';

// src/hooks/useLyricStyleKeys.ts
// LyricBox：F9 / F8（遥控器长按按键 2 发 F9）在全部歌词样式里前后切换，和面板「外观」的左右箭头同一个步进器，
// 所以顺序一致、同样只在停下后提示一次「已切换到 ×××」。规则见 utils/lyricStyleKeys.ts。

export const useLyricStyleKeys = () => {
    const modes = useMemo(
        () => [...VISUALIZER_REGISTRY.map(entry => entry.mode), RANDOM_VISUALIZER_CHOICE as VisualizerMode],
        [],
    );
    const step = useVisualizerModeStepper(modes);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return undefined;
        }
        const handleKey = (event: KeyboardEvent) => {
            const direction = resolveLyricStyleStep(event);
            if (direction === null) {
                return;
            }
            event.preventDefault();
            step(direction);
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [step]);
};
