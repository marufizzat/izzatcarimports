// Script que vai DENTRO do HTML (os "antes da 1ª pintura" da home: Continuar, ChegouCarro, VoceViu) sai minificado no
// build: as funções copiadas por toString() chegam com nomes longos e comentários de lado. Só no build (frontmatter).
import { transformSync } from 'esbuild';

export function scriptCurto(js: string): string {
  return transformSync(js, { loader: 'js', minify: true, target: 'es2019' }).code.trim();
}
