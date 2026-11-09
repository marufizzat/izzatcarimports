// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import escopoCurto from './integracoes/escopo-curto.mjs';

// URLs iguais as do site antigo: /index.html, /catalogo.html, /peca/<slug>.html
// Peso: são 5 mil páginas de peça e o GitHub Pages aceita até 1 GB. Por isso o CSS e os scripts pequenos saem
// em arquivos com cache (não repetem dentro de cada página) e o atributo de escopo do Astro fica curto.
export default defineConfig({
  site: 'https://izzatcarimports.com.br',
  output: 'static',
  // PREVIA=1 gera a prévia (noindex) em dist-previa, sem tocar no dist oficial
  outDir: process.env.PREVIA === '1' ? './dist-previa' : './dist',
  trailingSlash: 'never',
  build: { format: 'file', inlineStylesheets: 'never' },
  compressHTML: true,
  integrations: [react(), escopoCurto()],
  vite: {
    plugins: [tailwindcss()],
    // script de componente nunca vai dentro do HTML (arquivo à parte, com cache); o resto segue o padrão do Vite
    build: { assetsInlineLimit: (arquivo) => (arquivo.endsWith('.js') ? false : undefined) },
  },
});
