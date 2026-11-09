// Prévia do site no Cloudflare (Workers + arquivos estáticos).
// Os arquivos são servidos SEM redirecionar (/catalogo.html continua /catalogo.html).
// Este código só roda quando nenhum arquivo bate: "/" vira index.html; o resto, 404.html.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.endsWith('/')) {
      const idx = await env.ASSETS.fetch(new Request(new URL(url.pathname + 'index.html', url), request));
      if (idx.ok) return idx;
    }
    const nf = await env.ASSETS.fetch(new Request(new URL('/404.html', url), request));
    return new Response(nf.body, { status: 404, headers: nf.headers });
  },
};
