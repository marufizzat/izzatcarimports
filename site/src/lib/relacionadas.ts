// "Do mesmo carro" na página da peça: primeiro as peças da MESMA GERAÇÃO do carro (anos que se
// sobrepõem), as da mesma família/subfamília na frente. Outra geração só entra para completar quando
// faltam peças, e sempre num grupo à parte, com o nome dito ("Outros anos do Golf").
// Funções puras (recebem a lista do modelo), para os testes rodarem sem o build.
import type { Peca } from './dados';
import { serveNoModelo, anosNoModelo } from './meuCarro';

type Anos = [number, number];

/** Parte da faixa MENOR que cai dentro da outra, de 0 a 1. [2014, 2021] x [2013, 2020] = 7/8. */
export function sobreposicao(a: Anos, b: Anos): number {
  const ini = Math.max(a[0], b[0]);
  const fim = Math.min(a[1], b[1]);
  if (fim < ini) return 0;
  const menor = Math.min(a[1] - a[0], b[1] - b[0]) + 1;
  return (fim - ini + 1) / menor;
}

/** Mesma geração: metade (ou mais) da faixa menor dentro da outra. Só encostar não basta:
 *  Golf 1999–2014 e Golf 2014–2021 dividem um ano só (1/8) e são gerações diferentes. */
export function mesmaGeracao(a: Anos | null | undefined, b: Anos | null | undefined): boolean {
  return !!a && !!b && sobreposicao(a, b) >= 0.5;
}

export type DoCarro = {
  /** Mesma geração (ou, se a peça não tem ano, todas do modelo). */
  mesma: Peca[];
  /** Outros anos (sem sobreposição suficiente), só para completar quando a mesma geração tem poucas.
   *  Peça sem ano não entra aqui: não dá para dizer que é de "outros anos". */
  outras: Peca[];
  /** A peça não tem ano: não dá para separar geração (a página pede para conferir o ano). */
  semAno: boolean;
};

export const MAX_CARRO = 8;
/** Com menos que isto da mesma geração, completa com outros anos (em grupo separado). */
export const MIN_MESMA = 5;

/** Ordem: mesma subfamília (na mesma família), depois mesma família, depois o resto; empate pelo nome. */
export function doMesmoCarro(p: Peca, doModelo: Peca[], max = MAX_CARRO, minimo = MIN_MESMA): DoCarro {
  const nivel = (x: Peca) => (x.c === p.c ? (x.s && x.s === p.s ? 0 : 1) : 2);
  const porNome = (a: Peca, b: Peca) => a.n.localeCompare(b.n, 'pt-BR') || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const outros = doModelo.filter((x) => x.id !== p.id);
  if (!p.y) {
    const todas = [...outros].sort((a, b) => nivel(a) - nivel(b) || porNome(a, b));
    return { mesma: todas.slice(0, max), outras: [], semAno: true };
  }
  const y = p.y;
  const mesma = outros.filter((x) => mesmaGeracao(y, x.y)).sort((a, b) => nivel(a) - nivel(b) || porNome(a, b)).slice(0, max);
  if (mesma.length >= minimo) return { mesma, outras: [], semAno: false };
  // outros anos: os mais perto primeiro (peça sem ano fica de fora: não é "outro ano")
  const distancia = (x: Peca) => (x.y ? Math.min(Math.abs(x.y[0] - y[0]), Math.abs(x.y[1] - y[1])) : 999);
  const outras = outros
    .filter((x) => !!x.y && !mesmaGeracao(y, x.y))
    .sort((a, b) => nivel(a) - nivel(b) || distancia(a) - distancia(b) || porNome(a, b))
    .slice(0, max - mesma.length);
  return { mesma, outras, semAno: false };
}

