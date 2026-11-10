// Buscas recentes (só no navegador do cliente, localStorage; nada vai para servidor nenhum): as 5 últimas buscas
// feitas, da mais nova para a mais velha, sem repetir ("Farol" e "farol " são a mesma). Aparecem nas sugestões do
// cabeçalho e da abertura quando o campo está vazio (ui/SugestoesBusca.tsx), com "Limpar".
export const CHAVE_RECENTES = 'izzatcar.buscas';
export const MAX_RECENTES = 5;

const igual = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** As buscas guardadas (no máximo 5; lixo no armazenamento vira lista vazia). */
export function lerRecentes(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_RECENTES) || '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length >= 2).slice(0, MAX_RECENTES) : [];
  } catch {
    return [];
  }
}

/** Guarda a busca no topo (tira a repetida). Menos de 2 letras não entra. Devolve a lista nova. */
export function guardarBusca(q: string): string[] {
  const t = q.replace(/\s+/g, ' ').trim().slice(0, 80);
  if (t.length < 2) return lerRecentes();
  const lista = [t, ...lerRecentes().filter((x) => igual(x) !== igual(t))].slice(0, MAX_RECENTES);
  try { localStorage.setItem(CHAVE_RECENTES, JSON.stringify(lista)); } catch { /* sem armazenamento: só não guarda */ }
  return lista;
}

/** Apaga as buscas guardadas. */
export function limparRecentes(): void {
  try { localStorage.removeItem(CHAVE_RECENTES); } catch { /* nada */ }
}
