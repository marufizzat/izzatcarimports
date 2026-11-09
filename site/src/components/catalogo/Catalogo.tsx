// Catalogo (ilha React): busca instantanea + filtros + grade de etiquetas.
// Estado na URL com os MESMOS parametros do site antigo:
//   q, marca, modelo, ano, tipo, preco, frete, ordem
import { useEffect, useMemo, useRef, useState, useDeferredValue } from 'react';
import { Busca, FAIXAS, foto, type Filtros, type Indice, type Item } from '../../lib/busca';
import Gaveta from '../ui/Gaveta';

const LOTE = 48;
const WHATS = '5553991170950';
const brl = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const whats = (t: string) => `https://wa.me/${WHATS}?text=${encodeURIComponent(t)}`;
const ORDENS: [Filtros['ordem'], string][] = [
  ['rel', 'Mais relevantes'], ['novos', 'Chegaram agora'], ['asc', 'Menor preço'], ['desc', 'Maior preço'],
];

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

function Etiqueta({ it, eager }: { it: Item; eager?: boolean }) {
  const carro = [it.b, it.m].filter(Boolean).join(' ') + (it.y ? `, ${it.y[0]}–${it.y[1]}` : '');
  const [reais, cent] = brl(it.p).split(',');
  const cod = (it.o || '').split(' ')[0];
  return (
    <a className="etiqueta" href={`/peca/${it.h}.html`}>
      <div className="etiqueta-foto">
        <img src={foto(it.i, 'O')} srcSet={`${foto(it.i, 'V')} 320w, ${foto(it.i, 'C')} 400w, ${foto(it.i, 'O')} 500w`}
             sizes="(min-width:1280px) 230px, (min-width:768px) 28vw, 46vw" alt={it.t} width={500} height={500}
             loading={eager ? 'eager' : 'lazy'} decoding="async" />
        <span className="etiqueta-furo" aria-hidden="true" />
      </div>
      <div className="etiqueta-picote" aria-hidden="true" />
      <div className="etiqueta-dados">
        {carro && <span className="etiqueta-carro">{carro}</span>}
        <span className="etiqueta-nome">{it.n}</span>
        <div className="etiqueta-rodape">
          <span className="etiqueta-preco num"><small>R$</small>{reais}<small style={{ margin: '0 0 0 1px' }}>,{cent}</small></span>
          {cod && <span className="etiqueta-cod oem">{cod.toUpperCase()}</span>}
        </div>
      </div>
    </a>
  );
}

type Faceta = [string, number][];
function Lista({ titulo, itens, ativo, aoEscolher, limite = 8 }:
  { titulo: string; itens: Faceta; ativo?: string; aoEscolher: (v?: string) => void; limite?: number }) {
  const [todas, setTodas] = useState(false);
  if (!itens.length) return null;
  const vis = todas ? itens : itens.slice(0, limite);
  return (
    <fieldset className="cat-grupo">
      <legend>{titulo}</legend>
      <ul>
        {vis.map(([n, c]) => (
          <li key={n}>
            <button type="button" className="cat-opcao" aria-pressed={ativo === n} onClick={() => aoEscolher(ativo === n ? undefined : n)}>
              <span>{n}</span><b className="num">{c.toLocaleString('pt-BR')}</b>
            </button>
          </li>
        ))}
      </ul>
      {itens.length > limite && (
        <button type="button" className="cat-mais" onClick={() => setTodas(!todas)}>
          {todas ? 'Mostrar menos' : `Ver todas (${itens.length})`}
        </button>
      )}
    </fieldset>
  );
}

