/* IZZAT CAR — service worker do app (CONSERVADOR: o cliente nunca vê preço velho nem peça vendida "à venda").
   Registrado por src/components/app/app.ts (Base.astro) depois do load. A versão e a lista do casco são postas no build
   (integracoes/service-worker.mjs); sem o build: 'dev' e só a página sem conexão. Como desligar: CLAUDE.md, item 12.
   - Página (navegação): REDE PRIMEIRO, sempre. A cópia guardada só sai quando a rede falha ou passa de 3 s, com a faixa
     "Você está sem conexão: mostrando a última versão que você viu" posta no próprio HTML (sem pulo). Sem cópia:
     /offline.html. Resposta 404/410 (peça vendida) passa direto e apaga a cópia daquela página.
   - /dados/*.json: rede primeiro (preço e estoque mudam a cada rodada); a cópia só para a página que já é cópia.
   - /_astro/* (nome com hash, nunca muda): cache primeiro. Capas e artes: a guardada na hora e a nova por trás
     (até 300, no máximo 7 dias).
   - Nunca toca: outro domínio (WhatsApp, Mercado Livre, fotos do ML, GA, Pixel), o que não é GET, pedaço de arquivo
     (Range), o prerender/prefetch do Chrome (vai direto para a rede, como sem o service worker) e o fetch do navegar.js.
   - Botão de pânico: /sw-desligar.txt com "1" (conferido na ativação e a cada 6 h; a página confere a cada carga). */
'use strict';
const VERSAO = 'dev';
const CASCO = ['/offline.html'];

const OFFLINE = '/offline.html';
const PRAZO_HTML = 3000;
const SEIS_HORAS = 6 * 3600 * 1000;
const SETE_DIAS = 7 * 24 * 3600 * 1000;
// o casco troca com a versão; os outros só com o formato (R: trocar à mão se o jeito de guardar mudar)
const R = 'v1';
const CACHE = {
  casco: 'izzat-casco-' + VERSAO,
  paginas: 'izzat-paginas-' + R,
  dados: 'izzat-dados-' + R,
  astro: 'izzat-astro-' + R,
  artes: 'izzat-artes-' + R,
  ctl: 'izzat-ctl-' + R,
};
const LIMITE = { paginas: 60, dados: 12, astro: 250, artes: 300 };
const ARTES = /^\/(?:estudio[\w-]*|arte|marcas|icones[\w-]*|identidade)\/|^\/icones\.svg$|\.woff2?$/;
let desligado = false;
// os caches abertos ficam guardados (abrir de novo a cada pedido custa uma ida ao armazenamento do navegador)
const abertos = {};
const abrir = (nome) => (abertos[nome] = abertos[nome] || caches.open(nome));
// páginas abertas a partir de uma cópia (a faixa está na tela): só elas recebem a cópia dos /dados/ sem rede
const copias = new Set();

self.addEventListener('install', (event) => {
  self.skipWaiting();
  // fotos do ML, GA e Pixel nem acordam o service worker (Chrome 123+; sem a API, o fetch abaixo ignora outro domínio)
  try {
    if (event.addRoutes) {
      event.addRoutes(['https://*.mlstatic.com/*', 'https://*.googletagmanager.com/*', 'https://*.google-analytics.com/*',
        'https://connect.facebook.net/*', 'https://*.facebook.com/*'].map((u) => ({ condition: { urlPattern: u }, source: 'network' }))).catch(() => {});
    }
  } catch (e) { /* segue sem as rotas */ }
  event.waitUntil(caches.open(CACHE.casco).then((c) => c.addAll(CASCO.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const atuais = new Set(Object.values(CACHE));
    for (const k of await caches.keys()) if (k.startsWith('izzat-') && !atuais.has(k)) await caches.delete(k);
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable().catch(() => {});
    await self.clients.claim();
    await checarDesligar(true);
    if (!desligado) await vencidas();
  })());
});

self.addEventListener('message', (event) => {
  const d = event.data || {};
  // a página que não passou por aqui (a 1ª visita, a preparada pelo prerender) pede a própria cópia (sai do cache HTTP)
  if (d.tipo === 'guardar' && typeof d.url === 'string' && /^\/(?!\/)/.test(d.url) && !desligado) event.waitUntil(guardarDaRede(d.url));
  // diagnóstico (testes): a versão em uso
  else if (d.tipo === 'versao' && event.ports && event.ports[0]) event.ports[0].postMessage({ versao: VERSAO, desligado });
});

