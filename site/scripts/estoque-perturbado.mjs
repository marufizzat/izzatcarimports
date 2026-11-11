// Prova de que os testes que o robô roda não dependem do estoque do dia (rodada 14b, 11/11/2026: a rodada 14 foi
// recusada pelo robô porque as lanternas do XC60 venderam e dois testes da busca tinham o estoque de 09/11 no gabarito).
//
// O que faz, para cada semente (1..N, sorteio com semente: o mesmo número dá o mesmo estoque):
//   1. tira de 2% a 20% dos anúncios do products.json, ao acaso; e, a cada 3 sementes (3, 6, 9...), tira também TODAS as
//      peças de um tipo (a 1ª palavra do nome: "Lanterna") de um carro (o tipo de coisa que travou o robô);
//   2. gera os dados do site como o robô (preparar_dados.py com IZZAT_PRODUTOS, capas_estudio.py --so-marcar);
//   3. roda python testes/test_dados.py e a suíte inteira do site (o mesmo comando do `npm test`).
// No fim imprime a tabela (semente -> resultado) e devolve os dados gerados de antes. Qualquer vermelho aqui é uma bomba
// para o robô: consertar o teste ou o código até dar tudo verde.
//
// Uso (na pasta site/):
//   node scripts/estoque-perturbado.mjs                    30 sementes
//   node scripts/estoque-perturbado.mjs --sementes 5 --de 12   as sementes 12 a 16
//   node scripts/estoque-perturbado.mjs --hoje             só o estoque de agora (tira o que saiu do /dados/ativas.json
//                                                          do site no ar; --ativas arquivo.json para um arquivo salvo)
//   node scripts/estoque-perturbado.mjs --hoje --novas busca-do-ar.json --so busca   e acrescenta ao busca.json as peças
//                                                          novas do índice do ar (só o índice: vale para os testes da
//                                                          busca; o pecas.json não as tem e o test_dados.py é pulado)
//   node scripts/estoque-perturbado.mjs --arquivo outro-products.json   outro estoque inteiro (um products.json antigo
//                                                          do git, por exemplo: peças que hoje não existem mais)
//   --so "busca"        só os arquivos de teste com esse texto no caminho (mais rápido; a prova completa é sem isto)
//   --manter            deixa o estoque mexido no lugar no fim (para investigar; rodar de novo sem --manter devolve)
//   PYTHON=/caminho/python   o Python com as dependências do preparar_dados.py (padrão: python3)
//
// Nada daqui vai para o git: o products.json mexido e a cópia dos dados gerados ficam em node_modules/.cache.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RAIZ = resolve(SITE, '..');
const CACHE = join(SITE, 'node_modules', '.cache', 'estoque-perturbado');
const ORIGINAL = join(CACHE, 'original');
const GERADOS = [
  ['src/data/pecas.json', 'pecas.json'], ['src/data/resumo.json', 'resumo.json'],
  ['src/data/unidos.json', 'unidos.json'], ['public/dados/busca.json', 'busca.json'],
];
const PYTHON = process.env.PYTHON || 'python3';

const args = process.argv.slice(2);
const op = (nome, padrao) => { const i = args.indexOf(`--${nome}`); return i < 0 ? padrao : args[i + 1]; };
const tem = (nome) => args.includes(`--${nome}`);
const N = Number(op('sementes', 30));
const DE = Number(op('de', 1));
const SO = op('so', '');

