// O app instalável no navegador (toda página, pelo Base.astro; módulo com cache). Nada aqui atrasa a 1ª pintura:
//  1) depois do load: o botão de pânico (/sw-desligar.txt com "1" desliga e apaga tudo) e o registro do service worker
//     (public/sw.js). A página que não passou por ele (1ª visita, preparada pelo prerender) pede a própria cópia;
//  2) a faixa "sem conexão" (a cópia guardada já vem com ela, posta pelo SW; aqui só o "a conexão voltou");
// Página preparada pelo prerender: nada roda até a pessoa abrir.
import { ARQUIVO_DESLIGAR, pedeDesligar } from '../../lib/app';

const raiz = document.documentElement;
const semConexaoPagina = () => !!document.querySelector('[data-pagina-offline]');

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

function iniciar() {
  if (!navigator.onLine) faixaSemConexao();
  addEventListener('pageshow', (e) => { if ((e as PageTransitionEvent).persisted && !navigator.onLine) faixaSemConexao(); });
  addEventListener('online', faixaVoltou);

  depoisDoLoad(servico);
}

if ((document as Document & { prerendering?: boolean }).prerendering) document.addEventListener('prerenderingchange', iniciar, { once: true });
else iniciar();
