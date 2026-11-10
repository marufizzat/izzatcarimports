// "Continuar de onde parou" (home, components/v2/Continuar.astro): UMA faixa discreta no alto da abertura para quem
// volta — a lista de orçamento com peças (lib/lista.ts) ou, sem lista, a última busca. Lista > busca. Dispensável (×) e
// lembrada: a faixa dispensada só volta quando a lista muda de peças ou a busca é outra.
// Contrato (só no navegador, sem cadastro):
//   localStorage['izzatcar.busca'] = {"q":"farol xc60","u":"/catalogo.html?q=farol+xc60&ano=2019","t":1762800000000}
//     (gravado pelo catálogo, catalogo.astro: a busca com texto de quando a pessoa sai da página; 14 dias)
//   localStorage['izzatcar.continuar'] = a "assinatura" da faixa dispensada ("l:MLB1,MLB2" ou "b:farol xc60")
// A faixa é desenhada ANTES da 1ª pintura (faixaAntes, sem nada de fora, por toString): quem não tem lista nem busca
// não vê nada e nada se mexe. O total no WhatsApp é a SOMA das linhas com o desconto, em centavos (a mesma conta de
// somaPrecos em lib/whats.ts e da página /lista.html).
export const CHAVE_BUSCA = 'izzatcar.busca';
export const CHAVE_FECHADO = 'izzatcar.continuar';
/** a última busca vale por 14 dias */
export const VALIDADE_BUSCA = 14 * 24 * 3600 * 1000;

export type UltimaBusca = { q: string; u: string; t: number };

/** A busca guardada, conferida (texto de 2 a 80 letras, endereço do próprio catálogo, de até 14 dias). */
export function buscaDe(x: unknown, agora = Date.now()): UltimaBusca | null {
  const o = x as Partial<UltimaBusca> | null;
  if (!o || typeof o.q !== 'string' || typeof o.u !== 'string' || typeof o.t !== 'number') return null;
  const q = o.q.replace(/\s+/g, ' ').trim();
  if (q.length < 2 || q.length > 80 || !/^\/catalogo\.html\?[^#\s]*$/.test(o.u) || agora - o.t > VALIDADE_BUSCA || o.t > agora + 60000) return null;
  return { q, u: o.u, t: o.t };
}

/** O que guardar quando a pessoa deixa o catálogo (location.search): só a busca com texto; sem texto, nada (a anterior fica). */
export function buscaDoEndereco(search: string, agora = Date.now()): UltimaBusca | null {
  const q = (new URLSearchParams(search).get('q') || '').replace(/\s+/g, ' ').trim();
  if (q.length < 2 || q.length > 80) return null;
  return { q, u: `/catalogo.html${search.startsWith('?') ? search : `?${search}`}`.slice(0, 600), t: agora };
}
export function lembrarBusca(search: string) {
  const b = buscaDoEndereco(search);
  if (!b) return;
  try { localStorage.setItem(CHAVE_BUSCA, JSON.stringify(b)); } catch { /* sem armazenamento */ }
}

export type Faixa =
  | { tipo: 'lista'; n: number; total: string; href: string; assinatura: string }
  | { tipo: 'busca'; q: string; href: string; assinatura: string };

/** A faixa (ou null). Sem nada de fora: vai copiada para dentro do HTML por toString(). `desconto` = DESCONTO_WHATS. */
export function faixaAntes(lista: string | null, busca: string | null, fechado: string | null, agora: number, desconto: number): Faixa | null {
  try {
    const l = JSON.parse(lista || '[]');
    const ids: string[] = [];
    let centavos = 0;
    if (Array.isArray(l)) {
      for (const it of l) {
        if (!it || typeof it.id !== 'string' || !/^MLB\d{6,14}$/.test(it.id) || ids.indexOf(it.id) >= 0) continue;
        if (ids.length >= 30) break;
        ids.push(it.id);
        const p = typeof it.preco === 'number' ? it.preco : Number(it.preco);
        // precoWhats (lib/whats.ts): em centavos inteiros, cada linha arredondada como aparece nela
        if (p > 0) centavos += Math.round((Math.round(p * 100) * (100 - desconto)) / 100);
      }
    }
    if (ids.length) {
      const assinatura = 'l:' + ids.join(',');
      if (assinatura === fechado) return null;
      const total = (centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return { tipo: 'lista', n: ids.length, total, href: '/lista.html', assinatura };
    }
    const b = JSON.parse(busca || 'null');
    if (!b || typeof b.q !== 'string' || typeof b.u !== 'string' || typeof b.t !== 'number') return null;
    const q = b.q.replace(/\s+/g, ' ').trim();
    if (q.length < 2 || q.length > 80 || !/^\/catalogo\.html\?[^#\s]*$/.test(b.u) || agora - b.t > 14 * 24 * 3600 * 1000 || b.t > agora + 60000) return null;
    const assinatura = 'b:' + q.toLowerCase();
    if (assinatura === fechado) return null;
    return { tipo: 'busca', q, href: b.u, assinatura };
  } catch {
    return null;
  }
}
