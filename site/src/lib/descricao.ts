// Descrição (meta description e prévia do link) com até 160 caracteres: o Google corta o resto (auditoria 4, 9.1).
// A frase mais completa que couber; nunca o título cru do anúncio. A regra de caber fica em lib/textos.ts (pura).
import { gruposModelos, nomeModelos, nomeModelosVersoes, nomeSoVersoes } from './meuCarro';
import { anosDaPeca } from './nomePeca';
import { caber, encurtar, DESCRICAO_MAX } from './textos';
export { caber, encurtar, DESCRICAO_MAX };

type PecaDescricao = { n: string; b?: string | null; m?: string | null; ms?: string[] | null; y?: [number, number] | null; p: number };

/** "Farol direito original do Chevrolet Cruze, 2017 a 2021, código E131464301. Peça usada, de carro com baixa legal
 *  no Detran-RS. R$ 1.200,00, nota fiscal e 90 dias de garantia." — e versões mais curtas quando não cabe.
 *  `codigo` e `preco` já prontos (codigoDaPeca e brl de lib/dados.ts). */
export function descricaoPeca(p: PecaDescricao, codigo: string, preco: string): string {
  // é o texto do Google: o carro unido leva as versões do anúncio ("Mercedes-Benz Classe C (C180, C200)")
  const frase = (carros: string, cod: string) =>
    `${p.n} original${carros ? ` ${p.m ? 'do' : 'de'} ${carros}` : ''}${anos ? `, ${anos}` : ''}${cod ? `, código ${cod}` : ''}`;
  const anos = anosDaPeca(p.y ?? null, ' a ');
  const carros = nomeModelosVersoes(p);
  const comCod = frase(carros, codigo);
  const semCod = frase(carros, '');
  const fim = `R$ ${preco}, nota fiscal e 90 dias de garantia.`;
  // carro unido com código: quando "Classe C (C320)" não cabe, o código fica e o carro encurta: a forma do anúncio
  // ("Mercedes-Benz C320", a descrição de antes da união) e depois o principal sozinho. Peça sem carro unido: como antes.
  // Peça de 2+ carros ("Classe C (C180, C200, C320) e C250"): primeiro os carros todos sem as versões ("Classe C e C250":
  // nenhum carro some), só depois a forma do anúncio.
  const so = nomeSoVersoes(p);
  const curtos = codigo && so ? (gruposModelos(p).length > 1 ? [nomeModelos(p), so] : [so, nomeModelos(p)]) : [];
  return caber([
    `${comCod}. Peça usada, de carro com baixa legal no Detran-RS. ${fim}`,
    `${comCod}. Peça usada, de baixa legal no Detran-RS. ${fim}`,
    `${comCod}. Peça usada. ${fim}`,
    ...curtos.map((c) => `${frase(c, codigo)}. Peça usada. ${fim}`),
    `${semCod}. Peça usada. ${fim}`,
    `${semCod}. ${fim}`,
    // nome enorme: o nome é que encurta (o preço e a garantia ficam)
    `${encurtar(p.n, DESCRICAO_MAX - fim.length - 11)} original. ${fim}`,
  ]);
}

/** Prévia do link (og:description, a que o WhatsApp mostra em 2 linhas): começa pelo que vende, o preço e o código, e
 *  depois o carro. "R$ 244,64 · Cód. 8200328856 · Renault Clio, Logan e Sandero 2007 a 2014 · Peça original usada, com
 *  nota fiscal e 90 dias de garantia." Sem código, sem carro ou sem anos: a parte sai. A meta description (Google) é a
 *  de descricaoPeca. `codigo` e `preco` já prontos (codigoDaPeca e brl de lib/dados.ts: preço sempre com 2 casas). */
export function descricaoLink(p: PecaDescricao, codigo: string, preco: string): string {
  const carro = [nomeModelos(p), anosDaPeca(p.y ?? null, ' a ')].filter(Boolean).join(' ');
  return [`R$ ${preco}`, codigo && `Cód. ${codigo}`, carro, 'Peça original usada, com nota fiscal e 90 dias de garantia.']
    .filter(Boolean).join(' · ');
}

/** Título da prévia do link (og:title): curto, o nome limpo e o carro ("Caixa filtro de ar Renault Clio, Logan e
 *  Sandero"). O <title> da aba (com anos, código e a loja) não muda. */
export function tituloLink(p: PecaDescricao): string {
  return [p.n, nomeModelos(p)].filter(Boolean).join(' ');
}
