// Regras do cartão da peça, as MESMAS no build (CartaoPeca.astro) e no navegador (Catalogo.tsx).
// Sem node:fs: este arquivo roda nos dois lados.
import { atributosModelos } from '../../lib/meuCarro';

/** INTERRUPTOR DA VITRINE (um só, vale para o site inteiro):
 *  true  = B "vitrine clara": o cartão da peça é sempre claro (tema de estúdio), também no modo escuro;
 *          a foto de estúdio e os dados viram um objeto só, iluminado. Filtros e páginas seguem o tema do aparelho.
 *  false = A "vitrine escura": o cartão segue o tema do aparelho (escuro no modo escuro, com a placa clara da foto). */
export const VITRINE_CLARA = true;
/** Classe da caixa do cartão (CartaoPeca.astro e Etiqueta do catálogo usam a mesma). */
export const CLASSE_CARTAO = VITRINE_CLARA ? 'etiqueta-cx tema-estudio' : 'etiqueta-cx';

export const SITE = 'https://izzatcarimports.com.br';
export const WHATS = '5553991170950';
/** Quantas peças mais novas levam o selo "Chegou agora" (o mesmo número de resumo().chegou). */
export const QTD_CHEGOU = 24;

export const brl = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "311,64" -> ["311", "64"] (reais e centavos separados para o desenho do preço). */
export function precoPartes(v: number): [string, string] {
  const [r, c = '00'] = brl(v).split(',');
  return [r, c];
}

/** Carro e anos da peça: { carro: "Volvo XC60", anos: "2018–2024" }. Peça de 2+ carros (ms): "Volvo S60 / XC60". */
export function linhaCarro(b?: string | null, m?: string | null, y?: [number, number] | null, ms?: string[] | null) {
  const carro = [b, ms && ms.length > 1 ? ms.join(' / ') : m].filter(Boolean).join(' ');
  const anos = y ? (y[0] === y[1] ? String(y[0]) : `${y[0]}–${y[1]}`) : '';
  return { carro, anos };
}

/** Código gravado (OEM) do campo normalizado "o": o primeiro que parece código de verdade
 *  (tem número e 5+ caracteres). Alguns anúncios trazem texto no campo; esses ficam sem código. */
export function codigoPeca(o?: string | null): string {
  const t = (o || '').split(/[\s,;/|]+/).find((x) => x.length >= 5 && x.length <= 24 && /\d/.test(x));
  return t ? t.toUpperCase() : '';
}

/** Mesma mensagem do botão da página da peça. */
export function msgWhats(titulo: string, preco: number, url: string) {
  return `Olá! Vi no site esta peça:\n\n${titulo}\nR$ ${brl(preco)}\n${url}\n\nServe e ainda tem?`;
}
export function linkWhats(texto: string) {
  return `https://wa.me/${WHATS}?text=${encodeURIComponent(texto)}`;
}
export function urlPeca(slug: string, base = '/peca/') {
  return `${SITE}${base}${slug}.html`;
}

/** Os ids do ML crescem com o anúncio: os maiores são os que chegaram agora. */
export function idsMaisNovos(ids: string[], n = QTD_CHEGOU): Set<string> {
  const ord = [...ids].sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0));
  return new Set(ord.slice(-n));
}

/** Atributos que a equipe "Meu carro" lê no cartão (data-a0/data-a1 no script do build, data-y no catálogo).
 *  Peça de 2+ carros: data-ms="S60|XC60" e, quando a faixa muda de um carro para outro, data-ys. */
export function dadosCarro(b?: string | null, m?: string | null, y?: [number, number] | null,
                           ms?: string[] | null, ys?: ([number, number] | null)[] | null) {
  return {
    'data-b': b || undefined,
    'data-m': m || undefined,
    'data-a0': y ? y[0] : undefined,
    'data-a1': y ? y[1] : undefined,
    'data-y': y ? `${y[0]}-${y[1]}` : undefined,
    ...atributosModelos(ms, ys),
  };
}

/** Glifo do WhatsApp (o mesmo de Icone.astro). */
export const ICONE_WHATS = 'M19.05 4.91A9.82 9.82 0 0 0 12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01Zm-7.01 15.24c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.26 8.26 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.83c.02 4.54-3.68 8.23-8.23 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43s.17-.25.25-.41c.08-.17.04-.31-.02-.43s-.56-1.34-.76-1.84c-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18s-.22-.16-.47-.28Z';
/** Escudo com visto (desenho Lucide "shield-check", licença ISC): a linha de confiança do cartão. */
export const ICONE_GARANTIA = 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1zM9 12l2 2 4-4';
