// Catalogo (ilha React): busca instantanea + filtros + grade de cartões (vitrine).
// Estado na URL com os MESMOS parametros do site antigo:
//   q, marca, modelo, ano, tipo, preco, frete, ordem
// O cartão (Etiqueta) é o MESMO desenho de CartaoPeca.astro; as regras ficam em ./etiqueta.ts.
import { useEffect, useMemo, useRef, useState, useDeferredValue, type ReactNode } from 'react';
import { Busca, FAIXAS, capaItem, foto, type Filtros, type Indice, type Item } from '../../lib/busca';
import Gaveta from '../ui/Gaveta';
import MeuCarroFiltro, { useMeuCarro } from '../ui/MeuCarroFiltro';
import { serveNoMeuCarro } from '../../lib/meuCarro';
import {
  linhaCarro, codigoPeca, precoPartes, msgWhats, linkWhats, urlPeca, idsMaisNovos, dadosCarro,
  CLASSE_CARTAO, VITRINE_CLARA, ICONE_WHATS, ICONE_GARANTIA,
} from './etiqueta';

/** Logo da marca (calculado no build por logoInfo em catalogo.astro). */
export type Logo = { src: string; w: number; h: number };

const LOTE = 48;
const ORDENS: [NonNullable<Filtros['ordem']>, string][] = [
  ['rel', 'Mais relevantes'], ['novos', 'Chegaram agora'], ['asc', 'Menor preço'], ['desc', 'Maior preço'],
];
const n2 = (v: number) => v.toLocaleString('pt-BR');

function lerUrl(): Filtros {
  const u = new URLSearchParams(location.search);
  const ano = Number(u.get('ano')) || undefined;
  const o = u.get('ordem'); const ordem = (['asc', 'desc', 'novos'].includes(o || '') ? o : undefined) as Filtros['ordem'];
  return {
    q: u.get('q') || '', marca: u.get('marca') || undefined, modelo: u.get('modelo') || undefined,
    ano, tipo: u.get('tipo') || undefined, preco: u.get('preco') || undefined,
    frete: u.get('frete') === '1' || u.get('frete') === 'true', ordem,
  };
}
function escreverUrl(f: Filtros) {
  const u = new URLSearchParams();
  if (f.q) u.set('q', f.q);
  if (f.marca) u.set('marca', f.marca);
  if (f.modelo) u.set('modelo', f.modelo);
  if (f.ano) u.set('ano', String(f.ano));
  if (f.tipo) u.set('tipo', f.tipo);
  if (f.preco) u.set('preco', f.preco);
  if (f.frete) u.set('frete', '1');
  if (f.ordem && f.ordem !== 'rel') u.set('ordem', f.ordem);
  const qs = u.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

const Whats = () => <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d={ICONE_WHATS} /></svg>;
const Seta = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
);
const Xis = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M7 7l10 10M17 7 7 17" /></svg>
);

/** Cartão da peça (vitrine) — mesmo markup de CartaoPeca.astro. */
export function Etiqueta({ it, eager, novo, meuModelo }: { it: Item; eager?: boolean; novo?: boolean; meuModelo?: string | null }) {
  const { carro, anos } = linhaCarro(it.b, it.m, it.y);
  const [reais, cent] = precoPartes(it.p);
  const cod = codigoPeca(it.o);
  const estudio = it.e !== '0';
  return (
    <div className={CLASSE_CARTAO}>
      <a className="etiqueta" href={`/peca/${it.h}.html`} {...dadosCarro(it.b, it.m, it.y)}>
        <div className="etiqueta-foto">
          <img src={capaItem(it)} srcSet={estudio ? undefined : `${foto(it.i, 'V')} 320w, ${foto(it.i, 'C')} 400w, ${foto(it.i, 'O')} 500w`}
               sizes={estudio ? undefined : '(min-width:1280px) 240px, (min-width:768px) 28vw, 46vw'}
               className={estudio ? 'estudio' : undefined} alt={it.t} width={800} height={800}
               loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : undefined} decoding="async" />
          {novo && <span className="etiqueta-novo">Chegou agora</span>}
        </div>
        <div className="etiqueta-dados">
          <span className="etiqueta-serve" hidden={!meuModelo}>{meuModelo ? `Serve no seu ${meuModelo}` : ''}</span>
          {carro && <span className="etiqueta-carro"><span className="etiqueta-modelo">{carro}</span>{anos && <span className="etiqueta-anos"><span className="etiqueta-sep"> · </span>{anos}</span>}</span>}
          <span className="etiqueta-nome">{it.n}</span>
          {cod && <span className="etiqueta-cod" title="Código gravado na peça">Cód. <span className="oem">{cod}</span></span>}
          <span className="etiqueta-preco num"><small>R$</small>{reais}<small><span className="sr-only">,</span>{cent}</small></span>
          <span className="etiqueta-confia">
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={ICONE_GARANTIA} /></svg>
            <span><span className="etiqueta-confia-longo">Original · </span>90 dias de garantia</span>
          </span>
        </div>
      </a>
      <a className="etiqueta-acao" href={linkWhats(msgWhats(it.t, it.p, urlPeca(it.h)))} target="_blank" rel="noopener"
         aria-label={`Pedir no WhatsApp: ${it.n}`}><Whats />Pedir no WhatsApp</a>
    </div>
  );
}

