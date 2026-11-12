// Screenshots of the film at given times:  node snap.mjs <outDir> t1 t2 ...   (or "beats" for one per beat)
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export const CHROME = process.env.CHROME ||
  `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.css': 'text/css' };
export function serve(root) {
  return new Promise((resolve) => {
    const srv = createServer(async (req, res) => {
      try {
        const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
        const body = await readFile(p.endsWith('/') ? `${p}index.html` : p);
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] ?? 'application/octet-stream' });
        res.end(body);
      } catch { res.writeHead(404); res.end(); }
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, url: `http://127.0.0.1:${srv.address().port}/index.html` }));
  });
}

export async function openFilm(browser, url, width = 1920, height = 1080, scale = 1) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: scale * width / 1920 });
  await page.goto(url);
  await page.waitForFunction(() => window.READY === true, null, { timeout: 30000 });
  return page;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [out, ...times] = process.argv.slice(2);
  await mkdir(out, { recursive: true });
  const { srv, url } = await serve(path.dirname(new URL(import.meta.url).pathname));
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await openFilm(browser, url, 1920, 1080, 0.5);
  page.on('pageerror', (e) => console.error('PAGE ERROR', e.message));
  const dur = await page.evaluate(() => window.DUR);
  const ts = times[0] === 'beats' ? Array.from({ length: Math.round(dur / 0.5) }, (_, k) => +(k * 0.5 + 0.12).toFixed(2)) : times.map(Number);
  for (const t of ts) {
    await page.evaluate((tt) => window.seek(tt), t);
    await page.screenshot({ path: path.join(out, `t${t.toFixed(2).padStart(6, '0')}.png`) });
  }
  console.log(`${ts.length} frames -> ${out}`);
  await browser.close();
  srv.close();
  process.exit(0);
}
