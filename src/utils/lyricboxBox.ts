// src/utils/lyricboxBox.ts
// LyricBox：电视盒子的两个版本。LyricBox 的盒子播放器（自带 GeckoView 的安卓壳）在浏览器标识里带
// “LyricBoxBox/1 (lite)” 或 “LyricBoxBox/1 (full)”；电脑、手机上的 Folia 不受影响。
// - 精简版 lite（安卓版本低、性能弱的盒子）：跑不动的歌词样式与背景不出现在面板、F9、随机池里，
//   已经选上的（旧设置、命令面板）自动换成能跑的。名单来自盒子上的实测（LyricBox box-setup/perfbench.py）。
// - 完整版 full：全部样式与背景都开放。
// 两个版本都开机直接进歌词播放页、都写帧率日志。版本由盒子播放器决定（默认安卓 11 及以下用精简版），
// 换盒子时一条命令切换：python box-app/appctl.py edition lite|full|auto。

export const LYRICBOX_BOX_UA_TOKEN = 'LyricBoxBox';

export type LyricBoxEdition = 'lite' | 'full';

const currentUa = (): string => (typeof navigator !== 'undefined' ? navigator.userAgent : '');

export const isLyricBoxBox = (ua: string = currentUa()): boolean => ua.includes(LYRICBOX_BOX_UA_TOKEN);

/** 盒子上的版本；不是盒子时为 null。标识里没写版本的旧播放器按精简版算。 */
export const lyricBoxEdition = (ua: string = currentUa()): LyricBoxEdition | null => {
    if (!isLyricBoxBox(ua)) return null;
    const m = /LyricBoxBox\/\d+\s*\((lite|full)\)/.exec(ua);
    return m ? (m[1] as LyricBoxEdition) : 'lite';
};

/** 是否按盒子名单限制样式与背景（只有精简版）。 */
export const isLyricBoxLite = (ua: string = currentUa()): boolean => lyricBoxEdition(ua) === 'lite';

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

// 下面的 lite 参数 = 是否按精简版名单限制（默认看当前浏览器标识）。
export const boxAllowsVisualizer = (mode: string, lite = isLyricBoxLite()): boolean =>
    !lite || mode === RANDOM_CHOICE || BOX_ALLOWED_VISUALIZERS.has(mode);

export const boxAllowsBackground = (mode: string, lite = isLyricBoxLite()): boolean =>
    !lite || BOX_ALLOWED_BACKGROUNDS.has(mode);

export const filterBoxVisualizers = <T extends string>(modes: readonly T[], lite = isLyricBoxLite()): T[] =>
    modes.filter(mode => boxAllowsVisualizer(mode, lite));

export const filterBoxBackgrounds = <T extends string>(modes: readonly T[], lite = isLyricBoxLite()): T[] =>
    modes.filter(mode => boxAllowsBackground(mode, lite));

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
