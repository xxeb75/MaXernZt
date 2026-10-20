// Banque d'images prédécoupées : formes prêtes à l'emploi (dessinées ici) + « Ma banque » (images détourées enregistrées sur l'appareil, IndexedDB).
import { makeCanvas } from './sticker';

// ---- petit accès IndexedDB
const DB = 'maxernzt';
let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  return (dbp ??= new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('bank', { keyPath: 'id', autoIncrement: true }); r.result.createObjectStore('kv'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
}
async function tx<T>(store: string, mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((res, rej) => { const q = f(d.transaction(store, mode).objectStore(store)); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
}
export const kvGet = <T>(key: string) => tx<T | undefined>('kv', 'readonly', s => s.get(key));
export const kvPut = (key: string, v: unknown) => tx('kv', 'readwrite', s => s.put(v, key));
export const kvDel = (key: string) => tx('kv', 'readwrite', s => s.delete(key));

// ---- ma banque
export interface BankItem { id?: number; name: string; blob: Blob; thumb: string; w: number; h: number }
export const bankList = () => tx<BankItem[]>('bank', 'readonly', s => s.getAll());
export const bankRemove = (id: number) => tx('bank', 'readwrite', s => s.delete(id));
const toBlob = (c: HTMLCanvasElement) => new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('export impossible'))), 'image/png'));
export async function bankAdd(name: string, c: HTMLCanvasElement) {
  const k = Math.min(1, 96 / Math.max(c.width, c.height)), t = makeCanvas(c.width * k, c.height * k);
  t.getContext('2d')!.drawImage(c, 0, 0, t.width, t.height);
  const item: BankItem = { name, blob: await toBlob(c), thumb: t.toDataURL(), w: c.width, h: c.height };
  return tx('bank', 'readwrite', s => s.add(item));
}
export async function bankCanvas(it: BankItem): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(it.blob), c = makeCanvas(bmp.width, bmp.height);
  c.getContext('2d')!.drawImage(bmp, 0, 0); return c;
}

// ---- formes prêtes à l'emploi
type Draw = (c: CanvasRenderingContext2D) => void;   // dessine dans un carré de 400 px
const star = (cx: number, cy: number, R: number, r: number, n: number) => { const p = new Path2D(); for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + (i * Math.PI) / n, d = i % 2 ? r : R; p[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * d, cy + Math.sin(a) * d); } p.closePath(); return p; };
export const SHAPES: { id: string; name: string; draw: Draw }[] = [
  { id: 'star', name: 'Étoile', draw: c => { c.fillStyle = '#ffd23f'; c.fill(star(200, 210, 185, 80, 5)); } },
  { id: 'heart', name: 'Cœur', draw: c => { c.fillStyle = '#ff3b6b'; c.beginPath(); c.moveTo(200, 360); c.bezierCurveTo(-20, 220, 70, 20, 200, 130); c.bezierCurveTo(330, 20, 420, 220, 200, 360); c.fill(); } },
  { id: 'arrow', name: 'Flèche', draw: c => { c.fillStyle = '#2d9cdb'; c.beginPath(); c.moveTo(20, 150); c.lineTo(230, 150); c.lineTo(230, 60); c.lineTo(385, 200); c.lineTo(230, 340); c.lineTo(230, 250); c.lineTo(20, 250); c.closePath(); c.fill(); } },
  { id: 'bolt', name: 'Éclair', draw: c => { c.fillStyle = '#ffb400'; c.beginPath(); c.moveTo(250, 10); c.lineTo(80, 220); c.lineTo(190, 220); c.lineTo(140, 390); c.lineTo(330, 160); c.lineTo(215, 160); c.closePath(); c.fill(); } },
  { id: 'burst', name: 'Explosion', draw: c => { c.fillStyle = '#ff4d00'; c.fill(star(200, 200, 190, 105, 12)); c.fillStyle = '#ffd23f'; c.fill(star(200, 200, 125, 70, 12)); } },
  { id: 'bubble', name: 'Bulle', draw: c => { c.fillStyle = '#fafafa'; c.strokeStyle = '#1d1d1d'; c.lineWidth = 9; c.lineJoin = 'round'; c.beginPath(); c.ellipse(200, 165, 180, 130, 0, 0, Math.PI * 2); c.moveTo(120, 265); c.lineTo(80, 380); c.lineTo(220, 285); c.fill(); c.stroke(); } },
  { id: 'circle', name: 'Disque', draw: c => { c.fillStyle = '#ff6a3d'; c.beginPath(); c.arc(200, 200, 185, 0, Math.PI * 2); c.fill(); } },
  { id: 'target', name: 'Cible', draw: c => { [[185, '#e53935'], [145, '#fafafa'], [105, '#e53935'], [65, '#fafafa'], [28, '#e53935']].forEach(([r, col]) => { c.fillStyle = col as string; c.beginPath(); c.arc(200, 200, r as number, 0, Math.PI * 2); c.fill(); }); } },
  { id: 'cross', name: 'Croix', draw: c => { c.fillStyle = '#e53935'; c.beginPath(); c.moveTo(150, 15); c.lineTo(250, 15); c.lineTo(250, 150); c.lineTo(385, 150); c.lineTo(385, 250); c.lineTo(250, 250); c.lineTo(250, 385); c.lineTo(150, 385); c.lineTo(150, 250); c.lineTo(15, 250); c.lineTo(15, 150); c.lineTo(150, 150); c.closePath(); c.fill(); } },
  { id: 'triangle', name: 'Triangle', draw: c => { c.fillStyle = '#2ecc71'; c.beginPath(); c.moveTo(200, 20); c.lineTo(385, 370); c.lineTo(15, 370); c.closePath(); c.fill(); } },
  { id: 'cloud', name: 'Nuage', draw: c => { c.fillStyle = '#9ad0ff'; c.beginPath(); c.arc(120, 230, 85, Math.PI * 0.5, Math.PI * 1.5); c.arc(205, 140, 95, Math.PI, Math.PI * 2); c.arc(300, 205, 80, Math.PI * 1.2, Math.PI * 0.5); c.closePath(); c.fill(); c.fillRect(120, 200, 180, 115); } },
  { id: 'moon', name: 'Lune', draw: c => { c.fillStyle = '#f4e285'; c.beginPath(); c.arc(200, 200, 185, 0, Math.PI * 2); c.fill(); c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(285, 160, 150, 0, Math.PI * 2); c.fill(); } },
  { id: 'strip', name: 'Bande de papier', draw: c => { c.fillStyle = '#f2f0e8'; c.beginPath(); c.moveTo(10, 130); for (let x = 10; x <= 390; x += 19) c.lineTo(x, 130 + (x / 19 % 2 ? -7 : 5)); for (let x = 390; x >= 10; x -= 17) c.lineTo(x, 270 + (x / 17 % 2 ? 6 : -6)); c.closePath(); c.fill(); } },
];
export function makeShape(id: string, size = 400): HTMLCanvasElement {
  const s = SHAPES.find(x => x.id === id)!, c = makeCanvas(size, size), ctx = c.getContext('2d')!;
  ctx.scale(size / 400, size / 400); s.draw(ctx); return c;
}
