// Só o que os testes precisam (o site é montado pelo astro.config.mjs; o vitest não o lê).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // a pausa depois de cada teste (ver o arquivo): sem ela, arquivo de teste longo derruba o vitest com tudo verde
    setupFiles: ['testes/folga.ts'],
  },
});
