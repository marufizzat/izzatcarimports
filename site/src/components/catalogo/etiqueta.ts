// Regras do cartão da peça, as MESMAS no build (CartaoPeca.astro) e no navegador (Catalogo.tsx).
// Sem node:fs: este arquivo roda nos dois lados.
import { atributosModelos, nomeModelos } from '../../lib/meuCarro';
import { mensagemPeca, anosTexto, precoWhats, DESCONTO_WHATS } from '../../lib/whats';

/** INTERRUPTOR DA VITRINE (um só, vale para o site inteiro):
 *  true  = B "vitrine clara": o cartão da peça é sempre claro (tema de estúdio), também no modo escuro;
 *          a foto de estúdio e os dados viram um objeto só, iluminado. Filtros e páginas seguem o tema do aparelho.
 *  false = A "vitrine escura": o cartão segue o tema do aparelho (escuro no modo escuro, com a placa clara da foto). */
export const VITRINE_CLARA = true;
/** Classe da caixa do cartão (CartaoPeca.astro e Etiqueta do catálogo usam a mesma). */
export const CLASSE_CARTAO = VITRINE_CLARA ? 'etiqueta-cx tema-estudio' : 'etiqueta-cx';

export const SITE = 'https://izzatcarimports.com.br';
// número e links do WhatsApp: um lugar só (lib/whats.ts)
export { WHATS, linkWhats } from '../../lib/whats';
/** Quantas peças mais novas levam o selo "Chegou agora" (o mesmo número de resumo().chegou). */
export const QTD_CHEGOU = 24;

export const brl = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "311,64" -> ["311", "64"] (reais e centavos separados para o desenho do preço). */
export function precoPartes(v: number): [string, string] {
  const [r, c = '00'] = brl(v).split(',');
  return [r, c];
}

/** O preço do cartão (decisão do dono, 11/11): o do WHATSAPP em destaque (10% de desconto, lib/whats.ts: precoWhats, em
 *  centavos inteiros) e o do anúncio (o cheio, o do Mercado Livre) riscado em cima. `sr` = o que o leitor de tela lê; os
 *  scripts do cartão tiram dele o preço CHEIO (precoCheioDoTexto): a lista e a mensagem do WhatsApp partem do cheio. */
export function precoCartao(v: number) {
  const de = brl(v);
  const [reais, cent] = precoPartes(precoWhats(v));
  return { de, reais, cent, sr: `de R$ ${de} por R$ ${reais},${cent} no WhatsApp` };
}
/** O selo verde colado ao preço grande: diz de onde vem o desconto ("−10% no WhatsApp"). */
export const SELO_WHATS = `−${DESCONTO_WHATS}% no WhatsApp`;
/** "de R$ 7.680,00 por R$ 6.912,00 no WhatsApp" -> "7.680,00" (o 1º valor é o cheio; cartão antigo "R$ 7.680,00": igual). */
export function precoCheioDoTexto(s: string | null | undefined): string {
  return /R\$\s*([\d.]+,\d{2})/.exec(s || '')?.[1] ?? '';
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

/** "Pedir no WhatsApp" do cartão: a MESMA mensagem do botão da página da peça (lib/whats.ts: nome limpo, carro, anos,
 *  código, preço e link; nunca o título cru do anúncio). */
export function msgWhats(x: { n: string; b?: string | null; m?: string | null; y?: [number, number] | null; ms?: string[] | null;
                              o?: string | null; p: number }, url: string) {
  return mensagemPeca({ nome: x.n, carro: nomeModelos({ b: x.b || '', m: x.m || '', ms: x.ms || undefined }), anos: anosTexto(x.y), cod: codigoPeca(x.o), preco: brl(x.p), url });
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

/** Ícones do cartão: o desenho mora no sprite /icones.svg (src/lib/icones.ts); o cartão usa <use href={icone(...)}>. */
export { icone, WHATS_D as ICONE_WHATS, GARANTIA_D as ICONE_GARANTIA } from '../../lib/icones';
