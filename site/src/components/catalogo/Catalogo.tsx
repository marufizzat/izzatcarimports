// Catalogo (ilha React): busca instantanea + filtros + grade de cartões (vitrine).
// Estado na URL com os MESMOS parametros do site antigo:
//   q, marca, modelo, ano, tipo, preco, frete, ordem (+ sub: o subtipo dos cartões "Por tipo" da categoria)
// O cartão (Etiqueta) é o MESMO desenho de CartaoPeca.astro; as regras ficam em ./etiqueta.ts.
//
// Fluidez (4G e celular fraco):
// - a 1ª tela (24 cartões da ordem padrão e os filtros) vem pronta no HTML, feita no build com o MESMO busca.json,
//   com as fotos em loading="lazy" (as 2 primeiras o <head> já pede); o índice (≈360 KB) só é baixado depois das
//   fotos da 1ª tela, ou na hora se o endereço traz busca/filtro (o <head> de catalogo.astro marca html.cat-url e já
//   pede o índice: a vitrine padrão fica escondida e as fotos dela nem descem) ou se a pessoa mexe em algo;
// - o campo de busca tem estado próprio (digitar não redesenha a grade); filtros e cartões são memorizados;
// - lotes de 48 (2 entram sozinhos ao rolar, depois o botão); dentro do lote, os cartões entram aos poucos,
//   num pedaço pequeno por vez quando o navegador folga (a rolagem e o toque passam na frente).
import {
  memo, startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';
import { Busca, FAIXAS, SIZES_CARTAO, codigoJunto, fotoCartao, type Carro, type Facetas, type Filtros, type Indice, type Item } from '../../lib/busca';
import Gaveta from '../ui/Gaveta';
import MeuCarroFiltro, { useMeuCarro } from '../ui/MeuCarroFiltro';
import { serveNoMeuCarro, nomeCarro } from '../../lib/meuCarro';
import {
  linhaCarro, codigoPeca, precoPartes, msgWhats, linkWhats, urlPeca, dadosCarro,
  CLASSE_CARTAO, VITRINE_CLARA, icone,
} from './etiqueta';
import { whatsUrl } from '../../lib/whats';

/** Logo da marca (calculado no build por logoInfo em catalogo.astro). */
export type Logo = { src: string; w: number; h: number };

const LOTE = 48;
// Fluidez: lista nova começa com PRIMEIRO cartões (a 1ª tela do PC); o resto entra PEDACO por vez, quando o
// navegador folga (requestIdleCallback), sem quadro longo no celular fraco.
const PRIMEIRO = 12;
const PEDACO = 4;
const ORDENS: [NonNullable<Filtros['ordem']>, string][] = [
  ['rel', 'Mais relevantes'], ['novos', 'Chegaram agora'], ['asc', 'Menor preço'], ['desc', 'Maior preço'],
];
const n2 = (v: number) => v.toLocaleString('pt-BR');
const NENHUMA: Item[] = [];
const pecas = (n: number) => (n === 1 ? 'peça' : 'peças');

function lerUrl(): Filtros {
  const u = new URLSearchParams(location.search);
  const ano = Number(u.get('ano')) || undefined;
  const o = u.get('ordem'); const ordem = (['asc', 'desc', 'novos'].includes(o || '') ? o : undefined) as Filtros['ordem'];
  return {
    q: u.get('q') || '', marca: u.get('marca') || undefined, modelo: u.get('modelo') || undefined,
    ano, tipo: u.get('tipo') || undefined, sub: u.get('sub') || undefined, preco: u.get('preco') || undefined,
    // "frete" dos links antigos: aceito no endereço, mas não filtra mais (filtrava calado: "492 peças para xc60",
    // contra 515, sem ficha nem aviso)
    frete: undefined, ordem,
  };
}
function escreverUrl(f: Filtros) {
  const u = new URLSearchParams();
  if (f.q) u.set('q', f.q);
  if (f.marca) u.set('marca', f.marca);
  if (f.modelo) u.set('modelo', f.modelo);
  if (f.ano) u.set('ano', String(f.ano));
  if (f.tipo) u.set('tipo', f.tipo);
  if (f.sub) u.set('sub', f.sub);
  if (f.preco) u.set('preco', f.preco);
  if (f.frete) u.set('frete', '1');
  if (f.ordem && f.ordem !== 'rel') u.set('ordem', f.ordem);
  const qs = u.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}
/** A lista da 1ª tela (feita no build) vale: sem busca nem filtro, na ordem padrão. */
const ehPadrao = (f: Filtros) =>
  !(f.q || '').trim() && !f.marca && !f.modelo && !f.ano && !f.tipo && !f.sub && !f.preco && !f.frete &&
  (!f.ordem || f.ordem === 'rel' || f.ordem === 'novos');

/** Título da página com os filtros ("Peças para Volvo XC60 2020"). A busca de texto fica na linha do total
 *  (o título mudando a cada letra faria a página pular). A MESMA regra está no script de catalogo.astro. */
export function tituloCatalogo(f: Filtros, busca = ''): string | null {
  const q = busca.trim();
  if (q && !f.marca && !f.modelo && !f.ano && !f.tipo && !f.sub) return `Resultados para “${q}”`;
  const carro = [f.marca, f.modelo].filter(Boolean).join(' ');
  const t = f.tipo;
  const base = f.sub ? f.sub : t ? (t === 'Outros' ? 'Outras peças' : /^peças/i.test(t) ? t : `Peças de ${t.toLowerCase()}`) : 'Peças';
  if (carro) return `${base} para ${carro}${f.ano ? ` ${f.ano}` : ''}`;
  if (f.ano) return `${base} para carro ano ${f.ano}`;
  return t || f.sub ? base : null;
}

// ícones longos pelo sprite /icones.svg (src/lib/icones.ts): o mesmo desenho do cartão do build
const Whats = () => <svg viewBox="0 0 24 24" aria-hidden="true"><use href={icone('whats')} /></svg>;
const Sino = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
);
const Seta = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
);
const Xis = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M7 7l10 10M17 7 7 17" /></svg>
);

