// Le os dados gerados por ../preparar_dados.py (uma vez por build).
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export type Peca = {
  id: string; slug: string; t: string; n: string; limpa?: boolean; p: number; fotos: string[]; ml: string;
  f: boolean; b: string; m: string; y: [number, number] | null; c: string; s: string;
  oem: string; o: string; ficha: [string, string][]; desc: string; rel: string[];
};
export type Resumo = {
  updated: string; total: number;
  marcas: { n: string; k: string; c: number; m: { n: string; k: string; c: number }[] }[];
  familias: { n: string; k: string; c: number }[];
  carros: { k: string; b: string; m: string; c: number; anos: [number, number] | null;
            fams: [string, number][]; capas: string[] }[];
  chegou: string[]; preco: { min: number; max: number };
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

// Foto do ML pela chave: tamanho por sufixo (V=320, C=400, O=500, W=568 quadrada, F=cheia)
export type Tam = 'E' | 'V' | 'C' | 'O' | 'W' | 'F';
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
export const WHATS = '5553991170950';
export const SITE = 'https://izzatcarimports.com.br';
export function whatsUrl(texto: string) {
  return `https://wa.me/${WHATS}?text=${encodeURIComponent(texto)}`;
}

// Capa de ESTÚDIO (fundo limpo, gerada por capas_estudio.py) quando existir;
// senão a foto do ML no tamanho pedido.
let _estudio: Set<string> | null = null;
export function temEstudio(id: string): boolean {
  if (!_estudio) {
    const dir = join(process.cwd(), 'public', 'estudio');
    _estudio = new Set(existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5)) : []);
  }
  return _estudio.has(id);
}
export function capa(p: { id: string; fotos: string[] }, tam: Tam = 'O'): string {
  return temEstudio(p.id) ? `/estudio/${p.id}.webp` : foto(p.fotos[0], tam);
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
