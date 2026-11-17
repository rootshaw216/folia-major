// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// test/unit/hooks/useLyricStyleKeys.test.ts
// LyricBox: the remote's F9 (and a keyboard's F9 / F8) steps the lyric style in the same order as the
// panel arrows, wraps around, can land on "random", and leaves other keys alone.

vi.hoisted(() => {
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key), clear: () => values.clear(),
    } });
});

vi.mock('react-i18next', async importOriginal => ({
    ...await importOriginal<typeof import('react-i18next')>(),
    useTranslation: () => ({ t: (key: string) => key }),
}));

// A small registry keeps the test off the real visualizers (three.js and friends).
vi.mock('@/components/visualizer/registry', () => ({
    VISUALIZER_REGISTRY: [{ mode: 'classic' }, { mode: 'vetro' }, { mode: 'monet' }],
    getVisualizerModeLabel: (mode: string) => mode,
}));

vi.mock('@/components/visualizer/random/lyricStyleChoices', async () => {
    const { useVisualizerSettingsStore } = await import('@/stores/useVisualizerSettingsStore');
    const RANDOM = '__random__';
    return {
        RANDOM_VISUALIZER_CHOICE: RANDOM,
        selectLyricStyleChoice: (mode: string, select: (m: string) => void, notify = true) => {
            if (mode === RANDOM) {
                useVisualizerSettingsStore.getState().handleToggleRandomVisualizerModePerSong(true, { notify });
            } else {
                select(mode);
            }
        },
    };
});

const { useLyricStyleKeys } = await import('@/hooks/useLyricStyleKeys');
const { useVisualizerSettingsStore } = await import('@/stores/useVisualizerSettingsStore');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | null = null;
let host: HTMLDivElement | null = null;

const Probe = () => {
    useLyricStyleKeys();
    return null;
};

const press = (key: string, init: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', { key, cancelable: true, ...init });
    act(() => {
        window.dispatchEvent(event);
    });
    return event;
};

const mode = () => useVisualizerSettingsStore.getState().visualizerMode;
const random = () => useVisualizerSettingsStore.getState().randomVisualizerModePerSong;

describe('useLyricStyleKeys', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        useVisualizerSettingsStore.getState().handleSetVisualizerMode('classic', { notify: false });
        host = document.createElement('div');
        document.body.appendChild(host);
        root = createRoot(host);
        act(() => root!.render(React.createElement(Probe)));
    });

    afterEach(() => {
        act(() => root?.unmount());
        host?.remove();
        root = null;
        host = null;
        vi.useRealTimers();
    });

    it('F9 steps forward through the styles and onto "random", then wraps', () => {
        const e = press('F9');
        expect(e.defaultPrevented).toBe(true);
        expect(mode()).toBe('vetro');
        press('F9');
        expect(mode()).toBe('monet');
        press('F9');
        expect(random()).toBe(true);
        press('F9');
        expect(random()).toBe(false);
        expect(mode()).toBe('classic');
    });

    it('F8 steps backward', () => {
        press('F8');
        expect(random()).toBe(true);
        press('F8');
        expect(random()).toBe(false);
        expect(mode()).toBe('monet');
    });

    it('leaves other keys and modified presses alone', () => {
        const other = press('MediaTrackNext');
        expect(other.defaultPrevented).toBe(false);
        press('F9', { ctrlKey: true });
        press('F9', { repeat: true });
        expect(mode()).toBe('classic');
    });

    it('stops listening once unmounted', () => {
        act(() => root?.unmount());
        root = null;
        press('F9');
        expect(mode()).toBe('classic');
    });
});