/** Cartão da peça (vitrine) — mesmo markup de CartaoPeca.astro. Memorizado: só redesenha se a peça ou o selo mudam. */
export const Etiqueta = memo(function Etiqueta({ it, eager, alta, novo, meuModelo }: {
  it: Item; eager?: boolean; alta?: boolean; novo?: boolean; meuModelo?: string | null;
}) {
  const { carro, anos } = linhaCarro(it.b, it.m, it.y, it.ms);
  const [reais, cent] = precoPartes(it.p);
  const cod = codigoPeca(it.o);
  // foto que não carregou: a capa leve (srcset) dá lugar à capa inteira; ela, à foto do ML; se essa também falhar, fica a
  // placa clara (nunca o ícone quebrado com o título cru do anúncio). 0 tudo certo, 1 sem a leve, 2 foto do ML, 3 placa
  const [falha, setFalha] = useState(0);
  const falhou = () => setFalha((x) => (x === 0 && it.e !== '0' && it.r ? 1 : x <= 1 && it.e !== '0' && it.i ? 2 : 3));
  const f = fotoCartao(falha === 0 ? it : falha === 1 ? { ...it, r: undefined } : { ...it, e: '0' }, SIZES_CARTAO.catalogo);
  const img = useRef<HTMLImageElement>(null);
  useEffect(() => {
    // a falha pode ter acontecido antes do React assumir o cartão (a 1ª tela vem pronta no HTML)
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0 && el.getAttribute('src')) falhou();
  }, []);
  return (
    <div className={CLASSE_CARTAO}>
      <a className="etiqueta" href={`/peca/${it.h}.html`} {...dadosCarro(it.b, it.m, it.y, it.ms, it.ys)}>
        <div className="etiqueta-foto">
          <img ref={img} sizes={f.sizes} srcSet={f.srcset} src={f.src}
               className={f.estudio ? 'estudio' : falha === 3 ? 'sem-capa' : undefined} alt="" width={800} height={800}
               loading={eager ? 'eager' : 'lazy'} fetchPriority={alta ? 'high' : undefined} decoding="async" onError={falhou} />
          {novo && <span className="etiqueta-novo">Chegou agora</span>}
        </div>
        <div className="etiqueta-dados">
          <span className="etiqueta-serve" hidden={!meuModelo}>{meuModelo ? `Serve no seu ${meuModelo}` : ''}</span>
          {carro && <span className="etiqueta-carro"><span className="etiqueta-modelo">{carro}</span>{it.dif && <> <span className="etiqueta-dif">{it.dif}</span></>}{anos && <span className="etiqueta-anos"><span className="etiqueta-sep"> · </span>{anos}</span>}</span>}
          <h3 className="etiqueta-nome">{it.n}</h3>
          {cod && <span className="etiqueta-cod" title="Código gravado na peça">Cód. <span className="oem">{cod}</span></span>}
          <span className="sr-only">R$ {reais},{cent}</span>
          <span className="etiqueta-preco num" aria-hidden="true"><small>R$</small>{reais}<small>{cent}</small></span>
          <span className="etiqueta-confia">
            <svg viewBox="0 0 24 24" aria-hidden="true"><use href={icone('garantia')} /></svg>
            <span><span className="etiqueta-confia-longo">Original · </span>90 dias de garantia</span>
          </span>
        </div>
      </a>
      <a className="etiqueta-acao" href={linkWhats(msgWhats(it, urlPeca(it.h)))} target="_blank" rel="noopener"
         aria-label={`Pedir no WhatsApp: ${it.n}`}><Whats />Pedir no WhatsApp</a>
    </div>
  );
});

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
                <span className="cat-opcao-qtd num"><span className="sr-only">, </span>{n2(o.c)}<span className="sr-only"> {pecas(o.c)}</span></span>
              </button>
            </li>
          );
        })}
      </ul>
      {itens.length > limite && mais && (
        <button type="button" className="cat-mais" aria-expanded={todas} onClick={() => setTodas(!todas)}>
          {todas ? 'Mostrar menos' : mais}<Seta />
        </button>
      )}
    </>
  );
}

