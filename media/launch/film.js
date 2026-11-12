/* SEO News launch film. Every frame is seek(t): styles are pure functions of time.
   One shape (#S) morphs through every state; content swaps with a short blur. */
'use strict';

const W = 1920, H = 1080, BEAT = 0.5, DUR = 26;
const TEAL = '#2dd4bf', MINT = '#5eead4', INK = '#f4f4f5', MUTED = '#a1a1aa', DIM = '#8c8c96';
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const outQ = (k) => 1 - Math.pow(1 - clamp(k), 4);

/* ---------- springs (closed form) ---------- */
function stepR(tau, sp) {
  if (tau <= 0) return 0;
  const { w, z } = sp;
  if (z >= 1) { const x = w * tau; return 1 - Math.exp(-x) * (1 + x); }
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * tau) * (Math.cos(wd * tau) + (z * w / wd) * Math.sin(wd * tau));
}
class Track {
  constructor(v0) { this.v0 = v0; this.cur = v0; this.ev = []; }
  to(t, v, sp) { if (v !== this.cur) { this.ev.push([t, v - this.cur, sp]); this.cur = v; } return this; }
  at(t) { let v = this.v0; for (const [ti, d, sp] of this.ev) v += d * stepR(t - ti, sp); return v; }
}
const SP = {
  morph: { w: 17, z: 0.86 },   // shape geometry: a tiny overshoot
  snap: { w: 26, z: 0.8 },
  cam: { w: 7.5, z: 1 },       // camera and text never overshoot
  camFast: { w: 12, z: 1 },
  soft: { w: 10, z: 1 },
  pop: { w: 30, z: 0.74 },
  back: { w: 14, z: 0.78 },
};

/* enter on a spring, exit short and early */
function vis(t, tin, tout, dOut = 0.12) {
  const e = stepR(t - tin, { w: 26, z: 1 });
  const x = tout == null ? 0 : clamp((t - tout) / dOut), xo = x * x;
  return { o: e * (1 - xo), b: (1 - e) * 10 + xo * 10, dy: (1 - e) * 16 - xo * 10, e };
}
function visW(t, windows, dOut) {
  let best = { o: 0, b: 10, dy: 16, e: 0 };
  for (const [a, b] of windows) if (t >= a - 1e-6) best = vis(t, a, b, dOut);
  return best;
}
const pulse = (t, tc, s = 0.06) => Math.exp(-Math.pow((t - tc) / s, 2));

/* ---------- DOM helpers ---------- */
const $ = (id) => document.getElementById(id);
function mk(tag, cls, parent, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  parent.appendChild(e);
  return e;
}
function st(e, o) { for (const k in o) e.style[k] = o[k]; }
function applyVis(e, v, extra = '') {
  e.style.opacity = v.o.toFixed(4);
  e.style.filter = v.b > 0.05 && v.o > 0.001 ? `blur(${v.b.toFixed(2)}px)` : 'none';
  e.style.transform = `translateY(${v.dy.toFixed(2)}px) ${extra}`;
  e.style.visibility = v.o < 0.002 ? 'hidden' : 'visible';
}

/* ---------- sound cues (exported to the audio renderer) ---------- */
const CUES = [];
const cue = (t, type, extra = {}) => CUES.push({ t: +t.toFixed(4), type, ...extra });

/* ---------- real data (live site, 12 Nov 2026) ---------- */
const NOV = { 3: 8, 4: 8, 5: 6, 6: 1, 8: 2, 9: 7, 10: 14, 11: 15, 12: 1 };
const MONTHS = [
  { key: 'November 2026', first: 6, days: 30, counts: NOV },
  { key: 'October 2026', first: 3, days: 31, counts: { 1: 1, 6: 1, 8: 1, 15: 1, 16: 1, 20: 1, 21: 1, 22: 2, 23: 3, 26: 2, 27: 2, 28: 2, 29: 2, 30: 2 } },
  { key: 'September 2026', first: 1, days: 30, counts: { 24: 1 } },
  { key: 'August 2026', first: 5, days: 31, counts: { 18: 1 } },
  { key: 'July 2026', first: 2, days: 31, counts: {} },
  { key: 'June 2026', first: 0, days: 30, counts: { 24: 1 } },
  { key: 'May 2026', first: 4, days: 31, counts: { 21: 1 } },
  { key: 'April 2026', first: 2, days: 30, counts: {} },
];
const MAXC = 15;
const level = (c) => (c === 0 ? 0 : c / MAXC > 0.66 ? 3 : c / MAXC > 0.33 ? 2 : 1);
const LV_BG = ['rgba(255,255,255,0.025)', 'rgba(45,212,191,0.14)', 'rgba(45,212,191,0.38)', TEAL];
const LV_BORDER = ['rgba(255,255,255,0.06)', 'rgba(45,212,191,0.35)', 'rgba(45,212,191,0.45)', TEAL];
const LV_TEXT = [DIM, INK, INK, '#042f2e'];

const MARK = (today = '#ccfbf1') => {
  const cells = [[150, 252], [230, 252], [310, 252], [150, 318], [230, 318], [310, 318]];
  return `<rect x="112" y="136" width="288" height="264" rx="40" fill="none" stroke="${TEAL}" stroke-width="28"/>
    <path d="M112 214h288" stroke="${TEAL}" stroke-width="28"/>
    <path d="M184 100v68M328 100v68" stroke="${TEAL}" stroke-width="28" stroke-linecap="round"/>` +
    cells.map(([x, y], i) => i === 4
      ? `<rect class="today" x="${x}" y="${y}" width="52" height="44" rx="10" fill="${today}"/>`
      : `<rect x="${x}" y="${y}" width="52" height="44" rx="10" fill="${TEAL}" fill-opacity="0.32"/>`).join('');
};

/* ====================================================================== */
const world = $('world'), hud = $('hud'), bg = $('bg');
const trail = $('trail').getContext('2d');

