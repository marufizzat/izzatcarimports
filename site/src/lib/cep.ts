// CEP para cotar o frete no WhatsApp: UMA regra para /envios.html e o "Como é o envio?" da página da peça.
// Máscara 00000-000, conferência dos 8 números e o CEP lembrado no navegador da pessoa, sem cadastro:
//   localStorage['izzatcar.cep'] = "96445-000"
// Sem promessa de prazo nem de valor: quem responde com o frete é a gente, no WhatsApp.

export const CHAVE_CEP = 'izzatcar.cep';

/** Só os números, no máximo 8. */
export const digitosCep = (s: string) => s.replace(/\D/g, '').slice(0, 8);

/** "96445000" ou "96445-0" -> "96445-000" / "96445-0" (a máscara enquanto digita). */
export function formatarCep(s: string): string {
  const d = digitosCep(s);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/** O CEP tem os 8 números (e nada a mais). */
export const cepCompleto = (s: string) => s.replace(/\D/g, '').length === 8;

/** O CEP lembrado ("96445-000"), ou '' (sem nada salvo, salvo errado ou navegador sem armazenamento). */
export function lerCep(): string {
  try {
    const c = localStorage.getItem(CHAVE_CEP) || '';
    return cepCompleto(c) ? formatarCep(c) : '';
  } catch {
    return '';
  }
}

export function salvarCep(s: string) {
  try {
    if (cepCompleto(s)) localStorage.setItem(CHAVE_CEP, formatarCep(s));
  } catch {
    /* navegador sem armazenamento: segue sem lembrar */
  }
}

/** Liga o campo: preenche com o CEP lembrado (campo vazio) e põe a máscara; `aoCompletar` quando chega aos 8 números. */
export function ligarCampoCep(input: HTMLInputElement, aoCompletar?: () => void) {
  if (!input.value) input.value = lerCep();
  input.addEventListener('input', () => {
    input.value = formatarCep(input.value);
    if (cepCompleto(input.value)) aoCompletar?.();
  });
}
