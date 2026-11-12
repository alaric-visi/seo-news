/* Renders the film.
   node render.mjs            -> out/seo-news-launch.mp4 (1920x1080, 60 fps, 4 subframes per frame blended for motion blur)
   node render.mjs --draft    -> out/draft.mp4 (960x540, 30 fps, no blur) for checking timing at normal speed
   Renders in 4 s chunks and deletes the stills after each one (disk is tight). */
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { CHROME, openFilm, serve } from './snap.mjs';

const draft = process.argv.includes('--draft');
const FPS = draft ? 30 : 60, SUB = draft ? 1 : 4, WIDTH = draft ? 960 : 1920, HEIGHT = draft ? 540 : 1080;
const CHUNK_S = 4, WORKERS = 3, QUALITY = draft ? 80 : 94;
const OUT = draft ? 'out/draft.mp4' : 'out/seo-news-launch.mp4';

mkdirSync('out', { recursive: true });
const { srv, url } = await serve(process.cwd());
let browser = await chromium.launch({ executablePath: CHROME });
const DUR = await (async () => { const p = await openFilm(browser, url, WIDTH, HEIGHT, 1); const d = await p.evaluate(() => window.DUR); await p.close(); return d; })();
const totalFrames = Math.round(DUR * FPS);
const subT = (i) => Math.floor(i / SUB) / FPS + (SUB > 1 ? ((i % SUB) - (SUB - 1) / 2) / (FPS * SUB) : 0);

async function renderRange(dir, from, to) {
  const queue = []; for (let i = from; i < to; i++) queue.push(i);
  const worker = async () => {
    let page = await openFilm(browser, url, WIDTH, HEIGHT, 1);
    while (queue.length) {
      const i = queue.shift();
      for (let attempt = 0; ; attempt++) {
        try {
          await page.evaluate((tt) => window.seek(tt), Math.max(0, subT(i)));
          await page.screenshot({ path: `${dir}/s${String(i).padStart(6, '0')}.jpg`, type: 'jpeg', quality: QUALITY });
          break;
        } catch (e) {
          if (attempt > 3) throw e;
          if (!browser.isConnected()) browser = await chromium.launch({ executablePath: CHROME });
          page = await openFilm(browser, url, WIDTH, HEIGHT, 1);
        }
      }
    }
    await page.close();
  };
  await Promise.all(Array.from({ length: WORKERS }, worker));
}

const segs = [];
const perChunk = CHUNK_S * FPS * SUB;
const totalSub = totalFrames * SUB;
for (let c = 0, from = 0; from < totalSub; c++, from += perChunk) {
  const to = Math.min(totalSub, from + perChunk), dir = `frames/c${c}`;
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const t0 = Date.now();
  await renderRange(dir, from, to);
  const seg = `out/seg${c}.mp4`;
  const vf = SUB > 1
    ? `tmix=frames=${SUB}:weights='${Array(SUB).fill(1).join(' ')}',select='eq(mod(n\\,${SUB})\\,${SUB - 1})',setpts=N/(${FPS}*TB),scale=out_color_matrix=bt709:out_range=tv,format=yuv420p`
    : 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p';
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(FPS * SUB), '-start_number', String(from), '-i', `${dir}/s%06d.jpg`,
    '-vf', vf, '-r', String(FPS), '-c:v', 'libx264', '-preset', draft ? 'veryfast' : 'slow', '-crf', draft ? '23' : '15', '-tune', 'film',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', seg]);
  rmSync(dir, { recursive: true, force: true });
  segs.push(seg);
  console.log(`chunk ${c}: ${(to - from)} stills in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
writeFileSync('out/segs.txt', segs.map((s) => `file '${s.replace('out/', '')}'`).join('\n'));
const audio = existsSync('mix.wav') ? ['-i', 'mix.wav', '-c:a', 'aac', '-b:a', '256k', '-shortest'] : [];
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', 'out/segs.txt', ...audio.slice(0, 2),
  '-map', '0:v', ...(audio.length ? ['-map', '1:a'] : []), '-c:v', 'copy', ...audio.slice(2), '-movflags', '+faststart', OUT]);
segs.forEach((s) => rmSync(s, { force: true })); rmSync('out/segs.txt', { force: true });
console.log(`-> ${OUT}`);
await browser.close().catch(() => {});
srv.close();
process.exit(0);
