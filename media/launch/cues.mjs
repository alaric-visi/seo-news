// Exports the film's sound cues (one source of truth: window.CUES in film.js) to cues.json.
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { CHROME, openFilm, serve } from './snap.mjs';

const { srv, url } = await serve(process.cwd());
const browser = await chromium.launch({ executablePath: CHROME });
const page = await openFilm(browser, url, 960, 540, 0.5);
const data = await page.evaluate(() => ({ dur: window.DUR, cues: window.CUES }));
await writeFile('cues.json', JSON.stringify(data, null, 1));
console.log(`${data.cues.length} cues, ${data.dur}s`);
await browser.close();
srv.close();
process.exit(0);