/** Sorteio com semente (mulberry32): o mesmo número, o mesmo estoque. */
function sorteio(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ler = (arq) => JSON.parse(readFileSync(arq, 'utf8'));
const normal = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Guarda os dados gerados de agora (uma vez por execução) e devolve no fim. */
function guardar() {
  mkdirSync(ORIGINAL, { recursive: true });
  for (const [de, nome] of GERADOS) copyFileSync(join(SITE, de), join(ORIGINAL, nome));
}
function devolver() {
  for (const [de, nome] of GERADOS) if (existsSync(join(ORIGINAL, nome))) copyFileSync(join(ORIGINAL, nome), join(SITE, de));
}

// (processo filho sem travar o Node: o Ctrl+C e o kill devolvem os dados na hora)
let filho = null;
function rodar(cmd, argv, opts = {}) {
  return new Promise((ok) => {
    let saida = '';
    // (grupo próprio: parar mata também os processos do vitest)
    filho = spawn(cmd, argv, { cwd: RAIZ, stdio: ['ignore', 'pipe', 'pipe'], detached: true, ...opts });
    filho.stdout.on('data', (d) => { saida = (saida + d).slice(-200000); });
    filho.stderr.on('data', (d) => { saida = (saida + d).slice(-200000); });
    filho.on('error', (e) => { filho = null; ok({ ok: false, saida: `${saida}\n${e.message}` }); });
    filho.on('close', (codigo) => { filho = null; ok({ ok: codigo === 0, saida }); });
  });
}

/** Gera os dados do site a partir de um products.json (os passos do robô antes do `npm test`). */
async function gerar(produtos) {
  const arq = join(CACHE, 'products.json');
  writeFileSync(arq, JSON.stringify(produtos));
  const env = { ...process.env, IZZAT_PRODUTOS: arq, PYTHONIOENCODING: 'utf-8' };
  const p = await rodar(PYTHON, ['-u', 'preparar_dados.py'], { env });
  if (!p.ok) return { ok: false, onde: 'preparar_dados.py', saida: p.saida.slice(-3000) };
  await rodar(PYTHON, ['-u', 'capas_estudio.py', '--so-marcar'], { env }); // no robô: continue-on-error
  return { ok: true };
}

/** Os testes que o robô roda: python testes/test_dados.py e a suíte do site. */
async function testar(semPython = false) {
  const falhas = [];
  // (com --novas as peças novas entram só no busca.json: o test_dados.py compara o índice com o pecas.json e não vale)
  if (!semPython) {
    const py = await rodar(PYTHON, ['-u', 'testes/test_dados.py'], { env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
    if (!py.ok) falhas.push(`test_dados.py: ${py.saida.trim().split('\n').slice(-3).join(' / ')}`);
  }
  const rel = join(CACHE, 'vitest.json');
  rmSync(rel, { force: true });
  // o mesmo comando do `npm test` (package.json), com o relatório em JSON
  const v = await rodar('npx', ['vitest', 'run', '--testTimeout=30000', '--hookTimeout=30000', '--reporter=json', `--outputFile=${rel}`, ...(SO ? [SO] : [])], { cwd: SITE });
  let testes = 0, arquivos = 0;
  if (existsSync(rel)) {
    const j = ler(rel);
    testes = j.numTotalTests; arquivos = j.numTotalTestSuites ? j.testResults.length : 0;
    for (const f of j.testResults) {
      if (f.status !== 'passed' && !f.assertionResults.some((a) => a.status === 'failed')) falhas.push(`${f.name.replace(`${SITE}/`, '')}: ${String(f.message).split('\n')[0]}`);
      for (const a of f.assertionResults) if (a.status === 'failed') {
        falhas.push(`${f.name.replace(`${SITE}/`, '')} > ${a.title}: ${String(a.failureMessages?.[0] ?? '').split('\n    at ')[0].replace(/\s+/g, ' ').slice(0, 1500)}`);
      }
    }
  } else falhas.push(`vitest não rodou: ${v.saida.slice(-600)}`);
  if (!v.ok && !falhas.length) falhas.push(`vitest saiu com erro: ${v.saida.slice(-600)}`);
  return { falhas, testes, arquivos };
}

/** O tipo (a 1ª palavra do nome) e os carros de cada anúncio, pelo índice gerado de antes. */
function fichas() {
  const ix = ler(join(ORIGINAL, 'busca.json'));
  const m = new Map();
  ix.id.forEach((id, k) => {
    const tipo = normal(ix.n[k]).split(/\s+/)[0] ?? '';
    const marca = ix.marcas[ix.b[k]] ?? '';
    m.set(id, { tipo, marca, carros: (ix.ms?.[k] ?? [ix.m[k]]).filter(Boolean), nome: ix.n[k] });
  });
  return m;
}

/** O estoque da semente: tira 2% a 20% ao acaso e, nas sementes múltiplas de 3, um tipo inteiro de um carro. */
function perturbar(bruto, ficha, semente) {
  const rnd = sorteio(semente);
  const fracao = 0.02 + rnd() * 0.18;
  const fora = new Set();
  for (const p of bruto.products) if (rnd() < fracao) fora.add(p.id);
  let evento = '';
  if (semente % 3 === 0) {
    // metade das vezes entre os tipos e carros mais comuns (os que os testes e os clientes mais procuram); a outra
    // metade, qualquer peça do estoque
    const todas = [...ficha.values()].filter((f) => f.tipo && f.marca && f.carros.length);
    let alvo = todas;
    if (semente % 6 === 0) {
      const conta = (chave) => { const c = new Map(); for (const f of todas) for (const k of chave(f)) c.set(k, (c.get(k) ?? 0) + 1); return c; };
      const top = (c, n) => new Set([...c].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k));
      const tipos = top(conta((f) => [f.tipo]), 30);
      const carros = top(conta((f) => f.carros.map((x) => `${f.marca}|${x}`)), 20);
      alvo = todas.filter((f) => tipos.has(f.tipo) && f.carros.some((x) => carros.has(`${f.marca}|${x}`)));
    }
    const f = alvo[Math.floor(rnd() * alvo.length)];
    const carro = f.carros[Math.floor(rnd() * f.carros.length)];
    let n = 0;
    for (const [id, g] of ficha) if (g.tipo === f.tipo && g.marca === f.marca && g.carros.includes(carro)) { fora.add(id); n++; }
    evento = `sem "${f.tipo}" de ${f.marca} ${carro} (${n})`;
  }
  const products = bruto.products.filter((p) => !fora.has(p.id));
  return { produtos: { ...bruto, total: products.length, products }, tirados: bruto.products.length - products.length, evento };
}

/** O estoque de agora: só os anúncios que o site no ar diz que estão ativos (/dados/ativas.json). */
async function deHoje(bruto) {
  const origem = op('ativas', 'https://izzatcarimports.com.br/dados/ativas.json');
  const a = /^https?:/.test(origem) ? await (await fetch(origem)).json() : ler(origem);
  const ativas = new Set(a.id.map((x) => `MLB${String(x).replace(/^MLB/, '')}`));
  const products = bruto.products.filter((p) => ativas.has(p.id));
  const aqui = new Set(bruto.products.map((p) => p.id));
  const novas = [...ativas].filter((id) => !aqui.has(id));
  return { produtos: { ...bruto, total: products.length, products }, tirados: bruto.products.length - products.length, novas, de: a.u ?? '' };
}

/** Acrescenta ao busca.json gerado as peças do índice do ar que o products.json local não tem (só o índice). */
function acrescentarNovas(arqDoAr, ids) {
  const ar = ler(arqDoAr);
  const arq = join(SITE, 'public/dados/busca.json');
  const ix = ler(arq);
  const n0 = ix.id.length;
  const indiceDe = (lista, nome) => { let i = lista.indexOf(nome); if (i < 0) { lista.push(nome); i = lista.length - 1; } return i; };
  const texto = (campo) => { if (typeof ix[campo] === 'string' && ix[campo].length < n0) ix[campo] = ix[campo].padEnd(n0, '0'); };
  let n = 0;
  for (const id of ids) {
    const j = ar.id.indexOf(id);
    if (j < 0) continue;
    const k = ix.id.length;
    for (const c of ['id', 't', 'n', 'p', 'i', 'h', 'm', 'y', 'o']) ix[c].push(ar[c][j]);
    ix.b.push(indiceDe(ix.marcas, ar.marcas[ar.b[j]] ?? ''));
    ix.c.push(indiceDe(ix.familias, ar.familias[ar.c[j]] ?? ''));
    ix.s.push(indiceDe(ix.tipos, ar.tipos[ar.s[j]] ?? ''));
    for (const c of ['f', 'l', 'pos', 'e', 'q']) if (typeof ix[c] === 'string') { texto(c); ix[c] += ar[c]?.[j] ?? '0'; }
    for (const c of ['ms', 'ys', 'dif']) if (ar[c]?.[j]) (ix[c] ??= {})[k] = ar[c][j];
    n++;
  }
  writeFileSync(arq, JSON.stringify(ix));
  return n;
}

const linhas = [];
const registrar = (nome, pecas, tirados, evento, t0, r) => {
  const seg = Math.round((Date.now() - t0) / 1000);
  const linha = { nome, pecas, tirados, evento, ok: !r.falhas.length, testes: r.testes, arquivos: r.arquivos, falhas: r.falhas, seg };
  linhas.push(linha);
  console.log(`${String(nome).padEnd(8)} ${String(pecas).padStart(5)} peças (-${tirados})  ${linha.ok ? 'VERDE' : `VERMELHO (${r.falhas.length})`}  ${r.testes} testes  ${seg}s  ${evento}`);
  for (const f of r.falhas) console.log(`    ✗ ${f}`);
  writeFileSync(join(CACHE, 'tabela.json'), JSON.stringify(linhas, null, 1));
};

guardar();
let saiu = false;
const fim = () => { if (saiu) return; saiu = true; if (!tem('manter')) devolver(); };
const parar = (codigo) => () => { try { if (filho) process.kill(-filho.pid, 'SIGKILL'); } catch { /* já acabou */ } fim(); console.log('\ninterrompido: os dados gerados de antes foram devolvidos'); process.exit(codigo); };
process.on('SIGINT', parar(130));
process.on('SIGTERM', parar(143));
try {
  const bruto = ler(join(RAIZ, 'products.json'));
  const ficha = fichas();
  if (op('arquivo', '')) {
    const t0 = Date.now();
    const outro = ler(resolve(op('arquivo')));
    const aqui = new Set(bruto.products.map((p) => p.id));
    const novas = outro.products.filter((p) => !aqui.has(p.id)).length;
    const g = await gerar(outro);
    const rot = `${op('arquivo').split('/').pop()}: ${novas} anúncios que o products.json daqui não tem`;
    if (!g.ok) registrar('arquivo', outro.products.length, 0, rot, t0, { falhas: [`${g.onde}: ${g.saida}`], testes: 0, arquivos: 0 });
    else registrar('arquivo', outro.products.length, bruto.products.length - (outro.products.length - novas), rot, t0, await testar());
  } else if (tem('hoje')) {
    const t0 = Date.now();
    const h = await deHoje(bruto);
    const g = await gerar(h.produtos);
    if (!g.ok) registrar('hoje', h.produtos.products.length, h.tirados, '', t0, { falhas: [`${g.onde}: ${g.saida}`], testes: 0, arquivos: 0 });
    else {
      let extra = '';
      const doAr = op('novas', '');
      if (doAr) extra = `; +${acrescentarNovas(doAr, h.novas)} novas do índice do ar (só no busca.json)`;
      registrar('hoje', h.produtos.products.length, h.tirados, `ativas de ${h.de}; ${h.novas.length} novas que o products.json local não tem${extra}`, t0, await testar(!!doAr));
    }
  } else {
    for (let s = DE; s < DE + N; s++) {
      const t0 = Date.now();
      const p = perturbar(bruto, ficha, s);
      const g = await gerar(p.produtos);
      if (!g.ok) { registrar(s, p.produtos.products.length, p.tirados, p.evento, t0, { falhas: [`${g.onde}: ${g.saida}`], testes: 0, arquivos: 0 }); continue; }
      registrar(s, p.produtos.products.length, p.tirados, p.evento, t0, await testar());
    }
  }
} finally {
  fim();
}
const verdes = linhas.filter((l) => l.ok).length;
console.log(`\n${verdes}/${linhas.length} verdes${tem('manter') ? ' (estoque mexido mantido no lugar)' : ''}. Tabela: ${join(CACHE, 'tabela.json')}`);
process.exit(verdes === linhas.length ? 0 : 1);
