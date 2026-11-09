// Atalhos da aba "Pelo nome ou código": TIPOS de peça que mais aparecem no pátio (contagem real dos anúncios).
// Cada tipo junta as variações do nome ("Motor vidro elétrico diant esq" e "Motor vidro traseiro" são
// "Motor do vidro"); um tipo por família do carro, para os atalhos nunca saírem quase iguais. No máximo 4.
// A busca `q` usa palavras que estão no nome das peças (o catálogo busca com E entre as palavras).
import { pecas } from './dados';

type Tipo = { n: string; q: string; familia: string; re: RegExp };

const TIPOS: Tipo[] = [
  { n: 'Lanternas', q: 'lanterna', familia: 'iluminacao', re: /^lanterna\b/ },
  { n: 'Faróis', q: 'farol', familia: 'iluminacao', re: /^farol\b/ },
  { n: 'Retrovisores', q: 'retrovisor', familia: 'carroceria', re: /^retrovisor\b/ },
  { n: 'Motor do vidro', q: 'motor vidro', familia: 'portas', re: /^(motor|maquina)( de| do)? vidro\b/ },
  { n: 'Fechaduras', q: 'fechadura', familia: 'portas', re: /^fechadura\b/ },
  { n: 'Maçanetas', q: 'maçaneta', familia: 'portas', re: /^macaneta\b/ },
  { n: 'Módulos', q: 'módulo', familia: 'eletrica', re: /^modulo\b/ },
  { n: 'Painel de instrumentos', q: 'painel instrumentos', familia: 'eletrica', re: /^painel (de )?instrumentos?\b/ },
  { n: 'Coxins do motor', q: 'coxim', familia: 'motor', re: /\bcoxim\b/ },
  { n: 'Alternadores', q: 'alternador', familia: 'motor', re: /^alternador\b/ },
];

const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function populares(n = 4): { q: string; n: string; c: number }[] {
  const cont = new Map<Tipo, number>();
  for (const p of pecas()) {
    const nome = normal(p.n || '');
    for (const t of TIPOS) if (t.re.test(nome)) cont.set(t, (cont.get(t) ?? 0) + 1);
  }
  const usadas = new Set<string>();
  const out: { q: string; n: string; c: number }[] = [];
  for (const [t, c] of [...cont.entries()].filter(([, c]) => c >= 10).sort((a, b) => b[1] - a[1])) {
    if (usadas.has(t.familia)) continue;
    usadas.add(t.familia);
    out.push({ q: t.q, n: t.n, c });
    if (out.length >= Math.min(n, 4)) break;
  }
  return out;
}
