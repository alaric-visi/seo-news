/* Original score + synthesised UI sounds for the SEO News launch film.
   D minor, 120 BPM, 13 bars (26 s). The beat grid is exact by construction, so every
   cue lands on the film's own timing (cues.json, exported from film.js).
   Output: score.wav, sfx.wav, mix.wav (48 kHz, 16-bit stereo). */
import { readFileSync, writeFileSync } from 'node:fs';

const SR = 48000;
const { dur: DUR, cues } = JSON.parse(readFileSync('cues.json', 'utf8'));
const N = Math.round(DUR * SR);
const BEAT = 0.5, BAR = 2;

/* ---------- utilities ---------- */
const buf = () => [new Float32Array(N), new Float32Array(N)];
let seed = 7;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
function add(dst, src, t0, gain = 1, pan = 0) {
  const s0 = Math.round(t0 * SR), gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4);
  for (let i = 0; i < src.length; i++) {
    const j = s0 + i;
    if (j < 0) continue;
    if (j >= N) break;
    dst[0][j] += src[i] * gl * Math.SQRT2;
    dst[1][j] += src[i] * gr * Math.SQRT2;
  }
}
function biquad(x, type, f, q = 0.707) {   // RBJ cookbook; f may be a function of sample index
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const fc = typeof f === 'function' ? f(i) : f;
    const w0 = 2 * Math.PI * Math.min(fc, SR * 0.45) / SR, a = Math.sin(w0) / (2 * q), c = Math.cos(w0);
    let b0, b1, b2;
    if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; }
    else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; }
    else { b0 = a; b1 = 0; b2 = -a; } // band-pass
    const a0 = 1 + a, a1 = -2 * c, a2 = 1 - a;
    const v = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}
const env = (len, a, d, curve = 1) => (i) => { const t = i / SR; return t < a ? t / a : Math.pow(Math.max(0, 1 - (t - a) / d), curve); };
function tone(len, f, { type = 'sine', e = env(len, 0.002, len, 2), detune = 0, voices = 1, phase = 0 } = {}) {
  const n = Math.round(len * SR), out = new Float32Array(n);
  for (let v = 0; v < voices; v++) {
    const fv = typeof f === 'function' ? f : () => f;
    const det = voices > 1 ? (v / (voices - 1) - 0.5) * 2 * detune : 0;
    let ph = (phase + v * 0.37) % 1;
    for (let i = 0; i < n; i++) {
      ph += fv(i / SR) * Math.pow(2, det / 1200) / SR; ph -= Math.floor(ph);
      let s;
      if (type === 'sine') s = Math.sin(2 * Math.PI * ph);
      else if (type === 'saw') s = 2 * ph - 1;
      else if (type === 'tri') s = 4 * Math.abs(ph - 0.5) - 1;
      else s = ph < 0.5 ? 1 : -1;
      out[i] += s * e(i) / voices;
    }
  }
  return out;
}
function noise(len, e) { const n = Math.round(len * SR), o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = rnd() * e(i); return o; }
function mixInto(a, b, g = 1) { for (let i = 0; i < Math.min(a.length, b.length); i++) a[i] += b[i] * g; return a; }

/* ---------- reverb (Schroeder) on a send ---------- */
function reverb(bus, size = 1, wet = 0.3) {
  const combs = [1557, 1617, 1491, 1422].map((d) => Math.round(d * size));
  const aps = [225, 556];
  const out = buf();
  for (let ch = 0; ch < 2; ch++) {
    const x = bus[ch], y = out[ch];
    for (const [k, d0] of combs.entries()) {
      const d = d0 + ch * 23 + k, b = new Float32Array(d); let idx = 0, lp = 0;
      for (let i = 0; i < N; i++) { const o = b[idx]; lp = o * 0.7 + lp * 0.3; b[idx] = x[i] + lp * 0.84; y[i] += o * 0.25; idx = (idx + 1) % d; }
    }
    for (const d of aps) {
      const b = new Float32Array(d); let idx = 0;
      for (let i = 0; i < N; i++) { const o = b[idx]; const v = y[i] + o * 0.5; b[idx] = v; y[i] = o - v * 0.5; idx = (idx + 1) % d; }
    }
    for (let i = 0; i < N; i++) y[i] *= wet;
  }
  return out;
}

