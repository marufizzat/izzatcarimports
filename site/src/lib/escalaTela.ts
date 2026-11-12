/** A escala da tela larga: o `zoom` da raiz (styles/global.css), 1 abaixo de 1700 px de largura.
 *  Retângulos (getBoundingClientRect) e o mouse (clientX/clientY) vêm em px da JANELA; offsetWidth, clientWidth,
 *  scrollLeft e o px que se escreve no style são px do DESENHO. De um para o outro: dividir por isto.
 *  A rolagem da página (scrollY, scrollTo, scrollBy) é em px da janela, como os retângulos. */
export const escalaTela = (): number => parseFloat(getComputedStyle(document.documentElement).zoom) || 1;

/** A medida do PC no `sizes` de uma imagem: `N px` na tela comum e a mesma fatia da janela na tela larga (N / 1700 da
 *  largura, onde o zoom da raiz começa). O `sizes` não sabe do zoom: sem isto, num monitor de 2560 px a imagem viria
 *  com os pontos de 1700 e seria esticada 1,5× (borrada). `larga(297)` = "max(297px,17.5vw)". Sem DOM: serve no build. */
export const larga = (px: number): string => `max(${px}px,${Math.ceil(px / 1.7) / 10}vw)`;
