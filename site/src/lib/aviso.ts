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

// ---- Raio-x do carro (components/v2/RaioX.astro): uma PARTE do carro ("da frente", "do motor": Zona.de em lib/raioX.ts)

/** "Tenho um Volvo XC60 2019. Quero ser avisado quando chegar peça do teto dele no pátio." (zona sem peça do carro) */
export function mensagemAvisoParte(carro: string, ano: number | string | null | undefined, parte: string): string {
  const a = ano == null ? '' : String(ano).trim();
  return mensagem(`Tenho um ${carro.trim()}${a ? ` ${a}` : ''}. Quero ser avisado quando chegar peça ${parte} dele no pátio.`);
}
export const linkAvisoParte = (carro: string, ano: number | string | null | undefined, parte: string) => linkWhats(mensagemAvisoParte(carro, ano, parte));

/** "Não achou? A gente procura no pátio" do painel: o carro salvo ("do meu Volvo XC60 2019"), o da página do carro
 *  (`meu` = false: "para Volvo XC60 ano ____") ou, sem carro, o pedido do modelo e do ano. */
export function mensagemProcuraParte(carro: string, parte: string, meu = true): string {
  const c = carro.trim();
  if (!c) return mensagem(`Procuro uma peça ${parte} do meu carro. Meu carro é ____ (modelo e ano) e a peça é: ____`);
  return mensagem(meu ? `Procuro uma peça ${parte} do meu ${c}: ____` : `Procuro uma peça ${parte} para ${c} ano ____: ____`);
}
export const linkProcuraParte = (carro: string, parte: string, meu = true) => linkWhats(mensagemProcuraParte(carro, parte, meu));
