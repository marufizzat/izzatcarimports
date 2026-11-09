// "Meu carro" — a garagem do cliente. Fica SÓ no navegador dele (localStorage), sem cadastro.
// Contrato único usado pela abertura, cabeçalho, cartões, catálogo e página da peça:
//   localStorage['izzatcar.meuCarro'] = {"b":"Volvo","m":"XC60","y":2019}   (y pode ser null)
//   ao mudar: window.dispatchEvent(new CustomEvent('meu-carro', { detail: carro | null }))
// b = marca e m = modelo EXATAMENTE como nos dados (p.b / p.m); y = ano escolhido.
// A peça que serve em 2+ carros traz ms (e ys): ela vale para o carro salvo se ele estiver no ms.

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

/** "Volvo S60 e XC60" (todos os carros da peça, com a marca uma vez só). */
export function nomeModelos(p: PecaCarro): string {
  const ms = modelosDa(p);
  const lista = ms.length <= 1 ? ms.join('') : `${ms.slice(0, -1).join(', ')} e ${ms[ms.length - 1]}`;
  return [p.b, lista].filter(Boolean).join(' ');
}

/** A peça serve no carro? 'sim' (marca+modelo e ano dentro da faixa, ou carro sem ano),
 *  'confira-ano' (marca+modelo batem, ano fora da faixa da peça) ou null (outro carro / sem dados).
 *  A peça que serve em 2+ carros ("S60 XC60") vale para cada um deles, com a faixa daquele carro.
 *  Nunca dizemos "não serve": na dúvida, nada. */
export function serveNoMeuCarro(p: PecaCarro, c: MeuCarro | null): Serve {
  if (!c || !p.b || !p.m) return null;
  if (norm(p.b) !== norm(c.b) || !serveNoModelo(p, c.m)) return null;
  const y = anosNoModelo(p, c.m);
  if (c.y == null || !y) return 'sim';
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
