// "Meu carro" — a garagem do cliente. Fica SÓ no navegador dele (localStorage), sem cadastro.
// Contrato único usado pela abertura, cabeçalho, cartões, catálogo e página da peça:
//   localStorage['izzatcar.meuCarro'] = {"b":"Volvo","m":"XC60","y":2019,"a":"volvo-xc60","as":[600,900,1200]}
//   (y pode ser null; a/as são opcionais)
//   ao mudar: window.dispatchEvent(new CustomEvent('meu-carro', { detail: carro | null }))
// b = marca e m = modelo EXATAMENTE como nos dados (p.b / p.m); y = ano escolhido.
// a/as (opcionais) = a arte do carro (/arte/v2/carro-<a>.webp) e as larguras do srcset, guardadas junto para a abertura
// pôr a arte já no esqueleto, antes do /dados/meu-carro.json chegar (auditoria 4, 2.2). Quem só sabe b/m/y salva sem
// elas; o seletor completa (lembrarArte) quando a garagem chega. Valor antigo, sem a/as, continua valendo.
// A peça que serve em 2+ carros traz ms (e ys): ela vale para o carro salvo se ele estiver no ms.
// Roda em toda página: nada de lib/dados.ts ou lib/garagem.ts aqui (puxariam o pecas.json inteiro).

export type MeuCarro = { b: string; m: string; y: number | null; a?: string; as?: number[] };
/** Resposta de serveNoMeuCarro (a regra está lá). */
export type Serve = 'sim' | 'confira-ano' | 'falta-ano' | null;

export const CHAVE = 'izzatcar.meuCarro';
export const EVENTO = 'meu-carro';
/** Abre a caixa "Seu carro" do cabeçalho. detail.origem = 'peca' quando vem da faixa da página da peça. */
export const ABRIR = 'abrir-meu-carro';
/** Disparado pelo seletor (borbulha) quando, vindo da página da peça, a pessoa termina de escolher (ano ou "Conferir"). */
export const ESCOLHIDO = 'meu-carro-escolhido';
/** A garagem (marca -> modelo -> peças por ano), gerada no build por lib/garagem.ts. */
export const ARQUIVO_GARAGEM = '/dados/meu-carro.json';

// ---- carros unidos (decisão do dono, 10/11: C180/C200/C320 = Classe C, 320i/330i = Série 3, New Fiesta = Fiesta…) ----
// "marca|apelido" -> principal, gerado pelo preparar_dados.py (src/data/unidos.json: ~250 bytes, vai no JS com cache).
// Serve para (1) o Meu carro salvo com o apelido virar o principal NA LEITURA (carroDe/lerMeuCarro e os scripts de antes
// da pintura: migrarAntes) e (2) a tela nunca escrever o apelido ao lado do próprio principal (gruposModelos).
// Fora do Vite (um teste que empacota só a busca) não há import.meta.glob: o mapa fica vazio e nada muda.
export type Unidos = Record<string, string>;
let unidosLidos: Unidos = {};
try {
  unidosLidos = Object.values(import.meta.glob<Unidos>('../data/unidos.json', { eager: true, import: 'default' }))[0] ?? {};
} catch { /* fora do Vite */ }
export const UNIDOS: Unidos = unidosLidos;

