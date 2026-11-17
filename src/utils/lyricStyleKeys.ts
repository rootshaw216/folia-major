// src/utils/lyricStyleKeys.ts
// LyricBox：用遥控器 / 键盘直接换歌词样式。电视盒子上的 Folia 没有触屏，面板里的箭头要靠手机远程或飞鼠点；
// LyricBox 的 ESP32 遥控器长按按键 2 会以蓝牙键盘发 F9。F9 = 下一个样式，F8 = 上一个样式，
// 顺序与面板「外观」里左右箭头相同（含「随机」）。带修饰键、按住连发、已被别的快捷键处理的按键都不算。

export const LYRIC_STYLE_NEXT_KEY = 'F9';
export const LYRIC_STYLE_PREV_KEY = 'F8';

export interface LyricStyleKeyEvent {
    key: string;
    ctrlKey: boolean;
    altKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
    repeat: boolean;
    defaultPrevented: boolean;
}

/** 这次按键要把歌词样式往哪边走一格：1 下一个，-1 上一个，null 不是换样式的键。 */
export const resolveLyricStyleStep = (event: LyricStyleKeyEvent): 1 | -1 | null => {
    if (event.defaultPrevented || event.repeat || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
        return null;
    }
    if (event.key === LYRIC_STYLE_NEXT_KEY) {
        return 1;
    }
    if (event.key === LYRIC_STYLE_PREV_KEY) {
        return -1;
    }
    return null;
};