// ---- "Vai junto": até 4 peças do MESMO carro (e da mesma geração) que costumam ser trocadas junto com esta ----
// Regra por grupo de tipo (o `s` da peça, preparar_dados.py: TIPO_LOJA), às vezes afinada pelo nome: farol -> para-choque
// dianteiro, grade, suporte do farol...; retrovisor -> capa, botão; lanterna -> para-choque traseiro, tampa, luz de placa;
// maçaneta -> fechadura, máquina de vidro; módulo -> chicote, caixa de fusíveis. Lado e posição contam: farol direito
// nunca chama a grade esquerda nem o para-choque traseiro; maçaneta traseira direita chama a fechadura traseira direita
// (ou a sem lado dito). Sem peça que combine no estoque daquele carro: nada (o bloco não aparece).
export type Zona = 'frente' | 'tras';
type Grupo = {
  /** tipos (`s`) do grupo */
  tipos: string[];
  /** só as peças do tipo cujo nome bate (afina tipo que junta coisas diferentes: "Amortecedores da Tampa e do Capô") */
  nome?: RegExp;
  /** a zona do carro quando o nome não diz (farol é da frente, lanterna é de trás) */
  zona?: Zona;
  /** o fim da frase "…que costumam ser trocadas com o farol" */
  com: string;
};
const CAPO = /cap[oô]/i;
const TAMPA = /tampa|porta-?malas|bagageiro/i;
const FAROL = /farol|far[oó]is/i;
/** A ordem conta: a peça cai no 1º grupo que serve (os afinados pelo nome vêm antes dos gerais do mesmo tipo). */
export const GRUPOS: Record<string, Grupo> = {
  // frente
  farol: { tipos: ['Faróis'], zona: 'frente', com: 'o farol' },
  milha: { tipos: ['Faróis de Milha'], zona: 'frente', com: 'o farol de milha' },
  'farol-peca': { tipos: ['Suportes do Farol', 'Frisos dos Faróis', 'Módulos e Reatores do Farol'], zona: 'frente', com: 'esta peça do farol' },
  'esguicho-farol': { tipos: ['Bombas e Esguichos do Lavador'], nome: FAROL, zona: 'frente', com: 'o esguicho do farol' },
  grade: { tipos: ['Grades do Para-choque', 'Grades'], zona: 'frente', com: 'a grade' },
  parachoque: { tipos: ['Para-choques', 'Almas do Para-choque', 'Guias e Suportes do Para-choque', 'Molduras do Para-choque', 'Spoilers'], com: 'esta peça do para-choque' },
  capo: { tipos: ['Dobradiças do Capô', 'Fechaduras do Capô', 'Isolamentos do Capô'], zona: 'frente', com: 'esta peça do capô' },
  'capo-mola': { tipos: ['Amortecedores da Tampa e do Capô', 'Cabos e Alavancas de Abertura'], nome: CAPO, zona: 'frente', com: 'esta peça do capô' },
  paralama: { tipos: ['Para-lamas', 'Molduras do Para-lama', 'Para-barros'], com: 'esta peça do para-lama' },
  'frente-radiador': { tipos: ['Suportes do Radiador', 'Radiadores', 'Condensadores', 'Eletroventiladores', 'Defletores', 'Motores de Ventilador', 'Relés da Ventoinha'], zona: 'frente', com: 'esta peça do radiador' },
  // trás
  lanterna: { tipos: ['Lanternas Traseiras'], zona: 'tras', com: 'a lanterna' },
  brake: { tipos: ['Brake Light'], zona: 'tras', com: 'o brake light' },
  placa: { tipos: ['Luzes de Placa', 'Suportes da Placa'], zona: 'tras', com: 'esta peça da placa' },
  refletor: { tipos: ['Refletores'], zona: 'tras', com: 'o refletor' },
  tampa: { tipos: ['Acabamentos da Tampa Traseira', 'Dobradiças da Tampa Traseira', 'Fechaduras do Porta-malas', 'Aerofólios', 'Tampões do Porta-malas'], zona: 'tras', com: 'esta peça da tampa traseira' },
  // tipos de porta com "tampa traseira"/"porta-malas" no nome (a maçaneta e a trava da tampa não vão com as portas)
  'tampa-mola': { tipos: ['Amortecedores da Tampa e do Capô', 'Cabos e Alavancas de Abertura', 'Forros', 'Maçanetas das Portas', 'Maçanetas Internas', 'Fechaduras das Portas', 'Botões da Trava Elétrica'], nome: TAMPA, zona: 'tras', com: 'esta peça da tampa traseira' },
  'camera-re': { tipos: ['Câmeras de Ré'], zona: 'tras', com: 'a câmera de ré' },
  estacionamento: { tipos: ['Sensores de Estacionamento'], com: 'o sensor de estacionamento' },
  // portas
  retrovisor: { tipos: ['Retrovisores Externos'], com: 'o retrovisor' },
  // capa do retrovisor INTERNO (o tipo junta as duas) antes da do externo
  'retrovisor-interno-capa': { tipos: ['Capas e Molduras do Retrovisor'], nome: /intern/i, com: 'esta peça do retrovisor interno' },
  'retrovisor-peca': { tipos: ['Capas e Molduras do Retrovisor', 'Botões do Retrovisor'], com: 'esta peça do retrovisor' },
  macaneta: { tipos: ['Maçanetas das Portas', 'Maçanetas Internas', 'Puxadores das Portas'], com: 'a maçaneta' },
  fechadura: { tipos: ['Fechaduras das Portas', 'Botões da Trava Elétrica'], com: 'a fechadura' },
  'cabo-porta': { tipos: ['Cabos e Alavancas de Abertura'], com: 'esta peça da porta' },
  vidro: { tipos: ['Máquinas e Motores de Vidro Elétrico', 'Máquinas de Vidro Manuais', 'Peças da Máquina de Vidro', 'Guias e Canaletas do Vidro', 'Vidros Laterais'], com: 'a máquina de vidro' },
  'botao-vidro': { tipos: ['Botões do Vidro Elétrico'], com: 'o botão do vidro' },
  'forro-porta': { tipos: ['Forros', 'Apoios de Braço', 'Frisos das Portas', 'Molduras das Portas'], nome: /porta|apoio|friso|moldura/i, com: 'esta peça da porta' },
  'porta': { tipos: ['Dobradiças e Limitadores de Porta', 'Borrachas de Vedação', 'Portas'], com: 'esta peça da porta' },
  // elétrica e módulos
  modulo: { tipos: ['Módulos de Conforto (BCM)', 'Módulos Eletrônicos', 'Antenas e Módulos Keyless', 'Alarmes e Sirenes', 'Conversores e Módulos de Bateria'], com: 'o módulo' },
  'modulo-injecao': { tipos: ['Módulos de Injeção'], com: 'o módulo de injeção' },
  imobilizador: { tipos: ['Módulos de Ignição e Imobilizador', 'Chaves do Carro', 'Cilindros e Comutadores de Ignição', 'Botões de Partida'], com: 'esta peça da partida' },
  chicote: { tipos: ['Chicotes Elétricos', 'Chicotes de Chassi', 'Tomadas Elétricas'], com: 'o chicote' },
  fusiveis: { tipos: ['Caixas de Fusíveis', 'Relés', 'Relés de Partida', 'Tampas da Caixa de Fusíveis'], com: 'a caixa de fusíveis' },
  bateria: { tipos: ['Cabos e Terminais de Bateria', 'Caixas e Suportes da Bateria'], com: 'esta peça da bateria' },
  // motor, admissão e injeção
  coxim: { tipos: ['Coxins do Motor', 'Coxins do Câmbio'], com: 'o coxim' },
  correia: { tipos: ['Tensores de Correia'], com: 'o tensor da correia' },
  distribuicao: { tipos: ['Peças da Distribuição', 'Tampas da Distribuição', 'Tensores de Corrente', 'Comandos de Válvulas'], com: 'esta peça da distribuição' },
  // a válvula solenoide do turbo (pressão da turbina, wastegate) é do turbo, não do cabeçote (revisão 12, P2.2)
  'turbo-valvula': { tipos: ['Válvulas Solenoides'], nome: /turb|waste\s?gate/i, com: 'a válvula do turbo' },
  cabecote: { tipos: ['Cabeçotes', 'Tampas de Válvulas', 'Parafusos do Cabeçote', 'Válvulas Solenoides', 'Tampas de Óleo'], com: 'esta peça do cabeçote' },
  'motor-baixo': { tipos: ['Blocos do Motor', 'Bielas', 'Bronzinas', 'Pistões', 'Virabrequins', 'Cárteres', 'Bombas de Óleo', 'Retentores', 'Radiadores de Óleo', 'Suportes do Filtro de Óleo', 'Sensores de Pressão do Óleo'], com: 'esta peça do motor' },
  admissao: { tipos: ['Coletores de Admissão', 'Corpos de Borboleta', 'Mangueiras de Admissão', 'Caixas do Filtro de Ar', 'Sensores MAF', 'Sensores MAP'], com: 'esta peça da admissão' },
  injecao: { tipos: ['Bicos Injetores', 'Flautas de Combustível', 'Canos dos Injetores', 'Bombas de Alta Pressão', 'Reguladores de Pressão', 'Sensores de Pressão'], com: 'esta peça da injeção' },
  combustivel: { tipos: ['Bombas de Combustível', 'Boias de Combustível', 'Tanques de Combustível', 'Portinholas e Tampas do Tanque', 'Válvulas e Filtros Canister'], com: 'esta peça do combustível' },
  'sensor-motor': { tipos: ['Sensores de Detonação', 'Sensores de Posição', 'Sensores de Rotação', 'Sensores de Velocidade', 'Válvulas EGR', 'Sensores de Vácuo'], com: 'o sensor' },
  turbo: { tipos: ['Turbinas', 'Intercoolers', 'Mangueiras do Turbo e Intercooler'], com: 'esta peça do turbo' },
  escape: { tipos: ['Catalisadores', 'Escapamentos', 'Tubos Flexíveis', 'Coletores de Escapamento', 'Sondas Lambda'], com: 'esta peça do escapamento' },
  bobina: { tipos: ['Bobinas de Ignição', 'Velas Aquecedoras'], com: 'a bobina' },
  alternador: { tipos: ['Alternadores', 'Suportes do Alternador', 'Reguladores de Voltagem'], com: 'o alternador' },
  arranque: { tipos: ['Motores de Arranque'], com: 'o motor de arranque' },
  arrefecimento: { tipos: ['Bombas de Água', 'Válvulas Termostáticas', 'Reservatórios de Água', 'Sensores de Temperatura', 'Mangueiras de Arrefecimento', 'Mangueiras de Calefação'], com: 'esta peça do arrefecimento' },
  // ar-condicionado
  'ac-gas': { tipos: ['Compressores', 'Suportes do Compressor', 'Mangueiras de Ar Condicionado', 'Válvulas de Expansão', 'Sensores do Ar-condicionado', 'Kits de Ar Condicionado'], com: 'esta peça do ar-condicionado' },
  'ac-caixa': { tipos: ['Atuadores e Motores do Ar', 'Evaporadores', 'Radiadores do Ar Quente', 'Resistências e Relés do Ar', 'Válvulas da Calefação'], com: 'esta peça da caixa de ar' },
  'ac-comando': { tipos: ['Comandos de Ar Condicionado'], com: 'o comando do ar' },
  difusor: { tipos: ['Difusores de Ar'], com: 'o difusor' },
  // freios, suspensão, direção e câmbio
  'freio-roda': { tipos: ['Pinças de Freio', 'Espelhos e Defletores do Disco', 'Mangueiras e Flexíveis do Freio'], com: 'esta peça do freio' },
  'freio-hidro': { tipos: ['Hidrovácuos', 'Cilindros Mestres', 'Reservatórios de Fluido', 'Bombas de Vácuo'], com: 'esta peça do freio' },
  abs: { tipos: ['Módulos ABS', 'Sensores ABS'], com: 'o ABS' },
  'freio-mao': { tipos: ['Alavancas do Freio de Mão', 'Botões do Freio de Mão', 'Cabo do Freio de Mão'], com: 'o freio de mão' },
  amortecedor: { tipos: ['Amortecedores', 'Coxins do Amortecedor', 'Molas', 'Bieletas e Barras Estabilizadoras', 'Suspensão a Ar e Nivelamento'], com: 'esta peça da suspensão' },
  'suspensao-braco': { tipos: ['Bandejas da Suspensão', 'Braços da Suspensão', 'Buchas de Suspensão', 'Mangas de Eixo', 'Cubos de Roda', 'Quadros da Suspensão'], com: 'esta peça da suspensão' },
  direcao: { tipos: ['Colunas de Direção', 'Caixas de Direção', 'Bombas de Direção e Suportes', 'Mangueiras da Direção'], com: 'esta peça da direção' },
  'cambio-alavanca': { tipos: ['Alavancas e Manoplas de Câmbio', 'Trambuladores e Seletores'], com: 'esta peça do câmbio' },
  'modulo-cambio': { tipos: ['Módulos do Câmbio e da Tração'], com: 'o módulo do câmbio' },
  cambio: { tipos: ['Câmbios e Peças Internas', 'Caixas de Transferência', 'Diferenciais', 'Volantes de Embreagem', 'Cardans'], com: 'esta peça do câmbio' },
  semieixo: { tipos: ['Semieixos', 'Semieixos e Suportes'], com: 'o semieixo' },
  // interior
  'painel-instr': { tipos: ['Painéis de Instrumentos', 'Displays e Telas'], com: 'o painel' },
  'painel-acab': { tipos: ['Acabamentos do Painel', 'Porta-luvas', 'Cinzeiros', 'Tomadas USB e Acendedores'], com: 'esta peça do painel' },
  console: { tipos: ['Consoles', 'Porta-copos'], com: 'o console' },
  'capa-coluna': { tipos: ['Capas da Coluna de Direção'], com: 'a capa da coluna' },
  'chave-seta': { tipos: ['Chaves de Seta e Luz', 'Chaves do Limpador'], com: 'a chave de seta' },
  // botão da tampa traseira ("Botão abertura porta-malas", "Comando rebatimento tampa"): vai com a tampa, não com o painel
  'tampa-botao': { tipos: ['Outros Botões'], nome: /tampa traseira|porta-?malas|bagageiro|rebatimento\s+(d[ao]\s+)?tampa/i, zona: 'tras', com: 'o botão da tampa traseira' },
  'botoes-painel': { tipos: ['Botões do Pisca-alerta', 'Botões do Desembaçador', 'Outros Botões'], com: 'o botão' },
  volante: { tipos: ['Volantes', 'Botões do Volante'], com: 'o volante' },
  airbag: { tipos: ['Airbags, Módulos e Sensores', 'Cintos de Segurança'], com: 'esta peça do airbag' },
  'pedal-freio': { tipos: ['Pedais'], nome: /freio|embreagem/i, com: 'o pedal' },
  pedal: { tipos: ['Pedais', 'Cabos do Acelerador'], com: 'o pedal' },
  limpador: { tipos: ['Motores do Limpador', 'Braços do Limpador', 'Sensores de Chuva', 'Grades do Para-brisa'], com: 'o limpador' },
  lavador: { tipos: ['Reservatórios do Lavador', 'Bombas e Esguichos do Lavador'], com: 'o lavador' },
  multimidia: { tipos: ['Centrais Multimídia', 'Rádios', 'Molduras da Multimídia', 'Suportes da Multimídia', 'Interfaces de Som', 'Antenas', 'Câmeras'], com: 'a multimídia' },
  som: { tipos: ['Alto-falantes', 'Amplificadores', 'Grades de Alto-falante'], com: 'o som' },
  'retrovisor-interno': { tipos: ['Retrovisores Internos'], com: 'o retrovisor interno' },
  teto: { tipos: ['Quebra-sóis', 'Luzes Internas', 'Motores do Teto Solar', 'Botões do Teto Solar'], com: 'esta peça do teto' },
  coluna: { tipos: ['Acabamentos de Coluna', 'Soleiras', 'Alças e Puxadores'], com: 'este acabamento' },
  banco: { tipos: ['Peças de Banco', 'Encostos de Cabeça'], com: 'esta peça do banco' },
  rodas: { tipos: ['Rodas', 'Calotas', 'Parafusos Prisioneiros', 'Sensores TPMS'], com: 'a roda' },
  estepe: { tipos: ['Macacos e Chaves de Roda', 'Suportes do Estepe', 'Triângulos de Segurança', 'Ganchos de Reboque'], com: 'esta peça' },
};