/** "xc60" = "XC 60" = "XC-60" */
export const norm = (s: string | null | undefined) => (s || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');

const indices = new WeakMap<Unidos, Map<string, string>>();
/** O carro principal do apelido ("Mercedes-Benz", "C180" -> "Classe C"); null quando não é apelido. */
export function principalDe(b: string | null | undefined, m: string | null | undefined, mapa: Unidos = UNIDOS): string | null {
  if (!b || !m) return null;
  let ix = indices.get(mapa);
  if (!ix) {
    ix = new Map(Object.entries(mapa).map(([k, P]) => { const i = k.indexOf('|'); return [`${norm(k.slice(0, i))}|${norm(k.slice(i + 1))}`, P]; }));
    indices.set(mapa, ix);
  }
  return ix.get(`${norm(b)}|${norm(m)}`) ?? null;
}

/** Antes da 1ª pintura (inline, por toString(): sem nada de fora; components/MigrarCarro.astro): o Meu carro salvo com
 *  um apelido passa a ser o principal (o ano fica; a arte guardada era a do apelido: sai, o seletor guarda a nova) e o
 *  localStorage é regravado UMA vez. Com `url`, o endereço do catálogo `?modelo=<apelido>` (link antigo, anúncio do
 *  Google) também vira o principal, antes de o catálogo ler o endereço. */
export function migrarAntes(chave: string, mapa: Record<string, string>, url?: boolean): void {
  try {
    var c = JSON.parse(localStorage.getItem(chave) || 'null');
    var p = c && typeof c.b === 'string' && typeof c.m === 'string' ? mapa[c.b + '|' + c.m] : '';
    if (p) {
      c.m = p;
      delete c.a;
      delete c.as;
      localStorage.setItem(chave, JSON.stringify(c));
    }
  } catch (e) { /* sem armazenamento */ }
  if (!url) return;
  try {
    var u = new URLSearchParams(location.search);
    var q = mapa[(u.get('marca') || '') + '|' + (u.get('modelo') || '')];
    if (q) {
      u.set('modelo', q);
      history.replaceState(history.state, '', location.pathname + '?' + u + location.hash);
    }
  } catch (e) { /* endereço fica como está */ }
}

/** Chave de arte válida (só o que vira nome de arquivo: letras minúsculas, números e hífen). */
export const arteValida = (a: unknown): a is string => typeof a === 'string' && /^[a-z0-9-]{1,80}$/.test(a);
const largurasValidas = (as: unknown): as is number[] =>
  Array.isArray(as) && as.length > 0 && as.length <= 6 && as.every((w) => Number.isInteger(w) && w > 0 && w <= 4000);

/** O carro salvo, conferido campo a campo (a/as só entram se forem válidos). Salvo com um apelido de carro unido
 *  ("C180"): volta o principal ("Classe C") com o MESMO ano; a arte guardada era a do apelido e sai. */
export function carroDe(c: unknown, mapa: Unidos = UNIDOS): MeuCarro | null {
  const x = c as Partial<MeuCarro> | null;
  if (!x || typeof x.b !== 'string' || typeof x.m !== 'string') return null;
  const principal = principalDe(x.b, x.m, mapa);
  const r: MeuCarro = { b: x.b, m: principal ?? x.m, y: typeof x.y === 'number' ? x.y : null };
  if (!principal && arteValida(x.a)) {
    r.a = x.a;
    if (largurasValidas(x.as)) r.as = x.as;
  }
  return r;
}

export function lerMeuCarro(): MeuCarro | null {
  try {
    const bruto = JSON.parse(localStorage.getItem(CHAVE) || 'null') as Partial<MeuCarro> | null;
    const c = carroDe(bruto);
    // salvo com um apelido (antes da união dos carros): regrava UMA vez com o principal; quem lê depois já acha certo
    if (c && bruto && bruto.m !== c.m) {
      try { localStorage.setItem(CHAVE, JSON.stringify(c)); } catch { /* sem armazenamento: migra de novo na próxima leitura */ }
    }
    return c;
  } catch {
    return null;
  }
}

export function salvarMeuCarro(c: MeuCarro | null) {
  try {
    if (c) localStorage.setItem(CHAVE, JSON.stringify(c));
    else localStorage.removeItem(CHAVE);
  } catch {
    /* navegador sem armazenamento: segue sem lembrar */
  }
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: c }));
}

/** Guarda a arte do carro salvo SEM avisar o resto do site (nada muda para quem mostra peças): só a abertura usa,
 *  na próxima visita. Sem carro salvo, ou outro carro salvo, não faz nada. */
export function lembrarArte(b: string, m: string, a?: string, as?: number[]) {
  const c = lerMeuCarro();
  if (!c || c.b !== b || c.m !== m) return;
  const novo = carroDe({ ...c, a, as });
  if (!novo || (novo.a === c.a && String(novo.as) === String(c.as))) return;
  if (!novo.a) { delete novo.a; delete novo.as; }
  try {
    localStorage.setItem(CHAVE, JSON.stringify(novo));
  } catch {
    /* sem armazenamento */
  }
}

/** Peça como o "Meu carro" a vê. ms = os carros quando a peça serve em 2+ ("Volvo S60 Xc60" no título:
 *  ["S60", "XC60"], o 1º é sempre o m); ys = a faixa de anos de cada um, quando muda de um carro para outro. */
export type PecaCarro = {
  b?: string | null; m?: string | null; y?: [number, number] | null;
  ms?: string[] | null; ys?: ([number, number] | null)[] | null;
};

