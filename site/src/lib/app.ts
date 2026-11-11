// O app instalável (PWA): quando convidar para instalar e o botão de pânico do service worker. Funções puras (testadas
// em app.test.ts); o navegador fica em components/app/app.ts (registro do SW, convite, links externos no app).
// Estado só no navegador: localStorage['izzatcar.app'] = {"v":3,"d":1762800000000,"i":1}
//   v = visitas (sessões do navegador), d = quando a pessoa dispensou o convite (ms), i = instalou (nunca mais convida)
// O convite é raro: só na 2ª visita, ou depois de pôr peça na lista, ou de abrir 3 peças; nunca no app já instalado,
// nunca na página com barra fixa (peça, lista), uma vez por sessão e, dispensado, só depois de 30 dias.

export const CHAVE_APP = 'izzatcar.app';
export const DIAS_DISPENSA = 30;
export const MIN_VISTOS = 3;
export const MIN_VISITAS = 2;
/** As chaves da lista (lib/lista.ts) e dos vistos (lib/vistos.ts), repetidas aqui de propósito: o módulo do app vai em
 *  toda página e não pode puxar os pedaços daquelas libs (app.test.ts confere que são iguais). */
export const CHAVE_LISTA = 'izzatcar.lista';
export const CHAVE_VISTOS = 'izzatcar.vistos';
/** O arquivo do botão de pânico (public/sw-desligar.txt): "1" desliga o service worker em todo aparelho. */
export const ARQUIVO_DESLIGAR = '/sw-desligar.txt';

export type EstadoApp = { v: number; d?: number; i?: 1 };

const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? x : 0);

/** O estado guardado, conferido campo a campo (JSON velho ou estragado vira o estado zero). */
export function estadoDe(x: unknown): EstadoApp {
  const o = x as Record<string, unknown> | null;
  if (!o || typeof o !== 'object') return { v: 0 };
  const e: EstadoApp = { v: Math.floor(num(o.v)) };
  if (num(o.d)) e.d = num(o.d);
  if (o.i === 1) e.i = 1;
  return e;
}

/** Mais uma visita (uma sessão nova do navegador). */
export const novaVisita = (e: EstadoApp): EstadoApp => ({ ...e, v: e.v + 1 });

export type ContextoConvite = {
  agora: number;
  /** aberto como app (display-mode: standalone ou o navigator.standalone do iPhone) */
  standalone: boolean;
  /** peças na lista de orçamento */
  nLista: number;
  /** peças abertas (vistos) */
  nVistos: number;
  /** a página tem a barra fixa de baixo (peça, lista) ou é a página sem conexão: o convite não cabe */
  ocupada: boolean;
  /** o convite já apareceu nesta sessão */
  jaNestaSessao: boolean;
};

/** Convidar agora? */
export function podeConvidar(e: EstadoApp, c: ContextoConvite): boolean {
  if (c.standalone || e.i || c.ocupada || c.jaNestaSessao) return false;
  if (e.d && c.agora - e.d < DIAS_DISPENSA * 24 * 3600 * 1000) return false;
  return e.v >= MIN_VISITAS || c.nLista >= 1 || c.nVistos >= MIN_VISTOS;
}

/** iPhone/iPad num navegador que sabe "Adicionar à Tela de Início" (Safari; Chrome, Firefox e Edge desde o iOS 16.4).
 *  Navegador de dentro de app (Instagram, Facebook, Google, TikTok...) não sabe: sem dica. iPad novo se diz "Macintosh"
 *  (com toque). */
export function iosQueInstala(ua: string, toques = 0): boolean {
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && toques > 1);
  if (!ios || !/AppleWebKit/.test(ua)) return false;
  if (/FBAN|FBAV|FB_IAB|Instagram|Line\/|GSA\/|Snapchat|musical_ly|Bytedance|TikTok|Twitter|LinkedInApp|Pinterest/i.test(ua)) return false;
  return /Safari\//.test(ua) || /CriOS|FxiOS|EdgiOS/.test(ua);
}

/** O botão de pânico: só o "1" (com espaço ou quebra de linha em volta) desliga; arquivo vazio, "0" ou a 404 não. */
export const pedeDesligar = (texto: string | null | undefined): boolean => (texto ?? '').trim() === '1';
