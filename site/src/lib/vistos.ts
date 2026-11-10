// "Vistos recentemente": as últimas 12 peças que a pessoa abriu, SÓ no navegador (localStorage), sem cadastro.
// Gravado pela página da peça quando o navegador folga (components/peca/vistosPeca.ts), com o que a página já mostra
// (nome, carro, anos, código, preço, capa): nada a mais no HTML das 5 mil páginas. Lido pela home ("Você viu",
// components/v2/VoceViu.astro) e pela página da peça ("Você também viu").
// Contrato (o mesmo padrão do "Meu carro" e da "Lista de orçamento"):
//   localStorage['izzatcar.vistos'] = [{"id":"MLB123","slug":"farol-...-MLB123","nome":"Farol direito","carro":"Volvo XC60",
//      "anos":"2018 a 2024","preco":1234.5,"capa":"/estudio-400/MLB123.webp","cod":"31446830","b":"Volvo","m":"XC60",
//      "y":[2018,2024],"e":"1","t":1762800000000}, ...]   (a mais recente primeiro)
//   ao mudar: window.dispatchEvent(new CustomEvent('vistos', { detail: { n } }))
// b/m/y/ms/ys/e/i (opcionais) deixam o cartão IGUAL ao do catálogo (cartaoHtml de lib/vendidaCartoes.ts: o "Serve no
// seu…", a pílula dos 2+ carros, a capa de estúdio); sem eles o cartão sai com o carro e os anos em texto.
// A peça que vendeu sai sozinha: quem mostra confere em /dados/ativas.json (as peças do busca.json, só id e preço:
// pages/dados/ativas.json.ts) e grava a lista limpa.
// Duas camadas, como lib/lista.ts: funções puras (testadas em vistos.test.ts) e o embrulho do armazenamento.
// Sem lib/busca.ts aqui (só o tipo): roda na página da peça.
import type { Item } from './busca';

export type Visto = {
  id: string;
  /** o endereço da peça sem /peca/ e sem .html */
  slug: string;
  nome: string;
  /** "Volvo XC60" (peça de 2+ carros: "Volvo S60 e XC60"; só a marca: "Volvo") */
  carro: string;
  /** "2018 a 2024" ('' = o anúncio não diz) */
  anos: string;
  preco: number;
  /** capa leve (/estudio-400/<MLB>.webp) ou a foto pequena do ML */
  capa: string;
  cod: string;
  b?: string;
  m?: string;
  y?: [number, number];
  ms?: string[];
  ys?: ([number, number] | null)[];
  /** capa de estúdio: '0' nenhuma, '1' automática, '2' maquiada (o "e" do busca.json) */
  e?: '0' | '1' | '2';
  /** chave da 1ª foto do anúncio (a foto do cartão quando não há capa, ou o socorro dela) */
  i?: string;
  /** quando foi aberta (ms) */
  t: number;
};

export const CHAVE_VISTOS = 'izzatcar.vistos';
export const EVENTO_VISTOS = 'vistos';
export const MAX_VISTOS = 12;
/** a home só mostra o "Você viu" com 2 peças ou mais (uma só é a que a pessoa acabou de ver) */
export const MIN_HOME = 2;

const idValido = (s: unknown): s is string => typeof s === 'string' && /^MLB\d{6,14}$/.test(s);
const texto = (s: unknown, max: number) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const ano = (v: unknown) => (Number.isInteger(v) && (v as number) >= 1950 && (v as number) <= 2040 ? (v as number) : 0);
const faixa = (v: unknown): [number, number] | null => {
  if (!Array.isArray(v) || v.length !== 2) return null;
  const a = ano(v[0]), b = ano(v[1]);
  return a && b && a <= b ? [a, b] : null;
};

/** Uma entrada conferida campo a campo (JSON velho, campo faltando ou de outro tipo não quebra nada). */
export function vistoDe(x: unknown): Visto | null {
  const o = x as Record<string, unknown> | null;
  if (!o || typeof o !== 'object' || !idValido(o.id)) return null;
  const slug = texto(o.slug, 200);
  const capa = texto(o.capa, 300);
  const preco = typeof o.preco === 'number' ? o.preco : typeof o.preco === 'string' ? Number(o.preco) : NaN;
  const v: Visto = {
    id: o.id,
    // o endereço só com o que vira URL, e sempre o da própria peça (termina no MLB dela)
    slug: /^[a-zA-Z0-9-]+$/.test(slug) && slug.endsWith(o.id) ? slug : '',
    nome: texto(o.nome, 120) || 'Peça',
    carro: texto(o.carro, 80),
    anos: texto(o.anos, 20),
    preco: Number.isFinite(preco) && preco > 0 ? Math.round(preco * 100) / 100 : 0,
    capa: /^\/[a-z0-9-]+\/MLB\d+\.webp$|^https:\/\/http2\.mlstatic\.com\/[\w.-]+$/.test(capa) ? capa : '',
    cod: texto(o.cod, 30),
    t: typeof o.t === 'number' && Number.isFinite(o.t) ? o.t : 0,
  };
  const b = texto(o.b, 40), m = texto(o.m, 40), y = faixa(o.y);
  if (b) v.b = b;
  if (b && m) v.m = m;
  if (y) v.y = y;
  if (Array.isArray(o.ms) && o.ms.length > 1 && o.ms.length <= 6 && o.ms.every((s) => typeof s === 'string' && s.length <= 40)) {
    v.ms = o.ms as string[];
    if (Array.isArray(o.ys) && o.ys.length === o.ms.length) v.ys = o.ys.map(faixa);
  }
  if (o.e === '0' || o.e === '1' || o.e === '2') v.e = o.e;
  if (typeof o.i === 'string' && /^[\w-]{6,80}$/.test(o.i)) v.i = o.i;
  // sem endereço não há o que abrir
  return v.slug ? v : null;
}

