import { Application, Container, Sprite, Texture, Graphics, BlurFilter, Rectangle } from 'pixi.js';
import { PAD, makeCanvas, bake, trim, jitter } from './sticker';
import { cutoutAI, cutoutFlat, modelAvailable } from './cutout';
import { makeSeparate, makeGrouped, makeOne, FONTS, PALETTES, type LetterOpts, type LetterSpec } from './letters';
import { samAvailable, segment, forget, type SamPoint } from './sam';
import { type Group, type Leaf, type Node, type TNode, isGroup, leavesOf, detach, attach, prune, topNode, lca, childOf, contains, serialize, buildTree } from './groups';

const PW = 1000, PH = 1400; // taille de la feuille
type Pt = { x: number; y: number };

/** Trajectoire d'un élément ou d'un groupe : points relatifs au centre, durée en secondes. */
/** Image clé : l'élément s'arrête au point `u` (0-1) du trajet pendant `hold` s, tourne de `spin` degrés et, en option, se chiffonne en boule. */
interface Key { u: number; hold: number; spin: number; ball: boolean }
interface Anim { pts: Pt[]; dur: number; mode: 'loop' | 'pingpong'; ease: 'linear' | 'smooth'; follow: boolean; keys?: Key[] }
interface BallFx { spr: Sprite; sh: Sprite; fold: Sprite; frames: Texture[]; k: number; sz: number }
interface Layer extends Leaf {
  anim?: Anim; ball?: BallFx; name: string; visible: boolean; base: HTMLCanvasElement; baked: HTMLCanvasElement;
  border: number; shadow: number; rough: number; letter?: LetterSpec;
  box: Container; sprite: Sprite; shade: Sprite;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const status = (s: string) => ($('status').textContent = s);

const app = new Application();
await app.init({ resizeTo: $('stage'), backgroundAlpha: 0, antialias: true, resolution: window.devicePixelRatio, autoDensity: true });
$('stage').appendChild(app.canvas);

const world = new Container();
const paper = new Graphics();
const ui = new Container(); // surcouche (sélection, tracés) en coordonnées écran
const selG = new Graphics(), pathG = new Graphics(), animG = new Graphics();
ui.addChild(animG, selG, pathG);
world.addChild(paper);
app.stage.addChild(world, ui);

let bgColor = '#cfe8e6';
const drawPaper = () => {
  paper.clear();
  for (let i = 8; i >= 1; i--) paper.roundRect(-i * 1.5, 6 - i * 1.5, PW + i * 3, PH + i * 3, 3).fill({ color: 0x000000, alpha: 0.04 });
  paper.rect(0, 0, PW, PH).fill(bgColor);
};
drawPaper();

// ---- vue (zoom / déplacement)
const view = { x: 0, y: 0, s: 1 };
const applyView = () => {
  world.position.set(view.x, view.y); world.scale.set(view.s);
  // la grille du tapis de coupe suit le zoom et le déplacement
  const g = 50 * view.s, m = g < 10 ? g * 5 : g, st = $('stage').style;
  st.backgroundSize = `${m * 5}px ${m * 5}px, ${m * 5}px ${m * 5}px, ${m}px ${m}px, ${m}px ${m}px`;
  st.backgroundPosition = `${view.x}px ${view.y}px`;
  $('zoom').textContent = Math.round(view.s * 100) + '%';
};
function fitView() {
  const r = app.screen; view.s = Math.min((r.width - 40) / PW, (r.height - 40) / PH);
  view.x = (r.width - PW * view.s) / 2; view.y = (r.height - PH * view.s) / 2; applyView();
}
fitView();
app.renderer.on('resize', () => { if (!layers.length) fitView(); });
const toWorld = (sx: number, sy: number): Pt => world.toLocal({ x: sx, y: sy });

// ---- calques
const layers: Layer[] = [];   // ordre d'empilement (arrière → avant), dérivé de l'arbre
const root: Group = { id: 0, name: '', collapsed: false, visible: true, children: [], parent: null };
const selection = new Set<Layer>();
let selected: Layer | null = null, nextId = 1, groupSeq = 1;
function reflow() {
  layers.length = 0;
  const walk = (g: Group) => { for (const c of g.children) { if (isGroup(c)) walk(c); else layers.push(c as Layer); } };
  walk(root);
  layers.forEach((l, i) => world.setChildIndex(l.box, i + 1));
  applyVis();
}
const visOf = (n: Node) => (isGroup(n) ? n.visible : (n as Layer).visible);
/** Visible seulement si le nœud et tous ses groupes le sont. */
const shown = (n: Node) => { for (let c: Node | null = n; c; c = c.parent) if (!visOf(c)) return false; return true; };
function applyVis() { for (const l of layers) l.box.visible = shown(l); }

const texOf = (c: HTMLCanvasElement) => Texture.from(c);

function refresh(l: Layer) {
  const old = l.sprite.texture;
  l.baked = bake(l.base, l.border, l.rough, l.id * 7919 + 13);
  l.sprite.texture = texOf(l.baked);
  l.shade.texture = l.sprite.texture;
  if (old !== Texture.EMPTY) old.destroy(true);
  const cx = l.baked.width / 2, cy = l.baked.height / 2;
  l.box.pivot.set(cx, cy);
  l.sprite.pivot.set(cx, cy); l.sprite.position.set(cx, cy); l.shade.pivot.set(cx, cy);
  if (l.ball) { l.ball.frames.forEach(t => t.destroy(true)); l.ball.fold.destroy(); l.ball.spr.destroy({ texture: true }); l.ball.sh.destroy(); l.ball = undefined; }
  const a = l.shadow / 100;
  l.shade.alpha = 0.55 * a; l.shade.position.set(cx + 6 * a + 2, cy + 9 * a + 2);
  (l.shade.filters as BlurFilter[])[0].strength = 2 + 6 * a;
  l.shade.visible = a > 0;
}

function addLayer(base: HTMLCanvasElement, name: string, at?: { pos: Pt; rot: number; scale: Pt }, opts?: Partial<Pick<Layer, 'border' | 'shadow' | 'rough' | 'id'>>): Layer {
  stopPlay();
  const border = opts?.border ?? +$<HTMLInputElement>('border').value, shadow = opts?.shadow ?? +$<HTMLInputElement>('shadow').value;
  const rough = opts?.rough ?? +$<HTMLInputElement>('rough').value, baked = base;
  const box = new Container(), sprite = new Sprite(Texture.EMPTY), shade = new Sprite(Texture.EMPTY);
  shade.tint = 0x000000; shade.filters = [new BlurFilter({ strength: 4 })];
  box.addChild(shade, sprite);
  if (at) { box.position.set(at.pos.x, at.pos.y); box.rotation = at.rot; box.scale.set(at.scale.x, at.scale.y); }
  else box.position.set(PW / 2 + (Math.random() - 0.5) * 80, PH / 2 + (Math.random() - 0.5) * 80);
  world.addChild(box);
  const l: Layer = { id: opts?.id ?? nextId++, parent: root, name, visible: true, base, baked, border, shadow, rough, box, sprite, shade };
  root.children.push(l); layers.push(l); refresh(l); select(l);
  return l;
}

function setSelection(ls: Layer[], primary?: Layer) {
  selection.clear(); ls.forEach(x => selection.add(x));
  selected = primary && selection.has(primary) ? primary : ls[ls.length - 1] ?? null;
  const l = selected;
  if (l) { $<HTMLInputElement>('border').value = String(l.border); $<HTMLInputElement>('shadow').value = String(l.shadow); $<HTMLInputElement>('rough').value = String(l.rough); }
}
const select = (l: Layer | null) => setSelection(l ? [l] : [], l ?? undefined);
/** Place un nœud au premier plan de son groupe. */
const toTop = (n: Node) => { const p = n.parent!; detach(n); attach(n, p); reflow(); };
/** Place `n` juste au-dessus de `ref`, dans le même groupe. */
const placeAbove = (n: Layer, ref: Layer) => { detach(n); attach(n, ref.parent, ref.parent.children.indexOf(ref) + 1); reflow(); };
function removeLayer(l: Layer) {
  const p = l.parent; detach(l); prune(p); selection.delete(l);
  const i = layers.indexOf(l); if (i >= 0) layers.splice(i, 1);
  l.box.destroy({ children: true, texture: true });
  if (selected === l) { const rest = [...selection]; if (rest.length) setSelection(rest); else select(layers[layers.length - 1] ?? null); }
}

/** Point en pixels du canvas « baked » d'un calque → coordonnées monde. */
const layerToWorld = (l: Layer, q: Pt): Pt => world.toLocal(l.box.toGlobal(q));
const worldToLayer = (l: Layer, p: Pt): Pt => l.box.toLocal(p, world);

function hit(l: Layer, p: Pt): boolean {
  const q = worldToLayer(l, p);
  const x = Math.floor(q.x), y = Math.floor(q.y);
  if (!l.box.visible) return false;
  if (x < 0 || y < 0 || x >= l.baked.width || y >= l.baked.height) return false;
  return l.baked.getContext('2d')!.getImageData(x, y, 1, 1).data[3] > 20;
}

// ---- historique (annuler / rétablir) : instantanés légers, les canvas de base sont immuables
interface LState { id: number; name: string; visible: boolean; anim?: Anim; base: HTMLCanvasElement; border: number; shadow: number; rough: number; letter?: LetterSpec; x: number; y: number; rot: number; sx: number; sy: number }
interface Snap { layers: LState[]; bg: string; tree: TNode[]; sel: number[] }
const snap = (): Snap => ({
  layers: layers.map(l => ({ id: l.id, name: l.name, visible: l.visible, anim: l.anim, base: l.base, border: l.border, shadow: l.shadow, rough: l.rough, letter: l.letter, x: restPose.get(l)?.x ?? l.box.x, y: restPose.get(l)?.y ?? l.box.y, rot: restPose.get(l)?.r ?? l.box.rotation, sx: l.box.scale.x, sy: l.box.scale.y })),
  bg: bgColor, tree: serialize(root), sel: [...selection].filter(l => l !== selected).concat(selected ? [selected] : []).map(l => l.id),
});
const sameSnap = (a: Snap, b: Snap) => a.bg === b.bg && a.layers.length === b.layers.length && JSON.stringify(a.tree) === JSON.stringify(b.tree) &&
  a.layers.every((u, i) => { const v = b.layers[i]; return u.id === v.id && u.name === v.name && u.visible === v.visible && u.anim === v.anim && u.base === v.base && u.border === v.border && u.shadow === v.shadow && u.rough === v.rough && u.letter === v.letter && u.x === v.x && u.y === v.y && u.rot === v.rot && u.sx === v.sx && u.sy === v.sy; });
const hist: Snap[] = []; let hi = -1, soon = 0;
function updHistUI() { ($('btn-undo') as HTMLButtonElement).disabled = hi <= 0; ($('btn-redo') as HTMLButtonElement).disabled = hi >= hist.length - 1; }
function commit() {
  clearTimeout(soon);
  const s = snap();
  if (hi >= 0 && sameSnap(hist[hi], s)) return;
  hist.length = hi + 1; hist.push(s);
  if (hist.length > 60) hist.shift();
  hi = hist.length - 1; dirty = true; updHistUI();
}
const commitSoon = () => { clearTimeout(soon); soon = window.setTimeout(commit, 400); };
function restore(s: Snap) {
  samClear();
  const want = new Set(s.layers.map(x => x.id));
  for (const l of [...layers]) if (!want.has(l.id)) removeLayer(l);
  const byId = new Map(layers.map(l => [l.id, l]));
  const ordered: Layer[] = [];
  for (const st of s.layers) {
    let l = byId.get(st.id);
    if (!l) l = addLayer(st.base, st.name, { pos: { x: st.x, y: st.y }, rot: st.rot, scale: { x: st.sx, y: st.sy } }, { border: st.border, shadow: st.shadow, rough: st.rough, id: st.id });
    else {
      const dirty = l.base !== st.base || l.border !== st.border || l.shadow !== st.shadow || l.rough !== st.rough;
      if (l.base !== st.base) forget(l.base);
      l.base = st.base; l.border = st.border; l.shadow = st.shadow; l.rough = st.rough; l.name = st.name;
      l.box.position.set(st.x, st.y); l.box.rotation = st.rot; l.box.scale.set(st.sx, st.sy);
      if (dirty) refresh(l);
    }
    l.letter = st.letter; l.visible = st.visible !== false; l.anim = st.anim;
    ordered.push(l);
  }
  root.children = [];
  const byId2 = new Map(ordered.map(l => [l.id, l]));
  buildTree(s.tree, root, id => byId2.get(id), (id, name, collapsed, visible, anim) => { groupSeq = Math.max(groupSeq, id + 1); return { id, name, collapsed, visible, anim, children: [], parent: root }; });
  for (const l of ordered) if (!l.parent || !hasAncestorRoot(l)) attach(l, root);
  reflow();
  bgColor = s.bg; drawPaper(); $<HTMLInputElement>('bg').value = bgColor;
  const sl = s.sel.map(id => byId2.get(id)).filter((x): x is Layer => !!x);
  setSelection(sl, sl[sl.length - 1]);
}
function hasAncestorRoot(l: Layer) { let g: Group | null = l.parent; while (g) { if (g === root) return l.parent.children.includes(l); g = g.parent; } return false; }
function undo() { stopPlay(); if (hi > 0) { hi--; restore(hist[hi]); updHistUI(); status('Annulé.'); } }
function redo() { stopPlay(); if (hi < hist.length - 1) { hi++; restore(hist[hi]); updHistUI(); status('Rétabli.'); } }
$('btn-undo').onclick = undo; $('btn-redo').onclick = redo;

// ---- import
const MAX_SIDE = 1200;
async function importFile(f: File) {
  const bmp = await createImageBitmap(f);
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const c = makeCanvas(bmp.width * k, bmp.height * k);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  const l = addLayer(c, f.name);
  l.box.scale.set(Math.min(1, 520 / Math.max(c.width, c.height)));
  commit();
  status(`Importé : ${f.name} (${c.width}×${c.height}). Clique « Détourer ».`);
}
const importAll = async (fl: FileList | File[]) => { for (const f of Array.from(fl)) { if (/\.maxernzt$/i.test(f.name)) await loadProject(f); else if (f.type.startsWith('image/')) await importFile(f); } };
$('btn-import').onclick = () => $<HTMLInputElement>('file').click();
$<HTMLInputElement>('file').onchange = e => { const i = e.target as HTMLInputElement; importAll(i.files!); i.value = ''; };
addEventListener('dragover', e => { e.preventDefault(); if (e.dataTransfer?.types.includes('Files')) document.body.classList.add('drop'); });
addEventListener('dragleave', () => document.body.classList.remove('drop'));
addEventListener('drop', e => { e.preventDefault(); document.body.classList.remove('drop'); if (e.dataTransfer) importAll(e.dataTransfer.files); });
addEventListener('paste', e => { if (e.clipboardData) importAll(e.clipboardData.files); });

// ---- détourage
/** Remplace la base d'un calque en gardant l'image à la même place (x0,y0 = décalage de la nouvelle base dans l'ancienne). */
function setBase(l: Layer, nb: HTMLCanvasElement, x0: number, y0: number) {
  const pivNew: Pt = { x: nb.width / 2 + PAD, y: nb.height / 2 + PAD };
  const pos = layerToWorld(l, { x: pivNew.x + x0, y: pivNew.y + y0 });
  forget(l.base); l.base = nb; l.letter = undefined; l.box.position.set(pos.x, pos.y); refresh(l);
}
function replaceBase(l: Layer, nb: HTMLCanvasElement) {
  const t = trim(nb); if (!t) { status('Rien ne reste après le détourage.'); return; }
  setBase(l, t.canvas, t.x, t.y); commit();
}
$('btn-ai').onclick = async () => {
  if (!selected) return status('Sélectionne d\'abord une image.');
  if (!(await modelAvailable())) return status('Modèle IA absent : place u2netp.onnx dans public/models/ (voir README). En attendant, utilise « fond uni ».');
  const l = selected; status('Détourage IA en cours…');
  try { replaceBase(l, await cutoutAI(l.base)); status('Détourage IA terminé.'); }
  catch (e) { status('Erreur IA : ' + (e as Error).message); }
};
$('btn-flat').onclick = () => {
  if (!selected) return status('Sélectionne d\'abord une image.');
  replaceBase(selected, cutoutFlat(selected.base, +$<HTMLInputElement>('tol').value));
  status('Fond retiré (ajuste la tolérance si besoin).');
};

// ---- ciseaux / déchirure
type Tool = 'move' | 'scissors' | 'tear' | 'sam' | 'path';
let tool: Tool = 'move';
function setTool(t: Tool) {
  tool = tool === t ? 'move' : t;
  if (tool !== 'sam') samClear();
  $('btn-select').classList.toggle('on', tool === 'move');
  $('btn-sam').classList.toggle('on', tool === 'sam');
  $('btn-path').classList.toggle('on', tool === 'path');
  $('btn-scissors').classList.toggle('on', tool === 'scissors'); $('btn-tear').classList.toggle('on', tool === 'tear');
  app.canvas.style.cursor = tool === 'move' ? 'default' : 'crosshair';
  if (tool === 'sam') { status("Clique sur l'objet à détourer."); return; }
  if (tool === 'path') { status(selection.size ? "Dessine la trajectoire en partant de l'élément." : "Sélectionne d'abord un élément ou un groupe."); return; }
  if (tool !== 'move') status(selected ? (tool === 'scissors' ? 'Trace le contour à découper.' : 'Trace une ligne à travers l\'image pour la déchirer.') : 'Sélectionne d\'abord une image.');
}
$('btn-sam').onclick = async () => {
  if (tool !== 'sam' && !(await samAvailable())) return status('Modèles MobileSAM absents de public/models/ (voir README).');
  setTool('sam');
};
$('btn-select').onclick = () => { if (tool !== 'move') setTool(tool); };
$('btn-path').onclick = () => setTool('path');
$('btn-scissors').onclick = () => setTool('scissors');
$('btn-tear').onclick = () => setTool('tear');

/** Découpe `l` selon un masque (alpha dessiné par `fillMask`, en pixels de la base) : crée le morceau et retire cette zone de l'original. */
function cutMask(l: Layer, fillMask: (c: CanvasRenderingContext2D) => void): Layer | null {
  const { width: w, height: h } = l.base;
  const mask = makeCanvas(w, h); fillMask(mask.getContext('2d')!);
  const piece = makeCanvas(w, h), pc = piece.getContext('2d')!;
  pc.drawImage(l.base, 0, 0); pc.globalCompositeOperation = 'destination-in'; pc.drawImage(mask, 0, 0);
  const t = trim(piece); if (!t) return null;
  const nl = addLayer(t.canvas, l.name + '-morceau', { pos: { x: 0, y: 0 }, rot: l.box.rotation, scale: { x: l.box.scale.x, y: l.box.scale.y } }, { border: l.border, shadow: l.shadow, rough: l.rough });
  const pos = layerToWorld(l, { x: nl.baked.width / 2 + t.x, y: nl.baked.height / 2 + t.y });
  nl.box.position.set(pos.x, pos.y); placeAbove(nl, l);
  const hole = makeCanvas(w, h), hc = hole.getContext('2d')!;
  hc.drawImage(l.base, 0, 0); hc.globalCompositeOperation = 'destination-out'; hc.drawImage(mask, 0, 0);
  const tt = trim(hole);
  if (tt) setBase(l, tt.canvas, tt.x, tt.y); else removeLayer(l);
  return nl;
}

/** Découpe `l` selon un polygone (coordonnées monde). */
function cutPolygon(l: Layer, polyW: Pt[]): Layer | null {
  const poly = polyW.map(p => { const q = worldToLayer(l, p); return { x: q.x - PAD, y: q.y - PAD }; });
  return cutMask(l, c => { c.beginPath(); poly.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.closePath(); c.fillStyle = '#000'; c.fill(); });
}

// ---- détourage au clic (MobileSAM)
interface SamState { layer: Layer; base: HTMLCanvasElement; pts: SamPoint[]; mask: HTMLCanvasElement | null; overlay: Sprite | null; busy: boolean }
let sam: SamState | null = null;
function samClear() { if (sam?.overlay) { sam.overlay.destroy({ texture: true }); } sam = null; }
async function samClick(l: Layer, p: Pt, label: 0 | 1, add: boolean) {
  if (sam?.busy) return;
  if (!sam || sam.layer !== l || sam.base !== l.base || (!add && label === 1)) { const keep = sam && sam.layer === l && sam.base === l.base ? sam : null; if (!keep) samClear(); else if (keep.overlay) { keep.overlay.destroy({ texture: true }); keep.overlay = null; } sam = keep ? { ...keep, pts: [], mask: null, overlay: null } : { layer: l, base: l.base, pts: [], mask: null, overlay: null, busy: false }; }
  const st = sam!; st.busy = true;
  const q = worldToLayer(l, p);
  st.pts.push({ x: q.x - PAD, y: q.y - PAD, label });
  status("Analyse de l'image (la première fois, quelques secondes)…");
  try {
    const m = await segment(l.base, st.pts);
    st.mask = m;
    const tint = makeCanvas(m.width, m.height), tc = tint.getContext('2d')!;
    tc.drawImage(m, 0, 0); tc.globalCompositeOperation = 'source-in'; tc.fillStyle = '#00e5ff'; tc.fillRect(0, 0, m.width, m.height);
    st.overlay?.destroy({ texture: true });
    st.overlay = new Sprite(Texture.from(tint)); st.overlay.alpha = 0.55; st.overlay.position.set(PAD, PAD);
    l.box.addChild(st.overlay);
    status('Aperçu : Maj+clic ajoute une zone, Alt+clic en retire une. Entrée = découper, Échap = annuler.');
  } catch (e) { st.pts.pop(); status('Erreur SAM : ' + (e as Error).message); }
  st.busy = false;
}
function samValidate() {
  if (!sam?.mask || sam.busy) return;
  const mask = sam.mask, l = sam.layer; samClear();
  const piece = cutMask(l, c => c.drawImage(mask, 0, 0)); commit();
  status(piece ? 'Objet découpé en nouveau calque.' : 'Masque vide.');
  if (piece) select(piece);
  if (tool === 'sam') setTool('sam');
}

/** Part (0-1) de la surface opaque du calque qui tombe dans le polygone (coordonnées monde). */
function areaFrac(l: Layer, polyW: Pt[]): number {
  const k = 0.1, w = Math.max(1, Math.round(l.base.width * k)), h = Math.max(1, Math.round(l.base.height * k));
  const c = makeCanvas(w, h), ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(l.base, 0, 0, w, h);
  const sum = () => { const d = ctx.getImageData(0, 0, w, h).data; let t = 0; for (let i = 3; i < d.length; i += 4) t += d[i]; return t; };
  const tot = sum(); if (!tot) return 0;
  ctx.globalCompositeOperation = 'destination-in'; ctx.beginPath();
  polyW.forEach((p, i) => { const q = worldToLayer(l, p), x = (q.x - PAD) * k, y = (q.y - PAD) * k; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
  ctx.closePath(); ctx.fillStyle = '#000'; ctx.fill();
  return sum() / tot;
}

/**
 * Coupe le long d'un tracé ouvert, comme une paire de ciseaux qui traverse le papier : les extrémités sont
 * prolongées pour séparer le calque en deux, et la plus petite part devient un nouveau calque (écartée d'un cran).
 */
function splitAlongPath(l: Layer, pts: Pt[], step: number, amp: number, nudge: number): Layer | null {
  const n = pts.length, k = Math.min(6, n - 1);
  const dir = (a: Pt, b: Pt) => { const dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy) || 1; return { x: dx / d, y: dy / d }; };
  const d0 = dir(pts[0], pts[k]), d1 = dir(pts[n - 1], pts[n - 1 - k]), far = 6000;
  const e0 = { x: pts[0].x + d0.x * far, y: pts[0].y + d0.y * far }, e1 = { x: pts[n - 1].x + d1.x * far, y: pts[n - 1].y + d1.y * far };
  const q = [e0, ...jitter(pts, step, amp), e1];
  const cx = e1.x - e0.x, cy = e1.y - e0.y, cl = Math.hypot(cx, cy) || 1, nx = -cy / cl, ny = cx / cl;
  const side = (sg: number) => [...q, { x: e1.x + sg * nx * far * 2, y: e1.y + sg * ny * far * 2 }, { x: e0.x + sg * nx * far * 2, y: e0.y + sg * ny * far * 2 }];
  const pa = side(1), pb = side(-1), fa = areaFrac(l, pa);
  const sg = fa <= 0.5 ? 1 : -1, f = sg === 1 ? fa : areaFrac(l, pb);
  if (f < 0.003) return null;
  const piece = cutPolygon(l, sg === 1 ? pa : pb);
  if (piece) piece.box.position.set(piece.box.x + sg * nx * nudge, piece.box.y + sg * ny * nudge);
  return piece;
}

let discardScraps = false;
try { discardScraps = localStorage.getItem('maxernzt.discard') === '1'; } catch { /* stockage indisponible */ }
const syncScrap = () => $('btn-scrap').classList.toggle('on', discardScraps);
$('btn-scrap').onclick = () => { discardScraps = !discardScraps; try { localStorage.setItem('maxernzt.discard', discardScraps ? '1' : '0'); } catch { /* ignoré */ } syncScrap(); };
syncScrap();

function finishPath(screenPts: Pt[]) {
  if (tool === 'path') { finishAnimPath(screenPts); return; }
  const l = selected; if (!l || screenPts.length < 3) return;
  const pts = screenPts.map(p => toWorld(p.x, p.y));
  let piece: Layer | null, keepTool = false;
  if (tool === 'scissors') {
    const len = pts.reduce((t, p, i) => t + (i ? Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) : 0), 0);
    const gap = Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y);
    if (gap * view.s < 30 || gap < len * 0.12) { // boucle fermée : on découpe l'intérieur
      piece = cutPolygon(l, jitter([...pts, pts[0]], 6 / view.s, 1.5 / view.s));
      status(piece ? 'Morceau découpé : déplace-le.' : 'Rien dans la zone tracée.');
    } else { // tracé ouvert : le papier est coupé en deux ; on garde les ciseaux et le plus gros morceau pour couper encore
      piece = splitAlongPath(l, pts, 6 / view.s, 1.2 / view.s, 8 / view.s);
      keepTool = true;
      if (piece && discardScraps) { removeLayer(piece); piece = null; status('Coupé : chute jetée. Continue de couper, ou Échap.'); }
      else status(piece ? 'Coupé : deux morceaux. Continue de couper, ou Échap.' : "Le tracé ne traverse pas l'image.");
    }
  } else {
    piece = splitAlongPath(l, pts, 5, 7, 14);
    status(piece ? 'Déchiré : la plus petite part est sélectionnée.' : "Le tracé ne traverse pas l'image.");
  }
  commit();
  if (keepTool) { select(layers.includes(l) ? l : layers[layers.length - 1] ?? null); return; }
  if (piece) select(piece);
  setTool(tool);
}

