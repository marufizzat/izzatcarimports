// Vitrine da home ("Destaques do pátio"): escolhe as peças pelos DADOS REAIS, uma vez por build.
//
// Ordem de preferência:
//   1. capa maquiada (public/estudio-pro/<MLB>.webp) — a melhor foto do site;
//   2. as que mais venderam no Mercado Livre (campo "sold" de cada anúncio).
//
// O "sold" ainda não chega ao pecas.json: o preparar_dados.py não leva esse campo. Por isso aqui ele é lido
// direto do ../products.json (existe no robô, antes do build). Sem o arquivo, a vitrine segue sem a aba de
// procura. Quando o pecas.json passar a trazer `v` (vendidas = products.json "sold"), este arquivo usa `v`
// e nem abre o products.json.
//
// Curadoria (a vitrine é a primeira impressão): só peça com capa de estúdio, com marca e modelo, nome limpo
// e sem abreviação crua do ML ("tras", "esq"...); no máximo 2 do mesmo carro, 2 do mesmo sistema e 1 por
// tipo de peça (a 1ª palavra do nome: um só "Rádio", um só "Módulo") em cada aba.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pecas, capaEstudio, resumo, type Peca } from './dados';

type PecaV = Peca & { v?: number };

let _vendas: Map<string, number> | null = null;
/** Vendas por anúncio (id MLB → quantidade vendida no Mercado Livre). Vazio se não houver o dado. */
export function vendas(): Map<string, number> {
  if (_vendas) return _vendas;
  _vendas = new Map();
  const lista = pecas() as PecaV[];
  if (lista.some((p) => typeof p.v === 'number')) {
    for (const p of lista) if (p.v && p.v > 0) _vendas.set(p.id, p.v);
    return _vendas;
  }
  const arq = join(process.cwd(), '..', 'products.json');
  if (!existsSync(arq)) return _vendas;
  try {
    const j = JSON.parse(readFileSync(arq, 'utf-8'));
    const itens: { id?: unknown; sold?: unknown }[] = Array.isArray(j) ? j : j?.products ?? [];
    for (const p of itens) {
      const n = Number(p?.sold) || 0;
      if (n > 0 && typeof p.id === 'string') _vendas.set(p.id, n);
    }
  } catch {
    /* products.json ausente ou quebrado: segue sem o número de vendas */
  }
  return _vendas;
}

const ABREVIADO = /(^|[\s,./-])(tras|dian|diant|esq|esque|dir|inf|sup)(?=$|[\s,./-])/i;
const ehPro = (p: Peca) => (capaEstudio(p.id) ?? '').startsWith('/estudio-pro/');
const completo = (p: Peca) => (p.y ? 1 : 0) + (p.o || p.oem ? 1 : 0);
const comeco = (n: string) => n.toLowerCase().split(/\s+/)[0];

/** Peça que pode ir para a vitrine (capa de estúdio, carro identificado, nome apresentável, preço). */
export function apresentavel(p: Peca): boolean {
  return !!capaEstudio(p.id) && !!p.b && !!p.m && p.p > 0 && p.limpa !== false && !ABREVIADO.test(p.n);
}

type Regras = { n: number; porCarro?: number; porTipo?: number };
/** Pega as primeiras da lista respeitando a variedade (carro, sistema e começo do nome). */
function escolher(ordenadas: Peca[], { n, porCarro = 2, porTipo = 2 }: Regras): Peca[] {
  const out: Peca[] = [];
  const carros = new Map<string, number>();
  const tipos = new Map<string, number>();
  const nomes = new Set<string>();
  for (const p of ordenadas) {
    if (out.length >= n) break;
    const kc = `${p.b}|${p.m}`;
    const kn = comeco(p.n);
    if ((carros.get(kc) ?? 0) >= porCarro || (tipos.get(p.c) ?? 0) >= porTipo || nomes.has(kn)) continue;
    out.push(p);
    carros.set(kc, (carros.get(kc) ?? 0) + 1);
    tipos.set(p.c, (tipos.get(p.c) ?? 0) + 1);
    nomes.add(kn);
  }
  return espalhar(out);
}

