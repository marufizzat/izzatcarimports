// "Avise-me quando chegar peça para o meu <carro>" (página do carro e Procuro peça): a mensagem do WhatsApp.
// Só fatos, sem prazo e sem promessa. Sem node:fs: roda no build e no navegador. A abertura vem de lib/whats.ts.
import { mensagem, linkWhats } from './whats';

/** "Olá! Vim pelo site da Izzat Car. Tenho um Volvo XC60 2019. Quero ser avisado quando chegar peça dele no pátio."
 *  (ano só se houver) */
export function mensagemAviso(carro: string, ano?: number | string | null): string {
  const a = ano == null ? '' : String(ano).trim();
  return mensagem(`Tenho um ${carro.trim()}${a ? ` ${a}` : ''}. Quero ser avisado quando chegar peça dele no pátio.`);
}

/** Link do WhatsApp com a mensagem (o número é o de lib/whats.ts; o parâmetro fica por compatibilidade). */
export function linkAviso(_numero: string, carro: string, ano?: number | string | null): string {
  return linkWhats(mensagemAviso(carro, ano));
}
