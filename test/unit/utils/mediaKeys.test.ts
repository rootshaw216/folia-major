// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerState } from '@/types';
import { MEDIA_ACTION_DEDUPE_MS, createMediaActionGate, resolveMediaKeyAction } from '@/utils/mediaKeys';

// test/unit/utils/mediaKeys.test.ts
// 硬件媒体键的 keydown 兜底：安卓 WebView（电视盒子上的 Fully Kiosk）里蓝牙遥控的媒体键只以 keydown 送进页面。
// 键翻成和 Media Session 同样的四个动作；同一次按键两条路都到时只执行一次。

vi.hoisted(() => {
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key), clear: () => values.clear(),
    } });
});

const { useMediaSessionBridge } = await import('@/hooks/useMediaSessionBridge');

describe('resolveMediaKeyAction', () => {
    it('maps the media keys to the Media Session actions', () => {
        expect(resolveMediaKeyAction('MediaPlayPause', false)).toBe('play');
        expect(resolveMediaKeyAction('MediaPlayPause', true)).toBe('pause');
        expect(resolveMediaKeyAction('MediaPlay', true)).toBe('play');
        expect(resolveMediaKeyAction('MediaPause', false)).toBe('pause');
        expect(resolveMediaKeyAction('MediaStop', true)).toBe('pause');
        expect(resolveMediaKeyAction('MediaTrackNext', false)).toBe('nexttrack');
        expect(resolveMediaKeyAction('MediaTrackPrevious', false)).toBe('previoustrack');
    });

    it('ignores every other key', () => {
        for (const key of [' ', 'Enter', 'ArrowRight', 'AudioVolumeUp', 'k', '']) {
            expect(resolveMediaKeyAction(key, true)).toBeNull();
        }
    });
});

describe('createMediaActionGate', () => {
    it('lets the same action through once per window, and other actions at once', () => {
        const gate = createMediaActionGate(250);
        expect(gate.pass('pause', 1000)).toBe(true);
        expect(gate.pass('pause', 1100)).toBe(false);
        expect(gate.pass('play', 1150)).toBe(true);
        expect(gate.pass('play', 1399)).toBe(false);
        expect(gate.pass('play', 1400)).toBe(true);
        expect(MEDIA_ACTION_DEDUPE_MS).toBe(250);
    });
});

describe('useMediaSessionBridge media keys', () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    let root: Root | null = null;
    let now = 0;
    const handlers = new Map<string, (() => unknown) | null>();
    const calls = { play: vi.fn(async () => undefined), pause: vi.fn(), prev: vi.fn(), next: vi.fn() };

    const mount = (playerState: PlayerState, disabled = false) => {
        const ref = <T,>(value: T) => ({ current: value });
        function Probe() {
            useMediaSessionBridge({
                audioRef: ref(document.createElement('audio')),
                audioSrc: null,
                currentSong: null,
                cachedCoverUrl: null,
                playerState,
                isNowPlayingStageActive: false,
                unknownArtistLabel: 'Unknown',
                mediaSessionPlayRef: ref(calls.play),
                mediaSessionPauseRef: ref(calls.pause),
                mediaSessionPrevRef: ref(calls.prev),
                mediaSessionNextRef: ref(calls.next),
                isNowPlayingControlDisabledRef: ref(disabled),
            });
            return null;
        }
        root = createRoot(document.createElement('div'));
        act(() => root!.render(React.createElement(Probe)));
    };

    const press = (key: string, init: KeyboardEventInit = {}) => {
        const event = new KeyboardEvent('keydown', { key, cancelable: true, ...init });
        act(() => {
            window.dispatchEvent(event);
        });
        return event;
    };

    beforeEach(() => {
        now = 10_000;
        vi.spyOn(performance, 'now').mockImplementation(() => now);
        handlers.clear();
        Object.values(calls).forEach(fn => fn.mockClear());
        Object.defineProperty(navigator, 'mediaSession', { configurable: true, value: {
            metadata: null,
            playbackState: 'none',
            setActionHandler: (action: string, handler: (() => unknown) | null) => handlers.set(action, handler),
            setPositionState: () => undefined,
        } });
    });

    afterEach(() => {
        act(() => root?.unmount());
        root = null;
        vi.restoreAllMocks();
    });

    it('runs play / pause / next / previous from keydown', () => {
        mount(PlayerState.PLAYING);
        expect(press('MediaPlayPause').defaultPrevented).toBe(true);
        expect(calls.pause).toHaveBeenCalledTimes(1);
        now += 1000;
        press('MediaTrackNext');
        expect(calls.next).toHaveBeenCalledTimes(1);
        now += 1000;
        press('MediaTrackPrevious');
        expect(calls.prev).toHaveBeenCalledTimes(1);
        expect(calls.play).not.toHaveBeenCalled();
    });

    it('starts playback from the toggle key while paused', () => {
        mount(PlayerState.PAUSED);
        press('MediaPlayPause');
        expect(calls.play).toHaveBeenCalledTimes(1);
        expect(calls.pause).not.toHaveBeenCalled();
    });

    it('runs one press once when it also arrives through the Media Session', () => {
        mount(PlayerState.PLAYING);
        press('MediaTrackNext');
        act(() => {
            handlers.get('nexttrack')?.();
        });
        expect(calls.next).toHaveBeenCalledTimes(1);
        // A second press later is a new press.
        now += MEDIA_ACTION_DEDUPE_MS + 1;
        act(() => {
            handlers.get('nexttrack')?.();
        });
        expect(calls.next).toHaveBeenCalledTimes(2);
    });

    it('ignores held keys, other keys, and the keys while controls are disabled', () => {
        mount(PlayerState.PLAYING);
        press('MediaTrackNext', { repeat: true });
        expect(press('ArrowRight').defaultPrevented).toBe(false);
        expect(calls.next).not.toHaveBeenCalled();
        act(() => root?.unmount());
        root = null;

        mount(PlayerState.PLAYING, true);
        press('MediaPlayPause');
        press('MediaTrackNext');
        expect(calls.pause).not.toHaveBeenCalled();
        expect(calls.next).not.toHaveBeenCalled();
    });

    it('stops listening once unmounted', () => {
        mount(PlayerState.PLAYING);
        act(() => root?.unmount());
        root = null;
        press('MediaTrackNext');
        expect(calls.next).not.toHaveBeenCalled();
        expect(handlers.get('nexttrack')).toBeNull();
    });
});