/* ====================================================================== */
/* SCORE                                                                   */
const music = buf(), send = buf();
const DROP = 6.0, END_GROOVE = 22.0;
// i–VI–III–VII in D minor: Dm, Bb, F, C (one chord per bar)
const CHORDS = [[50, 53, 57], [46, 50, 53], [53, 57, 60], [48, 52, 55]];
const ROOTS = [38, 34, 41, 36];
const chordAt = (bar) => bar % 4;
const PENTA = [62, 65, 67, 69, 72, 74, 77, 79, 81, 84];

// kick envelope for sidechain ducking
const duck = new Float32Array(N).fill(1);
function kick(t, g = 1) {
  const k = tone(0.45, (x) => 48 + 110 * Math.exp(-x * 28), { e: env(0, 0.001, 0.42, 3) });
  mixInto(k, noise(0.012, env(0, 0.0005, 0.011, 2)), 0.25);
  add(music, k, t, 0.95 * g);
  const s0 = Math.round(t * SR);
  for (let i = 0; i < 0.3 * SR && s0 + i < N; i++) duck[s0 + i] = Math.min(duck[s0 + i], 0.35 + 0.65 * Math.min(1, i / (0.22 * SR)));
}
function clap(t, g = 1) {
  const n = noise(0.25, (i) => { const x = i / SR; return (x < 0.03 ? (Math.floor(x / 0.01) % 2 ? 0.6 : 1) : 1) * Math.exp(-x * 18); });
  const c = biquad(n, 'bp', 1400, 0.9);
  add(music, c, t, 0.55 * g); add(send, c, t, 0.3 * g);
}
function snare(t, g = 1) {
  const n = biquad(noise(0.18, (i) => Math.exp(-i / SR * 26)), 'bp', 2200, 0.7);
  mixInto(n, tone(0.12, 190, { e: env(0, 0.001, 0.11, 2) }), 0.5);
  add(music, n, t, 0.38 * g, 0.05); add(send, n, t, 0.15 * g);
}
function hat(t, g = 1, open = false) {
  const h = biquad(noise(open ? 0.2 : 0.05, (i) => Math.exp(-i / SR * (open ? 16 : 70))), 'hp', 8000);
  add(music, h, t, 0.22 * g, open ? 0.25 : -0.2);
}
function pad(t, len, notes, g, lpf) {
  for (const m of notes) {
    const s = tone(len, hz(m), { type: 'saw', voices: 3, detune: 14, e: (i) => { const x = i / SR; return Math.min(1, x / 0.35) * Math.min(1, (len - x) / 0.5); } });
    const f = biquad(s, 'lp', lpf, 0.6);
    add(music, f, t, g / notes.length, -0.3); add(music, f, t + 0.012, g / notes.length, 0.3);
    add(send, f, t, g * 0.5 / notes.length);
  }
}
function pluck(t, m, g = 1, pan = 0) {
  const p = tone(0.32, hz(m), { type: 'saw', e: env(0, 0.002, 0.3, 3) });
  const f = biquad(p, 'lp', (i) => 600 + 3200 * Math.exp(-i / SR * 14), 0.9);
  add(music, f, t, 0.22 * g, pan); add(send, f, t, 0.12 * g);
}
function bass(t, m, len, g = 1) {
  const b = tone(len, hz(m), { type: 'saw', e: env(0, 0.004, len, 1.5) });
  mixInto(b, tone(len, hz(m), { type: 'sine', e: env(0, 0.004, len, 1.5) }), 0.8);
  add(music, biquad(b, 'lp', 420, 1.1), t, 0.42 * g);
}
function stab(t, notes, g = 1) {
  for (const m of notes) {
    const s = tone(0.28, hz(m + 12), { type: 'saw', voices: 4, detune: 18, e: env(0, 0.003, 0.26, 2) });
    const f = biquad(s, 'lp', (i) => 900 + 4200 * Math.exp(-i / SR * 10), 0.8);
    add(music, f, t, 0.16 * g, -0.25); add(music, f, t + 0.009, 0.16 * g, 0.25); add(send, f, t, 0.12 * g);
  }
}

