// O app instalável no navegador. Desce DEPOIS do load, num pedaço à parte, pelo script do cabeçalho (Cabecalho.astro:
// toda página do site; um <script> no <head> do Base.astro era mais um pedido disputando a 1ª tela). Nada aqui atrasa a
// 1ª pintura:
//  1) depois do load: o botão de pânico (/sw-desligar.txt com "1" desliga e apaga tudo) e o registro do service worker
//     (public/sw.js). A página que não passou por ele (1ª visita, preparada pelo prerender) pede a própria cópia;
//  2) a faixa "sem conexão" (a cópia guardada já vem com ela, posta pelo SW; aqui só o "a conexão voltou");
//  3) o convite para instalar (raro, lib/app.ts; o desenho em ./convite.ts só desce quando vai aparecer);
//  4) no app instalado: link de fora (WhatsApp, Mercado Livre) abre fora do app, e a página volta atualizada quando o
//     app fica 30 min ou mais em segundo plano.
// Página preparada pelo prerender: nada roda até a pessoa abrir.
import { CHAVE_APP, ARQUIVO_DESLIGAR, CHAVE_LISTA, CHAVE_VISTOS, estadoDe, novaVisita, podeConvidar, iosQueInstala, pedeDesligar, type EstadoApp } from '../../lib/app';

type PedidoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

const raiz = document.documentElement;
const SESSAO = 'izzatcar.app.sessao';
const MEIA_HORA = 30 * 60 * 1000;
const standalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const semConexaoPagina = () => !!document.querySelector('[data-pagina-offline]');

function lerEstado(): EstadoApp {
  try { return estadoDe(JSON.parse(localStorage.getItem(CHAVE_APP) || 'null')); } catch { return { v: 0 }; }
}
function salvarEstado(e: EstadoApp) {
  try { localStorage.setItem(CHAVE_APP, JSON.stringify(e)); } catch { /* sem armazenamento: convida no máximo uma vez por página */ }
}
const quantos = (chave: string) => { try { const l = JSON.parse(localStorage.getItem(chave) || '[]'); return Array.isArray(l) ? l.length : 0; } catch { return 0; } };
const sessao = (v?: string) => { try { if (v) sessionStorage.setItem(SESSAO, v); return sessionStorage.getItem(SESSAO) || ''; } catch { return v || ''; } };
const depoisDoLoad = (f: () => void, folga = 0) => {
  const vai = () => setTimeout(() => ('requestIdleCallback' in window ? requestIdleCallback(f, { timeout: 4000 }) : f()), folga);
  if (document.readyState === 'complete') vai(); else addEventListener('load', vai, { once: true });
};

// ---- 1) service worker ----
async function servico() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  const sw = navigator.serviceWorker;
  try {
    // ?sw=0 no endereço desliga só neste aparelho (suporte: "abre este link")
    let desligar = /[?&]sw=0(?:&|$)/.test(location.search);
    if (!desligar) {
      try {
        const r = await fetch(ARQUIVO_DESLIGAR, { cache: 'no-store' });
        desligar = r.ok && pedeDesligar(await r.text());
      } catch { /* sem rede: segue como está */ }
    }
    if (desligar) {
      await Promise.all((await sw.getRegistrations()).map((r) => r.unregister()));
      if ('caches' in window) for (const k of await caches.keys()) if (k.startsWith('izzat-')) await caches.delete(k);
      raiz.dataset.swDesligado = '1';
      return;
    }
    const controlada = !!sw.controller;
    await sw.register('/sw.js', { scope: '/', updateViaCache: 'none' });
    // a cópia desta página para abrir sem conexão: quem veio pelo SW já foi guardada por ele
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming & { activationStart?: number } | undefined;
    const preparada = (nav?.activationStart ?? 0) > 0;
    if (raiz.dataset.copia || semConexaoPagina() || (controlada && !preparada)) return;
    const reg = await sw.ready;
    reg.active?.postMessage({ tipo: 'guardar', url: location.pathname });
  } catch { /* navegador sem service worker (aba anônima do Firefox...): o site segue igual */ }
}

// ---- 2) a faixa da cópia ----
const TXT_SEM = 'Você está sem conexão: mostrando a última versão que você viu';
function faixaSemConexao() {
  if (document.getElementById('app-copia') || semConexaoPagina()) return;
  const d = document.createElement('div');
  d.id = 'app-copia'; d.setAttribute('role', 'status'); d.dataset.motivo = 'offline';
  d.setAttribute('style', 'position:relative;z-index:60;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px 12px;padding:8px 16px;'
    + 'background:#fff1e6;color:#1d1d1f;border-bottom:1px solid #f5c9a6;font-size:14px;line-height:1.35;font-weight:600;text-align:center');
  const s = document.createElement('span'); s.dataset.copiaTxt = ''; s.textContent = TXT_SEM;
  const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Tentar de novo';
  b.setAttribute('style', 'min-height:36px;padding:0 14px;border:0;border-radius:10px;background:#fff;color:#1d1d1f;font:inherit;font-weight:700;box-shadow:inset 0 0 0 1.5px #d1d1d6;cursor:pointer');
  b.addEventListener('click', () => location.reload());
  d.append(s, b);
  document.body.prepend(d);
}
function faixaVoltou() {
  const d = document.getElementById('app-copia');
  if (!d) return;
  const s = d.querySelector('[data-copia-txt]'); if (s) s.textContent = 'A conexão voltou: toque para ver a versão de agora';
  const b = d.querySelector('button'); if (b) b.textContent = 'Atualizar';
}