export default function Catalogo({ total: totalInicial }: { total: number }) {
  const [busca, setBusca] = useState<Busca | null>(null);
  const [erro, setErro] = useState(false);
  const [f, setF] = useState<Filtros>({});
  const [texto, setTexto] = useState('');
  const [qtd, setQtd] = useState(LOTE);
  const [gaveta, setGaveta] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);
  const ultimoRastreio = useRef('');

  useEffect(() => {
    const ini = lerUrl();
    setF(ini); setTexto(ini.q || '');
    fetch('/dados/busca.json').then((r) => r.json()).then((ix: Indice) => setBusca(new Busca(ix))).catch(() => setErro(true));
  }, []);

  // texto digitado entra no filtro com um pequeno atraso
  useEffect(() => {
    const t = setTimeout(() => setF((o) => (o.q === texto ? o : { ...o, q: texto })), 160);
    return () => clearTimeout(t);
  }, [texto]);

  const fDiferido = useDeferredValue(f);
  const [resultado, aproximado] = useMemo(() => {
    if (!busca) return [[] as Item[], false] as const;
    const r = busca.procurar(fDiferido);
    return [r, busca.aproximado] as const;
  }, [busca, fDiferido]);
  const facetas = useMemo(() => (busca ? busca.facetas(fDiferido) : null), [busca, fDiferido]);

  useEffect(() => { if (busca) escreverUrl(f); setQtd(LOTE); }, [f, busca]);
  useEffect(() => {
    const q = (f.q || '').trim();
    if (busca && q.length >= 3 && q !== ultimoRastreio.current) {
      const t = setTimeout(() => { ultimoRastreio.current = q; (window as any).izzatBusca?.(q); }, 1200);
      return () => clearTimeout(t);
    }
  }, [f.q, busca]);

  // carrega mais sozinho perto do fim da lista
  useEffect(() => {
    const el = fimRef.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setQtd((n) => n + LOTE); }, { rootMargin: '900px' });
    io.observe(el);
    return () => io.disconnect();
  }, [resultado.length]);

  const muda = (parcial: Partial<Filtros>) => setF((o) => ({ ...o, ...parcial }));
  const ativos: [string, () => void][] = [];
  if (f.q) ativos.push([`“${f.q}”`, () => { setTexto(''); muda({ q: '' }); }]);
  if (f.marca) ativos.push([f.marca, () => muda({ marca: undefined, modelo: undefined })]);
  if (f.modelo) ativos.push([f.modelo, () => muda({ modelo: undefined })]);
  if (f.ano) ativos.push([String(f.ano), () => muda({ ano: undefined })]);
  if (f.tipo) ativos.push([f.tipo, () => muda({ tipo: undefined })]);
  if (f.preco) ativos.push([FAIXAS.find((x) => x[0] === f.preco)?.[1] || f.preco, () => muda({ preco: undefined })]);
  if (f.frete) ativos.push(['Frete grátis no ML', () => muda({ frete: false })]);
  const limpar = () => { setTexto(''); setF({ ordem: f.ordem }); };

  const anos = useMemo(() => { const a = new Date().getFullYear() + 1; return Array.from({ length: a - 1979 }, (_, i) => a - i); }, []);
  const filtros = facetas && (
    <div className="cat-filtros">
      <Lista titulo="Marca do carro" itens={facetas.marcas} ativo={f.marca} aoEscolher={(v) => muda({ marca: v, modelo: undefined })} />
      {f.marca && <Lista titulo={`Modelo ${f.marca}`} itens={facetas.modelos} ativo={f.modelo} aoEscolher={(v) => muda({ modelo: v })} limite={10} />}
      <fieldset className="cat-grupo">
        <legend>Ano do carro</legend>
        <label className="seletor"><span>Ano</span>
          <select value={f.ano || ''} onChange={(e) => muda({ ano: Number(e.target.value) || undefined })}>
            <option value="">Qualquer ano</option>
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
      </fieldset>
      <Lista titulo="Tipo de peça" itens={facetas.tipos} ativo={f.tipo} aoEscolher={(v) => muda({ tipo: v })} limite={10} />
      {facetas.precos.some(([, , c]) => c > 0) && <fieldset className="cat-grupo">
        <legend>Preço</legend>
        <ul>
          {facetas.precos.filter(([, , c]) => c > 0).map(([k, rot, c]) => (
            <li key={k}><button type="button" className="cat-opcao" aria-pressed={f.preco === k} onClick={() => muda({ preco: f.preco === k ? undefined : k })}>
              <span>{rot}</span><b className="num">{c.toLocaleString('pt-BR')}</b></button></li>
          ))}
        </ul>
      </fieldset>}
      <label className="cat-chave">
        <input type="checkbox" checked={!!f.frete} onChange={(e) => muda({ frete: e.target.checked })} />
        <span className="cat-chave-trilho" aria-hidden="true"><i /></span>
        <span>Só com frete grátis no Mercado Livre</span>
      </label>
    </div>
  );

  const carregando = !busca && !erro;
  const lista = resultado.slice(0, qtd);
  const procuro = [f.q, f.marca, f.modelo, f.ano].filter(Boolean).join(' ');

  return (
    <div className="cat">
      <form className="busca cat-busca" role="search" onSubmit={(e) => { e.preventDefault(); muda({ q: texto }); (document.activeElement as HTMLElement)?.blur(); }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input id="busca" type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Peça, carro ou código"
               aria-label="Buscar no catálogo" autoComplete="off" enterKeyHint="search" />
        {texto && <button type="button" className="cat-limpar-texto" aria-label="Apagar busca" onClick={() => { setTexto(''); muda({ q: '' }); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg></button>}
        <button className="botao botao-laranja" type="submit">Buscar</button>
      </form>

      <div className="cat-corpo">
        <aside className="cat-lateral" aria-label="Filtros">{filtros}</aside>
        <section className="cat-resultados" aria-live="polite" aria-busy={carregando}>
          <div className="cat-barra">
            <p className="cat-total"><b className="num">{(busca ? resultado.length : totalInicial).toLocaleString('pt-BR')}</b> {resultado.length === 1 && busca ? 'peça' : 'peças'}</p>
            <button type="button" className="botao botao-linha cat-abrir-filtros" onClick={() => setGaveta(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
              Filtros{ativos.length ? ` (${ativos.length})` : ''}
            </button>
            <label className="seletor cat-ordem"><span>Ordenar</span>
              <select value={f.ordem || 'rel'} onChange={(e) => muda({ ordem: e.target.value as Filtros['ordem'] })}>
                {ORDENS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </label>
          </div>
          {ativos.length > 0 && (
            <div className="cat-ativos">
              {ativos.map(([t, tirar]) => (
                <button type="button" key={t} className="cat-ficha" onClick={tirar} aria-label={`Tirar filtro ${t}`}>{t}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" /></svg></button>
              ))}
              <button type="button" className="cat-limpar" onClick={limpar}>Limpar tudo</button>
            </div>
          )}

          {carregando && <div className="cat-grade">{Array.from({ length: 8 }, (_, i) => <div key={i} className="cat-esqueleto" />)}</div>}
          {erro && <p className="cat-erro">Não deu para carregar o catálogo agora. Recarregue a página ou fale com a gente no WhatsApp.</p>}

          {busca && resultado.length === 0 && (
            <div className="cat-vazio">
              <img src="/arte/v2/vazio-busca.webp" alt="" width="360" height="360" />
              <div>
                <h2>Nada {f.q ? <>com “{f.q}”</> : 'com esses filtros'} no site.</h2>
                <p>Nem toda peça está anunciada. Mande o carro e a peça no WhatsApp que a gente procura no pátio.</p>
                <div className="cat-vazio-botoes">
                  <a className="botao botao-laranja" href={whats(`Olá! Procuro: ${procuro || 'uma peça'}. Tem no pátio?`)}>Procurar no pátio pelo WhatsApp</a>
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
              <a className="botao botao-laranja" href={whats(`Olá! Procuro: ${procuro}. Não achei no site, tem no pátio?`)}>Procurar no pátio</a>
            </div>
          )}
          {busca && resultado.length > 0 && (
            <>
              <div className="cat-grade">{lista.map((it, i) => <Etiqueta key={it.id} it={it} eager={i < 4} />)}</div>
              <div ref={fimRef} />
              {qtd < resultado.length && (
                <button type="button" className="botao botao-linha cat-ver-mais" onClick={() => setQtd(qtd + LOTE)}>
                  Ver mais {Math.min(LOTE, resultado.length - qtd)} peças
                </button>
              )}
            </>
          )}
        </section>
      </div>

      <Gaveta aberta={gaveta} aoFechar={() => setGaveta(false)} titulo="Filtros"
        rodape={<button type="button" className="botao botao-grafite" onClick={() => setGaveta(false)}>
          Ver {resultado.length.toLocaleString('pt-BR')} {resultado.length === 1 ? 'peça' : 'peças'}</button>}>
        {filtros}
        {ativos.length > 0 && <button type="button" className="cat-limpar" onClick={limpar} style={{ marginTop: 16 }}>Limpar tudo</button>}
      </Gaveta>
    </div>
  );
}
