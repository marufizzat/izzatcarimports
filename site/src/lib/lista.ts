// "Lista de orçamento" — o carrinho de quem compra pelo WhatsApp. A oficina (ou o cliente) junta várias peças e manda
// tudo num pedido só (/lista.html, mensagemLista em lib/whats.ts). Fica SÓ no navegador (localStorage), sem cadastro e
// sem servidor. Contrato (o mesmo padrão do "Meu carro", lib/meuCarro.ts):
//   localStorage['izzatcar.lista'] = [{"id":"MLB123","slug":"farol-...-MLB123","nome":"Farol direito",
//      "carro":"Chevrolet Cruze","anos":"2017 a 2021","cod":"E131464301","preco":244.64,"capa":"/estudio-400/MLB123.webp"}]
//   ao mudar: window.dispatchEvent(new CustomEvent('lista', { detail: { acao, id, n, origem } }))
//   (acao: 'adicionar' | 'remover' | 'limpar' | 'guardar' | 'atualizar' | 'outra-aba'; o rastreio.js conta o 'adicionar')
// Duas camadas: as funções puras (listas na mão, testadas em lista.test.ts, sem localStorage) e o embrulho do
// armazenamento + evento. Roda em toda página (cabeçalho): nada de lib/busca.ts (MiniSearch) nem lib/dados.ts (node:fs).
import { somaPrecos } from './whats';

export type ItemLista = {
  /** número do anúncio no ML ("MLB6631863638") */
  id: string;
  /** o endereço da peça sem /peca/ e sem .html (o mesmo `h` do busca.json) */
  slug: string;
  /** o nome limpo (p.n), nunca o título cru do anúncio */
  nome: string;
  /** "Chevrolet Cruze" (peça de 2+ carros: "Volvo S60 e XC60") */
  carro: string;
  /** "2017 a 2021" (ou "2019"; vazio = o anúncio não diz) */
  anos: string;
  /** código gravado na peça (vazio = sem código) */
  cod: string;
  /** preço do anúncio (o do site), em reais */
  preco: number;
  /** capa leve (/estudio-400/<MLB>.webp) ou a foto pequena do ML; só para mostrar antes do busca.json chegar */
  capa: string;
};
export type AcaoLista = 'adicionar' | 'remover' | 'limpar' | 'guardar' | 'atualizar' | 'outra-aba';
export type EventoLista = { acao: AcaoLista; id?: string; n: number; origem?: string };

export const CHAVE_LISTA = 'izzatcar.lista';
export const EVENTO_LISTA = 'lista';
/** No máximo 30 peças (o link da lista e a mensagem do WhatsApp continuam curtos). */
export const MAX_LISTA = 30;
export const PAGINA_LISTA = '/lista.html';

export const idValido = (s: unknown): s is string => typeof s === 'string' && /^MLB\d{6,14}$/.test(s);
const texto = (s: unknown, max: number) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** Um item conferido campo a campo (JSON velho, campo faltando ou de outro tipo não quebra nada). null = sem salvação. */
export function itemDe(x: unknown): ItemLista | null {
  const o = x as Partial<Record<keyof ItemLista, unknown>> | null;
  if (!o || typeof o !== 'object' || !idValido(o.id)) return null;
  const preco = typeof o.preco === 'number' ? o.preco : typeof o.preco === 'string' ? Number(o.preco) : NaN;
  const slug = texto(o.slug, 200);
  const capa = texto(o.capa, 300);
  return {
    id: o.id,
    // o endereço só com o que vira URL (o slug sempre termina no MLB)
    slug: /^[a-zA-Z0-9-]+$/.test(slug) ? slug : '',
    nome: texto(o.nome, 120) || 'Peça',
    carro: texto(o.carro, 80),
    anos: texto(o.anos, 20),
    cod: texto(o.cod, 30),
    preco: Number.isFinite(preco) && preco > 0 ? Math.round(preco * 100) / 100 : 0,
    // só caminho do próprio site ou foto do ML (nada de javascript: nem outro domínio)
    capa: /^\/[a-z0-9-]+\/MLB\d+\.webp$|^https:\/\/http2\.mlstatic\.com\/[\w.-]+$/.test(capa) ? capa : '',
  };
}

/** A lista guardada, limpa: só itens válidos, sem repetir peça e no máximo MAX_LISTA (os primeiros ficam). */
export function normalizar(x: unknown): ItemLista[] {
  if (!Array.isArray(x)) return [];
  const vistos = new Set<string>();
  const out: ItemLista[] = [];
  for (const y of x) {
    const it = itemDe(y);
    if (!it || vistos.has(it.id)) continue;
    vistos.add(it.id);
    out.push(it);
    if (out.length >= MAX_LISTA) break;
  }
  return out;
}

export const tem = (l: readonly ItemLista[], id: string) => l.some((x) => x.id === id);
export const cheia = (l: readonly ItemLista[]) => l.length >= MAX_LISTA;

/** Põe a peça no fim da lista (a ordem é a de quem juntou). Já está ou a lista está cheia: a mesma lista. */
export function adicionar(l: readonly ItemLista[], item: ItemLista): ItemLista[] {
  const it = itemDe(item);
  if (!it || tem(l, it.id) || cheia(l)) return [...l];
  return [...l, it];
}
export function remover(l: readonly ItemLista[], id: string): ItemLista[] {
  return l.filter((x) => x.id !== id);
}
/** "Desfazer": a peça volta para o mesmo lugar. */
export function restaurar(l: readonly ItemLista[], item: ItemLista, i: number): ItemLista[] {
  if (tem(l, item.id) || cheia(l)) return [...l];
  const k = Math.max(0, Math.min(l.length, i));
  return [...l.slice(0, k), item, ...l.slice(k)];
}
export function limpar(): ItemLista[] {
  return [];
}
/** "Guardar esta lista" (a lista de um link): junta as peças do link às de quem abriu, sem apagar nada e sem repetir.
 *  fora = quantas não couberam (a lista chegou a MAX_LISTA). */
