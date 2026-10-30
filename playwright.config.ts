import { defineConfig } from '@playwright/test';

// Tests d'intégration : l'appli dans un vrai Chrome (déjà installé), pilotée à la souris et au clavier.
// On vérifie des invariants fonctionnels (ordre, sauvegarde, pose de repos), pas le rendu pixel par pixel.
// E2E_CSP=1 : même scénarios sur la version compilée, servie avec la CSP de Tauri (toute violation est une erreur de console).
const csp = !!process.env.E2E_CSP, port = csp ? 5198 : 5199;
export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${port}`, channel: 'chrome', headless: true, viewport: { width: 1500, height: 900 }, acceptDownloads: true },
  webServer: csp
    ? { command: `npx vite build --outDir .csp-dist --emptyOutDir && node e2e/csp-server.mjs .csp-dist ${port}`, url: `http://localhost:${port}`, reuseExistingServer: false, timeout: 180_000 }
    : { command: `npx vite --port ${port} --strictPort`, url: `http://localhost:${port}`, reuseExistingServer: true, timeout: 60_000 },
});
