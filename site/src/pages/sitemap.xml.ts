// Sitemap unico (o limite do Google e 50 mil URLs e 50 MB; temos ~5,5 mil URLs). lastmod = ultima
// atualizacao do catalogo, que roda a cada 30 min. Cada peca leva a capa de estudio como <image:image>.
import { pecas, resumo, capaEstudio, SITE } from '../lib/dados';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function GET() {
  const r = resumo();
  const dia = (r.updated || new Date().toISOString()).slice(0, 10);
  const fixas = ['/', '/catalogo.html', '/carros.html', '/como-comprar.html', '/garantia.html', '/envios.html', '/sobre.html', '/contato.html', '/procuro-peca.html'];
  const linha = (u: string, pr: string, imagem?: string | null) =>
    `<url><loc>${SITE}${u}</loc><lastmod>${dia}</lastmod><priority>${pr}</priority>` +
    (imagem ? `<image:image><image:loc>${esc(SITE + imagem)}</image:loc></image:image>` : '') + `</url>`;
  const linhas = [
    ...fixas.map((u) => linha(u, '0.9')),
    ...r.carros.map((c) => linha(`/carros/${c.k}.html`, '0.8')),
    ...r.marcas.map((m) => linha(`/marca/${m.k}.html`, '0.8')),
    ...r.familias.filter((f) => f.n !== 'Outros').map((f) => linha(`/categoria/${f.k}.html`, '0.8')),
    ...pecas().map((p) => linha(`/peca/${p.slug}.html`, '0.7', capaEstudio(p.id))),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
    linhas.join('\n') + '\n</urlset>\n';
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
