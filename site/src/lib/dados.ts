// Le os dados gerados por ../preparar_dados.py (uma vez por build).
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fotosGaleria } from './quadroFoto';

export type Peca = {
  id: string; slug: string; t: string; n: string; limpa?: boolean; p: number; fotos: string[]; ml: string;
  f: boolean; b: string; m: string; y: [number, number] | null; c: string; s: string;
  oem: string; o: string; ficha: [string, string][]; desc: string; rel: string[];
  /** Unidades em estoque no ML ("available"). Ausente = sem o dado: a página não fala de estoque. */
  q?: number;
  /** Peça que serve em 2+ carros da marca ("Volvo S60 Xc60" no título): ["S60", "XC60"], o 1º é o m.
   *  Ela aparece na página, no filtro e no Meu carro de cada um (lib/meuCarro.ts: modelosDa). */
  ms?: string[];
  /** Anos de cada carro do ms, quando a faixa muda de um para outro (o período de venda corta). */
  ys?: [number, number][];
  /** Dia da última mudança do anúncio no ML (AAAA-MM-DD): o <lastmod> da peça no sitemap. */
  u?: string;
};
export type Resumo = {
  updated: string; total: number;
  marcas: { n: string; k: string; c: number; m: { n: string; k: string; c: number }[] }[];
  /** Blocos (o jeito que o cliente procura, preparar_dados.py: BLOCOS), na ordem da grade; "Outros" (k "outros") no fim. */
  familias: { n: string; k: string; c: number }[];
  /** Endereço antigo (família do ML que o Google conhece) -> bloco: /categoria/<k>.html redireciona para <para>. */
  antigas?: { k: string; n: string; para: string }[];
  carros: { k: string; b: string; m: string; c: number; anos: [number, number] | null;
            fams: [string, number][]; capas: string[] }[];
  chegou: string[]; preco: { min: number; max: number };
  /** Reputacao do Mercado Livre (reputation.json). Ausente = nao mostrar o selo. */
  reputacao?: { nivel: string; n: number; lider?: string; vendas?: number };
};

const DIR = join(process.cwd(), 'src', 'data');
let _pecas: Peca[] | null = null;
let _porId: Map<string, Peca> | null = null;
let _resumo: Resumo | null = null;

export function pecas(): Peca[] {
  if (!_pecas) _pecas = JSON.parse(readFileSync(join(DIR, 'pecas.json'), 'utf-8'));
  return _pecas!;
}
export function pecaPorId(id: string): Peca | undefined {
  if (!_porId) _porId = new Map(pecas().map((p) => [p.id, p]));
  return _porId.get(id);
}
export function resumo(): Resumo {
  if (!_resumo) _resumo = JSON.parse(readFileSync(join(DIR, 'resumo.json'), 'utf-8'));
  return _resumo!;
}

/** Marcas que o site mostra para escolher (abertura, caixa "Meu carro" e nuvem de marcas): 5+ peças.
 *  UMA fonte para o número de marcas em todo lugar ("Ver todas as N marcas" = N cartões na nuvem). */
export const MARCA_MIN_PECAS = 5;
export function marcasVisiveis(): Resumo['marcas'] {
  return resumo().marcas.filter((m) => m.c >= MARCA_MIN_PECAS);
}

// Foto do ML pela chave: tamanho por sufixo (V=320, C=400, O=500, W=568 quadrada, F=cheia). E (280) e as outras
// quadradas o ML às vezes recorta ou completa com faixa branca; A (até 228 px) e O/F guardam a foto inteira, na
// proporção dela (a miniatura da galeria usa A: o mesmo quadro do palco, lib/quadroFoto.ts).
export type Tam = 'A' | 'E' | 'V' | 'C' | 'O' | 'W' | 'F';
export function foto(chave: string, tam: Tam = 'O'): string {
  if (!chave) return '';
  if (chave.startsWith('http')) return chave;
  return `https://http2.mlstatic.com/D_${chave}-${tam}.webp`;
}
export function fotoSrcset(chave: string): string {
  if (!chave || chave.startsWith('http')) return '';
  return `${foto(chave, 'V')} 320w, ${foto(chave, 'C')} 400w, ${foto(chave, 'O')} 500w, ${foto(chave, 'F')} 1000w`;
}

