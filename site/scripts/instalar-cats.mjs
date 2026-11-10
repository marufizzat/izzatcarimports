// Instala as artes dos BLOCOS de peças (preparar_dados.py: BLOCOS) a partir dos PNG gerados (cat-<k>.png, quadrados,
// peça em estúdio + nome desenhado embaixo à esquerda; 1536 px de preferência, aceita de 800 a qualquer tamanho).
// Para cada uma (nunca aumenta a arte: PNG de 800 sai em 800):
//   public/arte/v2/cat-<k>.webp       até 1200×1200 (o cartão da grade da home; o grande do bento no PC retina pede ~980)
//   public/arte/v2/topo-cat-<k>.webp  a mesma arte SEM a faixa do nome (o topo da página da categoria), até 1254 px de
//                                      largura; o corte acha onde o nome começa (nome em 1 ou 2 linhas) e, sem achar,
//                                      corta em 79% da altura, como os topos antigos
// e roda scripts/variantes-imagens.mjs (cat-<k>-600 e topo-cat-<k>-640, para o srcset do celular) e
// scripts/miniaturas.mjs (as miniaturas dos topos, para a página do carro).
// Uso, na pasta site/:  node scripts/instalar-cats.mjs [pasta dos PNG] [--teste]
//   pasta padrão: ../../izzatcarimports/output/cats-v5 (a do Codex), ou IZZATCAR_CATS; --teste só mostra o corte.
// Chave que não é bloco (cat-<k>.png com k fora de resumo.json) é avisada e pulada.
import sharp from 'sharp';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const teste = args.includes('--teste');
const ORIGEM = resolve(args.find((a) => !a.startsWith('--')) || process.env.IZZATCAR_CATS || '/Users/izzat/Projects/izzatcarimports/output/cats-v5');
const DESTINO = join(process.cwd(), 'public', 'arte', 'v2');
const CARTAO_MAX = 1200;
const TOPO_MAX = 1254;
const CORTE_PADRAO = 991 / 1254;   // o recorte dos topos antigos

const resumo = join(process.cwd(), 'src', 'data', 'resumo.json');
const blocos = existsSync(resumo) ? new Set(JSON.parse(readFileSync(resumo, 'utf-8')).familias.map((f) => f.k)) : null;

/** Onde começa o nome (fração da altura). O nome fica embaixo à esquerda (1 ou 2 linhas, com o filete laranja); a
 *  peça fica no meio, num pedestal. De baixo para cima, as faixas de linhas com tinta (escura ou laranja): a faixa que
 *  começa na margem esquerda é do nome (letra e filete encostam na margem); a 1ª que não começa ali é a curva de baixo
 *  do pedestal (o meio dele desce mais que as pontas). O corte fica no vão entre os dois. */
async function inicioDoNome(buf) {
  const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const lim = Math.max(3, W * 0.004);
  const tinta = (y, xa, xb) => {
    let n = 0;
    for (let x = Math.round(W * xa); x < Math.round(W * xb); x++) {
      const i = (y * W + x) * C, r = data[i], g = data[i + 1], b = data[i + 2];
      if (0.299 * r + 0.587 * g + 0.114 * b < 110 || (r > 190 && g > 60 && g < 170 && b < 90)) n++;
    }
    return n >= lim;
  };
  const vaoMin = Math.max(2, Math.round(H * 0.006));   // menos que isso é dentro da letra (acento, cedilha)
  const pe = Math.max(2, Math.round(H * 0.006));       // as linhas de baixo da faixa que dizem de quem ela é
  // faixas [base, topo], de baixo para cima
  const faixas = [];
  let y = H - 1;
  while (y > H * 0.4) {
    while (y > H * 0.4 && !tinta(y, 0.02, 0.95)) y--;
    if (y <= H * 0.4) break;
    const base = y;
    let topo = y, vazio = 0;
    for (; y > H * 0.4; y--) {
      if (tinta(y, 0.02, 0.95)) { topo = y; vazio = 0; } else if (++vazio >= vaoMin) break;
    }
    faixas.push([base, topo]);
    const naMargem = [...Array(pe).keys()].some((d) => tinta(base - d, 0.02, 0.22));
    if (!naMargem) break;                        // o pedestal: fim
  }
  if (faixas.length < 2) return null;
  const pedestal = faixas[faixas.length - 1];
  if (pedestal[0] <= H * 0.4 || [...Array(pe).keys()].some((d) => tinta(pedestal[0] - d, 0.02, 0.22))) return null;
  const topo = faixas[faixas.length - 2][1];     // o alto do nome
  const vao = topo - pedestal[0];
  const corte = (topo - Math.min(H * 0.015, vao / 2)) / H;
  return corte >= 0.6 && corte <= 0.86 ? corte : null;
}

if (!existsSync(ORIGEM)) {
  console.log(`instalar-cats: pasta ${ORIGEM} não existe; nada a fazer.`);
  process.exit(0);
}
const pngs = readdirSync(ORIGEM).filter((f) => /^cat-[a-z0-9-]+\.png$/.test(f)).sort();
if (!pngs.length) {
  console.log(`instalar-cats: nenhum cat-<chave>.png em ${ORIGEM}; nada a fazer.`);
  process.exit(0);
}
let feitas = 0;
for (const f of pngs) {
  const k = f.slice(4, -4);
  if (blocos && !blocos.has(k)) { console.log(`  AVISO ${f}: "${k}" não é um bloco do resumo.json (pulei)`); continue; }
  const original = readFileSync(join(ORIGEM, f));
  const meta = await sharp(original).metadata();
  const lado = Math.min(meta.width, meta.height);
  // quadrado (se vier fora do quadrado, o centro)
  const quadrado = await sharp(original)
    .extract({ left: Math.floor((meta.width - lado) / 2), top: Math.floor((meta.height - lado) / 2), width: lado, height: lado })
    .png().toBuffer();
  const achado = await inicioDoNome(quadrado);
  const corte = achado ?? CORTE_PADRAO;
  const larg = Math.min(lado, TOPO_MAX);
  const cartao = Math.min(lado, CARTAO_MAX);
  const altTopo = Math.round(lado * corte);
  console.log(`  ${k}: ${meta.width}×${meta.height} -> cartão ${cartao}, topo ${larg}×${Math.round(larg * corte)} (corte ${(corte * 100).toFixed(1)}%${achado ? '' : ', padrão'})`);
  if (teste) continue;
  await sharp(quadrado).resize(cartao, cartao).webp({ quality: 80 }).toFile(join(DESTINO, `cat-${k}.webp`));
  await sharp(quadrado).extract({ left: 0, top: 0, width: lado, height: altTopo }).resize({ width: larg })
    .webp({ quality: 74 }).toFile(join(DESTINO, `topo-cat-${k}.webp`));
  feitas++;
}
console.log(`instalar-cats: ${feitas} artes instaladas em public/arte/v2/${teste ? ' (teste: nada gravado)' : ''}`);
if (feitas) {
  for (const script of ['variantes-imagens.mjs', 'miniaturas.mjs']) {
    const r = spawnSync(process.execPath, [join('scripts', script)], { stdio: 'inherit' });
    if (r.status) process.exit(r.status);
  }
}
