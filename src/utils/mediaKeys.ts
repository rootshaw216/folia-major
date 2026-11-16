// src/utils/mediaKeys.ts
// 硬件媒体键的键盘事件兜底。Chrome 把媒体键交给 Media Session（useMediaSessionBridge），
// 但安卓 WebView（电视盒子上的 Fully Kiosk 之类）没有接系统媒体会话，蓝牙遥控 / 键盘的媒体键
// 只会以 keydown（key 为 MediaPlayPause 等）送进页面。这里把这些键翻成同样的四个动作。
// 两条路都可能送到同一次按键时，用一个短时间窗把同一个动作去重。

export type MediaKeyAction = 'play' | 'pause' | 'previoustrack' | 'nexttrack';

/** keydown 的 `key` 对应的动作；MediaPlayPause 按当前是否在播放决定是播还是停。不是媒体键时为 null。 */
export const resolveMediaKeyAction = (key: string, isPlaying: boolean): MediaKeyAction | null => {
    switch (key) {
        case 'MediaPlayPause':
            return isPlaying ? 'pause' : 'play';
        case 'MediaPlay':
            return 'play';
        case 'MediaPause':
        case 'MediaStop':
            return 'pause';
        case 'MediaTrackNext':
            return 'nexttrack';
        case 'MediaTrackPrevious':
            return 'previoustrack';
        default:
            return null;
    }
};

/** 同一个动作在这么多毫秒内只执行一次：一次按键可能既走 Media Session 又走 keydown。 */
export const MEDIA_ACTION_DEDUPE_MS = 250;

export interface MediaActionGate {
    /** 该不该执行这个动作；放行时记下时间。 */
    pass: (action: MediaKeyAction, now: number) => boolean;
}

export const createMediaActionGate = (windowMs = MEDIA_ACTION_DEDUPE_MS): MediaActionGate => {
    let lastAction: MediaKeyAction | null = null;
    let lastAt = Number.NEGATIVE_INFINITY;
    return {
        pass: (action, now) => {
            if (action === lastAction && now - lastAt < windowMs) {
                return false;
            }
            lastAction = action;
            lastAt = now;
            return true;
        },
    };
};