// ---- boutons calque
const need = () => selected ?? (status('Sélectionne un calque.'), null);
const fullySel = (g: Group) => { const ls = leavesOf(g); return ls.length > 0 && ls.every(x => selection.has(x as Layer)); };
/** Les plus grands nœuds entièrement sélectionnés (un groupe complet compte pour un seul), dans l'ordre de l'arbre. */
function selectedNodes(): Node[] {
  const out: Node[] = [];
  const walk = (g: Group) => { for (const c of g.children) { if (!isGroup(c)) { if (selection.has(c as Layer)) out.push(c); } else if (fullySel(c)) out.push(c); else walk(c); } };
  walk(root);
  return out;
}
$('btn-del').onclick = () => { if (!selection.size) { status('Sélectionne un calque.'); return; } [...selection].forEach(removeLayer); setSelection([]); commit(); };

function cloneNode(n: Node, parent: Group, dx: number, dy: number, out: Layer[]): Node {
  if (isGroup(n)) {
    const g: Group = { id: groupSeq++, name: n.name, collapsed: n.collapsed, visible: n.visible, anim: n.anim, children: [], parent };
    parent.children.push(g); n.children.forEach(c => cloneNode(c, g, dx, dy, out)); return g;
  }
  const l = n as Layer;
  const nl = addLayer(l.base, l.name, { pos: { x: l.box.x + dx, y: l.box.y + dy }, rot: l.box.rotation, scale: { x: l.box.scale.x, y: l.box.scale.y } }, { border: l.border, shadow: l.shadow, rough: l.rough });
  nl.letter = l.letter; nl.visible = l.visible; nl.anim = l.anim; detach(nl); attach(nl, parent); out.push(nl);
  return nl;
}
$('btn-dup').onclick = () => {
  const nodes = selectedNodes(); if (!nodes.length) { status('Sélectionne un calque.'); return; }
  const fresh: Layer[] = [];
  for (const n of nodes) {
    const tmp: Group = { id: -1, name: '', collapsed: false, visible: true, children: [], parent: null };
    const copy = cloneNode(n, tmp, 30, 30, fresh);
    tmp.children = []; copy.parent = null;
    if (isGroup(copy)) copy.name += ' copie'; else (copy as Layer).name += '-copie';
    const p = n.parent!; attach(copy, p, p.children.indexOf(n) + 1);
  }
  reflow(); setSelection(fresh); commit();
};