/** Evita duas peças do mesmo sistema lado a lado (mantém a ordem o quanto der). */
function espalhar(lista: Peca[]): Peca[] {
  const resto = [...lista];
  const out: Peca[] = [];
  while (resto.length) {
    const ant = out[out.length - 1];
    const i = ant ? resto.findIndex((p) => p.c !== ant.c) : 0;
    out.push(...resto.splice(i < 0 ? 0 : i, 1));
  }
  return out;
}

const idDesc = (a: Peca, b: Peca) => (b.id > a.id ? 1 : b.id < a.id ? -1 : 0);

export type AbaVitrine = { k: string; rotulo: string; pecas: Peca[]; link: string; linkRotulo: string };

/** Abas da vitrine: "Em destaque" (maquiadas primeiro), "Mais procuradas" (só as que já venderam)
 *  e os 3 sistemas com mais vendas. Aba com menos de 4 peças não aparece. */
export function abasVitrine(n = 8): AbaVitrine[] {
  const v = vendas();
  const base = pecas().filter(apresentavel);
  const vend = (p: Peca) => v.get(p.id) ?? 0;
  const abas: AbaVitrine[] = [];
  const catalogo = { link: '/catalogo.html', linkRotulo: 'Ver o catálogo inteiro' };

  // 1) Em destaque: maquiadas (as mais valiosas primeiro), depois as que mais venderam
  const destaque = [...base].sort((a, b) =>
    Number(ehPro(b)) - Number(ehPro(a)) ||
    (ehPro(a) && ehPro(b) ? b.p - a.p : 0) ||
    vend(b) - vend(a) || completo(b) - completo(a) || idDesc(a, b));
  abas.push({ k: 'destaque', rotulo: 'Em destaque', pecas: escolher(destaque, { n }), ...catalogo });

  // 2) Mais procuradas: só peça que já vendeu no Mercado Livre
  const procuradas = base.filter((p) => vend(p) > 0).sort((a, b) =>
    vend(b) - vend(a) || Number(ehPro(b)) - Number(ehPro(a)) || completo(b) - completo(a) || idDesc(a, b));
  abas.push({ k: 'procuradas', rotulo: 'Mais procuradas', pecas: escolher(procuradas, { n }), ...catalogo });

  // 3) Os sistemas que mais vendem (sem venda registrada: os com mais peças)
  const fams = resumo().familias.filter((f) => f.k !== 'outros');
  const vendasFam = new Map<string, number>();
  for (const p of pecas()) vendasFam.set(p.c, (vendasFam.get(p.c) ?? 0) + vend(p));
  const top = [...fams].sort((a, b) => (vendasFam.get(b.n) ?? 0) - (vendasFam.get(a.n) ?? 0) || b.c - a.c).slice(0, 3);
  for (const f of top) {
    const lista = base.filter((p) => p.c === f.n).sort((a, b) =>
      Number(ehPro(b)) - Number(ehPro(a)) || (ehPro(a) && ehPro(b) ? b.p - a.p : 0) ||
      vend(b) - vend(a) || completo(b) - completo(a) || idDesc(a, b));
    const nome = f.n.charAt(0) + f.n.slice(1).toLowerCase();
    const resto = /^peças de (.+)$/i.exec(f.n)?.[1]?.toLowerCase() ?? f.n.toLowerCase();
    abas.push({
      k: f.k, rotulo: nome, pecas: escolher(lista, { n, porTipo: n }),
      link: `/categoria/${f.k}.html`, linkRotulo: `Ver as ${f.c.toLocaleString('pt-BR')} peças de ${resto}`,
    });
  }
  return abas.filter((a) => a.pecas.length >= 4);
}
