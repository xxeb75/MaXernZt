// Calculs d'animation purs (aucun DOM, aucun Pixi) : trajectoires, images clés de pause, courbes de la timeline.
// Les objets `Anim` et `TL` sont immuables : on les remplace, on ne les modifie jamais (l'historique les compare par référence).
export type Pt = { x: number; y: number };

/** Trajectoire d'un élément ou d'un groupe : points relatifs au centre, durée en secondes. */
/** Image clé : l'élément s'arrête au point `u` (0-1) du trajet pendant `hold` s, tourne de `spin` degrés et, en option, se chiffonne en boule. */
export interface Key { u: number; hold: number; spin: number; ball?: boolean }  // ball : true = se chiffonne, false = se déchiffonne, absent = garde l'état précédent
export interface Anim { pts: Pt[]; dur: number; mode: 'loop' | 'pingpong'; ease: 'linear' | 'smooth'; follow: boolean; keys?: Key[]; turns?: number }   // turns : tours complets sur soi-même par cycle (négatif = sens inverse)

const lenCache = new WeakMap<Anim, number[]>();
export function cum(a: Anim): number[] {
  let c = lenCache.get(a);
  if (!c) { c = [0]; for (let i = 1; i < a.pts.length; i++) c.push(c[i - 1] + Math.hypot(a.pts[i].x - a.pts[i - 1].x, a.pts[i].y - a.pts[i - 1].y)); lenCache.set(a, c); }
  return c;
}
/** Position (relative) et cap au point d'abscisse curviligne `u` (0-1). */
export function pathAt(a: Anim, u: number) {
  const c = cum(a), d = Math.min(Math.max(u, 0), 1) * (c[c.length - 1] || 1);
  let i = 1; while (i < c.length - 1 && c[i] < d) i++;
  const t = (d - c[i - 1]) / ((c[i] - c[i - 1]) || 1), p0 = a.pts[i - 1], p1 = a.pts[i];
  return { x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t, ang: Math.atan2(p1.y - p0.y, p1.x - p0.x) };
}
export const smooth = (t: number) => t * t * (3 - 2 * t);
export const keysOf = (a: Anim): Key[] => a.keys ?? [];
export const totalOf = (a: Anim) => a.dur + keysOf(a).reduce((t, k) => t + k.hold, 0);
/** Début de chaque pause sur la ligne de temps (s). */
/** La feuille est-elle chiffonnée après l'image clé `i` ? */
export function ballAfter(a: Anim, i: number): boolean { let st = false; keysOf(a).slice(0, i + 1).forEach(k => { if (k.ball !== undefined) st = k.ball; }); return st; }
export function keyStarts(a: Anim): number[] {
  let t = 0, cu = 0;
  return keysOf(a).map(k => { t += (k.u - cu) * a.dur; cu = k.u; const st = t; t += k.hold; return st; });
}
/** État à l'instant `time` : avancement `u` sur le trajet, rotation ajoutée (degrés) et taux de chiffonnage (0-1). */
export function evalAnim(a: Anim, time: number) {
  const ks = keysOf(a), tot = totalOf(a);
  let T = time % (a.mode === 'loop' ? tot : tot * 2), fwd = true;
  if (a.mode === 'pingpong' && T > tot) { T = 2 * tot - T; fwd = false; }
  let t = 0, cu = 0, spin = 0, b0 = 0, u = 1, rot = 0, ball = 0, found = false;
  const seg = (to: number) => {
    const d = (to - cu) * a.dur;
    if (!found && T < t + d) { const q = d > 0 ? (T - t) / d : 1; u = cu + (a.ease === 'smooth' ? smooth(q) : q) * (to - cu); rot = spin; ball = b0; found = true; }
    t += d; cu = to;
  };
  for (const k of ks) {
    seg(k.u);
    const tgt = k.ball === undefined ? b0 : k.ball ? 1 : 0;
    if (!found && T < t + k.hold) { const q = k.hold > 0 ? smooth((T - t) / k.hold) : 1; u = k.u; rot = spin + q * k.spin; ball = b0 + q * (tgt - b0); found = true; }
    t += k.hold; spin += k.spin; b0 = tgt;
  }
  seg(1);
  if (!found) { u = 1; rot = spin; ball = b0; }
  const p = pathAt(a, u);
  return { x: p.x, y: p.y, u, ang: fwd ? p.ang : p.ang + Math.PI, rot: rot + (a.turns ?? 0) * 360 * (T / tot), ball };   // rotation continue répartie sur tout le cycle
}