/** Centre de la sélection en coordonnées monde (calque seul : son centre ; sinon centre de la boîte englobante). */
function selCenterWorld(): Pt {
  if (selection.size === 1) { const l = [...selection][0]; return { x: l.box.x, y: l.box.y }; }
  const b = selBounds(); return toWorld((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);
}
$('btn-flip').onclick = () => {
  if (!selection.size) { status('Sélectionne un calque.'); return; }
  if (selection.size === 1) [...selection][0].box.scale.x *= -1;
  else { const c = selCenterWorld(); for (const l of selection) { l.box.x = 2 * c.x - l.box.x; l.box.scale.x *= -1; l.box.rotation = -l.box.rotation; } }
  commit();
};
function moveNodes(dir: 1 | -1) {
  const nodes = selectedNodes(); if (!nodes.length) { status('Sélectionne un calque.'); return; }
  const byParent = new Map<Group, Node[]>();
  nodes.forEach(n => byParent.set(n.parent!, [...(byParent.get(n.parent!) ?? []), n]));
  for (const [p, ns] of byParent) {
    const ch = p.children, idxs = ns.map(n => ch.indexOf(n)).sort((x, y) => (dir > 0 ? y - x : x - y));
    for (const i of idxs) { const j = i + dir; if (j < 0 || j >= ch.length || ns.includes(ch[j])) continue; [ch[i], ch[j]] = [ch[j], ch[i]]; }
  }
  reflow(); commit();
}
$('btn-up').onclick = () => moveNodes(1);
$('btn-down').onclick = () => moveNodes(-1);

function groupSelection() {
  const nodes = selectedNodes(); if (!nodes.length) { status('Sélectionne des éléments à grouper.'); return; }
  if (nodes.length === 1 && isGroup(nodes[0])) { status('Déjà un groupe : sélectionne plusieurs éléments.'); return; }
  const A = lca(nodes);
  const tops = [...new Set(nodes.map(n => childOf(A, n)))].sort((x, y) => A.children.indexOf(x) - A.children.indexOf(y));
  const at = A.children.indexOf(tops[tops.length - 1]) - (tops.length - 1);
  const g: Group = { id: groupSeq, name: 'Groupe ' + groupSeq, collapsed: false, visible: true, children: [], parent: A };
  groupSeq++;
  tops.forEach(detach); attach(g, A, at); tops.forEach(n => attach(n, g));
  reflow(); setSelection(leavesOf(g) as Layer[]); commit(); status(`« ${g.name} » créé.`);
}
function ungroupSelection() {
  const gs = new Set<Group>();
  for (const n of selectedNodes()) if (isGroup(n)) gs.add(n);
  if (!gs.size && selected && selected.parent !== root) gs.add(selected.parent);
  if (!gs.size) { status('Aucun groupe sélectionné.'); return; }
  for (const g of gs) { const p = g.parent!, i = p.children.indexOf(g), kids = [...g.children]; detach(g); kids.forEach((c, k) => attach(c, p, i + k)); g.children = []; }
  reflow(); commit(); status('Groupe dissocié.');
}
$('btn-group').onclick = groupSelection;
$('btn-ungroup').onclick = ungroupSelection;

const eachSel = (f: (l: Layer) => void) => { selection.forEach(f); commitSoon(); };
$<HTMLInputElement>('border').oninput = e => { const v = +(e.target as HTMLInputElement).value; eachSel(l => { l.border = v; refresh(l); }); };
$<HTMLInputElement>('rough').oninput = e => { const v = +(e.target as HTMLInputElement).value; eachSel(l => { l.rough = v; refresh(l); }); };
$<HTMLInputElement>('shadow').oninput = e => { const v = +(e.target as HTMLInputElement).value; eachSel(l => { l.shadow = v; refresh(l); }); };
$<HTMLInputElement>('bg').oninput = e => { bgColor = (e.target as HTMLInputElement).value; drawPaper(); commitSoon(); };

const textPop = $('textpop');
let editing: Layer | null = null, loBackup: typeof lo | null = null, seedBackup = 0;
function closeTextPop() {
  textPop.classList.remove('open', 'editing'); $('btn-text').classList.remove('on');
  if (editing) { // retour aux réglages d'avant la modification
    editing = null; if (loBackup) Object.assign(lo, loBackup); letterSeed = seedBackup; loBackup = null;
    const w = $<HTMLInputElement>('word'); w.maxLength = 24; w.value = ''; syncLetterUI();
  }
}
$('btn-text').onclick = () => {
  if (textPop.classList.contains('open')) { closeTextPop(); return; }
  const open = textPop.classList.toggle('open'); $('btn-text').classList.toggle('on', open);
  if (open) { $<HTMLInputElement>('word').focus(); renderPreview(); status('Tape un mot, Entrée pour l\'ajouter.'); }
};
$('word').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-word').click(); else if (e.key === 'Escape') closeTextPop(); });
$('empty').onclick = () => $<HTMLInputElement>('file').click();
$('btn-fit').onclick = () => fitView();
// ---- lettres : options (papier commun ou séparé, police, couleurs, bords, état)
type Mode = 'grouped' | 'separate';
const LS_KEY = 'maxernzt.letters';
const lo = (() => {
  const d = { mode: 'separate' as Mode, font: 'mix', palette: 'mix', paper: '#e7a29a', ink: '#1d1d1d', tear: 35, dirt: 20 };
  try { return { ...d, ...JSON.parse(localStorage.getItem(LS_KEY) || '{}') } as typeof d; } catch { return d; }
})();
let letterSeed = (Math.random() * 1e9) | 0;
const letterOpts = (): LetterOpts => ({ font: lo.font, palette: lo.palette, paper: lo.paper, ink: lo.ink, tear: lo.tear, dirt: lo.dirt, seed: letterSeed });
const icon = (id: string) => `<svg class="ic"><use href="#i-${id}"/></svg>`;

function chip(parent: HTMLElement, v: string, tip: string, html: string, cls = '', css = '') {
  const b = document.createElement('button');
  b.className = 'chip ' + cls; b.dataset.v = v; b.dataset.tip = tip; b.dataset.pos = 'top'; b.innerHTML = html; if (css) b.style.cssText = css;
  parent.appendChild(b); return b;
}
const fontBox = $('tp-fonts'), colorBox = $('tp-colors');
chip(fontBox, 'mix', 'Polices mélangées', icon('shuffle'));
for (const f of FONTS) chip(fontBox, f, f, 'Ag', '', `font-family:"${f}"; font-weight:${f === 'Impact' || f === 'Segoe Script' ? 400 : 700}`);
chip(colorBox, 'mix', 'Couleurs mélangées', icon('shuffle'));
for (const q of PALETTES) {
  if (q.paper) chip(colorBox, q.id, q.id, 'A', 'paper', `background:${q.paper}; color:${q.ink}`);
  else chip(colorBox, q.id, q.id === 'decoupe-rouge' ? 'Sans fond, rouge' : 'Sans fond, noir', 'A', 'paper nopaper', `color:${q.ink}`);
}
chip(colorBox, 'custom', 'Mes couleurs', icon('drop'));

function syncLetterUI() {
  fontBox.querySelectorAll<HTMLElement>('.chip').forEach(c => c.classList.toggle('on', c.dataset.v === lo.font));
  colorBox.querySelectorAll<HTMLElement>('.chip').forEach(c => c.classList.toggle('on', c.dataset.v === lo.palette));
  $('tp-mode').querySelectorAll<HTMLElement>('.ib').forEach(c => c.classList.toggle('on', c.dataset.mode === lo.mode));
  $('tp-custom').classList.toggle('show', lo.palette === 'custom');
  $<HTMLInputElement>('tp-paper').value = lo.paper; $<HTMLInputElement>('tp-ink').value = lo.ink;
  for (const [id, key] of [['tp-tear', 'tear'], ['tp-dirt', 'dirt']] as const) {
    const r = $<HTMLInputElement>(id); r.value = String(lo[key]); r.style.setProperty('--p', lo[key] + '%'); $('v-' + id).textContent = String(lo[key]);
  }
}
function renderPreview() {
  const cvp = $<HTMLCanvasElement>('tp-preview'), c = cvp.getContext('2d')!;
  c.clearRect(0, 0, cvp.width, cvp.height);
  const word = $<HTMLInputElement>('word').value.trim() || 'Aa';
  const items = lo.mode === 'grouped' ? [makeGrouped(word, letterOpts(), 130)] : makeSeparate(word, letterOpts(), 130);
  const gap = lo.mode === 'grouped' ? 0 : -6, total = items.reduce((t, i) => t + i.width + gap, 0) - gap, maxH = Math.max(...items.map(i => i.height));
  const k = Math.min(1, (cvp.width - 40) / total, (cvp.height - 24) / maxH);
  let x = (cvp.width - total * k) / 2;
  for (const it of items) { c.drawImage(it, x, (cvp.height - it.height * k) / 2, it.width * k, it.height * k); x += (it.width + gap) * k; }
}
function applyEdit() {
  const l = editing; if (!l?.letter) return;
  const text = $<HTMLInputElement>('word').value || l.letter.text, o = letterOpts();
  const c = l.letter.mode === 'grouped' ? makeGrouped(text, o, 130) : makeOne([...text][0], o, l.letter.idx, 130);
  forget(l.base); l.base = c; l.letter = { ...l.letter, text, o }; refresh(l); commitSoon();
}
function letterChanged() {
  if (!editing) { try { localStorage.setItem(LS_KEY, JSON.stringify(lo)); } catch { /* stockage indisponible */ } }
  syncLetterUI(); renderPreview(); applyEdit();
}
/** Double-clic sur une lettre : réglages du panneau = ceux de la lettre, modifiés en direct. */
function openLetterEdit(l: Layer) {
  const sp = l.letter; if (!sp) return;
  closeTextPop();
  editing = l; loBackup = { ...lo }; seedBackup = letterSeed;
  Object.assign(lo, { mode: sp.mode, font: sp.o.font, palette: sp.o.palette, paper: sp.o.paper, ink: sp.o.ink, tear: sp.o.tear, dirt: sp.o.dirt });
  letterSeed = sp.o.seed;
  const w = $<HTMLInputElement>('word'); w.maxLength = sp.mode === 'grouped' ? 24 : 1; w.value = sp.text;
  textPop.classList.add('open', 'editing'); $('btn-text').classList.add('on');
  syncLetterUI(); renderPreview(); status('Modification de la lettre en direct. ✓ pour terminer.');
}
fontBox.addEventListener('click', e => { const c = (e.target as HTMLElement).closest<HTMLElement>('.chip'); if (c) { lo.font = c.dataset.v!; letterChanged(); } });
colorBox.addEventListener('click', e => { const c = (e.target as HTMLElement).closest<HTMLElement>('.chip'); if (c) { lo.palette = c.dataset.v!; letterChanged(); } });
$('tp-mode').addEventListener('click', e => { const c = (e.target as HTMLElement).closest<HTMLElement>('.ib'); if (c) { lo.mode = c.dataset.mode as Mode; letterChanged(); } });
$('tp-tear').oninput = e => { lo.tear = +(e.target as HTMLInputElement).value; letterChanged(); };
$('tp-dirt').oninput = e => { lo.dirt = +(e.target as HTMLInputElement).value; letterChanged(); };
$('tp-paper').oninput = e => { lo.paper = (e.target as HTMLInputElement).value; letterChanged(); };
$('tp-ink').oninput = e => { lo.ink = (e.target as HTMLInputElement).value; letterChanged(); };
$('word').addEventListener('input', () => { renderPreview(); applyEdit(); });
$('tp-dice').onclick = () => { letterSeed = (Math.random() * 1e9) | 0; renderPreview(); applyEdit(); };
syncLetterUI();

$('btn-word').onclick = () => {
  if (editing) { commit(); closeTextPop(); status('Lettre modifiée.'); return; }
  const word = $<HTMLInputElement>('word').value.trim(); if (!word) return;
  const o = letterOpts();
  if (lo.mode === 'grouped') {
    const c = makeGrouped(word, o, 130), sc = Math.min(1, (PW - 80) / c.width);
    addLayer(c, word, { pos: { x: PW / 2, y: PH / 2 + (Math.random() - 0.5) * 100 }, rot: (Math.random() - 0.5) * 0.06, scale: { x: sc, y: sc } }).letter = { text: word, mode: 'grouped', idx: 0, o };
  } else {
    const chars = [...word].filter(ch => ch.trim()), letters = makeSeparate(word, o, 130);
    const total = letters.reduce((t, c) => t + c.width - 6, 0), sc = Math.min(1, (PW - 80) / total);
    let x = PW / 2 - (total * sc) / 2;
    const y = PH / 2 + (Math.random() - 0.5) * 100;
    letters.forEach((c, i) => {
      addLayer(c, 'lettre-' + chars[i], { pos: { x: x + (c.width / 2) * sc, y: y + (Math.random() - 0.5) * 22 }, rot: (Math.random() - 0.5) * 0.35, scale: { x: sc, y: sc } }).letter = { text: chars[i], mode: 'separate', idx: i, o };
      x += (c.width - 6) * sc;
    });
  }
  letterSeed = (Math.random() * 1e9) | 0;
  commit(); closeTextPop(); $<HTMLInputElement>('word').value = '';
  status(lo.mode === 'grouped' ? `« ${word} » ajouté sur un seul papier.` : `« ${word} » ajouté : une lettre par calque.`);
};

// ---- export
function extractPaper(): HTMLCanvasElement {
  const save = { ...view };
  world.position.set(0, 0); world.scale.set(1); ui.visible = false;
  const c = app.renderer.extract.canvas({ target: world, frame: new Rectangle(0, 0, PW, PH), resolution: 1 }) as HTMLCanvasElement;
  view.x = save.x; view.y = save.y; view.s = save.s; applyView(); ui.visible = true;
  return c;
}
function download(blob: Blob | null, name: string) {
  if (!blob) return;
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.style.display = 'none';
  document.body.appendChild(a); a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(a.href); }, 120000); // un gros fichier ne doit pas perdre son URL en cours de téléchargement
}
$('btn-export').onclick = () => { stopPlay(); extractPaper().toBlob(b => download(b, 'collage.png')); };
$('btn-export-layers').onclick = async () => {
  stopPlay();
  const name = (l: Layer, z: number) => `${String(z).padStart(2, '0')}_${l.name.replace(/\W+/g, '_')}.png`;
  const groupPath = (l: Layer) => { const names: string[] = []; for (let g: Group | null = l.parent; g && g !== root; g = g.parent) names.unshift(g.name); return names.join('/'); };
  const hier = (g: Group): unknown[] => g.children.map(c => (isGroup(c) ? { group: c.name, anim: animJson(c.anim as Anim | undefined), children: hier(c) } : { layer: name(c as Layer, layers.indexOf(c as Layer)).replace('.png', '') }));
  const manifest = {
    canvas: [PW, PH],
    hierarchy: hier(root),
    layers: layers.map((l, z) => ({
      group: groupPath(l), visible: shown(l), anim: animJson(l.anim),
      name: name(l, z).replace('.png', ''), file: 'layers/' + name(l, z), w: l.baked.width, h: l.baked.height,
      x: Math.round(l.box.x), y: Math.round(l.box.y), rotation: +(l.box.rotation * 180 / Math.PI).toFixed(2),
      scale: [+l.box.scale.x.toFixed(3), +l.box.scale.y.toFixed(3)], z,
    })),
  };
  for (let z = 0; z < layers.length; z++) {
    await new Promise<void>(r => layers[z].baked.toBlob(b => { download(b, name(layers[z], z)); r(); }));
    await new Promise(r => setTimeout(r, 150));
  }
  download(new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' }), 'manifest.json');
  status('Calques exportés (PNG + manifest.json) dans Téléchargements ; range les PNG dans un dossier « layers ».');
};

// ---- projet : sauvegarde / chargement (.maxernzt = JSON, images en PNG base64, partagées si identiques)
let projectName = 'collage', dirty = false;
async function saveProject() {
  stopPlay();
  const ids = new Map<HTMLCanvasElement, string>(), images: Record<string, string> = {};
  const out = layers.map(l => {
    let id = ids.get(l.base);
    if (!id) { id = 'img' + ids.size; ids.set(l.base, id); images[id] = l.base.toDataURL('image/png'); }
    return { id: l.id, name: l.name, visible: l.visible, anim: l.anim, image: id, border: l.border, shadow: l.shadow, rough: l.rough, letter: l.letter, x: l.box.x, y: l.box.y, rotation: l.box.rotation, scaleX: l.box.scale.x, scaleY: l.box.scale.y };
  });
  const blob = new Blob([JSON.stringify({ format: 'maxernzt', version: 2, paper: [PW, PH], bg: bgColor, tree: serialize(root), layers: out, images })], { type: 'application/json' });
  const fileName = projectName + '.maxernzt';
  try {
    const w = window as any;
    let ok = false;
    if (w.showSaveFilePicker) {
      const h = await w.showSaveFilePicker({ suggestedName: fileName, types: [{ description: 'Projet MaXernZt', accept: { 'application/json': ['.maxernzt'] } }] });
      try {
        const ws = await h.createWritable(); await ws.write(blob); await ws.close();
        const written = (await h.getFile()).size;       // le fichier choisi existe déjà : on vérifie qu'il est bien rempli
        if (written !== blob.size) throw new Error(`${written} octets écrits sur ${blob.size}`);
        projectName = String(h.name).replace(/\.maxernzt$/i, ''); ok = true;
      } catch (err) {
        console.error('enregistrement direct impossible', err);
        status("Écriture directe impossible (" + (err as Error).message + ") : téléchargement du fichier à la place.");
      }
    }
    if (!ok) download(blob, fileName);
    dirty = false;
    if (ok) status(`Projet enregistré (${layers.length} calques, ${(blob.size / 1e6).toFixed(1)} Mo).`);
  } catch (e) {
    if ((e as Error).name === 'AbortError') return;
    console.error(e); status("Erreur d'enregistrement : " + (e as Error).message);
    alert("Enregistrement impossible : " + (e as Error).message);
  }
}
const decode = (url: string) => new Promise<HTMLCanvasElement>((res, rej) => {
  const im = new Image(); im.onload = () => { const c = makeCanvas(im.width, im.height); c.getContext('2d')!.drawImage(im, 0, 0); res(c); }; im.onerror = () => rej(new Error('image illisible')); im.src = url;
});
async function loadProject(f: File) {
  stopPlay();
  try {
    const txt = await f.text();
    if (!txt.trim()) throw new Error('le fichier est vide (enregistrement interrompu)');
    const d = JSON.parse(txt);
    if (d.format !== 'maxernzt' || !Array.isArray(d.layers)) throw new Error('fichier non reconnu');
    const imgs = new Map<string, HTMLCanvasElement>();
    for (const [id, url] of Object.entries<string>(d.images)) imgs.set(id, await decode(url));
    const ls: LState[] = d.layers.map((l: any) => ({ id: l.id, name: l.name, visible: l.visible !== false, anim: l.anim, base: imgs.get(l.image)!, border: l.border, shadow: l.shadow, rough: l.rough ?? 60, letter: l.letter, x: l.x, y: l.y, rot: l.rotation, sx: l.scaleX, sy: l.scaleY }));
    nextId = Math.max(nextId, ...ls.map(l => l.id + 1));
    restore({ layers: ls, bg: d.bg ?? bgColor, tree: Array.isArray(d.tree) ? d.tree : ls.map(l => ({ l: l.id })), sel: [] });
    projectName = f.name.replace(/\.(maxernzt|json)$/i, ''); commit(); dirty = false;
    status(`Projet « ${projectName} » ouvert (${ls.length} calques).`);
  } catch (e) { status('Ouverture impossible : ' + (e as Error).message); }
}
$('btn-save').onclick = saveProject;
$('btn-open').onclick = () => $<HTMLInputElement>('file-proj').click();
$<HTMLInputElement>('file-proj').onchange = e => { const i = e.target as HTMLInputElement; if (i.files![0]) loadProject(i.files![0]); i.value = ''; };
$('btn-new').onclick = () => {
  stopPlay();
  if (layers.length && dirty && !confirm('Vider la feuille ? (tu pourras annuler avec Ctrl+Z)')) return;
  restore({ layers: [], bg: bgColor, tree: [], sel: [] }); projectName = 'collage'; commit(); status('Nouvelle feuille.');
};
addEventListener('beforeunload', e => { if (dirty && layers.length) e.preventDefault(); });

// ---- souris
// poignées : coins = taille (proportionnelle), rond au-dessus = rotation (Maj = pas de 15°) ; pour un calque comme pour une sélection
type HandleKind = 'nw' | 'ne' | 'se' | 'sw' | 'rot';
interface Item { l: Layer; x: number; y: number; r: number; sx: number; sy: number }
interface Xf { kind: HandleKind; items: Item[]; cx: number; cy: number; d0: number; a0: number }
const frameOf = (l: Layer) => { const b = l.border * 1.3; return { x0: PAD - b, y0: PAD - b, x1: PAD + l.base.width + b, y1: PAD + l.base.height + b }; };
const frameCorners = (l: Layer): Pt[] => { const f = frameOf(l); return [{ x: f.x0, y: f.y0 }, { x: f.x1, y: f.y0 }, { x: f.x1, y: f.y1 }, { x: f.x0, y: f.y1 }].map(c => l.box.toGlobal(c)); };
function handlePts(l: Layer): Record<HandleKind, Pt> {
  const f = frameOf(l), g = (x: number, y: number) => l.box.toGlobal({ x, y }), mx = (f.x0 + f.x1) / 2;
  const top = g(mx, f.y0), c = g(mx, (f.y0 + f.y1) / 2), dx = top.x - c.x, dy = top.y - c.y, d = Math.hypot(dx, dy) || 1;
  return { nw: g(f.x0, f.y0), ne: g(f.x1, f.y0), se: g(f.x1, f.y1), sw: g(f.x0, f.y1), rot: { x: top.x + (dx / d) * 30, y: top.y + (dy / d) * 30 } };
}
/** Boîte englobante de la sélection, en coordonnées écran. */
function selBounds() {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const l of selection) for (const c of frameCorners(l)) { x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y); x1 = Math.max(x1, c.x); y1 = Math.max(y1, c.y); }
  return { x0, y0, x1, y1 };
}
function selHandles(): Record<HandleKind, Pt> | null {
  if (!selection.size) return null;
  if (selection.size === 1) return handlePts([...selection][0]);
  const b = selBounds();
  return { nw: { x: b.x0, y: b.y0 }, ne: { x: b.x1, y: b.y0 }, se: { x: b.x1, y: b.y1 }, sw: { x: b.x0, y: b.y1 }, rot: { x: (b.x0 + b.x1) / 2, y: b.y0 - 30 } };
}
function hitHandle(p: Pt): HandleKind | null {
  const h = selHandles(); if (!h) return null;
  for (const k of ['rot', 'nw', 'ne', 'se', 'sw'] as HandleKind[]) if (Math.hypot(h[k].x - p.x, h[k].y - p.y) <= 10) return k;
  return null;
}
const HANDLE_CURSOR: Record<HandleKind, string> = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', rot: 'grab' };
const mkItems = (): Item[] => [...selection].map(l => ({ l, x: l.box.x, y: l.box.y, r: l.box.rotation, sx: l.box.scale.x, sy: l.box.scale.y }));
/** Taille et rotation relatives autour du centre de la sélection (molette). */
function applyDelta(k: number, dth: number) {
  const c = selCenterWorld(), cos = Math.cos(dth), sin = Math.sin(dth);
  for (const l of selection) {
    const rx = l.box.x - c.x, ry = l.box.y - c.y;
    l.box.position.set(c.x + (rx * cos - ry * sin) * k, c.y + (rx * sin + ry * cos) * k);
    l.box.scale.set(l.box.scale.x * k, l.box.scale.y * k); l.box.rotation += dth;
  }
}
let xf: Xf | null = null;
let drag: { items: Item[]; sx: number; sy: number; moved: boolean; collapse: Layer[] | null; hit: Layer } | null = null;
let marq: { x0: number; y0: number; x1: number; y1: number; add: boolean } | null = null;
let pan: { sx: number; sy: number; vx: number; vy: number } | null = null, path: Pt[] | null = null;
const cv = app.canvas;
const pos = (e: MouseEvent): Pt => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

