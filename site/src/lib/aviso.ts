// "Avise-me quando chegar peça para o meu <carro>" (página do carro e Procuro peça): a mensagem do WhatsApp.
// Só fatos, sem prazo e sem promessa. Sem node:fs: roda no build e no navegador.

/** "Olá! Tenho um Volvo XC60 2019. Quero ser avisado quando chegar peça dele no pátio." (ano só se houver) */
export function mensagemAviso(carro: string, ano?: number | string | null): string {
  const a = ano == null ? '' : String(ano).trim();
  return `Olá! Tenho um ${carro.trim()}${a ? ` ${a}` : ''}. Quero ser avisado quando chegar peça dele no pátio.`;
}

/** Link do WhatsApp com a mensagem (o mesmo formato de whatsUrl em lib/dados.ts). */
export function linkAviso(numero: string, carro: string, ano?: number | string | null): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagemAviso(carro, ano))}`;
}
