// Détourage au clic : MobileSAM (encodeur + décodeur ONNX) via onnxruntime-web.
import * as ort from 'onnxruntime-web/wasm';
import { makeCanvas, assetOk } from './sticker';

const ENC = import.meta.env.BASE_URL + 'models/mobile_sam_image_encoder.onnx';
const DEC = import.meta.env.BASE_URL + 'models/sam_mask_decoder_single.onnx';
export type SamPoint = { x: number; y: number; label: 0 | 1 };

let sessions: Promise<[ort.InferenceSession, ort.InferenceSession]> | null = null;
const cache = new WeakMap<HTMLCanvasElement, Promise<ort.Tensor>>();

export async function samAvailable(): Promise<boolean> { return (await Promise.all([ENC, DEC].map(assetOk))).every(Boolean); }

export { ort };
export function load() {
  sessions ??= Promise.all([
    ort.InferenceSession.create(ENC, { executionProviders: ['wasm'] }),
    ort.InferenceSession.create(DEC, { executionProviders: ['wasm'] }),
  ]);
  return sessions;
}

/** Calcule (une seule fois par image) l'embedding de l'image. */
export function embed(img: HTMLCanvasElement): Promise<ort.Tensor> {
  let p = cache.get(img);
  if (!p) {
    p = (async () => {
      const [enc] = await load();
      // prétraitement SAM standard : plus grand côté = 1024, reste rempli avec la couleur moyenne
      const k = 1024 / Math.max(img.width, img.height);
      const sq = makeCanvas(1024, 1024), sc = sq.getContext('2d')!;
      sc.fillStyle = 'rgb(124,116,104)'; sc.fillRect(0, 0, 1024, 1024);
      sc.imageSmoothingQuality = 'high'; sc.drawImage(img, 0, 0, Math.round(img.width * k), Math.round(img.height * k));
      const px = sc.getImageData(0, 0, 1024, 1024).data;
      const data = new Float32Array(1024 * 1024 * 3);
      for (let i = 0; i < 1024 * 1024; i++) { data[i * 3] = px[i * 4]; data[i * 3 + 1] = px[i * 4 + 1]; data[i * 3 + 2] = px[i * 4 + 2]; }
      const out = await enc.run({ input_image: new ort.Tensor('float32', data, [1024, 1024, 3]) });
      return out.image_embeddings;
    })();
    p.catch(() => cache.delete(img));
    cache.set(img, p);
  }
  return p;
}

/** Renvoie un canvas dont l'alpha est le masque de l'objet désigné (même taille que `img`). */
export async function segment(img: HTMLCanvasElement, pts: SamPoint[]): Promise<HTMLCanvasElement> {
  const [, dec] = await load();
  const emb = await embed(img);
  const { width: w, height: h } = img;
  const k = 1024 / Math.max(w, h);
  const n = pts.length + 1;
  const coords = new Float32Array(n * 2), labels = new Float32Array(n);
  pts.forEach((p, i) => { coords[i * 2] = p.x * k; coords[i * 2 + 1] = p.y * k; labels[i] = p.label; });
  labels[n - 1] = -1; // point de remplissage (pas de boîte)
  const out = await dec.run({
    image_embeddings: emb,
    point_coords: new ort.Tensor('float32', coords, [1, n, 2]),
    point_labels: new ort.Tensor('float32', labels, [1, n]),
    mask_input: new ort.Tensor('float32', new Float32Array(256 * 256), [1, 1, 256, 256]),
    has_mask_input: new ort.Tensor('float32', new Float32Array([0]), [1]),
    orig_im_size: new ort.Tensor('float32', new Float32Array([h, w]), [2]),
  });
  const m = out.masks.data as Float32Array;
  const raw = makeCanvas(w, h), rc = raw.getContext('2d')!;
  const id = rc.createImageData(w, h);
  for (let i = 0; i < w * h; i++) { id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = 255; id.data[i * 4 + 3] = m[i] > 0 ? 255 : 0; }
  rc.putImageData(id, 0, 0);
  const soft = makeCanvas(w, h), sc = soft.getContext('2d')!;
  sc.filter = 'blur(0.7px)'; sc.drawImage(raw, 0, 0);
  return soft;
}

/** À appeler quand la base d'un calque change : l'embedding n'est plus valable. */
export function forget(img: HTMLCanvasElement) { cache.delete(img); }