function finishMarquee(m: NonNullable<typeof marq>) {
  const x0 = Math.min(m.x0, m.x1), x1 = Math.max(m.x0, m.x1), y0 = Math.min(m.y0, m.y1), y1 = Math.max(m.y0, m.y1);
  if (x1 - x0 < 3 && y1 - y0 < 3) return;
  const found = new Set<Layer>();
  for (const l of layers) {
    const cs = frameCorners(l), ax0 = Math.min(...cs.map(c => c.x)), ax1 = Math.max(...cs.map(c => c.x)), ay0 = Math.min(...cs.map(c => c.y)), ay1 = Math.max(...cs.map(c => c.y));
    if (l.box.visible && ax1 >= x0 && ax0 <= x1 && ay1 >= y0 && ay0 <= y1) found.add(l);
  }
  setSelection([...(m.add ? new Set([...selection, ...found]) : found)]);
}

cv.addEventListener('pointerdown', e => {
  const p = pos(e); cv.setPointerCapture(e.pointerId); closeTextPop();
  if (e.button === 1 || e.button === 2) { pan = { sx: p.x, sy: p.y, vx: view.x, vy: view.y }; return; }
  if (playing) {
    if (paused && hitHandle(p) === 'rot' && activeKey()) { startKeyRot(p); return; }  // en pause sur une image clé : la poignée ronde règle la rotation
    stopPlay();                                                                       // tout autre clic reprend l'édition normale
  }
  if (tool === 'sam') {
    const w = toWorld(p.x, p.y);
    for (let i = layers.length - 1; i >= 0; i--) if (hit(layers[i], w)) { const l = layers[i]; select(l); samClick(l, w, e.altKey ? 0 : 1, e.shiftKey || e.altKey); return; }
    return;
  }
  if (tool !== 'move') { if (!selected) return status('Sélectionne d\'abord une image.'); path = [p]; return; }
  const w = toWorld(p.x, p.y);
  const kind = hitHandle(p);
  if (kind) {
    const c = selCenterWorld();
    xf = { kind, items: mkItems(), cx: c.x, cy: c.y, d0: Math.hypot(w.x - c.x, w.y - c.y) || 1, a0: Math.atan2(w.y - c.y, w.x - c.x) };
    return;
  }
  let hl: Layer | null = null;
  for (let i = layers.length - 1; i >= 0; i--) if (hit(layers[i], w)) { hl = layers[i]; break; }
  if (hl) {
    // clic = l'élément ; Maj+clic = ajouter / retirer ; les groupes se sélectionnent dans le panneau
    const node: Node = hl, ls = [hl];
    if (e.shiftKey) {
      const all = ls.every(x => selection.has(x));
      ls.forEach(x => (all ? selection.delete(x) : selection.add(x)));
      setSelection([...selection], all ? undefined : hl);
      return;
    }
    let collapse: Layer[] | null = null;
    if (!selection.has(hl)) setSelection(ls, hl); else if (selection.size > 1) collapse = ls;
    if (!collapse) toTop(node);
    drag = { items: mkItems(), sx: w.x, sy: w.y, moved: false, collapse, hit: hl };
    return;
  }
  if (!e.shiftKey) setSelection([]);
  marq = { x0: p.x, y0: p.y, x1: p.x, y1: p.y, add: e.shiftKey };
});
cv.addEventListener('pointermove', e => {
  const p = pos(e);
  if (kr) {
    const w = toWorld(p.x, p.y);
    let d = Math.atan2(w.y - kr.cy, w.x - kr.cx) - kr.last; d = Math.atan2(Math.sin(d), Math.cos(d));
    kr.last += d; kr.acc += d;
    let spin = kr.spin0 + (kr.acc * 180) / Math.PI;
    if (e.shiftKey) spin = Math.round(spin / 15) * 15;
    const a = animOf(kr.node);
    if (a) setAnim(kr.node, { ...a, keys: keysOf(a).map((k, i) => (i === kr!.idx ? { ...k, spin: Math.round(spin) } : k)) });
    return;
  }
  if (xf) {
    const w = toWorld(p.x, p.y), single = xf.items.length === 1;
    if (xf.kind === 'rot') {
      let dth = Math.atan2(w.y - xf.cy, w.x - xf.cx) - xf.a0;
      if (e.shiftKey) { const step = Math.PI / 12; dth = single ? Math.round((xf.items[0].r + dth) / step) * step - xf.items[0].r : Math.round(dth / step) * step; }
      const cos = Math.cos(dth), sin = Math.sin(dth);
      for (const it of xf.items) { const rx = it.x - xf.cx, ry = it.y - xf.cy; it.l.box.position.set(xf.cx + rx * cos - ry * sin, xf.cy + rx * sin + ry * cos); it.l.box.rotation = it.r + dth; }
    } else {
      const k = Math.max(0.02, Math.hypot(w.x - xf.cx, w.y - xf.cy) / xf.d0);
      for (const it of xf.items) { it.l.box.position.set(xf.cx + (it.x - xf.cx) * k, xf.cy + (it.y - xf.cy) * k); it.l.box.scale.set(it.sx * k, it.sy * k); }
    }
    return;
  }
  if (!pan && !drag && !path && !marq && tool === 'move') { const k = hitHandle(p); cv.style.cursor = k ? HANDLE_CURSOR[k] : 'default'; }
  if (pan) { view.x = pan.vx + p.x - pan.sx; view.y = pan.vy + p.y - pan.sy; applyView(); }
  else if (drag) {
    const w = toWorld(p.x, p.y), dx = w.x - drag.sx, dy = w.y - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) * view.s < 3) return;
    drag.moved = true; for (const it of drag.items) it.l.box.position.set(it.x + dx, it.y + dy);
  } else if (marq) {
    marq.x1 = p.x; marq.y1 = p.y;
    pathG.clear().rect(Math.min(marq.x0, p.x), Math.min(marq.y0, p.y), Math.abs(p.x - marq.x0), Math.abs(p.y - marq.y0)).fill({ color: 0xf2b134, alpha: 0.12 }).stroke({ width: 1, color: 0xf2b134 });
  } else if (path) { path.push(p); { const f = path.flatMap(q => [q.x, q.y]); pathG.clear().poly(f, false).stroke({ width: 5, color: 0x000000, alpha: 0.55 }).poly(f, false).stroke({ width: 2.2, color: 0xffffff }); } }
});
const end = () => {
  if (kr) { commit(); kr = null; }
  if (xf) { commit(); xf = null; }
  if (drag) { if (!drag.moved && drag.collapse) setSelection(drag.collapse, drag.hit); commit(); drag = null; }
  if (marq) { const m = marq; marq = null; pathG.clear(); finishMarquee(m); }
  if (path) { const pp = path; path = null; pathG.clear(); finishPath(pp); }
  pan = null;
};
cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('dblclick', e => {
  if (tool !== 'move' || playing) return;
  const w = toWorld(pos(e).x, pos(e).y);
  for (let i = layers.length - 1; i >= 0; i--) if (hit(layers[i], w)) { const l = layers[i]; setSelection([l], l); if (l.letter) openLetterEdit(l); return; }
});
cv.addEventListener('wheel', e => {
  e.preventDefault();
  const k = e.deltaY > 0 ? 0.92 : 1 / 0.92;
  if (selection.size && e.altKey) applyDelta(k, 0);
  else if (selection.size && e.shiftKey) applyDelta(1, (e.deltaY > 0 ? 1 : -1) * 0.07);
  else { const p = pos(e), w = toWorld(p.x, p.y); view.s = Math.min(8, Math.max(0.1, view.s * k)); view.x = p.x - w.x * view.s; view.y = p.y - w.y * view.s; applyView(); }
  commitSoon();
}, { passive: false });
addEventListener('keydown', e => {
  const t = e.target as HTMLInputElement, typing = t.tagName === 'INPUT' && t.type === 'text';
  if (e.ctrlKey || e.metaKey) {
    const k = e.key.toLowerCase();
    if (k === 's') { e.preventDefault(); saveProject(); return; }
    if (k === 'd' && selection.size) { e.preventDefault(); $('btn-dup').click(); return; }
    if (k === 'o') { e.preventDefault(); $<HTMLInputElement>('file-proj').click(); return; }
    if (typing) return;
    if (k === 'g') { e.preventDefault(); (e.shiftKey ? ungroupSelection : groupSelection)(); return; }
    if (k === 'a') { e.preventDefault(); setSelection([...layers]); return; }
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); } else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    return;
  }
  if (typing) return;
  const key = e.key.toLowerCase(), click = (id: string) => $(id).click();
  if (e.key === ' ') { e.preventDefault(); click('btn-play'); return; }
  if (key === 'p') { click('btn-path'); return; }
  if (key === 'v') { click('btn-select'); return; }
  if (key === 'a') { click('btn-ai'); return; }
  if (key === 'c') { click('btn-sam'); return; }
  if (key === 'b') { click('btn-flat'); return; }
  if (key === 'x') { click('btn-scissors'); return; }
  if (key === 'r') { click('btn-tear'); return; }
  if (key === 't') { e.preventDefault(); click('btn-text'); return; }
  if (key === '0') { fitView(); return; }
  if (key === ']') { click('btn-up'); return; }
  if (key === '[') { click('btn-down'); return; }
  if ((e.key === 'Delete' || e.key === 'Backspace') && selection.size) click('btn-del');
  if (e.key === 'Enter') samValidate();
  if (e.key === 'Escape') { stopPlay(); samClear(); path = null; marq = null; pathG.clear(); if (tool !== 'move') setTool(tool); }
});

