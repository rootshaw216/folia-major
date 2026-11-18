import { describe, expect, it } from 'vitest';
import { BUILTIN_VISUALIZER_BACKGROUND_MODES, BUILTIN_VISUALIZER_MODES } from '@/types/visualizerModes';
import {
    applyBoxStartupDefaults,
    BOX_ALLOWED_BACKGROUNDS,
    BOX_ALLOWED_VISUALIZERS,
    BOX_FALLBACK_BACKGROUND,
    BOX_FALLBACK_VISUALIZER,
    BOX_STARTUP_DEFAULTS,
    boxAllowsBackground,
    boxAllowsVisualizer,
    filterBoxBackgrounds,
    filterBoxVisualizers,
    isLyricBoxBox,
    isLyricBoxLite,
    lyricBoxEdition,
    LYRICBOX_BOX_UA_TOKEN,
    summarizeFrames,
} from '@/utils/lyricboxBox';

// test/unit/utils/lyricboxBox.test.ts
// LyricBox: the TV box profile only kicks in inside the box player (its user agent carries LyricBoxBox).

const BOX_UA = `Mozilla/5.0 (X11; Linux armv7l; rv:160.0) Gecko/20100101 Firefox/160.0 ${LYRICBOX_BOX_UA_TOKEN}/1`;

describe('isLyricBoxBox', () => {
    it('only the box player is the box', () => {
        expect(isLyricBoxBox(BOX_UA)).toBe(true);
        expect(isLyricBoxBox('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0')).toBe(false);
        expect(isLyricBoxBox('')).toBe(false);
    });
});

describe('editions', () => {
    it('lite and full come from the box player, older players count as lite', () => {
        expect(lyricBoxEdition('Firefox/160.0 LyricBoxBox/1 (lite)')).toBe('lite');
        expect(lyricBoxEdition('Firefox/160.0 LyricBoxBox/1 (full)')).toBe('full');
        expect(lyricBoxEdition(BOX_UA)).toBe('lite');
        expect(lyricBoxEdition('Mozilla/5.0 Chrome/140.0')).toBeNull();
        expect(isLyricBoxLite('LyricBoxBox/1 (full)')).toBe(false);
        expect(isLyricBoxLite('LyricBoxBox/1 (lite)')).toBe(true);
        expect(isLyricBoxLite('Mozilla/5.0 Chrome/140.0')).toBe(false);
    });
});

describe('box lists', () => {
    it('only name real built-in modes, and the fallbacks are on them', () => {
        for (const mode of BOX_ALLOWED_VISUALIZERS) expect(BUILTIN_VISUALIZER_MODES).toContain(mode);
        for (const mode of BOX_ALLOWED_BACKGROUNDS) expect(BUILTIN_VISUALIZER_BACKGROUND_MODES).toContain(mode);
        expect(BOX_ALLOWED_VISUALIZERS.has(BOX_FALLBACK_VISUALIZER)).toBe(true);
        expect(BOX_ALLOWED_BACKGROUNDS.has(BOX_FALLBACK_BACKGROUND)).toBe(true);
    });

    it('keeps the transparent-screen style and drops the heaviest measured ones', () => {
        expect(BOX_FALLBACK_VISUALIZER).toBe('vetro');
        for (const heavy of ['machi', 'lumiere', 'fume', 'tempera', 'nebbia']) expect(BOX_ALLOWED_VISUALIZERS.has(heavy)).toBe(false);
        expect(BOX_ALLOWED_BACKGROUNDS.has('latent')).toBe(false);
    });
});

describe('filters', () => {
    it('filter on the box, pass everything elsewhere', () => {
        const modes = ['classic', 'vetro', 'machi', '__random__'];
        expect(filterBoxVisualizers(modes, true)).toEqual(['vetro', '__random__']);
        expect(filterBoxVisualizers(modes, false)).toEqual(modes);
        expect(filterBoxBackgrounds(['latent', 'monet', 'common'], true)).toEqual(['monet']);
        expect(filterBoxBackgrounds(['latent', 'monet'], false)).toEqual(['latent', 'monet']);
        expect(boxAllowsVisualizer('machi', false)).toBe(true);
        expect(boxAllowsBackground('latent', true)).toBe(false);
    });
});

describe('summarizeFrames', () => {
    it('frame rate, long frames and the worst gap', () => {
        const smooth = Array.from({ length: 61 }, (_, i) => i * (1000 / 60));
        expect(summarizeFrames(smooth)).toEqual({ fps: 60, long: 0, worstMs: 17 });
        expect(summarizeFrames([0, 100, 400, 500])).toEqual({ fps: 6, long: 1, worstMs: 300 });
        expect(summarizeFrames([5])).toEqual({ fps: 0, long: 0, worstMs: 0 });
    });
});

describe('applyBoxStartupDefaults', () => {
    const memory = (init: Record<string, string> = {}) => {
        const values = new Map(Object.entries(init));
        return { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => void values.set(k, v), values };
    };

    it('the box opens the lyric player on launch', () => {
        const s = memory({ playback_entry_view: 'lattice' });
        expect(applyBoxStartupDefaults(s, true).sort()).toEqual(['open_player_on_launch', 'playback_entry_view']);
        expect(Object.fromEntries(s.values)).toEqual(BOX_STARTUP_DEFAULTS);
        expect(applyBoxStartupDefaults(s, true)).toEqual([]);
    });

    it('leaves other devices and broken storage alone', () => {
        const s = memory({ playback_entry_view: 'lattice' });
        expect(applyBoxStartupDefaults(s, false)).toEqual([]);
        expect(s.values.get('playback_entry_view')).toBe('lattice');
        expect(applyBoxStartupDefaults(null, true)).toEqual([]);
        const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => undefined };
        expect(applyBoxStartupDefaults(broken, true)).toEqual([]);
    });
});
