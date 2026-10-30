// Télécharge les modèles d'IA (≈ 49 Mo, licences Apache-2.0) dans public/models/ et vérifie leur empreinte SHA-256.
// Les URLs sont épinglées (version publiée, révision Hugging Face) : un fichier modifié en amont fait échouer la construction.
// Usage : node scripts/fetch-models.mjs      (ne retélécharge pas un fichier déjà présent et valide)
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const HF = 'https://huggingface.co/Acly/MobileSAM/resolve/0d3b403339b4674a82493d5e97964dd78089ddc8/';
const MODELS = [
  { file: 'u2netp.onnx', url: 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx', sha256: '309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8' },
  { file: 'mobile_sam_image_encoder.onnx', url: HF + 'mobile_sam_image_encoder.onnx', sha256: '580f5fb648ea1062c0aabc26217aed56921985f03f0cbbd852bba81d760cc749' },
  { file: 'sam_mask_decoder_single.onnx', url: HF + 'sam_mask_decoder_single.onnx', sha256: '93915fc7c993ab9d59ab8c9ccd3bce37f7509c81ab4150a74abd4d2abbd8570d' },
];

const dir = resolve(import.meta.dirname, '..', 'public', 'models');
mkdirSync(dir, { recursive: true });
const sha = buf => createHash('sha256').update(buf).digest('hex');

let failed = false;
for (const m of MODELS) {
  const dest = resolve(dir, m.file);
  if (existsSync(dest) && sha(readFileSync(dest)) === m.sha256) { console.log('ok (déjà présent)', m.file); continue; }
  const r = await fetch(m.url, { redirect: 'follow' });
  if (!r.ok) { console.error(`échec ${m.file} : HTTP ${r.status}`); failed = true; continue; }
  const buf = Buffer.from(await r.arrayBuffer()), got = sha(buf);
  if (got !== m.sha256) { console.error(`EMPREINTE INATTENDUE pour ${m.file}\n  attendue ${m.sha256}\n  reçue    ${got}`); failed = true; continue; }
  writeFileSync(dest + '.part', buf); rmSync(dest, { force: true }); renameSync(dest + '.part', dest);
  console.log('téléchargé et vérifié', m.file, `(${(buf.length / 1e6).toFixed(1)} Mo)`);
}
process.exit(failed ? 1 : 0);