/* ---------- camera ---------- */
const CX = new Track(0), CY = new Track(0), LZ = new Track(Math.log(2.0));
function cam(t, x, y, z, sp = SP.cam) { CX.to(t, x, sp); CY.to(t, y, sp); LZ.to(t, Math.log(z), sp); }
const camAt = (t) => ({ x: CX.at(t), y: CY.at(t), z: Math.exp(LZ.at(t)) });
const toScreen = (t, wx, wy) => { const c = camAt(t); return { x: (wx - c.x) * c.z + W / 2, y: (wy - c.y) * c.z + H / 2, z: c.z }; };

/* ---------- the shape ---------- */
const S = mk('div', 'a', world);
st(S, { overflow: 'hidden', boxSizing: 'border-box' });
const SX = new Track(0), SY = new Track(0), SW = new Track(132), SH = new Track(132), SR = new Track(32);
const TT = new Track(0), RIM = new Track(1), BL = new Track(0);
function shape(t, o, sp = SP.morph) {
  if (o.x != null) SX.to(t, o.x, sp);
  if (o.y != null) SY.to(t, o.y, sp);
  if (o.w != null) SW.to(t, o.w, sp);
  if (o.h != null) SH.to(t, o.h, sp);
  if (o.r != null) SR.to(t, o.r, sp);
  if (o.tt != null) TT.to(t, o.tt, SP.soft);
  if (o.rim != null) RIM.to(t, o.rim, SP.soft);
  if (o.bl != null) BL.to(t, o.bl, SP.soft);
}
/* a content layer centred in the shape, at its own natural size */
function layer(w, h) {
  const e = mk('div', 'a', S);
  st(e, { width: `${w}px`, height: `${h}px`, left: '50%', top: '50%', marginLeft: `${-w / 2}px`, marginTop: `${-h / 2}px` });
  return e;
}

/* ---------- timeline: shape + camera ---------- */
const T = {
  search: 1.0, typeStart: 1.12, enter: 2.0, tabs0: 2.25, cap1: 2.5, collapse: 4.5, cap2: 5.0,
  drop: 6.0, lights0: 6.25, hover: 8.7, click: 9.0, dive: 9.1, card: 9.6, rows: 10.75,
  roll: 13.95, press: 15.0, release: 15.6, brief: 15.95, topics: 17.95, archive: 19.95,
  flyIn: 21.4, endTile: 21.7, word: 22.0, wordOut: 24.85, home: 25.0,
};

// geometry of the calendar (also used by the cursor)
const CAL = { w: 1060, h: 780, padX: 40, gridTop: 150, gap: 10, cellH: 90 };
CAL.cellW = (CAL.w - CAL.padX * 2 - CAL.gap * 6) / 7;
const cellRect = (i) => {
  const col = i % 7, row = Math.floor(i / 7);
  const x = -CAL.w / 2 + CAL.padX + col * (CAL.cellW + CAL.gap);
  const y = -CAL.h / 2 + CAL.gridTop + row * (CAL.cellH + CAL.gap);
  return { x, y, cx: x + CAL.cellW / 2, cy: y + CAL.cellH / 2 };
};
const C10 = cellRect(6 + 9);

// rollout geometry (shape centred at 0,0)
const ROLL = { w: 1000, h: 290, trackX: 50, trackW: 900, trackY: 220 };
const knobX = (n) => -ROLL.w / 2 + ROLL.trackX + ROLL.trackW * (n / 14);
const KNOB_Y = -ROLL.h / 2 + ROLL.trackY + 6;

// archive wall
const SLOT = { w: 320, h: 300, gx: 32, gy: 32 };
const slotC = (i) => {
  const c = i % 4, r = Math.floor(i / 4);
  const wallW = 4 * SLOT.w + 3 * SLOT.gx, wallH = 2 * SLOT.h + SLOT.gy;
  return { x: -wallW / 2 + SLOT.w / 2 + c * (SLOT.w + SLOT.gx), y: -wallH / 2 + SLOT.h / 2 + r * (SLOT.h + SLOT.gy) };
};
const NOV_SLOT = slotC(0);
const END_TILE_X = -330;

shape(T.search - 0.06, { w: 760, h: 92, r: 46, rim: 0 });
cam(T.search - 0.08, 0, 0, 1.6);
shape(T.enter - 0.05, { w: 1700, h: 96, r: 20 });
cam(T.enter - 0.08, 0, -40, 1.08);
shape(T.collapse + 0.05, { w: 132, h: 132, r: 32, rim: 1 });
cam(T.collapse + 0.02, 0, -40, 2.0);
shape(T.drop - 0.06, { w: CAL.w, h: CAL.h, r: 28, rim: 0 }, SP.morph);
cam(T.drop - 0.08, 0, 0, 1.2, SP.camFast);
shape(T.dive, { x: C10.cx, y: C10.cy, w: CAL.cellW, h: CAL.cellH, r: 12, tt: 0.7 }, SP.snap);
cam(T.dive, C10.cx, C10.cy, 3.6, SP.camFast);
shape(T.card, { x: 0, y: -150, w: 1180, h: 220, r: 16, tt: 0, bl: 1 });
cam(T.card - 0.12, 0, -40, 1.38, SP.camFast);
cam(12.3, 0, -30, 1.47, { w: 2.2, z: 1 });   // slow push while the coverage is read
shape(T.roll, { y: 0, w: ROLL.w, h: ROLL.h, r: 18, bl: 0 });
cam(T.roll, 0, 0, 1.55);
shape(T.brief, { w: 1280, h: 360, r: 18, tt: 1 });
cam(T.brief, 0, 0, 1.34);
shape(T.topics, { w: 1640, h: 110, r: 55, tt: 0 });
cam(T.topics, 0, -30, 1.1);
shape(T.archive, { x: NOV_SLOT.x, y: NOV_SLOT.y, w: SLOT.w, h: SLOT.h, r: 16 });
cam(T.archive, NOV_SLOT.x, NOV_SLOT.y, 2.5, SP.camFast);
cam(T.archive + 0.35, 0, -30, 1.22, { w: 7.5, z: 1 });
shape(T.endTile, { x: END_TILE_X, y: 0, w: 132, h: 132, r: 32, rim: 1 });
cam(T.endTile, 60, 0, 1.6);
shape(T.home, { x: 0, y: 0 });
cam(T.home, 0, 0, 2.0);

