// Sert un dossier compilé avec la CSP de src-tauri/tauri.conf.json, pour vérifier dans Chrome que l'appli y fonctionne
// (npm run test:e2e:csp). Usage : node e2e/csp-server.mjs <dossier> <port>
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, createReadStream } from 'node:fs';
import { resolve, extname, join } from 'node:path';

const [dir = '.csp-dist', port = '5198'] = process.argv.slice(2);
const root = resolve(dir);
const csp = JSON.parse(readFileSync(resolve('src-tauri/tauri.conf.json'), 'utf8')).app.security.csp;
if (!csp) throw new Error('aucune CSP dans tauri.conf.json');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.maxernzt': 'application/json', '.onnx': 'application/octet-stream' };

createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let f = join(root, p.endsWith('/') ? p + 'index.html' : p);
  if (!f.startsWith(root) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404).end('introuvable'); return; }
  res.writeHead(200, { 'Content-Type': types[extname(f)] ?? 'application/octet-stream', 'Content-Security-Policy': csp, 'Cache-Control': 'no-store' });
  createReadStream(f).pipe(res);
}).listen(+port, () => console.log(`CSP serveur : http://localhost:${port} (${root})`));
