// /categoria/<chave antiga>.html: as famílias do Mercado Livre que o Google já conhece (pecas-de-interior, carroceria,
// iluminacao...) redirecionam para o bloco mais próximo (resumo.antigas, de preparar_dados.py) ou, se ele estiver
// sem peças agora, para o catálogo. O GitHub Pages não faz 301: meta refresh imediato + canonical (o Google trata
// como redirecionamento) + o link. Página mínima, sem CSS; fora do sitemap. As chaves que continuam (motor, freios...)
// são páginas de verdade em [k].astro.
import { resumo, SITE } from '../../lib/dados';

export function getStaticPaths() {
  const r = resumo();
  const blocos = new Map(r.familias.filter((f) => f.k !== 'outros' && f.c > 0).map((f) => [f.k, f]));
  return (r.antigas ?? []).filter((a) => !blocos.has(a.k)).map((a) => {
    const f = blocos.get(a.para);
    return { params: { antiga: a.k }, props: { para: f ? `/categoria/${f.k}.html` : '/catalogo.html', titulo: f ? f.n : 'Catálogo de peças' } };
  });
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

export function GET({ props }: { props: { para: string; titulo: string } }) {
  const { para, titulo } = props;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)} | Izzat Car Imports</title>` +
    `<link rel="canonical" href="${esc(SITE + para)}"><meta http-equiv="refresh" content="0; url=${esc(para)}">` +
    `<meta name="robots" content="noindex, follow"></head><body><p><a href="${esc(para)}">${esc(titulo)}</a></p></body></html>\n`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
