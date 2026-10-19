import { Application, Container, Sprite, Texture, Graphics, BlurFilter, Rectangle } from 'pixi.js';
import { PAD, makeCanvas, bake, trim, jitter } from './sticker';
import { cutoutAI, cutoutFlat, modelAvailable } from './cutout';
import { makeLetter } from './letters';
import { samAvailable, segment, forget, type SamPoint } from './sam';

const PW = 1000, PH = 1400; // taille de la feuille
type Pt = { x: number; y: number };

interface Layer {
  id: number; name: string; base: HTMLCanvasElement; baked: HTMLCanvasElement;
  border: number; shadow: number;
  box: Container; sprite: Sprite; shade: Sprite;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const status = (s: string) => ($('status').textContent = s);

const app = new Application();
await app.init({ resizeTo: $('stage'), background: '#2b3237', antialias: true, resolution: window.devicePixelRatio, autoDensity: true });
$('stage').appendChild(app.canvas);

const world = new Container();
const paper = new Graphics();
const ui = new Container(); // surcouche (sélection, tracés) en coordonnées écran
const selG = new Graphics(), pathG = new Graphics();
ui.addChild(selG, pathG);
world.addChild(paper);
app.stage.addChild(world, ui);

let bgColor = '#cfe8e6';
const drawPaper = () => { paper.clear().rect(0, 0, PW, PH).fill(bgColor); };
drawPaper();

// ---- vue (zoom / déplacement)
const view = { x: 0, y: 0, s: 1 };
const applyView = () => { world.position.set(view.x, view.y); world.scale.set(view.s); };
function fitView() {
  const r = app.screen; view.s = Math.min((r.width - 40) / PW, (r.height - 40) / PH);
  view.x = (r.width - PW * view.s) / 2; view.y = (r.height - PH * view.s) / 2; applyView();
}
fitView();
const toWorld = (sx: number, sy: number): Pt => world.toLocal({ x: sx, y: sy });

// ---- calques
const layers: Layer[] = [];
let selected: Layer | null = null, nextId = 1;

const texOf = (c: HTMLCanvasElement) => Texture.from(c);

function refresh(l: Layer) {
  const old = l.sprite.texture;
  l.baked = bake(l.base, l.border);
  l.sprite.texture = texOf(l.baked);
  l.shade.texture = l.sprite.texture;
  if (old !== Texture.EMPTY) old.destroy(true);
  l.box.pivot.set(l.baked.width / 2, l.baked.height / 2);
  const a = l.shadow / 100;
  l.shade.alpha = 0.55 * a; l.shade.position.set(6 * a + 2, 9 * a + 2);
  (l.shade.filters as BlurFilter[])[0].strength = 2 + 6 * a;
  l.shade.visible = a > 0;
}

function addLayer(base: HTMLCanvasElement, name: string, at?: { pos: Pt; rot: number; scale: Pt }, opts?: Partial<Pick<Layer, 'border' | 'shadow' | 'id'>>): Layer {
  const border = opts?.border ?? +$<HTMLInputElement>('border').value, shadow = opts?.shadow ?? +$<HTMLInputElement>('shadow').value;
  const baked = bake(base, border);
  const box = new Container(), sprite = new Sprite(Texture.EMPTY), shade = new Sprite(Texture.EMPTY);
  shade.tint = 0x000000; shade.filters = [new BlurFilter({ strength: 4 })];
  box.addChild(shade, sprite);
  if (at) { box.position.set(at.pos.x, at.pos.y); box.rotation = at.rot; box.scale.set(at.scale.x, at.scale.y); }
  else box.position.set(PW / 2 + (Math.random() - 0.5) * 80, PH / 2 + (Math.random() - 0.5) * 80);
  world.addChild(box);
  const l: Layer = { id: opts?.id ?? nextId++, name, base, baked, border, shadow, box, sprite, shade };
  layers.push(l); refresh(l); select(l);
  return l;
}

function select(l: Layer | null) {
  selected = l;
  if (l) { $<HTMLInputElement>('border').value = String(l.border); $<HTMLInputElement>('shadow').value = String(l.shadow); }
}
const toTop = (l: Layer) => { world.addChild(l.box); layers.splice(layers.indexOf(l), 1); layers.push(l); };
function removeLayer(l: Layer) {
  layers.splice(layers.indexOf(l), 1); l.box.destroy({ children: true, texture: true });
  if (selected === l) select(layers[layers.length - 1] ?? null);
}

/** Point en pixels du canvas « baked » d'un calque → coordonnées monde. */
const layerToWorld = (l: Layer, q: Pt): Pt => world.toLocal(l.box.toGlobal(q));
const worldToLayer = (l: Layer, p: Pt): Pt => l.box.toLocal(p, world);

function hit(l: Layer, p: Pt): boolean {
  const q = worldToLayer(l, p);
  const x = Math.floor(q.x), y = Math.floor(q.y);
  if (x < 0 || y < 0 || x >= l.baked.width || y >= l.baked.height) return false;
  return l.baked.getContext('2d')!.getImageData(x, y, 1, 1).data[3] > 20;
}

// ---- historique (annuler / rétablir) : instantanés légers, les canvas de base sont immuables
interface LState { id: number; name: string; base: HTMLCanvasElement; border: number; shadow: number; x: number; y: number; rot: number; sx: number; sy: number }
interface Snap { layers: LState[]; bg: string; sel: number | null }
const snap = (): Snap => ({
  layers: layers.map(l => ({ id: l.id, name: l.name, base: l.base, border: l.border, shadow: l.shadow, x: l.box.x, y: l.box.y, rot: l.box.rotation, sx: l.box.scale.x, sy: l.box.scale.y })),
  bg: bgColor, sel: selected?.id ?? null,
});
const sameSnap = (a: Snap, b: Snap) => a.bg === b.bg && a.layers.length === b.layers.length &&
  a.layers.every((u, i) => { const v = b.layers[i]; return u.id === v.id && u.name === v.name && u.base === v.base && u.border === v.border && u.shadow === v.shadow && u.x === v.x && u.y === v.y && u.rot === v.rot && u.sx === v.sx && u.sy === v.sy; });
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
    if (!l) l = addLayer(st.base, st.name, { pos: { x: st.x, y: st.y }, rot: st.rot, scale: { x: st.sx, y: st.sy } }, { border: st.border, shadow: st.shadow, id: st.id });
    else {
      const dirty = l.base !== st.base || l.border !== st.border || l.shadow !== st.shadow;
      if (l.base !== st.base) forget(l.base);
      l.base = st.base; l.border = st.border; l.shadow = st.shadow; l.name = st.name;
      l.box.position.set(st.x, st.y); l.box.rotation = st.rot; l.box.scale.set(st.sx, st.sy);
      if (dirty) refresh(l);
    }
    ordered.push(l);
  }
  layers.length = 0; layers.push(...ordered);
  ordered.forEach((l, i) => world.setChildIndex(l.box, i + 1));
  bgColor = s.bg; drawPaper(); $<HTMLInputElement>('bg').value = bgColor;
  select(layers.find(l => l.id === s.sel) ?? null);
}
function undo() { if (hi > 0) { hi--; restore(hist[hi]); updHistUI(); status('Annulé.'); } }
function redo() { if (hi < hist.length - 1) { hi++; restore(hist[hi]); updHistUI(); status('Rétabli.'); } }
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
addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('drop'); });
addEventListener('dragleave', () => document.body.classList.remove('drop'));
addEventListener('drop', e => { e.preventDefault(); document.body.classList.remove('drop'); if (e.dataTransfer) importAll(e.dataTransfer.files); });
addEventListener('paste', e => { if (e.clipboardData) importAll(e.clipboardData.files); });