/** Grupo de filtro que abre e fecha; fechado, mostra o que está escolhido. */
function Grupo({ titulo, escolhido, children }: { titulo: string; escolhido?: string; children: ReactNode }) {
  const [aberto, setAberto] = useState(true);
  return (
    <details className="cat-grupo" open={aberto} onToggle={(e) => setAberto((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>
        <span className="cat-grupo-titulo">{titulo}</span>
        {escolhido && !aberto && <span className="cat-grupo-escolhido">{escolhido}</span>}
        <Seta className="cat-grupo-seta" />
      </summary>
      <div className="cat-grupo-corpo">{children}</div>
    </details>
  );
}

type Opcao = { v: string; rot: string; c: number };
function Opcoes({ itens, ativo, aoEscolher, limite = 8, logos, mais }: {
  itens: Opcao[]; ativo?: string; aoEscolher: (v?: string) => void; limite?: number; logos?: Record<string, Logo>; mais?: string;
}) {
  const [todas, setTodas] = useState(false);
  if (!itens.length) return <p className="cat-nada">Nenhuma opção com a busca de agora.</p>;
  let vis = todas ? itens : itens.slice(0, limite);
  // o escolhido aparece mesmo quando está fora das primeiras
  if (!todas && ativo && !vis.some((o) => o.v === ativo)) { const a = itens.find((o) => o.v === ativo); if (a) vis = [...vis, a]; }
  return (
    <>
      <ul className={logos ? 'cat-opcoes com-logo' : 'cat-opcoes'}>
        {vis.map((o) => {
          const on = ativo === o.v;
          const l = logos?.[o.v];
          return (
            <li key={o.v}>
              <button type="button" className="cat-opcao" aria-pressed={on} onClick={() => aoEscolher(on ? undefined : o.v)}>
                {logos
                  ? <span className="cat-logo" aria-hidden="true">{l ? <img src={l.src} alt="" width={l.w} height={l.h} loading="lazy" decoding="async" /> : <b>{o.rot.slice(0, 1)}</b>}</span>
                  : <span className="cat-marca" aria-hidden="true" />}
                <span className="cat-opcao-nome">{o.rot}</span>
                <span className="cat-opcao-qtd num">{n2(o.c)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {itens.length > limite && mais && (
        <button type="button" className="cat-mais" aria-expanded={todas} onClick={() => setTodas(!todas)}>
          {todas ? 'Mostrar menos' : `${mais} (${itens.length})`}<Seta />
        </button>
      )}
    </>
  );
}

type Props = {
  total: number;
  /** logos das marcas por nome ("Volvo" -> /marcas/volvo.png), feitos no build */
  logos?: Record<string, Logo>;
  /** slot "selo" do Astro: selo de reputação do ML (equipe robô), no topo dos resultados */
  selo?: ReactNode;
};

export default function Catalogo({ total: totalInicial, logos = {}, selo }: Props) {
  const [busca, setBusca] = useState<Busca | null>(null);
  const [erro, setErro] = useState(false);
  const [f, setF] = useState<Filtros>({});
  const [texto, setTexto] = useState('');
  const [qtd, setQtd] = useState(LOTE);
  const [gaveta, setGaveta] = useState(false);
  const banda = useRef<HTMLDivElement>(null);
  const marcoBanda = useRef<HTMLDivElement>(null);
  const [presa, setPresa] = useState(false);
  const resultadosRef = useRef<HTMLElement>(null);
  const fimRef = useRef<HTMLDivElement>(null);
  const meuCarro = useMeuCarro();
  const autos = useRef(0); // lotes que entraram sozinhos ao rolar (no máximo 2; depois, botão)
  const ultimoRastreio = useRef('');

  useEffect(() => {
    const ini = lerUrl();
    setF(ini); setTexto(ini.q || '');
    fetch('/dados/busca.json').then((r) => r.json()).then((ix: Indice) => setBusca(new Busca(ix))).catch(() => setErro(true));
  }, []);

  // texto digitado entra no filtro com um pequeno atraso (e a lista volta ao começo se estava lá embaixo)
  useEffect(() => {
    const t = setTimeout(() => {
      if ((f.q || '') === texto) return;
      setF((o) => ({ ...o, q: texto }));
      voltaAoTopo('auto');
    }, 160);
    return () => clearTimeout(t);
  }, [texto]);

  const fDiferido = useDeferredValue(f);
  const [resultado, aproximado] = useMemo(() => {
    if (!busca) return [[] as Item[], false] as const;
    const r = busca.procurar(fDiferido);
    return [r, busca.aproximado] as const;
  }, [busca, fDiferido]);
  const facetas = useMemo(() => (busca ? busca.facetas(fDiferido) : null), [busca, fDiferido]);
  // "Chegou agora": as mais novas do estoque inteiro (ids do ML crescem com o anúncio), uma vez por carga
  const novos = useMemo(() => (busca ? idsMaisNovos(busca.itens.map((i) => i.id)) : new Set<string>()), [busca]);

  useEffect(() => { if (busca) escreverUrl(f); setQtd(LOTE); autos.current = 0; }, [f, busca]);
  useEffect(() => {
    const q = (f.q || '').trim();
    if (busca && q.length >= 3 && q !== ultimoRastreio.current) {
      const t = setTimeout(() => { ultimoRastreio.current = q; (window as any).izzatBusca?.(q); }, 1200);
      return () => clearTimeout(t);
    }
  }, [f.q, busca]);

  // carrega mais sozinho perto do fim da lista, só 2 vezes: depois vem o botão (o rodapé fica alcançável)
  useEffect(() => {
    const el = fimRef.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && autos.current < 2) { autos.current += 1; setQtd((n) => n + LOTE); }
    }, { rootMargin: '900px' });
    io.observe(el);
    return () => io.disconnect();
  }, [resultado.length]);

  // a banda da busca ganha linha e sombra só quando está grudada no topo (celular)
  useEffect(() => {
    const el = marcoBanda.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const cab = (document.querySelector('.cab') ?? document.querySelector('header'))?.getBoundingClientRect().height ?? 70;
    const io = new IntersectionObserver(([e]) => setPresa(!e.isIntersecting), { rootMargin: `-${Math.round(cab) + 1}px 0px 0px 0px` });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const muda = (parcial: Partial<Filtros>) => setF((o) => ({ ...o, ...parcial }));
  // filtro ou ordem mudou com a lista lá embaixo: volta para o topo dos resultados (como nas lojas grandes)
  const voltaAoTopo = (jeito?: ScrollBehavior) => requestAnimationFrame(() => {
    const el = resultadosRef.current; if (!el) return;
    const cab = (document.querySelector('.cab') ?? document.querySelector('header'))?.getBoundingClientRect().height ?? 70;
    const fixo = banda.current && getComputedStyle(banda.current).position === 'sticky' ? banda.current.offsetHeight : 0;
    const folga = cab + fixo + 12;
    const topo = el.getBoundingClientRect().top;
    if (topo < folga) window.scrollTo({ top: window.scrollY + topo - folga, behavior: jeito ?? (gaveta ? 'auto' : 'smooth') });
  });
  const mudaFiltro = (parcial: Partial<Filtros>) => { muda(parcial); voltaAoTopo(); };

  const ativos: { k: string; rot: string; logo?: Logo; tirar: () => void }[] = [];
  if (f.q) ativos.push({ k: 'q', rot: `“${f.q}”`, tirar: () => { setTexto(''); muda({ q: '' }); } });
  if (f.marca) ativos.push({ k: 'marca', rot: f.marca, logo: logos[f.marca], tirar: () => mudaFiltro({ marca: undefined, modelo: undefined }) });
  if (f.modelo) ativos.push({ k: 'modelo', rot: f.modelo, tirar: () => mudaFiltro({ modelo: undefined }) });
  if (f.ano) ativos.push({ k: 'ano', rot: `Ano ${f.ano}`, tirar: () => mudaFiltro({ ano: undefined }) });
  if (f.tipo) ativos.push({ k: 'tipo', rot: f.tipo, tirar: () => mudaFiltro({ tipo: undefined }) });
  if (f.preco) ativos.push({ k: 'preco', rot: FAIXAS.find((x) => x[0] === f.preco)?.[1] || f.preco, tirar: () => mudaFiltro({ preco: undefined }) });
  // o parâmetro antigo "frete" continua valendo nos links; o rótulo é neutro
  if (f.frete) ativos.push({ k: 'frete', rot: 'Filtro de frete do ML', tirar: () => mudaFiltro({ frete: false }) });
  const nFiltros = ativos.filter((a) => a.k !== 'q').length;
  const limpar = () => { setTexto(''); setF({ ordem: f.ordem }); voltaAoTopo(); };
  const limparFiltros = () => { setF({ q: f.q, ordem: f.ordem }); };

  const anos = useMemo(() => { const a = new Date().getFullYear() + 1; return Array.from({ length: a - 1979 }, (_, i) => a - i); }, []);
  const precoRot = FAIXAS.find((x) => x[0] === f.preco)?.[1];
  const filtros = facetas && (
    <div className="cat-filtros">
      <Grupo titulo="Marca do carro" escolhido={f.marca}>
        <Opcoes itens={facetas.marcas.map(([v, c]) => ({ v, rot: v, c }))} ativo={f.marca} logos={logos} mais="Ver todas as marcas"
                aoEscolher={(v) => mudaFiltro({ marca: v, modelo: undefined })} />
      </Grupo>
      {f.marca && (
        <Grupo titulo={`Modelo ${f.marca}`} escolhido={f.modelo}>
          <Opcoes itens={facetas.modelos.map(([v, c]) => ({ v, rot: v, c }))} ativo={f.modelo} limite={10} mais="Ver todos os modelos"
                  aoEscolher={(v) => mudaFiltro({ modelo: v })} />
        </Grupo>
      )}
      <Grupo titulo="Ano do carro" escolhido={f.ano ? String(f.ano) : undefined}>
        <label className="seletor cat-ano"><span>Ano</span>
          <select value={f.ano || ''} onChange={(e) => mudaFiltro({ ano: Number(e.target.value) || undefined })}>
            <option value="">Qualquer ano</option>
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
      </Grupo>
      <Grupo titulo="Tipo de peça" escolhido={f.tipo}>
        <Opcoes itens={facetas.tipos.map(([v, c]) => ({ v, rot: v, c }))} ativo={f.tipo} limite={8} mais="Ver todos os tipos"
                aoEscolher={(v) => mudaFiltro({ tipo: v })} />
      </Grupo>
      <Grupo titulo="Preço" escolhido={precoRot}>
        <Opcoes itens={facetas.precos.filter(([, , c]) => c > 0).map(([v, rot, c]) => ({ v, rot, c }))} ativo={f.preco} limite={6}
                aoEscolher={(v) => mudaFiltro({ preco: v })} />
      </Grupo>
    </div>
  );

  const carregando = !busca && !erro;
  const total = busca ? resultado.length : totalInicial;
  const lista = resultado.slice(0, qtd);
  const procuro = [f.q, f.marca, f.modelo, f.ano].filter(Boolean).join(' ');
  const pecas = (n: number) => (n === 1 ? 'peça' : 'peças');

  return (
    <div className="cat">
      <div ref={marcoBanda} aria-hidden="true" />
      <div className={presa ? 'cat-banda presa' : 'cat-banda'} ref={banda}>
        <form className="busca cat-busca" role="search" onSubmit={(e) => { e.preventDefault(); muda({ q: texto }); (document.activeElement as HTMLElement)?.blur(); voltaAoTopo(); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input id="busca" type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Peça, carro ou código"
                 aria-label="Buscar no catálogo" autoComplete="off" enterKeyHint="search" />
          {texto && <button type="button" className="cat-limpar-texto" aria-label="Apagar busca" onClick={() => { setTexto(''); muda({ q: '' }); }}><Xis /></button>}
          <button className="botao botao-laranja cat-buscar" type="submit">Buscar</button>
        </form>
        <button type="button" className="cat-abrir-filtros" aria-haspopup="dialog" onClick={() => setGaveta(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>
          Filtros{nFiltros > 0 && <span className="cat-contador num" aria-label={`${nFiltros} ativos`}>{nFiltros}</span>}
        </button>
      </div>

      <div className="cat-corpo">
        <aside className="cat-lateral" aria-label="Filtros">
          {filtros || <div className="cat-filtros cat-filtros-carregando" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} />)}</div>}
        </aside>

        <section className="cat-resultados" ref={resultadosRef} aria-busy={carregando} aria-labelledby="cat-total">
          <div className="cat-barra">
            <p className="cat-total" id="cat-total" aria-live="polite">
              <b className="num">{n2(total)}</b> {pecas(total)}{f.q ? <span className="cat-total-q"> para “{f.q}”</span> : null}
            </p>
            <div data-selo-reputacao>{selo}</div>
            <label className="cat-ordem">
              <span>Ordenar por</span>
              <select value={f.ordem || 'rel'} onChange={(e) => mudaFiltro({ ordem: e.target.value as Filtros['ordem'] })}>
                {ORDENS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
              <Seta />
            </label>
          </div>

          {ativos.length > 0 && (
            <div className="cat-ativos" role="group" aria-label="Filtros escolhidos">
              {ativos.map((a) => (
                <button type="button" key={a.k} className="cat-ficha" onClick={a.tirar} aria-label={`Tirar filtro ${a.rot}`}>
                  {a.logo && <span className="cat-ficha-logo" aria-hidden="true"><img src={a.logo.src} alt="" width={a.logo.w} height={a.logo.h} /></span>}
                  <span>{a.rot}</span><Xis />
                </button>
              ))}
              <button type="button" className="cat-limpar" onClick={limpar}>Limpar tudo</button>
            </div>
          )}

          <MeuCarroFiltro marca={f.marca} modelo={f.modelo} ano={f.ano} aoAplicar={(x) => muda(x)} />

          {carregando && (
            <div className="cat-grade" aria-hidden="true">
              {Array.from({ length: 8 }, (_, i) => <div key={i} className={VITRINE_CLARA ? 'cat-esqueleto tema-estudio' : 'cat-esqueleto'}><i /><b /><b /><b /><b /></div>)}
            </div>
          )}
          {erro && <p className="cat-erro">Não deu para carregar o catálogo agora. Recarregue a página ou fale com a gente no WhatsApp.</p>}

          {busca && resultado.length === 0 && (
            <div className="cat-vazio">
              <img src="/arte/v2/vazio-busca.webp" alt="" width={360} height={360} loading="lazy" decoding="async" />
              <div>
                <h2>Nada {f.q ? <>com “{f.q}”</> : 'com esses filtros'} no site.</h2>
                <p>Nem toda peça está anunciada. Mande o carro e a peça no WhatsApp que a gente procura no pátio.</p>
                <div className="cat-vazio-botoes">
                  <a className="botao botao-laranja" href={linkWhats(`Olá! Procuro: ${procuro || 'uma peça'}. Tem no pátio?`)}><Whats />Procurar no pátio pelo WhatsApp</a>
                  {ativos.length > 0 && <button type="button" className="botao botao-linha" onClick={limpar}>Limpar filtros</button>}
                </div>
              </div>
            </div>
          )}

          {busca && resultado.length > 0 && aproximado && (
            <div className="cat-aviso">
              <img src="/icones/conversa-96.webp" alt="" width={44} height={44} />
              <div>
                <b>Não achamos “{f.q}” anunciado.</b>
                <span>Nem toda peça está no site. Mande no WhatsApp que a gente procura no pátio. Abaixo, as peças mais próximas.</span>
              </div>
              <a className="botao botao-laranja" href={linkWhats(`Olá! Procuro: ${procuro}. Não achei no site, tem no pátio?`)}>Procurar no pátio</a>
            </div>
          )}
          {busca && resultado.length > 0 && (
            <>
              <div className="cat-grade">{lista.map((it, i) => <Etiqueta key={it.id} it={it} eager={i < 4} novo={novos.has(it.id)} meuModelo={meuCarro && serveNoMeuCarro(it, meuCarro) === 'sim' ? meuCarro.m : null} />)}</div>
              <div ref={fimRef} />
              {qtd < resultado.length && (
                <div className="cat-mais-pecas">
                  <p className="num">Mostrando {n2(lista.length)} de {n2(resultado.length)} {pecas(resultado.length)}</p>
                  <span className="cat-progresso" aria-hidden="true"><i style={{ width: `${Math.max(4, (lista.length / resultado.length) * 100)}%` }} /></span>
                  <button type="button" className="botao botao-linha" onClick={() => setQtd(qtd + LOTE)}>
                    Ver mais {Math.min(LOTE, resultado.length - qtd)} peças
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <Gaveta aberta={gaveta} aoFechar={() => setGaveta(false)} titulo="Filtros"
        rodape={
          <div className="cat-gaveta-rodape">
            <button type="button" className="botao botao-linha" onClick={limparFiltros} disabled={!nFiltros}>Limpar</button>
            <button type="button" className="botao botao-laranja" onClick={() => setGaveta(false)}>Ver {n2(total)} {pecas(total)}</button>
          </div>
        }>
        {filtros}
      </Gaveta>
    </div>
  );
}
