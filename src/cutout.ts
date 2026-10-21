// Détourage : IA (U²-Net via onnxruntime-web) ou fond uni (remplissage par diffusion).
import * as ort from 'onnxruntime-web/wasm';
import { makeCanvas, assetOk } from './sticker';
import ortWasm from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';

ort.env.wasm.wasmPaths = { wasm: ortWasm };
ort.env.wasm.numThreads = Math.min(4, navigator.hardwareConcurrency || 2);

const MODEL_URL = import.meta.env.BASE_URL + 'models/u2netp.onnx';
let sessionPromise: Promise<ort.InferenceSession> | null = null;

export const modelAvailable = () => assetOk(MODEL_URL);

function getSession() {
  sessionPromise ??= ort.InferenceSession.create(MODEL_URL, { executionProviders: ['wasm'] });
  return sessionPromise;
}

/** Applique un masque (0..255, taille w×h) en canal alpha d'une copie de l'image. */
function applyMask(img: HTMLCanvasElement, mask: Uint8ClampedArray): HTMLCanvasElement {
  const out = makeCanvas(img.width, img.height);
  const ctx = out.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const id = ctx.getImageData(0, 0, out.width, out.height);
  for (let i = 0; i < mask.length; i++) id.data[i * 4 + 3] = Math.min(id.data[i * 4 + 3], mask[i]);
  ctx.putImageData(id, 0, 0);
  return out;
}

export async function cutoutAI(img: HTMLCanvasElement): Promise<HTMLCanvasElement> {
  const S = 320;
  const session = await getSession();
  const small = makeCanvas(S, S);
  small.getContext('2d')!.drawImage(img, 0, 0, S, S);
  const px = small.getContext('2d')!.getImageData(0, 0, S, S).data;
  const mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225];
  const input = new Float32Array(3 * S * S);
  for (let i = 0; i < S * S; i++) for (let c = 0; c < 3; c++) input[c * S * S + i] = (px[i * 4 + c] / 255 - mean[c]) / std[c];
  const res = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, S, S]) });
  const out = res[session.outputNames[0]].data as Float32Array;
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < S * S; i++) { mn = Math.min(mn, out[i]); mx = Math.max(mx, out[i]); }
  const mc = makeCanvas(S, S), mctx = mc.getContext('2d')!;
  const md = mctx.createImageData(S, S);
  for (let i = 0; i < S * S; i++) { const v = ((out[i] - mn) / (mx - mn || 1)) * 255; md.data[i * 4] = md.data[i * 4 + 1] = md.data[i * 4 + 2] = 255; md.data[i * 4 + 3] = v; }
  mctx.putImageData(md, 0, 0);
  const big = makeCanvas(img.width, img.height), bctx = big.getContext('2d')!;
  bctx.imageSmoothingQuality = 'high';
  bctx.drawImage(mc, 0, 0, big.width, big.height);
  const bd = bctx.getImageData(0, 0, big.width, big.height).data;
  const mask = new Uint8ClampedArray(big.width * big.height);
  for (let i = 0; i < mask.length; i++) { const a = bd[i * 4 + 3]; mask[i] = a < 40 ? 0 : a > 215 ? 255 : (a - 40) * (255 / 175); }
  return applyMask(img, mask);
}

/** Fond uni : couleur estimée sur les bords, remplissage depuis les bords avec tolérance. */
export function cutoutFlat(img: HTMLCanvasElement, tol: number): HTMLCanvasElement {
  const { width: w, height: h } = img;
  const d = img.getContext('2d')!.getImageData(0, 0, w, h).data;
  const samples: number[][] = [];
  for (let x = 0; x < w; x += Math.max(1, w >> 6)) { samples.push([0, x], [h - 1, x]); }
  for (let y = 0; y < h; y += Math.max(1, h >> 6)) { samples.push([y, 0], [y, w - 1]); }
  const ch = [0, 1, 2].map(c => samples.map(([y, x]) => d[(y * w + x) * 4 + c]).sort((a, b) => a - b)[samples.length >> 1]);
  const dist = (i: number) => Math.hypot(d[i * 4] - ch[0], d[i * 4 + 1] - ch[1], d[i * 4 + 2] - ch[2]);
  const bg = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (x: number, y: number) => { const i = y * w + x; if (!bg[i] && dist(i) < tol) { bg[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const i = stack.pop()!, x = i % w, y = (i / w) | 0;
    if (x > 0) push(x - 1, y); if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1); if (y < h - 1) push(x, y + 1);
  }
  // masque adouci
  const mc = makeCanvas(w, h), mctx = mc.getContext('2d')!;
  const md = mctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) { md.data[i * 4] = md.data[i * 4 + 1] = md.data[i * 4 + 2] = 255; md.data[i * 4 + 3] = bg[i] ? 0 : 255; }
  mctx.putImageData(md, 0, 0);
  const soft = makeCanvas(w, h), sctx = soft.getContext('2d')!;
  sctx.filter = 'blur(0.8px)'; sctx.drawImage(mc, 0, 0);
  const sd = sctx.getImageData(0, 0, w, h).data;
  const mask = new Uint8ClampedArray(w * h);
  for (let i = 0; i < mask.length; i++) mask[i] = sd[i * 4 + 3];
  return applyMask(img, mask);
}
