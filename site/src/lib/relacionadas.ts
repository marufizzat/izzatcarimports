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

// ---- "Vai junto": 1 a 3 peças do MESMO carro (e da mesma geração) que entram NO MESMO SERVIÇO que esta ----
// Regra de oficina (rodada 15; a tabela de antes juntava grupos largos: "Botão desembaçador -> Botão pisca-alerta",
// "Luva eixo -> Cabeçote, Biela"): cada peça tem um PAPEL (o tipo `s` + o que o nome diz: "Suporte farol", "Mangueira
// radiador", "Moldura botão vidro") e cada papel lista os papéis que o mecânico ou o funileiro troca ou precisa JUNTO, do
// mais ligado ao menos: farol -> suporte e friso do farol, guia do para-choque, para-choque, grade; bomba d'água ->
// termostática, tensor, mangueiras; radiador -> ventoinha, mangueiras do radiador, reservatório; amortecedor -> coxim,
// mola e bieleta do mesmo eixo; máquina de vidro -> botão do vidro e forro da MESMA porta; fechadura -> maçaneta e miolo
// da mesma porta; turbina -> mangueiras, intercooler, válvula; lanterna -> a outra lanterna do mesmo lado, soquete, guia
// do para-choque; retrovisor -> capa do mesmo lado. Papel sem companheiro de serviço (botão do pisca-alerta, sensor
// solto, capa do motor...) não tem "Vai junto". Lado e posição têm de bater quando a peça tem (regra em `casa`); sem
// companheira certa no estoque daquele carro, nada (o bloco não aparece): poucas e certas valem mais que muitas.
export type Zona = 'frente' | 'tras';
type Papel = {
  /** tipos (`s`) em que o papel aparece */
  t: string[];
  /** o nome (sem acento, minúsculo) tem de bater / não pode bater */
  n?: RegExp; x?: RegExp;
  /** a ponta do carro quando o nome não diz (farol é da frente, lanterna é de trás) */
  z?: Zona;
  /** peça que existe uma de cada lado: sem o lado no nome não dá para dizer que é "a do mesmo lado" */
  lat?: 1;
  /** peça que existe na frente e atrás (para-choque, amortecedor): idem para a posição */
  fz?: 1;
  /** peça de porta: a porta (lado + dianteira/traseira) tem de ser a MESMA, também quando nenhuma das duas diz */
  porta?: 1;
  /** só vale para a peça que diz o lado ("Acabamento interno retrovisor esquerdo" é do retrovisor de fora) */
  lado?: 1;
  /** peça que existe "central" e "lateral" (difusor de ar): tem de ser igual */
  meio?: 1;
  /** conjunto de peças de nome parecido (mangueiras, coxins, braços): a companheira do MESMO papel pode começar pela
   *  mesma palavra ("Mangueira superior radiador" e "Mangueira inferior radiador"). Sem isto, do mesmo papel só entra a de
   *  outro começo ("Motor limpador" e "Braço limpador"; nunca "Sirene alarme" e "Sirena alarme antifurto") */
  jogo?: 1;
  /** o fim da frase "…que costumam ser trocadas com o farol" */
  com: string;
  /** os papéis que vão junto, do mais ligado ao menos (o próprio papel = outra peça do mesmo conjunto, com outro nome) */
  j: string[];
};
/** A ordem conta: a peça cai no 1º papel que serve (os afinados pelo nome antes dos gerais do mesmo tipo). */
export const PAPEIS: Record<string, Papel> = {
  // ---- frente (batida de frente) ----
  farol: { t: ['Faróis'], z: 'frente', lat: 1, com: 'o farol', j: ['farol-suporte', 'farol-friso', 'farol-modulo', 'esguicho-farol', 'milha', 'guia-parachoque', 'parachoque', 'grade'] },
  milha: { t: ['Faróis de Milha'], z: 'frente', lat: 1, com: 'o farol de milha', j: ['parachoque', 'grade', 'farol'] },
  'farol-suporte': { t: ['Suportes do Farol'], n: /farol/, z: 'frente', lat: 1, com: 'o suporte do farol', j: ['farol', 'farol-friso', 'guia-parachoque'] },
  'farol-friso': { t: ['Frisos dos Faróis'], z: 'frente', lat: 1, com: 'o friso do farol', j: ['farol', 'farol-suporte'] },
  'farol-modulo': { t: ['Módulos e Reatores do Farol'], z: 'frente', com: 'o módulo do farol', j: ['farol'] },
  'esguicho-farol': { t: ['Bombas e Esguichos do Lavador'], n: /farol/, z: 'frente', lat: 1, com: 'o esguicho do farol', j: ['farol', 'parachoque'] },
  parachoque: { t: ['Para-choques'], fz: 1, com: 'o para-choque', j: ['alma', 'guia-parachoque', 'grade', 'parachoque-moldura', 'refletor', 'lanterna-parachoque'] },
  alma: { t: ['Almas do Para-choque'], x: /tunel/, fz: 1, com: 'a alma do para-choque', j: ['parachoque', 'guia-parachoque', 'grade'] },
  'guia-parachoque': { t: ['Guias e Suportes do Para-choque'], n: /para-?choque/, lat: 1, fz: 1, com: 'a guia do para-choque', j: ['parachoque', 'alma', 'farol', 'lanterna', 'refletor'] },
  'parachoque-moldura': { t: ['Molduras do Para-choque'], n: /para-?choque/, fz: 1, com: 'a moldura do para-choque', j: ['parachoque', 'grade'] },
  grade: { t: ['Grades do Para-choque', 'Grades'], x: /defletor/, z: 'frente', com: 'a grade', j: ['parachoque', 'alma', 'emblema-grade', 'grade'] },
  'emblema-grade': { t: ['Emblemas'], n: /grade/, z: 'frente', com: 'o emblema da grade', j: ['grade'] },
  'capo-dobradica': { t: ['Dobradiças do Capô'], z: 'frente', lat: 1, com: 'a dobradiça do capô', j: ['capo-fechadura', 'capo-mola', 'capo-isolamento'] },
  'capo-fechadura': { t: ['Fechaduras do Capô'], x: /ativo/, z: 'frente', com: 'a fechadura do capô', j: ['capo-cabo', 'capo-dobradica', 'capo-mola'] },
  'capo-cabo': { t: ['Cabos e Alavancas de Abertura'], n: /(cabo|alavanca|puxador).*capo/, z: 'frente', com: 'a abertura do capô', j: ['capo-fechadura', 'capo-cabo'] },
  'capo-mola': { t: ['Amortecedores da Tampa e do Capô'], n: /capo/, z: 'frente', com: 'o amortecedor do capô', j: ['capo-dobradica', 'capo-fechadura'] },
  'capo-isolamento': { t: ['Isolamentos do Capô'], n: /capo/, z: 'frente', com: 'o forro do capô', j: ['capo-dobradica'] },
  paralama: { t: ['Para-lamas'], z: 'frente', lat: 1, com: 'o para-lama', j: ['paralama-moldura', 'para-barro', 'paralama-suporte', 'guia-parachoque', 'farol'] },
  'paralama-moldura': { t: ['Molduras do Para-lama', 'Molduras Laterais'], n: /para-?lama/, lat: 1, com: 'a moldura do para-lama', j: ['paralama', 'para-barro'] },
  'para-barro': { t: ['Para-barros'], lat: 1, fz: 1, com: 'o para-barro', j: ['paralama', 'paralama-moldura'] },
  'paralama-suporte': { t: ['Suportes da Carroceria', 'Guias e Suportes do Para-choque'], n: /para-?lama/, lat: 1, com: 'o suporte do para-lama', j: ['paralama'] },
  // ---- arrefecimento ----
  radiador: { t: ['Radiadores'], com: 'o radiador', j: ['ventoinha', 'mang-radiador', 'radiador-suporte', 'radiador-defletor', 'reservatorio-agua', 'rele-ventoinha'] },
  'radiador-suporte': { t: ['Suportes do Radiador'], com: 'o suporte do radiador', j: ['radiador', 'radiador-defletor', 'ventoinha'] },
  'radiador-defletor': { t: ['Defletores'], n: /radiador/, com: 'o defletor do radiador', j: ['radiador', 'radiador-suporte'] },
  ventoinha: { t: ['Eletroventiladores', 'Motores de Ventilador'], com: 'a ventoinha', j: ['rele-ventoinha', 'radiador', 'radiador-defletor'] },
  'rele-ventoinha': { t: ['Relés da Ventoinha'], com: 'o módulo da ventoinha', j: ['ventoinha', 'radiador'] },
  'bomba-agua-aux-peca': { t: ['Bombas de Água'], n: /auxiliar/, x: /^bomba/, com: 'esta peça da bomba auxiliar', j: ['bomba-agua-aux'] },
  'bomba-agua-aux': { t: ['Bombas de Água'], n: /auxiliar/, com: "a bomba d'água auxiliar", j: ['bomba-agua-aux-peca'] },
  'bomba-agua': { t: ['Bombas de Água'], n: /^bomba/, com: "a bomba d'água", j: ['termostatica', 'bomba-agua-peca', 'mang-bomba-agua', 'tensor-correia'] },
  'bomba-agua-peca': { t: ['Bombas de Água'], com: "esta peça da bomba d'água", j: ['bomba-agua'] },
  termostatica: { t: ['Válvulas Termostáticas'], com: 'a válvula termostática', j: ['termostatica', 'bomba-agua', 'sensor-temp'] },
  'sensor-temp': { t: ['Sensores de Temperatura'], x: /turbina|intern|interior/, com: 'o sensor de temperatura', j: ['termostatica'] },
  'reservatorio-agua': { t: ['Reservatórios de Água'], x: /inversor/, com: 'o reservatório de água', j: ['reservatorio-agua', 'mang-reservatorio'] },
  'mang-bomba-agua': { t: ['Mangueiras de Arrefecimento'], n: /bomba (d')?agua/, com: "a mangueira da bomba d'água", j: ['bomba-agua', 'mang-arref'] },
  'mang-reservatorio': { t: ['Mangueiras de Arrefecimento'], n: /reservatorio/, com: 'a mangueira do reservatório', j: ['reservatorio-agua'] },
  'mang-radiador': { t: ['Mangueiras de Arrefecimento'], n: /radiador/, jogo: 1, com: 'a mangueira do radiador', j: ['radiador', 'mang-radiador'] },
  'mang-arref': { t: ['Mangueiras de Arrefecimento'], n: /^mangueira/, jogo: 1, com: 'a mangueira de arrefecimento', j: ['mang-arref', 'mang-radiador'] },
  'mang-calefacao': { t: ['Mangueiras de Calefação'], jogo: 1, com: 'a mangueira do ar quente', j: ['rad-ar-quente', 'mang-calefacao', 'valvula-calefacao'] },
  'rad-ar-quente': { t: ['Radiadores do Ar Quente'], n: /quente|calefa/, com: 'o radiador do ar quente', j: ['mang-calefacao', 'valvula-calefacao', 'caixa-ar'] },
  'valvula-calefacao': { t: ['Válvulas da Calefação'], com: 'a válvula do aquecedor', j: ['mang-calefacao', 'rad-ar-quente'] },
  // ---- ar-condicionado ----
  compressor: { t: ['Compressores'], com: 'o compressor do ar', j: ['compressor-suporte', 'mang-ac', 'condensador', 'valvula-expansao', 'pressostato'] },
  'compressor-suporte': { t: ['Suportes do Compressor'], n: /compressor/, x: /modulo/, com: 'o suporte do compressor', j: ['compressor'] },
  'mang-ac': { t: ['Mangueiras de Ar Condicionado'], x: /dreno/, jogo: 1, com: 'a mangueira do ar-condicionado', j: ['compressor', 'condensador', 'valvula-expansao', 'pressostato', 'mang-ac'] },
  condensador: { t: ['Condensadores'], n: /condensador/, com: 'o condensador', j: ['compressor', 'mang-ac', 'radiador', 'ventoinha'] },
  'caixa-ar': { t: ['Evaporadores', 'Kits de Ar Condicionado', 'Condensadores'], com: 'a caixa de ar', j: ['valvula-expansao', 'ventilador-interno', 'resistencia-ar', 'rad-ar-quente', 'chicote-caixa-ar'] },
  'valvula-expansao': { t: ['Válvulas de Expansão'], com: 'a válvula de expansão', j: ['caixa-ar', 'mang-ac', 'compressor'] },
  'ventilador-interno': { t: ['Atuadores e Motores do Ar'], n: /ventila/, com: 'o ventilador interno', j: ['resistencia-ar', 'caixa-ar'] },
  'resistencia-ar': { t: ['Resistências e Relés do Ar'], com: 'a resistência do ar', j: ['ventilador-interno', 'caixa-ar'] },
  'comando-ac-moldura': { t: ['Comandos de Ar Condicionado'], n: /^moldura/, com: 'a moldura do comando do ar', j: ['comando-ac'] },
  'comando-ac': { t: ['Comandos de Ar Condicionado'], n: /^(comando|modulo)/, x: /tracao|teto/, com: 'o comando do ar', j: ['comando-ac-moldura', 'sensor-temp-interna'] },
  pressostato: { t: ['Sensores do Ar-condicionado'], n: /press/, com: 'o pressostato', j: ['mang-ac', 'compressor'] },
  'sensor-temp-interna': { t: ['Sensores do Ar-condicionado'], n: /temperatura/, com: 'o sensor de temperatura interna', j: ['comando-ac'] },
  'chicote-caixa-ar': { t: ['Chicotes Elétricos'], n: /evaporadora|caixa ar/, com: 'o chicote da caixa de ar', j: ['caixa-ar', 'ventilador-interno'] },
  // ---- motor: correia, partida e carga ----
  'coxim-motor': { t: ['Coxins do Motor'], n: /coxi[mn]|calco|^suporte (inferior |superior |lateral )?(do )?motor/, lat: 1, fz: 1, jogo: 1, com: 'o coxim do motor', j: ['coxim-motor', 'coxim-cambio'] },
  'coxim-cambio': { t: ['Coxins do Câmbio'], n: /coxi[mn]|calco|^suporte (inferior |superior )?(do )?cambio/, lat: 1, fz: 1, jogo: 1, com: 'o coxim do câmbio', j: ['coxim-cambio', 'coxim-motor'] },
  'tensor-correia': { t: ['Tensores de Correia'], com: 'o tensor da correia', j: ['alternador', 'alternador-suporte', 'bomba-agua', 'compressor'] },
  alternador: { t: ['Alternadores'], com: 'o alternador', j: ['tensor-correia', 'alternador-suporte', 'regulador', 'chicote-alternador'] },
  'alternador-suporte': { t: ['Suportes do Alternador'], n: /alternador/, com: 'o suporte do alternador', j: ['alternador', 'tensor-correia'] },
  regulador: { t: ['Reguladores de Voltagem'], com: 'o regulador de voltagem', j: ['alternador'] },
  'chicote-alternador': { t: ['Chicotes Elétricos'], n: /alternador/, com: 'o chicote do alternador', j: ['alternador'] },
  arranque: { t: ['Motores de Arranque'], com: 'o motor de arranque', j: ['rele-partida', 'bateria-cabo-positivo'] },
  'rele-partida': { t: ['Relés de Partida'], com: 'o relé de partida', j: ['arranque'] },
  'bobina-peca': { t: ['Bobinas de Ignição'], n: /^suporte/, com: 'o suporte da bobina', j: ['bobina'] },
  bobina: { t: ['Bobinas de Ignição'], com: 'a bobina', j: ['bobina-peca'] },
  // ---- injeção e combustível ----
  'chicote-bico': { t: ['Bicos Injetores', 'Flautas de Combustível', 'Módulos de Injeção', 'Chicotes Elétricos'], n: /^chicote.*(bico|flauta|injet)/, com: 'o chicote dos bicos', j: ['bico', 'flauta'] },
  'sensor-flauta': { t: ['Flautas de Combustível', 'Sensores de Pressão'], n: /^sensor/, com: 'o sensor de pressão do combustível', j: ['flauta', 'bomba-alta'] },
  bico: { t: ['Bicos Injetores'], n: /^(bico|kit)/, x: /oleo/, com: 'os bicos injetores', j: ['flauta', 'chicote-bico', 'sensor-flauta', 'cano-alta', 'bomba-alta'] },
  flauta: { t: ['Flautas de Combustível'], n: /^(flauta|kit)/, com: 'a flauta', j: ['bico', 'chicote-bico', 'sensor-flauta', 'cano-alta', 'bomba-alta'] },
  'cano-alta': { t: ['Canos dos Injetores'], n: /alta/, com: 'o cano de alta pressão', j: ['bomba-alta', 'flauta'] },
  'bomba-alta': { t: ['Bombas de Alta Pressão'], n: /^bomba/, com: 'a bomba de alta pressão', j: ['cano-alta', 'bomba-alta-suporte', 'flauta', 'sensor-flauta'] },
  'bomba-alta-suporte': { t: ['Bombas de Alta Pressão'], com: 'o suporte da bomba de alta', j: ['bomba-alta'] },
  'bomba-comb-modulo': { t: ['Bombas de Combustível'], n: /^(rele|modulo)/, com: 'o módulo da bomba de combustível', j: ['bomba-comb'] },
  'bomba-comb-peca': { t: ['Bombas de Combustível', 'Portinholas e Tampas do Tanque'], n: /(trava|anel|tampa|suporte).*bomba/, com: 'esta peça da bomba de combustível', j: ['bomba-comb'] },
  'bomba-comb': { t: ['Bombas de Combustível'], n: /^bomba/, com: 'a bomba de combustível', j: ['bomba-comb-peca', 'bomba-comb-modulo', 'boia'] },
  boia: { t: ['Boias de Combustível'], com: 'a boia do combustível', j: ['bomba-comb', 'tanque'] },
  tanque: { t: ['Tanques de Combustível'], n: /^tanque/, com: 'o tanque', j: ['tanque-peca', 'bomba-comb', 'boia'] },
  portinhola: { t: ['Portinholas e Tampas do Tanque', 'Tanques de Combustível'], n: /portinhola|tampa tanque/, com: 'a portinhola do tanque', j: ['portinhola-trava', 'portinhola'] },
  'tanque-peca': { t: ['Tanques de Combustível'], com: 'esta peça do tanque', j: ['tanque', 'tanque-peca'] },
  'portinhola-trava': { t: ['Cabos e Alavancas de Abertura'], n: /portinhola|tanque/, com: 'a abertura da portinhola', j: ['portinhola', 'portinhola-trava'] },
  canister: { t: ['Válvulas e Filtros Canister'], n: /canister/, jogo: 1, com: 'esta peça do canister', j: ['canister'] },
  // ---- admissão e turbo ----
  'tbi-flange': { t: ['Corpos de Borboleta'], n: /^flange/, com: 'a flange do corpo de borboleta', j: ['tbi'] },
  tbi: { t: ['Corpos de Borboleta'], n: /borboleta|tbi/, com: 'o corpo de borboleta', j: ['tbi-flange', 'coletor-adm', 'mang-filtro-ar', 'map'] },
  'coletor-adm': { t: ['Coletores de Admissão'], n: /^coletor/, com: 'o coletor de admissão', j: ['tbi', 'map', 'coletor-adm-peca'] },
  'coletor-adm-peca': { t: ['Coletores de Admissão'], x: /gaiola/, com: 'esta peça do coletor', j: ['coletor-adm'] },
  'caixa-filtro': { t: ['Caixas do Filtro de Ar'], x: /^suporte coletor/, com: 'a caixa do filtro de ar', j: ['caixa-filtro', 'duto-ar', 'mang-filtro-ar', 'maf'] },
  'duto-ar': { t: ['Mangueiras de Admissão'], n: /ressonador|captador|entrada/, x: /respiro/, com: 'o duto de entrada de ar', j: ['caixa-filtro'] },
  maf: { t: ['Sensores MAF'], com: 'o sensor MAF', j: ['caixa-filtro', 'mang-filtro-ar'] },
  map: { t: ['Sensores MAP'], x: /turbina/, com: 'o sensor MAP', j: ['coletor-adm', 'tbi'] },
  'mang-respiro': { t: ['Mangueiras de Admissão', 'Mangueiras e Linhas do Motor'], n: /respiro/, com: 'a mangueira do respiro', j: ['tampa-valvulas', 'valvula-pcv'] },
  'mang-filtro-ar': { t: ['Mangueiras de Admissão'], n: /filtro|duto|admissao|tubo/, x: /intercooler|turbina|arrefecimento|abracadeira/, com: 'a mangueira do filtro de ar', j: ['caixa-filtro', 'maf', 'tbi'] },
  'turbo-valvula': { t: ['Válvulas Solenoides', 'Turbinas'], n: /valvula.*(turb|waste)/, com: 'a válvula do turbo', j: ['turbina'] },
  turbina: { t: ['Turbinas'], n: /^turbina/, com: 'a turbina', j: ['mang-turbo', 'intercooler', 'turbo-valvula', 'turbina-peca', 'coletor-escape'] },
  'mang-turbo': { t: ['Mangueiras do Turbo e Intercooler'], n: /intercooler|turbina|pressuriza/, x: /oleo|vacuo|solenoide|agua/, jogo: 1, com: 'a mangueira do turbo', j: ['mang-turbo', 'intercooler', 'turbina'] },
  'turbina-peca': { t: ['Turbinas', 'Mangueiras e Linhas do Motor', 'Mangueiras do Turbo e Intercooler'], n: /turbina/, com: 'esta peça da turbina', j: ['turbina'] },
  intercooler: { t: ['Intercoolers'], n: /^intercooler/, com: 'o intercooler', j: ['mang-turbo', 'turbina'] },
  // ---- cabeçote, distribuição e parte de baixo ----
  'tampa-valvulas': { t: ['Tampas de Válvulas'], n: /^tampa/, com: 'a tampa de válvulas', j: ['mang-respiro', 'valvula-pcv', 'tampa-oleo'] },
  'tampa-oleo': { t: ['Tampas de Óleo'], com: 'a tampa do óleo', j: ['tampa-valvulas'] },
  'valvula-pcv': { t: ['Válvulas Solenoides'], n: /pcv/, com: 'a válvula PCV', j: ['tampa-valvulas', 'mang-respiro'] },
  cabecote: { t: ['Cabeçotes'], n: /^cabecote/, com: 'o cabeçote', j: ['parafuso-cabecote', 'comando', 'tampa-valvulas'] },
  'parafuso-cabecote': { t: ['Parafusos do Cabeçote'], com: 'os parafusos do cabeçote', j: ['cabecote'] },
  comando: { t: ['Comandos de Válvulas'], n: /comando/, com: 'o comando de válvulas', j: ['polia-vvt', 'distribuicao', 'solenoide-vvt', 'cabecote'] },
  'polia-vvt': { t: ['Peças da Distribuição'], n: /vvt|polia.*comando/, com: 'a polia do comando', j: ['solenoide-vvt', 'comando', 'distribuicao'] },
  distribuicao: { t: ['Peças da Distribuição', 'Tensores de Corrente', 'Tampas da Distribuição'], x: /^tampa (do )?motor/, jogo: 1, com: 'esta peça da distribuição', j: ['distribuicao', 'polia-vvt', 'comando'] },
  'solenoide-vvt': { t: ['Válvulas Solenoides'], n: /vvt|comando|cabecote/, com: 'a solenoide do comando', j: ['polia-vvt', 'sensor-fase', 'comando'] },
  'sensor-fase': { t: ['Sensores de Posição', 'Sensores de Rotação'], n: /comando|fase/, com: 'o sensor de fase', j: ['solenoide-vvt'] },
  biela: { t: ['Bielas'], com: 'a biela', j: ['pistao', 'bronzina', 'virabrequim'] },
  pistao: { t: ['Pistões'], com: 'os pistões', j: ['biela', 'bronzina'] },
  bronzina: { t: ['Bronzinas'], n: /bronzina/, com: 'as bronzinas', j: ['biela', 'virabrequim'] },
  virabrequim: { t: ['Virabrequins'], n: /^(virabrequim|eixo virabrequim)/, com: 'o virabrequim', j: ['virabrequim-peca', 'biela', 'bronzina', 'volante-motor'] },
  'virabrequim-peca': { t: ['Virabrequins', 'Blocos do Motor', 'Retentores'], n: /virabrequim|retentor/, com: 'esta peça do virabrequim', j: ['virabrequim'] },
  carter: { t: ['Cárteres'], com: 'o cárter', j: ['carter', 'bomba-oleo', 'sensor-oleo'] },
  'cambio-oleo': { t: ['Bombas de Óleo', 'Radiadores de Óleo'], n: /cambio/, com: 'esta peça do óleo do câmbio', j: ['cambio'] },
  'bomba-oleo': { t: ['Bombas de Óleo'], com: 'a bomba de óleo', j: ['carter', 'bomba-oleo', 'sensor-oleo'] },
  'filtro-oleo': { t: ['Suportes do Filtro de Óleo', 'Radiadores de Óleo'], com: 'o suporte do filtro de óleo', j: ['filtro-oleo', 'sensor-oleo'] },
  'sensor-oleo': { t: ['Sensores de Pressão do Óleo'], n: /oleo/, com: 'o sensor de pressão do óleo', j: ['filtro-oleo', 'bomba-oleo'] },
  'bomba-vacuo': { t: ['Bombas de Vácuo'], n: /^bomba vacuo( freio)?$/, com: 'a bomba de vácuo', j: ['hidrovacuo', 'mang-vacuo-freio'] },
  // ---- escapamento ----
  catalisador: { t: ['Catalisadores'], n: /^catalisador/, com: 'o catalisador', j: ['catalisador-peca', 'sonda', 'coletor-escape', 'flexivel'] },
  'catalisador-peca': { t: ['Catalisadores'], com: 'esta peça do catalisador', j: ['catalisador'] },
  sonda: { t: ['Sondas Lambda'], com: 'a sonda lambda', j: ['catalisador'] },
  'coletor-escape-peca': { t: ['Coletores de Escapamento'], n: /defletor/, com: 'o defletor do coletor', j: ['coletor-escape'] },
  'coletor-escape': { t: ['Coletores de Escapamento'], n: /^coletor escape/, com: 'o coletor de escape', j: ['coletor-escape-peca', 'catalisador', 'turbina'] },
  flexivel: { t: ['Tubos Flexíveis'], com: 'o flexível do escapamento', j: ['catalisador'] },
  // ---- módulos, chave e bateria ----
  'modulo-injecao-suporte': { t: ['Módulos de Injeção'], n: /^suporte/, com: 'o suporte do módulo de injeção', j: ['modulo-injecao'] },
  'modulo-injecao': { t: ['Módulos de Injeção'], n: /^(modulo|kit)/, com: 'o módulo de injeção', j: ['modulo-injecao-suporte', 'imobilizador', 'cilindro-ignicao', 'chave'] },
  imobilizador: { t: ['Módulos de Ignição e Imobilizador'], n: /imobilizador|mobilizador/, com: 'o imobilizador', j: ['imobilizador', 'cilindro-ignicao', 'modulo-injecao', 'chave'] },
  'cilindro-ignicao': { t: ['Cilindros e Comutadores de Ignição'], com: 'o cilindro de ignição', j: ['imobilizador', 'chave', 'modulo-injecao'] },
  chave: { t: ['Chaves do Carro'], com: 'a chave', j: ['keyless-modulo', 'start-stop', 'imobilizador', 'cilindro-ignicao'] },
  'keyless-modulo': { t: ['Antenas e Módulos Keyless'], n: /^modulo/, com: 'o módulo keyless', j: ['keyless-antena', 'chave', 'start-stop'] },
  'keyless-antena': { t: ['Antenas e Módulos Keyless'], com: 'a antena do keyless', j: ['keyless-modulo'] },
  'start-stop': { t: ['Botões de Partida'], com: 'o botão de partida', j: ['start-stop', 'keyless-modulo', 'chave'] },
  alarme: { t: ['Alarmes e Sirenes', 'Outros Sensores'], n: /alarme/, com: 'esta peça do alarme', j: ['alarme'] },
  'fusiveis-tampa': { t: ['Tampas da Caixa de Fusíveis', 'Caixas de Fusíveis'], n: /^(tampa|moldura|acabamento)/, x: /bateria/, com: 'a tampa da caixa de fusíveis', j: ['fusiveis'] },
  'fusiveis-suporte': { t: ['Caixas de Fusíveis'], n: /^suporte/, com: 'o suporte da caixa de fusíveis', j: ['fusiveis'] },
  fusiveis: { t: ['Caixas de Fusíveis'], n: /^caixa/, com: 'a caixa de fusíveis', j: ['fusiveis-tampa', 'fusiveis-suporte'] },
  'bateria-cabo-positivo': { t: ['Cabos e Terminais de Bateria'], n: /^(cabo|chicote).*positivo/, com: 'o cabo positivo da bateria', j: ['bateria-cabo', 'arranque'] },
  'bateria-cabo': { t: ['Cabos e Terminais de Bateria'], com: 'o cabo da bateria', j: ['bateria-cabo-positivo'] },
  'bateria-suporte': { t: ['Caixas e Suportes da Bateria'], com: 'o suporte da bateria', j: ['bateria-suporte'] },
  'ponto-cego': { t: ['Sensores de Estacionamento'], n: /radar|ponto cego/, lat: 1, com: 'o radar de ponto cego', j: ['ponto-cego'] },
  'estac-display': { t: ['Sensores de Estacionamento'], n: /display|botao/, com: 'esta peça do sensor de estacionamento', j: ['estac-modulo', 'estac-sensor'] },
  'estac-modulo': { t: ['Sensores de Estacionamento'], n: /^modulo.*(estacionamento|pdc)/, com: 'o módulo do sensor de estacionamento', j: ['estac-sensor', 'estac-display'] },
  'estac-sensor': { t: ['Sensores de Estacionamento'], n: /^sensor/, com: 'o sensor de estacionamento', j: ['estac-modulo', 'estac-display'] },
  'camera-re': { t: ['Câmeras de Ré'], z: 'tras', com: 'a câmera de ré', j: ['camera-re'] },
  // ---- freios ----
  'mang-vacuo-freio': { t: ['Hidrovácuos', 'Mangueiras e Flexíveis do Freio', 'Mangueiras e Linhas do Motor'], n: /(mangueira|tubo).*(hidrovacuo|servo|vacuo freio)/, com: 'a mangueira do hidrovácuo', j: ['hidrovacuo', 'bomba-vacuo', 'sensor-hidrovacuo'] },
  'hidrovacuo-suporte': { t: ['Hidrovácuos'], n: /^suporte/, com: 'o suporte do hidrovácuo', j: ['hidrovacuo'] },
  hidrovacuo: { t: ['Hidrovácuos'], n: /^(hidrovacuo|servo)/, com: 'o hidrovácuo', j: ['cilindro-mestre', 'mang-vacuo-freio', 'hidrovacuo-suporte', 'sensor-hidrovacuo', 'reservatorio-freio', 'bomba-vacuo'] },
  'sensor-hidrovacuo': { t: ['Sensores do Freio'], n: /hidrovacuo|vacuo/, com: 'o sensor do hidrovácuo', j: ['hidrovacuo', 'mang-vacuo-freio'] },
  'epb-modulo': { t: ['Outros', 'Cilindros Mestres'], n: /epb|modulo.*freio mao|atuador freio mao/, com: 'o módulo do freio de mão', j: ['epb-botao', 'pinca-peca'] },
  'cilindro-mestre': { t: ['Cilindros Mestres', 'Reservatórios de Fluido'], n: /^cilindro mestre/, com: 'o cilindro mestre', j: ['reservatorio-freio', 'hidrovacuo'] },
  'reservatorio-freio': { t: ['Reservatórios de Fluido'], com: 'o reservatório do fluido de freio', j: ['cilindro-mestre', 'hidrovacuo'] },
  'abs-suporte': { t: ['Módulos ABS'], n: /^suporte/, com: 'o suporte do módulo ABS', j: ['abs'] },
  abs: { t: ['Módulos ABS'], n: /^modulo.*abs/, com: 'o módulo ABS', j: ['abs-suporte', 'abs-tubo'] },
  'abs-tubo': { t: ['Mangueiras e Flexíveis do Freio'], n: /abs/, com: 'o tubo do ABS', j: ['abs'] },
  'sensor-abs': { t: ['Sensores ABS'], lat: 1, fz: 1, com: 'o sensor ABS', j: ['sensor-abs', 'cubo', 'manga'] },
  pinca: { t: ['Pinças de Freio'], n: /^pinca/, lat: 1, fz: 1, com: 'a pinça de freio', j: ['pinca-peca', 'flexivel-freio', 'espelho-disco', 'manga'] },
  'pinca-peca': { t: ['Pinças de Freio'], lat: 1, fz: 1, com: 'esta peça da pinça', j: ['pinca', 'epb-modulo'] },
  'flexivel-freio': { t: ['Mangueiras e Flexíveis do Freio'], n: /flexivel/, lat: 1, fz: 1, com: 'o flexível do freio', j: ['pinca'] },
  'espelho-disco': { t: ['Espelhos e Defletores do Disco'], lat: 1, fz: 1, com: 'o espelho do disco', j: ['pinca', 'manga', 'cubo'] },
  'epb-botao': { t: ['Botões do Freio de Mão', 'Alavancas do Freio de Mão'], n: /botao/, com: 'o botão do freio de mão', j: ['epb-modulo', 'pinca-peca'] },
  'freio-mao-acab': { t: ['Alavancas do Freio de Mão'], n: /^(moldura|acabamento)/, com: 'o acabamento do freio de mão', j: ['freio-mao'] },
  'freio-mao': { t: ['Alavancas do Freio de Mão'], com: 'a alavanca do freio de mão', j: ['freio-mao-acab', 'freio-mao-cabo'] },
  'freio-mao-cabo': { t: ['Cabo do Freio de Mão'], com: 'o cabo do freio de mão', j: ['freio-mao'] },
  'pedal-freio-peca': { t: ['Pedais'], n: /(suporte|reparo).*(freio|embreagem)/, com: 'esta peça do pedal', j: ['pedal-freio'] },
  'pedal-freio': { t: ['Pedais'], n: /^pedal.*(freio|embreagem)/, com: 'o pedal', j: ['pedal-freio-peca', 'sensor-pedal-freio'] },
  'sensor-pedal-freio': { t: ['Sensores do Freio'], n: /pedal/, com: 'o sensor do pedal de freio', j: ['pedal-freio'] },
  'pedal-acel-peca': { t: ['Pedais'], n: /suporte pedal acelerador/, com: 'o suporte do pedal', j: ['pedal-acel'] },
  'pedal-acel': { t: ['Pedais'], n: /^pedal.*acelerador/, com: 'o pedal do acelerador', j: ['pedal-acel-peca'] },
  // ---- suspensão, direção e câmbio ----
  amortecedor: { t: ['Amortecedores'], lat: 1, fz: 1, com: 'o amortecedor', j: ['coxim-amortecedor', 'mola', 'bieleta'] },
  'coxim-amortecedor': { t: ['Coxins do Amortecedor'], n: /coxim|batente/, lat: 1, fz: 1, com: 'o coxim do amortecedor', j: ['amortecedor', 'mola'] },
  'mola-suporte': { t: ['Molas'], n: /suporte/, fz: 1, com: 'o suporte da mola', j: ['mola'] },
  mola: { t: ['Molas'], x: /feixe/, fz: 1, com: 'a mola', j: ['amortecedor', 'coxim-amortecedor', 'mola-suporte'] },
  bieleta: { t: ['Bieletas e Barras Estabilizadoras'], n: /bieleta/, lat: 1, fz: 1, com: 'a bieleta', j: ['barra-estab', 'amortecedor', 'bandeja'] },
  'barra-estab': { t: ['Bieletas e Barras Estabilizadoras'], fz: 1, com: 'a barra estabilizadora', j: ['bieleta'] },
  'bandeja-peca': { t: ['Bandejas da Suspensão'], n: /^(suporte|protecao|protetor)/, lat: 1, fz: 1, com: 'esta peça da bandeja', j: ['bandeja'] },
  bandeja: { t: ['Bandejas da Suspensão', 'Braços da Suspensão'], lat: 1, fz: 1, jogo: 1, com: 'a bandeja', j: ['bandeja-peca', 'manga', 'bieleta', 'bucha', 'bandeja'] },
  bucha: { t: ['Buchas de Suspensão'], com: 'a bucha da bandeja', j: ['bandeja'] },
  manga: { t: ['Mangas de Eixo'], lat: 1, fz: 1, com: 'a manga de eixo', j: ['cubo', 'bandeja', 'sensor-abs', 'espelho-disco', 'pinca'] },
  cubo: { t: ['Cubos de Roda'], lat: 1, fz: 1, com: 'o cubo de roda', j: ['manga', 'sensor-abs'] },
  'coluna-dir-peca': { t: ['Colunas de Direção'], n: /cruzeta|cavalete|trava|suporte/, com: 'esta peça da coluna de direção', j: ['coluna-dir'] },
  'modulo-dir': { t: ['Colunas de Direção'], n: /^modulo/, com: 'o módulo da direção elétrica', j: ['coluna-dir', 'caixa-dir'] },
  'coluna-dir': { t: ['Colunas de Direção'], n: /^coluna/, com: 'a coluna de direção', j: ['coluna-dir-peca', 'modulo-dir', 'caixa-dir'] },
  'caixa-dir': { t: ['Caixas de Direção'], com: 'a caixa de direção', j: ['coluna-dir', 'modulo-dir'] },
  'bomba-dir-suporte': { t: ['Bombas de Direção e Suportes'], n: /^suporte/, com: 'o suporte da bomba de direção', j: ['bomba-dir'] },
  'bomba-dir': { t: ['Bombas de Direção e Suportes'], n: /^bomba/, com: 'a bomba de direção', j: ['bomba-dir-suporte', 'mang-dir'] },
  'mang-dir': { t: ['Mangueiras da Direção'], com: 'a mangueira da direção', j: ['bomba-dir'] },
  'susp-ar': { t: ['Suspensão a Ar e Nivelamento'], com: 'esta peça da suspensão a ar', j: ['susp-ar'] },
  'semieixo-suporte': { t: ['Semieixos', 'Semieixos e Suportes'], n: /^suporte/, com: 'o suporte do semieixo', j: ['semieixo'] },
  semieixo: { t: ['Semieixos', 'Semieixos e Suportes'], n: /^semieixo/, lat: 1, com: 'o semieixo', j: ['semieixo-suporte'] },
  'cambio-acab': { t: ['Alavancas e Manoplas de Câmbio', 'Trambuladores e Seletores', 'Consoles'], n: /^(moldura|coifa|acabamento).*(cambio|seletor|alavanca)/, com: 'o acabamento da alavanca', j: ['alavanca-cambio'] },
  'cabo-trambulador': { t: ['Alavancas e Manoplas de Câmbio', 'Trambuladores e Seletores'], n: /^(cabo|suporte|base)/, com: 'esta peça do trambulador', j: ['alavanca-cambio'] },
  'alavanca-cambio': { t: ['Alavancas e Manoplas de Câmbio', 'Trambuladores e Seletores'], n: /^(alavanca|trambulador|seletor|manopla)/, com: 'a alavanca do câmbio', j: ['cambio-acab', 'cabo-trambulador', 'alavanca-cambio'] },
  'modulo-tracao': { t: ['Módulos do Câmbio e da Tração'], n: /tracao/, com: 'o módulo de tração', j: ['transferencia'] },
  'modulo-cambio': { t: ['Módulos do Câmbio e da Tração'], n: /cambio|transmissao/, com: 'o módulo do câmbio', j: ['cambio'] },
  conversor: { t: ['Câmbios e Peças Internas'], n: /conversor/, com: 'o conversor de torque', j: ['cambio'] },
  cambio: { t: ['Câmbios e Peças Internas'], n: /^(cambio|caixa cambio)/, com: 'o câmbio', j: ['modulo-cambio', 'conversor', 'cambio-oleo', 'coxim-cambio'] },
  'diferencial-suporte': { t: ['Diferenciais'], n: /^(suporte|contrapeso)/, com: 'o suporte do diferencial', j: ['diferencial'] },
  diferencial: { t: ['Diferenciais'], n: /^diferencial/, com: 'o diferencial', j: ['diferencial-suporte', 'cardan', 'transferencia'] },
  cardan: { t: ['Cardans'], com: 'o cardan', j: ['diferencial'] },
  transferencia: { t: ['Caixas de Transferência'], com: 'a caixa de transferência', j: ['diferencial', 'modulo-tracao'] },
  'volante-motor': { t: ['Volantes de Embreagem'], com: 'o volante do motor', j: ['volante-motor'] },
  // ---- portas (a MESMA porta) ----
  'maquina-vidro-peca': { t: ['Peças da Máquina de Vidro', 'Grampos e Presilhas'], n: /maquina vidro/, porta: 1, com: 'esta peça da máquina de vidro', j: ['maquina-vidro'] },
  'maquina-vidro': { t: ['Máquinas e Motores de Vidro Elétrico', 'Máquinas de Vidro Manuais'], n: /^(motor|maquina)/, porta: 1, com: 'a máquina de vidro', j: ['botao-vidro', 'maquina-vidro-peca', 'guia-vidro', 'modulo-porta', 'forro-porta'] },
  'botao-vidro-moldura': { t: ['Botões do Vidro Elétrico'], n: /^moldura/, porta: 1, com: 'a moldura do botão do vidro', j: ['botao-vidro'] },
  'botao-vidro': { t: ['Botões do Vidro Elétrico'], porta: 1, com: 'o botão do vidro', j: ['botao-vidro-moldura', 'maquina-vidro'] },
  'guia-vidro': { t: ['Guias e Canaletas do Vidro'], porta: 1, com: 'a canaleta do vidro', j: ['maquina-vidro', 'guia-vidro'] },
  'modulo-porta': { t: ['Módulos de Conforto (BCM)'], n: /porta|vidro/, porta: 1, com: 'o módulo da porta', j: ['maquina-vidro', 'botao-vidro'] },
  'cilindro-porta': { t: ['Fechaduras das Portas'], n: /miolo|cilindro/, porta: 1, com: 'o miolo da fechadura', j: ['macaneta-ext', 'fechadura'] },
  'fechadura-peca': { t: ['Fechaduras das Portas'], n: /^(tampa|suporte)/, porta: 1, com: 'esta peça da fechadura', j: ['fechadura'] },
  fechadura: { t: ['Fechaduras das Portas'], n: /^(fechadura|trava|motor)/, x: /tampa|porta-?malas|banco|capo/, porta: 1, com: 'a fechadura', j: ['macaneta-ext', 'macaneta-int', 'macaneta-suporte', 'cabo-macaneta', 'cilindro-porta', 'fechadura-peca'] },
  'macaneta-moldura': { t: ['Maçanetas das Portas', 'Molduras Externas'], n: /^(moldura|tampa).*(macaneta|puxador)/, x: /interna/, porta: 1, com: 'a moldura da maçaneta', j: ['macaneta-ext'] },
  'macaneta-suporte': { t: ['Maçanetas das Portas'], n: /^(suporte|base)/, porta: 1, com: 'o suporte da maçaneta', j: ['macaneta-ext', 'fechadura'] },
  'macaneta-ext': { t: ['Maçanetas das Portas'], n: /^macaneta/, x: /interna|tampa|porta-?malas/, porta: 1, com: 'a maçaneta', j: ['macaneta-suporte', 'macaneta-moldura', 'fechadura', 'cilindro-porta'] },
  'macaneta-int-moldura': { t: ['Maçanetas Internas', 'Maçanetas das Portas', 'Puxadores das Portas'], n: /^(moldura|suporte).*(interna|puxador)/, porta: 1, com: 'a moldura da maçaneta interna', j: ['macaneta-int'] },
  'macaneta-int': { t: ['Maçanetas Internas'], n: /^(macaneta|puxador)/, x: /tampa/, porta: 1, com: 'a maçaneta interna', j: ['macaneta-int-moldura', 'cabo-macaneta', 'fechadura', 'forro-porta'] },
  'cabo-macaneta': { t: ['Cabos e Alavancas de Abertura'], n: /macaneta|fechadura|trinco/, x: /tampa/, porta: 1, com: 'o cabo da maçaneta', j: ['macaneta-int', 'fechadura'] },
  'forro-porta': { t: ['Forros'], n: /^forro (da )?portas?( |$)/, x: /malas/, porta: 1, com: 'o forro da porta', j: ['apoio-braco-porta', 'macaneta-int', 'botao-vidro', 'luz-porta', 'grade-af-porta'] },
  'apoio-braco-porta': { t: ['Apoios de Braço'], n: /porta/, porta: 1, com: 'o apoio de braço da porta', j: ['forro-porta'] },
  'luz-porta': { t: ['Luzes Internas'], n: /porta/, porta: 1, com: 'a luz da porta', j: ['forro-porta'] },
  'grade-af-porta': { t: ['Grades de Alto-falante'], n: /porta/, porta: 1, com: 'a grade do alto-falante da porta', j: ['forro-porta'] },
  'porta-dobradica': { t: ['Dobradiças e Limitadores de Porta'], porta: 1, com: 'esta peça da porta', j: ['porta-dobradica', 'porta'] },
  porta: { t: ['Portas'], porta: 1, com: 'a porta', j: ['porta-dobradica', 'fechadura', 'maquina-vidro', 'macaneta-ext'] },
  // ---- retrovisores ----
  'retrovisor-peca': { t: ['Retrovisores Externos'], n: /^motor/, lat: 1, com: 'o motor do retrovisor', j: ['retrovisor'] },
  retrovisor: { t: ['Retrovisores Externos'], lat: 1, com: 'o retrovisor', j: ['retrovisor-capa', 'retrovisor-peca'] },
  'retrovisor-capa': { t: ['Capas e Molduras do Retrovisor'], n: /retrovisor|espelho/, lado: 1, lat: 1, com: 'o acabamento do retrovisor', j: ['retrovisor'] },
  'retrovisor-interno-capa': { t: ['Capas e Molduras do Retrovisor'], n: /intern/, com: 'a capa do retrovisor interno', j: ['retrovisor-interno'] },
  'retrovisor-interno': { t: ['Retrovisores Internos'], com: 'o retrovisor interno', j: ['retrovisor-interno-capa'] },
  'botao-retrovisor-moldura': { t: ['Botões do Retrovisor', 'Capas e Molduras do Retrovisor'], n: /^moldura.*(botao|comando)/, com: 'a moldura do comando do retrovisor', j: ['botao-retrovisor'] },
  'botao-retrovisor': { t: ['Botões do Retrovisor'], com: 'o comando do retrovisor', j: ['botao-retrovisor-moldura'] },
  // ---- traseira ----
  'lanterna-peca': { t: ['Lanternas Traseiras'], n: /^(circuito|soquete|acabamento)/, z: 'tras', lat: 1, com: 'esta peça da lanterna', j: ['lanterna', 'lanterna-tampa'] },
  'lanterna-parachoque': { t: ['Lanternas Traseiras'], n: /para-?choque/, z: 'tras', lat: 1, com: 'a lanterna do para-choque', j: ['parachoque', 'refletor', 'guia-parachoque'] },
  'lanterna-tampa': { t: ['Lanternas Traseiras'], n: /^lanterna.*(tampa|mala)/, z: 'tras', lat: 1, com: 'a lanterna da tampa', j: ['lanterna', 'lanterna-peca'] },
  lanterna: { t: ['Lanternas Traseiras'], n: /^lanterna/, z: 'tras', lat: 1, com: 'a lanterna', j: ['lanterna-tampa', 'lanterna-peca', 'guia-parachoque', 'refletor'] },
  refletor: { t: ['Refletores'], z: 'tras', lat: 1, com: 'o refletor', j: ['parachoque', 'guia-parachoque', 'lanterna-parachoque', 'lanterna'] },
  'brake-moldura': { t: ['Brake Light'], n: /^moldura/, z: 'tras', com: 'a moldura do brake light', j: ['brake'] },
  brake: { t: ['Brake Light'], z: 'tras', com: 'o brake light', j: ['brake-moldura', 'aerofolio'] },
  aerofolio: { t: ['Aerofólios'], z: 'tras', com: 'o aerofólio', j: ['brake'] },
  'tampa-cabo': { t: ['Cabos e Alavancas de Abertura', 'Fechaduras do Porta-malas'], n: /(tirante|cabo).*(tampa|porta-?malas)/, z: 'tras', com: 'o cabo da tampa traseira', j: ['tampa-fechadura'] },
  'tampa-batente': { t: ['Fechaduras do Porta-malas'], n: /^(batente|acabamento)/, z: 'tras', com: 'o batente da tampa traseira', j: ['tampa-fechadura'] },
  'tampa-fechadura': { t: ['Fechaduras do Porta-malas'], n: /^(fechadura|trava|atuador)/, z: 'tras', com: 'a fechadura da tampa traseira', j: ['tampa-batente', 'tampa-botao', 'tampa-puxador', 'tampa-cabo'] },
  'tampa-botao': { t: ['Outros Botões', 'Botões da Trava Elétrica'], n: /porta-?malas|tampa traseira|^painel interruptor tampa/, x: /tanque/, z: 'tras', com: 'o botão da tampa traseira', j: ['tampa-fechadura', 'tampa-puxador'] },
  'tampa-puxador': { t: ['Acabamentos da Tampa Traseira', 'Puxadores das Portas', 'Alças e Puxadores'], n: /^puxador.*(tampa|porta-?malas)/, z: 'tras', com: 'o puxador da tampa traseira', j: ['tampa-fechadura', 'tampa-botao'] },
  'tampa-mola': { t: ['Amortecedores da Tampa e do Capô'], n: /tampa|porta-?malas/, z: 'tras', com: 'o amortecedor da tampa traseira', j: ['tampa-dobradica'] },
  'tampa-dobradica-acab': { t: ['Dobradiças da Tampa Traseira'], n: /^(moldura|acabamento)/, z: 'tras', com: 'o acabamento da dobradiça', j: ['tampa-dobradica'] },
  'tampa-dobradica': { t: ['Dobradiças da Tampa Traseira'], n: /^dobradica.*(tampa|porta-?malas)/, z: 'tras', com: 'a dobradiça da tampa traseira', j: ['tampa-mola', 'tampa-dobradica-acab'] },
  bagagito: { t: ['Tampões do Porta-malas'], n: /bagagito/, z: 'tras', com: 'esta peça do bagagito', j: ['bagagito'] },
  // ---- limpador e lavador ----
  'limpador-tras': { t: ['Motores do Limpador', 'Braços do Limpador'], n: /tampa|traseir/, x: /para-?brisa/, z: 'tras', com: 'o limpador traseiro', j: ['limpador-tras'] },
  limpador: { t: ['Motores do Limpador', 'Braços do Limpador'], n: /para-?brisa/, z: 'frente', com: 'o limpador do para-brisa', j: ['limpador', 'rele-limpador'] },
  'rele-limpador': { t: ['Relés'], n: /limpador/, com: 'o relé do limpador', j: ['limpador'] },
  lavador: { t: ['Reservatórios do Lavador', 'Bombas e Esguichos do Lavador'], com: 'esta peça do lavador', j: ['lavador'] },
  // ---- painel, som e interior ----
  'painel-instr-moldura': { t: ['Painéis de Instrumentos', 'Acabamentos do Painel'], n: /^moldura painel (de )?instrumentos?/, com: 'a moldura do painel de instrumentos', j: ['painel-instr'] },
  'painel-instr': { t: ['Painéis de Instrumentos'], n: /^(painel|velocimetro)/, com: 'o painel de instrumentos', j: ['painel-instr-moldura'] },
  'multimidia-moldura': { t: ['Molduras da Multimídia', 'Centrais Multimídia'], n: /^(moldura|carcaca)/, com: 'a moldura da multimídia', j: ['multimidia'] },
  'multimidia-suporte': { t: ['Suportes da Multimídia'], com: 'o suporte da multimídia', j: ['multimidia'] },
  'multimidia-comando': { t: ['Centrais Multimídia', 'Interfaces de Som'], n: /^comando/, com: 'o comando da multimídia', j: ['multimidia'] },
  'multimidia-modulo': { t: ['Interfaces de Som', 'Centrais Multimídia'], n: /^modulo/, com: 'o módulo da multimídia', j: ['multimidia'] },
  multimidia: { t: ['Centrais Multimídia', 'Rádios'], com: 'a multimídia', j: ['multimidia-moldura', 'multimidia-suporte', 'multimidia-comando', 'multimidia-modulo'] },
  amplificador: { t: ['Amplificadores'], com: 'o amplificador', j: ['subwoofer'] },
  subwoofer: { t: ['Alto-falantes'], n: /subwoofer/, com: 'o subwoofer', j: ['amplificador'] },
  antena: { t: ['Antenas'], com: 'a antena', j: ['antena'] },
  'porta-copos': { t: ['Porta-copos'], n: /porta-?copos/, com: 'o porta-copos', j: ['porta-copos'] },
  'porta-luvas': { t: ['Porta-luvas'], n: /porta-?luvas/, com: 'o porta-luvas', j: ['porta-luvas'] },
  'difusor-moldura': { t: ['Difusores de Ar'], n: /^(moldura|acabamento)/, x: /coluna|console|teto|tras/, lat: 1, meio: 1, com: 'a moldura do difusor', j: ['difusor'] },
  difusor: { t: ['Difusores de Ar'], n: /^difusor/, x: /coluna|console|teto|tras/, lat: 1, meio: 1, com: 'o difusor de ar', j: ['difusor-moldura'] },
  'capa-coluna': { t: ['Capas da Coluna de Direção'], n: /(superior|inferior)/, jogo: 1, com: 'a capa da coluna de direção', j: ['capa-coluna'] },
  'chave-seta': { t: ['Chaves de Seta e Luz', 'Chaves do Limpador'], n: /^chave (seta|luz)/, x: /limpador/, com: 'a chave de seta', j: ['chave-limpador'] },
  'chave-limpador': { t: ['Chaves de Seta e Luz', 'Chaves do Limpador'], n: /^chave limpador/, x: /seta/, com: 'a chave do limpador', j: ['chave-seta'] },
  'volante-tampa': { t: ['Volantes'], n: /tampa.*(buzina|volante)/, com: 'a tampa do volante', j: ['volante'] },
  'volante-botao': { t: ['Botões do Volante'], n: /volante|piloto|som|radio/, com: 'o comando do volante', j: ['volante'] },
  volante: { t: ['Volantes'], n: /^volante/, com: 'o volante', j: ['volante-tampa', 'volante-botao'] },
  'airbag-modulo': { t: ['Airbags, Módulos e Sensores'], n: /^modulo/, com: 'o módulo do airbag', j: ['airbag-sensor', 'airbag-bolsa'] },
  'airbag-sensor': { t: ['Airbags, Módulos e Sensores'], n: /^sensor/, lat: 1, com: 'o sensor de impacto', j: ['airbag-modulo', 'airbag-bolsa'] },
  'airbag-bolsa': { t: ['Airbags, Módulos e Sensores'], n: /^(bolsa|cortina|airbag)/, lat: 1, com: 'o airbag', j: ['airbag-modulo', 'airbag-sensor'] },
  cinto: { t: ['Cintos de Segurança'], lat: 1, fz: 1, com: 'o cinto de segurança', j: ['cinto'] },
  'teto-solar': { t: ['Motores do Teto Solar', 'Botões do Teto Solar'], x: /mangueira/, com: 'o teto solar', j: ['teto-solar'] },
  // ---- rodas ----
  estepe: { t: ['Rodas', 'Suportes do Estepe', 'Macacos e Chaves de Roda', 'Triângulos de Segurança'], n: /estepe|macaco|chave roda|triangulo/, com: 'esta peça do estepe', j: ['estepe'] },
  roda: { t: ['Rodas'], n: /^roda aro/, com: 'a roda', j: ['calota', 'parafuso-roda'] },
  calota: { t: ['Calotas'], com: 'a calota', j: ['roda'] },
  'parafuso-roda': { t: ['Parafusos Prisioneiros'], com: 'os parafusos da roda', j: ['roda'] },
};

/** Até quantas o "Vai junto" mostra (1 a 3: poucas e certas). */
export const MAX_JUNTO = 3;

/** Os códigos gravados da peça, em minúsculas ("1j0858601 1j0858601d" = 2 códigos). */
export const codigosDe = (p: Pick<Peca, 'o'>): Set<string> => new Set((p.o || '').toLowerCase().split(/\s+/).filter(Boolean));

type PecaJunto = Pick<Peca, 'id' | 'n' | 's' | 'o' | 'b' | 'm' | 'y' | 'ms' | 'ys'>;

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** Lado que o nome diz: 'E' (esquerdo, motorista), 'D' (direito, passageiro) ou null (nenhum, ou os dois). */
export function ladoDa(nome: string): 'E' | 'D' | null {
  const t = sem(nome);
  const e = /\b(esquerd[oa]s?|esq|motorista)\b/.test(t), d = /\b(direit[oa]s?|diret[oa]|dir|passageiro)\b/.test(t);   // "direto" = direito (erro de digitação do anúncio)
  return e === d ? null : e ? 'E' : 'D';
}
/** O papel da peça (o 1º de PAPEIS cujo tipo e nome servem), ou null: peça sem companheira de serviço. */
export function papelDa(p: Pick<Peca, 's' | 'n'>): string | null {
  const n = sem(p.n);
  for (const [k, g] of Object.entries(PAPEIS)) {
    if (g.t.includes(p.s) && (!g.n || g.n.test(n)) && !(g.x && g.x.test(n)) && (!g.lado || ladoDa(p.n))) return k;
  }
  return null;
}
/** Frente ou trás: o que o nome diz; na porta, "motorista"/"passageiro" = dianteira; senão a do papel (farol é da
 *  frente); senão null. */
export function zonaDa(nome: string, papel: string | null): Zona | null {
  const t = sem(nome);
  const f = /\b(diant\w*|frontal|frente)\b/.test(t), tr = /\b(tras\w*)\b/.test(t);
  if (f !== tr) return f ? 'frente' : 'tras';
  const g = papel ? PAPEIS[papel] : undefined;
  if (g?.porta && !f && /\b(motorista|passageiro)\b/.test(t)) return 'frente';
  return (!f && g?.z) || null;
}
/** O nome sem lado nem posição ("Guia para-choque traseiro esquerdo" = "guia para-choque"): a mesma peça noutro canto. */
export function esqueleto(nome: string): string {
  return sem(nome).replace(/\b(esquerd[oa]s?|direit[oa]s?|diret[oa]|esq|dir|motorista|passageiro|diant\w*|tras\w*|frontal|lado)\b/g, ' ')
    // plural = singular ("Suporte coxins câmbio" = "Suporte coxim câmbio", "Caixa fusíveis" = "Caixa fusível")
    .replace(/ns\b/g, 'm').replace(/eis\b/g, 'el').replace(/oes\b/g, 'ao').replace(/([aeiou])s\b/g, '$1')
    .replace(/\s+/g, ' ').trim();
}
const primeira = (t: string) => t.split(' ')[0] || '';
/** Um nome é o outro com palavras a mais ("Mangueira radiador" e "Mangueira superior radiador", "Bandeja balança" e
 *  "Balança bandeja suspensão"): pode ser a MESMA peça anunciada de dois jeitos. */
function contida(a: string, b: string): boolean {
  const x = new Set(a.split(' ')), y = new Set(b.split(' '));
  const [menor, maior] = x.size <= y.size ? [x, y] : [y, x];
  return [...menor].every((w) => maior.has(w));
}
const central = (nome: string) => /\bcentra(l|is)\b/.test(sem(nome));

type Lida = { papel: string; g: Papel; lado: 'E' | 'D' | null; zona: Zona | null; meio: boolean };
function ler(p: Pick<Peca, 's' | 'n'>): Lida | null {
  const papel = papelDa(p);
  return papel ? { papel, g: PAPEIS[papel], lado: ladoDa(p.n), zona: zonaDa(p.n, papel), meio: central(p.n) } : null;
}
/** Lado e posição batem? Os dois dizem: têm de ser iguais. Só um diz: vale se o outro for peça "de um só" (o
 *  para-choque não tem lado; a mola diz o eixo mas não o lado). Na porta, a porta tem de ser a mesma (nenhuma das duas
 *  dizer também vale: "Fechadura" e "Maçaneta externa"). */
export function casa(a: Lida, b: Lida): boolean {
  const porta = !!(a.g.porta || b.g.porta);
  if (a.lado !== b.lado) {
    if (a.lado && b.lado) return false;
    if (porta) return false;
    if (a.lado ? b.g.lat : a.g.lat) return false;
  }
  if (a.zona !== b.zona) {
    if (a.zona && b.zona) return false;
    if (porta) return false;
    if (a.zona ? b.g.fz : a.g.fz) return false;
  }
  if ((a.g.meio || b.g.meio) && a.meio !== b.meio) return false;
  return true;
}

/** As peças que vão junto com `p` no mesmo serviço: só do MESMO carro (marca + o modelo de `p`, também as de 2+ carros
 *  que servem nele) e da MESMA geração (anos que se sobrepõem, mesmaGeracao); o papel dela tem de estar na lista do papel
 *  de `p`; lado e posição batem (`casa`); nunca a mesma peça de novo (mesmo código, mesmo nome, ou o mesmo nome noutro
 *  canto do carro) nem dois cartões com o mesmo código ou o mesmo nome. A mais ligada de cada papel primeiro, depois a
 *  2ª de cada. `com`: o fim da frase do subtítulo. */
export function vaiJunto(p: PecaJunto, doCarro: readonly PecaJunto[], max = MAX_JUNTO): { pecas: PecaJunto[]; com: string } {
  const nada = { pecas: [], com: '' };
  const eu = ler(p);
  const anos = p.m ? anosNoModelo(p, p.m) : null;
  if (!eu || !p.b || !p.m || !anos) return nada;
  const alvos = eu.g.j;
  const cods = codigosDe(p);
  const meuEsq = esqueleto(p.n);
  const filas = new Map<string, { x: PecaJunto; nota: number; esq: string }[]>(alvos.map((k) => [k, []]));
  for (const x of doCarro) {
    if (x.id === p.id || x.b !== p.b || !serveNoModelo(x, p.m)) continue;
    if ([...codigosDe(x)].some((c) => cods.has(c))) continue;
    if (!mesmaGeracao(anos, anosNoModelo(x, p.m))) continue;
    const ela = ler(x);
    if (!ela || !filas.has(ela.papel)) continue;
    const esq = esqueleto(x.n);
    if (esq === meuEsq || !casa(eu, ela)) continue;
    if (ela.papel === eu.papel && ((!eu.g.jogo && primeira(esq) === primeira(meuEsq)) || contida(esq, meuEsq))) continue;
    // coxim do motor e do câmbio: "Suporte coxim câmbio motor" e "Suporte coxim motor" podem ser a mesma peça
    if (eu.g.jogo && ela.g.jogo && contida(esq, meuEsq)) continue;
    filas.get(ela.papel)!.push({ x, esq, nota: (eu.lado && ela.lado === eu.lado ? 2 : 0) + (eu.zona && ela.zona === eu.zona ? 1 : 0) });
  }
  for (const f of filas.values()) f.sort((a, b) => b.nota - a.nota || a.x.n.localeCompare(b.x.n, 'pt-BR') || (a.x.id < b.x.id ? -1 : 1));
  const pecas: PecaJunto[] = [];
  const nomes = new Set<string>(), usados = new Set<string>();
  for (let volta = 0; pecas.length < max && volta < max; volta++) {
    for (const k of alvos) {
      const f = filas.get(k)!;
      // a mesma peça duas vezes não (o mesmo código, ou o mesmo nome: duas "Caixa fusível BSI" de anos diferentes)
      while (f.length && (nomes.has(f[0].esq) || [...codigosDe(f[0].x)].some((c) => usados.has(c)))) f.shift();
      const c = f.shift();
      if (!c) continue;
      pecas.push(c.x);
      nomes.add(c.esq);
      codigosDe(c.x).forEach((q) => usados.add(q));
      if (pecas.length >= max) break;
    }
  }
  return pecas.length ? { pecas, com: eu.g.com } : nada;
}
