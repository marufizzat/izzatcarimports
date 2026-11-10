// Capas leves dos cartões. A capa de estúdio tem 1000 px e o cartão mostra 125–300 px: o celular baixava ~41 KB por
// cartão (a 1ª foto do catálogo levava 4 s no 4G lento). Aqui saem as reduzidas de 400 e 640 px, da capa que o site
// usa (a maquiada, public/estudio-pro/, manda; senão a automática, public/estudio/):
//   public/estudio-400/<MLB>.webp  (~8 KB: tela 1x/2x)      public/estudio-640/<MLB>.webp  (~17 KB: iPhone e Android 3x)
// Por que 640 e não 600: o cartão de 208 px (parecidas, "do mesmo carro", carrossel) num celular 3x pede 624 px; com 600
// o navegador pulava para a capa inteira.
//
// Roda no começo de todo build (integracoes/capas-cartao.mjs) e refaz só o que falta ou mudou: o hash de cada capa fica
// em src/data/capas-cartao.json. Pasta e manifesto ficam fora do git; o robô (atualizar.yml) guarda os dois no cache do
// Actions (a capa automática chega do ramo capas-estudio com data nova a cada rodada: por isso hash, nunca data).
// Reduzida de capa trocada sai ANTES de qualquer coisa (nunca fica a de uma capa velha); a de peça sem capa também sai.
// Sem o sharp (ou se ele falha numa capa): essa capa fica sem reduzida e o cartão usa a capa inteira.
//
// No fim grava a coluna "r" no public/dados/busca.json ('1' = as reduzidas são da capa que o "e" diz), para os
// cartões montados no navegador (catálogo, grade do ano, parecidas da 404). O build lê o manifesto (src/lib/dados.ts).
// Uso na pasta site/:  node scripts/capas-cartao.mjs [--tudo]   (o build já roda sozinho; --tudo refaz todas)
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync, renameSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const LARGURAS = [400, 640];
const QUALIDADE = 78; // nítida em retina 2x num cartão de 170–200 px (conferida em recortes lado a lado)
const pastaDe = (w) => `estudio-${w}`;
const hashDe = (buf) => createHash('sha1').update(buf).digest('hex').slice(0, 12);

/** { ok, feitas, iguais, apagadas, falhas, comR, total, ms } */
export async function capasCartao({ raiz = process.cwd(), tudo = false, log = console.log } = {}) {
  const t0 = Date.now();
  const pub = join(raiz, 'public');
  const arqMan = join(raiz, 'src', 'data', 'capas-cartao.json');
  let antes = {};
  try { antes = existsSync(arqMan) ? JSON.parse(readFileSync(arqMan, 'utf-8')) : {}; } catch { antes = {}; }
  const ids = (p) => (existsSync(join(pub, p)) ? readdirSync(join(pub, p)).filter((f) => /^MLB\d+\.webp$/.test(f)).map((f) => f.slice(0, -5)) : []);
  // a capa que o site usa: a maquiada manda (a mesma regra de capaEstudio em lib/dados.ts e de marcar() em capas_estudio.py)
  const fonte = new Map();
  for (const id of ids('estudio')) fonte.set(id, 'estudio');
  for (const id of ids('estudio-pro')) fonte.set(id, 'estudio-pro');
  for (const w of LARGURAS) mkdirSync(join(pub, pastaDe(w)), { recursive: true });
  const arq = (w, id) => join(pub, pastaDe(w), `${id}.webp`);
  let apagadas = 0;
  const apagar = (id) => { for (const w of LARGURAS) if (existsSync(arq(w, id))) { unlinkSync(arq(w, id)); apagadas++; } };
  // reduzida sem capa (peça vendida, "sem_capa" do capas_ajustes.json): sai
  for (const w of LARGURAS) for (const id of ids(pastaDe(w))) if (!fonte.has(id)) { unlinkSync(arq(w, id)); apagadas++; }

  const manifesto = {};
  const fila = [];
  let iguais = 0;
  for (const [id, f] of fonte) {
    const buf = readFileSync(join(pub, f, `${id}.webp`));
    const h = hashDe(buf);
    const v = antes[id];
    if (!tudo && v && v.f === f && v.h === h && LARGURAS.every((w) => existsSync(arq(w, id)))) { manifesto[id] = v; iguais++; continue; }
    apagar(id); // mudou, trocou de pasta ou falta: a velha sai já
    fila.push({ id, f, h, buf });
  }

  let sharp = null;
  if (fila.length) {
    try { sharp = (await import('sharp')).default; } catch (e) {
      log(`capas do cartão: sem o sharp (${String(e.message).split('\n')[0]}): ${fila.length} capas ficam sem reduzida (o cartão usa a capa inteira)`);
    }
  }
  let feitas = 0, falhas = 0, pequenas = 0;
  if (sharp) {
    const tarefas = fila.slice();
    const um = async () => {
      for (let t = tarefas.shift(); t; t = tarefas.shift()) {
        try {
          const { width: W } = await sharp(t.buf).metadata();
          if (!W || W <= LARGURAS[LARGURAS.length - 1]) { pequenas++; continue; } // capa pequena: o cartão usa ela mesma
          for (const w of LARGURAS) {
            const out = await sharp(t.buf).resize({ width: w }).webp({ quality: QUALIDADE, effort: 6 }).toBuffer();
            writeFileSync(arq(w, t.id) + '.tmp', out);
            renameSync(arq(w, t.id) + '.tmp', arq(w, t.id));
          }
          manifesto[t.id] = { f: t.f, h: t.h, w: W };
          feitas++;
        } catch (e) {
          falhas++;
          apagar(t.id);
          if (falhas <= 5) log(`capas do cartão: ${t.id} falhou (${String(e.message).split('\n')[0]})`);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.max(2, availableParallelism()) }, um));
  }

  // uma capa por linha, em ordem (o arquivo fica estável entre rodadas: a chave do cache do robô é o hash dele)
  const chaves = Object.keys(manifesto).sort();
  mkdirSync(join(raiz, 'src', 'data'), { recursive: true });
  writeFileSync(arqMan, `{\n${chaves.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(manifesto[k])}`).join(',\n')}\n}\n`);

  // coluna "r" do índice da busca (os cartões do navegador): só quando a reduzida é da capa que o "e" diz
  let comR = 0, total = 0;
  const arqBusca = join(pub, 'dados', 'busca.json');
  if (existsSync(arqBusca)) {
    const ix = JSON.parse(readFileSync(arqBusca, 'utf-8'));
    const e = ix.e || '';
    ix.r = ix.id.map((id, k) => {
      const m = manifesto[id];
      const ok = !!m && ((e[k] === '2' && m.f === 'estudio-pro') || (e[k] === '1' && m.f === 'estudio'));
      if (ok) comR++;
      return ok ? '1' : '0';
    }).join('');
    total = ix.id.length;
    writeFileSync(arqBusca, JSON.stringify(ix));
  }
  const ms = Date.now() - t0;
  log(`capas do cartão: ${chaves.length} com reduzida de ${LARGURAS.join('/')} px (${feitas} feitas, ${iguais} em dia, ${apagadas} apagadas`
    + `${pequenas ? `, ${pequenas} capas pequenas sem reduzida` : ''}${falhas ? `, ${falhas} falharam` : ''}); busca.json: ${comR}/${total} com "r"; ${(ms / 1000).toFixed(1)} s`);
  return { feitas, iguais, apagadas, falhas, comR, total, ms };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await capasCartao({ tudo: process.argv.includes('--tudo') });