self.addEventListener('fetch', (event) => {
  if (desligado) return;
  const req = event.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // o Chrome preparando a próxima página (regras de especulação): rede, sem cópia e sem prazo
    if (/prefetch|prerender/i.test(req.headers.get('sec-purpose') || req.headers.get('purpose') || '')) return;
    event.waitUntil(checarDesligar(false));
    event.respondWith(navegar(event, url));
    return;
  }
  const p = url.pathname;
  if (p === '/sw.js' || p === '/sw-desligar.txt') return;
  if (p.startsWith('/dados/')) event.respondWith(dados(event, p + url.search));
  else if (p.startsWith('/_astro/')) event.respondWith(imutavel(event, p));
  else if (ARTES.test(p)) event.respondWith(artes(event, p + url.search));
  else if (CASCO.includes(p)) event.respondWith(casco(event, p));
  // o resto (HTML baixado pelo navegar.js, scripts sem hash, ícones da raiz...): direto para a rede, como sem o SW
});

// ---- páginas ----
function navegar(event, url) {
  const chave = url.pathname; // a mesma página com ou sem ?app=1, ?q=... (o HTML é o mesmo; a busca é montada na tela)
  const rede = Promise.resolve(event.preloadResponse).then((r) => r || fetch(event.request));
  // a reação que guarda vem ANTES de a página ler o corpo (clone antes do uso)
  event.waitUntil(rede.then((r) => {
    if (r.status === 404 || r.status === 410) return apagar(CACHE.paginas, chave);
    if (paginaBoa(r)) return guardar(CACHE.paginas, chave, r.clone(), LIMITE.paginas);
  }).catch(() => {}));
  return responder(event, chave, rede);
}

async function responder(event, chave, rede) {
  let motivo = 'offline';
  try {
    // status HTTP (404, 500) passa direto: a cópia é só para a rede que falhou ou demorou
    return await Promise.race([rede, esperar(PRAZO_HTML).then(() => { throw new Error('prazo'); })]);
  } catch (e) {
    if (e && e.message === 'prazo') motivo = 'lenta';
  }
  const copia = await (await abrir(CACHE.paginas)).match(chave);
  if (copia) {
    if (event.resultingClientId) { copias.add(event.resultingClientId); if (copias.size > 40) copias.delete(copias.values().next().value); }
    return comFaixa(copia, motivo);
  }
  // sem cópia e a rede só está lenta: espera por ela (a página sem conexão seria mentira)
  if (motivo === 'lenta') { try { return await rede; } catch (e) { /* caiu de vez */ } }
  return (await (await abrir(CACHE.casco)).match(OFFLINE)) || Response.error();
}

const paginaBoa = (r) => r && r.status === 200 && r.type === 'basic' && !r.redirected && /text\/html/.test(r.headers.get('content-type') || '');

// a cópia com a faixa no topo (no HTML: aparece na 1ª pintura, sem empurrar nada depois) e html[data-copia]
async function comFaixa(resp, motivo) {
  const html = await resp.text();
  const d = new Date(resp.headers.get('date') || Date.now());
  let quando = '';
  try { quando = isNaN(d) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) { /* sem data */ }
  const txt = motivo === 'lenta' ? 'Sua conexão está lenta: mostrando a última versão que você viu' : 'Você está sem conexão: mostrando a última versão que você viu';
  const faixa = '<div id="app-copia" role="status" data-motivo="' + motivo + '" style="position:relative;z-index:60;display:flex;flex-wrap:wrap;align-items:center;' +
    'justify-content:center;gap:6px 12px;padding:8px 16px;background:#fff1e6;color:#1d1d1f;border-bottom:1px solid #f5c9a6;font-size:14px;line-height:1.35;' +
    'font-weight:600;text-align:center"><span data-copia-txt>' + txt + (quando ? ' <span style="font-weight:500;color:#5b5b61">(de ' + quando + ')</span>' : '') +
    '</span><button type="button" onclick="location.reload()" style="min-height:36px;padding:0 14px;border:0;border-radius:10px;background:#fff;color:#1d1d1f;' +
    'font:inherit;font-weight:700;box-shadow:inset 0 0 0 1.5px #d1d1d6;cursor:pointer">' + (motivo === 'lenta' ? 'Atualizar' : 'Tentar de novo') + '</button></div>';
  const novo = html.replace(/<html\b/i, '<html data-copia="' + motivo + '"').replace(/<body\b[^>]*>/i, (m) => m + faixa);
  const h = new Headers(resp.headers);
  h.delete('content-length'); h.delete('content-encoding');
  return new Response(novo, { status: 200, statusText: 'OK', headers: h });
}

async function guardarDaRede(caminho) {
  try {
    const r = await fetch(caminho, { credentials: 'same-origin' });
    if (paginaBoa(r)) await guardar(CACHE.paginas, new URL(caminho, self.location.origin).pathname, r, LIMITE.paginas);
  } catch (e) { /* sem rede: fica sem cópia */ }
}

