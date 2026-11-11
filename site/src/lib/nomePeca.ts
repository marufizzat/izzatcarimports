// Nome da peça para FORA da página (título da aba, JSON-LD Product, mensagem do WhatsApp, feed do Google): o nome
// limpo + o(s) carro(s) + os anos + o código. Nunca o título cru do anúncio do ML ("Modulo Sensor Combustivel Vw
// Virtus Polo Up 18/24 06k907811", "Volvo Xc 60", "Gm"): esse fica só na nota de rodapé da ficha (AbasDetalhes).
// Auditoria 3, itens 4.2 e 9.2. Só no build (puxa lib/dados.ts).
import { codigoDaPeca, type Peca } from './dados';
import { gruposModelos, listaE, nomeModelos, nomeModelosVersoes, nomeSoVersoes } from './meuCarro';

type PecaNome = Pick<Peca, 'n' | 'b' | 'm' | 'y' | 'oem' | 'ms'>;

/** "2018–2024" (ou "2018 a 2024" com sep ' a '); um ano só quando a faixa é de um ano. */
export function anosDaPeca(y: Peca['y'], sep = '–'): string {
  return y ? (y[0] === y[1] ? String(y[0]) : `${y[0]}${sep}${y[1]}`) : '';
}

/** "Farol direito Chevrolet Cruze 2017–2021 E131464301": o mesmo do <title> da página da peça.
 *  anos = separador dos anos; cod = rótulo antes do código ("Cód. "); sep = entre as partes.
 *  É o nome que o Google lê (JSON-LD, feed): o carro unido leva as versões do anúncio ("Classe C (C180, C200)"). */
export function nomeCompleto(p: PecaNome, o: { anos?: string; cod?: string; sep?: string } = {}): string {
  const cod = codigoDaPeca(p.oem);
  return [p.n, nomeModelosVersoes(p), anosDaPeca(p.y, o.anos ?? '–'), cod ? `${o.cod ?? ''}${cod}` : '']
    .filter(Boolean).join(o.sep ?? ' ');
}

/** Linha da peça na mensagem do WhatsApp: "Farol direito · Chevrolet Cruze 2017 a 2021 · Cód. E131464301". */
export function nomeMensagem(p: PecaNome): string {
  const carro = [nomeModelos(p), anosDaPeca(p.y, ' a ')].filter(Boolean).join(' ');
  const cod = codigoDaPeca(p.oem);
  return [p.n, carro, cod ? `Cód. ${cod}` : ''].filter(Boolean).join(' · ');
}

/** O título da aba (<title>) cabe em 65 caracteres (o Google corta o resto; revisão 7, P3.8). */
export const TITULO_MAX = 65;
export const TITULO_SUFIXO = ' | Izzat Car';

/** "Volkswagen Virtus, Polo e Up" com só os `n` primeiros carros ("Volkswagen Virtus e Polo"; 0 = só a marca). O carro
 *  unido leva as versões do anúncio ("Mercedes-Benz Classe C (C180, C200)") quando `versoes`. */
function carroCom(p: PecaNome, n: number, versoes = true): string {
  const gs = gruposModelos(p).slice(0, n).map((g) => (versoes && g.v.length ? `${g.m} (${g.v.join(', ')})` : g.m));
  return [p.b, listaE(gs)].filter(Boolean).join(' ');
}

/** As formas do carro no <title>, da mais completa para a mais curta, sem repetir: todos os carros (com as versões do
 *  carro unido), menos carros (saem do fim), e por último só a marca. No carro unido, antes de perder a versão, a forma
 *  do anúncio ("Mercedes-Benz C320": é o que o cliente digita e o que o título dizia antes da união) e depois o
 *  principal sozinho ("Mercedes-Benz Classe C"). Peça sem carro unido: igual a antes. */
function formasDoCarro(p: PecaNome): string[] {
  const n = gruposModelos(p).length;
  const formas = [...Array(n).keys()].map((i) => carroCom(p, n - i));
  const so = nomeSoVersoes(p);
  if (so) formas.push(so, carroCom(p, 1, false));
  formas.push(carroCom(p, 0));
  return formas.filter((c, i, a) => a.indexOf(c) === i);
}

