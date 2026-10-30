import { defineConfig } from 'vitest/config';

// Tests unitaires : seulement tests/. Les scénarios Playwright (e2e/*.spec.ts) ont leur propre lanceur.
export default defineConfig({ test: { include: ['tests/**/*.test.ts'] } });
