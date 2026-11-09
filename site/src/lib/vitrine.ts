// Foto de vitrine de um tipo/sistema: a capa de estudio de uma peca daquele grupo.
// Prefere a foto maquiada (estudio-pro); senao a de estudio automatica. Quem vem primeiro na lista ganha.
import { capaEstudio, type Peca } from './dados';

export function fotoVitrine(lista: Peca[], filtro: (p: Peca) => boolean): string | null {
  let melhor: string | null = null;
  for (const p of lista) {
    if (!filtro(p)) continue;
    const c = capaEstudio(p.id);
    if (!c) continue;
    if (c.startsWith('/estudio-pro/')) return c;
    melhor ??= c;
  }
  return melhor;
}
