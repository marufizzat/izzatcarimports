// Sitemap unico (o limite do Google e 50 mil URLs; temos ~5,5 mil). lastmod = ultima
// atualizacao do catalogo, que roda a cada 30 min.
import { pecas, resumo, SITE } from '../lib/dados';
export function GET() {
  const r = resumo();
  const dia = (r.updated || new Date().toISOString()).slice(0, 10);
  const fixas = ['/', '/catalogo.html', '/carros.html', '/como-comprar.html', '/garantia.html', '/envios.html', '/sobre.html', '/contato.html', '/procuro-peca.html'];
  const urls = [
    ...fixas.map((u) => [u, '0.9']),
    ...r.carros.map((c) => [`/carros/${c.k}.html`, '0.8']),
    ...r.marcas.map((m) => [`/marca/${m.k}.html`, '0.8']),
    ...r.familias.filter((f) => f.n !== 'Outros').map((f) => [`/categoria/${f.k}.html`, '0.8']),
    ...pecas().map((p) => [`/peca/${p.slug}.html`, '0.7']),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map(([u, pr]) => `<url><loc>${SITE}${u === '/' ? '/' : u}</loc><lastmod>${dia}</lastmod><priority>${pr}</priority></url>`).join('\n') + '\n</urlset>\n';
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}