export function juntar(minha: readonly ItemLista[], outra: readonly ItemLista[]): { lista: ItemLista[]; novas: number; fora: number } {
  let lista = [...minha];
  let novas = 0, fora = 0;
  for (const it of outra) {
    if (tem(lista, it.id)) continue;
    if (cheia(lista)) { fora++; continue; }
    lista = adicionar(lista, it);
    novas++;
  }
  return { lista, novas, fora };
}
/** Troca os dados de uma peça pelos de agora (preço, nome, capa), sem mexer na ordem. */
export function atualizar(l: readonly ItemLista[], id: string, novo: Partial<ItemLista>): ItemLista[] {
  return l.map((x) => (x.id === id ? itemDe({ ...x, ...novo }) ?? x : x));
}

// ---- dinheiro: tudo em centavos inteiros (0,1 + 0,2 não vira 0,30000000000000004): somaPrecos (lib/whats.ts) ----
/** Soma dos preços do site (reais, com centavos exatos). */
export function total(l: readonly { preco: number }[]): number {
  return somaPrecos(l).site;
}
/** Total no WhatsApp: a SOMA dos preços de cada peça com o desconto (cada um arredondado como aparece na linha dela),
 *  não o desconto do subtotal. Assim a coluna "no WhatsApp" de /lista.html fecha certinho com o total. */
export function totalWhats(l: readonly { preco: number }[]): number {
  return somaPrecos(l).whats;
}
/** O desconto da lista: subtotal − total no WhatsApp. */
export function desconto(l: readonly { preco: number }[]): number {
  return somaPrecos(l).desconto;
}

// ---- o link da lista: /lista.html?i=MLB1,MLB2 (qualquer pessoa abre e vê a mesma lista) ----
/** Os anúncios do link (?i=MLB1,MLB2), conferidos, sem repetir e no máximo MAX_LISTA. */
export function idsDoLink(busca: string): string[] {
  const v = new URLSearchParams(busca).get('i') || '';
  return [...new Set(v.split(/[\s,;]+/).map((s) => s.trim().toUpperCase()).filter(idValido))].slice(0, MAX_LISTA);
}
/** "/lista.html?i=MLB1,MLB2" (vírgula sem codificar: o link fica legível na mensagem). */
export function linkDaLista(ids: readonly string[]): string {
  return ids.length ? `${PAGINA_LISTA}?i=${ids.join(',')}` : PAGINA_LISTA;
}

/** "1 peça" / "3 peças" */
export const pecasTxt = (n: number) => `${n} ${n === 1 ? 'peça' : 'peças'}`;

// ---- armazenamento + evento (só no navegador) ----
export function lerLista(): ItemLista[] {
  try {
    return normalizar(JSON.parse(localStorage.getItem(CHAVE_LISTA) || '[]'));
  } catch {
    return [];
  }
}
/** Grava (lista vazia apaga a chave) e avisa a página inteira (cabeçalho, botões, /lista.html, rastreio). */
export function salvarLista(l: readonly ItemLista[], acao: AcaoLista, id?: string, origem?: string) {
  try {
    if (l.length) localStorage.setItem(CHAVE_LISTA, JSON.stringify(l));
    else localStorage.removeItem(CHAVE_LISTA);
  } catch {
    /* navegador sem armazenamento (aba anônima antiga): a lista vale só nesta página */
  }
  const detail: EventoLista = { acao, n: l.length, ...(id ? { id } : {}), ...(origem ? { origem } : {}) };
  window.dispatchEvent(new CustomEvent(EVENTO_LISTA, { detail }));
}
/** A lista guardada já tem os dados de agora (nome, carro, código) desde a rodada 13: a /lista.html confere preço e
 *  disponibilidade só no /dados/ativas.json. Sem a marca (lista de antes, com o carro da página no "Vai junto" e nomes
 *  velhos), ela confere UMA vez no índice inteiro e marca. Valor: quando (ms). */
export const CHAVE_CONFERIDA = 'izzatcar.lista.conferida';
export function marcarConferida() {
  try { localStorage.setItem(CHAVE_CONFERIDA, String(Date.now())); } catch { /* sem armazenamento */ }
}
export function listaConferida(): boolean {
  try { return !!localStorage.getItem(CHAVE_CONFERIDA); } catch { return false; }
}
/** Adiciona e avisa. 'ja' = já estava; 'cheia' = chegou a MAX_LISTA (quem chama diz isso à pessoa, nunca some calado). */
export function adicionarNaLista(item: ItemLista, origem?: string): 'ok' | 'ja' | 'cheia' {
  const l = lerLista();
  if (tem(l, item.id)) return 'ja';
  if (cheia(l)) return 'cheia';
  // lista nova: os dados vêm da página de agora (a /lista.html não precisa conferir no índice inteiro)
  if (!l.length) marcarConferida();
  salvarLista(adicionar(l, item), 'adicionar', item.id, origem);
  return 'ok';
}
/** A lista mudou noutra aba: esta aba fica igual (o evento 'storage' só chega nas outras abas). */
export function ouvirOutrasAbas() {
  window.addEventListener('storage', (e) => {
    if (e.key !== CHAVE_LISTA && e.key !== null) return;
    window.dispatchEvent(new CustomEvent(EVENTO_LISTA, { detail: { acao: 'outra-aba', n: lerLista().length } satisfies EventoLista }));
  });
}
