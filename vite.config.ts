import { defineConfig, type Plugin } from 'vite';
import { readFileSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const version = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')).version.replace(/\.0$/, '') as string;

// Les dossiers public/scroll-* servent aux pages de travail (scroll-*.html) en dev : ils ne vont ni dans l'exe ni sur le site.
const sansScroll = (): Plugin => {
  let out = '';
  return {
    name: 'sans-scroll',
    apply: 'build',
    configResolved(c) { out = resolve(c.root, c.build.outDir); },
    closeBundle() { for (const d of readdirSync(out)) if (/^scroll-/.test(d)) rmSync(resolve(out, d), { recursive: true, force: true }); },
  };
};

export default defineConfig({ base: './', server: { port: 5173 }, build: { target: 'es2022' }, define: { __APP_VERSION__: JSON.stringify(version) }, plugins: [sansScroll()] });
