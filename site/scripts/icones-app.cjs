// Ícones do app (public/site.webmanifest). Uso, na pasta site/: node scripts/icones-app.cjs
//  - icone-maskable-512/192.png: o icone-512.png ORIGINAL (nunca redesenhado) reduzido a 75% e recortado num disco de borda
//    suave, sobre um fundo igual ao dele (o mesmo degradê escuro). O anel fica a 0,284 do lado: dentro do círculo seguro de
//    80% (raio 0,40) que o Android pode recortar;
//  - app/atalho-*.png (96 px): os atalhos (Catálogo, Meu carro, Lista, WhatsApp) com o desenho dos ícones do site em laranja
//    no mesmo fundo escuro do ícone.
const path = require('path'); const fs = require('fs');
const sharp = require('sharp');
const SITE = path.join(__dirname, '..', 'public');
const WHATS_D = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'icones.ts'), 'utf8').match(/WHATS_D = '([^']+)'/)[1];
const fundo = (n) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${n}" height="${n}"><defs><radialGradient id="g" cx="50%" cy="50%" r="70.7%">
<stop offset="0" stop-color="rgb(38,25,19)"/><stop offset="0.265" stop-color="rgb(30,20,15)"/><stop offset="0.53" stop-color="rgb(19,12,10)"/>
<stop offset="0.75" stop-color="rgb(11,8,7)"/><stop offset="1" stop-color="rgb(9,6,5)"/></radialGradient></defs><rect width="${n}" height="${n}" fill="url(#g)"/></svg>`);
(async () => {
  const N = 512, ESC = 0.75, L = Math.round(N * ESC);
  // o original reduzido, recortado num disco de borda suave (o anel fica a 0,284 do lado: 71% do raio seguro de 0,40)
  const disco = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${L}"><defs><radialGradient id="m" cx="50%" cy="50%" r="50%">
<stop offset="0.80" stop-color="#fff" stop-opacity="1"/><stop offset="0.97" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
<rect width="${L}" height="${L}" fill="url(#m)"/></svg>`);
  const reduzido = await sharp(`${SITE}/icone-512.png`).resize(L, L).composite([{ input: disco, blend: 'dest-in' }]).png().toBuffer();
  const off = Math.round((N - L) / 2);
  const m512 = await sharp(fundo(N)).composite([{ input: reduzido, left: off, top: off }]).png({ compressionLevel: 9 }).toBuffer();
  fs.writeFileSync(`${SITE}/icone-maskable-512.png`, m512);
  fs.writeFileSync(`${SITE}/icone-maskable-192.png`, await sharp(m512).resize(192, 192).png({ compressionLevel: 9 }).toBuffer());
  // atalhos (96 px): o mesmo fundo escuro do ícone e o desenho em laranja, dentro da área segura
  const glifos = {
    catalogo: '<g fill="none" stroke="#FF6A00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></g>',
    carro: '<g fill="none" stroke="#FF6A00" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h14M3 13l2-5.5A2 2 0 0 1 6.9 6h10.2a2 2 0 0 1 1.9 1.5L21 13v4a1 1 0 0 1-1 1h-1.5M3 13v4a1 1 0 0 0 1 1h1.5M3 13h18"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/></g>',
    lista: '<g fill="none" stroke="#FF6A00" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M12 11h4M12 16h4M8 11h.01M8 16h.01"/></g>',
    whats: `<path fill="#FF6A00" d="${WHATS_D}"/>`,
  };
  for (const [nome, g] of Object.entries(glifos)) {
    // 24 unidades do desenho em 46 px (48% do quadrado): dentro do círculo de 80%
    const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><g transform="translate(25 25) scale(1.9167)">${g}</g></svg>`);
    const png = await sharp(fundo(96)).composite([{ input: svg }]).png({ compressionLevel: 9 }).toBuffer();
    fs.mkdirSync(`${SITE}/app`, { recursive: true });
    fs.writeFileSync(`${SITE}/app/atalho-${nome}.png`, png);
  }
  console.log('ok');
})();
