import { describe, expect, it } from 'vitest';
import { estadoDe, novaVisita, podeConvidar, iosQueInstala, pedeDesligar, DIAS_DISPENSA, CHAVE_LISTA, CHAVE_VISTOS, type ContextoConvite } from './app';
import { CHAVE_LISTA as LISTA } from './lista';
import { CHAVE_VISTOS as VISTOS } from './vistos';
import { cascoDe } from '../../integracoes/service-worker.mjs';

const DIA = 24 * 3600 * 1000;
const ctx = (x: Partial<ContextoConvite> = {}): ContextoConvite =>
  ({ agora: 1_800_000_000_000, standalone: false, nLista: 0, nVistos: 0, ocupada: false, jaNestaSessao: false, ...x });

describe('estado do app', () => {
  it('as chaves da lista e dos vistos são as mesmas das libs', () => { expect(CHAVE_LISTA).toBe(LISTA); expect(CHAVE_VISTOS).toBe(VISTOS); });
  it('JSON estragado vira o estado zero', () => {
    expect(estadoDe(null)).toEqual({ v: 0 });
    expect(estadoDe('x')).toEqual({ v: 0 });
    expect(estadoDe({ v: -3, d: 'ontem', i: true })).toEqual({ v: 0 });
    expect(estadoDe({ v: 2.7, d: 5, i: 1 })).toEqual({ v: 2, d: 5, i: 1 });
  });
  it('conta a visita', () => expect(novaVisita({ v: 1, d: 9 })).toEqual({ v: 2, d: 9 }));
});

describe('convite para instalar (raro)', () => {
  it('1ª visita sem nada: não convida', () => expect(podeConvidar({ v: 1 }, ctx())).toBe(false));
  it('2ª visita, peça na lista ou 3 peças abertas: convida', () => {
    expect(podeConvidar({ v: 2 }, ctx())).toBe(true);
    expect(podeConvidar({ v: 1 }, ctx({ nLista: 1 }))).toBe(true);
    expect(podeConvidar({ v: 1 }, ctx({ nVistos: 3 }))).toBe(true);
    expect(podeConvidar({ v: 1 }, ctx({ nVistos: 2 }))).toBe(false);
  });
  it('nunca no app instalado, depois de instalar, na página com barra fixa nem duas vezes na sessão', () => {
    expect(podeConvidar({ v: 5 }, ctx({ standalone: true }))).toBe(false);
    expect(podeConvidar({ v: 5, i: 1 }, ctx())).toBe(false);
    expect(podeConvidar({ v: 5 }, ctx({ ocupada: true }))).toBe(false);
    expect(podeConvidar({ v: 5 }, ctx({ jaNestaSessao: true }))).toBe(false);
  });
  it('dispensado: some por 30 dias e volta depois', () => {
    const agora = ctx().agora;
    expect(podeConvidar({ v: 5, d: agora - (DIAS_DISPENSA - 1) * DIA }, ctx())).toBe(false);
    expect(podeConvidar({ v: 5, d: agora - (DIAS_DISPENSA + 1) * DIA }, ctx())).toBe(true);
  });
});

describe('dica do iPhone', () => {
  const safari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
  it('Safari e Chrome do iPhone, iPad que se diz Mac (com toque)', () => {
    expect(iosQueInstala(safari)).toBe(true);
    expect(iosQueInstala(safari.replace('Version/18.1', 'CriOS/131.0.6778.73'))).toBe(true);
    expect(iosQueInstala('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15', 5)).toBe(true);
  });
  it('Mac de verdade, Android e navegador de dentro do Instagram/Facebook: não', () => {
    expect(iosQueInstala('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15', 0)).toBe(false);
    expect(iosQueInstala('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36')).toBe(false);
    expect(iosQueInstala(safari.replace('Safari/604.1', 'Instagram 361.0.0.35.82'))).toBe(false);
    expect(iosQueInstala(safari + ' [FBAN/FBIOS;FBAV/490.0]')).toBe(false);
  });
});

describe('botão de pânico', () => {
  it('só o "1" desliga', () => {
    expect(pedeDesligar('1')).toBe(true);
    expect(pedeDesligar(' 1\n')).toBe(true);
    expect(pedeDesligar('0')).toBe(false);
    expect(pedeDesligar('')).toBe(false);
    expect(pedeDesligar(null)).toBe(false);
    expect(pedeDesligar('<!doctype html>404')).toBe(false);
  });
});

describe('casco do service worker (integracoes/service-worker.mjs)', () => {
  it('a página sem conexão, o CSS, os scripts com os imports, o logo, o sprite e só a fonte latina', () => {
    const html = '<html><head><link rel="stylesheet" href="/_astro/_k_.a.css"><link rel="stylesheet" href="/_astro/junto.b.css">'
      + '<script type="module" src="/_astro/offline.c.js"></script><script src="/navegar.js" defer></script></head><body>'
      + '<img src="/identidade/logo.png" alt=""><svg><use href="/icones.svg?v=abc#whats"/></svg><a href="/catalogo.html">x</a>'
      + '<img src="https://http2.mlstatic.com/x.jpg"></body></html>';
    const arquivos: Record<string, string> = {
      '/_astro/offline.c.js': 'import{a}from"./lista.d.js";import"./whats.e.js";',
      '/_astro/lista.d.js': 'import{s}from"./whats.e.js";export const a=1;',
      '/_astro/whats.e.js': 'export const s=1;',
      '/_astro/_k_.a.css': '@font-face{src:url(/_astro/archivo-latin-wdth-normal.f.woff2)}@font-face{src:url(/_astro/archivo-latin-ext-wdth-normal.g.woff2)}@font-face{src:url(/_astro/archivo-vietnamese.h.woff2)}',
      '/_astro/junto.b.css': '',
    };
    expect(cascoDe(html, (u: string) => arquivos[u] ?? null)).toEqual([
      '/offline.html', '/_astro/_k_.a.css', '/_astro/archivo-latin-wdth-normal.f.woff2', '/_astro/junto.b.css', '/_astro/lista.d.js',
      '/_astro/offline.c.js', '/_astro/whats.e.js', '/icones.svg?v=abc', '/identidade/logo.png', '/navegar.js',
    ]);
  });
});
