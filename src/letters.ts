// Lettres « découpées dans des magazines » : chaque lettre a son papier, sa police, sa couleur.
import { makeCanvas } from './sticker';

const FONTS = ['Impact', 'Georgia', 'Courier New', 'Arial Black', 'Times New Roman', 'Trebuchet MS', 'Palatino Linotype'];
const STYLES = [
  { bg: '#f3ecd8', fg: '#1d1d1d' }, { bg: '#c1272d', fg: '#fff6e0' }, { bg: '#f4d03f', fg: '#1d1d1d' },
  { bg: '#1d1d1d', fg: '#f3ecd8' }, { bg: '#2c4a9a', fg: '#fff6e0' }, { bg: '#e7a29a', fg: '#2a1b1b' },
  { bg: '#d9cfb4', fg: '#8a1c1c' }, { bg: null, fg: '#c1272d' }, { bg: null, fg: '#1d1d1d' },
] as const;
const rnd = <T,>(a: readonly T[]) => a[(Math.random() * a.length) | 0];

export function makeLetter(ch: string, size = 130): HTMLCanvasElement {
  const font = rnd(FONTS), st = rnd(STYLES), bold = Math.random() < 0.5 ? 'bold ' : '';
  const fs = size * (0.8 + Math.random() * 0.3);
  const w = Math.round(fs * (0.9 + Math.random() * 0.2)), h = Math.round(fs * 1.15);
  const c = makeCanvas(w, h), ctx = c.getContext('2d')!;
  const j = () => 4 + Math.random() * 5;
  if (st.bg) { // papier découpé aux ciseaux : quadrilatère irrégulier
    ctx.fillStyle = st.bg;
    ctx.beginPath();
    ctx.moveTo(j(), j()); ctx.lineTo(w - j(), j()); ctx.lineTo(w - j(), h - j()); ctx.lineTo(j(), h - j());
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = st.fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${bold}${fs * 0.85}px "${font}"`;
  ctx.fillText(Math.random() < 0.3 ? ch.toUpperCase() : ch, w / 2, h / 2 + fs * 0.04);
  return c;
}
