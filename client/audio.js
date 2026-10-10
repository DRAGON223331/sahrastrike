// أصوات مولّدة بـ WebAudio (بدون ملفات)
let ctx = null, master = null, noiseBuf = null, vol = 0.6;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function init() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = vol;
  master.connect(ctx.destination);
  const len = ctx.sampleRate * 2;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  ambient();
}

export function setVolume(v) { vol = v; if (master) master.gain.value = v; }

function out(pan, gain) {
  const g = ctx.createGain();
  g.gain.value = gain;
  if (ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = clamp(pan, -1, 1);
    g.connect(p); p.connect(master);
  } else g.connect(master);
  return g;
}

function noise(dest, t0, dur, type, freq, q, gain) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(dest);
  src.start(t0, Math.random() * 1.5);
  src.stop(t0 + dur + 0.05);
}

function tone(dest, t0, f0, f1, dur, gain, type = 'sine') {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g); g.connect(dest);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

function ambient() {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf; src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 420;
  const g = ctx.createGain(); g.gain.value = 0.05;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09;
  const lg = ctx.createGain(); lg.gain.value = 0.03;
  lfo.connect(lg); lg.connect(g.gain);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(); lfo.start();
}

export function shot(id, pan = 0, gain = 1) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = out(pan, gain);
  switch (id) {
    case 'pistol':
      noise(o, t, 0.12, 'bandpass', 2200, 0.7, 0.9); tone(o, t, 220, 70, 0.1, 0.6); break;
    case 'smg':
      noise(o, t, 0.09, 'bandpass', 2800, 0.7, 0.8); tone(o, t, 180, 60, 0.08, 0.5); break;
    case 'rifle':
      noise(o, t, 0.2, 'bandpass', 1500, 0.7, 1); noise(o, t, 0.3, 'lowpass', 500, 0.7, 0.5); tone(o, t, 130, 45, 0.18, 0.9); break;
    case 'sniper':
      noise(o, t, 0.6, 'lowpass', 900, 0.7, 1.2); tone(o, t, 90, 30, 0.5, 1);
      noise(o, t + 0.18, 0.5, 'lowpass', 500, 0.7, 0.35); break;
    default:
      noise(o, t, 0.12, 'highpass', 3000, 0.7, 0.4);
  }
}

export function knife(pan = 0, gain = 1) {
  if (!ctx) return;
  noise(out(pan, gain), ctx.currentTime, 0.14, 'highpass', 2500, 0.7, 0.5);
}
export function reload(pan = 0, gain = 1) {
  if (!ctx) return;
  const t = ctx.currentTime, o = out(pan, gain);
  noise(o, t, 0.05, 'bandpass', 1800, 2, 0.5);
  noise(o, t + 0.45, 0.05, 'bandpass', 1200, 2, 0.6);
  noise(o, t + 0.9, 0.07, 'bandpass', 2400, 2, 0.6);
}
export function step(pan = 0, gain = 0.3) {
  if (!ctx) return;
  noise(out(pan, gain), ctx.currentTime, 0.07, 'bandpass', 320, 1, 0.8);
}
export function hit(head) {
  if (!ctx) return;
  const t = ctx.currentTime, o = out(0, 0.8);
  if (head) { tone(o, t, 1800, 2600, 0.12, 0.6, 'triangle'); tone(o, t + 0.04, 2400, 3000, 0.1, 0.4, 'triangle'); }
  else tone(o, t, 1100, 900, 0.07, 0.5, 'triangle');
}
export function kill() {
  if (!ctx) return;
  const t = ctx.currentTime, o = out(0, 0.7);
  tone(o, t, 700, 700, 0.09, 0.5, 'square'); tone(o, t + 0.09, 1000, 1000, 0.14, 0.5, 'square');
}
export function hurt() {
  if (!ctx) return;
  noise(out(0, 0.9), ctx.currentTime, 0.2, 'bandpass', 400, 1, 0.8);
}
export function beep(pan = 0, gain = 0.7) {
  if (!ctx) return;
  tone(out(pan, gain), ctx.currentTime, 1000, 1000, 0.08, 0.5, 'square');
}
export function plantSound() {
  if (!ctx) return;
  const t = ctx.currentTime, o = out(0, 0.8);
  [600, 800, 1000].forEach((f, i) => tone(o, t + i * 0.13, f, f, 0.12, 0.5, 'square'));
}
export function defuseSound() {
  if (!ctx) return;
  const t = ctx.currentTime, o = out(0, 0.8);
  [1000, 1300].forEach((f, i) => tone(o, t + i * 0.15, f, f, 0.14, 0.5, 'triangle'));
}
export function explosion() {
  if (!ctx) return;
  const t = ctx.currentTime, o = out(0, 1.4);
  noise(o, t, 2.0, 'lowpass', 400, 0.7, 1.5); tone(o, t, 70, 22, 1.4, 1.2);
}
export function click() {
  if (!ctx) return;
  tone(out(0, 0.5), ctx.currentTime, 900, 700, 0.05, 0.4, 'triangle');
}
export function buy() {
  if (!ctx) return;
  const t = ctx.currentTime, o = out(0, 0.6);
  tone(o, t, 1400, 1400, 0.08, 0.4, 'triangle'); tone(o, t + 0.07, 1900, 1900, 0.12, 0.4, 'triangle');
}
export function roundStart() {
  if (!ctx) return;
  const t = ctx.currentTime, o = out(0, 0.6);
  tone(o, t, 440, 440, 0.2, 0.5, 'triangle'); tone(o, t + 0.22, 660, 660, 0.3, 0.5, 'triangle');
}
