// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// test/unit/hooks/useLyricBoxBox.test.ts
// LyricBox: inside the TV box player, styles and backgrounds the box cannot run are swapped for ones it can,
// once, with a note; F10 steps the background within the box list. Elsewhere nothing changes.

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

vi.mock('@/components/visualizer/registry', () => ({
    getVisualizerModeLabel: (mode: string) => `label:${mode}`,
}));

vi.mock('@/components/visualizer/backgrounds/registry', () => ({
    VISUALIZER_BACKGROUND_REGISTRY: ['common', 'monet', 'nomand', 'latent', 'url', 'sora'].map(mode => ({ mode })),
    getVisualizerBackgroundModeLabel: (mode: string) => `bg:${mode}`,
}));

const { useLyricBoxBox } = await import('@/hooks/useLyricBoxBox');
const { useVisualizerSettingsStore } = await import('@/stores/useVisualizerSettingsStore');
const { useStatusMessageStore } = await import('@/stores/useStatusMessageStore');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | null = null;
let host: HTMLDivElement | null = null;
const realUa = navigator.userAgent;

const setUa = (ua: string) => Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });

const Probe = () => {
    useLyricBoxBox();
    return null;
};

const mount = () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root!.render(React.createElement(Probe)));
};

const press = (key: string) => {
    const event = new KeyboardEvent('keydown', { key, cancelable: true });
    act(() => {
        window.dispatchEvent(event);
    });
    return event;
};

const state = () => useVisualizerSettingsStore.getState();
const message = () => useStatusMessageStore.getState().message?.text ?? '';

describe('useLyricBoxBox', () => {
    beforeEach(() => {
        vi.spyOn(console, 'info').mockImplementation(() => undefined);
        state().handleSetVisualizerMode('classic', { notify: false });
        state().handleSetVisualizerBackgroundMode('latent');
        act(() => useStatusMessageStore.getState().setMessage(null));
    });

    afterEach(() => {
        act(() => root?.unmount());
        host?.remove();
        root = null;
        host = null;
        setUa(realUa);
        vi.restoreAllMocks();
    });

    it('on the box: swaps a heavy style and background once, with a note', () => {
        setUa('Mozilla/5.0 (X11; Linux armv7l; rv:160.0) Gecko/20100101 Firefox/160.0 LyricBoxBox/1');
        mount();
        expect(state().visualizerMode).toBe('vetro');
        expect(state().visualizerBackgroundMode).toBe('monet');
        expect(message()).toContain('bg:latent');
        act(() => state().handleSetVisualizerMode('machi', { notify: false }));
        expect(state().visualizerMode).toBe('vetro');
        expect(message()).toContain('label:machi');
        act(() => state().handleSetVisualizerMode('cappella', { notify: false }));
        expect(state().visualizerMode).toBe('cappella');
    });

    it('on the box: F10 steps the background within the box list', () => {
        setUa('LyricBoxBox/1');
        mount();
        expect(state().visualizerBackgroundMode).toBe('monet');
        expect(press('F10').defaultPrevented).toBe(true);
        expect(state().visualizerBackgroundMode).toBe('nomand');
        press('F10');
        expect(state().visualizerBackgroundMode).toBe('url');
        press('F10');
        press('F10');
        expect(state().visualizerBackgroundMode).toBe('monet');
    });

    it('full edition: no limits, F10 walks every background', () => {
        setUa('Mozilla/5.0 (X11; Linux armv7l; rv:160.0) Gecko/20100101 Firefox/160.0 LyricBoxBox/1 (full)');
        mount();
        expect(state().visualizerMode).toBe('classic');
        expect(state().visualizerBackgroundMode).toBe('latent');
        press('F10');
        expect(state().visualizerBackgroundMode).toBe('url');
        act(() => state().handleSetVisualizerMode('machi', { notify: false }));
        expect(state().visualizerMode).toBe('machi');
    });

    it('anywhere else: changes nothing', () => {
        setUa('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0');
        mount();
        expect(state().visualizerMode).toBe('classic');
        expect(state().visualizerBackgroundMode).toBe('latent');
        expect(press('F10').defaultPrevented).toBe(false);
        expect(state().visualizerBackgroundMode).toBe('latent');
    });
});
