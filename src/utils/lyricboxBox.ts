// src/utils/lyricboxBox.ts
// LyricBox：电视盒子性能档。LyricBox 的盒子播放器（自带 GeckoView 的安卓壳）在浏览器标识里带 LyricBoxBox，
// 只有它才启用这里的限制；电脑、手机上的 Folia 不受影响。
// 盒子（X98 Plus：4×Cortex-A55 + Mali Bifrost，1920×1080）跑不动的歌词样式与背景不出现在面板、F9、随机池里，
// 已经选上的（旧设置、命令面板）自动换成能跑的。名单来自盒子上的实测（LyricBox box-setup/perfbench.py）。

export const LYRICBOX_BOX_UA_TOKEN = 'LyricBoxBox';

export const isLyricBoxBox = (ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): boolean =>
    ua.includes(LYRICBOX_BOX_UA_TOKEN);

/** 盒子上能流畅运行的歌词样式（registry 的 mode）。“随机”另算：它只从这里面挑。 */
export const BOX_ALLOWED_VISUALIZERS: ReadonlySet<string> = new Set([
    'sonnet', 'tempera', 'lumiere', 'hanabi', 'machi', 'nebbia', 'classic', 'cadenza', 'partita', 'fume',
    'tilt', 'claddagh', 'monet', 'pendolo', 'cappella', 'diorama', 'still', 'vetro',
]);

/** 盒子上能流畅运行的背景（背景 registry 的 mode）。 */
export const BOX_ALLOWED_BACKGROUNDS: ReadonlySet<string> = new Set(['common', 'latent', 'monet', 'nomand', 'sora', 'url']);

export const BOX_FALLBACK_VISUALIZER = 'vetro';
export const BOX_FALLBACK_BACKGROUND = 'sora';

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