// Bars 1-2: filtered intro
pad(0, 4.1, CHORDS[0], 0.32, 900);
for (let k = 0; k < 16; k++) pluck(k * 0.25, [62, 65, 69, 72][k % 4] + (k >= 8 ? 2 : 0) * 0, 0.6 + 0.02 * k, k % 2 ? 0.3 : -0.3);
for (let k = 0; k < 16; k++) if (k >= 4) hat(2 + k * 0.125 - 2, k % 2 ? 0.5 : 0.8);
kick(0, 0.55); kick(2, 0.6);
// Bar 3: build (2.0–6.0 is two bars: 2–4 tabs, 4–6 snare build)
pad(2, 4.0, CHORDS[1], 0.3, 1200);
for (let k = 0; k < 8; k++) { pluck(2 + k * 0.25, [58, 62, 65, 70][k % 4], 0.7, k % 2 ? 0.3 : -0.3); }
for (let b = 0; b < 4; b++) kick(2 + b * 0.5, 0.75);
for (let k = 0; k < 16; k++) hat(2 + k * 0.125, k % 2 ? 0.5 : 0.9);
// snare build 4.0–5.75: 8ths, 16ths, 32nds
{
  let t = 4.0;
  while (t < 5.75 - 1e-6) {
    const step = t < 4.75 ? 0.25 : t < 5.25 ? 0.125 : 0.0625;
    snare(t, 0.35 + 0.65 * ((t - 4) / 1.75));
    t += step;
  }
  // riser: noise sweeping up, cut at 5.875 for the gap
  const rl = 1.875, r = noise(rl, (i) => Math.pow(i / (rl * SR), 2));
  add(music, biquad(r, 'bp', (i) => 400 + 7000 * Math.pow(i / (rl * SR), 2), 1.2), 4.0, 0.5);
  pad(4, 1.875, CHORDS[2], 0.3, 1800);
  for (let k = 0; k < 4; k++) kick(4 + k * 0.5, 0.8);
}
// Bars 4-11: the drop and groove (6.0–22.0)
for (let bar = 3; bar < 11; bar++) {
  const t0 = bar * BAR, ch = chordAt(bar - 3);
  const lift = bar >= 9; // 18 s onwards
  pad(t0, BAR + 0.1, CHORDS[ch], 0.18, lift ? 3200 : 2400);
  for (let b = 0; b < 4; b++) {
    const tb = t0 + b * BEAT;
    kick(tb, 1);
    if (b % 2 === 1) clap(tb, 1);
    hat(tb + 0.25, 0.9, true);
    for (let s = 0; s < 4; s++) if (s !== 2) hat(tb + s * 0.125, 0.45 + (s === 1 ? 0.2 : 0));
    bass(tb + 0.25, ROOTS[ch], 0.22);
  }
  stab(t0, CHORDS[ch]); stab(t0 + 0.75, CHORDS[ch], 0.7); stab(t0 + 1.5, CHORDS[ch], 0.8);
  for (let s = 0; s < 16; s++) {
    const m = PENTA[(s * 3 + bar) % (lift ? 10 : 7)] + (lift && s % 4 === 3 ? 12 : 0);
    if (s % 2 === 0 || lift) pluck(t0 + s * 0.125, m, lift ? 0.55 : 0.5, s % 2 ? 0.45 : -0.45);
  }
}
// fill into the ending (21.5–22.0)
for (let k = 0; k < 8; k++) snare(21.5 + k * 0.0625, 0.4 + k * 0.08);
// Bar 12-13: impact on the wordmark and a tail that dies before the loop
{
  kick(22.0, 1.2);
  const crash = biquad(noise(2.4, (i) => Math.exp(-i / SR * 2.2)), 'hp', 3500);
  add(music, crash, 22.0, 0.32); add(send, crash, 22.0, 0.4);
  pad(22.0, 3.6, [...CHORDS[0], 62 + 12], 0.34, 2600);
  const sub = tone(1.6, (x) => 36 + 30 * Math.exp(-x * 6), { e: env(0, 0.002, 1.55, 2) });
  add(music, sub, 22.0, 0.7);
  for (let k = 0; k < 8; k++) pluck(22.5 + k * 0.25, [74, 77, 81, 84, 81, 77, 74, 69][k], 0.45 - k * 0.04, k % 2 ? 0.4 : -0.4);
  kick(24, 0.5);
}
// sidechain the pads and bass slightly by the kick (applied to everything but the kick is fine at this level)
for (let ch = 0; ch < 2; ch++) for (let i = 0; i < N; i++) music[ch][i] *= 0.55 + 0.45 * duck[i];

