// Textures de papier de fond, générées à la volée : une couche d'ombres et de lumières (noir / blanc translucides)
// posée sur la couleur de la feuille. Grain, fibres et plis sont déterministes : même réglage = même rendu.
import { makeCanvas } from './sticker';

export type PaperKind = 'none' | 'papier' | 'kraft' | 'carton' | 'journal' | 'quadrille' | 'lignes' | 'froisse';
/** `bg` : couleur de feuille proposée quand on choisit la texture. */
export const PAPERS: { id: PaperKind; name: string; bg?: string }[] = [
  { id: 'none', name: 'Lisse' },
  { id: 'papier', name: 'Papier grainé' },
  { id: 'kraft', name: 'Kraft', bg: '#b99568' },
  { id: 'carton', name: 'Carton', bg: '#a98258' },
  { id: 'journal', name: 'Papier journal', bg: '#e3dbc6' },
  { id: 'quadrille', name: 'Cahier à carreaux', bg: '#f6f4ea' },
  { id: 'lignes', name: 'Cahier à lignes', bg: '#f7f3e6' },
  { id: 'froisse', name: 'Papier froissé', bg: '#ece8df' },
];

const rng = (seed: number) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Bruit de valeur périodique n×n (raccord parfait quand on répète la tuile), valeurs dans [-1, 1]. */
function periodic(n: number, cell: number, sx: number, sy: number, rnd: () => number): Float32Array {
  const lx = Math.max(1, Math.round(n / (cell * sx))), ly = Math.max(1, Math.round(n / (cell * sy)));
  const lat = Float32Array.from({ length: lx * ly }, () => rnd() * 2 - 1), out = new Float32Array(n * n);
  for (let y = 0; y < n; y++) {
    const fy = (y / n) * ly, y0 = Math.floor(fy) % ly, y1 = (y0 + 1) % ly, ty = smooth(fy - Math.floor(fy));
    for (let x = 0; x < n; x++) {
      const fx = (x / n) * lx, x0 = Math.floor(fx) % lx, x1 = (x0 + 1) % lx, tx = smooth(fx - Math.floor(fx));
      const a = lat[y0 * lx + x0] * (1 - tx) + lat[y0 * lx + x1] * tx, b = lat[y1 * lx + x0] * (1 - tx) + lat[y1 * lx + x1] * tx;
      out[y * n + x] = a * (1 - ty) + b * ty;
    }
  }
  return out;
}

interface Grain { layers: { cell: number; sx?: number; sy?: number; amp: number }[]; alpha: number; fibers?: { n: number; len: [number, number]; dark: string; light: string }; text?: boolean }
const GRAIN: Partial<Record<PaperKind, Grain>> = {
  papier: { layers: [{ cell: 1, amp: 0.35 }, { cell: 5, amp: 0.25 }, { cell: 40, amp: 0.18 }], alpha: 0.24, fibers: { n: 110, len: [8, 28], dark: 'rgba(60,50,40,.10)', light: 'rgba(255,255,255,.25)' } },
  kraft: { layers: [{ cell: 2, amp: 0.4 }, { cell: 8, amp: 0.3 }, { cell: 60, amp: 0.3 }], alpha: 0.34, fibers: { n: 260, len: [14, 60], dark: 'rgba(70,40,10,.20)', light: 'rgba(255,235,200,.22)' } },
  carton: { layers: [{ cell: 3, sx: 12, sy: 1, amp: 0.5 }, { cell: 2, amp: 0.3 }, { cell: 50, amp: 0.25 }], alpha: 0.32, fibers: { n: 90, len: [10, 40], dark: 'rgba(60,35,10,.14)', light: 'rgba(255,230,190,.16)' } },
  journal: { layers: [{ cell: 2, amp: 0.3 }, { cell: 30, amp: 0.2 }], alpha: 0.16, text: true },
};
const tiles = new Map<PaperKind, HTMLCanvasElement>();
function grainTile(kind: PaperKind): HTMLCanvasElement | null {
  const g = GRAIN[kind]; if (!g) return null;
  const hit = tiles.get(kind); if (hit) return hit;
  const N = 256, rnd = rng(kind.length * 977 + kind.charCodeAt(0)), field = new Float32Array(N * N);
  for (const l of g.layers) { const p = periodic(N, l.cell, l.sx ?? 1, l.sy ?? 1, rnd); for (let i = 0; i < field.length; i++) field[i] += p[i] * l.amp; }
  const c = makeCanvas(N, N), ctx = c.getContext('2d')!, img = ctx.createImageData(N, N);
  for (let i = 0; i < field.length; i++) {
    const v = Math.max(-1, Math.min(1, field[i] + (rnd() * 2 - 1) * 0.12)), o = i * 4;
    const c0 = v < 0 ? 0 : 255; img.data[o] = img.data[o + 1] = img.data[o + 2] = c0; img.data[o + 3] = Math.round(Math.abs(v) * g.alpha * (v < 0 ? 1.15 : 1) * 255);
  }
  ctx.putImageData(img, 0, 0);
  const wrap = (f: (dx: number, dy: number) => void) => { for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) f(dx, dy); };
  if (g.fibers) {
    ctx.lineCap = 'round'; ctx.lineWidth = 1;
    for (let i = 0; i < g.fibers.n; i++) {
      const x = rnd() * N, y = rnd() * N, a = rnd() * Math.PI * 2, len = g.fibers.len[0] + rnd() * (g.fibers.len[1] - g.fibers.len[0]), bend = (rnd() - 0.5) * 0.8;
      ctx.strokeStyle = rnd() < 0.5 ? g.fibers.dark : g.fibers.light;
      wrap((dx, dy) => { ctx.beginPath(); ctx.moveTo(x + dx, y + dy); ctx.quadraticCurveTo(x + dx + Math.cos(a + bend) * len * 0.5, y + dy + Math.sin(a + bend) * len * 0.5, x + dx + Math.cos(a) * len, y + dy + Math.sin(a) * len); ctx.stroke(); });
    }
  }
  if (g.text) {   // faux texte imprimé : lignes de petits traits gris
    ctx.fillStyle = 'rgba(40,40,40,.17)';
    for (let y = 6; y < N; y += 9) for (let x = 0; x < N;) { const w = 3 + rnd() * 16; if (rnd() < 0.82) ctx.fillRect(x, y, w, 2.4); x += w + 2 + rnd() * 3; }
  }
  tiles.set(kind, c); return c;
}

