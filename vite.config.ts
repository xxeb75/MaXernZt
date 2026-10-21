import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const version = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')).version.replace(/\.0$/, '') as string;
export default defineConfig({ base: './', server: { port: 5173 }, build: { target: 'es2022' }, define: { __APP_VERSION__: JSON.stringify(version) } });
