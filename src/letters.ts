// Lettres « découpées dans des magazines » : papier, police, couleurs, bords déchirés et état d'usure réglables.
// Tout est tiré d'une graine : l'aperçu et le résultat final sont identiques tant que la graine ne change pas.
import { makeCanvas } from './sticker';

export const FONTS = ['Impact', 'Arial Black', 'Georgia', 'Times New Roman', 'Courier New', 'Palatino Linotype', 'Rockwell', 'Segoe Script', 'Bahnschrift', 'Trebuchet MS'];
export interface Palette { id: string; paper: string | null; ink: string }
export const PALETTES: Palette[] = [
  { id: 'journal', paper: '#f3ecd8', ink: '#1d1d1d' }, { id: 'rouge', paper: '#c1272d', ink: '#fff6e0' },
  { id: 'jaune', paper: '#f4d03f', ink: '#1d1d1d' }, { id: 'noir', paper: '#1d1d1d', ink: '#f3ecd8' },
  { id: 'bleu', paper: '#2c4a9a', ink: '#fff6e0' }, { id: 'rose', paper: '#e7a29a', ink: '#2a1b1b' },
  { id: 'kraft', paper: '#c8a574', ink: '#2b1d10' }, { id: 'vert', paper: '#2f7a55', ink: '#f6f1df' },
  { id: 'blanc', paper: '#fbfaf4', ink: '#c1272d' },
  { id: 'decoupe-noir', paper: null, ink: '#1d1d1d' }, { id: 'decoupe-rouge', paper: null, ink: '#c1272d' },
];

export interface LetterOpts { font: string; palette: string; paper: string; ink: string; tear: number; dirt: number; seed: number }

type R = () => number;
const rng = (seed: number): R => {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};
const pick = <T,>(a: readonly T[], r: R) => a[(r() * a.length) | 0];
const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

function style(o: LetterOpts, r: R): { font: string; paper: string | null; ink: string } {
  const font = o.font === 'mix' ? pick(FONTS, r) : o.font;
  if (o.palette === 'custom') return { font, paper: o.paper, ink: o.ink };
  if (o.palette === 'mix') { const q = pick(PALETTES, r); return { font, paper: q.paper, ink: q.ink }; }
  const q = PALETTES.find(x => x.id === o.palette) ?? PALETTES[0];
  return { font, paper: q.paper, ink: q.ink };
}

type Pt = { x: number; y: number };
/** Contour d'un papier : plus `amp` est grand, plus le bord est irrégulier. */
function edgePoly(W: number, H: number, inset: number, step: number, amp: number, r: R): Pt[] {
  const cj = Math.min(amp * 1.5, inset * 0.8);
  const c = [{ x: inset, y: inset }, { x: W - inset, y: inset }, { x: W - inset, y: H - inset }, { x: inset, y: H - inset }]
    .map(p => ({ x: p.x + (r() - 0.5) * cj * 2, y: p.y + (r() - 0.5) * cj * 2 }));
  const out: Pt[] = [];
  for (let i = 0; i < 4; i++) {
    const a = c[i], b = c[(i + 1) % 4], dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const n = Math.max(1, Math.round(len / step)), nx = -dy / len, ny = dx / len;
    let wob = 0;
    for (let k = 0; k < n; k++) { wob = wob * 0.5 + (r() - 0.5) * 2 * amp; out.push({ x: a.x + (dx * k) / n + nx * wob, y: a.y + (dy * k) / n + ny * wob }); }
  }
  return out;
}

function paperShape(ctx: CanvasRenderingContext2D, W: number, H: number, m: number, color: string, tear: number, r: R) {
  const t = tear / 100;
  const fill = (pts: Pt[], col: string) => { ctx.fillStyle = col; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.fill(); };
  if (t < 0.02) { fill(edgePoly(W, H, m * 0.9, 40, 0.7, r), color); return; } // coupe aux ciseaux
  const step = Math.max(3, 14 - 11 * t);
  fill(edgePoly(W, H, m * 0.5, step, 0.6 + t * m * 0.42, r), '#f2eee2');                       // fibres blanches du bord déchiré
  fill(edgePoly(W, H, m * 0.5 + 1.2 + t * 2.4, step, 0.4 + t * m * 0.28, r), color);           // papier coloré
}

