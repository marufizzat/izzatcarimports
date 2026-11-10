// Sitemap unico (o limite do Google e 50 mil URLs e 50 MB; temos ~5,5 mil URLs). Cada peca leva a capa de estudio como
// <image:image>. lastmod de verdade (SEO, 10/11): antes toda URL saia com a data da rodada (a cada 30 min) e o Google
// passa a ignorar um lastmod que muda sempre. Agora:
//  - peca: o dia da ultima mudanca do anuncio no ML ("u"; sem ele, a data do catalogo);
//  - carro, marca e categoria: o dia mais novo entre as pecas da pagina (entrou, mudou de preco...);
//  - paginas fixas: a data do catalogo. Sem <priority> (o Google ignora).
import { pecas, resumo, capaEstudio, SITE, type Peca } from '../lib/dados';
import { serveNoModelo } from '../lib/meuCarro';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function GET() {
  const r = resumo();
  const hoje = (r.updated || new Date().toISOString()).slice(0, 10);
  const ps = pecas();
  const dia = (p: Peca) => (p.u && p.u <= hoje ? p.u : hoje);
  const maisNovo = (lista: Peca[]) => lista.reduce((d, p) => (dia(p) > d ? dia(p) : d), '') || hoje;
  const fixas = ['/', '/catalogo.html', '/carros.html', '/como-comprar.html', '/garantia.html', '/envios.html', '/sobre.html', '/contato.html', '/procuro-peca.html'];
  const linha = (u: string, d: string, imagem?: string | null) =>
    `<url><loc>${SITE}${u}</loc><lastmod>${d}</lastmod>` +
    (imagem ? `<image:image><image:loc>${esc(SITE + imagem)}</image:loc></image:image>` : '') + `</url>`;
  const linhas = [
    ...fixas.map((u) => linha(u, hoje)),
    ...r.carros.map((c) => linha(`/carros/${c.k}.html`, maisNovo(ps.filter((p) => p.b === c.b && serveNoModelo(p, c.m))))),
    ...r.marcas.map((m) => linha(`/marca/${m.k}.html`, maisNovo(ps.filter((p) => p.b === m.n)))),
    // só a categoria que tem página (categoria/[k].astro: com peça e fora "Outros"); a vazia daria 404 no sitemap
    ...r.familias.filter((f) => f.k !== 'outros' && f.c > 0).map((f) => linha(`/categoria/${f.k}.html`, maisNovo(ps.filter((p) => p.c === f.n)))),
    ...ps.map((p) => linha(`/peca/${p.slug}.html`, dia(p), capaEstudio(p.id))),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
    linhas.join('\n') + '\n</urlset>\n';
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