// ---- surcouche de sélection
app.ticker.add(() => {
  selG.clear(); animG.clear();
  if (playing) { if (!paused) animT += app.ticker.deltaMS / 1000; applyAnim(); if (!paused) { syncPanels(); return; } }
  drawAnimPaths();
  if (selection.size > 1) for (const l of selection) { const q = frameCorners(l).flatMap(c => [c.x, c.y]); selG.poly(q).stroke({ width: 1, color: 0xffffff, alpha: 0.7 }); }
  const h = selHandles();
  if (h) {
    const q = [h.nw, h.ne, h.se, h.sw].flatMap(c => [c.x, c.y]);
    selG.poly(q).stroke({ width: 4, color: 0x000000, alpha: 0.5 }).poly(q).stroke({ width: 1.5, color: 0xffffff });
    if (tool === 'move') {
      const top = { x: (h.nw.x + h.ne.x) / 2, y: (h.nw.y + h.ne.y) / 2 };
      selG.moveTo(top.x, top.y).lineTo(h.rot.x, h.rot.y).stroke({ width: 1.5, color: 0xffffff });
      for (const k of ['nw', 'ne', 'se', 'sw'] as const) selG.rect(h[k].x - 5, h[k].y - 5, 10, 10).fill(0xffffff).stroke({ width: 1.5, color: 0x1d1f23 });
      selG.circle(h.rot.x, h.rot.y, 6).fill(0xf2b134).stroke({ width: 1.5, color: 0x1d1f23 });
    }
  }
  syncPanels();
});