/** <title> da página da peça: nome limpo + carro(s) + anos (+ código) + " | Izzat Car", em até 65 caracteres.
 *  Corte com critério, sempre em partes inteiras (nunca no meio da palavra): o nome da peça vai sempre inteiro; sai
 *  primeiro o código, depois os anos (o carro vale mais que os anos), depois o sufixo; se ainda não couber, os carros
 *  saem um a um do fim ("Volvo S60 e XC60" -> "Volvo S60" -> "Volvo"). anos = os anos valem mais que o sufixo
 *  (desempate de títulos iguais). `extra` (código ou MLB) também desempata: entra depois dos anos e nunca sai, e o
 *  carro também não (no máximo os outros carros saem, ficam a marca e o 1º modelo): se não couber nem assim, o título
 *  passa de 65 com o MLB no fim, onde o Google corta. O H1 da página não muda (é o nome). */
export function tituloPeca(p: PecaNome, o: { max?: number; extra?: string; anos?: boolean } = {}): string {
  const max = o.max ?? TITULO_MAX;
  const cod = codigoDaPeca(p.oem);
  const anos = anosDaPeca(p.y);
  const junta = (...xs: (string | undefined)[]) => xs.filter(Boolean).join(' ');
  // "Volvo S60 e XC60", "Volvo S60", "Volvo" (sem repetir; peça sem carro: só "")
  const carros = formasDoCarro(p);
  const [carro] = carros;
  const soMarca = carroCom(p, 0);
  const ex = o.extra || '';
  const opcoes: string[] = [];
  const por = (t: string, sufixo = true) => opcoes.push(sufixo ? t + TITULO_SUFIXO : t);
  if (!ex && cod) { por(junta(p.n, carro, anos, cod)); por(junta(p.n, carro, anos, cod), false); }
  por(junta(p.n, carro, anos, ex));
  if (o.anos && anos) por(junta(p.n, carro, anos, ex), false);
  por(junta(p.n, carro, ex));
  por(junta(p.n, carro, ex), false);
  // o menor carro que ainda é o carro: marca + 1º modelo (sem modelo, a marca); com `extra`, ele nunca sai
  const minimo = carroCom(p, 1, false);
  for (const c of carros.slice(1)) {
    if (ex && c === soMarca && c !== minimo) break;
    por(junta(p.n, c, ex)); por(junta(p.n, c, ex), false);
  }
  if (!ex) por(junta(p.n));
  return opcoes.find((t) => t.length <= max) ?? junta(p.n, ex ? minimo : '', ex);
}

/** Os títulos de todas as peças, sem repetir. Título igual (o mesmo carro de outra geração, anúncios gêmeos,
 *  "Fechadura" sem carro) desempata por etapas, só nas repetidas: os anos de volta (no lugar do sufixo), depois o
 *  código (só se couber com o carro inteiro: o carro vale mais que o código), e por fim o MLB. Uma vez por build. */
export function titulosPecas<T extends PecaNome & { id: string }>(lista: T[]): Map<string, string> {
  const atual = new Map(lista.map((p) => [p.id, tituloPeca(p)]));
  // o código só entra com o carro inteiro (o carro vale mais que o código); senão fica como estava, para o MLB
  const comCodigo = (p: T) => {
    const cod = codigoDaPeca(p.oem);
    const t = cod ? tituloPeca(p, { anos: true, extra: cod }) : '';
    return t && t.length <= TITULO_MAX && (t.includes(nomeModelosVersoes(p)) || t.includes(nomeModelos(p))) ? t : atual.get(p.id)!;
  };
  const etapas: ((p: T) => string)[] = [
    (p) => tituloPeca(p, { anos: true }),
    comCodigo,
    (p) => tituloPeca(p, { anos: true, extra: p.id }),
  ];
  for (const etapa of etapas) {
    const n = new Map<string, number>();
    for (const t of atual.values()) n.set(t, (n.get(t) ?? 0) + 1);
    const repetidas = lista.filter((p) => n.get(atual.get(p.id)!)! > 1);
    if (!repetidas.length) break;
    for (const p of repetidas) atual.set(p.id, etapa(p));
  }
  return atual;
}