/** Para cada grupo, os grupos que vão junto, do mais ligado ao menos (o próprio grupo = outras peças do mesmo conjunto). */
export const JUNTO: Record<string, string[]> = {
  farol: ['parachoque', 'grade', 'farol-peca', 'esguicho-farol', 'milha', 'capo', 'capo-mola', 'paralama', 'frente-radiador'],
  milha: ['parachoque', 'grade', 'farol'],
  'farol-peca': ['farol', 'farol-peca', 'parachoque', 'grade'],
  'esguicho-farol': ['farol', 'parachoque', 'lavador'],
  grade: ['parachoque', 'farol', 'milha', 'grade', 'estacionamento', 'frente-radiador'],
  parachoque: ['parachoque', 'grade', 'farol', 'milha', 'lanterna', 'refletor', 'estacionamento', 'camera-re', 'placa'],
  capo: ['capo', 'capo-mola', 'grade', 'farol'],
  'capo-mola': ['capo', 'capo-mola', 'grade'],
  paralama: ['paralama', 'farol', 'parachoque', 'retrovisor'],
  'frente-radiador': ['frente-radiador', 'arrefecimento', 'parachoque', 'farol'],
  lanterna: ['parachoque', 'tampa', 'tampa-mola', 'refletor', 'placa', 'brake', 'camera-re', 'estacionamento'],
  brake: ['tampa', 'tampa-mola', 'lanterna', 'placa'],
  placa: ['tampa', 'placa', 'lanterna', 'camera-re', 'parachoque'],
  refletor: ['parachoque', 'lanterna', 'refletor'],
  tampa: ['tampa', 'tampa-mola', 'lanterna', 'placa', 'brake', 'camera-re', 'tampa-botao'],
  'tampa-mola': ['tampa', 'tampa-mola', 'lanterna', 'placa', 'tampa-botao'],
  'tampa-botao': ['tampa', 'tampa-mola', 'tampa-botao', 'lanterna', 'placa'],
  'camera-re': ['placa', 'estacionamento', 'multimidia', 'tampa'],
  estacionamento: ['parachoque', 'estacionamento', 'camera-re', 'modulo'],
  retrovisor: ['retrovisor-peca'],
  'retrovisor-peca': ['retrovisor', 'retrovisor-peca'],
  macaneta: ['fechadura', 'macaneta', 'cabo-porta', 'vidro', 'botao-vidro', 'forro-porta'],
  fechadura: ['macaneta', 'cabo-porta', 'fechadura', 'vidro', 'botao-vidro', 'forro-porta'],
  'cabo-porta': ['fechadura', 'macaneta', 'forro-porta'],
  vidro: ['botao-vidro', 'vidro', 'fechadura', 'macaneta', 'forro-porta'],
  'botao-vidro': ['vidro', 'forro-porta', 'botao-vidro', 'retrovisor-peca', 'fechadura'],
  'forro-porta': ['botao-vidro', 'macaneta', 'forro-porta', 'vidro', 'som'],
  porta: ['porta', 'macaneta', 'fechadura', 'vidro', 'retrovisor'],
  modulo: ['chicote', 'fusiveis', 'modulo', 'imobilizador'],
  'modulo-injecao': ['chicote', 'imobilizador', 'sensor-motor', 'bobina', 'admissao'],
  imobilizador: ['imobilizador', 'modulo-injecao', 'modulo', 'capa-coluna'],
  chicote: ['modulo', 'fusiveis', 'chicote', 'modulo-injecao'],
  fusiveis: ['fusiveis', 'modulo', 'chicote', 'bateria'],
  bateria: ['bateria', 'fusiveis', 'arranque', 'alternador'],
  coxim: ['coxim'],
  correia: ['correia', 'alternador', 'arrefecimento', 'distribuicao'],
  distribuicao: ['distribuicao', 'correia', 'arrefecimento', 'cabecote'],
  cabecote: ['cabecote', 'bobina', 'distribuicao', 'admissao'],
  'motor-baixo': ['motor-baixo', 'cabecote', 'distribuicao'],
  admissao: ['admissao', 'injecao', 'turbo', 'modulo-injecao'],
  injecao: ['injecao', 'admissao', 'combustivel'],
  combustivel: ['combustivel', 'injecao'],
  'sensor-motor': ['sensor-motor', 'modulo-injecao', 'escape'],
  turbo: ['turbo', 'turbo-valvula', 'admissao', 'escape'],
  'turbo-valvula': ['turbo', 'admissao', 'sensor-motor', 'turbo-valvula'],
  escape: ['escape', 'sensor-motor', 'turbo'],
  bobina: ['bobina', 'cabecote', 'modulo-injecao'],
  alternador: ['alternador', 'correia', 'bateria'],
  arranque: ['bateria', 'imobilizador', 'fusiveis'],
  arrefecimento: ['arrefecimento', 'frente-radiador', 'distribuicao'],
  'ac-gas': ['ac-gas', 'ac-caixa', 'frente-radiador'],
  'ac-caixa': ['ac-caixa', 'ac-comando', 'ac-gas', 'difusor'],
  'ac-comando': ['ac-caixa', 'difusor', 'painel-acab', 'ac-comando'],
  difusor: ['difusor', 'painel-acab', 'ac-comando'],
  'freio-roda': ['freio-roda', 'abs', 'suspensao-braco'],
  'freio-hidro': ['freio-hidro', 'pedal-freio'],
  abs: ['abs', 'chicote', 'freio-roda'],
  'freio-mao': ['freio-mao', 'console', 'cambio-alavanca'],
  amortecedor: ['amortecedor', 'suspensao-braco'],
  'suspensao-braco': ['suspensao-braco', 'amortecedor', 'freio-roda', 'semieixo'],
  direcao: ['direcao', 'capa-coluna', 'volante', 'chave-seta'],
  'cambio-alavanca': ['cambio-alavanca', 'console', 'modulo-cambio'],
  'modulo-cambio': ['cambio-alavanca', 'chicote', 'cambio'],
  cambio: ['cambio', 'coxim', 'semieixo'],
  semieixo: ['semieixo', 'suspensao-braco', 'cambio'],
  'painel-instr': ['painel-acab', 'multimidia', 'chicote'],
  'painel-acab': ['painel-acab', 'difusor', 'console', 'ac-comando'],
  console: ['console', 'freio-mao', 'cambio-alavanca', 'painel-acab'],
  'capa-coluna': ['chave-seta', 'direcao', 'imobilizador', 'volante'],
  'chave-seta': ['chave-seta', 'capa-coluna', 'volante', 'direcao'],
  'botoes-painel': ['painel-acab', 'ac-comando', 'botoes-painel'],
  volante: ['volante', 'airbag', 'chave-seta', 'capa-coluna'],
  airbag: ['airbag', 'volante', 'coluna'],
  'pedal-freio': ['freio-hidro', 'pedal-freio'],
  pedal: ['pedal'],
  limpador: ['limpador', 'lavador', 'chave-seta'],
  lavador: ['lavador', 'limpador'],
  multimidia: ['multimidia', 'painel-acab', 'som', 'camera-re'],
  som: ['som', 'multimidia'],
  'retrovisor-interno': ['retrovisor-interno-capa', 'teto', 'retrovisor-interno'],
  'retrovisor-interno-capa': ['retrovisor-interno', 'retrovisor-interno-capa'],
  teto: ['teto', 'retrovisor-interno', 'coluna'],
  coluna: ['coluna', 'teto', 'airbag'],
  banco: ['banco'],
  rodas: ['rodas'],
  estepe: ['estepe'],
};