// ---- 3) o convite para instalar ----
let pedido: PedidoInstalar | null = null;
let pronto = false; // o load + a folga já passaram (o convite nunca disputa a 1ª tela)
function talvezConvidar() {
  if (!pronto || document.querySelector('.app-convite')) return;
  const ios = !pedido && iosQueInstala(navigator.userAgent, navigator.maxTouchPoints);
  if (!pedido && !ios) return;
  // só no celular/tablet (no PC o Chrome já mostra o ícone de instalar na barra de endereço)
  if (!matchMedia('(pointer: coarse)').matches) return;
  const e = lerEstado();
  const ok = podeConvidar(e, {
    agora: Date.now(), standalone: standalone(), nLista: quantos(CHAVE_LISTA), nVistos: quantos(CHAVE_VISTOS),
    ocupada: !!document.querySelector('.barra-compra, .lst-barra, [data-pagina-offline], dialog[open]'), jaNestaSessao: sessao() === 'convidou',
  });
  if (!ok) return;
  sessao('convidou');
  const avisar = (resultado: 'aceito' | 'dispensado', onde: string) =>
    dispatchEvent(new CustomEvent('app-instalar', { detail: { resultado, onde } }));
  import('./convite').then(({ mostrarConvite }) => mostrarConvite({
    ios,
    instalar: async () => {
      const p = pedido; if (!p) return false;
      pedido = null;
      await p.prompt();
      const { outcome } = await p.userChoice;
      if (outcome === 'accepted') salvarEstado({ ...lerEstado(), i: 1 });
      else salvarEstado({ ...lerEstado(), d: Date.now() });
      avisar(outcome === 'accepted' ? 'aceito' : 'dispensado', 'chrome');
      return true;
    },
    dispensar: () => { salvarEstado({ ...lerEstado(), d: Date.now() }); avisar('dispensado', ios ? 'ios' : 'faixa'); },
  })).catch(() => { /* sem rede para o pedaço do convite: fica para outra vez */ });
}

function iniciar() {
  // visita = sessão nova do navegador
  if (!sessao()) { sessao('1'); salvarEstado(novaVisita(lerEstado())); }

  // a janela de instalar que chegou antes deste pedaço (guardada pelo cabeçalho, já com o preventDefault)
  const cedo = (window as Window & { __izzatInstalar?: Event }).__izzatInstalar;
  if (cedo) pedido = cedo as PedidoInstalar;
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // nada de barra do Chrome na 1ª visita: o convite segue as regras daqui
    pedido = e as PedidoInstalar;
    talvezConvidar();
  });
  addEventListener('appinstalled', () => {
    salvarEstado({ ...lerEstado(), i: 1 });
    document.querySelector('.app-convite')?.remove();
  });

  if (standalone()) {
    raiz.classList.add('app');
    // link para fora do site (WhatsApp, Mercado Livre, Instagram): abre fora do app, nunca preso dentro dele
    document.addEventListener('click', (e) => {
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target || a.origin === location.origin || !/^https?:$/.test(a.protocol)) return;
      a.target = '_blank'; a.rel = 'noopener';
    }, true);
    // o app que ficou 30 min ou mais em segundo plano volta com a página de agora (preço e estoque mudam a cada 30 min)
    let saiu = 0;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) saiu = Date.now();
      else if (saiu && Date.now() - saiu >= MEIA_HORA && navigator.onLine) location.reload();
    });
  }

  if (!navigator.onLine) faixaSemConexao();
  addEventListener('pageshow', (e) => { if ((e as PageTransitionEvent).persisted && !navigator.onLine) faixaSemConexao(); });
  addEventListener('online', faixaVoltou);

  // o service worker só depois de a página assentar (load + 5 s + o navegador folgando): a instalação baixa o casco e
  // disputava a CPU com o 1º toque na 1ª visita (medido: TBT e INP do 1º toque subiam com o registro logo no load)
  depoisDoLoad(servico, 5000);
  depoisDoLoad(() => { pronto = true; talvezConvidar(); }, 3500);
}

if ((document as Document & { prerendering?: boolean }).prerendering) document.addEventListener('prerenderingchange', iniciar, { once: true });
else iniciar();