[T.collapse, T.dive, T.roll, T.brief, T.topics, T.archive, T.flyIn].forEach((t) => cue(t, 'whoosh'));
cue(T.card, 'whoosh', { up: true });
cue(T.home, 'whoosh', { soft: true });

/* ====================================================================== */
/* Content. Built after fonts load so measurements are right.            */
const L = {};          // layers
const D = {};          // dynamic bits
let READY = false;

function build() {
  /* --- logo tile --- */
  L.logo = layer(132, 132);
  L.logo.innerHTML = `<svg viewBox="0 0 512 512" width="132" height="132">${MARK()}</svg>`;
  D.today = L.logo.querySelector('.today');

  /* --- search --- */
  L.search = layer(760, 92);
  L.search.innerHTML = `
    <svg class="a" style="left:34px;top:28px" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="${MUTED}" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
    <div class="a" id="q" style="left:88px;top:22px;font-size:38px;font-weight:450;letter-spacing:-0.01em;white-space:pre"></div>
    <div class="a" id="caret" style="top:24px;width:3px;height:44px;border-radius:2px;background:${TEAL}"></div>`;
  D.q = L.search.querySelector('#q'); D.caret = L.search.querySelector('#caret');
  D.query = 'seo news today';
  for (let i = 0; i < D.query.length; i++) cue(T.typeStart + i * 0.0625, 'key', { i });
  cue(T.enter, 'enter');

  /* --- tabs --- */
  L.tabs = layer(1700, 96);
  const tabDefs = [
    ['Google Search Central', 'official'], ['Search Status Dashboard', 'official'], ['Search Engine Journal', 'press'],
    ['Bing Webmaster', 'official'],
  ];
  const dotCol = { official: TEAL, press: 'rgba(244,244,245,0.75)', vendor: MUTED };
  D.tabs = []; let x = 20;
  tabDefs.forEach(([name, cat], i) => {
    const c = mk('div', 'chip', L.tabs, `<span class="dot" style="background:${dotCol[cat]}"></span>${name}`);
    st(c, { top: '18px', left: `${x}px`, fontSize: '25px', height: '58px', gap: '12px' });
    const w = c.getBoundingClientRect().width; // world is unscaled at build
    D.tabs.push({ e: c, x, w, t: T.tabs0 + i * 0.25 });
    cue(T.tabs0 + i * 0.25, 'blip', { n: i });
    x += w + 12;
  });
  const more = mk('div', 'chip mono', L.tabs, `+<span id="moreN">0</span> more`);
  st(more, { top: '18px', left: `${x}px`, fontSize: '25px', height: '58px', color: MINT, borderColor: 'rgba(45,212,191,0.35)', background: 'rgba(45,212,191,0.10)' });
  D.more = { e: more, n: more.querySelector('#moreN'), x, w: more.getBoundingClientRect().width, t: 3.25 };
  cue(3.25, 'blip', { n: 4 });
  for (let k = 1; k <= 12; k++) cue(3.25 + k * 0.0625, 'tick', { n: k });
  { // centre the row in the bar
    const span = D.more.x + D.more.w - 20, shift = (1700 - span) / 2 - 20;
    for (const g of [...D.tabs, D.more]) { g.x += shift; g.e.style.left = `${g.x}px`; }
  }

  L.cap1 = mk('div', 'a', world, `<span style="color:${TEAL}">19 sources.</span> Every morning.`);
  st(L.cap1, { left: '-700px', width: '1400px', top: '-190px', textAlign: 'center', fontSize: '64px', fontWeight: 650, letterSpacing: '-0.03em' });
  L.cap2 = mk('div', 'a', world, `Or <span style="color:${TEAL}">one calendar.</span>`);
  st(L.cap2, { left: '-400px', width: '800px', top: '-170px', textAlign: 'center', fontSize: '40px', fontWeight: 650, letterSpacing: '-0.03em' });

  /* --- calendar --- */
  L.cal = layer(CAL.w, CAL.h);
  const head = mk('div', 'a', L.cal, 'November 2026');
  st(head, { left: '40px', top: '34px', fontSize: '46px', fontWeight: 650, letterSpacing: '-0.025em' });
  D.calHead = head;
  const pills = mk('div', 'a', L.cal);
  st(pills, { right: '40px', top: '42px', display: 'flex', gap: '12px' });
  D.calPills = [
    mk('div', 'pill teal', pills, `<span class="odo" id="odo"></span>&nbsp;stories`),
    mk('div', 'pill', pills, '19 sources'),
  ];
  // odometer: two slots sized to the final glyphs of "62"
  D.odo = []; const odo = D.calPills[0].querySelector('#odo');
  for (let p = 1; p >= 0; p--) {
    const slot = mk('span', 'slot', odo);
    slot.style.width = '0.62em';
    const strip = mk('span', 'strip', slot, Array.from({ length: 11 }, (_, i) => `<span>${i % 10}</span>`).join(''));
    D.odo.push({ p, slot, strip });
  }
  ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach((d, i) => {
    const e = mk('div', 'a mono', L.cal, d);
    st(e, { left: `${CAL.padX + i * (CAL.cellW + CAL.gap)}px`, width: `${CAL.cellW}px`, top: '112px', textAlign: 'center', fontSize: '18px', color: DIM });
  });
  D.cells = [];
  let litOrder = 0, cum = 0;
  D.odoSteps = [];
  for (let i = 0; i < 42; i++) {
    const day = i - 6 + 1;
    if (day < 1 || day > 30) continue;
    const r = cellRect(i), c = NOV[day] ?? 0;
    const e = mk('div', 'cell', L.cal, `<span class="n">${day}</span>${c ? `<span class="c">${c}</span>` : ''}`);
    st(e, { left: `${r.x + CAL.w / 2}px`, top: `${r.y + CAL.h / 2}px`, width: `${CAL.cellW}px`, height: `${CAL.cellH}px` });
    const cell = { e, i, day, c, lv: level(c), tin: T.drop + 0.04 + i * 0.006, tLit: null, n: e.querySelector('.n'), cnt: e.querySelector('.c') };
    if (c) {
      cell.tLit = T.lights0 + litOrder * 0.25;
      cum += c;
      D.odoSteps.push([cell.tLit, cum]);
      cue(cell.tLit, 'note', { n: litOrder, lv: cell.lv });
      litOrder++;
    }
    D.cells.push(cell);
  }
  D.cell10 = D.cells.find((c) => c.day === 10);
  cue(T.click, 'click');

  /* --- story card --- */
  L.card = layer(1180, 220);
  L.card.innerHTML = `
    <div class="a" style="left:44px;top:38px;display:flex;align-items:center;gap:16px;font-size:26px;font-weight:500">
      <span class="pill teal" style="height:38px;font-size:20px">★&nbsp;Official</span>
      <span>Google Search Status Dashboard</span><span class="mono" style="color:${MUTED};font-size:22px">· 18:06</span>
    </div>
    <div class="a" style="left:44px;top:100px;font-size:56px;font-weight:650;letter-spacing:-0.03em;color:#fff">Google: November 2026 core update</div>`;
  cue(T.card + 0.25, 'chime');

  const rowsX = -590 + 30;
  D.conn = mk('div', 'a', world); st(D.conn, { left: `${rowsX}px`, top: '-40px', width: '3px', background: 'rgba(45,212,191,0.55)', borderRadius: '2px' });
  D.rowLabel = mk('div', 'a label', world, 'Also covered by 2 outlets');
  st(D.rowLabel, { left: `${rowsX + 28}px`, top: '-12px' });
  const rows = [
    ['Search Engine Roundtable', 'Google November 2026 Core Update Is Rolling Out', T.rows + 0.25],
    ['Search Engine Journal', 'Google’s November 2026 Core Update Starts Rolling Out', T.rows + 0.75],
  ];
  D.rows = rows.map(([src, title, t], k) => {
    const e = mk('div', 'a', world, `<b style="font-weight:600;color:${INK}">${src}:</b> <span style="color:${MUTED}">${title}</span>`);
    st(e, { left: `${rowsX + 28}px`, top: `${30 + k * 50}px`, fontSize: '30px', whiteSpace: 'nowrap' });
    cue(t, 'slam', { n: k });
    return { e, t };
  });
  D.tags = ['Google', 'Core update'].map((name, k) => {
    const e = mk('div', 'chip mono', world, name);
    st(e, { position: 'absolute', top: '146px', fontSize: '22px', height: '44px' });
    return { e, t: 12.0 + k * 0.25 };
  });
  { let tx = rowsX + 28; D.tags.forEach((g) => { g.e.style.left = `${tx}px`; tx += g.e.getBoundingClientRect().width + 12; cue(g.t, 'blip', { n: 3 + D.tags.indexOf(g) }); }); }

  /* --- rollout --- */
  L.roll = layer(ROLL.w, ROLL.h);
  L.roll.innerHTML = `
    <div class="a mono" style="left:50px;top:40px;display:flex;align-items:center;gap:12px;font-size:22px;font-weight:500;letter-spacing:0.08em;color:${MINT}">
      <span id="rdot" style="width:12px;height:12px;border-radius:50%;background:${TEAL}"></span>ROLLING OUT</div>
    <div class="a" style="left:50px;top:84px;font-size:52px;font-weight:650;letter-spacing:-0.03em;color:#fff">November 2026 core update</div>
    <div class="a mono" style="left:50px;top:156px;font-size:26px;color:${MUTED}">Started 10 Nov · day <span id="rn" style="color:${INK}">3</span> of up to 14</div>
    <div class="a" style="left:${ROLL.trackX}px;top:${ROLL.trackY}px;width:${ROLL.trackW}px;height:12px;border-radius:6px;background:rgba(255,255,255,0.10)"></div>
    <div class="a" id="rfill" style="left:${ROLL.trackX}px;top:${ROLL.trackY}px;height:12px;border-radius:6px;background:${TEAL}"></div>
    <div class="a" id="rknob" style="top:${ROLL.trackY - 11}px;width:34px;height:34px;border-radius:50%;background:${INK};box-shadow:0 0 0 6px rgba(45,212,191,0.35)"></div>`;
  D.rn = L.roll.querySelector('#rn'); D.rfill = L.roll.querySelector('#rfill'); D.rknob = L.roll.querySelector('#rknob'); D.rdot = L.roll.querySelector('#rdot');
  cue(T.press, 'press'); cue(T.release, 'release');

  /* --- brief --- */
  L.brief = layer(1280, 360);
  L.brief.innerHTML = `
    <div class="a mono" style="left:52px;top:44px;display:flex;align-items:center;gap:14px;font-size:22px;font-weight:500;letter-spacing:0.08em;color:${MINT}">
      THE DAY IN BRIEF <span style="font-size:16px;letter-spacing:0.05em;color:${MUTED};border:1px solid rgba(255,255,255,0.2);border-radius:5px;padding:0 7px">AI</span></div>
    <div class="a" id="btext" style="left:52px;top:96px;width:1176px;font-size:40px;line-height:1.42;color:#e4e4e7;letter-spacing:-0.01em"></div>`;
  const briefText = 'Google released the November 2026 core update, which applies globally and to all languages, with the rollout expected to take up to two weeks.';
  D.words = briefText.split(' ').map((w, i, a) => {
    const e = mk('span', 'word', L.brief.querySelector('#btext'), w + (i < a.length - 1 ? ' ' : ''));
    const t = T.brief + 0.3 + i * 0.03125;
    if (i % 2 === 0) cue(t, 'key', { soft: true, i });
    return { e, t };
  });

  /* --- topics --- */
  L.topics = layer(1640, 110);
  const topicNames = ['Core update', 'AI Overviews & AI Mode', 'OpenAI & ChatGPT', 'Bing', 'Search Console', 'Crawling & indexing'];
  D.topics = topicNames.map((name, k) => {
    const e = mk('div', 'chip mono', L.topics, name);
    st(e, { top: '30px', fontSize: '24px', height: '50px' });
    return { e, w: e.getBoundingClientRect().width, t: T.topics + 0.3 + k * 0.25 };
  });
  { const total = D.topics.reduce((s, g) => s + g.w, 0) + 12 * (D.topics.length - 1); let tx = (1640 - total) / 2;
    D.topics.forEach((g, k) => { g.e.style.left = `${tx}px`; tx += g.w + 12; cue(g.t, 'blip', { n: k }); }); }
  L.topicsCap = mk('div', 'a label', world, 'Every story, tagged by topic');
  st(L.topicsCap, { left: '-400px', width: '800px', textAlign: 'center', top: '-112px', fontSize: '22px', color: MINT });

  /* --- archive --- */
  const miniHTML = (m) => {
    let h = `<div class="a mono" style="left:22px;top:20px;font-size:19px;color:${INK}">${m.key}</div>`;
    for (let d = 1; d <= m.days; d++) {
      const i = m.first + d - 1, c = m.counts[d] ?? 0, lv = level(c);
      const x = 26 + (i % 7) * 39, y = 66 + Math.floor(i / 7) * 36;
      h += `<div class="a" style="left:${x}px;top:${y}px;width:33px;height:30px;border-radius:6px;background:${LV_BG[lv]};border:1px solid ${LV_BORDER[lv]}"></div>`;
    }
    return h;
  };
  L.mini = layer(SLOT.w, SLOT.h);
  L.mini.innerHTML = miniHTML(MONTHS[0]);
  D.months = MONTHS.slice(1).map((m, k) => {
    const c = slotC(k + 1);
    const e = mk('div', 'a', world, miniHTML(m));
    st(e, { left: `${c.x - SLOT.w / 2}px`, top: `${c.y - SLOT.h / 2}px`, width: `${SLOT.w}px`, height: `${SLOT.h}px`, borderRadius: '16px',
      background: '#121215', border: '1px solid rgba(255,255,255,0.08)', boxSizing: 'border-box' });
    const t = T.archive + 0.32 + k * 0.0625;
    if (k % 2 === 0) cue(t, 'tick', { n: k });
    return { e, c, t };
  });
  L.wallCap = mk('div', 'a mono', world, `<span style="color:${TEAL}">93</span> stories · <span style="color:${TEAL}">32</span> days · <span style="color:${TEAL}">19</span> sources`);
  st(L.wallCap, { left: '-600px', width: '1200px', textAlign: 'center', top: '-400px', fontSize: '30px', color: MUTED });
  cue(T.archive + 0.6, 'shimmer');

  /* --- wordmark --- */
  L.word = mk('div', 'a', world);
  st(L.word, { left: `${END_TILE_X + 66 + 44}px`, top: '-86px', width: '900px' });
  L.word.innerHTML = `
    <div id="w1" style="font-size:104px;font-weight:700;letter-spacing:-0.04em;line-height:1">SEO News</div>
    <div id="w2" style="margin-top:14px;font-size:34px;color:${MUTED};letter-spacing:-0.01em">Every day in SEO, on one calendar.</div>
    <div id="w3" class="mono" style="margin-top:12px;font-size:26px;color:${MINT}">seo-news.mikehiggins.me.uk</div>`;
  D.w = ['#w1', '#w2', '#w3'].map((s) => L.word.querySelector(s));
  cue(T.word, 'impact'); cue(T.word + 0.25, 'blip', { n: 7 }); cue(T.word + 0.5, 'blip', { n: 9 });

  /* --- cursor (screen space) --- */
  D.cur = mk('div', 'a', hud);
  D.cur.innerHTML = `
    <svg width="40" height="40" viewBox="0 0 24 24" style="position:absolute;left:0;top:0;overflow:visible">
      <path d="M3 2.5 L19.5 11 L12 13 L8.6 20.5 Z" fill="${INK}" stroke="#09090b" stroke-width="1.4" stroke-linejoin="round"/></svg>
    <div id="cpill" class="mono" style="position:absolute;left:30px;top:34px;padding:4px 12px;border-radius:999px;background:${TEAL};color:#042f2e;font-size:18px;font-weight:500;white-space:nowrap">You</div>`;
  D.cpill = D.cur.querySelector('#cpill');
  D.ripple = mk('div', 'a', hud);
  st(D.ripple, { width: '0px', height: '0px', borderRadius: '50%', border: `2px solid ${TEAL}` });
  D.trailOn = true;

  buildDragCues();
  READY = true;
  window.READY = true;
}

