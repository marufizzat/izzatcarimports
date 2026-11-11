// Feed do Google Shopping (gratis): cada peca vira um item RSS 2.0 com o namespace g:.
// Funcoes puras (recebem a capa de estudio e o dominio), para os testes rodarem sem o build.
import { foto, type Peca } from './dados';
import { fotosGaleria, classeFoto, type Medida } from './quadroFoto';
import { nomeCompleto } from './nomePeca';

const CONTROLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;
const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Texto puro: tira tags, decodifica entidades, remove caracteres de controle e junta espacos. */
export function limparTexto(s: string): string {
  return (s ?? '')
    .replace(/<br\s*\/?>/gi, '. ')
    .replace(/<\/(p|h[1-6]|li|div)>/gi, '. ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === '#') { const cod = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(cod) && cod > 0 ? String.fromCodePoint(cod) : ' '; }
      return ENTIDADES[e.toLowerCase()] ?? m;
    })
    .replace(CONTROLE, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+\./g, '.')
    .replace(/\.(\s*\.)+/g, '.')
    .trim();
}

// Frases do anuncio do vendedor que nao podem ir para o Google (contato, entrega, parcelamento, prazo).
const SAIR = /frete\s+gr[áa]tis|12\s*x\s*(sem|de|em)|retirada\s+(no|na)\s+(local|loja|p[áa]tio)|lacre|endere[çc]o|hor[áa]rio|whats|wa\.me|https?:|www\.|@|\b9\d{4}-\d{4}\b|\(\d{2}\)\s?\d{4,5}-?\d{4}/i;

/** Descricao do feed: o texto do vendedor limpo (sem as frases proibidas) ou o texto padrao da peca. Ate 5000 caracteres. */
export function descricaoFeed(p: Peca): string {
  const partes = limparTexto(p.desc).split(/(?<=\.)\s+/).filter((f) => f && !SAIR.test(f));
  let texto = partes.join(' ').trim();
  if (texto.length < 40) {
    texto = `${limparTexto(nomeCompleto(p))}. Peça original retirada de carro com baixa legal, conferida e fotografada no pátio da Izzat Car.`
      + (p.oem ? ` Código original: ${limparTexto(p.oem)}.` : '')
      + ' Nota fiscal e 90 dias de garantia.';
  }
  return cortar(texto, 5000);
}

function cortar(s: string, max: number): string {
  if (s.length <= max) return s;
  const corte = s.slice(0, max);
  const ultimo = corte.lastIndexOf(' ');
  return (ultimo > max * 0.8 ? corte.slice(0, ultimo) : corte).trimEnd();
}

/** Titulo do Google: ate 150 caracteres. O nome limpo + carro + anos + codigo (o mesmo do <title> da peca, em
 *  lib/nomePeca.ts), nunca o titulo cru do anuncio do ML ("Volvo Xc 60", "Gm", sem acento). */
export function tituloFeed(p: Peca): string {
  return cortar(limparTexto(nomeCompleto(p)) || `Peça ${p.id}`, 150);
}

export const escXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export type ItemFeed = {
  id: string; title: string; description: string; link: string; imagem: string; extras: string[];
  preco: string; marca: string | null; mpn: string | null; tipo: string;
};

/** Monta os campos do item. capa = capa de estudio (caminho relativo) ou null; site = dominio com https.
 *  limpa = a capa de estudio SEM o logo (public/estudio-limpa/<id>.webp, ESTUDIO_SAIDA_LIMPA) ou null: so entra como
 *  imagem principal quando o anuncio so tem a montagem com o carro (classe "c"), para o Google nao receber o carro do
 *  vendedor como foto do produto. Sem ela, a montagem mesmo (nunca uma imagem inventada).
 *  tabela = as medidas/classes das fotos (os testes passam a sua; o build le src/data/fotos-ml-caixas.json). */
export function itemFeed(p: Peca, capa: string | null, site: string, limpa: string | null = null,
                         tabela?: Record<string, Medida>): ItemFeed | null {
  if (!(p.p > 0)) return null;
  // sem o marketing do vendedor e com o carro inteiro no fim (as mesmas fotos da galeria)
  const chaves = fotosGaleria(p.fotos, tabela);
  const fotosMl = chaves.map((k) => foto(k, 'F'));
  const soMontagem = chaves.length > 0 && chaves.every((k) => classeFoto(k, tabela) === 'c');
  const imagem = capa ? site + capa : soMontagem && limpa ? site + limpa : fotosMl[0];
  if (!imagem) return null;
  const extras = fotosMl.filter((u) => u && u !== imagem).slice(0, 5);
  const mpn = limparTexto((p.oem || '').split(/[\s,;/|]+/)[0] || '');
  return {
    id: p.id,
    title: tituloFeed(p),
    description: descricaoFeed(p),
    link: `${site}/peca/${p.slug}.html`,
    imagem,
    extras,
    preco: `${p.p.toFixed(2)} BRL`,
    marca: limparTexto(p.b || '') || null,
    mpn: mpn || null,
    tipo: [p.c, p.s].map((x) => limparTexto(x || '')).filter(Boolean).join(' > '),
  };
}

/** Item em XML (RSS 2.0 + g:). */
export function xmlItem(i: ItemFeed): string {
  const g = (tag: string, v: string) => `<g:${tag}>${escXml(v)}</g:${tag}>`;
  return [
    '<item>',
    g('id', i.id),
    `<title>${escXml(i.title)}</title>`,
    `<description>${escXml(i.description)}</description>`,
    `<link>${escXml(i.link)}</link>`,
    g('image_link', i.imagem),
    ...i.extras.map((u) => g('additional_image_link', u)),
    g('price', i.preco),
    g('condition', 'used'),
    g('availability', 'in_stock'),
    ...(i.marca ? [g('brand', i.marca)] : []),
    i.mpn ? g('mpn', i.mpn) : g('identifier_exists', 'no'),
    g('google_product_category', '5613'),
    g('product_type', i.tipo),
    '</item>',
  ].join('');
}
