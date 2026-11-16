import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
// test/component/transparentScreen.spec.ts
// LyricBox 透明屏（去背光的 iPad 2 液晶面板，1024×768：白色透光、深色遮光）上的歌词观感，
// 走 dev 组件探针 dev/probes/transparentScreen.probe.tsx。量两件事：
// - 亮像素占比（相对亮度 > 0.85）：越高，屏后的摆件越看得清；要求 ≥ 85%。
// - 歌词对比度：背景亮度对最暗的 0.2% 像素（字的笔画），按 WCAG 公式；要求 ≥ 7:1。
// 解码截图在浏览器里用 canvas 做，不依赖额外的 PNG 库。

test.use({ viewport: { width: 1024, height: 768 } });

interface ScreenMetrics {
    bright: number;
    dark: number;
    contrast: number;
}

const measure = async (page: Page): Promise<ScreenMetrics> => {
    const png = await page.screenshot({ type: 'png' });
    return page.evaluate(async (b64) => {
        const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
        const bitmap = await createImageBitmap(blob);
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const context = canvas.getContext('2d');
        if (!context) throw new Error('no 2d context');
        context.drawImage(bitmap, 0, 0);
        const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
        const channel = (value: number) => {
            const c = value / 255;
            return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        };
        const count = bitmap.width * bitmap.height;
        const luminance = new Float32Array(count);
        let bright = 0;
        let dark = 0;
        for (let i = 0; i < count; i += 1) {
            const l = 0.2126 * channel(data[i * 4]) + 0.7152 * channel(data[i * 4 + 1]) + 0.0722 * channel(data[i * 4 + 2]);
            luminance[i] = l;
            if (l > 0.85) bright += 1;
            if (l < 0.2) dark += 1;
        }
        luminance.sort();
        const background = luminance[Math.floor(count * 0.5)];
        const ink = luminance[Math.floor(count * 0.002)];
        const [high, low] = background >= ink ? [background, ink] : [ink, background];
        return { bright: bright / count, dark: dark / count, contrast: (high + 0.05) / (low + 0.05) };
    }, png.toString('base64'));
};

const open = async (page: Page, look: 'transparent' | 'default', style = 'classic') => {
    await page.goto(`?probe=transparentScreen&look=${look}&style=${style}`);
    await page.locator(`[data-probe-look="${look}"]`).waitFor();
    await page.evaluate(() => document.fonts.ready);
    // 字体、歌词排版和背景的第一帧都画完再量。
    await page.waitForTimeout(2500);
};

test('透明屏外观（Vetro）：画面大部分是白色（透光），歌词与背景对比度 ≥ 7:1', async ({ page }) => {
    await open(page, 'transparent', 'vetro');
    const metrics = await measure(page);
    console.log('[transparentScreen] transparent', JSON.stringify(metrics));
    await page.screenshot({ path: test.info().outputPath('transparent-vetro.png') });
    expect(metrics.bright).toBeGreaterThanOrEqual(0.85);
    expect(metrics.contrast).toBeGreaterThanOrEqual(7);
});

test('对照：默认深色外观达不到透明屏要求（这条证明上面的量法分得出好坏）', async ({ page }) => {
    await open(page, 'default');
    const metrics = await measure(page);
    console.log('[transparentScreen] default', JSON.stringify(metrics));
    await page.screenshot({ path: test.info().outputPath('default-classic.png') });
    expect(metrics.bright).toBeLessThan(0.5);
});