/** A lista guardada, limpa: só entradas válidas, sem repetir peça, no máximo MAX_VISTOS (as primeiras = as recentes). */
export function normalizarVistos(x: unknown): Visto[] {
  if (!Array.isArray(x)) return [];
  const ja = new Set<string>();
  const out: Visto[] = [];
  for (const y of x) {
    const v = vistoDe(y);
    if (!v || ja.has(v.id)) continue;
    ja.add(v.id);
    out.push(v);
    if (out.length >= MAX_VISTOS) break;
  }
  return out;
}

/** A peça aberta agora vai para o começo (se já estava, sai de onde estava). */
export function registrar(l: readonly Visto[], v: Visto): Visto[] {
  const ok = vistoDe(v);
  if (!ok) return [...l];
  return [ok, ...l.filter((x) => x.id !== ok.id)].slice(0, MAX_VISTOS);
}

/** As peças à venda: { "MLB123": preço } (de /dados/ativas.json). */
export type Ativas = Map<string, { p: number; e: string; r: boolean }>;
/** /dados/ativas.json: { id: [7124139250, ...], p: [584.64, ...], e: "1102...", r: "1101..." } (ids sem o "MLB"). */
export type AtivasJson = { id: number[]; p: number[]; e?: string; r?: string };
export function lerAtivas(j: AtivasJson): Ativas {
  const m: Ativas = new Map();
  if (!j || !Array.isArray(j.id) || !Array.isArray(j.p)) return m;
  j.id.forEach((n, k) => m.set(`MLB${n}`, { p: j.p[k], e: j.e?.[k] ?? '0', r: j.r?.[k] === '1' }));
  return m;
}

/** O que mostrar: sem a peça `sem` (a da página) e, com o estoque em mãos, só as que ainda estão à venda, com o preço
 *  de agora. Sem o estoque (rede caiu): as guardadas, como estão. */
export function paraMostrar(l: readonly Visto[], ativas: Ativas | null, sem?: string): Visto[] {
  return l
    .filter((v) => v.id !== sem && (!ativas || ativas.has(v.id)))
    .map((v) => {
      const a = ativas?.get(v.id);
      return a ? { ...v, preco: a.p, e: (a.e === '1' || a.e === '2' ? a.e : '0') as Visto['e'] } : v;
    });
}

/** A peça vista como o cartão do catálogo a vê (o Item do busca.json), para o MESMO cartão (cartaoHtml). Sem b/m: o
 *  carro e os anos em texto ("Volvo", "2018–2024" do y). `leve` = as capas de 400/640 px estão em dia (o "r"). */
export function itemDoVisto(v: Visto, leve = true): Item {
  const e = v.e ?? (/^\/estudio/.test(v.capa) ? '1' : '0');
  const it: Item = {
    k: 0, id: v.id, t: v.nome, n: v.nome, p: v.preco, i: v.i ?? '', h: v.slug, f: false,
    b: v.b ?? v.carro, m: v.b ? v.m ?? '' : '', y: v.y ?? null, c: '', s: '', o: v.cod, e,
  };
  if (e !== '0' && leve) it.r = 1;
  if (v.ms) it.ms = v.ms;
  if (v.ys) it.ys = v.ys;
  return it;
}

/** Antes da 1ª pintura (inline na home, por toString(): sem nada de fora): quantas peças vistas válidas há. */
export function contarVistos(bruto: string | null): number {
  try {
    const l = JSON.parse(bruto || '[]');
    if (!Array.isArray(l)) return 0;
    const ids: Record<string, 1> = {};
    let n = 0;
    for (const v of l) {
      if (v && typeof v.id === 'string' && /^MLB\d{6,14}$/.test(v.id) && typeof v.slug === 'string' && v.slug && !ids[v.id]) {
        ids[v.id] = 1;
        n++;
      }
    }
    return Math.min(n, 12);
  } catch {
    return 0;
  }
}

// ---- armazenamento + evento (só no navegador) ----
export function lerVistos(): Visto[] {
  try {
    return normalizarVistos(JSON.parse(localStorage.getItem(CHAVE_VISTOS) || '[]'));
  } catch {
    return [];
  }
}
export function salvarVistos(l: readonly Visto[]) {
  try {
    if (l.length) localStorage.setItem(CHAVE_VISTOS, JSON.stringify(l));
    else localStorage.removeItem(CHAVE_VISTOS);
  } catch {
    /* sem armazenamento: segue sem lembrar */
  }
  window.dispatchEvent(new CustomEvent(EVENTO_VISTOS, { detail: { n: l.length } }));
}
export function registrarVisto(v: Visto) {
  salvarVistos(registrar(lerVistos(), v));
}

/** O estoque de agora (id e preço), uma vez por página. Falhou: null (quem chama mostra o que tem guardado). */
let ativasPedidas: Promise<Ativas | null> | null = null;
export const ARQUIVO_ATIVAS = '/dados/ativas.json';
export function carregarAtivas(): Promise<Ativas | null> {
  ativasPedidas ??= fetch(ARQUIVO_ATIVAS)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((j: AtivasJson) => lerAtivas(j))
    .catch(() => { ativasPedidas = null; return null; });
  return ativasPedidas;
}