/** Até quantas o "Vai junto" mostra. */
export const MAX_JUNTO = 4;

/** Os códigos gravados da peça, em minúsculas ("1j0858601 1j0858601d" = 2 códigos). */
export const codigosDe = (p: Pick<Peca, 'o'>): Set<string> => new Set((p.o || '').toLowerCase().split(/\s+/).filter(Boolean));
/** Tampas de válvula e de óleo: são do cabeçote, não vão junto com bobina, sensor etc. */
const TAMPAS = new Set(['Tampas de Válvulas', 'Tampas de Óleo']);

type PecaJunto = Pick<Peca, 'id' | 'n' | 's' | 'o' | 'b' | 'm' | 'y' | 'ms' | 'ys'>;

/** O grupo da peça (o 1º de GRUPOS cujo tipo e nome servem), ou null. */
export function grupoDa(p: Pick<Peca, 's' | 'n'>): string | null {
  for (const [k, g] of Object.entries(GRUPOS)) if (g.tipos.includes(p.s) && (!g.nome || g.nome.test(p.n))) return k;
  return null;
}
const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** Lado que o nome diz: 'E' (esquerdo, motorista), 'D' (direito, passageiro) ou null. */
export function ladoDa(nome: string): 'E' | 'D' | null {
  const t = sem(nome);
  const e = /\b(esquerd[oa]s?|esq|motorista)\b/.test(t), d = /\b(direit[oa]s?|dir|passageiro)\b/.test(t);
  return e === d ? null : e ? 'E' : 'D';
}
/** Frente ou trás: o que o nome diz; senão a zona do grupo (farol é da frente); senão null. */
export function zonaDa(nome: string, grupo: string | null): Zona | null {
  const t = sem(nome);
  const f = /\b(diant\w*|frontal|frente|dianteir\w*)\b/.test(t), tr = /\b(tras\w*|traseir\w*|posterior)\b/.test(t);
  if (f !== tr) return f ? 'frente' : 'tras';
  return (grupo && GRUPOS[grupo]?.zona) || null;
}
const primeira = (n: string) => sem(n).split(/\s+/)[0] || '';
/** Os grupos de motor (admissão, injeção, turbo, cabeçote...). */
export const GRUPOS_MOTOR = new Set(['coxim', 'correia', 'distribuicao', 'turbo-valvula', 'cabecote', 'motor-baixo', 'admissao', 'injecao',
  'combustivel', 'sensor-motor', 'turbo', 'escape', 'bobina', 'alternador', 'arranque', 'arrefecimento', 'modulo-injecao']);