// ---- détourage
/** Remplace la base d'un calque en gardant l'image à la même place (x0,y0 = décalage de la nouvelle base dans l'ancienne). */
function setBase(l: Layer, nb: HTMLCanvasElement, x0: number, y0: number) {
  const pivNew: Pt = { x: nb.width / 2 + PAD, y: nb.height / 2 + PAD };
  const pos = layerToWorld(l, { x: pivNew.x + x0, y: pivNew.y + y0 });
  forget(l.base); l.base = nb; l.box.position.set(pos.x, pos.y); refresh(l);
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
type Tool = 'move' | 'scissors' | 'tear' | 'sam';
let tool: Tool = 'move';
function setTool(t: Tool) {
  tool = tool === t ? 'move' : t;
  if (tool !== 'sam') samClear();
  $('btn-sam').classList.toggle('on', tool === 'sam');
  $('btn-scissors').classList.toggle('on', tool === 'scissors'); $('btn-tear').classList.toggle('on', tool === 'tear');
  app.canvas.style.cursor = tool === 'move' ? 'default' : 'crosshair';
  if (tool === 'sam') { status("Clique sur l'objet à détourer."); return; }
  if (tool !== 'move') status(selected ? (tool === 'scissors' ? 'Trace le contour à découper.' : 'Trace une ligne à travers l\'image pour la déchirer.') : 'Sélectionne d\'abord une image.');
}
$('btn-sam').onclick = async () => {
  if (tool !== 'sam' && !(await samAvailable())) return status('Modèles MobileSAM absents de public/models/ (voir README).');
  setTool('sam');
};
$('btn-scissors').onclick = () => setTool('scissors');
$('btn-tear').onclick = () => setTool('tear');

/** Découpe `l` selon un masque (alpha dessiné par `fillMask`, en pixels de la base) : crée le morceau et retire cette zone de l'original. */
function cutMask(l: Layer, fillMask: (c: CanvasRenderingContext2D) => void): Layer | null {
  const { width: w, height: h } = l.base;
  const mask = makeCanvas(w, h); fillMask(mask.getContext('2d')!);
  const piece = makeCanvas(w, h), pc = piece.getContext('2d')!;
  pc.drawImage(l.base, 0, 0); pc.globalCompositeOperation = 'destination-in'; pc.drawImage(mask, 0, 0);
  const t = trim(piece); if (!t) return null;
  const nl = addLayer(t.canvas, l.name + '-morceau', { pos: { x: 0, y: 0 }, rot: l.box.rotation, scale: { x: l.box.scale.x, y: l.box.scale.y } }, { border: l.border, shadow: l.shadow });
  const pos = layerToWorld(l, { x: nl.baked.width / 2 + t.x, y: nl.baked.height / 2 + t.y });
  nl.box.position.set(pos.x, pos.y);
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
  if (piece) { toTop(piece); select(piece); }
  if (tool === 'sam') setTool('sam');
}

function finishPath(screenPts: Pt[]) {
  const l = selected; if (!l || screenPts.length < 3) return;
  const pts = screenPts.map(p => toWorld(p.x, p.y));
  if (tool === 'scissors') {
    const closed = jitter([...pts, pts[0]], 6 / view.s, 1.5 / view.s);
    const piece = cutPolygon(l, closed);
    commit();
    status(piece ? 'Morceau découpé : déplace-le.' : 'Rien dans la zone tracée.');
    if (piece) { toTop(piece); select(piece); }
  } else {
    // déchirure : droite entre premier et dernier point, prolongée, bord fibreux
    const a = pts[0], b = pts[pts.length - 1];
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
    const far = 4000, p0 = { x: a.x - ux * far, y: a.y - uy * far }, p1 = { x: b.x + ux * far, y: b.y + uy * far };
    const edge = jitter([p0, p1], 5, 7);
    const nx = -uy, ny = ux;
    const sideA = [...edge, { x: p1.x + nx * far, y: p1.y + ny * far }, { x: p0.x + nx * far, y: p0.y + ny * far }];
    const piece = cutPolygon(l, sideA);
    if (piece) { piece.box.position.x += nx * 14; piece.box.position.y += ny * 14; }
    commit();
    status(piece ? 'Image déchirée en deux : sépare les morceaux.' : 'La ligne ne traverse pas l\'image.');
    if (piece) { toTop(piece); select(piece); }
  }
  setTool(tool);
}

// ---- boutons calque
const need = () => selected ?? (status('Sélectionne un calque.'), null);
$('btn-del').onclick = () => { const l = need(); if (l) { removeLayer(l); commit(); } };
$('btn-dup').onclick = () => {
  const l = need(); if (!l) return;
  const n = addLayer(l.base, l.name + '-copie', { pos: { x: l.box.x + 30, y: l.box.y + 30 }, rot: l.box.rotation, scale: { x: l.box.scale.x, y: l.box.scale.y } }, { border: l.border, shadow: l.shadow });
  toTop(n); commit();
};
$('btn-flip').onclick = () => { const l = need(); if (l) { l.box.scale.x *= -1; commit(); } };
function move(l: Layer, d: number) {
  const i = layers.indexOf(l), j = i + d;
  if (j < 0 || j >= layers.length) return;
  layers.splice(i, 1); layers.splice(j, 0, l);
  // l'index 0 du monde est la feuille
  world.setChildIndex(l.box, j + 1); commit();
}
$('btn-up').onclick = () => { const l = need(); if (l) move(l, 1); };
$('btn-down').onclick = () => { const l = need(); if (l) move(l, -1); };
$<HTMLInputElement>('border').oninput = e => { if (selected) { selected.border = +(e.target as HTMLInputElement).value; refresh(selected); commitSoon(); } };
$<HTMLInputElement>('shadow').oninput = e => { if (selected) { selected.shadow = +(e.target as HTMLInputElement).value; refresh(selected); commitSoon(); } };
$<HTMLInputElement>('bg').oninput = e => { bgColor = (e.target as HTMLInputElement).value; drawPaper(); commitSoon(); };

$('btn-word').onclick = () => {
  const word = $<HTMLInputElement>('word').value.trim(); if (!word) return;
  const chars = [...word].filter(c => c !== ' ');
  const letters = chars.map(c => makeLetter(c));
  const total = letters.reduce((s, c) => s + c.width - 6, 0);
  const sc = Math.min(1, (PW - 80) / total);
  let x = PW / 2 - (total * sc) / 2;
  const y = PH / 2 + (Math.random() - 0.5) * 100;
  for (let i = 0; i < letters.length; i++) {
    const c = letters[i];
    addLayer(c, 'lettre-' + chars[i], { pos: { x: x + (c.width / 2) * sc, y: y + (Math.random() - 0.5) * 22 }, rot: (Math.random() - 0.5) * 0.35, scale: { x: sc, y: sc } });
    x += (c.width - 6) * sc;
  }
  commit();
  status(`Mot « ${word} » composé : chaque lettre est un calque indépendant.`);
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
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
$('btn-export').onclick = () => extractPaper().toBlob(b => download(b, 'collage.png'));
$('btn-export-layers').onclick = async () => {
  const name = (l: Layer, z: number) => `${String(z).padStart(2, '0')}_${l.name.replace(/\W+/g, '_')}.png`;
  const manifest = {
    canvas: [PW, PH],
    layers: layers.map((l, z) => ({
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
  const ids = new Map<HTMLCanvasElement, string>(), images: Record<string, string> = {};
  const out = layers.map(l => {
    let id = ids.get(l.base);
    if (!id) { id = 'img' + ids.size; ids.set(l.base, id); images[id] = l.base.toDataURL('image/png'); }
    return { id: l.id, name: l.name, image: id, border: l.border, shadow: l.shadow, x: l.box.x, y: l.box.y, rotation: l.box.rotation, scaleX: l.box.scale.x, scaleY: l.box.scale.y };
  });
  const blob = new Blob([JSON.stringify({ format: 'maxernzt', version: 1, paper: [PW, PH], bg: bgColor, layers: out, images })], { type: 'application/json' });
  try {
    const w = window as any;
    if (w.showSaveFilePicker) {
      const h = await w.showSaveFilePicker({ suggestedName: projectName + '.maxernzt', types: [{ description: 'Projet MaXernZt', accept: { 'application/json': ['.maxernzt'] } }] });
      const ws = await h.createWritable(); await ws.write(blob); await ws.close();
      projectName = String(h.name).replace(/\.maxernzt$/i, '');
    } else download(blob, projectName + '.maxernzt');
    dirty = false; status(`Projet enregistré (${layers.length} calques).`);
  } catch (e) { if ((e as Error).name !== 'AbortError') status("Erreur d'enregistrement : " + (e as Error).message); }
}
const decode = (url: string) => new Promise<HTMLCanvasElement>((res, rej) => {
  const im = new Image(); im.onload = () => { const c = makeCanvas(im.width, im.height); c.getContext('2d')!.drawImage(im, 0, 0); res(c); }; im.onerror = () => rej(new Error('image illisible')); im.src = url;
});
async function loadProject(f: File) {
  try {
    const d = JSON.parse(await f.text());
    if (d.format !== 'maxernzt' || !Array.isArray(d.layers)) throw new Error('fichier non reconnu');
    const imgs = new Map<string, HTMLCanvasElement>();
    for (const [id, url] of Object.entries<string>(d.images)) imgs.set(id, await decode(url));
    const ls: LState[] = d.layers.map((l: any) => ({ id: l.id, name: l.name, base: imgs.get(l.image)!, border: l.border, shadow: l.shadow, x: l.x, y: l.y, rot: l.rotation, sx: l.scaleX, sy: l.scaleY }));
    nextId = Math.max(nextId, ...ls.map(l => l.id + 1));
    restore({ layers: ls, bg: d.bg ?? bgColor, sel: null });
    projectName = f.name.replace(/\.(maxernzt|json)$/i, ''); commit(); dirty = false;
    status(`Projet « ${projectName} » ouvert (${ls.length} calques).`);
  } catch (e) { status('Ouverture impossible : ' + (e as Error).message); }
}
$('btn-save').onclick = saveProject;
$('btn-open').onclick = () => $<HTMLInputElement>('file-proj').click();
$<HTMLInputElement>('file-proj').onchange = e => { const i = e.target as HTMLInputElement; if (i.files![0]) loadProject(i.files![0]); i.value = ''; };
$('btn-new').onclick = () => {
  if (layers.length && dirty && !confirm('Vider la feuille ? (tu pourras annuler avec Ctrl+Z)')) return;
  restore({ layers: [], bg: bgColor, sel: null }); projectName = 'collage'; commit(); status('Nouvelle feuille.');
};
addEventListener('beforeunload', e => { if (dirty && layers.length) e.preventDefault(); });

// ---- souris
let drag: { l: Layer; dx: number; dy: number } | null = null, pan: { sx: number; sy: number; vx: number; vy: number } | null = null, path: Pt[] | null = null;
const cv = app.canvas;
const pos = (e: PointerEvent | WheelEvent): Pt => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
cv.addEventListener('pointerdown', e => {
  const p = pos(e); cv.setPointerCapture(e.pointerId);
  if (e.button === 1 || e.button === 2) { pan = { sx: p.x, sy: p.y, vx: view.x, vy: view.y }; return; }
  if (tool === 'sam') {
    const w = toWorld(p.x, p.y);
    for (let i = layers.length - 1; i >= 0; i--) if (hit(layers[i], w)) { const l = layers[i]; select(l); samClick(l, w, e.altKey ? 0 : 1, e.shiftKey || e.altKey); return; }
    return;
  }
  if (tool !== 'move') { if (!selected) return status('Sélectionne d\'abord une image.'); path = [p]; return; }
  const w = toWorld(p.x, p.y);
  for (let i = layers.length - 1; i >= 0; i--) {
    if (hit(layers[i], w)) { const l = layers[i]; select(l); toTop(l); drag = { l, dx: l.box.x - w.x, dy: l.box.y - w.y }; return; }
  }
  select(null);
});
cv.addEventListener('pointermove', e => {
  const p = pos(e);
  if (pan) { view.x = pan.vx + p.x - pan.sx; view.y = pan.vy + p.y - pan.sy; applyView(); }
  else if (drag) { const w = toWorld(p.x, p.y); drag.l.box.position.set(w.x + drag.dx, w.y + drag.dy); }
  else if (path) { path.push(p); pathG.clear().poly(path.flatMap(q => [q.x, q.y]), false).stroke({ width: 2, color: 0xffd23f }); }
});
const end = () => { if (drag) commit(); if (path) { const pp = path; path = null; pathG.clear(); finishPath(pp); } drag = null; pan = null; };
cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('wheel', e => {
  e.preventDefault();
  const k = e.deltaY > 0 ? 0.92 : 1 / 0.92;
  if (e.altKey && selected) selected.box.scale.set(selected.box.scale.x * k, selected.box.scale.y * k);
  else if (e.shiftKey && selected) selected.box.rotation += (e.deltaY > 0 ? 1 : -1) * 0.07;
  else { const p = pos(e), w = toWorld(p.x, p.y); view.s = Math.min(8, Math.max(0.1, view.s * k)); view.x = p.x - w.x * view.s; view.y = p.y - w.y * view.s; applyView(); }
  commitSoon();
}, { passive: false });
addEventListener('keydown', e => {
  const t = e.target as HTMLInputElement;
  if (e.ctrlKey || e.metaKey) {
    const k = e.key.toLowerCase();
    if (k === 's') { e.preventDefault(); saveProject(); return; }
    if (k === 'o') { e.preventDefault(); $<HTMLInputElement>('file-proj').click(); return; }
    if (t.tagName === 'INPUT' && t.type === 'text') return;
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); } else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    return;
  }
  if (t.tagName === 'INPUT' && t.type === 'text') return;
  if ((e.key === 'Delete' || e.key === 'Backspace') && selected) { removeLayer(selected); commit(); }
  if (e.key === 'Enter') samValidate();
  if (e.key === 'Escape') { samClear(); path = null; pathG.clear(); if (tool !== 'move') setTool(tool); }
});

// ---- surcouche de sélection
app.ticker.add(() => {
  selG.clear();
  if (!selected) return;
  const l = selected, w = l.baked.width, h = l.baked.height;
  const q = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }].map(c => l.box.toGlobal(c));
  selG.poly(q.flatMap(c => [c.x, c.y])).stroke({ width: 1.5, color: 0xe8344a, alpha: 0.9 });
});

// accès console pour les tests
(window as any).__app = { loadProject, saveProject, addLayer, layers, replaceBase, cutoutFlat, get selected() { return selected; } };
commit();
status('Glisse des images ici, ou colle-les (Ctrl+V).');
