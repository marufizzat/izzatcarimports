// O convite para instalar o app (só desce quando vai aparecer: components/app/app.ts decide pelas regras de lib/app.ts).
// Um cartão fixo embaixo (não empurra nada: sem pulo de layout), discreto, que sai com o "×" e nunca fica por cima da
// barra fixa da peça ou da lista (nessas páginas ele nem aparece). Android/Chrome: "Instalar" abre a janela do Chrome.
// iPhone (sem a janela): a dica de 1 linha, Compartilhar (o ícone azul do Safari) → Adicionar à Tela de Início.
const CSS = `
.app-convite{position:fixed;z-index:45;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom));margin:0 auto;max-width:440px;display:grid;
grid-template-columns:44px minmax(0,1fr) auto;align-items:center;gap:12px;padding:12px 6px 12px 12px;border-radius:18px;
background:var(--surface,#fff);
box-shadow:0 2px 6px rgb(16 16 20/.06),0 24px 48px -16px rgb(16 16 20/.28),inset 0 0 0 1px var(--line,#e2e2e7);color:var(--ink,#1d1d1f)}
@media (prefers-reduced-motion:no-preference){.app-convite{animation:app-convite-sobe .4s cubic-bezier(.2,.8,.2,1)}}
@keyframes app-convite-sobe{from{transform:translateY(24px);opacity:0}}
.app-convite img{width:44px;height:44px;border-radius:11px;display:block}
.app-convite .ac-txt{min-width:0;display:grid;gap:2px}
.app-convite .ac-txt b{font-size:15px;font-weight:750;line-height:1.25}
.app-convite .ac-txt span{font-size:13.5px;line-height:1.35;color:var(--ink-2,#5b5b61)}
.app-convite .ac-txt svg{display:inline-block;width:18px;height:18px;vertical-align:-3px;margin:0 1px;color:#007aff}
.app-convite.ios{grid-template-columns:minmax(0,1fr) auto;padding-left:16px}
.app-convite.ios img{display:none}
.app-convite .ac-acoes{display:flex;align-items:center;gap:2px}
.app-convite .ac-instalar{height:40px;padding:0 16px;border:0;border-radius:11px;font:inherit;font-weight:750;font-size:14.5px;
background:var(--accent,#ff6a00);color:#1d1d1f;cursor:pointer;white-space:nowrap}
.app-convite .ac-instalar:active{transform:translateY(1px)}
.app-convite .ac-x{display:grid;place-items:center;width:44px;height:44px;border:0;border-radius:12px;background:none;color:var(--ink-3,#65656b);cursor:pointer}
.app-convite .ac-x:hover{color:var(--ink,#1d1d1f);background:color-mix(in oklab,var(--ink,#1d1d1f),transparent 93%)}
.app-convite .ac-x svg{width:20px;height:20px}
.app-convite.sai{transition:transform .25s ease,opacity .25s ease;transform:translateY(24px);opacity:0}
@media (max-width:359px){.app-convite{grid-template-columns:minmax(0,1fr) auto}.app-convite img{display:none}}
`;
const X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
// o ícone "Compartilhar" do Safari (quadrado com a seta para cima)
const COMPARTILHAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="Compartilhar" role="img"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M7 10H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1"/></svg>';

export function mostrarConvite(o: { ios: boolean; instalar: () => Promise<boolean>; dispensar: () => void }) {
  if (document.querySelector('.app-convite')) return;
  if (!document.getElementById('app-convite-css')) {
    const s = document.createElement('style'); s.id = 'app-convite-css'; s.textContent = CSS; document.head.appendChild(s);
  }
  const c = document.createElement('div');
  c.className = o.ios ? 'app-convite ios' : 'app-convite';
  c.setAttribute('role', 'dialog');
  c.setAttribute('aria-label', 'Instalar o app da Izzat Car');
  c.innerHTML = `<img src="/icone-192.png" alt="" width="44" height="44">`
    + `<div class="ac-txt"><b>Instale o app da Izzat Car</b>`
    + (o.ios ? `<span>Toque em ${COMPARTILHAR} → <b style="font-size:inherit;font-weight:700">Adicionar à Tela de Início</b></span>`
      : `<span>Abre na hora e guarda a sua lista.</span>`)
    + `</div><div class="ac-acoes">${o.ios ? '' : '<button type="button" class="ac-instalar">Instalar</button>'}`
    + `<button type="button" class="ac-x" aria-label="Agora não">${X}</button></div>`;
  const sair = () => { c.classList.add('sai'); setTimeout(() => c.remove(), 260); };
  c.querySelector('.ac-x')!.addEventListener('click', () => { o.dispensar(); sair(); });
  c.querySelector('.ac-instalar')?.addEventListener('click', async () => {
    sair();
    try { await o.instalar(); } catch { /* o Chrome recusou abrir a janela: fica para outra vez */ }
  });
  document.body.appendChild(c);
}