/** Os filtros (lateral no PC e gaveta no celular). Memorizado: só redesenha quando as contagens ou a escolha mudam. */
const PainelFiltros = memo(function PainelFiltros({ fa, marca, modelo, ano, tipo, sub, preco, logos, mudar }: {
  fa: Facetas; marca?: string; modelo?: string; ano?: number; tipo?: string; sub?: string; preco?: string;
  logos: Record<string, Logo>; mudar: (p: Partial<Filtros>) => void;
}) {
  const marcas = fa.marcas.map(([v, c]) => ({ v, rot: v, c }));
  const modelos = fa.modelos.map(([v, c]) => ({ v, rot: v, c }));
  const tipos = fa.tipos.map(([v, c]) => ({ v, rot: v, c }));
  const subs = (fa.subs ?? []).map(([v, c]) => ({ v, rot: v, c }));
  const precos = fa.precos.filter(([, , c]) => c > 0).map(([v, rot, c]) => ({ v, rot, c }));
  const precoRot = FAIXAS.find((x) => x[0] === preco)?.[1];
  const anos = ano && !fa.anos.some(([a]) => a === ano) ? [...fa.anos, [ano, 0] as [number, number]].sort((a, b) => b[0] - a[0]) : fa.anos;
  // sem opção nenhuma (busca sem resultado): uma linha só, em vez da mesma frase em cada grupo
  if (!marcas.length && !anos.length && !tipos.length && !precos.length) {
    return <div className="cat-filtros"><p className="cat-nada">Sem filtros para esta busca.</p></div>;
  }
  return (
    <div className="cat-filtros">
      {marcas.length > 0 && (
        <Grupo titulo="Marca do carro" escolhido={marca}>
          <Opcoes itens={marcas} ativo={marca} logos={logos} mais="Ver todas as marcas" aoEscolher={(v) => mudar({ marca: v, modelo: undefined })} />
        </Grupo>
      )}
      {marca && modelos.length > 0 && (
        <Grupo titulo={`Modelo ${marca}`} escolhido={modelo}>
          <Opcoes itens={modelos} ativo={modelo} limite={10} mais="Ver todos os modelos" aoEscolher={(v) => mudar({ modelo: v })} />
        </Grupo>
      )}
      {anos.length > 0 && (
        <Grupo titulo="Ano do carro" escolhido={ano ? String(ano) : undefined}>
          <label className="seletor cat-ano"><span>Ano</span>
            <select value={ano || ''} onChange={(e) => mudar({ ano: Number(e.target.value) || undefined })}>
              <option value="">Todos os anos</option>
              {anos.map(([a, c]) => <option key={a} value={a}>{c ? `${a} · ${n2(c)} ${pecas(c)}` : String(a)}</option>)}
            </select>
          </label>
        </Grupo>
      )}
      {precos.length > 0 && (
        <Grupo titulo="Preço" escolhido={precoRot}>
          <Opcoes itens={precos} ativo={preco} limite={6} aoEscolher={(v) => mudar({ preco: v })} />
        </Grupo>
      )}
      {tipos.length > 0 && (
        <Grupo titulo="Categoria" escolhido={tipo}>
          <Opcoes itens={tipos} ativo={tipo} limite={8} mais="Ver todas as categorias" aoEscolher={(v) => mudar({ tipo: v, sub: undefined })} />
        </Grupo>
      )}
      {tipo && subs.length > 0 && (
        <Grupo titulo="Tipo de peça" escolhido={sub}>
          <Opcoes itens={subs} ativo={sub} limite={8} mais="Ver todos os tipos" aoEscolher={(v) => mudar({ sub: v })} />
        </Grupo>
      )}
    </div>
  );
});

const EsqFiltros = ({ soUrl }: { soUrl?: boolean }) => (
  <div className={`cat-filtros cat-filtros-carregando${soUrl ? ' so-url' : ''}`} aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} />)}</div>
);