/** Vieillit un calque : grain, jaunissement, taches, plis, bords brûlés, éclats. */
function weather(c: HTMLCanvasElement, dirt: number, r: R) {
  const t = dirt / 100; if (t <= 0.01) return;
  const ctx = c.getContext('2d')!, W = c.width, H = c.height;
  const id = ctx.getImageData(0, 0, W, H), d = id.data, y = t * 0.55;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const n = (r() - 0.5) * t * 70;
    d[i] = clamp(d[i] * (1 - 0.05 * y) + n); d[i + 1] = clamp(d[i + 1] * (1 - 0.12 * y) + n); d[i + 2] = clamp(d[i + 2] * (1 - 0.28 * y) + n);
  }
  ctx.putImageData(id, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  const S = Math.min(W, H);
  for (let i = 0, n = Math.round(t * 7); i < n; i++) { // taches
    const x = r() * W, yy = r() * H, rad = 6 + r() * S * 0.3, g = ctx.createRadialGradient(x, yy, 0, x, yy, rad);
    g.addColorStop(0, `rgba(105,70,32,${(0.1 + 0.25 * r()) * t})`); g.addColorStop(1, 'rgba(105,70,32,0)');
    ctx.fillStyle = g; ctx.fillRect(x - rad, yy - rad, rad * 2, rad * 2);
  }
  if (t > 0.5) { // anneau de tasse
    const x = r() * W, yy = r() * H, rad = S * (0.18 + r() * 0.15);
    ctx.strokeStyle = `rgba(95,62,28,${(t - 0.4) * 0.45})`; ctx.lineWidth = 1.5 + r() * 2; ctx.beginPath(); ctx.arc(x, yy, rad, 0, Math.PI * 2 * (0.75 + r() * 0.25)); ctx.stroke();
  }
  for (let i = 0, n = Math.round(t * 4); i < n; i++) { // plis
    const horiz = r() < 0.5, a = r(), b = r(), p1 = horiz ? [0, a * H] : [a * W, 0], p2 = horiz ? [W, b * H] : [b * W, H];
    ctx.lineWidth = 1; ctx.strokeStyle = `rgba(0,0,0,${0.22 * t + 0.05})`; ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${0.35 * t})`; ctx.beginPath(); ctx.moveTo(p1[0] + 1, p1[1] + 1); ctx.lineTo(p2[0] + 1, p2[1] + 1); ctx.stroke();
  }
  const g = ctx.createRadialGradient(W / 2, H / 2, S * 0.2, W / 2, H / 2, Math.hypot(W, H) / 2); // bords assombris
  g.addColorStop(0, 'rgba(70,45,20,0)'); g.addColorStop(1, `rgba(70,45,20,${0.5 * t})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0, n = Math.round(Math.max(0, t - 0.5) * 12); i < n; i++) { // éclats sur les bords
    const edge = (r() * 4) | 0, x = edge === 0 ? r() * W : edge === 1 ? W : edge === 2 ? r() * W : 0, yy = edge === 0 ? 0 : edge === 1 ? r() * H : edge === 2 ? H : r() * H, s = 2 + r() * 6;
    ctx.beginPath(); ctx.moveTo(x - s, yy); ctx.lineTo(x + s * 0.4, yy - s); ctx.lineTo(x + s * 0.6, yy + s); ctx.closePath(); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

interface Glyph { ch: string; font: string; fs: number; rot: number }
const fontCss = (g: Glyph) => `${g.font === 'Impact' || g.font === 'Segoe Script' ? '' : 'bold '}${Math.round(g.fs * 0.85)}px "${g.font}"`;

function render(gs: Glyph[], gap: number, padx: number, paper: string | null, ink: string, o: LetterOpts, r: R): HTMLCanvasElement {
  const t = o.tear / 100, m = Math.round(5 + t * 8);
  const meas = makeCanvas(4, 4).getContext('2d')!;
  const widths = gs.map(g => { meas.font = fontCss(g); return meas.measureText(g.ch).width; });
  const inner = widths.reduce((s, w) => s + w, 0) + gap * (gs.length - 1), fsMax = Math.max(...gs.map(g => g.fs));
  const W = Math.round(inner + 2 * (padx + m)), H = Math.round(fsMax * 1.2 + 2 * m);
  const c = makeCanvas(W, H), ctx = c.getContext('2d')!;
  if (paper) paperShape(ctx, W, H, m, paper, o.tear, r);
  const inkC = makeCanvas(W, H), ic = inkC.getContext('2d')!;
  ic.fillStyle = ink; ic.textBaseline = 'middle'; ic.textAlign = 'center';
  let x = m + padx;
  gs.forEach((g, i) => {
    ic.save(); ic.translate(x + widths[i] / 2, H / 2 + g.fs * 0.04); ic.rotate(g.rot); ic.font = fontCss(g); ic.fillText(g.ch, 0, 0); ic.restore();
    x += widths[i] + gap;
  });
  const dt = o.dirt / 100;
  if (dt > 0.01) { // encre usée : mouchetures et frottements
    ic.globalCompositeOperation = 'destination-out';
    for (let i = 0, n = Math.round(dt * W * H / 90); i < n; i++) { ic.globalAlpha = 0.5 + r() * 0.5; ic.beginPath(); ic.arc(r() * W, r() * H, 0.5 + r() * 1.4 * dt + 0.3, 0, 7); ic.fill(); }
    for (let i = 0, n = Math.round(dt * 4); i < n; i++) { ic.globalAlpha = 0.5; ic.fillRect(r() * W, r() * H, 6 + r() * 20, 1 + r() * 3); }
    ic.globalAlpha = 1; ic.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = 1 - 0.3 * dt; ctx.drawImage(inkC, 0, 0); ctx.globalAlpha = 1;
  weather(c, o.dirt, r);
  return c;
}

/** Une pièce de papier par lettre. */
export function makeSeparate(word: string, o: LetterOpts, size = 130): HTMLCanvasElement[] {
  return [...word].filter(ch => ch.trim()).map((ch, i) => {
    const r = rng(o.seed + i * 7919), s = style(o, r), fs = size * (0.85 + r() * 0.25);
    return render([{ ch: r() < 0.3 ? ch.toUpperCase() : ch, font: s.font, fs, rot: (r() - 0.5) * 0.08 }], 0, fs * (0.14 + r() * 0.14), s.paper, s.ink, o, r);
  });
}

/** Tout le mot sur un même bout de papier. */
export function makeGrouped(word: string, o: LetterOpts, size = 130): HTMLCanvasElement {
  const r = rng(o.seed), s = style(o, r);
  const gs = [...word].map(ch => ({ ch, font: o.font === 'mix' ? pick(FONTS, r) : s.font, fs: size * (0.92 + r() * 0.16), rot: (r() - 0.5) * 0.07 }));
  return render(gs, size * 0.03, size * 0.22, s.paper, s.ink, o, r);
}
