// O mínimo que o Raio-x (components/v2/RaioX.astro) precisa saber das vistas "por dentro" antes de alguém abrir uma:
// qual zona tem vista, o que o botão diz e o endereço da arte. Num arquivo só dele: as tabelas das peças (uma por
// vista, ~5 KB cada: lib/raioXFrente.ts e lib/porDentro/*.ts) e o código da vista (components/v2/raioXPorDentro.ts)
// ficam em pedaços que só descem no clique do botão, não no script que toda visita à home carrega.
// As duas laterais usam a MESMA arte (as portas do lado esquerdo) e a mesma tabela, com o lado nos links.

export type Vista = {
  /** a arte (public/arte/v2/raio-x-<arte>.webp, com as variantes -320 e -900 de scripts/variantes-imagens.mjs) */
  arte: string;
  /** o título do painel da vista */
  titulo: string;
  /** o botão do painel da zona */
  botao: string;
  /** a linha de apoio do botão: 3 ou 4 peças da arte (nunca quantas são) */
  resumo: string;
};

const NO_LUGAR = 'cada peça no lugar dela.';
/** As vistas por dentro, pela chave da ZONA do Raio-x (lib/raioX.ts: ZONAS). */
export const VISTAS: Record<string, Vista> = {
  frente: { arte: 'frente', titulo: 'A frente por dentro', botao: 'Ver a frente por dentro', resumo: `Para-choque, grade, faróis, radiador: ${NO_LUGAR}` },
  motor: { arte: 'motor', titulo: 'O motor por dentro', botao: 'Ver o motor por dentro', resumo: `Cabeçote, coletor, turbina, alternador: ${NO_LUGAR}` },
  'lateral-esquerda': { arte: 'lateral', titulo: 'A lateral esquerda por dentro', botao: 'Ver a lateral por dentro', resumo: `Porta, vidro, fechadura, retrovisor: ${NO_LUGAR}` },
  'lateral-direita': { arte: 'lateral', titulo: 'A lateral direita por dentro', botao: 'Ver a lateral por dentro', resumo: `Porta, vidro, fechadura, retrovisor: ${NO_LUGAR}` },
  interior: { arte: 'interior', titulo: 'O interior por dentro', botao: 'Ver o interior por dentro', resumo: `Painel, volante, console, bancos: ${NO_LUGAR}` },
  teto: { arte: 'teto', titulo: 'O teto por dentro', botao: 'Ver o teto por dentro', resumo: `Teto solar, forro, quebra-sol, antena: ${NO_LUGAR}` },
  traseira: { arte: 'traseira', titulo: 'A traseira por dentro', botao: 'Ver a traseira por dentro', resumo: `Tampa, lanternas, para-choque, câmera: ${NO_LUGAR}` },
  rodas: { arte: 'rodas', titulo: 'A suspensão por dentro', botao: 'Ver a suspensão por dentro', resumo: `Roda, pinça, amortecedor, bandeja: ${NO_LUGAR}` },
  embaixo: { arte: 'embaixo', titulo: 'O carro por baixo', botao: 'Ver o carro por baixo', resumo: `Câmbio, escapamento, tanque, diferencial: ${NO_LUGAR}` },
};

/** O tamanho de todas as artes das vistas (o mesmo da arte do carro: o palco não muda de tamanho). */
export const ARTE_VISTA = { w: 1536, h: 1024 } as const;
/** O endereço da arte de uma vista: a inteira, a de 900 (celular) ou a de 320 (a miniatura do botão). */
export const arteDaVista = (v: Vista, largura?: 320 | 900) => `/arte/v2/raio-x-${v.arte}${largura ? `-${largura}` : ''}.webp`;
/** O arquivo das contas de todas as vistas no estoque inteiro (quem não tem carro salvo): pages/dados/raio-x-dentro.json.ts. */
export const ARQUIVO_DENTRO = '/dados/raio-x-dentro.json';
