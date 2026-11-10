// Mensagens do WhatsApp: UMA abertura para o site inteiro ("Olá! Vim pelo site da Izzat Car.") e, depois dela,
// o contexto de quem chama (a peça, o carro, a garantia...). Quem monta mensagem passa SÓ o contexto; a abertura
// nunca é escrita à mão em outro arquivo (o teste whats.test.ts confere). Sem node:fs: roda no build e no navegador.

export const WHATS = '5553991170950';
export const ABERTURA = 'Olá! Vim pelo site da Izzat Car.';

/** "Olá! Vim pelo site da Izzat Car." + o contexto (na mesma linha; contexto que começa com quebra de linha
 *  fica em bloco: a peça, o formulário). Sem contexto: só a abertura. */
export function mensagem(contexto = ''): string {
  const c = contexto.replace(/^[ \t]+/, '');
  if (!c.trim()) return ABERTURA;
  return c.startsWith('\n') ? ABERTURA + c : `${ABERTURA} ${c}`;
}

/** Link do WhatsApp com um texto JÁ pronto (o de mensagem() ou o de mensagemPeca(), refeito no navegador). */
export function linkWhats(texto: string): string {
  return `https://wa.me/${WHATS}?text=${encodeURIComponent(texto)}`;
}

/** Link do WhatsApp com a abertura + o contexto. */
export function whatsUrl(contexto = ''): string {
  return linkWhats(mensagem(contexto));
}

/** A peça na mensagem: o nome limpo (nunca o título cru do anúncio), o carro e os anos, o código gravado, o preço
 *  e o link (que leva o MLB: o vendedor acha o anúncio). Linhas vazias saem.
 *  `linha` pronta (no build: nomeMensagem de lib/nomePeca.ts) tem preferência; senão ela é montada aqui, igual. */
export type PecaMsg = { nome?: string; carro?: string; anos?: string; cod?: string; linha?: string; preco?: string; url: string };
/** "Farol direito · Chevrolet Cruze 2017 a 2021 · Cód. E131464301" (a mesma linha de nomeMensagem, lib/nomePeca.ts). */
export function linhaPeca({ nome = '', carro = '', anos = '', cod = '' }: Omit<PecaMsg, 'url'>): string {
  return [nome, [carro, anos].filter(Boolean).join(' '), cod && `Cód. ${cod}`].filter(Boolean).join(' · ');
}
export function blocoPeca(x: PecaMsg): string {
  return [x.linha || linhaPeca(x), x.preco && `R$ ${x.preco}`, x.url].filter(Boolean).join('\n');
}

/** Desconto de quem pede pelo WhatsApp: 10% em TODA peça (decisão do dono, 10/11). O preço cheio é o do anúncio (o do
 *  Mercado Livre); o do WhatsApp é sempre calculado dele, nunca escrito à mão nem desenhado em arte. */
export const DESCONTO_WHATS = 10;
/** O preço de quem pede pelo WhatsApp, em centavos inteiros (244,64 -> 220,18). */
export function precoWhats(v: number): number {
  return Math.round(v * (100 - DESCONTO_WHATS)) / 100;
}
const paraNumero = (s: string) => Number(s.replace(/\./g, '').replace(',', '.'));
const paraBrl = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** "3.785,77" -> "3.407,19" ('' quando o preço não é um número). */
export function precoWhatsTxt(preco: string): string {
  const v = paraNumero(preco);
  return Number.isFinite(v) && v > 0 ? paraBrl(precoWhats(v)) : '';
}

/** "Pedir no WhatsApp" (página da peça, cartões, barra fixa): a MESMA mensagem em todo lugar, em forma de pedido, para
 *  quem atende receber tudo organizado (o negrito é o do próprio WhatsApp: *texto*; sem emoji):
 *
 *    Olá! Vim pelo site da Izzat Car.
 *
 *    *PEDIDO DE PEÇA*
 *    *Farol direito*
 *    Chevrolet Cruze · 2017 a 2021
 *    Código: E131464301
 *    Anúncio: MLB6631863638
 *
 *    Preço no site: R$ 244,64
 *    *No WhatsApp (10% de desconto): R$ 220,18*
 *
 *    Meu carro: Volvo XC60 2019
 *    Serve e ainda tem?
 *
 *    https://izzatcarimports.com.br/peca/...
 *
 *  A página da peça leva a mensagem em 3 pedaços (cabeça + a linha do carro, que o script troca pelo carro salvo +
 *  cauda): o link só aparece na cauda e a ficha só na cabeça (nada repetido no HTML). */