/* ====================================================================== */
/* SFX, each placed so its peak lands on its cue                          */
const sfx = buf(), sfxSend = buf();
const KEY = [62, 65, 67, 69, 72, 74, 77, 79, 81, 84, 86, 89];
const S = {
  key(c) {
    const n = biquad(noise(0.012, env(0, 0.0004, 0.011, 2)), 'hp', 3500);
    mixInto(n, tone(0.02, 2600 + (c.i % 5) * 140, { e: env(0, 0.0005, 0.018, 3) }), 0.25);
    return [n, c.soft ? 0.22 : 0.42, (c.i % 3 - 1) * 0.2];
  },
  enter() {
    const t = tone(0.18, (x) => 70 + 130 * Math.exp(-x * 30), { e: env(0, 0.001, 0.17, 2) });
    mixInto(t, biquad(noise(0.02, env(0, 0.0005, 0.018, 2)), 'hp', 2000), 0.5);
    return [t, 0.6, 0];
  },
  blip(c) {
    const m = KEY[c.n % KEY.length] + 12;
    const t = tone(0.16, hz(m), { type: 'tri', e: env(0, 0.002, 0.15, 3) });
    mixInto(t, tone(0.16, hz(m) * 2, { e: env(0, 0.001, 0.08, 3) }), 0.25);
    return [t, 0.3, (c.n % 3 - 1) * 0.35];
  },
  tick(c) {
    const t = tone(0.03, c.drag ? 1500 + c.n * 60 : 1900, { e: env(0, 0.0005, 0.028, 3) });
    return [t, c.drag ? 0.22 : 0.16, 0.2];
  },
  note(c) {
    const m = KEY[c.n % KEY.length] + 12;
    const t = tone(0.5, hz(m), { e: env(0, 0.002, 0.48, 3) });
    mixInto(t, tone(0.5, hz(m) * 3.01, { e: env(0, 0.001, 0.2, 3) }), 0.18);
    return [t, 0.24 + 0.04 * c.lv, (c.n % 2 ? 0.3 : -0.3)];
  },
  whoosh(c) {
    const len = 0.42, nn = noise(len, (i) => { const x = i / (len * SR); return Math.sin(Math.PI * x) ** 2; });
    const f = biquad(nn, 'bp', (i) => { const x = i / (len * SR); return c.up ? 600 + 3500 * x : 3800 - 3000 * x; }, 0.9);
    return [f, c.soft ? 0.25 : 0.42, 0, len / 2];   // peak in the middle
  },
  click() { const a = tone(0.015, 3200, { e: env(0, 0.0004, 0.014, 2) }), b = tone(0.015, 2400, { e: env(0, 0.0004, 0.014, 2) }); const o = new Float32Array(Math.round(0.09 * SR)); mixInto(o, a); o.set(b.map((v, i) => v + (o[Math.round(0.07 * SR) + i] || 0)), Math.round(0.07 * SR)); return [o, 0.45, 0.15]; },
  press() { return [tone(0.02, 2900, { e: env(0, 0.0004, 0.018, 2) }), 0.45, 0.15]; },
  release() { return [tone(0.02, 2200, { e: env(0, 0.0004, 0.018, 2) }), 0.4, 0.15]; },
  chime() {
    const o = new Float32Array(Math.round(1.4 * SR));
    [74, 81, 86, 89].forEach((m, k) => {
      const t = tone(1.3, hz(m), { e: env(0, 0.003, 1.25, 3) });
      mixInto(t, tone(1.3, hz(m) * 2.76, { e: env(0, 0.001, 0.3, 3) }), 0.12);
      for (let i = 0; i < t.length; i++) { const j = i + Math.round(k * 0.035 * SR); if (j < o.length) o[j] += t[i] / 4; }
    });
    return [o, 0.42, 0];
  },
  slam(c) {
    const t = tone(0.2, (x) => 90 + 80 * Math.exp(-x * 25), { e: env(0, 0.001, 0.19, 2) });
    mixInto(t, biquad(noise(0.06, env(0, 0.0005, 0.055, 2)), 'bp', 1800, 0.8), 0.6);
    return [t, 0.4, c.n ? 0.25 : -0.25];
  },
  shimmer() {
    const o = new Float32Array(Math.round(1.2 * SR));
    [86, 89, 93, 96, 98].forEach((m, k) => { const t = tone(0.8, hz(m), { e: env(0, 0.002, 0.75, 3) }); for (let i = 0; i < t.length; i++) { const j = i + Math.round(k * 0.0625 * SR); if (j < o.length) o[j] += t[i] / 3; } });
    return [o, 0.22, 0];
  },
  impact() {
    const t = tone(0.9, (x) => 40 + 90 * Math.exp(-x * 14), { e: env(0, 0.001, 0.85, 2) });
    mixInto(t, biquad(noise(0.5, env(0, 0.001, 0.48, 3)), 'lp', 2500), 0.5);
    return [t, 0.7, 0];
  },
};
const placed = [];
for (const c of cues) {
  const f = S[c.type];
  if (!f) continue;
  const [sig, g, pan, peakOff = 0] = f(c);
  // find this sound's own peak and shift so it lands on the cue
  let pk = 0, pi = 0;
  for (let i = 0; i < Math.min(sig.length, SR * 0.6); i++) if (Math.abs(sig[i]) > pk) { pk = Math.abs(sig[i]); pi = i; }
  const off = peakOff || pi / SR;
  add(sfx, sig, c.t - off, g, pan);
  add(sfxSend, sig, c.t - off, g * 0.4, pan);
  placed.push({ t: c.t, type: c.type, peakAt: +(c.t).toFixed(4) });
}

