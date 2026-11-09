// Ícones do site: UMA fonte para o build (Icone.astro, CartaoPeca.astro) e para o navegador (Catalogo.tsx).
// Desenhos de linha: Lucide (licença ISC). O glifo do WhatsApp é o oficial.
// Os desenhos longos moram no sprite /icones.svg (gerado no build por src/pages/icones.svg.ts, com cache)
// e entram na página com <use>: antes, o mesmo desenho do WhatsApp se repetia 15 vezes em cada página de peça.
// Os curtos continuam no próprio <svg> (o <use> não seria menor).
// Cada <symbol> leva o próprio traço/preenchimento (os mesmos atributos que o <svg> de fora tinha); a cor vem de
// currentColor, que passa para dentro do <use> por herança (tema escuro incluído). O <svg> de fora fica só com
// viewBox e aria-hidden. Nenhum CSS do site muda o traço destes ícones (o "check" mais grosso é desenho curto).
// Sem node:fs aqui: este arquivo roda no build e no navegador.

/** Desenhos de linha (viewBox 0 0 24 24; traço vem do <svg> de fora). */
export const LINHA: Record<string, string> = {
  busca: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  carro: '<path d="M5 17h14M3 13l2-5.5A2 2 0 0 1 6.9 6h10.2a2 2 0 0 1 1.9 1.5L21 13v4a1 1 0 0 1-1 1h-1.5M3 13v4a1 1 0 0 0 1 1h1.5M3 13h18"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/>',
  copiar: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  seta: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  sacola: '<path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
  pino: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>',
  zoom: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M11 8v6M8 11h6"/>',
};

/** Glifo do WhatsApp (preenchido: fill no <svg> de fora). */
export const WHATS_D = 'M19.05 4.91A9.82 9.82 0 0 0 12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01Zm-7.01 15.24c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.26 8.26 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.83c.02 4.54-3.68 8.23-8.23 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43s.17-.25.25-.41c.08-.17.04-.31-.02-.43s-.56-1.34-.76-1.84c-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18s-.22-.16-.47-.28Z';
/** Escudo com visto (Lucide "shield-check"): a linha de confiança do cartão da peça. */
export const GARANTIA_D = 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1zM9 12l2 2 4-4';

const TRACO = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';
/** Atributos e desenho de cada símbolo do sprite (só os desenhos longos). */
const SIMBOLOS: Record<string, [string, string]> = {
  whats: ['fill="currentColor"', `<path d="${WHATS_D}"/>`],
  garantia: [`${TRACO} stroke-width="1.8"`, `<path d="${GARANTIA_D}"/>`],
};
for (const [nome, d] of Object.entries(LINHA)) if (d.length > 100) SIMBOLOS[nome] = [`${TRACO} stroke-width="1.9"`, d];

/** true quando o ícone mora no sprite (desenho longo); false = desenho no próprio <svg>. */
export const noSprite = (nome: string) => nome in SIMBOLOS;

/** O arquivo /icones.svg inteiro. */
export function spriteSvg(): string {
  const s = Object.entries(SIMBOLOS).map(([id, [a, d]]) => `<symbol id="${id}" viewBox="0 0 24 24" ${a}>${d}</symbol>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg">${s}</svg>\n`;
}

// versão pelo conteúdo (FNV-1a): o cache do navegador troca sozinho quando um desenho muda
function versao(t: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}

/** Endereço de um ícone do sprite, para o href do <use>: "/icones.svg?v=abc123#whats". */
export const SPRITE = `/icones.svg?v=${versao(spriteSvg())}`;
export const icone = (nome: string) => `${SPRITE}#${nome}`;
