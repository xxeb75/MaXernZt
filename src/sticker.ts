// Fabrication de la « texture papier découpé » : contour blanc autour d'un calque RGBA.
export const PAD = 28; // marge réservée autour de l'image pour le contour

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export function bake(base: HTMLCanvasElement, border: number): HTMLCanvasElement {
  const out = makeCanvas(base.width + PAD * 2, base.height + PAD * 2);
  const ctx = out.getContext('2d')!;
  if (border > 0) {
    const white = makeCanvas(base.width, base.height);
    const wc = white.getContext('2d')!;
    wc.drawImage(base, 0, 0);
    wc.globalCompositeOperation = 'source-in';
    wc.fillStyle = '#fffdf5';
    wc.fillRect(0, 0, white.width, white.height);
    const N = 32;
    for (const k of [1, 0.66, 0.33]) {
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2;
        ctx.drawImage(white, PAD + Math.cos(a) * border * k, PAD + Math.sin(a) * border * k);
      }
    }
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