/** Campo de busca com estado próprio: digitar só redesenha o campo; o texto entra no filtro com um pequeno atraso. */
function CampoBusca({ valor, aoMudar, aoEnviar, aoFocar }: {
  valor: string; aoMudar: (q: string) => void; aoEnviar: (q: string) => void; aoFocar: () => void;
}) {
  const [texto, setTexto] = useState(valor);
  const enviado = useRef(valor);
  // o filtro mudou por fora (limpar, endereço): o campo acompanha
  useEffect(() => { if (valor !== enviado.current) { enviado.current = valor; setTexto(valor); } }, [valor]);
  useEffect(() => {
    if (texto === enviado.current) return;
    const t = setTimeout(() => { enviado.current = texto; aoMudar(texto); }, 160);
    return () => clearTimeout(t);
  }, [texto]);
  const limpar = () => { setTexto(''); enviado.current = ''; aoMudar(''); };
  return (
    <form className="busca cat-busca" role="search" action="/catalogo.html"
          onSubmit={(e) => { e.preventDefault(); enviado.current = texto; aoEnviar(texto); (document.activeElement as HTMLElement)?.blur(); }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <input id="busca" name="q" type="search" value={texto} onChange={(e) => setTexto(e.target.value)} onFocus={aoFocar} placeholder="Peça, carro ou código"
             aria-label="Buscar no catálogo" autoComplete="off" enterKeyHint="search" />
      {texto && <button type="button" className="cat-limpar-texto" aria-label="Apagar busca" onClick={limpar}><Xis /></button>}
      <button className="botao botao-laranja botao-buscar cat-buscar" type="submit">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-3.6-3.6" /></svg>
        <span>Buscar</span>
      </button>
    </form>
  );
}

/** "farol compass" -> "farol" (tira da busca as palavras do carro: "Procuro farol para Jeep Compass") */
function semCarro(q: string, c: Carro | null): string {
  if (!c) return q;
  const re = (s: string) => new RegExp(
    `(^|[^\\p{L}\\p{N}])${[...s.replace(/[^\p{L}\p{N}]/gu, '')].map((ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s-]?')}(?=$|[^\\p{L}\\p{N}])`, 'giu');
  return q.replace(re(c.m), '$1').replace(re(c.b), '$1').replace(/\s+/g, ' ').trim();
}

type Props = {
  total: number;
  /** logos das marcas por nome ("Volvo" -> /marcas/volvo.png), feitos no build */
  logos?: Record<string, Logo>;
  /** slot "selo" do Astro: selo de reputação do ML, no topo dos resultados */
  selo?: ReactNode;
  /** a 1ª tela, feita no build com o mesmo busca.json: as primeiras peças da ordem padrão */
  iniciais?: Item[];
  /** os filtros da ordem padrão (sem busca), feitos no build */
  facetasIniciais?: Facetas | null;
  /** ids das que chegaram agora (selo "Chegou agora"), feitos no build */
  novos?: string[];
};

const SEM_LOGOS: Record<string, Logo> = {};
const SEM_IDS: string[] = [];

export default function Catalogo({ total: totalInicial, logos = SEM_LOGOS, selo, iniciais = NENHUMA, facetasIniciais = null, novos: idsNovos = SEM_IDS }: Props) {
  const [busca, setBusca] = useState<Busca | null>(null);
  const [erro, setErro] = useState(false);
  const [f, setF] = useState<Filtros>({});
  const [urlLida, setUrlLida] = useState(false);
  // busca no título ("Resultados para “farol compass”"): a que veio no endereço ou a enviada com Enter; enquanto a
  // pessoa digita, o título não muda a cada letra (a página pularia)
  const [qTitulo, setQTitulo] = useState('');
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
  const fRef = useRef(f); fRef.current = f;
  const tituloPadrao = useRef('');
  const novos = useMemo(() => new Set(idsNovos), [idsNovos]);

  // índice da busca: um download só (e de novo pelo "Tentar de novo")
  const pedido = useRef<Promise<void> | null>(null);
  const carregar = useCallback(() => {
    if (pedido.current) return;
    setErro(false);
    pedido.current = fetch('/dados/busca.json')
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(async (ix: Indice) => {
        const b = new Busca(ix);
        // o índice de texto é montado aos poucos: já, quando há texto; senão, quando o navegador folgar
        if ((fRef.current.q || '').trim()) await b.prepararIndice();
        else if ('requestIdleCallback' in window) requestIdleCallback(() => { void b.prepararIndice(); });
        else setTimeout(() => { void b.prepararIndice(); }, 1500);
        // a 1ª montagem da vitrine é uma transição: o React pode ceder a vez no meio (sem travar a página)
        startTransition(() => setBusca(b));
      })
      .catch(() => { pedido.current = null; setErro(true); });
  }, []);

  useEffect(() => {
    tituloPadrao.current = document.title;
    const ini = lerUrl();
    setF(ini); setQTitulo(ini.q || ''); setUrlLida(true);
    if (!ehPadrao(ini) || !iniciais.length) { carregar(); return; }
    // a 1ª tela já veio no HTML: o índice espera as fotos dela (load) e o navegador folgar
    const ir = () => ('requestIdleCallback' in window ? requestIdleCallback(() => carregar(), { timeout: 1200 }) : setTimeout(carregar, 300));
    if (document.readyState === 'complete') ir();
    else window.addEventListener('load', ir, { once: true });
    return () => window.removeEventListener('load', ir);
  }, []);
  // o endereço já foi lido e a tela mostra o que ele pede: as marcas de antes da pintura saem
  useEffect(() => { if (urlLida) document.documentElement.classList.remove('cat-url', 'cat-url-filtro'); }, [urlLida]);
  // "Seu carro": catalogo.astro reserva o lugar do aviso antes da pintura; se a pessoa esquece o carro, o lugar sai
  const carroLido = useRef(false);
  useEffect(() => {
    if (!carroLido.current) { carroLido.current = true; return; }
    document.documentElement.classList.toggle('cat-carro', !!meuCarro);
  }, [meuCarro]);

  const fDiferido = useDeferredValue(f);
  const [resultado, aproximado, nDoCarro, carrosBusca, codigoBusca] = useMemo(() => {
    if (!busca) return [[] as Item[], false, 0, [] as Carro[], ''] as const;
    const r = busca.procurar(fDiferido);
    return [r, busca.aproximado, busca.nDoCarro, busca.carrosDaBusca, busca.codigoDaBusca] as const;
  }, [busca, fDiferido]);
  const padrao = ehPadrao(f);
  const facetas = useMemo(() => (busca ? busca.facetas(fDiferido) : padrao ? facetasIniciais : null), [busca, fDiferido, padrao, facetasIniciais]);

  useEffect(() => { if (busca) escreverUrl(f); setQtd(LOTE); autos.current = 0; }, [f, busca]);
  useEffect(() => {
    const q = (f.q || '').trim();
    if (busca && q.length >= 3 && q !== ultimoRastreio.current) {
      const t = setTimeout(() => { ultimoRastreio.current = q; (window as any).izzatBusca?.(q); }, 1200);
      return () => clearTimeout(t);
    }
  }, [f.q, busca]);
  // título da página com os filtros (o script de catalogo.astro já pôs o do endereço antes da pintura)
  useEffect(() => {
    if (!urlLida) return;
    const t = tituloCatalogo(f, qTitulo);
    const h1 = document.querySelector<HTMLElement>('[data-cat-titulo]');
    const novo = t ?? 'Catálogo de peças';
    if (h1 && h1.textContent !== novo) h1.textContent = novo;
    document.title = t ? `${t} | Izzat Car Imports` : tituloPadrao.current;
  }, [urlLida, f.marca, f.modelo, f.ano, f.tipo, f.sub, qTitulo]);

  // a banda da busca ganha linha e sombra só quando está grudada no topo (celular)
  useEffect(() => {
    const el = marcoBanda.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const cab = (document.querySelector('.cab') ?? document.querySelector('header'))?.getBoundingClientRect().height ?? 70;
    const io = new IntersectionObserver(([e]) => setPresa(!e.isIntersecting), { rootMargin: `-${Math.round(cab) + 1}px 0px 0px 0px` });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const gavetaRef = useRef(gaveta); gavetaRef.current = gaveta;
  // filtro ou ordem mudou com a lista lá embaixo: volta para o topo dos resultados (como nas lojas grandes)
  const voltaAoTopo = useCallback((jeito?: ScrollBehavior) => requestAnimationFrame(() => {
    const el = resultadosRef.current; if (!el) return;
    const cab = (document.querySelector('.cab') ?? document.querySelector('header'))?.getBoundingClientRect().height ?? 70;
    const fixo = banda.current && getComputedStyle(banda.current).position === 'sticky' ? banda.current.offsetHeight : 0;
    const folga = cab + fixo + 12;
    const topo = el.getBoundingClientRect().top;
    if (topo < folga) window.scrollTo({ top: window.scrollY + topo - folga, behavior: jeito ?? (gavetaRef.current ? 'auto' : 'smooth') });
  }), []);
  const muda = useCallback((parcial: Partial<Filtros>) => { setF((o) => ({ ...o, ...parcial })); carregar(); }, [carregar]);
  const mudaFiltro = useCallback((parcial: Partial<Filtros>) => { muda(parcial); voltaAoTopo(); }, [muda, voltaAoTopo]);
  const mudaTexto = useCallback((q: string) => { muda({ q }); setQTitulo(''); voltaAoTopo('auto'); }, [muda, voltaAoTopo]);
  const enviaTexto = useCallback((q: string) => { muda({ q }); setQTitulo(q); voltaAoTopo(); }, [muda, voltaAoTopo]);

  // fichas do que está escolhido (a busca de texto já aparece no campo, com o "×" dele; o parâmetro antigo
  // "frete" dos links continua filtrando, sem ficha)
  const ativos: { k: string; rot: string; logo?: Logo; tirar: () => void }[] = [];
  if (f.marca) ativos.push({ k: 'marca', rot: f.marca, logo: logos[f.marca], tirar: () => mudaFiltro({ marca: undefined, modelo: undefined }) });
  if (f.modelo) ativos.push({ k: 'modelo', rot: f.modelo, tirar: () => mudaFiltro({ modelo: undefined }) });
  if (f.ano) ativos.push({ k: 'ano', rot: `Ano ${f.ano}`, tirar: () => mudaFiltro({ ano: undefined }) });
  if (f.tipo) ativos.push({ k: 'tipo', rot: f.tipo, tirar: () => mudaFiltro({ tipo: undefined, sub: undefined }) });
  if (f.sub) ativos.push({ k: 'sub', rot: f.sub, tirar: () => mudaFiltro({ sub: undefined }) });
  if (f.preco) ativos.push({ k: 'preco', rot: FAIXAS.find((x) => x[0] === f.preco)?.[1] || f.preco, tirar: () => mudaFiltro({ preco: undefined }) });
  const nFiltros = ativos.length;
  const limpar = () => { setF({ ordem: f.ordem }); setQTitulo(''); voltaAoTopo(); };
  const limparFiltros = () => { setF({ q: f.q, ordem: f.ordem }); };

  const filtros = facetas
    ? <PainelFiltros fa={facetas} marca={f.marca} modelo={f.modelo} ano={f.ano} tipo={f.tipo} sub={f.sub} preco={f.preco} logos={logos} mudar={mudaFiltro} />
    : null;

  const carregando = !busca && !erro;
  // a lista na tela: com o índice, o resultado; antes dele, a 1ª tela do build (só na ordem padrão)
  const fonte: Item[] = busca ? resultado : padrao ? iniciais : NENHUMA;
  const lista = busca ? resultado.slice(0, qtd) : fonte;
  const total = busca ? resultado.length : padrao ? totalInicial : null;
  const vazio = !!busca && resultado.length === 0;
  // pintura aos poucos: lista nova começa com PRIMEIRO cartões e o resto entra PEDACO por vez, quando o navegador
  // folga; os cartões do começo que já estão na tela (os da 1ª tela, quando o índice chega) ficam como estão
  const [pint, setPint] = useState<{ de: Item[]; n: number }>({ de: fonte, n: Math.max(PRIMEIRO, fonte.length) });
  if (pint.de !== fonte) {
    let mesmo = 0;
    const lim = Math.min(pint.de.length, pint.n, fonte.length);
    while (mesmo < lim && pint.de[mesmo].id === fonte[mesmo].id) mesmo++;
    setPint({ de: fonte, n: Math.max(PRIMEIRO, mesmo) });
  }
  const pintados = pint.n;
  useEffect(() => {
    if (pintados >= lista.length) return;
    const passo = () => startTransition(() => setPint((p) => ({ ...p, n: p.n + PEDACO })));
    if ('requestIdleCallback' in window) { const id = requestIdleCallback(passo, { timeout: 250 }); return () => cancelIdleCallback(id); }
    const id = setTimeout(passo, 16);
    return () => clearTimeout(id);
  }, [pintados, lista.length]);
  const pintouTudo = pintados >= lista.length;

  // carrega mais sozinho perto do fim da lista, só 2 vezes: depois vem o botão (o rodapé fica alcançável).
  // Só olha o fim depois que o lote inteiro foi pintado (com a lista ainda crescendo, o fim parece perto e
  // puxaria um lote a mais de uma vez). Antes do índice, chegar perto do fim da 1ª tela pede o índice.
  useEffect(() => {
    const el = fimRef.current;
    if (!el || !pintouTudo || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      if (!busca) { carregar(); return; }
      if (autos.current < 2) { autos.current += 1; setQtd((n) => n + LOTE); }
    }, { rootMargin: '900px' });
    io.observe(el);
    return () => io.disconnect();
  }, [resultado.length, pintouTudo, busca, carregar]);

  // pedido pelo WhatsApp com o que a pessoa procura e para qual carro (nunca "Procuro: 1981")
  const carroDaBusca = carrosBusca[0] ?? null;
  const { texto: qSemAno, ano: anoQ } = useMemo(() => {
    const q = (f.q || '').trim(); const m = q.match(/\b(19[89]\d|20[0-3]\d)\b/);
    return m ? { texto: q.replace(m[0], ' ').replace(/\s+/g, ' ').trim(), ano: Number(m[1]) } : { texto: q, ano: undefined };
  }, [f.q]);
  // o carro do pedido: o do filtro, senão o digitado, senão o salvo no "Meu carro"; o ano: o do filtro ou da busca,
  // senão o do carro salvo (quando é o mesmo carro)
  const alvo = useMemo(() => {
    const mesmo = (b: string, m?: string) => !!meuCarro && meuCarro.b === b && (!m || meuCarro.m === m);
    const anoDe = (b: string, m?: string) => f.ano || anoQ || (mesmo(b, m) ? meuCarro!.y ?? undefined : undefined);
    if (f.marca) return { b: f.marca, m: f.modelo || '', y: anoDe(f.marca, f.modelo) };
    if (carroDaBusca) return { b: carroDaBusca.b, m: carroDaBusca.m, y: anoDe(carroDaBusca.b, carroDaBusca.m) };
    if (meuCarro) return { b: meuCarro.b, m: meuCarro.m, y: f.ano || anoQ || meuCarro.y || undefined };
    return null;
  }, [f.marca, f.modelo, f.ano, anoQ, carroDaBusca, meuCarro]);
  const ano = alvo?.y ?? (f.ano || anoQ);
  const carroPedido = alvo ? (alvo.m ? nomeCarro({ b: alvo.b, m: alvo.m, y: alvo.y ?? null }) : `${alvo.b}${alvo.y ? ` ${alvo.y}` : ''}`) : '';
  // o que a pessoa digitou, sem o carro e o ano ("retrovisor xc60 2019" -> "retrovisor"); código: "a peça com o código …"
  const digitado = f.marca ? qSemAno : semCarro(qSemAno, carroDaBusca);
  const codDigitado = codigoBusca || codigoJunto(digitado) || (/^[a-z0-9]{6,20}$/i.test(digitado) && (digitado.match(/\d/g) ?? []).length >= 5 ? digitado : '');
  const oQue = (codDigitado ? `a peça com o código ${codDigitado.toUpperCase()}` : digitado) || (f.sub ? f.sub.toLowerCase() : f.tipo ? `peça de ${f.tipo.toLowerCase()}` : 'peça');
  const paraCarro = carroPedido ? `para ${carroPedido}` : ano ? `para carro ano ${ano}` : '';
  const procuro = [oQue, paraCarro].filter(Boolean).join(' ');
  const pedirNoPatio = whatsUrl(`Procuro ${procuro}. Não achei no site, tem no pátio?`);
  // o formulário "Não achou a peça?" já preenchido com a busca e o carro
  const urlFormulario = useMemo(() => {
    const u = new URLSearchParams();
    if (digitado) u.set('q', digitado);
    if (carroPedido) u.set('carro', carroPedido);
    const qs = u.toString();
    return `/procuro-peca.html${qs ? `?${qs}` : ''}`;
  }, [digitado, carroPedido]);
  // "Avise-me quando chegar": com carro no filtro, na busca ou salvo no Meu carro (só fatos, sem prazo)
  const avise = carroPedido
    ? whatsUrl(`Procuro ${oQue === 'peça' ? 'peças' : oQue} para ${carroPedido}. Quero ser avisado quando chegar no pátio.`)
    : '';
  const botaoAvise = avise ? (
    <a className="botao botao-linha cat-avise" href={avise} target="_blank" rel="noopener"><Sino />Me avise quando chegar</a>
  ) : null;
  // "Não achou? A gente procura no pátio": sem nada, só parecidas, ou a lista não tem a peça buscada para o carro
  // ("retrovisor direito" com o XC60 2019 achava só a capa do espelho)
  const naoBate = useMemo(
    () => !!busca && !aproximado && resultado.length > 0 && !!(f.q || '').trim() && !busca.bate(resultado, f.q || '', alvo?.m ? alvo : null),
    [busca, aproximado, resultado, f.q, alvo],
  );
  const botaoPatio = (rotulo: ReactNode) => (
    <a className="botao botao-laranja" href={pedirNoPatio} target="_blank" rel="noopener" data-botao="procurar-patio"><Whats />{rotulo}</a>
  );
  const linkFormulario = <p className="cat-patio-form">Prefere o formulário? <a href={urlFormulario}>Preencher o pedido</a></p>;

  const blocos = !!busca && aproximado && (f.ordem || 'rel') === 'rel' && nDoCarro > 0 && nDoCarro < resultado.length && !!carroDaBusca;
  const grade = lista.slice(0, pintados);
  const semSelo = f.ordem === 'novos';

  return (
    <div className="cat">
      <div ref={marcoBanda} aria-hidden="true" />
      <div className={presa ? 'cat-banda presa' : 'cat-banda'} ref={banda}>
        <CampoBusca valor={f.q || ''} aoMudar={mudaTexto} aoEnviar={enviaTexto} aoFocar={carregar} />
        <button type="button" className="cat-abrir-filtros" aria-haspopup="dialog" onClick={() => { setGaveta(true); carregar(); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>
          Filtros{nFiltros > 0 && <span className="cat-contador num" aria-label={`${nFiltros} ativos`}>{nFiltros}</span>}
        </button>
      </div>

      <div className="cat-corpo">
        <aside className="cat-lateral" aria-label="Filtros">
          {filtros
            ? <>{!busca && <EsqFiltros soUrl />}{filtros}</>
            : erro ? <div className="cat-filtros"><p className="cat-nada">Os filtros voltam quando as peças carregarem.</p></div>
            : <EsqFiltros />}
        </aside>

        <section className="cat-resultados" ref={resultadosRef} aria-busy={carregando} aria-labelledby="cat-total">
          <div className="cat-barra">
            {/* o total é o título da lista (h2): os cartões são h3 */}
            <h2 className="cat-total" id="cat-total" aria-live="polite">
              {erro && !busca ? null
                : total === null ? <span className="cat-total-espera">Buscando peças…</span>
                : aproximado ? <><b className="num">{n2(total)}</b> {total === 1 ? 'parecida' : 'parecidas'}<span className="cat-total-q"> com “{f.q}”</span></>
                : codigoBusca ? <><b className="num">{n2(total)}</b> {pecas(total)} com o código <span className="cat-total-q oem">{codigoBusca.toUpperCase()}</span></>
                : <><b className="num">{n2(total)}</b> {pecas(total)}{f.q ? <span className="cat-total-q"> para “{f.q}”</span> : null}</>}
            </h2>
            <div data-selo-reputacao>{selo}</div>
            {!vazio && (
              <label className="cat-ordem">
                <span>Ordenar por</span>
                <select value={f.ordem || 'rel'} onChange={(e) => mudaFiltro({ ordem: e.target.value as Filtros['ordem'] })}>
                  {ORDENS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                </select>
                <Seta />
              </label>
            )}
          </div>

          <div className="cat-ativos-vaga">
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
          </div>

          <div className="cat-meu-vaga"><MeuCarroFiltro marca={f.marca} modelo={f.modelo} ano={f.ano} aoAplicar={(x) => mudaFiltro(x)} /></div>

          {erro && (
            <div className="cat-erro" role="alert">
              <img src="/icones/conversa-96.webp" alt="" width={44} height={44} />
              <div>
                <b>Não deu para carregar {busca ? 'mais peças' : 'a busca e os filtros'} agora.</b>
                <span>Pode ser a conexão. Tente de novo ou fale com a gente: a gente procura a peça no pátio.</span>
              </div>
              <div className="cat-erro-botoes">
                <button type="button" className="botao botao-laranja" onClick={carregar}>Tentar de novo</button>
                <a className="botao botao-linha" href={whatsUrl(`Procuro ${procuro}. Tem no pátio?`)} target="_blank" rel="noopener"><Whats />Chamar no WhatsApp</a>
              </div>
            </div>
          )}

          {vazio && (
            <div className="cat-vazio cat-patio">
              <img src="/arte/v2/vazio-busca.webp" alt="" width={360} height={360} loading="lazy" decoding="async" />
              <h2>Não achou? A gente procura no pátio</h2>
              <p>Nada {f.q ? <>com “{f.q}”{f.marca && carroPedido ? ` para ${carroPedido}` : ''}</> : 'com esses filtros'} no site agora. Nem toda peça está anunciada: mande pelo WhatsApp que a gente confere no pátio.</p>
              <div className="cat-vazio-botoes">
                {botaoPatio(<span>Procurar no pátio<span className="cat-so-largo"> pelo WhatsApp</span></span>)}
                {botaoAvise}
                {(nFiltros > 0 || !!f.q) && <button type="button" className="botao botao-linha" onClick={limpar}>{nFiltros > 0 ? 'Limpar filtros' : 'Limpar a busca'}</button>}
              </div>
              {linkFormulario}
            </div>
          )}

          {!!busca && resultado.length > 0 && (aproximado || naoBate) && (
            <div className="cat-aviso cat-patio">
              <img className="cat-patio-rosto" src="/arte/v2/atendimento-rosto.webp" alt="" width={192} height={192} decoding="async" />
              <b className="cat-patio-titulo">Não achou? A gente procura no pátio</b>
              {aproximado
                ? <span className="cat-patio-texto">Nada exato com “{f.q}”. Nem toda peça está anunciada: a gente confere no pátio. Abaixo, as parecidas{blocos && carroDaBusca ? <>: primeiro as do {carroDaBusca.b} {carroDaBusca.m}</> : null}.</span>
                : <span className="cat-patio-texto">Nem toda peça está anunciada. Mande pelo WhatsApp{carroPedido ? <> o que você procura para o <b className="cat-patio-carro">{carroPedido}</b></> : null}: a gente confere no pátio.</span>}
              <div className="cat-aviso-botoes">
                {botaoPatio('Procurar no pátio')}
                {botaoAvise}
              </div>
              {linkFormulario}
            </div>
          )}

          {/* esqueleto: enquanto o índice não chega com busca ou filtro (e, antes do JS, quando o endereço traz um) */}
          {carregando && (
            <div className={padrao && iniciais.length ? 'cat-grade cat-esq so-url' : 'cat-grade cat-esq'} aria-hidden="true">
              {Array.from({ length: 8 }, (_, i) => <div key={i} className={VITRINE_CLARA ? 'cat-esqueleto tema-estudio' : 'cat-esqueleto'}><i /><b /><b /><b /><b /></div>)}
            </div>
          )}
          {grade.length > 0 && (
            <div className={busca ? 'cat-grade' : 'cat-grade cat-ini'}>
              {grade.flatMap((it, i) => {
                const cartao = (
                  <Etiqueta key={it.id} it={it} eager={!!busca && i < 4} alta={!!busca && i < 2} novo={!semSelo && novos.has(it.id)}
                            meuModelo={meuCarro && serveNoMeuCarro(it, meuCarro) === 'sim' ? meuCarro.m : null} />
                );
                if (blocos && carroDaBusca && i === 0) return [<h2 key="bloco-carro" className="cat-bloco">Do {carroDaBusca.b} {carroDaBusca.m} <span>· {n2(nDoCarro)} {pecas(nDoCarro)}</span></h2>, cartao];
                if (blocos && i === nDoCarro) return [<h2 key="bloco-outras" className="cat-bloco">Outras parecidas <span>· {n2(resultado.length - nDoCarro)} {pecas(resultado.length - nDoCarro)}</span></h2>, cartao];
                return [cartao];
              })}
            </div>
          )}
          <div ref={fimRef} />
          {!!busca && qtd < resultado.length && (
            <div className="cat-mais-pecas">
              <p className="num">Mostrando {n2(lista.length)} de {n2(resultado.length)} {pecas(resultado.length)}</p>
              <button type="button" className="botao botao-linha" onClick={() => setQtd(qtd + LOTE)}>
                Ver mais {Math.min(LOTE, resultado.length - qtd)} peças
              </button>
            </div>
          )}
          {!busca && padrao && iniciais.length > 0 && !erro && (
            <p className="cat-mais-pecas cat-carregando-mais" aria-hidden="true"><span className="cat-giro" />Carregando mais peças…</p>
          )}
        </section>
      </div>

      <Gaveta aberta={gaveta} aoFechar={() => setGaveta(false)} titulo="Filtros"
        rodape={
          <div className="cat-gaveta-rodape">
            <button type="button" className="botao botao-linha" onClick={limparFiltros} disabled={!nFiltros && !f.frete}>Limpar</button>
            <button type="button" className="botao botao-laranja" onClick={() => setGaveta(false)}>
              {total ? `Ver ${n2(total)} ${pecas(total)}` : 'Fechar'}
            </button>
          </div>
        }>
        {filtros ?? (erro ? <p className="cat-nada">Os filtros voltam quando as peças carregarem.</p> : <EsqFiltros />)}
      </Gaveta>
    </div>
  );
}