/* ---------- cursor path (world coordinates) ---------- */
const PX = new Track(560), PY = new Track(260), PV = new Track(0);
const ARR = { w: 9, z: 1 };
function go(t, x, y, sp = ARR) { PX.to(t, x, sp); PY.to(t, y, sp); }
PV.to(0.6, 1, SP.pop);
go(0.6, 300, 70);
go(T.enter + 0.05, 640, 110);
go(T.collapse + 0.1, 130, 100);
go(T.drop, 400, 320);
go(8.3, C10.cx + 12, C10.cy + 10, { w: 11, z: 1 });
go(T.card + 0.1, 600, 210);
go(T.roll + 0.1, knobX(3), KNOB_Y, { w: 8, z: 1 });
const DRAG = { from: knobX(3), to: knobX(14) };
const dragDX = (t) => (DRAG.to - DRAG.from) * outQ((t - (T.press + 0.05)) / 0.45);
// after release the cursor drifts on from where the drag left it (continuous: track + drag offset)
go(T.release + 0.05, 380 - (DRAG.to - DRAG.from), 190);
go(T.brief + 0.2, 520 - (DRAG.to - DRAG.from), 240);
go(T.topics + 0.1, 560 - (DRAG.to - DRAG.from), 130);
go(T.archive + 0.05, NOV_SLOT.x + 90 - (DRAG.to - DRAG.from), NOV_SLOT.y + 80);
PV.to(21.15, 0, SP.soft);
function cursorWorld(t) {
  return { x: PX.at(t) + (t >= T.press ? dragDX(t) : 0), y: PY.at(t) };
}
const held = (t) => clamp((t - T.press) / 0.05) * (1 - clamp((t - T.release) / 0.05));