// ---- panneaux : calques, valeurs, états
let layersSig = '';
const baseIds = new WeakMap<HTMLCanvasElement, number>(); let baseSeq = 0;
const bid = (c: HTMLCanvasElement) => { let n = baseIds.get(c); if (!n) baseIds.set(c, n = ++baseSeq); return n; };
const thumbs = new WeakMap<HTMLCanvasElement, string>();
function thumbOf(c: HTMLCanvasElement) {
  let u = thumbs.get(c);
  if (!u) { const k = Math.min(1, 68 / c.width, 68 / c.height), t = makeCanvas(c.width * k, c.height * k); t.getContext('2d')!.drawImage(c, 0, 0, t.width, t.height); thumbs.set(c, u = t.toDataURL()); }
  return u;
}
let dragNode: Node | null = null;
function dropOn(target: Node | null) {
  const dn = dragNode; dragNode = null; if (!dn) return;
  const inSel = isGroup(dn) ? fullySel(dn) : selection.has(dn as Layer);
  const moving: Node[] = inSel && selection.size ? selectedNodes() : [dn];
  let parent: Group, ref: Node | null = null;
  if (!target) parent = root; else if (isGroup(target)) parent = target; else { parent = target.parent!; ref = target; }
  if (moving.some(n => isGroup(n) && contains(n, parent))) { status('Un groupe ne peut pas entrer dans lui-même.'); return; }
  if (ref && moving.includes(ref)) return;
  const olds = new Set(moving.map(n => n.parent!));
  moving.forEach(detach);
  let idx = ref ? parent.children.indexOf(ref) + 1 : parent.children.length;
  moving.forEach(n => attach(n, parent, idx++));
  olds.forEach(g => prune(g));
  parent.collapsed = false;
  reflow(); commit();
}
function rename(n: Layer | Group) {
  const v = prompt('Nom', n.name);
  if (v && v.trim()) { n.name = v.trim(); commit(); }
}
function eyeBtn(n: Node): string {
  return `<button class="eye${visOf(n) ? '' : ' off'}" tabindex="-1" aria-label="Afficher / masquer"><svg class="ic"><use href="#i-${visOf(n) ? 'eye' : 'eye-off'}"/></svg></button>`;
}
function wireEye(li: HTMLElement, n: Node) {
  (li.querySelector('.eye') as HTMLElement).onclick = e => {
    e.stopPropagation();
    if (isGroup(n)) n.visible = !n.visible; else (n as Layer).visible = !(n as Layer).visible;
    applyVis(); commit();
  };
}
function pick(e: MouseEvent, ls: Layer[], primary: Layer) {
  if (e.shiftKey || e.ctrlKey || e.metaKey) {
    const all = ls.every(x => selection.has(x));
    ls.forEach(x => (all ? selection.delete(x) : selection.add(x)));
    setSelection([...selection], all ? undefined : primary);
  } else setSelection(ls, primary);
}
function rowBase(n: Node, depth: number, sel: boolean): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'ly' + (sel ? ' sel' : '') + (shown(n) ? '' : ' hid'); li.draggable = true; li.tabIndex = 0; li.style.paddingLeft = 6 + depth * 16 + 'px';
  li.ondragstart = e => { dragNode = n; e.dataTransfer!.setData('text/plain', 'node'); e.dataTransfer!.effectAllowed = 'move'; li.classList.add('dragging'); };
  li.ondragend = () => { li.classList.remove('dragging'); dragNode = null; };
  li.ondragover = e => { if (dragNode) { e.preventDefault(); li.classList.add('over'); } };
  li.ondragleave = () => li.classList.remove('over');
  li.ondrop = e => { e.preventDefault(); e.stopPropagation(); li.classList.remove('over'); dropOn(n); };
  return li;
}
function renderLayers() {
  const list = $('layer-list'); list.innerHTML = '';
  const walk = (g: Group, depth: number) => {
    for (let i = g.children.length - 1; i >= 0; i--) {
      const n = g.children[i];
      if (isGroup(n)) {
        const ls = leavesOf(n) as Layer[], li = rowBase(n, depth, fullySel(n));
        li.classList.add('grp'); li.title = n.name;
        li.innerHTML = `<button class="chev${n.collapsed ? '' : ' open'}" tabindex="-1"><svg class="ic"><use href="#i-chev"/></svg></button><svg class="ic fold"><use href="#i-folder"/></svg><span class="nm"></span><span class="cnt">${ls.length}</span>${eyeBtn(n)}`;
        (li.querySelector('.nm') as HTMLElement).textContent = n.name; wireEye(li, n);
        (li.querySelector('.chev') as HTMLElement).onclick = e => { e.stopPropagation(); n.collapsed = !n.collapsed; };
        li.onclick = e => pick(e, ls, ls[ls.length - 1]);
        li.ondblclick = () => rename(n);
        list.appendChild(li);
        if (!n.collapsed) walk(n, depth + 1);
      } else {
        const l = n as Layer, li = rowBase(l, depth, selection.has(l));
        li.title = l.name; li.innerHTML = '<span class="th"><img alt=""></span><span class="nm"></span>' + eyeBtn(l); wireEye(li, l);
        (li.querySelector('img') as HTMLImageElement).src = thumbOf(l.base); (li.querySelector('.nm') as HTMLElement).textContent = l.name;
        li.onclick = e => pick(e, [l], l);
        li.ondblclick = () => rename(l);
        li.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelection([l], l); } };
        list.appendChild(li);
      }
    }
  };
  walk(root, 0);
  $('lcount').textContent = String(layers.length);
}
$('layer-list').ondragover = e => { if (dragNode) e.preventDefault(); };
$('layer-list').ondrop = e => { e.preventDefault(); dropOn(null); };
const treeSig = (g: Group): string => g.children.map(c => (isGroup(c) ? `[${c.id}:${c.name}:${c.collapsed ? 1 : 0}:${c.visible ? 1 : 0}:${fullySel(c) ? 1 : 0}${treeSig(c)}]` : `${c.id}:${(c as Layer).name}:${(c as Layer).visible ? 1 : 0}:${bid((c as Layer).base)}${selection.has(c as Layer) ? '*' : ''}`)).join(',');
function syncPanels() {
  const sig = treeSig(root);
  if (sig !== layersSig) { layersSig = sig; renderLayers(); }
  $('empty').classList.toggle('gone', layers.length > 0);
  $('opts').classList.toggle('nosel', !selection.size);
  syncAnimBar();
  for (const [id, out] of [['border', 'v-border'], ['rough', 'v-rough'], ['shadow', 'v-shadow'], ['tol', 'v-tol']]) {
    const r = $<HTMLInputElement>(id), v = +r.value, mn = +r.min, mx = +r.max;
    r.style.setProperty('--p', ((v - mn) / (mx - mn)) * 100 + '%'); $(out).textContent = String(v);
  }
}

// ---- animation : une trajectoire par élément ou par groupe
const animOf = (n: Node): Anim | undefined => (isGroup(n) ? (n.anim as Anim | undefined) : (n as Layer).anim);
function setAnim(n: Node, a: Anim | undefined) { if (isGroup(n)) n.anim = a; else (n as Layer).anim = a; }
const animJson = (a?: Anim) => (a ? { points: a.pts.map(p => [Math.round(p.x), Math.round(p.y)]), duration: a.dur, mode: a.mode, ease: a.ease, follow: a.follow, keys: keysOf(a).map(k => ({ progress: +k.u.toFixed(4), hold: k.hold, spin: k.spin, crumple: k.ball })) } : null);

const lenCache = new WeakMap<Anim, number[]>();
function cum(a: Anim): number[] {
  let c = lenCache.get(a);
  if (!c) { c = [0]; for (let i = 1; i < a.pts.length; i++) c.push(c[i - 1] + Math.hypot(a.pts[i].x - a.pts[i - 1].x, a.pts[i].y - a.pts[i - 1].y)); lenCache.set(a, c); }
  return c;
}
/** Position (relative) et cap au point d'abscisse curviligne `u` (0-1). */
function pathAt(a: Anim, u: number) {
  const c = cum(a), d = Math.min(Math.max(u, 0), 1) * (c[c.length - 1] || 1);
  let i = 1; while (i < c.length - 1 && c[i] < d) i++;
  const t = (d - c[i - 1]) / ((c[i] - c[i - 1]) || 1), p0 = a.pts[i - 1], p1 = a.pts[i];
  return { x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t, ang: Math.atan2(p1.y - p0.y, p1.x - p0.x) };
}
const smooth = (t: number) => t * t * (3 - 2 * t);
const keysOf = (a: Anim): Key[] => a.keys ?? [];
const totalOf = (a: Anim) => a.dur + keysOf(a).reduce((t, k) => t + k.hold, 0);
/** Début de chaque pause sur la ligne de temps (s). */
function keyStarts(a: Anim): number[] {
  let t = 0, cu = 0;
  return keysOf(a).map(k => { t += (k.u - cu) * a.dur; cu = k.u; const st = t; t += k.hold; return st; });
}
/** État à l'instant `time` : avancement `u` sur le trajet, rotation ajoutée (degrés) et taux de chiffonnage (0-1). */
function evalAnim(a: Anim, time: number) {
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
    if (!found && T < t + k.hold) { const q = k.hold > 0 ? smooth((T - t) / k.hold) : 1; u = k.u; rot = spin + q * k.spin; ball = b0 + q * ((k.ball ? 1 : 0) - b0); found = true; }
    t += k.hold; spin += k.spin; b0 = k.ball ? 1 : 0;
  }
  seg(1);
  if (!found) { u = 1; rot = spin; ball = b0; }
  const p = pathAt(a, u);
  return { x: p.x, y: p.y, u, ang: fwd ? p.ang : p.ang + Math.PI, rot, ball };
}

// ---- chiffonnage : le papier se réduit et se fond dans une boule faite de ses propres couleurs, à la taille proportionnelle de l'élément
const prng = (seed: number) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
function opaqueArea(c: HTMLCanvasElement): number {
  const k = 64 / Math.max(c.width, c.height), w = Math.max(1, Math.round(c.width * k)), h = Math.max(1, Math.round(c.height * k));
  const t = makeCanvas(w, h), x = t.getContext('2d', { willReadFrequently: true })!; x.drawImage(c, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data; let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 128) n++;
  return (n / (w * h)) * c.width * c.height;
}
// bruit cellulaire (Worley) : facettes plates séparées par des plis, à plusieurs échelles
const h3 = (x: number, y: number, sd: number) => {
  let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(sd | 0, 2147483647)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
};
function worley(x: number, y: number, sd: number) {
  const xi = Math.floor(x), yi = Math.floor(y); let f1 = 9, f2 = 9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = xi + i, cy = yi + j, d = Math.hypot(cx + h3(cx, cy, sd) - x, cy + h3(cx, cy, sd + 1) - y);
    if (d < f1) { f2 = f1; f1 = d; id = (cx * 7919 + cy * 104729 + sd) | 0; } else if (d < f2) f2 = d;
  }
  return { f1, f2, id };
}
const vn2 = (x: number, y: number, sd: number) => {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = h3(xi, yi, sd), b = h3(xi + 1, yi, sd), c = h3(xi, yi + 1, sd), d = h3(xi + 1, yi + 1, sd);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
const vn1 = (t: number, sd: number) => { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f); return h3(i, 0, sd) * (1 - u) + h3(i + 1, 0, sd) * u; };

/**
 * Boule de papier froissé : chaque pixel est éclairé selon la normale de sa facette (plis à trois échelles
 * + volume de sphère), l'image d'origine est répartie en morceaux différents par facette, la silhouette est
 * irrégulière avec des pointes de papier.
 */
function makeBall(base: HTMLCanvasElement, S: number, seed: number): HTMLCanvasElement {
  const c = makeCanvas(S, S), ctx = c.getContext('2d')!, R = S / 2, r = prng(seed);
  const m = 96, k = m / Math.max(base.width, base.height), sw = Math.max(1, Math.round(base.width * k)), sh = Math.max(1, Math.round(base.height * k));
  const sm = makeCanvas(sw, sh), sx = sm.getContext('2d', { willReadFrequently: true })!; sx.drawImage(base, 0, 0, sw, sh);
  const src = sx.getImageData(0, 0, sw, sh).data;
  let ar = 0, ag = 0, ab = 0, an = 0;
  for (let i = 0; i < src.length; i += 4) if (src[i + 3] > 200) { ar += src[i]; ag += src[i + 1]; ab += src[i + 2]; an++; }
  const avg = an ? [ar / an, ag / an, ab / an] : [215, 215, 205];
  const sample = (u: number, v: number) => {
    const x = Math.min(sw - 1, Math.max(0, Math.floor(u * sw))), y = Math.min(sh - 1, Math.max(0, Math.floor(v * sh))), i = (y * sw + x) * 4;
    return src[i + 3] > 120 ? [src[i], src[i + 1], src[i + 2]] : avg;
  };
  const spikes = Array.from({ length: 7 }, () => ({ a: r() * Math.PI * 2 - Math.PI, h: 0.08 + r() * 0.16, w: 0.16 + r() * 0.3 }));
  const s1 = (r() * 1000) | 0, s2 = (r() * 1000) | 0;
  const radius = (th: number) => {
    let q = 0.76 + 0.10 * vn1(th * 2.4 + 50, s1) + 0.07 * vn1(th * 6.1 + 90, s2);
    for (const sp of spikes) { const d = Math.abs(Math.atan2(Math.sin(th - sp.a), Math.cos(th - sp.a))); if (d < sp.w) q += sp.h * (1 - d / sp.w); }
    return R * Math.min(0.97, q);
  };
  const L = (() => { const x = -0.45, y = -0.55, z = 0.7, n = Math.hypot(x, y, z); return { x: x / n, y: y / n, z: z / n }; })();
  // relief : plis en arêtes vives (bruit « ridged » à quatre échelles, déformé pour que les plis ne soient pas réguliers)
  const fr = [2.0, 4.3, 9.0, 18], am = [1.4, 0.62, 0.28, 0.12];
  const H = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const px = (x + 0.5 - R) / R, py = (y + 0.5 - R) / R;
      const wx = px + 0.35 * (vn2(px * 1.6 + 4, py * 1.6, seed + 3) - 0.5), wy = py + 0.35 * (vn2(px * 1.6, py * 1.6 + 9, seed + 5) - 0.5);
      let hh = 0;
      for (let o = 0; o < 4; o++) hh += am[o] * (1 - Math.abs(2 * vn2(wx * fr[o] + o * 13, wy * fr[o] - o * 7, seed + o * 101) - 1));
      H[y * S + x] = hh;
    }
  }
  const img = ctx.createImageData(S, S), d = img.data, K = 0.2 * R * 0.5;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - R, dy = y + 0.5 - R, dist = Math.hypot(dx, dy), rr = radius(Math.atan2(dy, dx));
      if (dist > rr + 1.5) continue;
      const px = dx / rr, py = dy / rr, i0 = y * S + x;
      const gx = ((x < S - 1 ? H[i0 + 1] : H[i0]) - (x > 0 ? H[i0 - 1] : H[i0])) * K, gy = ((y < S - 1 ? H[i0 + S] : H[i0]) - (y > 0 ? H[i0 - S] : H[i0])) * K;
      const q = Math.min(1, px * px + py * py), sz = Math.sqrt(Math.max(0.05, 1 - q * 0.9));
      let Nx = px * 0.7 - gx, Ny = py * 0.7 - gy, Nz = sz * 0.9 + 0.25;
      const nl = Math.hypot(Nx, Ny, Nz); Nx /= nl; Ny /= nl; Nz /= nl;
      const diff = Math.max(0, Nx * L.x + Ny * L.y + Nz * L.z);
      const occ = 0.8 + 0.2 * Math.min(1, H[i0] / 1.6);              // creux plus sombres
      const shade = (0.5 + 0.72 * diff) * occ * (0.86 + 0.14 * sz);
      const w = worley(px * 2.1 + 3, py * 2.1 - 5, seed + 303);       // morceaux d'image différents de part et d'autre des grands plis
      const col = sample(0.5 + px * 0.5 + (h3(w.id, 5, seed) - 0.5) * 0.42, 0.5 + py * 0.5 + (h3(w.id, 6, seed) - 0.5) * 0.42);
      const g = 1 + (h3(x, y, seed + 9) - 0.5) * 0.06, o4 = i0 * 4;
      for (let ch = 0; ch < 3; ch++) d[o4 + ch] = Math.min(255, (col[ch] * 0.88 + 255 * 0.12) * shade * g);
      d[o4 + 3] = dist < rr ? 255 : ((rr + 1.5 - dist) / 1.5) * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
