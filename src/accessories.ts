// Éléments accessoires générés : scotch, aplats de peinture, punaises, trombones… Chaque rendu est tiré d'une graine
// et réglable : couleur, longueur (rubans), taille (autres), usure (neuf → abîmé).
import { makeCanvas } from './sticker';

export type AccCat = 'tape' | 'paint' | 'pin' | 'metal';
/** Réglages d'un accessoire. */
export interface AccParams { color: string; length: number; size: number; wear: number; seed: number }
export interface AccKind { id: string; cat: AccCat; tip: string; shadow: number; make: (p: AccParams) => HTMLCanvasElement }
export const ACC_DEFAULTS: AccParams = { color: '#c1272d', length: 38, size: 100, wear: 15, seed: 1 };
export const ACC_COLORS = ['#c1272d', '#e8742a', '#f4d03f', '#2f7a55', '#2c4a9a', '#e7a29a', '#7b4a9a', '#1d1d1d', '#f4f1e6'];

type R = () => number;
const prng = (seed: number): R => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const rgb = (hex: string): [number, number, number] => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (hex: string, f: number, a = 1) => { const [r, g, b] = rgb(hex); const t = f < 1 ? 0 : 255, k = f < 1 ? 1 - f : f - 1; return `rgba(${Math.round(r + (t - r) * k)},${Math.round(g + (t - g) * k)},${Math.round(b + (t - b) * k)},${a})`; };
const ctxOf = (w: number, h: number) => { const c = makeCanvas(w, h); return { c, x: c.getContext('2d')! }; };