export const brl = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const SITE = 'https://izzatcarimports.com.br';
// WhatsApp: número, abertura única e links em lib/whats.ts (whatsUrl recebe SÓ o contexto da mensagem)
export { WHATS, whatsUrl } from './whats';

// Capa de ESTÚDIO quando existir; senão a foto do ML no tamanho pedido.
// public/estudio-pro/<id>.webp = foto maquiada no ChatGPT e conferida (peças em destaque) — tem preferência;
// public/estudio/<id>.webp = capa automática (capas_estudio.py), todas as peças.
const _dirs: Record<string, Set<string>> = {};
function arquivos(pasta: string): Set<string> {
  if (!_dirs[pasta]) {
    const dir = join(process.cwd(), 'public', pasta);
    _dirs[pasta] = new Set(existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5)) : []);
  }
  return _dirs[pasta];
}
export function capaEstudio(id: string): string | null {
  if (arquivos('estudio-pro').has(id)) return `/estudio-pro/${id}.webp`;
  if (arquivos('estudio').has(id)) return `/estudio/${id}.webp`;
  return null;
}
/** Capa de estudio SEM o logo (capas_estudio.py com ESTUDIO_SAIDA_LIMPA, posta em public/estudio-limpa/ por
 *  ferramentas/capas_limpas_feed.py): so o feed do Google usa, e so na peca que nao tem outra foto alem da montagem. */
export function capaLimpa(id: string): string | null {
  return arquivos('estudio-limpa').has(id) ? `/estudio-limpa/${id}.webp` : null;
}
export function temEstudio(id: string): boolean {
  return capaEstudio(id) !== null;
}
export function capa(p: { id: string; fotos: string[] }, tam: Tam = 'O'): string {
  return capaEstudio(p.id) ?? foto(fotosGaleria(p.fotos)[0], tam);
}
export function logoMarca(k: string): string | null {
  for (const ext of ['svg', 'png']) if (existsSync(join(process.cwd(), 'public', 'marcas', `${k}.${ext}`))) return `/marcas/${k}.${ext}`;
  return null;
}
/** Logo + tamanho de exibição dentro de uma caixa (mantém a proporção real: logo largo fica largo). */
export function logoInfo(k: string, caixaL = 54, caixaA = 30): { src: string; w: number; h: number; png: boolean } | null {
  const src = logoMarca(k);
  if (!src) return null;
  const arq = readFileSync(join(process.cwd(), 'public', src));
  let rw = 1, rh = 1;
  if (src.endsWith('.svg')) {
    const vb = /viewBox="([^"]+)"/.exec(arq.toString('utf8'))?.[1].trim().split(/[\s,]+/).map(Number);
    if (vb && vb.length === 4) { rw = vb[2]; rh = vb[3]; }
  } else { rw = arq.readUInt32BE(16); rh = arq.readUInt32BE(20); }
  const esc = Math.min(caixaL / rw, caixaA / rh);
  return { src, w: Math.round(rw * esc), h: Math.round(rh * esc), png: src.endsWith('.png') };
}

/** "Código gravado" com cara de código de verdade: 5+ caracteres com letra e número, ou 6+ dígitos
 *  (só números, podendo ter traço ou ponto no meio, como "6940294-01"; lista de anos não conta).
 *  Lixo da extração ("Par", "Fiat", "2019", "60629") some da página em vez de virar um código para copiar. */
export function codigoValido(c: string | null | undefined): boolean {
  const s = (c || '').trim();
  if (/^[\d.-]+$/.test(s)) {
    if (/^((19|20)\d{2}[-.]?)+$/.test(s)) return false;
    if (/^(\d{1,3})\1+\d?$/.test(s.replace(/[.-]/g, ''))) return false; // enchimento: "101010101", "777777"
    return (s.match(/\d/g) || []).length >= 6;
  }
  return s.length >= 5 && /[a-z]/i.test(s) && /\d/.test(s);
}
/** 1º código do campo OEM, em maiúsculas, só se for válido; senão ''. */
export function codigoDaPeca(oem: string | null | undefined): string {
  const c = (oem || '').trim().split(/[\s,;/|]+/)[0] || '';
  return codigoValido(c) ? c.toUpperCase() : '';
}