/* ---------- mix ---------- */
const rv = reverb([music[0].map((v, i) => send[0][i] + sfxSend[0][i]), music[1].map((v, i) => send[1][i] + sfxSend[1][i])], 1.1, 0.32);
const mix = buf();
let peak = 0;
for (let ch = 0; ch < 2; ch++) for (let i = 0; i < N; i++) {
  // 8 ms fade at both ends keeps the loop click-free
  const fade = Math.min(1, i / (0.008 * SR), (N - 1 - i) / (0.008 * SR));
  mix[ch][i] = (music[ch][i] * 0.5 + sfx[ch][i] * 0.62 + rv[ch][i]) * fade;
  peak = Math.max(peak, Math.abs(mix[ch][i]));
}
const gain = 0.88 / peak;

function wav(path, chans, g = 1) {
  const data = Buffer.alloc(N * 4);
  for (let i = 0; i < N; i++) for (let ch = 0; ch < 2; ch++) data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(chans[ch][i] * g * 32767))), i * 4 + ch * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  writeFileSync(path, Buffer.concat([h, data]));
}
wav('mix.wav', mix, gain);
writeFileSync('cues-placed.json', JSON.stringify(placed, null, 1));
console.log(`mix.wav: ${DUR}s, ${placed.length} SFX placed, gain ${gain.toFixed(3)}`);
