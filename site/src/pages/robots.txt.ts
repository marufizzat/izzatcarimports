export function GET() {
  if (process.env.PREVIA === '1') return new Response('User-agent: *\nDisallow: /\n', { headers: { 'Content-Type': 'text/plain' } });
  return new Response(`User-agent: *\nAllow: /\nDisallow: /dados/\n\nSitemap: https://izzatcarimports.com.br/sitemap.xml\n`, { headers: { 'Content-Type': 'text/plain' } });
}
