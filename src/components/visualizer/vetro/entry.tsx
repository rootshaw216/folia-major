import React from 'react';
import { defineVisualizer } from '../definition';

const VisualizerVetro = React.lazy(() => import('./VisualizerVetro'));

// src/components/visualizer/vetro/entry.tsx
// Registers Vetro, the lyric style for a de-backlit LCD panel (white lets light through, dark blocks it).
export default defineVisualizer({
    mode: 'vetro',
    order: 140,
    labelKey: 'ui.visualizerVetro',
    labelFallback: 'Vetro',
    previewSeed: 'vetro',
    previewStartOffset: 0,
    // 透屏：白底上的一行粗墨字，上下各一行细的
    glyph: (
        <>
            <rect x="3" y="4" width="18" height="16" rx="2" opacity="0.35" />
            <path d="M6 9h12" opacity="0.5" />
            <path d="M5 12.5h14" />
            <path d="M7 16h10" opacity="0.5" />
        </>
    ),
    command: {
        title: 'Visualizer: Vetro',
        description: 'Switch to the high-contrast lyric style for a transparent screen',
        keywords: ['vetro', 'transparent screen', 'high contrast', '透屏', '透明屏', '高对比'],
    },
    // A plain white page: the panel shows whatever stands behind it through the white.
    background: false,
    render: props => <VisualizerVetro {...props} />,
});
