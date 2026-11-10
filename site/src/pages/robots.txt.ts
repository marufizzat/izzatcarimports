// /catalogo.html com filtro (?marca=&modelo=&tipo=…) tem a canônica em /catalogo.html e a mesma página no HTML: o
// Google gastava o rastreio em ~2.700 variações dela (links das páginas de carro, marca e categoria). As páginas de
// carro, marca e categoria já listam toda peça com link de verdade. O AdsBot do Google Ads ignora o "*" (anúncio segue ok).
export function GET() {
  if (process.env.PREVIA === '1') return new Response('User-agent: *\nDisallow: /\n', { headers: { 'Content-Type': 'text/plain' } });
  return new Response(
    `User-agent: *\nAllow: /\nDisallow: /dados/\nDisallow: /catalogo.html?\nDisallow: /catalogo?\n\nSitemap: https://izzatcarimports.com.br/sitemap.xml\n`,
    { headers: { 'Content-Type': 'text/plain' } },
  );
}
