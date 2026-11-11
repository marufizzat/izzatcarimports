// Amostra do "Vai junto" para conferir UMA A UMA (rodada 15): pares "peça -> companheira (carro)", com semente fixa e
// espalhados pelos blocos (as categorias da loja). Também conta quantas páginas de peça mostram o bloco.
// uso (na pasta site/): npx vite-node scripts/amostra-vai-junto.ts [quantos=120] [semente=15]
import { readFileSync } from 'node:fs';
import { vaiJunto, papelDa } from '../src/lib/relacionadas';
import type { Peca } from '../src/lib/dados';

const QUANTOS = Number(process.argv[2] || 120), SEMENTE = Number(process.argv[3] || 15);
const pecas: Peca[] = JSON.parse(readFileSync('src/data/pecas.json', 'utf-8'));
const porModelo = new Map<string, Peca[]>();
for (const x of pecas) for (const m of x.ms && x.ms.length ? x.ms : x.m ? [x.m] : []) {
  const k = `${x.b}|${m}`; porModelo.set(k, [...(porModelo.get(k) ?? []), x]);
}
// gerador com semente (mulberry32): a mesma amostra em toda rodada com o mesmo estoque
let s = SEMENTE >>> 0;
const sorteio = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

type Par = { bloco: string; de: Peca; para: Peca; com: string };
const porBloco = new Map<string, Par[]>();
let comBloco = 0, cartoes = 0;
const porPapel = new Map<string, number>();
for (const p of pecas) {
  const r = vaiJunto(p, porModelo.get(`${p.b}|${p.m}`) ?? []);
  if (!r.pecas.length) continue;
  comBloco++; cartoes += r.pecas.length;
  const papel = papelDa(p)!; porPapel.set(papel, (porPapel.get(papel) ?? 0) + 1);
  for (const x of r.pecas) porBloco.set(p.c, [...(porBloco.get(p.c) ?? []), { bloco: p.c, de: p, para: x as Peca, com: r.com }]);
}
// espalha: uma volta por bloco (os blocos em ordem alfabética), um par sorteado de cada, até dar a conta
const blocos = [...porBloco.keys()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
for (const b of blocos) porBloco.get(b)!.sort((x, y) => (x.de.id + x.para.id < y.de.id + y.para.id ? -1 : 1));
const amostra: Par[] = [];
while (amostra.length < QUANTOS && blocos.some((b) => porBloco.get(b)!.length)) {
  for (const b of blocos) {
    const l = porBloco.get(b)!;
    if (!l.length || amostra.length >= QUANTOS) continue;
    amostra.push(l.splice(Math.floor(sorteio() * l.length), 1)[0]);
  }
}
const anos = (y: Peca['y']) => (y ? `${y[0]}–${y[1]}` : 's/ano');
console.log(`"Vai junto": ${comBloco} de ${pecas.length} páginas de peça com o bloco (${cartoes} cartões, ${(cartoes / Math.max(1, comBloco)).toFixed(2)} por bloco)`);
console.log(`amostra: ${amostra.length} pares, semente ${SEMENTE}\n`);
amostra.forEach((a, i) => console.log(`${String(i + 1).padStart(3)}. [${a.bloco}] ${a.de.n} (${anos(a.de.y)}) -> ${a.para.n} (${anos(a.para.y)}) · ${a.de.b} ${a.de.m}`));
if (process.argv.includes('--papeis')) console.log('\n' + [...porPapel].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(' · '));
