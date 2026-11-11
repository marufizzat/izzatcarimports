// Abertura da home, de ponta a ponta (CLAUDE.md, item 13): seletor (marca -> modelo -> ano -> "Ver as N peças"), título vivo,
// atalhos do carro com o número do catálogo, busca, selo do WhatsApp e a faixa "Continuar", em Chromium (PC e celular) e WebKit.
// uso (com o preview no ar): node scripts/abertura-fluxo.cjs http://localhost:4321/
const pw = require('/Users/izzat/wa-export/node_modules/playwright');
// o Chromium do Playwright para de pintar depois de uma troca de página com transição: religar o PaintHolding (CLAUDE.md)
const real = require('../../ferramentas/navegacao/chromium-real.cjs');
const base = process.argv[2];
const casos = [['chromium', 1440, 900, false], ['chromium', 360, 640, true], ['webkit', 390, 844, true]];
let falhas = 0;
const ok = (c, msg, extra = '') => { if (!c) falhas++; console.log((c ? '  ok  ' : '  FALHOU ') + msg + (c ? '' : ' ' + extra)); };
(async () => {
  for (const [motor, w, h, movel] of casos) {
    console.log(`== ${motor} ${w}x${h}`);
    const b = await pw[motor].launch(motor === 'chromium' ? real() : {});
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: movel, isMobile: movel && motor === 'chromium', deviceScaleFactor: movel ? 2 : 1 });
    let p = await ctx.newPage(); const erros = [];
    p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); }); p.on('pageerror', (e) => erros.push(e.message));
    const palavra = () => p.locator('[data-ab-palavra]').innerText();
    const estado = () => p.locator('[data-ab-palco]').getAttribute('data-ab');
    const toque = async (sel) => { const e = p.locator(sel).first(); await e.scrollIntoViewIfNeeded(); await e.click(); };
    await p.goto(base, { waitUntil: 'load' }); await p.waitForTimeout(1500);
    ok((await p.locator('#abv2-titulo').innerText()).replace(/\s+/g, ' ').trim() === 'De qual peça o seu carro precisa?', 'h1 de quem chega: "De qual peça o seu carro precisa?"', await p.locator('#abv2-titulo').innerText());
    ok(await p.locator('.ab-selo-cdv').isVisible() && await p.locator('[data-ab-whats]').isVisible(), 'os dois selos à vista');
    const y1 = await p.evaluate(() => { const r = document.querySelector('[data-hero] .mc-marca').getBoundingClientRect(); return r.bottom; });
    ok(y1 <= h, `a 1ª fileira de marcas cabe na 1ª tela (fim em ${Math.round(y1)} de ${h})`);
    await toque('[data-hero] [data-acao="marca"][data-n="Chevrolet"]'); await p.waitForTimeout(500);
    ok(await palavra() === 'Chevrolet', 'marca -> o título diz "Chevrolet"', await palavra());
    ok(await estado() === 'marca', 'palco no estado "marca"');
    await toque('[data-hero] [data-acao="modelo"][data-n="Onix"]'); await p.waitForTimeout(400);
    ok(await palavra() === 'Onix', 'modelo -> o título diz "Onix"', await palavra());
    ok(await estado() === 'carro', 'palco no estado "carro"');
    await p.locator('[data-ab-palco]').scrollIntoViewIfNeeded(); await p.waitForTimeout(2200);
    const at = await p.evaluate(() => [...document.querySelectorAll('.ab-p[data-slot]')].map((li) => { const a = li.querySelector('a'); const ra = a.getBoundingClientRect(), rr = a.querySelector('.ab-rot').getBoundingClientRect(); const r = { width: Math.max(ra.right, rr.right) - Math.min(ra.left, rr.left), height: Math.max(ra.bottom, rr.bottom) - Math.min(ra.top, rr.top) }; return { k: li.dataset.k, href: a.getAttribute('href'), n: li.querySelector('[data-ab-n]').textContent, rot: li.querySelector('[data-ab-nome]').textContent, w: Math.round(r.width), h: Math.round(r.height), vis: getComputedStyle(li).opacity === '1', carregou: li.querySelector('img.ab-img').naturalWidth > 0 }; }));
    ok(at.length >= 3 && at.every((a) => a.vis && a.carregou), `${at.length} atalhos do Onix à vista, com imagem`, JSON.stringify(at));
    ok(at.every((a) => /tipo=/.test(a.href) && /marca=Chevrolet/.test(a.href) && /modelo=Onix/.test(a.href) && Number(a.n) > 0), 'cada atalho leva ao catálogo com tipo + marca + modelo e tem número', JSON.stringify(at.map((a) => a.href)));
    ok(at.every((a) => a.w >= 44 && a.h >= 44), 'todo atalho (peça + rótulo, a área do link) com 44 px ou mais de toque', JSON.stringify(at.map((a) => [a.w, a.h])));
    ok(/Para o seu Onix/i.test(await p.locator('[data-ab-legenda]').innerText()), 'legenda "Para o seu Onix"');
    ok(await p.locator('.ab-auto[data-on]').evaluate((i) => i.naturalWidth > 0 && /carro-chevrolet-onix/.test(i.currentSrc)), 'a arte do Onix entrou no palco');
    await toque('[data-hero] [data-acao="ano"][data-y="2019"]'); await p.waitForTimeout(1500);
    ok(await palavra() === 'Onix 2019', 'ano -> o título diz "Onix 2019"', await palavra());
    const at2 = await p.evaluate(() => [...document.querySelectorAll('.ab-p[data-slot] a')].map((a) => a.getAttribute('href')));
    ok(at2.length > 0 && at2.every((x) => /ano=2019/.test(x)), 'os atalhos levam o ano', JSON.stringify(at2));
    const salvo = await p.evaluate(() => JSON.parse(localStorage.getItem('izzatcar.meuCarro')));
    ok(salvo && salvo.b === 'Chevrolet' && salvo.m === 'Onix' && salvo.y === 2019 && salvo.a === 'chevrolet-onix', 'izzatcar.meuCarro salvo com b, m, y, a', JSON.stringify(salvo));
    const ver = p.locator('[data-hero] [data-mc-ver]'); const txt = await ver.innerText(); const href = await ver.getAttribute('href');
    ok(/^Ver as? \d+ peças?$|^Ver a peça$/.test(txt.trim()) && /marca=Chevrolet&modelo=Onix&ano=2019/.test(href), `botão "${txt.trim()}" com o link do catálogo`, href);
    // o número de um atalho bate com o catálogo
    const um = await p.evaluate(() => { const li = document.querySelector('.ab-p[data-slot="0"]'); return { href: li.querySelector('a').getAttribute('href'), n: Number(li.querySelector('[data-ab-n]').textContent) }; });
    const cat = await ctx.newPage(); await cat.goto(new URL(um.href, base).href, { waitUntil: 'load' }); await cat.waitForTimeout(3500);
    const titulo = await cat.evaluate(() => document.body.innerText.match(/(\d+)\s+peças?\b/)?.[1]);
    const cartoes = await cat.locator('.etiqueta').count();
    ok(Number(titulo) === um.n || cartoes === um.n, `o atalho diz ${um.n} e o catálogo mostra ${titulo ?? cartoes} (${um.href})`); await cat.close();
    // volta: o título já nasce com o carro
    await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(600);
    ok(await palavra() === 'Onix 2019' && await estado() === 'carro', 'quem volta: o título e o palco já nascem com o carro');
    await toque('[data-hero] [data-acao="tirar"]'); await p.waitForTimeout(600);
    ok(await palavra() === 'carro' && await estado() === null, '"Esquecer": volta para "carro" e para a cena de abertura', await palavra() + ' ' + await estado());
    ok(await p.evaluate(() => localStorage.getItem('izzatcar.meuCarro')) === null, 'o carro saiu do armazenamento');
    // busca
    await p.evaluate(() => window.scrollTo(0, 0)); await toque('#abv2-aba-busca'); await p.waitForTimeout(700);
    const campo = p.locator('#abv2-painel-busca input').first(); await campo.fill('farol'); await p.waitForTimeout(1800);
    const sugest = await p.locator('#abv2-painel-busca [role="option"], #abv2-painel-busca [role="listbox"] a, #abv2-painel-busca .sb-lista a').count();
    ok(sugest > 0, `a busca sugere (${sugest} linhas) ao digitar "farol"`);
    await campo.press('Enter'); await p.waitForURL(/catalogo\.html\?.*q=farol/, { timeout: 8000 }).catch(() => {});
    ok(/catalogo\.html\?.*q=farol/.test(p.url()), 'Enter leva ao catálogo com q=farol', p.url());
    // selo do WhatsApp + Continuar
    await p.evaluate(() => { localStorage.setItem('izzatcar.lista', JSON.stringify([{ id: 'MLB6513442822', slug: 'x-MLB6513442822', nome: 'Farol', carro: 'Chevrolet Onix', anos: '2019', cod: '', preco: 244.64, capa: '' }])); localStorage.setItem('izzatcar.meuCarro', JSON.stringify({ b: 'Volvo', m: 'XC60', y: null })); });
    // página nova: depois de uma navegação com transição entre documentos o Chromium do Playwright para de pintar (CLAUDE.md)
    await p.close(); p = await ctx.newPage(); p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); }); p.on('pageerror', (e) => erros.push(e.message));
    await p.goto(base, { waitUntil: 'load' }); await p.waitForTimeout(900);
    const zap = await p.locator("[data-ab-whats]").evaluate((a) => ({ href: decodeURIComponent(a.href), botao: a.dataset.botao }));
    ok(/wa\.me\/5553991170950/.test(zap.href) && /10% de desconto/.test(zap.href) && /Volvo XC60/.test(zap.href) && zap.botao === 'abertura-desconto', 'selo do WhatsApp: mensagem com o desconto e o carro, data-botao próprio', JSON.stringify(zap));
    ok(await palavra() === 'XC60', 'carro salvo sem ano: "XC60"', await palavra());
    ok(await p.locator('[data-ct]').isVisible() && /Sua lista tem 1 peça/.test(await p.locator('[data-ct]').innerText()), 'faixa "Continuar" com a lista');
    await p.locator('[data-ct-fechar]').click({ timeout: 6000 }).catch(async (e) => { console.log('   (clique normal falhou: ' + e.message.replace(/\s+/g, ' ').slice(0, 700) + ')'); await p.locator('[data-ct-fechar]').click({ force: true }); }); await p.waitForTimeout(300);
    ok(!(await p.locator('[data-ct]').isVisible()), 'o × dispensa a faixa');
    const rolagem = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(rolagem <= 0, 'sem rolagem horizontal', String(rolagem));
    const meus = erros.filter((e) => !/astro-island|Astro background|access control checks|vite|hmr|Transition was skipped/i.test(e)); ok(meus.length === 0, '0 erros de console', meus.join(' | ').slice(0, 300));
    await b.close();
  }
  console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO CERTO');
})();
