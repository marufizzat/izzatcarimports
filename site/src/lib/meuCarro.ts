// "Meu carro" — a garagem do cliente. Fica SÓ no navegador dele (localStorage), sem cadastro.
// Contrato único usado pela abertura, cabeçalho, cartões, catálogo e página da peça:
//   localStorage['izzatcar.meuCarro'] = {"b":"Volvo","m":"XC60","y":2019}   (y pode ser null)
//   ao mudar: window.dispatchEvent(new CustomEvent('meu-carro', { detail: carro | null }))
// b = marca e m = modelo EXATAMENTE como nos dados (p.b / p.m); y = ano escolhido.
// Roda em toda página: nada de lib/dados.ts ou lib/garagem.ts aqui (puxariam o pecas.json inteiro).

export type MeuCarro = { b: string; m: string; y: number | null };
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

export function lerMeuCarro(): MeuCarro | null {
  try {
    const c = JSON.parse(localStorage.getItem(CHAVE) || 'null');
    return c && typeof c.b === 'string' && typeof c.m === 'string' ? { b: c.b, m: c.m, y: typeof c.y === 'number' ? c.y : null } : null;
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

/** "xc60" = "XC 60" = "XC-60" */
export const norm = (s: string | null | undefined) => (s || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');

/** A peça serve no carro salvo? Só dizemos "serve" com o ANO salvo e dentro da faixa de anos da peça.
 *  - 'sim':         marca e modelo batem, o carro tem ano e ele está dentro da faixa da peça;
 *  - 'confira-ano': marca e modelo batem, o carro tem ano e ele está FORA da faixa da peça;
 *  - 'falta-ano':   marca e modelo batem, mas não dá para conferir o ano: o carro salvo está sem ano
 *                   (convidar a informar) ou o anúncio não traz os anos (conferir o código na peça);
 *  - null:          sem carro salvo, outro carro, ou peça sem marca/modelo.
 *  Nunca dizemos "não serve": na dúvida, um aviso neutro. */
export function serveNoMeuCarro(p: { b?: string | null; m?: string | null; y?: [number, number] | null }, c: MeuCarro | null): Serve {
  if (!c || !p.b || !p.m) return null;
  if (norm(p.b) !== norm(c.b) || norm(p.m) !== norm(c.m)) return null;
  if (c.y == null || !p.y) return 'falta-ano';
  return c.y >= p.y[0] && c.y <= p.y[1] ? 'sim' : 'confira-ano';
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