/** Carros em que a peça serve: os do ms, ou só o m. */
export function modelosDa(p: PecaCarro): string[] {
  return p.ms && p.ms.length ? p.ms : p.m ? [p.m] : [];
}

/** A peça serve no modelo (comparação com norm)? */
export function serveNoModelo(p: PecaCarro, modelo: string | null | undefined): boolean {
  const k = norm(modelo);
  return !!k && modelosDa(p).some((x) => norm(x) === k);
}

/** Faixa de anos da peça NAQUELE carro (a do ys, quando a peça serve em 2+ e a faixa muda). */
export function anosNoModelo(p: PecaCarro, modelo: string | null | undefined): [number, number] | null {
  const i = p.ms && p.ys ? p.ms.findIndex((x) => norm(x) === norm(modelo)) : -1;
  return i >= 0 ? (p.ys![i] ?? null) : (p.y ?? null);
}

/** "a", "a e b", "a, b e c" */
export const listaE = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`);

/** Os carros da peça em grupos: o carro e, dentro dele, as VERSÕES que o anúncio diz (os apelidos unidos a ele:
 *  ["Classe C", "C180", "C200", "C250"] -> [{ m: "Classe C", v: ["C180", "C200"] }, { m: "C250", v: [] }]).
 *  O apelido só vira versão quando o principal dele está na peça (nos dados, sempre está). */
export function gruposModelos(p: PecaCarro, mapa: Unidos = UNIDOS): { m: string; v: string[] }[] {
  const ms = modelosDa(p);
  const tem = new Set(ms.map(norm));
  const alvo = (x: string) => { const P = principalDe(p.b, x, mapa); return P && tem.has(norm(P)) && norm(P) !== norm(x) ? norm(P) : ''; };
  const grupos = ms.filter((x) => !alvo(x)).map((m) => ({ m, v: [] as string[] }));
  for (const x of ms) { const k = alvo(x); if (k) grupos.find((g) => norm(g.m) === k)?.v.push(x); }
  return grupos;
}

/** "Volvo S60 e XC60": os carros da peça como o cliente lê (tela e mensagem do WhatsApp), com a marca uma vez só.
 *  O carro unido aparece UMA vez, pelo principal: "Mercedes-Benz Classe C" (nunca "Classe C, C180 e C200", que o cliente
 *  lia como três carros). As versões ficam na ficha técnica e no que o Google lê: nomeModelosVersoes. */
export function nomeModelos(p: PecaCarro, mapa: Unidos = UNIDOS): string {
  return [p.b, listaE(gruposModelos(p, mapa).map((g) => g.m))].filter(Boolean).join(' ');
}

/** "Mercedes-Benz Classe C (C180, C200)": os carros com as versões que o anúncio diz, para a ficha técnica da peça e
 *  para o <title>, a meta description e o JSON-LD (quem procura "módulo vidro C320" acha). Sem carro unido = nomeModelos. */
export function nomeModelosVersoes(p: PecaCarro, mapa: Unidos = UNIDOS): string {
  return [p.b, listaE(gruposModelos(p, mapa).map((g) => (g.v.length ? `${g.m} (${g.v.join(', ')})` : g.m)))].filter(Boolean).join(' ');
}

/** O carro unido como o ANÚNCIO o diz, sem o principal: "Mercedes-Benz C320" (as versões do 1º carro). '' quando a peça
 *  não tem carro unido. É a forma curta que mantém a versão quando "Classe C (C320)" não cabe no <title>/description. */
export function nomeSoVersoes(p: PecaCarro, mapa: Unidos = UNIDOS): string {
  const [g] = gruposModelos(p, mapa);
  return g?.v.length ? [p.b, listaE(g.v)].filter(Boolean).join(' ') : '';
}

/** A peça serve no carro salvo? Só dizemos "serve" com o ANO salvo e dentro da faixa de anos da peça
 *  (na peça de 2+ carros, a faixa daquele carro: anosNoModelo).
 *  - 'sim':         marca e modelo batem, o carro tem ano e ele está dentro da faixa da peça;
 *  - 'confira-ano': marca e modelo batem, o carro tem ano e ele está FORA da faixa da peça;
 *  - 'falta-ano':   marca e modelo batem, mas não dá para conferir o ano: o carro salvo está sem ano
 *                   (convidar a informar) ou o anúncio não traz os anos (conferir o código na peça);
 *  - null:          sem carro salvo, outro carro, ou peça sem marca/modelo.
 *  Nunca dizemos "não serve": na dúvida, um aviso neutro. */
export function serveNoMeuCarro(p: PecaCarro, c: MeuCarro | null): Serve {
  if (!c || !p.b || !p.m) return null;
  if (norm(p.b) !== norm(c.b) || !serveNoModelo(p, c.m)) return null;
  const y = anosNoModelo(p, c.m);
  if (c.y == null || !y) return 'falta-ano';
  return c.y >= y[0] && c.y <= y[1] ? 'sim' : 'confira-ano';
}

/** Atributos data-* do cartão e da faixa da peça (data-ms="S60|XC60", data-ys="2018-2024|2019-2024"). */
export function atributosModelos(ms?: string[] | null, ys?: ([number, number] | null)[] | null) {
  return {
    'data-ms': ms && ms.length > 1 ? ms.join('|') : undefined,
    'data-ys': ms && ms.length > 1 && ys ? ys.map((a) => (a ? `${a[0]}-${a[1]}` : '')).join('|') : undefined,
  };
}
/** O contrário de atributosModelos: lê data-ms/data-ys de volta. */
export function lerModelos(ms?: string, ys?: string): Pick<PecaCarro, 'ms' | 'ys'> {
  if (!ms) return {};
  const anos = ys ? ys.split('|').map((a) => { const [x, z] = a.split('-').map(Number); return x && z ? [x, z] as [number, number] : null; }) : null;
  return { ms: ms.split('|'), ys: anos };
}

/** "Volvo XC60 2019" */
export const nomeCarro = (c: MeuCarro) => `${c.b} ${c.m}${c.y ? ` ${c.y}` : ''}`;

/** Link do catálogo já filtrado pelo carro (os mesmos parâmetros que o catálogo entende). Sem ano: todos os anos. */
export function linkCatalogo(c: { b: string; m: string; y?: number | null }): string {
  const u = new URLSearchParams({ marca: c.b, modelo: c.m });
  if (c.y) u.set('ano', String(c.y));
  return `/catalogo.html?${u.toString()}`;
}

// ---- estoque do carro salvo (o carro é do cliente; o estoque muda: peça vende, modelo sai) ----

/** O que o contrato precisa da garagem (/dados/meu-carro.json). */
export type GaragemMin = { marcas: { n: string; modelos: { n: string; c: number; ya: [number, number][] }[] }[] };
/** 'ok': há peças do carro (no ano salvo, se tiver ano); 'sem-ano': o modelo tem peças, mas nenhuma do ano salvo;
 *  'sem-modelo': a marca ou o modelo não têm peça no site agora. */
export type Estoque = { estado: 'ok' | 'sem-ano' | 'sem-modelo'; pecas: number; doModelo: number };

/** Confere o carro salvo contra o estoque. O carro salvo NÃO muda (é o carro dele): quem mostra peças
 *  usa isto para não zerar a tela ('sem-ano' mostra o modelo em todos os anos, com aviso). */
export function estoqueDoCarro(g: GaragemMin, c: MeuCarro): Estoque {
  const mo = g.marcas.find((m) => m.n === c.b)?.modelos.find((x) => x.n === c.m);
  if (!mo || mo.c === 0) return { estado: 'sem-modelo', pecas: 0, doModelo: 0 };
  if (c.y == null) return { estado: 'ok', pecas: mo.c, doModelo: mo.c };
  const n = mo.ya.find(([y]) => y === c.y)?.[1] ?? 0;
  return n > 0 ? { estado: 'ok', pecas: n, doModelo: mo.c } : { estado: 'sem-ano', pecas: 0, doModelo: mo.c };
}

let garagemPedida: Promise<GaragemMin> | null = null;
/** Baixa a garagem uma vez por página (~6 KB comprimido; o navegador guarda em cache). Falhou: tenta de novo no próximo pedido. */
export function carregarGaragem<T extends GaragemMin = GaragemMin>(): Promise<T> {
  garagemPedida ??= fetch(ARQUIVO_GARAGEM)
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<GaragemMin>;
    })
    .catch((e) => {
      garagemPedida = null;
      throw e;
    });
  return garagemPedida as Promise<T>;
}
