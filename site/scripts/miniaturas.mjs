// Miniaturas das artes das famílias (public/arte/v2/topo-cat-<k>.webp, ~1254 px e 40–80 KB) para os cartões baixos
// de "Peças por sistema" da página do carro (64 px na tela). Uso, na pasta site/: node scripts/miniaturas.mjs
// O nome leva o hash do original (topo-cat-motor.<hash>.webp): se a arte mudar, a página volta a usar a arte
// inteira (src/lib/miniatura.ts) até este script rodar de novo — miniatura velha nunca aparece.
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { ehVariante } from './variantes-imagens.mjs';

const DIR = join(process.cwd(), 'public', 'arte', 'v2');
const SAIDA = join(DIR, 'mini');
mkdirSync(SAIDA, { recursive: true });
const atuais = new Set();
let feitas = 0;
// a variante de 640 do topo (variantes-imagens.mjs) não é arte: fica de fora
for (const f of readdirSync(DIR).filter((x) => /^topo-cat-[a-z0-9-]+\.webp$/.test(x) && !ehVariante(x, DIR))) {
  const buf = readFileSync(join(DIR, f));
  const h = createHash('sha1').update(buf).digest('hex').slice(0, 8);
  const nome = f.replace(/\.webp$/, `.${h}.webp`);
  atuais.add(nome);
  if (existsSync(join(SAIDA, nome))) continue;
  // 192 px: o cartão mostra 64 px com um zoom de 1,18 (≈ 76 px), e tela 2x pede ~150 px
  await sharp(buf).resize({ width: 192 }).webp({ quality: 78 }).toFile(join(SAIDA, nome));
  feitas++;
}
let apagadas = 0;
for (const f of readdirSync(SAIDA)) if (!atuais.has(f)) { unlinkSync(join(SAIDA, f)); apagadas++; }
console.log(`miniaturas: ${atuais.size} (${feitas} novas, ${apagadas} velhas apagadas) em public/arte/v2/mini/`);