/* rollout value: rises to 3, follows the cursor while held, springs back on release */
function rollN(t) {
  const base = 3 * stepR(t - (T.roll + 0.35), SP.soft);
  if (t < T.press) return base;
  const fromCursor = 3 + 11 * clamp(dragDX(t) / (DRAG.to - DRAG.from));
  if (t < T.release) return fromCursor;
  const rel = 3 + 11 * clamp(dragDX(T.release) / (DRAG.to - DRAG.from));
  return 3 + (rel - 3) * (1 - stepR(t - T.release, SP.back));
}
function buildDragCues() {
  let prev = Math.round(rollN(T.press));
  for (let t = T.press; t < T.release + 1.2; t += 0.002) {
    const n = Math.round(rollN(t));
    if (n !== prev) { cue(t, 'tick', { n, drag: true }); prev = n; }
  }
}

/* ====================================================================== */
function seek(t) {
  if (!READY) return;
  t = clamp(t, 0, DUR);

  /* background bloom, nudged by the kick after the drop */
  let kick = 0;
  for (let b = T.drop; b < T.word + 0.01; b += BEAT) kick += Math.exp(-Math.max(0, t - b) / 0.14) * (t >= b ? 1 : 0);
  const glow = 0.10 + 0.035 * Math.min(1, kick);
  bg.style.background = `radial-gradient(1100px 620px at 50% -8%, rgba(45,212,191,${glow.toFixed(3)}), transparent 70%),
    radial-gradient(900px 600px at 100% 105%, rgba(99,102,241,0.07), transparent 70%), #09090b`;

  /* camera */
  const c = camAt(t);
  world.style.transform = `translate(${W / 2}px, ${H / 2}px) scale(${c.z.toFixed(5)}) translate(${(-c.x).toFixed(3)}px, ${(-c.y).toFixed(3)}px)`;

  /* shape */
  const sx = SX.at(t), sy = SY.at(t), sw = Math.max(8, SW.at(t)), sh = Math.max(8, SH.at(t)), sr = Math.max(0, SR.at(t));
  const tt = clamp(TT.at(t)), rim = clamp(RIM.at(t)), bl = clamp(BL.at(t));
  const m = Math.max(tt, rim);
  const base = [lerp(18, 9, rim), lerp(18, 9, rim), lerp(21, 11, rim)];
  const bgc = [lerp(base[0], 16, tt), lerp(base[1], 44, tt), lerp(base[2], 42, tt)];
  st(S, {
    left: `${(sx - sw / 2).toFixed(2)}px`, top: `${(sy - sh / 2).toFixed(2)}px`, width: `${sw.toFixed(2)}px`, height: `${sh.toFixed(2)}px`,
    borderRadius: `${sr.toFixed(2)}px`,
    background: `rgb(${bgc.map((v) => v.toFixed(1)).join(',')})`,
    border: `${lerp(1, 3, rim).toFixed(2)}px solid rgba(${lerp(255, 45, m).toFixed(0)},${lerp(255, 212, m).toFixed(0)},${lerp(255, 191, m).toFixed(0)},${lerp(0.09, 0.42, m).toFixed(3)})`,
    boxShadow: bl > 0.01 ? `inset ${(6 * bl).toFixed(2)}px 0 0 ${TEAL}` : 'none',
  });

  /* logo tile */
  applyVis(L.logo, visW(t, [[-1, T.search - 0.1], [T.collapse + 0.15, T.drop - 0.12], [T.endTile + 0.05, null]]));
  const tp = pulse(t, 0.5, 0.09) + pulse(t, T.cap2 + 0.5, 0.09) + pulse(t, 25.5, 0.09);
  D.today.setAttribute('transform', `translate(256 340) scale(${(1 + 0.22 * tp).toFixed(4)}) translate(-256 -340)`);

  /* search */
  applyVis(L.search, vis(t, T.search + 0.02, T.enter - 0.02));
  const typed = clamp(Math.floor((t - T.typeStart) / 0.0625) + 1, 0, D.query.length);
  D.q.textContent = D.query.slice(0, t < T.typeStart ? 0 : typed);
  D.caret.style.left = `${88 + D.q.getBoundingClientRect().width / c.z + 4}px`;
  D.caret.style.opacity = (t < T.typeStart + 0.9 || Math.floor(t / 0.25) % 2 === 0) ? '1' : '0';

  /* tabs */
  applyVis(L.tabs, vis(t, T.enter + 0.02, null));
  const conv = clamp((t - T.collapse) / 0.32);
  const convE = conv * conv;
  for (const g of [...D.tabs, D.more]) {
    const v = vis(t, g.t, T.collapse + 0.18, 0.14);
    const s = stepR(t - g.t, SP.pop);
    const dx = (1 - stepR(t - g.t, SP.snap)) * 60 + (850 - (g.x + g.w / 2)) * convE;
    g.e.style.opacity = v.o.toFixed(3);
    g.e.style.filter = v.b > 0.05 ? `blur(${v.b.toFixed(2)}px)` : 'none';
    g.e.style.transform = `translateX(${dx.toFixed(2)}px) scale(${(lerp(0.82, 1, s) * (1 - 0.7 * convE)).toFixed(4)})`;
    g.e.style.visibility = v.o < 0.002 ? 'hidden' : 'visible';
  }
  D.more.n.textContent = String(Math.round(15 * outQ((t - 3.25) / 0.75)));
  applyVis(L.cap1, vis(t, T.cap1, T.collapse - 0.1));
  applyVis(L.cap2, vis(t, T.cap2, T.drop - 0.15));

  /* calendar */
  applyVis(L.cal, vis(t, T.drop + 0.04, null));
  const calOut = vis(t, -1, T.dive - 0.05, 0.14);
  applyVis(D.calHead, { ...vis(t, T.drop + 0.1, T.dive - 0.05, 0.14) });
  D.calPills.forEach((p, k) => applyVis(p, vis(t, T.drop + 0.2 + k * 0.125, T.dive - 0.05, 0.14)));
  let odoV = 0;
  for (const [ts, v] of D.odoSteps) if (t >= ts) odoV = v;
  // ease between steps so the strip rolls
  let prevV = 0, curStep = null;
  for (const s of D.odoSteps) { if (t >= s[0]) { curStep = s; } else break; }
  if (curStep) {
    const idx = D.odoSteps.indexOf(curStep);
    prevV = idx > 0 ? D.odoSteps[idx - 1][1] : 0;
    odoV = lerp(prevV, curStep[1], outQ((t - curStep[0]) / 0.22));
  }
  for (const d of D.odo) {
    const P = Math.pow(10, d.p);
    const digit = Math.floor(odoV / P) % 10 + Math.max(0, (odoV % P) - (P - 1));
    d.strip.style.transform = `translateY(${(-digit * 1.15).toFixed(4)}em)`;
    d.slot.style.opacity = d.p === 1 ? clamp((odoV - 9) / 1) : 1;
    d.slot.style.width = d.p === 1 ? `${(0.62 * clamp((odoV - 9) / 1)).toFixed(3)}em` : '0.62em';
  }
  for (const cell of D.cells) {
    const keep = cell === D.cell10;
    const v = vis(t, cell.tin, keep ? T.dive + 0.22 : T.dive - 0.04, keep ? 0.16 : 0.12);
    const lit = cell.tLit != null ? stepR(t - cell.tLit, SP.soft) : 0;
    const lv = cell.lv;
    const popS = cell.tLit != null ? 0.08 * pulse(t, cell.tLit + 0.06, 0.07) : 0;
    const hov = keep ? clamp((t - T.hover) / 0.12) * (1 - clamp((t - T.dive) / 0.1)) : 0;
    const press = keep ? 0.06 * pulse(t, T.click, 0.05) : 0;
    const bgA = [0.025, 0.14, 0.38][Math.min(lv, 2)];
    const bgCol = lv === 3 ? `rgba(45,212,191,${lerp(0.025, 1, lit).toFixed(3)})` : lv ? `rgba(45,212,191,${lerp(0.0, bgA, lit).toFixed(3)})` : LV_BG[0];
    const bdA = lv ? lerp(0.06, 0.45, lit) : 0.06;
    st(cell.e, {
      background: lit > 0 || lv === 0 ? bgCol : LV_BG[0],
      borderColor: lv ? `rgba(45,212,191,${bdA.toFixed(3)})` : LV_BORDER[0],
      outline: hov > 0 ? `${(2 * hov).toFixed(2)}px solid rgba(255,255,255,${(0.9 * hov).toFixed(3)})` : (cell.day === 12 ? '1px solid rgba(255,255,255,0.35)' : 'none'),
      outlineOffset: '2px',
    });
    cell.n.style.color = lv === 3 && lit > 0.5 ? '#042f2e' : lv ? INK : DIM;
    if (cell.cnt) {
      cell.cnt.style.opacity = lit.toFixed(3);
      cell.cnt.style.color = lv === 3 ? '#042f2e' : MINT;
    }
    applyVis(cell.e, v, `scale(${(1 + popS - press).toFixed(4)})`);
  }
  void calOut;

  /* story card + coverage */
  applyVis(L.card, vis(t, T.card + 0.22, T.roll - 0.08));
  const connH = 126 * stepR(t - (T.rows - 0.05), SP.soft) * (1 - clamp((t - (T.roll - 0.08)) / 0.12));
  D.conn.style.height = `${Math.max(0, connH).toFixed(2)}px`;
  D.conn.style.opacity = connH > 0.5 ? '1' : '0';
  applyVis(D.rowLabel, vis(t, T.rows, T.roll - 0.08));
  for (const r of D.rows) {
    const v = vis(t, r.t, T.roll - 0.08);
    applyVis(r.e, v, `translateX(${((1 - stepR(t - r.t, SP.snap)) * 80).toFixed(2)}px)`);
  }
  for (const g of D.tags) applyVis(g.e, vis(t, g.t, T.roll - 0.08), `scale(${lerp(0.8, 1, stepR(t - g.t, SP.pop)).toFixed(4)})`);

  /* rollout */
  applyVis(L.roll, vis(t, T.roll + 0.15, T.brief - 0.06));
  const n = rollN(t);
  D.rn.textContent = String(Math.max(1, Math.round(n)));
  const fw = ROLL.trackW * n / 14;
  D.rfill.style.width = `${Math.max(0, fw).toFixed(2)}px`;
  D.rknob.style.left = `${(ROLL.trackX + fw - 17).toFixed(2)}px`;
  D.rknob.style.transform = `scale(${(1 + 0.18 * held(t)).toFixed(4)})`;
  D.rdot.style.opacity = (0.55 + 0.45 * Math.cos((t - T.roll) * Math.PI * 2)).toFixed(3);

  /* brief */
  applyVis(L.brief, vis(t, T.brief + 0.1, T.topics - 0.06));
  for (const w of D.words) {
    const v = vis(t, w.t, null);
    w.e.style.opacity = v.o.toFixed(3);
    w.e.style.filter = v.b > 0.05 ? `blur(${(v.b * 0.6).toFixed(2)}px)` : 'none';
  }

  /* topics */
  applyVis(L.topics, vis(t, T.topics + 0.08, T.archive - 0.06));
  applyVis(L.topicsCap, vis(t, T.topics + 0.12, T.archive - 0.06));
  for (const g of D.topics) {
    const v = vis(t, g.t, null);
    g.e.style.opacity = v.o.toFixed(3);
    g.e.style.filter = v.b > 0.05 ? `blur(${v.b.toFixed(2)}px)` : 'none';
    g.e.style.transform = `translateY(${(v.dy * 1.4).toFixed(2)}px) scale(${lerp(0.78, 1, stepR(t - g.t, SP.pop)).toFixed(4)})`;
  }

  /* archive */
  applyVis(L.mini, vis(t, T.archive + 0.12, T.flyIn + 0.1, 0.18));
  const fly = clamp((t - T.flyIn) / 0.3); const flyE = fly * fly;
  for (const mo of D.months) {
    const v = vis(t, mo.t, T.flyIn + 0.12, 0.18);
    const dx = (NOV_SLOT.x - mo.c.x) * flyE, dy = (NOV_SLOT.y - mo.c.y) * flyE;
    const s = lerp(0.86, 1, stepR(t - mo.t, SP.pop)) * (1 - 0.6 * flyE);
    mo.e.style.opacity = v.o.toFixed(3);
    mo.e.style.filter = v.b > 0.05 ? `blur(${v.b.toFixed(2)}px)` : 'none';
    mo.e.style.transform = `translate(${dx.toFixed(2)}px, ${(dy + v.dy).toFixed(2)}px) scale(${s.toFixed(4)})`;
    mo.e.style.visibility = v.o < 0.002 ? 'hidden' : 'visible';
  }
  applyVis(L.wallCap, vis(t, T.archive + 0.6, T.flyIn, 0.14));

  /* wordmark */
  D.w.forEach((e, k) => {
    const t0 = T.word + k * 0.25;
    const v = vis(t, t0, T.wordOut, 0.14);
    applyVis(e, v, k === 0 ? `scale(${lerp(0.9, 1, stepR(t - t0, SP.pop)).toFixed(4)})` : '');
    e.style.transformOrigin = 'left center';
  });
  L.word.style.visibility = t > T.word - 0.05 && t < T.wordOut + 0.2 ? 'visible' : 'hidden';

  /* cursor */
  drawCursor(t);
}

