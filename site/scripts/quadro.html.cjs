// Gera quadro.html (3 direcoes lado a lado) e fotografa em PNG.
const { chromium } = require('/Users/izzat/wa-export/node_modules/playwright');
const fs = require('fs'); const path = require('path');
(async () => {
  const [dir] = process.argv.slice(2);
  const img = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(dir, f)).toString('base64');
  const D = [
    ['a', 'A · Oficina clara', 'Claro, neutros frios do manual da vitrine. Laranja #FF6A00 com letra grafite. Vídeo da loja numa janela ao lado da busca.'],
    ['b', 'B · Carvão cinematográfico', 'Escuro, cinema. Vídeo do galpão de peças na tela inteira. Laranja #D4550A com letra branca (o do Instagram). Títulos em caixa alta condensada.'],
    ['c', 'C · Híbrido', 'Topo escuro com 3 vídeos da loja (rodas, motores e o showroom) e o catálogo claro. Laranja #FF6A00 com letra grafite.'],
  ];
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face{font-family:A;src:url('file://${process.cwd()}/node_modules/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2')}
  body{margin:0;background:#e9e9ed;font-family:A,sans-serif;color:#1d1d1f;padding:56px}
  h1{font-stretch:72%;font-weight:850;font-size:64px;margin:0 0 6px;letter-spacing:-.01em}
  .sub{font-size:22px;color:#5b5b61;margin:0 0 40px}
  .grade{display:grid;grid-template-columns:repeat(3,1fr);gap:36px}
  .col{background:#fff;border-radius:28px;padding:24px;box-shadow:0 20px 50px -25px rgb(0 0 0/.35)}
  .col h2{font-stretch:78%;font-weight:850;font-size:36px;margin:4px 4px 6px}
  .col p{font-size:17px;line-height:1.45;color:#5b5b61;margin:0 4px 18px;min-height:76px}
  .telas{display:grid;grid-template-columns:1fr 34%;gap:14px;align-items:start}
  .telas img{width:100%;border-radius:14px;box-shadow:0 0 0 1px rgb(0 0 0/.08)}
  .regra{margin-top:40px;display:grid;grid-template-columns:1.3fr 1fr;gap:36px;background:#fff;border-radius:28px;padding:28px;align-items:center}
  .regra img{width:100%;border-radius:16px}
  .regra h3{font-stretch:78%;font-weight:850;font-size:34px;margin:0 0 12px}
  .regra li{font-size:19px;line-height:1.45;margin-bottom:10px}
  </style></head><body>
  <h1>Site novo da Izzat Car — escolha a direção</h1>
  <p class="sub">Mesmo conteúdo, peças e preços reais do estoque. Muda a cor, o tema e a abertura. Pode escolher uma ou misturar.</p>
  <div class="grade">${D.map(([d, t, s]) => `<div class="col"><h2>${t}</h2><p>${s}</p><div class="telas">
    <img src="${img(d + '-pc-dobra.png')}"><img src="${img(d + '-celular-dobra.png')}"></div></div>`).join('')}</div>
  <div class="regra"><img src="${img('regra-banner.png')}"><div><h3>Onde o texto é arte e onde é letra do site</h3><ul>
    <li><b>Banners e chamadas:</b> arte inteira com o texto desenhado (igual ao Instagram), logo original aplicado depois.</li>
    <li><b>Nome da peça, preço, filtros e as 5.316 etiquetas:</b> letra do site, desenhada com a fonte da marca. O Google lê e o robô atualiza a cada 30 min.</li></ul></div></div>
  </body></html>`;
  fs.writeFileSync(path.join(dir, 'quadro.html'), html);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 2400, height: 1400 }, deviceScaleFactor: 1 });
  await p.goto('file://' + path.join(dir, 'quadro.html')); await p.waitForTimeout(600);
  await p.screenshot({ path: path.join(dir, '_QUADRO-3-DIRECOES.png'), fullPage: true });
  await b.close();
})();
