import { defineConfig } from '@playwright/test';

// Tests d'intégration : l'appli dans un vrai Chrome (déjà installé), pilotée à la souris et au clavier.
// On vérifie des invariants fonctionnels (ordre, sauvegarde, pose de repos), pas le rendu pixel par pixel.
export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5199', channel: 'chrome', headless: true, viewport: { width: 1500, height: 900 }, acceptDownloads: true },
  webServer: { command: 'npx vite --port 5199 --strictPort', url: 'http://localhost:5199', reuseExistingServer: true, timeout: 60_000 },
});
