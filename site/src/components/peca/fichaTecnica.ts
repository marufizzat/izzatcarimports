// Ficha técnica e descrição da peça em blocos: UM padrão para as 5 mil páginas (e as peças novas do robô).
// Entra o que o preparar_dados.py gerou (p.ficha + p.desc, HTML só com p/h3/ul/ol/li e texto já escapado);
// sai a ficha (uma linha por dado, com ícone) e a descrição em blocos (Compatibilidade, Função, Posição, Medidas,
// Estado da peça...). Os dados "Rótulo: valor" da descrição que são da ficha (material, posição, acabamento...)
// sobem para a ficha; os que já estão no topo (nome, carro, anos, código) não se repetem. Nada é inventado:
// sem medida real, sem bloco de medidas; peso que não faz sentido (0,6 g numa peça de motor) fica de fora.
// Funções puras (sem Astro), testadas em fichaTecnica.test.ts.

export type Linha = { rotulo: string; valor: string; icone: string; html?: boolean; chave: string };
export type Bloco = { tag: 'p' | 'ul' | 'ol'; itens: string[] };
export type Secao = { tipo: TipoSecao; titulo: string; icone: string; blocos: Bloco[] };
export type TipoSecao = 'compat' | 'funcao' | 'posicao' | 'espec' | 'ident' | 'outro';
export type Medidas = { c?: string; l?: string; a?: string; un?: string; peso?: string };
export type Descricao = { abertura: Bloco[]; secoes: Secao[]; extras: Linha[]; medidas: Medidas | null; estado: { chip: string; texto: Bloco[] } | null };

export const so = (s: string) => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
const tirarTags = (h: string) => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

/** Ícone da linha da ficha pelo rótulo (desenhos em lib/icones.ts, FICHA). */
export function iconeDoRotulo(rotulo: string): string {
  const k = so(rotulo);
  const regras: [RegExp, string][] = [
    [/^codigo|^numero|^partnumber|^referencia/, 'codigo'], [/^serve|^carro|^modelo|^veiculo|^aplicac|^motor|^plataforma|^versao/, 'veiculo'],
    [/^anos?/, 'calendario'], [/^cor/, 'cor'], [/^material|^acabamento|^revestimento/, 'material'],
    [/^posic|^lado|^montagem|^localiz/, 'posicao'], [/^fabricante|^marca/, 'fabrica'], [/^origem|^procedencia/, 'origem'],
    [/^funcao|^sistema|^fixacao|^acionamento|^tipo/, 'funcao'],
  ];
  return regras.find(([r]) => r.test(k))?.[1] ?? 'info';
}

/** "Cor predominante" e "Cor" são o mesmo dado; "Posição/Aplicação" é posição. */
function chaveRotulo(rotulo: string): string {
  const k = so(rotulo);
  if (k.startsWith('cor')) return 'cor';
  if (k.startsWith('posic') || k === 'lado') return 'posicao';
  if (k.startsWith('material')) return 'material';
  if (k.startsWith('codigo')) return 'codigo';
  if (k.startsWith('fabricante')) return 'fabricante';
  return k;
}

// Rótulos da descrição que NÃO viram linha da ficha: já estão no topo/ficha (nome, carro, anos, código) ou vão
// para outro bloco (condição -> "Estado da peça"; medidas -> "Medidas").
const NAO_SOBE = /^(peca|pecas|nome|marca|marcaaplicacao|aplicacao|aplicacaoveicular|anos|anoscompativeis|ano|modelo|modelos|compatibilidade|origemdapeca|condicao|estado)|^(codigo|codigooem|codigooemprincipal|codigooemforjado|codigodefabrica|numerodefabrica|partnumber|codigodefabricapartnumber)$/;
const MEDIDA = /^(comprimento|largura|altura|profundidade|diametro|peso|dimens)/;

function secaoDoTitulo(t: string): { tipo: TipoSecao; titulo: string; icone: string } {
  const k = so(t);
  if (k.startsWith('identifica')) return { tipo: 'ident', titulo: 'Identificação', icone: 'etiqueta' };
  if (k.includes('compatib') || k.startsWith('aplicac') || k.startsWith('veiculos')) return { tipo: 'compat', titulo: 'Compatibilidade', icone: 'veiculo' };
  if (k.startsWith('funcao')) return { tipo: 'funcao', titulo: 'Função da peça', icone: 'funcao' };
  if (k.startsWith('posicao')) return { tipo: 'posicao', titulo: 'Posição no carro', icone: 'posicao' };
  if (k.startsWith('especifica')) return { tipo: 'espec', titulo: 'Especificações', icone: 'regua' };
  if (k.startsWith('condicao') || k.startsWith('estado')) return { tipo: 'outro', titulo: '__estado', icone: 'estado' };
  return { tipo: 'outro', titulo: tirarTags(t), icone: 'info' };
}

/** "15 cm" -> {n: "15", un: "cm"}; "0.6 g" -> {n: "0,6", un: "g"}. */
function numero(v: string): { n: string; un: string; x: number } | null {
  const m = /(\d+(?:[.,]\d+)?)\s*(mm|cm|m|kg|g)\b/i.exec(v);
  if (!m) return null;
  return { n: m[1].replace('.', ','), un: m[2].toLowerCase(), x: Number(m[1].replace(',', '.')) };
}