function cursorScreen(t) { const p = cursorWorld(t); return toScreen(t, p.x, p.y); }
function drawCursor(t) {
  const v = clamp(PV.at(t), 0, 1.2);
  const p = cursorScreen(t);
  const q = cursorScreen(t - 1 / 120);
  const vx = (p.x - q.x) * 120;
  const lean = clamp(-vx * 0.0045, -14, 14);
  let press = 1 - 0.16 * pulse(t, T.click, 0.045) - 0.12 * held(t);
  const s = Math.max(0, v) * press;
  st(D.cur, {
    left: `${p.x.toFixed(2)}px`, top: `${p.y.toFixed(2)}px`, opacity: clamp(v).toFixed(3),
    transform: `rotate(${lean.toFixed(2)}deg) scale(${s.toFixed(4)})`, transformOrigin: '3px 3px',
    visibility: v < 0.01 ? 'hidden' : 'visible',
  });
  const lag = clamp(-vx * 0.012, -18, 18);
  D.cpill.style.transform = `translateX(${lag.toFixed(2)}px)`;

  // click ripple
  const rp = clamp((t - T.click) / 0.4);
  if (t >= T.click && rp < 1) {
    const r = 6 + 34 * outQ(rp);
    st(D.ripple, { left: `${(p.x - r).toFixed(2)}px`, top: `${(p.y - r).toFixed(2)}px`, width: `${2 * r}px`, height: `${2 * r}px`, opacity: (1 - rp).toFixed(3), visibility: 'visible' });
  } else D.ripple.style.visibility = 'hidden';

  // motion trail: sample the past path (pure, because position is a function of t)
  trail.clearRect(0, 0, W, H);
  if (v < 0.05) return;
  const cNow = camAt(t);
  const viaNow = (tt) => { const w = cursorWorld(tt); return { x: (w.x - cNow.x) * cNow.z + W / 2, y: (w.y - cNow.y) * cNow.z + H / 2 }; };
  let prev = viaNow(t);
  for (let k = 1; k <= 14; k++) {
    const a = viaNow(t - k * 0.009);
    const sp = Math.hypot(prev.x - a.x, prev.y - a.y) / 0.009;
    const alpha = clamp((sp - 500) / 2500) * (1 - k / 15) * 0.32 * clamp(v);
    if (alpha > 0.005 && Math.hypot(prev.x - a.x, prev.y - a.y) < 60) {
      trail.strokeStyle = `rgba(94,234,212,${alpha.toFixed(3)})`;
      trail.lineWidth = 5 * (1 - k / 15) + 0.5;
      trail.lineCap = 'round';
      trail.beginPath(); trail.moveTo(prev.x + 3, prev.y + 3); trail.lineTo(a.x + 3, a.y + 3); trail.stroke();
    }
    prev = a;
  }
}

window.seek = seek;
window.DUR = DUR;
window.CUES = CUES;
document.fonts.ready.then(() => { build(); CUES.sort((a, b) => a.t - b.t); seek(0); });