const TITULO_PEDIDO = '*PEDIDO DE PEÇA*';
/** A peça em linhas: o nome em negrito, o carro e os anos, o código gravado e o número do anúncio (tirado do link). */
export function fichaPeca(x: PecaMsg): string {
  const mlb = /MLB\d+/.exec(x.url)?.[0];
  const carro = [x.carro, x.anos].filter(Boolean).join(' · ');
  return [x.nome ? `*${x.nome}*` : x.linha, x.nome && carro, x.nome && x.cod && `Código: ${x.cod}`, mlb && `Anúncio: ${mlb}`].filter(Boolean).join('\n');
}
/** "Preço no site: R$ 244,64" + a linha do WhatsApp em negrito. */
export function precosPeca(preco?: string): string {
  if (!preco) return '';
  const w = precoWhatsTxt(preco);
  return `Preço no site: R$ ${preco}${w ? `\n*No WhatsApp (${DESCONTO_WHATS}% de desconto): R$ ${w}*` : ''}`;
}
export function cabecaPeca(x: PecaMsg): string {
  const precos = precosPeca(x.preco);
  return `${mensagem(`\n\n${TITULO_PEDIDO}\n${fichaPeca(x)}`)}\n\n${precos ? `${precos}\n\n` : ''}`;
}
/** A ficha da peça de volta, a partir da cabeça pronta (o data-cabeca do botão "Pedir no WhatsApp"): a página da peça
 *  não leva a ficha duas vezes no HTML. '' quando não é uma cabeça de peça. */
export function blocoDaCabeca(cabeca: string): string {
  const i = cabeca.indexOf(`${TITULO_PEDIDO}\n`);
  if (i < 0) return '';
  const resto = cabeca.slice(i + TITULO_PEDIDO.length + 1);
  const fim = resto.indexOf('\n\n');
  return (fim < 0 ? resto : resto.slice(0, fim)).trim();
}
export const CAUDA_PECA = 'Serve e ainda tem?';
/** A pergunta e, por último, o link (é dele que o WhatsApp tira a prévia com a foto). */
export function caudaPeca(url: string): string {
  return `${CAUDA_PECA}\n\n${url}`;
}
/** O link de volta, a partir da cauda pronta (o data-cauda do botão). */
export function urlDaCauda(cauda: string): string {
  return /https?:\/\/\S+$/.exec(cauda.trim())?.[0] ?? '';
}
/** "Meu carro: Volvo XC60 2019" (o carro salvo, ou o convite com a lacuna: "Chevrolet Cruze, ano ____"). */
export function linhaMeuCarro(carro: string): string {
  return carro ? `Meu carro: ${carro}\n` : '';
}
export function mensagemPeca(x: PecaMsg, meuCarro = ''): string {
  return cabecaPeca(x) + meuCarro + caudaPeca(x.url);
}

/** Anos para a mensagem: "2018 a 2024" (ou "2019"). */
export function anosTexto(y?: [number, number] | null): string {
  return y ? (y[0] === y[1] ? String(y[0]) : `${y[0]} a ${y[1]}`) : '';
}

/** Cotar o frete pelo CEP (lib/cep.ts): com a ficha da peça e o link (página da peça) ou a peça que a pessoa escreveu
 *  (/envios.html). Sem prazo nem valor: a gente responde com o frete. */
export function mensagemFrete(cep: string, o: { bloco?: string; url?: string; peca?: string } = {}): string {
  if (o.bloco) return mensagem(`\n\n*COTAÇÃO DE FRETE*\nCEP: ${cep}\n\n${o.bloco}${o.url ? `\n\n${o.url}` : ''}`);
  return mensagem(`Quero saber o frete para o CEP ${cep}. A peça é: ${o.peca || '____'}`);
}

/** Abre o WhatsApp como o clique num link de verdade, noutra aba (o rastreio.js conta o contato_whatsapp com o
 *  data-botao). Só no navegador e dentro do gesto da pessoa (clique ou Enter), depois de conferir o que ela digitou. */
export function abrirWhats(url: string, botao: string) {
  const a = Object.assign(document.createElement('a'), { href: url, target: '_blank', rel: 'noopener' });
  a.dataset.botao = botao;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