/** Lê o HTML da descrição em abertura (antes do 1º título) + seções; separa os "Rótulo: valor". */
export function lerDescricao(html: string): Descricao {
  const abertura: Bloco[] = [];
  const secoes: Secao[] = [];
  const extras: Linha[] = [];
  const med: Record<string, string> = {};
  let chip = '';
  let estadoTexto: Bloco[] = [];
  let atual: Secao | null = null;
  for (const m of (html || '').matchAll(/<(h3|p|ul|ol)>([\s\S]*?)<\/\1>/g)) {
    const [, tag, corpo] = m;
    if (tag === 'h3') {
      const s = secaoDoTitulo(corpo);
      atual = { ...s, blocos: [] };
      secoes.push(atual);
      continue;
    }
    const itens = tag === 'p' ? [corpo] : [...corpo.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((x) => x[1]);
    const ficam: string[] = [];
    for (const it of itens) {
      const r = tag !== 'p' ? /^([^:<]{2,40}):\s*(.+)$/s.exec(it) : null;
      if (!r) { ficam.push(it); continue; }
      const [, rot, val] = r;
      const k = so(rot);
      if (k.startsWith('condicao') || k.startsWith('estado')) { chip ||= tirarTags(val).replace(/\.$/, ''); continue; }
      if (MEDIDA.test(k)) { med[k] = tirarTags(val); continue; }
      if (NAO_SOBE.test(k)) continue;           // já está no topo ou na ficha
      if (!extras.some((e) => e.chave === chaveRotulo(rot))) {
        extras.push({ rotulo: tirarTags(rot).trim(), valor: val.trim(), icone: iconeDoRotulo(rot), html: true, chave: chaveRotulo(rot) });
      }
    }
    if (!ficam.length) continue;
    const bloco: Bloco = { tag: tag as Bloco['tag'], itens: ficam };
    if (atual?.titulo === '__estado') estadoTexto.push(bloco);
    else if (atual) atual.blocos.push(bloco);
    else abertura.push(bloco);
  }
  // medidas só quando reais: 2+ das 3 (comprimento, largura, altura) ou "dimensões 30 x 20 x 10 cm"
  let medidas: Medidas | null = null;
  const pega = (pref: string) => Object.entries(med).find(([k]) => k.startsWith(pref))?.[1];
  const [c, l, a] = ['comprimento', 'largura', 'altura'].map((x) => { const v = pega(x); return v ? numero(v) : null; });
  const dim = pega('dimens');
  const tres = dim ? [...dim.matchAll(/(\d+(?:[.,]\d+)?)/g)].map((x) => x[1].replace('.', ',')) : [];
  const unDim = dim ? (/(mm|cm|m)\b/i.exec(dim)?.[1] || 'cm').toLowerCase() : '';
  if ([c, l, a].filter(Boolean).length >= 2) medidas = { c: c?.n, l: l?.n, a: a?.n, un: (c || l || a)!.un };
  else if (tres.length >= 2) medidas = { c: tres[0], l: tres[1], a: tres[2], un: unDim };
  const p = pega('peso');
  // peso: em kg, ou em g a partir de 20 g ("0,6 g" numa peça de motor é erro do anúncio: não mostramos).
  // Faixa ("600-800g") fica faixa e "aprox." vira "≈": nunca um número mais exato que o do anúncio.
  const faixa = p ? /(\d+(?:[.,]\d+)?)\s*(?:-|–|a)\s*(\d+(?:[.,]\d+)?)\s*(kg|g)\b/i.exec(p) : null;
  const pn = p ? numero(p) : null;
  const aprox = p && /aprox|cerca|±|~/i.test(p) ? '≈ ' : '';
  if (faixa) {
    const un = faixa[3].toLowerCase();
    if (un === 'kg' || Number(faixa[1].replace(',', '.')) >= 20) (medidas ??= {}).peso = `${faixa[1].replace('.', ',')} a ${faixa[2].replace('.', ',')} ${un}`;
  } else if (pn && (pn.un === 'kg' || (pn.un === 'g' && pn.x >= 20))) (medidas ??= {}).peso = `${aprox}${pn.n} ${pn.un}`;
  const estado = chip || estadoTexto.length ? { chip, texto: estadoTexto } : null;
  return { abertura, secoes: secoes.filter((s) => s.titulo !== '__estado' && s.blocos.length), extras, medidas, estado };
}

/** Linhas da ficha: código, onde serve, as do ML (sem repetir o carro), e os dados que subiram da descrição. */
export function montarFicha(ficha: [string, string][], serve: string, serveRotulo: string, extras: Linha[], repete: (l: [string, string]) => boolean): Linha[] {
  const ml = ficha.filter((l) => !repete(l));
  const linhas: Linha[] = [];
  const iCod = ml.findIndex(([k]) => k.startsWith('Código'));
  if (iCod >= 0) linhas.push({ rotulo: 'Código gravado', valor: ml[iCod][1], icone: 'codigo', chave: 'codigo' });
  if (serve) linhas.push({ rotulo: serveRotulo, valor: serve, icone: serveRotulo === 'Anos' ? 'calendario' : 'veiculo', chave: 'serve' });
  ml.forEach(([k, v], i) => { if (i !== iCod) linhas.push({ rotulo: k, valor: v, icone: iconeDoRotulo(k), chave: chaveRotulo(k) }); });
  for (const e of extras) if (!linhas.some((l) => l.chave === e.chave)) linhas.push(e);
  return linhas;
}
