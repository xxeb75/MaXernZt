// Fabrication de la « texture papier découpé » : contour blanc autour d'un calque RGBA.
export const PAD = 48; // marge réservée autour de l'image pour le contour

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

// bruit de valeur déterministe (même graine = même contour)
const hash = (x: number, y: number, s: number) => {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 2147483647)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
};
const vnoise = (x: number, y: number, s: number) => {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};

/**
 * Texture finale d'un calque : l'image + un contour de papier blanc.
 * Le contour est un champ flou de la silhouette coupé à un seuil qui varie avec du bruit :
 * épaisseur inégale, bord déchiqueté, fibres. `rough` (0-100) règle l'irrégularité, `seed` la forme.
 */
/** Le fichier existe-t-il vraiment (et n'est-ce pas la page d'accueil renvoyée à sa place) ? */
export async function assetOk(url: string): Promise<boolean> {
  try {
    const r = await fetch(url);
    const ok = r.ok && !(r.headers.get('content-type') || '').includes('text/html');
    r.body?.cancel();
    return ok;
  } catch { return false; }
}

export function bake(base: HTMLCanvasElement, border: number, rough = 60, seed = 1): HTMLCanvasElement {
  const W = base.width + PAD * 2, H = base.height + PAD * 2;
  const out = makeCanvas(W, H);
  const ctx = out.getContext('2d')!;
  if (border > 0) {
    const sil = makeCanvas(W, H);
    sil.getContext('2d')!.drawImage(base, PAD, PAD);
    const blur = makeCanvas(W, H), bc = blur.getContext('2d', { willReadFrequently: true })!;
    bc.filter = `blur(${(border * 0.8).toFixed(2)}px)`;
    bc.drawImage(sil, 0, 0);
    const field = bc.getImageData(0, 0, W, H);
    const d = field.data, amp = rough / 100;
    const c1 = Math.max(4, border * 1.8), c2 = Math.max(2.5, border * 0.7);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4, a = d[i + 3] / 255;
        let alpha = 0, shade = 1;
        if (a >= 0.97) alpha = 1;
        else if (a > 0.012) {
          const coarse = 0.65 * vnoise(x / c1, y / c1, seed) + 0.35 * vnoise(x / c2, y / c2, seed + 7);
          const fine = hash(x, y, seed + 13);
          let thr = 0.09 + amp * (coarse - 0.5) * 0.36 + amp * (fine - 0.5) * 0.1;
          thr = thr < 0.02 ? 0.02 : thr > 0.45 ? 0.45 : thr;
          alpha = (a - thr) * 14; alpha = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
          shade = 1 - 0.06 * hash(x, y, seed + 29) * (0.4 + amp);
        }
        d[i] = 255 * shade; d[i + 1] = 253 * shade; d[i + 2] = 245 * shade; d[i + 3] = alpha * 255;
      }
    }
    bc.filter = 'none'; bc.putImageData(field, 0, 0);
    ctx.drawImage(blur, 0, 0);
  }
  ctx.drawImage(base, PAD, PAD);
  return out;
}

/** Rogne un canvas à sa zone non transparente. Renvoie null si vide. */
export function trim(src: HTMLCanvasElement): { canvas: HTMLCanvasElement; x: number; y: number } | null {
  const { width: w, height: h } = src;
  const d = src.getContext('2d')!.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  const out = makeCanvas(x1 - x0 + 1, y1 - y0 + 1);
  out.getContext('2d')!.drawImage(src, -x0, -y0);
  return { canvas: out, x: x0, y: y0 };
}

/** Bord irrégulier : subdivise une polyligne et la fait trembler. */
export function jitter(pts: { x: number; y: number }[], step: number, amp: number) {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.round(len / step));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      out.push({ x: a.x + (b.x - a.x) * t + (Math.random() - 0.5) * amp, y: a.y + (b.y - a.y) * t + (Math.random() - 0.5) * amp });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
