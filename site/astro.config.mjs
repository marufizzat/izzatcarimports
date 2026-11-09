// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// URLs iguais as do site antigo: /index.html, /catalogo.html, /peca/<slug>.html
export default defineConfig({
  site: 'https://izzatcarimports.com.br',
  output: 'static',
  // PREVIA=1 gera a prévia (noindex) em dist-previa, sem tocar no dist oficial
  outDir: process.env.PREVIA === '1' ? './dist-previa' : './dist',
  trailingSlash: 'never',
  build: { format: 'file', inlineStylesheets: 'auto' },
  compressHTML: true,
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
});
