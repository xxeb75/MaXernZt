// npm run test:e2e:csp : les scénarios e2e sur la version compilée, servie avec la CSP de Tauri.
import { spawnSync } from 'node:child_process';
const r = spawnSync('npx', ['playwright', 'test', ...process.argv.slice(2)], { stdio: 'inherit', shell: true, env: { ...process.env, E2E_CSP: '1' } });
process.exit(r.status ?? 1);
