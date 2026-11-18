// src/utils/lyricboxBox.ts
// LyricBox：电视盒子性能档。LyricBox 的盒子播放器（自带 GeckoView 的安卓壳）在浏览器标识里带 LyricBoxBox，
// 只有它才启用这里的限制；电脑、手机上的 Folia 不受影响。
// 盒子（X98 Plus：4×Cortex-A55 + Mali Bifrost，1920×1080）跑不动的歌词样式与背景不出现在面板、F9、随机池里，
// 已经选上的（旧设置、命令面板）自动换成能跑的。名单来自盒子上的实测（LyricBox box-setup/perfbench.py）。

export const LYRICBOX_BOX_UA_TOKEN = 'LyricBoxBox';

export const isLyricBoxBox = (ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): boolean =>
    ua.includes(LYRICBOX_BOX_UA_TOKEN);

/**
 * 盒子上跑得动的歌词样式（registry 的 mode）。2026-11-18 在盒子（1920×1080 输出、“漫游”背景）上用页面帧率实测
 * （LyricBox box-setup/perfbench.py raf-styles，结果 box-setup/perf/raf_styles.json），每秒 15 帧以上的保留：
 * 透屏 58、静止 59、莫奈 20、群唱 19.5、倾诉 17、心象 15.5。
 * 屏蔽：回环 12.9、时计 12.5、流光 11.6、云阶 8.2、镜台 7.7、商籁 7.4、花火 5、雾 4.3、凝彩 4.1、浮名 3.9、绘光 2.2、町景 1.1。
 * 换成 1024×768 输出（iPad 屏）后可重测放宽。“随机”另算：它只从这里面挑。
 */
export const BOX_ALLOWED_VISUALIZERS: ReadonlySet<string> = new Set(['vetro', 'still', 'monet', 'cappella', 'tilt', 'cadenza']);

/**
 * 盒子上跑得动的背景（背景 registry 的 mode）。以“流光”样式实测（raf_backgrounds.json）：莫奈 11.6、漫游 10、嵌入 9.8、空 8；
 * 屏蔽：通用 6.4、隐现 2.2。
 */
export const BOX_ALLOWED_BACKGROUNDS: ReadonlySet<string> = new Set(['monet', 'nomand', 'url', 'sora']);

export const BOX_FALLBACK_VISUALIZER = 'vetro';
export const BOX_FALLBACK_BACKGROUND = 'monet';

/** 面板与 F9 里的“随机”选项，不是一个样式，保留。 */
const RANDOM_CHOICE = '__random__';

export const boxAllowsVisualizer = (mode: string, box = isLyricBoxBox()): boolean =>
    !box || mode === RANDOM_CHOICE || BOX_ALLOWED_VISUALIZERS.has(mode);

export const boxAllowsBackground = (mode: string, box = isLyricBoxBox()): boolean =>
    !box || BOX_ALLOWED_BACKGROUNDS.has(mode);

export const filterBoxVisualizers = <T extends string>(modes: readonly T[], box = isLyricBoxBox()): T[] =>
    modes.filter(mode => boxAllowsVisualizer(mode, box));

export const filterBoxBackgrounds = <T extends string>(modes: readonly T[], box = isLyricBoxBox()): T[] =>
    modes.filter(mode => boxAllowsBackground(mode, box));

/** 一段时间里的帧时间戳（毫秒）→ 帧率与超过 100 ms 的长帧数（盒子上每 5 秒写一次日志，供实测）。 */
export const summarizeFrames = (stamps: readonly number[]): { fps: number; long: number; worstMs: number } => {
    if (stamps.length < 2) return { fps: 0, long: 0, worstMs: 0 };
    let long = 0;
    let worst = 0;
    for (let i = 1; i < stamps.length; i++) {
        const gap = stamps[i] - stamps[i - 1];
        if (gap > 100) long++;
        if (gap > worst) worst = gap;
    }
    const span = (stamps[stamps.length - 1] - stamps[0]) / 1000;
    return { fps: Math.round(((stamps.length - 1) / span) * 10) / 10, long, worstMs: Math.round(worst) };
};

/**
 * 盒子开机直接进歌词播放页：打开“启动时打开播放界面”，播放入口设为歌词播放页（不是唱片墙）。
 * 由 src/lyricboxBoxBoot.ts 在所有模块之前执行，store 读本地存储时已是这些值。返回改动了的键。
 */
export const BOX_STARTUP_DEFAULTS: Readonly<Record<string, string>> = {
    open_player_on_launch: 'true',
    playback_entry_view: 'player',
};

export const applyBoxStartupDefaults = (
    storage: Pick<Storage, 'getItem' | 'setItem'> | null,
    box = isLyricBoxBox(),
): string[] => {
    if (!box || !storage) return [];
    const changed: string[] = [];
    for (const [key, value] of Object.entries(BOX_STARTUP_DEFAULTS)) {
        try {
            if (storage.getItem(key) !== value) {
                storage.setItem(key, value);
                changed.push(key);
            }
        } catch {
            // 存储不可用时照常启动
        }
    }
    return changed;
};
