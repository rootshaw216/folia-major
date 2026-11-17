import { describe, expect, it } from 'vitest';
import { LYRIC_STYLE_NEXT_KEY, LYRIC_STYLE_PREV_KEY, resolveLyricStyleStep, type LyricStyleKeyEvent } from '@/utils/lyricStyleKeys';

// test/unit/utils/lyricStyleKeys.test.ts
// LyricBox: F9 / F8 step the lyric style (the ESP32 remote sends F9 on a long press of button 2).

const key = (k: string, extra: Partial<LyricStyleKeyEvent> = {}): LyricStyleKeyEvent => ({
    key: k, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, repeat: false, defaultPrevented: false, ...extra,
});

describe('resolveLyricStyleStep', () => {
    it('F9 is next, F8 is previous', () => {
        expect(LYRIC_STYLE_NEXT_KEY).toBe('F9');
        expect(resolveLyricStyleStep(key('F9'))).toBe(1);
        expect(resolveLyricStyleStep(key(LYRIC_STYLE_PREV_KEY))).toBe(-1);
    });

    it('ignores other keys, including the media keys handled elsewhere', () => {
        for (const k of ['F10', 'f9', 'MediaTrackNext', 'MediaPlayPause', 'ArrowRight', ' ']) {
            expect(resolveLyricStyleStep(key(k))).toBeNull();
        }
    });

    it('ignores modified, auto-repeated and already handled presses', () => {
        expect(resolveLyricStyleStep(key('F9', { ctrlKey: true }))).toBeNull();
        expect(resolveLyricStyleStep(key('F9', { altKey: true }))).toBeNull();
        expect(resolveLyricStyleStep(key('F9', { metaKey: true }))).toBeNull();
        expect(resolveLyricStyleStep(key('F9', { shiftKey: true }))).toBeNull();
        expect(resolveLyricStyleStep(key('F9', { repeat: true }))).toBeNull();
        expect(resolveLyricStyleStep(key('F9', { defaultPrevented: true }))).toBeNull();
    });
});
