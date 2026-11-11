// Variantes menores das artes grandes de public/arte/v2/, para o srcset (o celular baixa a de 600 px, não a de 1200):
//   carro-<k>.webp     (1200×800)    -> carro-<k>-600.webp e carro-<k>-900.webp   (/carros, home, marca, carro)
//   cat-<k>.webp       (até 1200)    -> cat-<k>-600.webp                           (grade de categorias da home)
//   topo-cat-<k>.webp  (até 1254)    -> topo-cat-<k>-640.webp                      (topo da categoria no celular)
// A arte inteira continua no ar (é a maior do srcset e a prévia do link). Nunca aumenta: variante com largura igual
// ou maior que a da arte não sai.
// O hash da arte de onde cada variante saiu fica em src/data/variantes-arte.json (fora do public: não vai pro ar).
// O build (src/lib/variantes.ts) só põe no srcset a variante feita da arte ATUAL: arte trocada e o script ainda não
// rodou = só a arte inteira (variante velha nunca aparece). Variante de arte que sumiu é apagada.
// Uso, na pasta site/:  node scripts/variantes-imagens.mjs [--tudo]   (sem --tudo refaz só o que mudou)
// Arte nova de carro ou de categoria: rode este script e faça o commit das variantes junto (o CI não gera).
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const DIR = join(process.cwd(), 'public', 'arte', 'v2');
export const MANIFESTO = join(process.cwd(), 'src', 'data', 'variantes-arte.json');
// grupo: quais artes e em que larguras (qualidade igual à da arte inteira: instalar-cats.mjs usa 80 e 74)
export const GRUPOS = [
  { re: /^carro-[a-z0-9-]+\.webp$/, larguras: [600, 900], q: 80 },
  { re: /^cat-[a-z0-9-]+\.webp$/, larguras: [600], q: 80 },
  { re: /^topo-cat-[a-z0-9-]+\.webp$/, larguras: [640], q: 74 },
];
const grupoDe = (nome) => GRUPOS.find((g) => g.re.test(nome));

/** "carro-x-600.webp" é variante se "carro-x.webp" existe e 600 é uma largura do grupo (o carro "peugeot-208" não é
 *  variante de "peugeot": 208 não é largura de variante). */
export function ehVariante(nome, dir = DIR) {
  const m = /^(.+)-(\d+)\.webp$/.exec(nome);
  if (!m) return false;
  const base = `${m[1]}.webp`;
  const g = grupoDe(base);
  return !!g && g.larguras.includes(Number(m[2])) && existsSync(join(dir, base));
}

export const hashDe = (buf) => createHash('sha1').update(buf).digest('hex').slice(0, 12);

async function principal() {
  // sharp só aqui: o teste (src/lib/variantes.test.ts) importa ehVariante sem precisar do sharp (opcional do Astro no CI)
  const { default: sharp } = await import('sharp');
  const tudo = process.argv.includes('--tudo');
  const antes = existsSync(MANIFESTO) ? JSON.parse(readFileSync(MANIFESTO, 'utf-8')) : {};
  const manifesto = {};
  const arquivos = readdirSync(DIR);
  let feitas = 0, iguais = 0, apagadas = 0;
  // variante cuja arte sumiu: só a que ESTE script fez (está no manifesto como variante da arte). Arte de verdade com
  // número no fim (um "carro-fiat-600.webp") nunca está ali, então nunca sai nem vira variante.
  const orfas = new Set(arquivos.filter((f) => {
    const m = /^(.+)-(\d+)\.webp$/.exec(f);
    return !!m && !!antes[`${m[1]}.webp`]?.v?.includes(Number(m[2])) && !existsSync(join(DIR, `${m[1]}.webp`));
  }));
  for (const f of orfas) { unlinkSync(join(DIR, f)); apagadas++; }
  const originais = arquivos.filter((f) => grupoDe(f) && !ehVariante(f) && !orfas.has(f)).sort();
  for (const f of originais) {
    const g = grupoDe(f);
    const buf = readFileSync(join(DIR, f));
    const h = hashDe(buf);
    const { width: W } = await sharp(buf).metadata();
    const larguras = g.larguras.filter((w) => w < W);
    const nomeV = (w) => f.replace(/\.webp$/, `-${w}.webp`);
    const velho = antes[f];
    const emDia = !tudo && velho && velho.h === h && velho.w === W && larguras.every((w) => velho.v.includes(w) && existsSync(join(DIR, nomeV(w))));
    if (emDia) { iguais++; } else {
      for (const w of larguras) await sharp(buf).resize({ width: w }).webp({ quality: g.q, effort: 6 }).toFile(join(DIR, nomeV(w)));
      feitas++;
    }
    // largura que deixou de valer (arte trocada por uma menor): a variante sai
    for (const w of g.larguras) if (!larguras.includes(w) && existsSync(join(DIR, nomeV(w)))) { unlinkSync(join(DIR, nomeV(w))); apagadas++; }
    manifesto[f] = { h, w: W, v: larguras };
  }
  // uma arte por linha (o diff mostra só a que mudou)
  writeFileSync(MANIFESTO, `{\n${Object.entries(manifesto).map(([k, e]) => `  ${JSON.stringify(k)}: ${JSON.stringify(e)}`).join(',\n')}\n}\n`);
  console.log(`variantes: ${originais.length} artes (${feitas} refeitas, ${iguais} em dia, ${apagadas} variantes velhas apagadas); manifesto em src/data/variantes-arte.json`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await principal();
