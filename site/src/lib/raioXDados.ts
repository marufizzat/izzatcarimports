// O Raio-x do carro no BUILD (components/v2/RaioX.astro): as contagens do estoque inteiro (home) ou de um carro (página
// do carro) pela busca do catálogo sobre public/dados/busca.json, o mesmo arquivo do navegador. Só no build (node:fs).
// Vai na página como um JSON curto (a home inteira paga por ele): o bloco por índice, lado e posição em 2 letras e a
// foto só nas linhas que aparecem com foto (as primeiras de cada zona), num código curto (lib/raioX.ts: fotoDoCodigo).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Busca, capaItem, type Indice, type Item } from './busca';
import { contarZonas, codigoDaFoto, zonasDaPeca, NA_FRENTE, type CarroFiltro, type RaioXJson, type Zona } from './raioX';

let busca: Busca | null = null;
const toda = () => (busca ??= new Busca(JSON.parse(readFileSync(join(process.cwd(), 'public', 'dados', 'busca.json'), 'utf-8')) as Indice));

/** As zonas contadas, prontas para o JSON da página. `carro` = só as peças dele (marca e modelo; sem ano). */
export function dadosRaioX(carro?: { b: string; m: string }): RaioXJson {
  const b = toda();
  const f: CarroFiltro = carro ? { marca: carro.b, modelo: carro.m } : {};
  const blocos: string[] = [];
  const bloco = (n: string) => (blocos.includes(n) ? blocos.indexOf(n) : blocos.push(n) - 1);
  const z = contarZonas((x) => b.procurar(x), f).map((c) => ({
    k: c.k,
    n: c.n,
    l: c.linhas.map((l, i) => {
      const lp = `${l.lado ?? ''}${l.pos ? (l.lado ? '' : '-') + l.pos : ''}`;
      const linha: (string | number)[] = [bloco(l.tipo), l.sub, lp, l.n];
      if (i < NA_FRENTE) linha.push(codigoDaFoto(capaItem(l.it, 'A')));
      return linha as RaioXJson['z'][number]['l'][number];
    }),
  }));
  return { b: blocos, z };
}

// ---- "Onde fica" da página da peça (components/peca/OndeFica.astro) ----
let porId: Map<string, Item> | null = null;
/** A zona do Raio-x onde a peça fica, pelo MESMO índice e a mesma regra do painel (zonasDaPeca). null = a tabela não
 *  alcança a peça (tipo sem lugar certo, peça de porta sem o lado no nome) ou ela serve em duas partes (frente e
 *  traseira): aí a página não mostra o bloco (nunca um lugar meio certo). */
export function zonaDaPecaId(id: string): Zona | null {
  porId ??= new Map(toda().itens.map((it) => [it.id, it]));
  const it = porId.get(id);
  if (!it) return null;
  const zs = zonasDaPeca({ c: it.c, s: it.s, l: it.l, pos: it.pos });
  return zs.length === 1 ? zs[0] : null;
}
