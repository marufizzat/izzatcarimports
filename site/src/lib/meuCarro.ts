// "Meu carro" — a garagem do cliente. Fica SÓ no navegador dele (localStorage), sem cadastro.
// Contrato único usado pela abertura, cabeçalho, cartões, catálogo e página da peça:
//   localStorage['izzatcar.meuCarro'] = {"b":"Volvo","m":"XC60","y":2019}   (y pode ser null)
//   ao mudar: window.dispatchEvent(new CustomEvent('meu-carro', { detail: carro | null }))
// b = marca e m = modelo EXATAMENTE como nos dados (p.b / p.m); y = ano escolhido.

export type MeuCarro = { b: string; m: string; y: number | null };
export type Serve = 'sim' | 'confira-ano' | null;

export const CHAVE = 'izzatcar.meuCarro';
export const EVENTO = 'meu-carro';

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

/** A peça serve no carro? 'sim' (marca+modelo e ano dentro da faixa, ou carro sem ano),
 *  'confira-ano' (marca+modelo batem, ano fora da faixa da peça) ou null (outro carro / sem dados).
 *  Nunca dizemos "não serve": na dúvida, nada. */
export function serveNoMeuCarro(p: { b?: string | null; m?: string | null; y?: [number, number] | null }, c: MeuCarro | null): Serve {
  if (!c || !p.b || !p.m) return null;
  if (norm(p.b) !== norm(c.b) || norm(p.m) !== norm(c.m)) return null;
  if (c.y == null || !p.y) return 'sim';
  return c.y >= p.y[0] && c.y <= p.y[1] ? 'sim' : 'confira-ano';
}

/** "Volvo XC60 2019" */
export const nomeCarro = (c: MeuCarro) => `${c.b} ${c.m}${c.y ? ` ${c.y}` : ''}`;
