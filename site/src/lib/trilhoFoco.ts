// Trilho horizontal com scroll-snap (celular): quando o TECLADO leva o foco a um item meio escondido, o navegador
// rola só o mínimo e o snap puxa de volta para o item anterior, deixando o item com foco fora da tela. Aqui o item
// com foco é alinhado ao começo do trilho (que é justamente um ponto de snap, então ele fica onde está).
// Sem efeito no toque nem no PC (onde a lista não rola). Roda no navegador.
export function focoNoTrilho(seletor: string): void {
  document.querySelectorAll<HTMLElement>(seletor).forEach((ul) => {
    ul.addEventListener('focusin', (e) => {
      if (ul.scrollWidth <= ul.clientWidth + 1) return;
      const li = (e.target as HTMLElement).closest('li');
      if (!li || !ul.contains(li)) return;
      const r = li.getBoundingClientRect();
      const u = ul.getBoundingClientRect();
      const pad = parseFloat(getComputedStyle(ul).scrollPaddingLeft) || 0;
      if (r.left >= u.left + pad - 1 && r.right <= u.right + 1) return; // já está inteiro na tela
      ul.scrollTo({ left: ul.scrollLeft + (r.left - u.left) - pad, behavior: 'auto' });
    });
  });
}
