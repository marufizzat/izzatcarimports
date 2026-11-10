// Nome da peça para FORA da página (título da aba, JSON-LD Product, mensagem do WhatsApp, feed do Google): o nome
// limpo + o(s) carro(s) + os anos + o código. Nunca o título cru do anúncio do ML ("Modulo Sensor Combustivel Vw
// Virtus Polo Up 18/24 06k907811", "Volvo Xc 60", "Gm"): esse fica só na nota de rodapé da ficha (AbasDetalhes).
// Auditoria 3, itens 4.2 e 9.2. Só no build (puxa lib/dados.ts).
import { codigoDaPeca, type Peca } from './dados';
import { nomeModelos } from './meuCarro';

type PecaNome = Pick<Peca, 'n' | 'b' | 'm' | 'y' | 'oem' | 'ms'>;

/** "2018–2024" (ou "2018 a 2024" com sep ' a '); um ano só quando a faixa é de um ano. */
export function anosDaPeca(y: Peca['y'], sep = '–'): string {
  return y ? (y[0] === y[1] ? String(y[0]) : `${y[0]}${sep}${y[1]}`) : '';
}

/** "Farol direito Chevrolet Cruze 2017–2021 E131464301": o mesmo do <title> da página da peça.
 *  anos = separador dos anos; cod = rótulo antes do código ("Cód. "); sep = entre as partes. */
export function nomeCompleto(p: PecaNome, o: { anos?: string; cod?: string; sep?: string } = {}): string {
  const cod = codigoDaPeca(p.oem);
  return [p.n, nomeModelos(p), anosDaPeca(p.y, o.anos ?? '–'), cod ? `${o.cod ?? ''}${cod}` : '']
    .filter(Boolean).join(o.sep ?? ' ');
}

/** Linha da peça na mensagem do WhatsApp: "Farol direito · Chevrolet Cruze 2017 a 2021 · Cód. E131464301". */
export function nomeMensagem(p: PecaNome): string {
  const carro = [nomeModelos(p), anosDaPeca(p.y, ' a ')].filter(Boolean).join(' ');
  const cod = codigoDaPeca(p.oem);
  return [p.n, carro, cod ? `Cód. ${cod}` : ''].filter(Boolean).join(' · ');
}
