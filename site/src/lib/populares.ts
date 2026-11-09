// Atalhos da abertura: as peças que mais aparecem no pátio (contagem real dos anúncios).
// Lado (esquerda/direita) sai do nome: "Lanterna traseira esquerda" e "...direita" viram um atalho só.
import { pecas } from './dados';

const LADO = /\b(esquerd[ao]s?|direit[ao]s?|esq|dir)\b/gi;

export function populares(n = 6): { q: string; n: string; c: number }[] {
  const cont = new Map<string, { n: string; c: number }>();
  for (const p of pecas()) {
    const base = (p.n || '').replace(LADO, ' ').replace(/\btras\b/gi, 'traseiro').replace(/\bdiant\b/gi, 'dianteiro').replace(/\s+/g, ' ').trim();
    if (base.length < 4) continue;
    const k = base.toLowerCase();
    const e = cont.get(k);
    if (e) e.c++;
    else cont.set(k, { n: base.charAt(0).toUpperCase() + base.slice(1), c: 1 });
  }
  return [...cont.values()]
    .filter((e) => e.c >= 8)
    .sort((a, b) => b.c - a.c || a.n.localeCompare(b.n, 'pt-BR'))
    .slice(0, n)
    .map((e) => ({ q: e.n, n: e.n, c: e.c }));
}
