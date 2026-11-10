// Fila de fichas de ano que rola de lado no celular (página do carro, AnosDoCarro.astro, e o seletor "Seu carro",
// ui/meuCarroPicker.ts). Sem ano escolhido, a fila já abre nos anos com mais peças: no XC60 as peças são de 2018–2024 e a
// fila começava em "Todos, 2013, 2014, 2015" (cliente oculto, melhoria 5). O "Todos" fica fixo à esquerda (sticky, no CSS
// de cada um) e continua à mão. Só o scrollLeft da própria fila: a página nunca rola junto, e sem animação ao abrir.
//
// UMA função para os dois lugares; na página do carro ela vai inteira num <script is:inline> logo depois das fichas (roda
// antes da 1ª pintura: nada pula na tela). Por isso não usa nada de fora (nem import, nem outra função do arquivo).

/** Rola `lista` até `alvo` (o ano escolhido/salvo) ou, sem ele, até a janela de fichas seguidas que cabe na tela com mais
 *  peças (`contas`, uma por ficha; empate de até 5%: a do meio). `fixo` = o "Todos" (sticky): a conta é na parte da fila
 *  à direita dele, e a variável --fixo (no pai da fila) diz onde começa o esmaecido da borda esquerda. */
export function rolarFila(lista: HTMLElement, fixo: HTMLElement | null, chips: HTMLElement[], contas: number[], alvo: HTMLElement | null, suave?: boolean) {
  const caixa = lista.getBoundingClientRect();
  const gap = parseFloat(getComputedStyle(lista).columnGap) || 6;
  const ini = fixo ? fixo.getBoundingClientRect().right - caixa.left + gap : 0;
  if (lista.parentElement) lista.parentElement.style.setProperty('--fixo', `${Math.max(0, Math.round(ini - gap / 2))}px`);
  if (!chips.length || lista.scrollWidth <= lista.clientWidth + 1) return;
  const pos = (el: HTMLElement) => el.getBoundingClientRect().left - caixa.left + lista.scrollLeft;
  const vis = lista.clientWidth - ini;
  let a = alvo ? chips.indexOf(alvo) : -1;
  let b = a;
  if (a < 0) {
    const janelas: number[][] = [];
    for (let j = 0, i = 0, s = 0; j < chips.length; j++) {
      s += contas[j] || 0;
      while (i < j && pos(chips[j]) + chips[j].offsetWidth - pos(chips[i]) > vis) s -= contas[i++] || 0;
      janelas.push([i, j, s]);
    }
    let max = 0;
    for (const x of janelas) if (x[2] > max) max = x[2];
    const boas = janelas.filter((x) => x[2] >= max * 0.95);
    a = boas[(boas.length - 1) >> 1][0];
    b = boas[(boas.length - 1) >> 1][1];
  }
  const meio = (pos(chips[a]) + pos(chips[b]) + chips[b].offsetWidth) / 2;
  const left = Math.max(0, Math.round(meio - ini - vis / 2));
  if (suave) lista.scrollTo({ left, behavior: 'smooth' });
  else lista.scrollLeft = left;
}