/**
 * Pliage : la feuille (maillage 14×14 en 3D) s'enroule autour d'une sphère tout en se froissant ; chaque triangle garde sa
 * part de texture (affine) et est éclairé selon sa normale, du fond vers l'avant pour que les replis se recouvrent.
 * On précalcule une série d'images, lue ensuite au rythme du chiffonnage.
 */
function makeFoldFrames(src: HTMLCanvasElement, D: number, seed: number, F = 18): { frames: HTMLCanvasElement[]; sf: number } {
  const sf = Math.min(1, 360 / Math.max(src.width, src.height)), W = Math.round(src.width * sf), H = Math.round(src.height * sf);
  const small = makeCanvas(W, H); small.getContext('2d')!.drawImage(src, 0, 0, W, H);
  const G = 14, Rb = (D * sf) / 2, V = G + 1;
  const ridge = (x: number, y: number, o: number) => 1 - Math.abs(2 * vn2(x, y, seed + o) - 1);
  const Ld = (() => { const x = -0.45, y = -0.55, z = 0.7, n = Math.hypot(x, y, z); return [x / n, y / n, z / n]; })();
  const frames: HTMLCanvasElement[] = [];
  for (let f = 0; f < F; f++) {
    const b = f / (F - 1), e = smooth(b), fold = Math.sin(Math.PI * Math.min(1, b * 1.15)) ** 0.8;
    const P: number[][] = [];
    for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) {
      const u = i / G, v = j / G, fx = (u - 0.5) * W, fy = (v - 0.5) * H;
      const lon = (u - 0.5) * Math.PI * 1.7, lat = (v - 0.5) * Math.PI * 0.85, rb = Rb * (1 + 0.28 * (ridge(u * 3, v * 3, 5) - 0.5));
      const bx = rb * Math.cos(lat) * Math.sin(lon), by = rb * Math.sin(lat), bz = rb * Math.cos(lat) * Math.cos(lon);
      P.push([
        fx * (1 - e) + bx * e + fold * W * 0.09 * (vn2(u * 3.1 + 5, v * 3.1, seed + 1) - 0.5) * 2,
        fy * (1 - e) + by * e + fold * H * 0.09 * (vn2(u * 3.1, v * 3.1 + 7, seed + 2) - 0.5) * 2,
        bz * e + fold * Rb * 1.1 * (ridge(u * 2.6 + 3, v * 2.6, 9) - 0.45) + fold * Rb * 0.5 * (ridge(u * 6.2, v * 6.2 + 2, 11) - 0.5),
      ]);
    }
    const tris: { i: number[]; z: number }[] = [];
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
      const a0 = j * V + i, a1 = a0 + 1, a2 = a0 + V, a3 = a2 + 1;
      for (const t of [[a0, a1, a2], [a1, a3, a2]]) tris.push({ i: t, z: (P[t[0]][2] + P[t[1]][2] + P[t[2]][2]) / 3 });
    }
    tris.sort((p, q) => p.z - q.z);                       // du fond vers l'avant
    const c = makeCanvas(W, H), ctx = c.getContext('2d')!;
    for (const t of tris) {
      const [i0, i1, i2] = t.i, p0 = P[i0], p1 = P[i1], p2 = P[i2];
      const uv = (i: number) => [(i % V) / G * W, Math.floor(i / V) / G * H];
      const s0 = uv(i0), s1 = uv(i1), s2 = uv(i2), d0 = [p0[0] + W / 2, p0[1] + H / 2], d1 = [p1[0] + W / 2, p1[1] + H / 2], d2 = [p2[0] + W / 2, p2[1] + H / 2];
      const det = (s1[0] - s0[0]) * (s2[1] - s0[1]) - (s2[0] - s0[0]) * (s1[1] - s0[1]);
      if (Math.abs(det) < 1e-6) continue;
      const cx = (d0[0] + d1[0] + d2[0]) / 3, cy = (d0[1] + d1[1] + d2[1]) / 3;
      ctx.save(); ctx.beginPath();                        // triangle légèrement élargi pour ne pas laisser de jour entre voisins
      [d0, d1, d2].forEach((q, k) => { const dx = q[0] - cx, dy = q[1] - cy, n = Math.hypot(dx, dy) || 1, x = q[0] + (dx / n) * 0.7, y = q[1] + (dy / n) * 0.7; if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.closePath(); ctx.clip();
      const a = ((d1[0] - d0[0]) * (s2[1] - s0[1]) - (d2[0] - d0[0]) * (s1[1] - s0[1])) / det, cc = ((d2[0] - d0[0]) * (s1[0] - s0[0]) - (d1[0] - d0[0]) * (s2[0] - s0[0])) / det;
      const bb = ((d1[1] - d0[1]) * (s2[1] - s0[1]) - (d2[1] - d0[1]) * (s1[1] - s0[1])) / det, dd = ((d2[1] - d0[1]) * (s1[0] - s0[0]) - (d1[1] - d0[1]) * (s2[0] - s0[0])) / det;
      ctx.transform(a, bb, cc, dd, d0[0] - a * s0[0] - cc * s0[1], d0[1] - bb * s0[0] - dd * s0[1]);
      ctx.drawImage(small, 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      // éclairage de la facette
      let nx = (p1[1] - p0[1]) * (p2[2] - p0[2]) - (p1[2] - p0[2]) * (p2[1] - p0[1]), ny = (p1[2] - p0[2]) * (p2[0] - p0[0]) - (p1[0] - p0[0]) * (p2[2] - p0[2]), nz = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0]);
      const nl = Math.hypot(nx, ny, nz) || 1; let back = false;
      if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; back = true; }
      const diff = Math.max(0, (nx * Ld[0] + ny * Ld[1] + nz * Ld[2]) / nl), sh = (0.5 + 0.72 * diff) * (back ? 0.85 : 1) * (1 - 0.12 * fold * (1 - nz / nl));
      ctx.globalCompositeOperation = 'source-atop';       // l'éclairage ne teinte que le papier, pas le vide autour
      ctx.fillStyle = sh < 1 ? `rgba(20,12,0,${(1 - sh) * 0.9})` : `rgba(255,255,255,${Math.min(0.5, (sh - 1) * 0.7)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    frames.push(c);
  }
  return { frames, sf };
}
function ensureBall(l: Layer): BallFx {
  if (l.ball) return l.ball;
  const D = Math.max(48, 0.5 * Math.sqrt(opaqueArea(l.base))), S = Math.round(Math.min(D, 480)), cx = l.baked.width / 2, cy = l.baked.height / 2, sd = l.id * 31 + 7;
  const tex = Texture.from(bake(makeBall(l.base, S, sd), l.border, l.rough, sd + 2)), spr = new Sprite(tex), sh = new Sprite(tex);
  const { frames, sf } = makeFoldFrames(l.baked, D, sd + 3), ftex = frames.map(f => Texture.from(f)), fold = new Sprite(ftex[ftex.length - 1]);
  const a = l.shadow / 100;
  for (const q of [spr, sh, fold]) q.anchor.set(0.5);
  spr.position.set(cx, cy); sh.position.set(cx + 6 * a + 2, cy + 9 * a + 2); fold.position.set(cx, cy); fold.scale.set(1 / sf);
  sh.tint = 0; sh.filters = [new BlurFilter({ strength: 2 + 6 * a })];
  spr.visible = sh.visible = fold.visible = false;
  l.box.addChild(sh, fold, spr);
  l.ball = { spr, sh, fold, frames: ftex, k: Math.min(1, D / Math.max(l.base.width, l.base.height)), sz: D / S };
  return l.ball;
}
function setCrumple(l: Layer, b: number) {
  const sa = 0.55 * (l.shadow / 100);
  if (b <= 0.001) {
    if (l.ball) l.ball.spr.visible = l.ball.sh.visible = l.ball.fold.visible = false;
    l.sprite.alpha = 1; l.sprite.scale.set(1); l.sprite.rotation = 0; l.shade.scale.set(1); l.shade.rotation = 0; l.shade.alpha = sa;
    return;
  }
  const fx = ensureBall(l), nF = fx.frames.length, e = smooth(Math.min(1, b));
  const inFold = b > 0.012, toBall = smooth(Math.min(1, Math.max(0, (b - 0.8) / 0.2)));
  l.sprite.alpha = inFold ? 0 : 1; l.sprite.scale.set(1);       // la feuille est remplacée par son maillage plié
  fx.fold.visible = inFold; fx.fold.texture = fx.frames[Math.min(nF - 1, Math.max(0, Math.round(b * (nF - 1))))]; fx.fold.alpha = 1 - toBall;
  const f = 1 + (fx.k - 1) * e;
  l.shade.scale.set(f); l.shade.alpha = sa * (1 - toBall);      // l'ombre du papier se resserre avec lui
  fx.spr.visible = fx.sh.visible = toBall > 0.001;               // en fin de pli, on passe à la boule détaillée
  fx.spr.scale.set(fx.sz); fx.sh.scale.set(fx.sz); fx.spr.alpha = toBall; fx.sh.alpha = sa * toBall;
}

// ---- lecture : on part de la pose de repos de chaque calque, on y ajoute les décalages de son chemin et de ceux de ses groupes
const restPose = new Map<Layer, { x: number; y: number; r: number }>();
const groupRest = new Map<Group, Pt>();
let playing = false, paused = false, animT = 0;
function groupRestCenter(g: Group): Pt {
  let c = groupRest.get(g);
  if (!c) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const l of leavesOf(g) as Layer[]) { const r = restPose.get(l) ?? { x: l.box.x, y: l.box.y }; x0 = Math.min(x0, r.x); x1 = Math.max(x1, r.x); y0 = Math.min(y0, r.y); y1 = Math.max(y1, r.y); }
    c = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 }; groupRest.set(g, c);
  }
  return c;
}
function applyAnim() {
  for (const l of layers) {
    let r0 = restPose.get(l);
    if (!r0) { r0 = { x: l.box.x, y: l.box.y, r: l.box.rotation }; restPose.set(l, r0); }
    let x = r0.x, y = r0.y, r = r0.r, ball = 0;
    const step = (a: Anim | undefined, c: Pt | null) => {
      if (!a || a.pts.length < 2) return;
      const s = evalAnim(a, animT), d = (a.follow ? s.ang - pathAt(a, 0).ang : 0) + (s.rot * Math.PI) / 180;
      if (d && c) { const rx = x - c.x, ry = y - c.y, cs = Math.cos(d), sn = Math.sin(d); x = c.x + rx * cs - ry * sn; y = c.y + rx * sn + ry * cs; }
      r += d; x += s.x; y += s.y; ball = Math.max(ball, s.ball);
    };
    step(l.anim, null);
    for (let g: Group | null = l.parent; g && g !== root; g = g.parent) step(g.anim as Anim | undefined, groupRestCenter(g));
    l.box.position.set(x, y); l.box.rotation = r; setCrumple(l, ball);
  }
}
const anyAnim = () => layers.some(l => l.anim) || (() => { let f = false; const w = (g: Group) => { for (const c of g.children) if (isGroup(c)) { if (c.anim) f = true; w(c); } }; w(root); return f; })();
function playUI() {
  const b = $('btn-play');
  b.classList.toggle('on', playing && !paused);
  b.querySelector('use')!.setAttribute('href', playing && !paused ? '#i-pause' : '#i-play');
  ($('btn-stop') as HTMLButtonElement).disabled = !playing;
  ui.alpha = playing && !paused ? 0 : 1;
}
function startPlay() {
  restPose.clear(); groupRest.clear();
  for (const l of layers) restPose.set(l, { x: l.box.x, y: l.box.y, r: l.box.rotation });
  for (const l of layers) { let uses = false; for (let n: Node | null = l; n && n !== root; n = n.parent) if (keysOf((animOf(n) ?? { pts: [], dur: 1, mode: 'loop', ease: 'linear', follow: false }) as Anim).some(kk => kk.ball)) uses = true; if (uses) ensureBall(l); }
  playing = true; paused = false; animT = 0; playUI();
  status('Lecture — Espace pour mettre en pause, Échap pour arrêter.');
}
function pausePlay() { if (!playing) startPlay(); paused = true; playUI(); status('En pause : ◆ ajoute une image clé ; la poignée ronde fait pivoter.'); }
function stopPlay() {
  if (!playing) return;
  for (const [l, p] of restPose) { l.box.position.set(p.x, p.y); l.box.rotation = p.r; setCrumple(l, 0); }
  restPose.clear(); groupRest.clear(); playing = false; paused = false; playUI(); status('Lecture arrêtée.');
}
$('btn-play').onclick = () => {
  if (playing && !paused) { pausePlay(); return; }
  if (playing) { paused = false; playUI(); status('Lecture.'); return; }
  if (anyAnim()) startPlay(); else status("Aucune trajectoire : choisis l'outil trajectoire (P) et dessine un chemin.");
};
$('btn-stop').onclick = stopPlay;

/** Rééchantillonne le tracé à pas constant puis l'adoucit (extrémités fixes). */
function smoothPath(P: Pt[]): Pt[] {
  const step = 10, out: Pt[] = [P[0]];
  let acc = 0;
  for (let i = 1; i < P.length; i++) {
    let ax = P[i - 1].x, ay = P[i - 1].y, dl = Math.hypot(P[i].x - ax, P[i].y - ay);
    const ux = (P[i].x - ax) / (dl || 1), uy = (P[i].y - ay) / (dl || 1);
    while (acc + dl >= step) { const s = step - acc; ax += ux * s; ay += uy * s; dl -= s; acc = 0; out.push({ x: ax, y: ay }); }
    acc += dl;
  }
  out.push(P[P.length - 1]);
  for (let k = 0; k < 3; k++) { const c = out.map(p => ({ ...p })); for (let i = 1; i < out.length - 1; i++) out[i] = { x: (c[i - 1].x + c[i].x + c[i + 1].x) / 3, y: (c[i - 1].y + c[i].y + c[i + 1].y) / 3 }; }
  return out;
}
function finishAnimPath(screenPts: Pt[]) {
  const nodes = selectedNodes();
  if (!nodes.length || screenPts.length < 3) return;
  const pts = smoothPath(screenPts.map(p => toWorld(p.x, p.y)));
  if (cum({ pts, dur: 1, mode: 'loop', ease: 'linear', follow: false }).at(-1)! < 20) { status('Trajectoire trop courte.'); return; }
  const rel = pts.map(p => ({ x: p.x - pts[0].x, y: p.y - pts[0].y }));
  for (const n of nodes) setAnim(n, { dur: 3, mode: 'loop', ease: 'linear', follow: false, keys: [], ...animOf(n), pts: rel });
  commit(); setTool('path');
  status('Trajectoire créée : ▶ (Espace) pour la lire ; mets en pause puis ◆ pour ajouter une image clé.');
}

// affichage des trajectoires (pointillés) : celles de la sélection en plein, les autres en discret
function nodeCenter(n: Node): Pt {
  const at = (l: Layer) => restPose.get(l) ?? { x: l.box.x, y: l.box.y };
  if (!isGroup(n)) return at(n as Layer);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const l of leavesOf(n) as Layer[]) { const r = at(l); x0 = Math.min(x0, r.x); x1 = Math.max(x1, r.x); y0 = Math.min(y0, r.y); y1 = Math.max(y1, r.y); }
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
}
function dashed(g: Graphics, P: Pt[], dash: number, gap: number) {
  let on = true, left = dash;
  for (let i = 1; i < P.length; i++) {
    let ax = P[i - 1].x, ay = P[i - 1].y, dl = Math.hypot(P[i].x - ax, P[i].y - ay);
    const ux = (P[i].x - ax) / (dl || 1), uy = (P[i].y - ay) / (dl || 1);
    while (dl > 0) {
      const s = Math.min(left, dl);
      if (on) g.moveTo(ax, ay).lineTo(ax + ux * s, ay + uy * s);
      ax += ux * s; ay += uy * s; dl -= s; left -= s;
      if (left <= 0) { on = !on; left = on ? dash : gap; }
    }
  }
}
function drawAnimPaths() {
  const sel = new Set(selectedNodes());
  const walk = (g: Group) => {
    for (const c of g.children) {
      const a = animOf(c);
      if (a && a.pts.length > 1 && shown(c)) {
        const k = nodeCenter(c), P = a.pts.map(p => world.toGlobal({ x: k.x + p.x, y: k.y + p.y })), al = sel.has(c) ? 1 : 0.35;
        const f = P.flatMap(p => [p.x, p.y]);
        animG.poly(f, false).stroke({ width: 4.5, color: 0x000000, alpha: 0.45 * al });
        dashed(animG, P, 8, 6); animG.stroke({ width: 2, color: 0xffffff, alpha: al });
        animG.circle(P[0].x, P[0].y, 5).fill({ color: 0xf2b134, alpha: al }).stroke({ width: 1.5, color: 0x1d1f23, alpha: al });
        const e = P[P.length - 1], p = P[Math.max(0, P.length - 4)], ang = Math.atan2(e.y - p.y, e.x - p.x), s = 9;
        animG.poly([e.x, e.y, e.x - Math.cos(ang - 0.5) * s, e.y - Math.sin(ang - 0.5) * s, e.x - Math.cos(ang + 0.5) * s, e.y - Math.sin(ang + 0.5) * s]).fill({ color: 0xffffff, alpha: al }).stroke({ width: 1.5, color: 0x1d1f23, alpha: al });
      }
      if (isGroup(c)) walk(c);
    }
  };
  walk(root);
}

// barre d'animation : ligne de temps, réglages du trajet et des images clés
const animNodes = () => selectedNodes().filter(n => animOf(n));
const tlTotal = () => {
  const an = animNodes()[0]; if (an) return totalOf(animOf(an)!);
  let m = 0; const w = (g: Group) => { for (const c of g.children) { const a = animOf(c); if (a) m = Math.max(m, totalOf(a)); if (isGroup(c)) w(c); } }; w(root);
  return m || 3;
};
function editAnim(f: (a: Anim) => Anim) { for (const n of animNodes()) setAnim(n, f(animOf(n)!)); commitSoon(); }
const curT = (a: Anim) => { const tot = totalOf(a); return a.mode === 'loop' ? animT % tot : Math.min(animT % (tot * 2), tot); };
/** Image clé dont la pause contient la tête de lecture. */
function activeKey() {
  const an = animNodes()[0]; if (!an || !playing) return null;
  const a = animOf(an)!, ks = keysOf(a), st = keyStarts(a), T = curT(a);
  const i = ks.findIndex((k, j) => T >= st[j] - 0.03 && T <= st[j] + k.hold + 0.03);
  return i < 0 ? null : { node: an, a, i };
}
function editKey(f: (k: Key) => Key) {
  const ak = activeKey(); if (!ak) return;
  setAnim(ak.node, { ...ak.a, keys: keysOf(ak.a).map((k, i) => (i === ak.i ? f(k) : k)) }); commitSoon();
}
function playheadTo(t: number) { if (!playing) startPlay(); paused = true; playUI(); animT = t; }
let kr: { node: Node; idx: number; spin0: number; cx: number; cy: number; last: number; acc: number } | null = null;
function startKeyRot(p: Pt) {
  const ak = activeKey(); if (!ak || hitHandle(p) !== 'rot') return;
  const c = selCenterWorld(), w = toWorld(p.x, p.y), a0 = Math.atan2(w.y - c.y, w.x - c.x);
  kr = { node: ak.node, idx: ak.i, spin0: keysOf(ak.a)[ak.i].spin, cx: c.x, cy: c.y, last: a0, acc: 0 };
}
$<HTMLInputElement>('anim-dur').oninput = e => { const v = +(e.target as HTMLInputElement).value / 10; editAnim(a => ({ ...a, dur: v })); };
$('btn-amode').onclick = () => editAnim(a => ({ ...a, mode: a.mode === 'loop' ? 'pingpong' : 'loop' }));
$('btn-aease').onclick = () => editAnim(a => ({ ...a, ease: a.ease === 'linear' ? 'smooth' : 'linear' }));
$('btn-afollow').onclick = () => editAnim(a => ({ ...a, follow: !a.follow }));
$('btn-adel').onclick = () => { const ns = animNodes(); if (!ns.length) return; stopPlay(); ns.forEach(n => setAnim(n, undefined)); commit(); };
$<HTMLInputElement>('tl').oninput = e => { playheadTo((+(e.target as HTMLInputElement).value / 1000) * tlTotal()); };
$('btn-key').onclick = () => {
  const an = animNodes()[0]; if (!an) { status("Sélectionne un élément qui a une trajectoire."); return; }
  const a = animOf(an)!;
  if (!playing) startPlay(); paused = true; playUI();
  if (activeKey()) { status('Il y a déjà une image clé ici.'); return; }
  const u = evalAnim(a, curT(a)).u, hold = 0.8;
  const keys = [...keysOf(a), { u, hold, spin: 0, ball: false }].sort((x, y) => x.u - y.u);
  const na = { ...a, keys }; setAnim(an, na); commit();
  animT = keyStarts(na)[keys.findIndex(k => k.u === u)] + hold;   // tête de lecture à la fin de la pause : on voit le résultat
  status('Image clé ajoutée : règle la pause, la rotation (poignée ronde) ou le chiffonnage.');
};
$<HTMLInputElement>('key-hold').oninput = e => { const v = +(e.target as HTMLInputElement).value / 10; editKey(k => ({ ...k, hold: v })); };
$<HTMLInputElement>('key-spin').oninput = e => { const v = +(e.target as HTMLInputElement).value; editKey(k => ({ ...k, spin: v })); };
$('btn-kball').onclick = () => editKey(k => ({ ...k, ball: !k.ball }));
$('btn-kdel').onclick = () => { const ak = activeKey(); if (!ak) return; setAnim(ak.node, { ...ak.a, keys: keysOf(ak.a).filter((_, i) => i !== ak.i) }); commit(); };

let marksSig = '';
function syncAnimBar() {
  const an = animNodes()[0], a = an ? animOf(an) : undefined, ak = activeKey();
  $('animbar').classList.toggle('noanim', !a);
  $('animbar').classList.toggle('nokey', !ak);
  ($('btn-play') as HTMLButtonElement).disabled = !playing && !anyAnim();
  const tot = a ? totalOf(a) : tlTotal(), tl = $<HTMLInputElement>('tl');
  if (document.activeElement !== tl) tl.value = String(playing ? Math.round(((a ? curT(a) : animT % tot) / tot) * 1000) : 0);
  tl.style.setProperty('--p', +tl.value / 10 + '%');
  $('v-tl').textContent = `${(playing ? (a ? curT(a) : animT % tot) : 0).toFixed(1)} / ${tot.toFixed(1)} s`;
  // repères des images clés sur la ligne de temps
  const ks = a ? keysOf(a) : [], st = a ? keyStarts(a) : [], sig = a ? ks.map((k, i) => `${st[i].toFixed(2)}:${k.hold}:${i === ak?.i ? 1 : 0}`).join('|') + '/' + tot.toFixed(2) : '';
  if (sig !== marksSig) {
    marksSig = sig; const box = $('tl-keys'); box.innerHTML = '';
    ks.forEach((k, i) => {
      const m = document.createElement('button');
      m.className = 'kmark' + (i === ak?.i ? ' on' : ''); m.style.left = ((st[i] + k.hold / 2) / tot) * 100 + '%'; m.style.width = Math.max(10, (k.hold / tot) * 100) + '%'; m.title = 'Image clé';
      m.onclick = () => playheadTo(st[i] + k.hold);
      box.appendChild(m);
    });
  }
  if (a) {
    const r = $<HTMLInputElement>('anim-dur');
    if (document.activeElement !== r) r.value = String(Math.round(a.dur * 10));
    r.style.setProperty('--p', ((+r.value - +r.min) / (+r.max - +r.min)) * 100 + '%'); $('v-anim-dur').textContent = (+r.value / 10).toFixed(1) + ' s';
    $('btn-amode').querySelector('use')!.setAttribute('href', a.mode === 'loop' ? '#i-loop' : '#i-pingpong');
    $('btn-aease').querySelector('use')!.setAttribute('href', a.ease === 'linear' ? '#i-ease-linear' : '#i-ease-smooth');
    $('btn-afollow').classList.toggle('on', a.follow);
  }
  if (ak) {
    const k = keysOf(ak.a)[ak.i], h = $<HTMLInputElement>('key-hold'), sp = $<HTMLInputElement>('key-spin');
    if (document.activeElement !== h) h.value = String(Math.round(k.hold * 10));
    if (document.activeElement !== sp) sp.value = String(k.spin);
    h.style.setProperty('--p', ((+h.value - +h.min) / (+h.max - +h.min)) * 100 + '%'); sp.style.setProperty('--p', ((+sp.value - +sp.min) / (+sp.max - +sp.min)) * 100 + '%');
    $('v-key-hold').textContent = k.hold.toFixed(1) + ' s'; $('v-key-spin').textContent = k.spin + '°';
    $('btn-kball').classList.toggle('on', k.ball);
  }
}

// accès console pour les tests
(window as any).__app = { loadProject, saveProject, addLayer, layers, replaceBase, cutoutFlat, get selected() { return selected; } };
commit();
status('Glisse des images ici, ou colle-les (Ctrl+V).');