/** Nome que não é de motor (tampa traseira, porta-malas, rebatimento, banco, porta): nunca entra num grupo de motor, nem
 *  com tipo errado no estoque (o "Comando rebatimento tampa" já foi "Comandos de Válvulas": revisão 12, P2.2). O banco
 *  do motor ("Sonda lambda banco 1") fica. */
export const FORA_DO_MOTOR = /tampa traseira|porta-?malas|rebatimento|\bbancos?\b(?!\s*\d)|\bportas?\b/;

/** As peças que vão junto com `p`: só do MESMO carro (marca + o modelo de `p`, também as de 2+ carros que servem nele) e
 *  da MESMA geração (anos que se sobrepõem, mesmaGeracao); nunca outro lado nem a outra ponta do carro; nunca a mesma
 *  peça repetida (mesmo código, ou mesmo tipo com o mesmo nome de começo: outro "Farol"). Mistura os grupos (1 de cada, na
 *  ordem de JUNTO, depois a 2ª de cada...), o mesmo lado/posição primeiro. `com`: o fim da frase do subtítulo. */
export function vaiJunto(p: PecaJunto, doCarro: readonly PecaJunto[], max = MAX_JUNTO): { pecas: PecaJunto[]; com: string } {
  const g = grupoDa(p);
  const alvos = g ? JUNTO[g] : undefined;
  const nada = { pecas: [], com: '' };
  const anos = p.m ? anosNoModelo(p, p.m) : null;
  if (!g || !alvos || !p.b || !p.m || !anos) return nada;
  const lado = ladoDa(p.n), zona = zonaDa(p.n, g);
  // os códigos gravados (um anúncio pode trazer 2 ou mais): nenhuma peça com um código que a peça já tem, nem repetida na lista
  const cods = codigosDe(p);
  const nomeP = sem(p.n);
  const filas = new Map<string, { x: PecaJunto; nota: number }[]>(alvos.map((k) => [k, []]));
  for (const x of doCarro) {
    if (x.id === p.id || x.b !== p.b || !serveNoModelo(x, p.m)) continue;
    if ([...codigosDe(x)].some((c) => cods.has(c))) continue;
    // a tampa de válvula não vai junto com bobina nem sensor (são peças elétricas do cabeçote, não da tampa)
    if (TAMPAS.has(x.s) && (g === 'bobina' || g === 'sensor-motor') && x.s !== p.s) continue;
    if (!mesmaGeracao(anos, anosNoModelo(x, p.m))) continue;
    const gx = grupoDa(x);
    if (!gx || !filas.has(gx)) continue;
    if ((GRUPOS_MOTOR.has(g) || GRUPOS_MOTOR.has(gx)) && FORA_DO_MOTOR.test(sem(x.n))) continue;
    if (x.s === p.s && primeira(x.n) === primeira(p.n)) continue;
    const lx = ladoDa(x.n), zx = zonaDa(x.n, gx);
    if (lado && lx && lado !== lx) continue;
    if (zona && zx && zona !== zx) continue;
    filas.get(gx)!.push({ x, nota: (lado && lx === lado ? 2 : 0) + (zona && zx === zona ? 1 : 0) });
  }
  for (const f of filas.values()) f.sort((a, b) => b.nota - a.nota || a.x.n.localeCompare(b.x.n, 'pt-BR') || (a.x.id < b.x.id ? -1 : 1));
  // 1ª volta: a melhor de cada grupo, sem repetir tipo; depois as seguintes, até `max`
  const pecas: PecaJunto[] = [];
  const tipos = new Set<string>(), nomes = new Set<string>(), usados = new Set<string>();
  for (let volta = 0; pecas.length < max && volta < max; volta++) {
    for (const k of alvos) {
      const f = filas.get(k)!;
      // o mesmo nome duas vezes (duas "Caixa fusível BSI" de anos diferentes) não: a 2ª sai da fila
      const livre = (c: { x: PecaJunto }) => sem(c.x.n) !== nomeP && !nomes.has(sem(c.x.n)) && ![...codigosDe(c.x)].some((k) => usados.has(k));
      while (f.length && !livre(f[0])) f.shift();
      const i = volta === 0 ? f.findIndex((c) => !tipos.has(c.x.s) && livre(c)) : 0;
      if (i < 0 || !f[i]) continue;
      const [c] = f.splice(i, 1);
      pecas.push(c.x);
      tipos.add(c.x.s);
      nomes.add(sem(c.x.n));
      codigosDe(c.x).forEach((k) => usados.add(k));
      if (pecas.length >= max) break;
    }
  }
  return pecas.length ? { pecas, com: GRUPOS[g].com } : nada;
}
