// Miniatura leve de uma arte de public/ (gerada por scripts/miniaturas.mjs, com o hash do original no nome).
// Sem a miniatura certa (arte nova ou trocada e o script ainda não rodou): devolve a arte inteira. Só no build.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const PUB = join(process.cwd(), 'public');
const memo = new Map<string, string>();

/** "/arte/v2/topo-cat-motor.webp" -> "/arte/v2/mini/topo-cat-motor.<hash>.webp" (ou a própria arte). */
export function miniatura(arte: string): string {
  const pronto = memo.get(arte);
  if (pronto) return pronto;
  let saida = arte;
  const arq = join(PUB, arte);
  if (existsSync(arq)) {
    const h = createHash('sha1').update(readFileSync(arq)).digest('hex').slice(0, 8);
    const i = arte.lastIndexOf('/');
    const mini = `${arte.slice(0, i)}/mini/${arte.slice(i + 1).replace(/\.webp$/, `.${h}.webp`)}`;
    if (existsSync(join(PUB, mini))) saida = mini;
  }
  memo.set(arte, saida);
  return saida;
}