// ---- dados (preço e estoque): rede primeiro ----
async function dados(event, chave) {
  try {
    const r = await fetch(event.request);
    if (r.ok && r.type === 'basic') event.waitUntil(guardar(CACHE.dados, chave, r.clone(), LIMITE.dados).catch(() => {}));
    return r;
  } catch (e) {
    // a cópia só para a página que já é a cópia (com a faixa); a página que veio da rede segue como sem o SW
    if (copias.has(event.clientId)) {
      const c = await (await abrir(CACHE.dados)).match(chave);
      if (c) return c;
    }
    throw e;
  }
}

// ---- arquivos com hash: cache primeiro ----
async function imutavel(event, chave) {
  // só os 2 caches onde ele pode estar (o caches.match sem nome procura em todos)
  const c = (await (await abrir(CACHE.astro)).match(chave)) || (CASCO.includes(chave) ? await (await abrir(CACHE.casco)).match(chave) : undefined);
  if (c) return c;
  const r = await fetch(event.request);
  if (r.ok && r.type === 'basic') event.waitUntil(guardar(CACHE.astro, chave, r.clone(), LIMITE.astro).catch(() => {}));
  return r;
}

// ---- capas e artes: a guardada na hora, a nova por trás (stale-while-revalidate) ----
async function artes(event, chave) {
  const cache = await abrir(CACHE.artes);
  const c = (await cache.match(chave)) || (CASCO.includes(chave) ? await (await abrir(CACHE.casco)).match(chave) : undefined);
  const rede = fetch(event.request);
  event.waitUntil(rede.then((r) => {
    if (r.ok && r.type === 'basic') return guardar(CACHE.artes, chave, r.clone(), LIMITE.artes);
    if (r.status === 404) return cache.delete(chave);
  }).catch(() => {}));
  if (c && idade(c) < SETE_DIAS) return c;
  try { return await rede; } catch (e) { if (c) return c; throw e; }
}

// ---- casco fora do /_astro (ícone, logo): rede primeiro, o guardado sem rede ----
async function casco(event, chave) {
  try { return await fetch(event.request); } catch (e) {
    const c = await (await abrir(CACHE.casco)).match(chave);
    if (c) return c;
    throw e;
  }
}

// ---- guardar com limite ----
const aparado = {};
async function guardar(nome, chave, r, limite) {
  if (desligado) return;
  const cache = await abrir(nome);
  const velho = await cache.match(chave);
  if (velho && igual(velho, r)) return; // o mesmo arquivo (ETag): não grava de novo
  await cache.put(chave, r);
  // apara no máximo a cada 5 s por cache: as entradas mais antigas (a ordem das chaves é a da gravação) saem
  const agora = Date.now();
  if (aparado[nome] && agora - aparado[nome] < 5000) return;
  aparado[nome] = agora;
  const ks = await cache.keys();
  for (let i = 0; i < ks.length - limite; i++) await cache.delete(ks[i]);
}
function igual(a, b) {
  const ea = a.headers.get('etag'), eb = b.headers.get('etag');
  if (ea && eb) return ea === eb;
  const la = a.headers.get('last-modified');
  return !!la && la === b.headers.get('last-modified') && a.headers.get('content-length') === b.headers.get('content-length');
}
async function apagar(nome, chave) { await (await abrir(nome)).delete(chave); }
const idade = (r) => { const t = Date.parse(r.headers.get('date') || ''); return isNaN(t) ? 0 : Date.now() - t; };
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

// capas e artes com mais de 7 dias saem (na ativação)
async function vencidas() {
  const cache = await abrir(CACHE.artes);
  for (const k of await cache.keys()) {
    const r = await cache.match(k);
    if (r && idade(r) >= SETE_DIAS) await cache.delete(k);
  }
}

// ---- botão de pânico ----
let proxima = 0;
async function checarDesligar(forcar) {
  if (desligado || (!forcar && Date.now() < proxima)) return;
  try {
    const ctl = await abrir(CACHE.ctl);
    if (!forcar) {
      const r = await ctl.match('/__checado');
      const t = r ? Number(await r.text()) || 0 : 0;
      proxima = t + SEIS_HORAS;
      if (Date.now() < proxima) return;
    }
    proxima = Date.now() + SEIS_HORAS;
    await ctl.put('/__checado', new Response(String(Date.now())));
    const r = await fetch('/sw-desligar.txt', { cache: 'no-store' });
    if (r.ok && (await r.text()).trim() === '1') await desligar();
  } catch (e) { /* sem rede: confere na próxima */ }
}
async function desligar() {
  desligado = true;
  for (const k of Object.keys(abertos)) delete abertos[k];
  for (const k of await caches.keys()) if (k.startsWith('izzat-')) await caches.delete(k);
  await self.registration.unregister();
}