// ---------------------------------------------------------------- scotch
/** Bande avec extrémités en dents de scie ; `tooth` = amplitude des dents (grandit avec l'usure). */
function tapePath(x: CanvasRenderingContext2D, W: number, H: number, r: R, tooth: number) {
  const m = 10, top = 12, bot = H - 12;
  x.beginPath(); x.moveTo(m, top);
  x.lineTo(W - m - tooth * r(), top);
  for (let y = top, i = 0; y < bot; y += 6, i++) x.lineTo(W - m - (i % 2 ? tooth : 0) - r() * 2, Math.min(bot, y + 3));
  x.lineTo(W - m, bot); x.lineTo(m + tooth * r(), bot);
  for (let y = bot, i = 0; y > top; y -= 6, i++) x.lineTo(m + (i % 2 ? tooth : 0) + r() * 2, Math.max(top, y - 3));
  x.closePath();
}
function tapeClear(p: AccParams) {
  const r = prng(p.seed), W = tapeW(p), H = 76, { c, x } = ctxOf(W, H);
  tapePath(x, W, H, r, 4 + p.wear * 0.07); x.fillStyle = 'rgba(238,242,232,0.32)'; x.fill();
  x.save(); x.clip();
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, 'rgba(255,255,255,.28)'); g.addColorStop(.45, 'rgba(255,255,255,0)'); g.addColorStop(.6, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,.05)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 14; i++) { x.strokeStyle = `rgba(255,255,255,${0.1 + r() * 0.2})`; x.lineWidth = 1; x.beginPath(); const yy = 14 + r() * (H - 28); x.moveTo(12 + r() * 30, yy); x.lineTo(W - 12 - r() * 30, yy + (r() - 0.5) * 6); x.stroke(); }
  for (let i = 0; i < 5; i++) { x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.ellipse(20 + r() * (W - 40), 18 + r() * (H - 36), 1.5 + r() * 2.5, 1 + r() * 1.5, 0, 0, 7); x.fill(); }
  x.restore();
  x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(14, 13); x.lineTo(W - 14, 13); x.stroke();
  x.strokeStyle = 'rgba(80,72,50,.22)'; x.beginPath(); x.moveTo(14, H - 11.5); x.lineTo(W - 14, H - 11.5); x.stroke();
  return c;
}
function tapeMasking(p: AccParams) {
  const r = prng(p.seed), W = tapeW(p), H = 76, { c, x } = ctxOf(W, H);
  tapePath(x, W, H, r, 3.5 + p.wear * 0.08); x.fillStyle = 'rgba(226,207,160,.95)'; x.fill();
  x.save(); x.clip();
  for (let i = 0; i < 40 + W / 2; i++) { const l = r() < 0.5; x.strokeStyle = l ? `rgba(255,248,225,${r() * 0.25})` : `rgba(120,95,50,${r() * 0.16})`; x.lineWidth = 0.8 + r(); const yy = 8 + r() * (H - 16), xx = r() * W; x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx + 10 + r() * 40, yy + (r() - 0.5) * 3); x.stroke(); }
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(255,255,255,.18)'); g.addColorStop(.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(90,60,20,.14)');
  x.fillStyle = g; x.fillRect(0, 0, W, H); x.restore();
  return c;
}
function washi(pattern: number) {
  return (p: AccParams) => {
    const r = prng(p.seed), W = tapeW(p), H = 76, { c, x } = ctxOf(W, H);
    tapePath(x, W, H, r, 3.5 + p.wear * 0.07); x.fillStyle = mix(p.color, 1, 0.9); x.fill();
    x.save(); x.clip();
    x.strokeStyle = 'rgba(255,255,255,.62)'; x.fillStyle = 'rgba(255,255,255,.62)'; x.lineWidth = 3;
    if (pattern === 0) for (let i = -H; i < W; i += 14) { x.beginPath(); x.moveTo(i, H); x.lineTo(i + H, 0); x.stroke(); }
    else if (pattern === 1) for (let yy = 22; yy < H; yy += 16) for (let xx = (yy / 16) % 2 ? 10 : 18; xx < W; xx += 16) { x.beginPath(); x.arc(xx, yy, 3.2, 0, 7); x.fill(); }
    else if (pattern === 2) { x.lineWidth = 2; for (let xx = 12; xx < W; xx += 18) { x.beginPath(); x.moveTo(xx, 0); x.lineTo(xx, H); x.stroke(); } for (let yy = 22; yy < H; yy += 18) { x.beginPath(); x.moveTo(0, yy); x.lineTo(W, yy); x.stroke(); } }
    else { x.lineWidth = 2.6; for (let yy = 24; yy < H; yy += 20) { x.beginPath(); for (let xx = 0; xx <= W; xx += 10) x.lineTo(xx, yy + ((xx / 10) % 2 ? 5 : -5)); x.stroke(); } }
    for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(255,255,255,${r() * 0.12})`; x.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 2); }
    x.restore();
    return c;
  };
}
const tapeW = (p: AccParams) => Math.round(80 + p.length * 3.4);

// ---------------------------------------------------------------- peinture
/** Contour organique : rayon bruité sur plusieurs fréquences. */
function blob(x: CanvasRenderingContext2D, cx: number, cy: number, R0: number, r: R, rough = 0.28) {
  const N = 72, a1 = r() * 6, a2 = r() * 6, a3 = r() * 6, pts: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2, q = 1 + rough * (0.5 * Math.sin(t * 2 + a1) + 0.3 * Math.sin(t * 3 + a2) + 0.2 * Math.sin(t * 5 + a3)) + (r() - 0.5) * 0.04;
    pts.push([cx + Math.cos(t) * R0 * q, cy + Math.sin(t) * R0 * q * 0.88]);
  }
  x.beginPath(); x.moveTo((pts[0][0] + pts[N - 1][0]) / 2, (pts[0][1] + pts[N - 1][1]) / 2);
  for (let i = 0; i < N; i++) { const q = pts[i], n = pts[(i + 1) % N]; x.quadraticCurveTo(q[0], q[1], (q[0] + n[0]) / 2, (q[1] + n[1]) / 2); }
  x.closePath();
}
/** Matière de la peinture : passages de pinceau plus clairs et plus sombres. */
function paintTexture(x: CanvasRenderingContext2D, W: number, H: number, color: string, r: R) {
  x.save(); x.clip();
  for (let i = 0; i < 70; i++) {
    x.strokeStyle = r() < 0.5 ? mix(color, 1.25, 0.18 * r()) : mix(color, 0.8, 0.2 * r());
    x.lineWidth = 2 + r() * 8; x.lineCap = 'round';
    const xx = r() * W, yy = r() * H, a = -0.3 + r() * 0.6, l = 30 + r() * 90;
    x.beginPath(); x.moveTo(xx, yy); x.quadraticCurveTo(xx + l / 2, yy + a * 20, xx + l, yy + a * l); x.stroke();
  }
  x.restore();
}
function paintBlob(p: AccParams) {
  const r = prng(p.seed), S = 280, { c, x } = ctxOf(S, S);
  blob(x, S / 2, S / 2, 88, r, 0.34); x.fillStyle = p.color; x.fill(); paintTexture(x, S, S, p.color, r);
  blob(x, S / 2, S / 2, 88, r, 0.34); x.strokeStyle = mix(p.color, 0.72, 0.35); x.lineWidth = 2.5; x.stroke();
  x.fillStyle = p.color; for (let i = 0; i < 9; i++) { const a = r() * 7, d = 100 + r() * 28; x.beginPath(); x.arc(S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d * 0.9, 1.5 + r() * 4, 0, 7); x.fill(); }
  return c;
}
function paintSplash(p: AccParams) {
  const r = prng(p.seed), S = 300, { c, x } = ctxOf(S, S);
  blob(x, S / 2, S / 2, 40, r, 0.45); x.fillStyle = p.color; x.fill();
  x.strokeStyle = p.color; x.lineCap = 'round';
  for (let i = 0; i < 46; i++) {
    const a = r() * Math.PI * 2, d = 50 + r() * 90, rad = Math.max(1.6, 11 - d / 14 + r() * 3), px = S / 2 + Math.cos(a) * d, py = S / 2 + Math.sin(a) * d;
    if (r() < 0.45) { x.lineWidth = rad * 0.8; x.beginPath(); x.moveTo(S / 2 + Math.cos(a) * (d - 24 - r() * 20), S / 2 + Math.sin(a) * (d - 24 - r() * 20)); x.lineTo(px, py); x.stroke(); }
    x.beginPath(); x.arc(px, py, rad, 0, 7); x.fill();
  }
  return c;
}
function paintStroke(p: AccParams) {
  const r = prng(p.seed), W = 320, H = 110, { c, x } = ctxOf(W, H);
  x.lineCap = 'round';
  const bend = (r() - 0.5) * 30;
  for (let i = 0; i < 46; i++) { // chaque poil est un trait : extrémités irrégulières, rainures
    const t = i / 45, yy = 24 + t * (H - 48), x0 = 22 + r() * 34, x1 = W - 22 - r() * 42, k = 0.25 + 0.75 * Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.05));
    x.strokeStyle = r() < 0.3 ? mix(p.color, 0.82, 0.95) : r() < 0.4 ? mix(p.color, 1.18, 0.95) : p.color; x.lineWidth = 3.6 + r() * 2;
    x.beginPath(); x.moveTo(x0 + (1 - k) * 18, yy + bend * (0.3 - t * 0.2)); x.quadraticCurveTo(W / 2, yy + bend + (r() - 0.5) * 4, x1 - (1 - k) * 18, yy - bend * 0.2); x.stroke();
  }
  return c;
}
function paintDrip(p: AccParams) {
  const r = prng(p.seed), W = 260, H = 300, { c, x } = ctxOf(W, H);
  x.fillStyle = p.color; x.beginPath(); x.roundRect(24, 22, W - 48, 86, 28); x.fill();
  blob(x, W / 2, 62, 100, r, 0.12); x.fill();
  const n = 5 + ((r() * 3) | 0);
  for (let i = 0; i < n; i++) {
    const xx = 40 + (i / (n - 1)) * (W - 80) + (r() - 0.5) * 14, w = 12 + r() * 14, len = 40 + r() * 150;
    x.fillStyle = p.color; x.beginPath(); x.moveTo(xx - w / 2, 80); x.lineTo(xx - w / 2 * 0.8, 80 + len); x.arc(xx, 80 + len, w / 2 * 0.8, Math.PI, 0, true); x.lineTo(xx + w / 2, 80); x.closePath(); x.fill();
    x.fillStyle = mix(p.color, 1.4, 0.45); x.beginPath(); x.ellipse(xx - w * 0.18, 80 + len - 4, w * 0.12, w * 0.22, 0, 0, 7); x.fill();
  }
  x.save(); x.globalCompositeOperation = 'source-atop'; for (let i = 0; i < 40; i++) { x.strokeStyle = r() < 0.5 ? mix(p.color, 1.2, 0.12) : mix(p.color, 0.8, 0.14); x.lineWidth = 3 + r() * 5; const xx = r() * W, yy = 20 + r() * 80; x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx + 30 + r() * 60, yy + (r() - 0.5) * 8); x.stroke(); } x.restore();
  return c;
}

// ---------------------------------------------------------------- punaises
function sphereGrad(x: CanvasRenderingContext2D, cx: number, cy: number, R0: number, color: string) {
  const g = x.createRadialGradient(cx - R0 * 0.35, cy - R0 * 0.4, R0 * 0.1, cx, cy, R0);
  g.addColorStop(0, mix(color, 1.55)); g.addColorStop(0.45, color); g.addColorStop(1, mix(color, 0.5)); return g;
}
function pinTop(p: AccParams) {
  const S = 84, { c, x } = ctxOf(S, S), cx = 38, cy = 38, R0 = 24, color = p.color;
  x.save(); x.filter = 'blur(3px)'; x.fillStyle = 'rgba(0,0,0,.3)'; x.beginPath(); x.ellipse(cx + 7, cy + 9, R0, R0 * 0.95, 0, 0, 7); x.fill(); x.restore();
  x.fillStyle = mix(color, 0.45); x.beginPath(); x.arc(cx, cy, R0, 0, 7); x.fill();
  x.fillStyle = sphereGrad(x, cx, cy, R0 - 1.5, color); x.beginPath(); x.arc(cx, cy, R0 - 1.5, 0, 7); x.fill();
  x.strokeStyle = mix(color, 0.6, 0.5); x.lineWidth = 1.2; x.beginPath(); x.arc(cx + 1, cy + 1, R0 * 0.62, 0, 7); x.stroke();
  x.fillStyle = 'rgba(255,255,255,.7)'; x.beginPath(); x.ellipse(cx - R0 * 0.38, cy - R0 * 0.45, R0 * 0.22, R0 * 0.13, -0.7, 0, 7); x.fill();
  return c;
}
function pinFlat(p: AccParams) {
  const S = 90, { c, x } = ctxOf(S, S), cx = 42, cy = 42, R0 = 30, color = p.color;
  x.save(); x.filter = 'blur(3.5px)'; x.fillStyle = 'rgba(0,0,0,.3)'; x.beginPath(); x.arc(cx + 7, cy + 10, R0, 0, 7); x.fill(); x.restore();
  x.fillStyle = mix(color, 0.5); x.beginPath(); x.arc(cx, cy, R0, 0, 7); x.fill();
  x.fillStyle = color; x.beginPath(); x.arc(cx, cy, R0 - 3, 0, 7); x.fill();
  const g = x.createLinearGradient(cx - R0, cy - R0, cx + R0, cy + R0); g.addColorStop(0, 'rgba(255,255,255,.4)'); g.addColorStop(.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.3)');
  x.fillStyle = g; x.beginPath(); x.arc(cx, cy, R0 - 3, 0, 7); x.fill();
  x.fillStyle = sphereGrad(x, cx, cy, R0 * 0.45, color); x.beginPath(); x.arc(cx, cy, R0 * 0.45, 0, 7); x.fill();
  x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.ellipse(cx - 6, cy - 7, 5, 3, -0.7, 0, 7); x.fill();
  return c;
}
function pinSide(p: AccParams) {
  const W = 100, H = 128, { c, x } = ctxOf(W, H), cx = 54, color = p.color;
  x.save(); x.filter = 'blur(3px)'; x.fillStyle = 'rgba(0,0,0,.28)'; x.beginPath(); x.ellipse(cx - 10, 120, 24, 5, 0, 0, 7); x.fill(); x.restore();
  const ng = x.createLinearGradient(cx - 3, 0, cx + 3, 0); ng.addColorStop(0, '#9aa1ab'); ng.addColorStop(.5, '#f0f2f5'); ng.addColorStop(1, '#7c838d');
  x.fillStyle = ng; x.beginPath(); x.moveTo(cx - 3, 72); x.lineTo(cx + 3, 72); x.lineTo(cx - 6, 118); x.closePath(); x.fill();
  const bg = x.createLinearGradient(cx - 18, 0, cx + 18, 0); bg.addColorStop(0, mix(color, 0.55)); bg.addColorStop(.4, mix(color, 1.3)); bg.addColorStop(1, mix(color, 0.5));
  x.fillStyle = bg; x.beginPath(); x.moveTo(cx - 12, 44); x.lineTo(cx + 12, 44); x.lineTo(cx + 18, 72); x.lineTo(cx - 18, 72); x.closePath(); x.fill();
  x.beginPath(); x.ellipse(cx, 72, 18, 5, 0, 0, Math.PI); x.fill();
  x.fillStyle = mix(color, 0.5); x.beginPath(); x.ellipse(cx, 44, 12, 4, 0, 0, 7); x.fill();
  const hg = x.createLinearGradient(cx - 30, 0, cx + 30, 0); hg.addColorStop(0, mix(color, 0.6)); hg.addColorStop(.35, mix(color, 1.4)); hg.addColorStop(1, mix(color, 0.5));
  x.fillStyle = hg; x.beginPath(); x.ellipse(cx, 34, 30, 11, 0, 0, 7); x.fill();
  x.fillStyle = mix(color, 1.5, 0.95); x.beginPath(); x.ellipse(cx, 30, 28, 8, 0, 0, 7); x.fill();
  x.fillStyle = 'rgba(255,255,255,.6)'; x.beginPath(); x.ellipse(cx - 11, 28, 8, 2.6, -0.1, 0, 7); x.fill();
  return c;
}

// ---------------------------------------------------------------- métal
function wire(x: CanvasRenderingContext2D, draw: () => void, w: number) {
  x.save(); x.lineCap = 'round'; x.lineJoin = 'round';
  x.translate(3, 4); x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = w; draw(); x.stroke(); x.translate(-3, -4);
  x.strokeStyle = '#7f8691'; x.lineWidth = w; draw(); x.stroke();
  x.strokeStyle = '#d9dee4'; x.lineWidth = w * 0.6; draw(); x.stroke();
  x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = w * 0.18; x.translate(-w * 0.12, -w * 0.12); draw(); x.stroke();
  x.restore();
}
function clip(_p: AccParams) {
  const { c, x } = ctxOf(74, 160);
  wire(x, () => { x.beginPath(); x.moveTo(24, 124); x.lineTo(24, 38); x.arc(38, 38, 14, Math.PI, 0); x.lineTo(52, 120); x.arc(40, 120, 12, 0, Math.PI * 0.95); x.lineTo(28, 62); x.arc(36, 62, 8, Math.PI, 0); x.lineTo(44, 104); }, 4);
  return c;
}
function staple(_p: AccParams) {
  const { c, x } = ctxOf(88, 40);
  wire(x, () => { x.beginPath(); x.moveTo(12, 26); x.lineTo(12, 12); x.lineTo(70, 12); x.lineTo(70, 26); }, 4.5);
  return c;
}

// ---------------------------------------------------------------- usure
type Tone = 'tape' | 'paint' | 'pin' | 'metal';
/** Vieillit un rendu : ternissement, taches, poussière, rayures ; fissures sur la peinture, rouille sur le métal, plis sur le ruban. */
function weather(c: HTMLCanvasElement, wear: number, tone: Tone, r: R) {
  const t = wear / 100; if (t < 0.02) return;
  const x = c.getContext('2d')!, W = c.width, H = c.height;
  x.save(); x.globalCompositeOperation = 'source-atop';
  x.fillStyle = tone === 'tape' ? `rgba(190,150,60,${0.28 * t})` : tone === 'paint' ? `rgba(255,255,255,${0.2 * t})` : tone === 'pin' ? `rgba(255,255,255,${0.16 * t})` : `rgba(110,80,50,${0.22 * t})`;
  x.fillRect(0, 0, W, H);
  const S = Math.min(W, H), stain = tone === 'metal' ? '150,70,20' : tone === 'paint' ? '30,20,10' : '120,90,40';
  for (let i = 0, n = Math.round(t * (tone === 'metal' ? 14 : 8)); i < n; i++) {
    const px = r() * W, py = r() * H, rad = 4 + r() * S * (tone === 'metal' ? 0.16 : 0.22), g = x.createRadialGradient(px, py, 0, px, py, rad);
    g.addColorStop(0, `rgba(${stain},${(0.15 + r() * 0.3) * t * (tone === 'metal' ? 1.6 : 1)})`); g.addColorStop(1, `rgba(${stain},0)`); x.fillStyle = g; x.fillRect(px - rad, py - rad, rad * 2, rad * 2);
  }
  for (let i = 0, n = Math.round(t * W * H / 500); i < n; i++) { x.fillStyle = `rgba(40,30,20,${r() * 0.4 * t})`; x.fillRect(r() * W, r() * H, 1 + r() * 1.5, 1 + r() * 1.5); }  // poussière
  x.lineCap = 'round';
  if (tone === 'tape') for (let i = 0, n = Math.round(t * 6); i < n; i++) { // plis du ruban
    const px = r() * W, a = (r() - 0.5) * 1.2; x.strokeStyle = `rgba(0,0,0,${0.18 * t + 0.04})`; x.lineWidth = 1; x.beginPath(); x.moveTo(px, 0); x.lineTo(px + Math.tan(a) * H, H); x.stroke();
    x.strokeStyle = `rgba(255,255,255,${0.35 * t})`; x.beginPath(); x.moveTo(px + 1.5, 0); x.lineTo(px + 1.5 + Math.tan(a) * H, H); x.stroke();
  }
  if (tone === 'paint') for (let i = 0, n = Math.round(t * 16); i < n; i++) { // fissures de séchage
    x.strokeStyle = `rgba(30,18,10,${0.3 * t + 0.05})`; x.lineWidth = 0.9; x.beginPath(); let px = r() * W, py = r() * H; x.moveTo(px, py);
    for (let k = 0; k < 6; k++) { px += (r() - 0.5) * 26; py += (r() - 0.5) * 26; x.lineTo(px, py); } x.stroke();
  }
  if (tone === 'pin' || tone === 'metal') for (let i = 0, n = Math.round(t * 18); i < n; i++) { // rayures
    x.strokeStyle = r() < 0.5 ? `rgba(255,255,255,${0.5 * t})` : `rgba(0,0,0,${0.3 * t})`; x.lineWidth = 0.8; const px = r() * W, py = r() * H, a = r() * 6.3, l = 5 + r() * 16;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
  }
  x.restore();
  if ((tone === 'tape' || tone === 'paint') && t > 0.45) { // éclats sur les bords
    x.globalCompositeOperation = 'destination-out';
    for (let i = 0, n = Math.round((t - 0.45) * 14); i < n; i++) { const px = r() * W, py = r() < 0.5 ? 12 + r() * 4 : H - 12 - r() * 4, s = 2 + r() * 5; x.beginPath(); x.moveTo(px - s, py); x.lineTo(px, py - s); x.lineTo(px + s, py); x.closePath(); x.fill(); }
    x.globalCompositeOperation = 'source-over';
  }
}
/** Usure puis, hors rubans, mise à l'échelle (les rubans se règlent en longueur). */
function finish(c: HTMLCanvasElement, p: AccParams, tone: Tone): HTMLCanvasElement {
  weather(c, p.wear, tone, prng(p.seed + 77));
  const f = p.size / 100;
  if (tone === 'tape' || Math.abs(f - 1) < 0.02) return c;
  const o = makeCanvas(c.width * f, c.height * f), ox = o.getContext('2d')!; ox.imageSmoothingQuality = 'high'; ox.drawImage(c, 0, 0, o.width, o.height);
  return o;
}

export const ACC_KINDS: AccKind[] = [
  { id: 'scotch', cat: 'tape', tip: 'Scotch transparent', shadow: 8, make: p => finish(tapeClear(p), p, 'tape') },
  { id: 'masking', cat: 'tape', tip: 'Papier collant', shadow: 10, make: p => finish(tapeMasking(p), p, 'tape') },
  { id: 'washi-0', cat: 'tape', tip: 'Washi rayé', shadow: 8, make: p => finish(washi(0)(p), p, 'tape') },
  { id: 'washi-1', cat: 'tape', tip: 'Washi pois', shadow: 8, make: p => finish(washi(1)(p), p, 'tape') },
  { id: 'washi-2', cat: 'tape', tip: 'Washi quadrillé', shadow: 8, make: p => finish(washi(2)(p), p, 'tape') },
  { id: 'washi-3', cat: 'tape', tip: 'Washi zigzag', shadow: 8, make: p => finish(washi(3)(p), p, 'tape') },
  { id: 'paint-blob', cat: 'paint', tip: 'Aplat', shadow: 0, make: p => finish(paintBlob(p), p, 'paint') },
  { id: 'paint-splash', cat: 'paint', tip: 'Éclaboussure', shadow: 0, make: p => finish(paintSplash(p), p, 'paint') },
  { id: 'paint-stroke', cat: 'paint', tip: 'Coup de pinceau', shadow: 0, make: p => finish(paintStroke(p), p, 'paint') },
  { id: 'paint-drip', cat: 'paint', tip: 'Coulure', shadow: 0, make: p => finish(paintDrip(p), p, 'paint') },
  { id: 'pin-top', cat: 'pin', tip: 'Punaise (vue de dessus)', shadow: 0, make: p => finish(pinTop(p), p, 'pin') },
  { id: 'pin-flat', cat: 'pin', tip: 'Punaise plate', shadow: 0, make: p => finish(pinFlat(p), p, 'pin') },
  { id: 'pin-side', cat: 'pin', tip: 'Punaise (de côté)', shadow: 0, make: p => finish(pinSide(p), p, 'pin') },
  { id: 'clip', cat: 'metal', tip: 'Trombone', shadow: 0, make: p => finish(clip(p), p, 'metal') },
  { id: 'staple', cat: 'metal', tip: 'Agrafe', shadow: 0, make: p => finish(staple(p), p, 'metal') },
];
