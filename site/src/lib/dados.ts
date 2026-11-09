// Le os dados gerados por ../preparar_dados.py (uma vez por build).
import { readFileSync } from 'node:fs';
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
