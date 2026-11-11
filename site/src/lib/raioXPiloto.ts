// O mínimo que o Raio-x (components/v2/RaioX.astro) precisa saber de "a frente por dentro" antes de alguém abrir a
// vista: qual zona tem o piloto e os endereços da arte. Num arquivo só dele: a tabela das peças (lib/raioXFrente.ts,
// ~5 KB) fica no pedaço que só desce no clique do botão, não no script que toda visita à home carrega.
export const ARTE_FRENTE = { src: '/arte/v2/raio-x-frente.webp', w: 1536, h: 1024 } as const;
/** As variantes menores da arte (scripts/variantes-imagens.mjs): a de 320 é a miniatura do botão "Ver a frente por dentro". */
export const ARTE_FRENTE_320 = '/arte/v2/raio-x-frente-320.webp';
export const ARTE_FRENTE_900 = '/arte/v2/raio-x-frente-900.webp';
/** A zona do Raio-x que tem a vista por dentro (o piloto: só a frente). */
export const ZONA_PILOTO = 'frente';