export type KEase = 'linear' | 'smooth' | 'hold';
export interface KF { t: number; v: number; w?: number; e?: KEase }   // w : seconde valeur (y de la position) ; e : interpolation vers l'image clé suivante
export interface TL { pos?: KF[]; rot?: KF[]; scale?: KF[]; crumple?: KF[]; vis?: KF[] }
export type PropId = 'pos' | 'rot' | 'scale' | 'crumple' | 'vis';
export const PROPS: { id: PropId; name: string; icon: string; dv: number; dw: number }[] = [
  { id: 'pos', name: 'Position', icon: 'move', dv: 0, dw: 0 }, { id: 'rot', name: 'Rotation', icon: 'spin', dv: 0, dw: 0 },
  { id: 'scale', name: 'Taille', icon: 'fit', dv: 1, dw: 0 }, { id: 'crumple', name: 'Chiffonnage', icon: 'ball', dv: 0, dw: 0 },
  { id: 'vis', name: 'Visibilité', icon: 'eye', dv: 1, dw: 0 },
];
export const defEase = (p: PropId): KEase => (p === 'vis' ? 'hold' : 'smooth');

export function evalKF(k: KF[] | undefined, t: number, dv: number, dw = 0): { v: number; w: number } {
  if (!k?.length) return { v: dv, w: dw };
  const n = k.length;
  if (t <= k[0].t) return { v: k[0].v, w: k[0].w ?? dw };
  if (t >= k[n - 1].t) return { v: k[n - 1].v, w: k[n - 1].w ?? dw };
  let i = 0; while (i < n - 2 && k[i + 1].t <= t) i++;
  const a = k[i], b = k[i + 1], e = a.e ?? 'smooth';
  let f = (t - a.t) / ((b.t - a.t) || 1);
  if (e === 'hold') f = 0; else if (e === 'smooth') f = smooth(f);
  const aw = a.w ?? dw, bw = b.w ?? dw;
  return { v: a.v + (b.v - a.v) * f, w: aw + (bw - aw) * f };
}
export function evalTL(tl: TL | undefined, t: number) {
  const p = evalKF(tl?.pos, t, 0, 0);
  return { x: p.v, y: p.w, rot: evalKF(tl?.rot, t, 0).v, scale: evalKF(tl?.scale, t, 1).v, crumple: evalKF(tl?.crumple, t, 0).v, vis: evalKF(tl?.vis, t, 1).v };
}
/** Pose (ou met à jour) l'image clé de `prop` à l'instant t. La première image clé posée après 0 s ajoute un départ à la valeur de repos. Renvoie une nouvelle `TL`. */
export function putKeyIn(cur: TL | undefined, prop: PropId, t: number, v: number, w?: number, e?: KEase): TL {
  const tl: TL = { ...(cur ?? {}) }, list = [...(tl[prop] ?? [])];
  const i = list.findIndex(k => Math.abs(k.t - t) < 0.02);
  if (i >= 0) list[i] = { ...list[i], v, ...(w !== undefined ? { w } : {}) };
  else {
    if (!list.length && t > 0.05) { const d = PROPS.find(q => q.id === prop)!; list.push({ t: 0, v: d.dv, ...(prop === 'pos' ? { w: 0 } : {}), e: defEase(prop) }); }
    list.push({ t, v, ...(w !== undefined ? { w } : {}), e: e ?? defEase(prop) });
  }
  list.sort((a, b) => a.t - b.t); tl[prop] = list; return tl;
}
/** Retire l'image clé de `prop` à l'instant t. Renvoie la nouvelle `TL`, ou `undefined` si elle devient vide. */
export function removeKeyIn(cur: TL | undefined, prop: PropId, t: number): TL | undefined {
  const tl: TL = { ...(cur ?? {}) }, list = (tl[prop] ?? []).filter(k => Math.abs(k.t - t) > 1e-6);
  if (list.length) tl[prop] = list; else delete tl[prop];
  return Object.keys(tl).length ? tl : undefined;
}
/** Instants (triés, sans doublon) où la timeline a une image clé. */
export function keyTimesOf(tl: TL | undefined): number[] {
  const out = new Set<number>();
  if (tl) for (const p of PROPS) for (const k of tl[p.id] ?? []) out.add(k.t);
  return [...out].sort((a, b) => a - b);
}
