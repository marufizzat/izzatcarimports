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

/** Desconto de quem pede pelo WhatsApp (pedido do dono, 09/11): o selo junto do botão da peça e a frase da mensagem. */
export const DESCONTO_WHATS = 10;
export const FRASE_DESCONTO = `Vi que tem ${DESCONTO_WHATS}% de desconto pedindo por aqui.`;

/** "Pedir no WhatsApp" (página da peça, cartão do build e do catálogo, barra fixa): a MESMA mensagem em todo lugar.
 *  `meuCarro` = "Meu carro é Volvo XC60 2019. " (o carro salvo) ou o convite com lacuna ("… ano ____. "). */
export function cabecaPeca(x: PecaMsg): string {
  return `${mensagem(`Tenho interesse nesta peça:\n\n${blocoPeca(x)}`)}\n\n${FRASE_DESCONTO}\n`;
}
export const CAUDA_PECA = 'Serve e ainda tem?';
export function mensagemPeca(x: PecaMsg, meuCarro = ''): string {
  return cabecaPeca(x) + meuCarro + CAUDA_PECA;
}

/** Anos para a mensagem: "2018 a 2024" (ou "2019"). */
export function anosTexto(y?: [number, number] | null): string {
  return y ? (y[0] === y[1] ? String(y[0]) : `${y[0]} a ${y[1]}`) : '';
}
