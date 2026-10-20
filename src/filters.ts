// Effets de couleur d'un élément : luminosité, contraste, saturation, teinte, noir et blanc, sépia, inversion, flou, voile coloré.
// Ils s'appliquent à l'image de base avant le contour : le bord blanc « papier » reste blanc, et les exports voient l'effet.
import { makeCanvas } from './sticker';

export interface LayerFx {
  br: number; co: number; sa: number;   // luminosité, contraste, saturation : -100…100 (0 = inchangé)
  hue: number;                          // rotation de teinte : 0…360°
  gray: number; sepia: number; inv: number;   // noir et blanc, sépia, négatif : 0…100 %
  blur: number;                         // flou en pixels
  tint: string; tintA: number;          // voile coloré : couleur et intensité 0…100 %
}
export const FX0: LayerFx = { br: 0, co: 0, sa: 0, hue: 0, gray: 0, sepia: 0, inv: 0, blur: 0, tint: '#ff7a00', tintA: 0 };
export const fxNeutral = (f: LayerFx | undefined) => !f || (f.br === 0 && f.co === 0 && f.sa === 0 && f.hue === 0 && f.gray === 0 && f.sepia === 0 && f.inv === 0 && f.blur === 0 && f.tintA === 0);

/** Réglages rapides : un clic pose l'ensemble. */
export const FX_PRESETS: { id: string; name: string; css: string; fx: Partial<LayerFx> }[] = [
  { id: 'bw', name: 'Noir et blanc', css: 'linear-gradient(135deg,#111,#eee)', fx: { gray: 100 } },
  { id: 'sepia', name: 'Sépia', css: 'linear-gradient(135deg,#4a3320,#d9b98a)', fx: { sepia: 100 } },
  { id: 'vintage', name: 'Vieilli', css: 'linear-gradient(135deg,#6b5b3e,#e2c88f)', fx: { sepia: 55, co: 15, sa: -20, tint: '#d9a25c', tintA: 18 } },
  { id: 'xerox', name: 'Photocopie', css: 'linear-gradient(135deg,#000,#fff)', fx: { gray: 100, co: 90, br: 8 } },
  { id: 'pop', name: 'Pop saturé', css: 'linear-gradient(135deg,#ff2d87,#ffe43a)', fx: { sa: 85, co: 25 } },
  { id: 'cold', name: 'Froid', css: 'linear-gradient(135deg,#1b4b7a,#9bd4ff)', fx: { hue: 190, sa: 10, tint: '#3a7bd5', tintA: 22 } },
  { id: 'inv', name: 'Négatif', css: 'linear-gradient(135deg,#f6f6f6,#0a0a0a)', fx: { inv: 100 } },
];

/** Image de base avec les effets appliqués (même taille, transparence conservée). */
export function applyLayerFx(base: HTMLCanvasElement, f: LayerFx): HTMLCanvasElement {
  const out = makeCanvas(base.width, base.height), ctx = out.getContext('2d')!;
  const parts = [
    f.br ? `brightness(${1 + f.br / 100})` : '', f.co ? `contrast(${1 + f.co / 100})` : '', f.sa ? `saturate(${Math.max(0, 1 + f.sa / 100)})` : '',
    f.hue ? `hue-rotate(${f.hue}deg)` : '', f.gray ? `grayscale(${f.gray}%)` : '', f.sepia ? `sepia(${f.sepia}%)` : '', f.inv ? `invert(${f.inv}%)` : '',
    f.blur ? `blur(${f.blur}px)` : '',
  ].filter(Boolean);
  ctx.filter = parts.length ? parts.join(' ') : 'none';
  ctx.drawImage(base, 0, 0);
  ctx.filter = 'none';
  if (f.tintA > 0) {   // voile : silhouette de l'élément remplie de la couleur, mélangée par-dessus
    const t = makeCanvas(base.width, base.height), tc = t.getContext('2d')!;
    tc.fillStyle = f.tint; tc.fillRect(0, 0, t.width, t.height);
    tc.globalCompositeOperation = 'destination-in'; tc.drawImage(out, 0, 0);
    ctx.globalAlpha = f.tintA / 100; ctx.drawImage(t, 0, 0); ctx.globalAlpha = 1;
  }
  return out;
}
