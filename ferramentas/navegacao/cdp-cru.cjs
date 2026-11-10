// Chromium sem o Playwright no meio (com ele o Chrome desliga o prerender: "PrerenderingDisabledByDevTools", cliente sem
// suporte a alvo de aba). O binário do Playwright, opções de fábrica, CDP direto por WebSocket, preso na ABA (como o
// Puppeteer): o prerender acontece e a página ativada vira a sessão atual da aba.
const { spawn } = require('child_process');
const fs = require('fs'); const path = require('path'); const os = require('os');
// o Chromium headless do Playwright (ou CHROME_BIN): ~/Library/Caches/ms-playwright/chromium_headless_shell-*/...
const BIN = process.env.CHROME_BIN || (() => { const base = path.join(os.homedir(), 'Library/Caches/ms-playwright'); const d = fs.readdirSync(base).filter((x) => x.startsWith('chromium_headless_shell-')).sort().pop(); return path.join(base, d, 'chrome-headless-shell-mac-arm64/chrome-headless-shell'); })();
const dorme = (ms) => new Promise((r) => setTimeout(r, ms));
async function abrir({ largura = 390, altura = 844, escala = 2, args = [], init = '', cpu = 1 } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'izzat-chr-'));
  const porta = 9300 + Math.floor(Math.random() * 600);
  const pr = spawn(BIN, ['--headless', `--remote-debugging-port=${porta}`, `--user-data-dir=${dir}`, '--no-first-run', '--no-default-browser-check',
    `--window-size=${largura},${altura}`, `--force-device-scale-factor=${escala}`, '--hide-scrollbars', ...args, 'about:blank'], { stdio: ['ignore', 'ignore', 'ignore'] });
  let ws = null;
  for (let i = 0; i < 60 && !ws; i++) { await dorme(200); try { ws = (await (await fetch(`http://127.0.0.1:${porta}/json/version`)).json()).webSocketDebuggerUrl; } catch (e) {} }
  const sock = new WebSocket(ws); await new Promise((r) => sock.addEventListener('open', r));
  let id = 0; const esperando = new Map(); const ouvintes = [];
  sock.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && esperando.has(d.id)) { const [ok, ko] = esperando.get(d.id); esperando.delete(d.id); d.error ? ko(new Error(d.error.message)) : ok(d.result); } else for (const f of ouvintes) f(d); });
  // toda chamada tem prazo (sessão que some no meio, como a da página trocada pelo prerender, nunca responde)
  const send = (method, params = {}, sessionId) => new Promise((ok, ko) => { const i = ++id; esperando.set(i, [ok, ko]); sock.send(JSON.stringify({ id: i, method, params, sessionId }));
    setTimeout(() => { if (esperando.has(i)) { esperando.delete(i); ko(new Error('prazo ' + method)); } }, 8000); });
  // alvos: páginas presas (sessão), com o tipo (prerender ou não)
  const paginas = new Map(); // sessionId -> { targetId, subtype, url, tab }
  const on = (f) => ouvintes.push(f);
  on(async (d) => {
    if (d.method === 'Target.attachedToTarget') {
      const ti = d.params.targetInfo;
      if (ti.type === 'tab') await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }, d.params.sessionId).catch(() => {});
      else if (ti.type === 'page') {
        const sid = d.params.sessionId;
        paginas.set(sid, { targetId: ti.targetId, subtype: ti.subtype || '', url: ti.url, tab: d.sessionId });
        // em ordem e sem esperar a resposta (o CDP aplica na ordem; esperar segurava a ativação do prerender)
        if (init) send('Page.addScriptToEvaluateOnNewDocument', { source: init }, sid).catch(() => {});
        if (cpu > 1) send('Emulation.setCPUThrottlingRate', { rate: cpu }, sid).catch(() => {});
        send('Runtime.runIfWaitingForDebugger', {}, sid).catch(() => {});
        send('Runtime.enable', {}, sid).catch(() => {}); send('Page.enable', {}, sid).catch(() => {}); send('Preload.enable', {}, sid).catch(() => {});
      }
    } else if (d.method === 'Target.detachedFromTarget') paginas.delete(d.params.sessionId);
    else if (d.method === 'Target.targetInfoChanged') { for (const [, p] of paginas) if (p.targetId === d.params.targetInfo.targetId) { p.subtype = d.params.targetInfo.subtype || ''; p.url = d.params.targetInfo.url; } }
  });
  await send('Target.setDiscoverTargets', { discover: true });
  await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: true, filter: [{ type: 'page', exclude: true }, {}] });
  const fechar = async () => { try { await send('Browser.close'); } catch (e) {} pr.kill(); await dorme(300); fs.rmSync(dir, { recursive: true, force: true }); };
  const atual = () => [...paginas.entries()].filter(([, p]) => p.subtype !== 'prerender').map(([s, p]) => ({ s, ...p })).pop();
  const ev = async (expr, sid) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sid || atual().s); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description)); return r.result.value; };
  const espera = async (cond, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (atual() && await ev(cond)) return true; } catch (e) {} await dorme(60); } return false; };
  const ir = async (url) => { const a = atual(); await send('Page.navigate', { url }, a.s); await espera(`document.readyState === 'complete' && location.href === ${JSON.stringify(url)}`); };
  const input = (m, p) => send(m, p, atual().s);
  const caixa = (sel, n = 0) => ev(`(() => { const e = document.querySelectorAll(${JSON.stringify(sel)})[${n}]; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + Math.min(r.height / 2, 90), href: e.getAttribute('href') }; })()`);
  // "toque": aperta (pointerdown, o prerender moderate começa), segura e solta (o clique)
  const toque = async (x, y, seguraMs = 120) => { await input('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await input('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); await dorme(seguraMs); await input('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }); };
  const mouse = async (x, y, paradoMs = 300) => { await input('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await dorme(paradoMs); await input('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); await input('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }); };
  // espera a 1a página da aba
  for (let i = 0; i < 50 && !atual(); i++) await dorme(100);
  return { send, on, fechar, atual, ev, espera, ir, input, caixa, toque, mouse, paginas, dorme };
}
module.exports = { abrir, dorme };
