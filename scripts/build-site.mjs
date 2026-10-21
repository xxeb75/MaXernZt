// Assemble le site : la vitrine (dossier site/) à la racine de dist-web/, l'appli compilée dans dist-web/app/.
// Usage : npm run build:web   (la compilation de l'appli vers dist-web/app est faite juste avant par vite)
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'dist-web');
if (!existsSync(resolve(out, 'app', 'index.html'))) throw new Error("dist-web/app est absent : lance d'abord « vite build --outDir dist-web/app »");
cpSync(resolve(root, 'site'), out, { recursive: true });
writeFileSync(resolve(out, '.nojekyll'), '');   // GitHub Pages : ne pas filtrer les dossiers commençant par _
mkdirSync(resolve(out, 'app'), { recursive: true });
const models = ['u2netp.onnx', 'mobile_sam_image_encoder.onnx', 'sam_mask_decoder_single.onnx'].filter(m => !existsSync(resolve(out, 'app', 'models', m)));
if (models.length) console.warn('Attention : modèles IA absents du site :', models.join(', '), '(le détourage IA ne fonctionnera pas en ligne)');
console.log('Site prêt dans', out);
