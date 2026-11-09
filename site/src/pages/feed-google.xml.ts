// Feed do Google Shopping (gratis), gerado no build: /feed-google.xml. Sem frete (o Merchant Center
// tem a configuracao de frete). Itens: src/lib/feed.ts.
import { pecas, SITE } from '../lib/dados';
import { itemFeed, xmlItem, escXml } from '../lib/feed';
export function GET() {
  const itens = pecas()
    .map((p) => itemFeed(p, null, SITE)) // Google não aceita logo sobre a foto: o feed usa as fotos reais do anúncio
    .filter((i): i is NonNullable<typeof i> => !!i);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n<channel>\n` +
    `<title>${escXml('Izzat Car Imports: peças originais usadas')}</title>\n` +
    `<link>${SITE}/</link>\n` +
    `<description>${escXml('Peças originais usadas de carros com baixa legal (CDV Detran-RS nº 01060).')}</description>\n` +
    itens.map((i) => xmlItem(i)).join('\n') + '\n</channel>\n</rss>\n';
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
