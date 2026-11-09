// Quadro da entrega: primeira tela de cada pagina no celular e no computador.
const { chromium } = require('/Users/izzat/wa-export/node_modules/playwright');
const fs = require('fs'); const path = require('path');
(async () => {
  const [telas, saida] = process.argv.slice(2);
  const { execSync } = require('child_process');
  const paginas = [['_index_html', 'Home'], ['_catalogo_html_q_farol_20compass', 'Busca no catálogo'], ['_peca_', 'Página da peça'],
    ['_carros_volvo_xc60_html', 'Página do carro'], ['_carros_html', 'Todos os carros'], ['_categoria_iluminacao_html', 'Categoria'],
    ['_marca_volvo_html', 'Marca'], ['_como_comprar_html', 'Como comprar'], ['_garantia_html', 'Garantia e trocas'],
    ['_sobre_html', 'O pátio'], ['_procuro_peca_html', 'Procuro peça'], ['_404_html', 'Página 404']];
  const arqs = fs.readdirSync(telas);
  const achar = (pre, tam) => arqs.find((f) => f.startsWith(pre) && f.includes(`-${tam}-light`));
  const corte = (f, w, h) => { const out = path.join(saida, `_c_${f}`); execSync(`python3 -c "from PIL import Image; im=Image.open('${path.join(telas, f)}'); W,H=im.size; im.crop((0,0,W,min(H,int(W*${h}/${w})))).save('${out}')"`); return 'data:image/png;base64,' + fs.readFileSync(out).toString('base64'); };
  const cards = paginas.map(([pre, nome]) => {
    const pc = achar(pre, '1440x900'), cel = achar(pre, '390x844');
    if (!pc || !cel) return '';
    return `<div class="c"><h2>${nome}</h2><div class="t"><img src="${corte(pc, 1440, 1000)}"><img src="${corte(cel, 390, 760)}"></div></div>`;
  }).join('');
  const font = path.resolve('node_modules/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2');
  const html = `<!doctype html><meta charset="utf-8"><style>@font-face{font-family:A;src:url('file://${font}')}
  body{margin:0;padding:56px;background:#ececf0;font-family:A,sans-serif;color:#1d1d1f}
  h1{font-stretch:72%;font-weight:850;font-size:66px;margin:0}.sub{font-size:22px;color:#5b5b61;margin:6px 0 36px}
  .g{display:grid;grid-template-columns:repeat(3,1fr);gap:28px}.c{background:#fff;border-radius:24px;padding:20px;box-shadow:0 18px 44px -24px rgb(0 0 0/.35)}
  .c h2{font-stretch:80%;font-weight:820;font-size:28px;margin:0 0 12px}.t{display:grid;grid-template-columns:1fr 32%;gap:12px;align-items:start}
  .t img{width:100%;border-radius:12px;box-shadow:0 0 0 1px rgb(0 0 0/.08)}</style>
  <h1>Site novo da Izzat Car — entrega</h1><p class="sub">Direção A · Oficina clara. Todas as páginas no computador e no celular, com peças, preços e fotos reais.</p><div class="g">${cards}</div>`;
  fs.writeFileSync(path.join(saida, 'entrega.html'), html);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 2400, height: 1400 } });
  await p.goto('file://' + path.join(saida, 'entrega.html')); await p.waitForTimeout(800);
  await p.screenshot({ path: path.join(saida, '_QUADRO-ENTREGA.png'), fullPage: true }); await b.close();
  for (const f of fs.readdirSync(saida)) if (f.startsWith('_c_')) fs.unlinkSync(path.join(saida, f));
})();