/** Couche de texture de w×h pixels (k = échelle d'affichage, pour les petites vignettes), ou null pour « lisse ». */
export function renderPaperOverlay(kind: PaperKind, w: number, h: number, k = 1): HTMLCanvasElement | null {
  if (kind === 'none') return null;
  const c = makeCanvas(w, h), ctx = c.getContext('2d')!;
  const grain = grainTile(kind === 'quadrille' || kind === 'lignes' || kind === 'froisse' ? 'papier' : kind);
  if (grain) { ctx.save(); ctx.scale(k, k); ctx.fillStyle = ctx.createPattern(grain, 'repeat')!; ctx.fillRect(0, 0, w / k, h / k); ctx.restore(); }
  ctx.save(); ctx.scale(k, k);
  const W = w / k, H = h / k;
  if (kind === 'quadrille' || kind === 'lignes') {
    ctx.strokeStyle = 'rgba(70,120,200,.5)'; ctx.lineWidth = 1.5; ctx.beginPath();
    if (kind === 'quadrille') { for (let x = 27; x < W; x += 54) { ctx.moveTo(x, 0); ctx.lineTo(x, H); } for (let y = 27; y < H; y += 54) { ctx.moveTo(0, y); ctx.lineTo(W, y); } }
    else for (let y = 130; y < H; y += 66) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
    if (kind === 'lignes') { ctx.strokeStyle = 'rgba(220,70,70,.55)'; ctx.beginPath(); ctx.moveTo(150, 0); ctx.lineTo(150, H); ctx.stroke(); }
  } else if (kind === 'froisse') {
    const rnd = rng(4242), S = Math.max(W, H);
    for (let i = 0; i < 26; i++) {   // facettes : grandes plaques légèrement plus claires ou plus sombres
      const cx = rnd() * W, cy = rnd() * H, r = S * (0.12 + rnd() * 0.25), n = 5 + Math.floor(rnd() * 3);
      ctx.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.05)'; ctx.beginPath();
      for (let j = 0; j < n; j++) { const a = (j / n) * Math.PI * 2 + rnd() * 0.5, rr = r * (0.55 + rnd() * 0.6); ctx[j ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill();
    }
    ctx.lineCap = 'round';
    for (let i = 0; i < 46; i++) {   // plis : un trait sombre doublé d'un trait clair
      let x = rnd() * W, y = rnd() * H, a = rnd() * Math.PI * 2; const pts: [number, number][] = [[x, y]];
      for (let j = 0; j < 3 + Math.floor(rnd() * 3); j++) { const l = S * (0.05 + rnd() * 0.16); a += (rnd() - 0.5) * 1.1; x += Math.cos(a) * l; y += Math.sin(a) * l; pts.push([x, y]); }
      for (const [off, col, lw] of [[0, 'rgba(0,0,0,.20)', 1.8], [2, 'rgba(255,255,255,.30)', 1.6]] as const) {
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); pts.forEach(([px, py], j) => ctx[j ? 'lineTo' : 'moveTo'](px + off, py + off)); ctx.stroke();
      }
    }
  }
  ctx.restore();
  return c;
}
