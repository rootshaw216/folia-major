import React, { useMemo } from 'react';
import { motionValue } from 'framer-motion';
import VisualizerRenderer from '../../src/components/visualizer/VisualizerRenderer';
import {
    findPreviewPlaceholderLineIndex,
    VIS_PLAYGROUND_PREVIEW_PLACEHOLDERS,
} from '../../src/components/visualizer/PreviewPlaceholder';
import { DAYLIGHT_THEME, DEFAULT_THEME } from '../../src/services/baseThemes';
import type { VisualizerBackgroundConfig } from '../../src/components/visualizer/backgrounds/definition';
import type { AudioBands, VisualizerMode } from '../../src/types';
import type { ProbeDefinition } from './definition';
// dev/probes/transparentScreen.probe.tsx

/**
 * LyricBox 透明屏（去背光的液晶面板：白色透光、深色遮光）上的歌词观感。
 * 用示例歌曲的一句歌词，时间钉住、静态模式，真的 VisualizerRenderer 画满整个视口，
 * 测试按 1024×768（iPad 2 面板）截图，量“亮像素占比”和“歌词与背景的对比度”。
 *
 * URL 参数：
 * - look=transparent（默认）：透屏样式 Vetro（白底墨字、不画背景，见 visualizer/vetro/）；
 *   look=default：深色模式 + 默认背景 + 默认样式，用来对比。
 * - style=<歌词样式 id>：换掉上面的样式，缺省 transparent 用 vetro、default 用 classic。
 */
const NOOP_BAND = () => motionValue(0);

const TransparentScreenProbe: React.FC = () => {
    const params = new URLSearchParams(window.location.search);
    const look = params.get('look') === 'default' ? 'default' : 'transparent';
    const style = (params.get('style') ?? (look === 'transparent' ? 'vetro' : 'classic')) as VisualizerMode;
    const placeholder = VIS_PLAYGROUND_PREVIEW_PLACEHOLDERS.reserved;
    const lines = placeholder.lines;
    // 钉在第二句的中间：上一句、当前句、下一句都在屏上。
    const pinnedTime = lines.length > 1 ? (lines[1].startTime + lines[1].endTime) / 2 : lines[0].startTime + 0.5;

    const motion = useMemo(() => ({
        currentTime: motionValue(pinnedTime),
        audioPower: motionValue(0),
        audioBands: {
            bass: NOOP_BAND(),
            lowMid: NOOP_BAND(),
            mid: NOOP_BAND(),
            vocal: NOOP_BAND(),
            treble: NOOP_BAND(),
        } satisfies AudioBands,
    }), [pinnedTime]);

    const isDaylight = look === 'transparent';
    const background: VisualizerBackgroundConfig = { mode: 'latent' };

    return (
        <div
            className="fixed inset-0 overflow-hidden"
            data-probe-look={look}
            data-probe-ready="true"
            style={{ backgroundColor: isDaylight ? '#ffffff' : '#000000' }}
        >
            <VisualizerRenderer
                mode={style}
                currentTime={motion.currentTime}
                duration={placeholder.loopDuration}
                currentLineIndex={findPreviewPlaceholderLineIndex(lines, pinnedTime)}
                lines={lines}
                theme={isDaylight ? DAYLIGHT_THEME : DEFAULT_THEME}
                isDaylight={isDaylight}
                audioPower={motion.audioPower}
                audioBands={motion.audioBands}
                showText
                songTitle={placeholder.title}
                coverUrl={placeholder.coverUrl}
                staticMode
                paused
                background={background}
                subtitleContentMode="none"
                showSubtitleTranslation={false}
                isPlayerChromeHidden
                // 透屏的推荐设置：关掉顶上的和声（背景人声）字幕，它用歌曲主题色画，透光面板上太浅。
                showHarmonySubtitle={!isDaylight}
            />
        </div>
    );
};

const definition: ProbeDefinition = {
    id: 'transparentScreen',
    title: 'LyricBox 透明屏歌词',
    description: '去背光液晶面板上的歌词观感：白底深色字是否足够透光、对比度够不够（look=transparent / default，style=<样式>）。',
    Component: TransparentScreenProbe,
};

export default definition;
