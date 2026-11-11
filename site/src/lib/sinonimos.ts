// Busca que fala como o cliente (nov/2026): o jeito de falar do Rio Grande do Sul e do Brasil -> os nomes das peças
// que EXISTEM no estoque (conferidos no pecas.json: "Lanterna", "Motor vidro", "Máquina vidro", "Corpo borboleta TBI"...).
// UMA tabela para o catálogo e as sugestões do cabeçalho (lib/busca.ts monta a busca com ela). Fica no navegador e não
// no busca.json: a tabela inteira pesa ~2 KB no JS (com cache), e pôr os sinônimos em cada peça custaria em toda peça.
//
// Cada linha: [o que o cliente digita], [o que procurar TAMBÉM] e, às vezes, [onde as outras formas NÃO valem]. Só
// acrescenta: a palavra digitada continua valendo ("pisca" acha o "Botão pisca-alerta" e, agora, a "Chave seta"). Frases
// sem as palavras vazias ("máquina de vidro" = "maquina vidro"), sem acento e em minúsculas. O plural de cada gatilho
// entra sozinho ("sinaleiras", "faróis"). O 3º item tira as peças cujo nome ou tipo diz aquela palavra só do caminho do
// sinônimo: "frente" puxa grade e "frontal", mas não a "Moldura frontal painel" nem a grade do alto-falante (revisão 12);
// nessas linhas as outras formas valem só no NOME da peça (o tipo "Amortecedores da Tampa e do Capô" não é "capô").

const normal = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Palavras que não dizem qual é a peça ("peça original para xc60"): saem da busca (lib/busca.ts) e dos gatilhos. */
export const VAZIAS = new Set(['de', 'da', 'do', 'das', 'dos', 'para', 'pra', 'com', 'e', 'o', 'a', 'os', 'as', 'um', 'uma',
  'peca', 'pecas', 'original', 'originais', 'usada', 'usadas', 'usado', 'usados']);

export const SINONIMOS: [string[], string[], string[]?][] = [
  // luzes
  [['sinaleira', 'sinaleiro'], ['lanterna']],
  // (a "Chave seta" é a peça do pisca; "seta" sozinha acha o resto: o "Chicote pisca…" não é a peça)
  [['pisca', 'pisca pisca', 'piscapisca', 'lanterna direcao', 'luz direcao', 'luz seta', 'lampada seta'], ['chave seta', 'seta']],
  // o botão do pisca-alerta: o estoque escreve "Botão pisca-alerta" e "Botão alerta" (as compostas vão juntas, como a
  // busca as lê: "pisca alerta" = "piscaalerta")
  [['piscaalerta', 'botao piscaalerta', 'botao alerta', 'botao pisca'], ['botao piscaalerta', 'botao alerta', 'piscaalerta']],
  // a 3ª luz de freio: o estoque escreve "Brake light (luz de freio)"
  [['luz freio', 'terceira luz freio', 'terceira luz', 'break light', 'brake light', 'luz stop'], ['brake light', 'luz freio']],
  // o interruptor do farol: botão, chave ou comando, conforme o carro
  [['interruptor farol', 'botao farol', 'comando farol', 'chave farol', 'interruptor luz', 'botao luz'],
    ['interruptor farol', 'botao farol', 'chave farol', 'comando farol', 'chave luz']],
  [['farolete', 'farol auxiliar', 'farol neblina', 'neblina', 'luz milha'], ['farol milha', 'milha']],
  [['alavanca seta', 'alavanca pisca', 'chave pisca', 'chave luz'], ['chave seta']],
  // carroceria (frente e traseira; "traseira", "dianteira", "esquerda", "direita" viram filtro em lib/busca.ts)
  // "churrasqueira" = a grade do para-choque (como se fala no Sul): a grade de verdade sobe; painel, console, alto-falante e
  // difusor de ar são de dentro do carro (a grade do alto-falante e a "Moldura frontal painel" não são a frente) e o que é
  // de trás não é a frente (o amortecedor da tampa traseira vinha pelo tipo "Amortecedores da Tampa e do Capô")
  [['frente', 'frente completa'], ['grade', 'churrasqueira', 'farol', 'capo', 'parachoque dianteiro', 'paralama dianteiro', 'frontal'],
    ['painel', 'console', 'falante', 'tweeter', 'difusor', 'tras', 'porta-malas', 'portamalas', 'chave', 'botao', 'interruptor']],
  [['espelho', 'espelho retrovisor', 'retrovisor externo'], ['retrovisor']],
  [['masaneta', 'massaneta', 'trinco'], ['macaneta']],
  [['trava eletrica', 'trava porta', 'trava eletrica porta'], ['fechadura eletrica', 'trava eletrica', 'fechadura trava']],
  // a tampa do porta-malas é a "Tampa traseira" do estoque
  [['tampa portamalas', 'tampa mala', 'tampa bagageiro'], ['tampa traseira']],
  [['tapa sol', 'tapasol', 'parasol', 'pala sol'], ['quebrasol']],
  // vidro elétrico
  // ("motor vidro" fica como estava: já acha os "Motor vidro" e os "Motor máquina vidro")
  [['maquina vidro', 'maquininha vidro', 'regulador vidro', 'elevador vidro'], ['maquina vidro', 'motor vidro']],
  // "motor vidro" também acha a "Máquina vidro" (o nome que o estoque usa; a palavra digitada continua valendo)
  [['motor vidro'], ['maquina vidro']],
  [['vidro eletrico'], ['maquina vidro', 'motor vidro', 'botao vidro']],
  // o botão do vidro: "Botão vidro", "Comando vidro" e "Botoneira vidro" no estoque
  [['botao vidro', 'comando vidro', 'botoneira vidro', 'botoneira', 'interruptor vidro', 'botao vidro eletrico'], ['botao vidro', 'comando vidro', 'botoneira']],
  // tampa, capô e porta-malas
  [['amortecedor tampa', 'amortecedor portamalas', 'amortecedor mala', 'mola gas', 'molas gas', 'pistao tampa', 'pistao capo', 'amortecedor gas'],
    ['amortecedor tampa', 'amortecedor portamalas', 'amortecedor capo', 'amortecedor gas']],
  // painel: instrumentos x acabamento ("painel" sozinho já acha os dois)
  [['quadro instrumentos', 'quadro', 'cluster', 'velocimetro', 'conta giros'], ['painel instrumentos', 'velocimetro']],
  [['tabelier', 'tablier', 'tablie'], ['painel', 'tabelier']],
  // módulos ("central" e "ECU" = módulo, como se fala na oficina)
  [['central', 'centralina', 'cerebro'], ['modulo']],
  [['ecu', 'central injecao', 'modulo motor', 'cerebro motor'], ['modulo injecao']],
  [['central airbag'], ['modulo airbag']],
  [['radio', 'som', 'multimidia', 'central multimidia'], ['radio', 'multimidia']],
  // motor
  [['tbi', 'corpo borboleta', 'borboleta'], ['tbi', 'corpo borboleta']],
  [['caneta', 'caneta ignicao', 'bobina ignicao'], ['bobina']],
  [['arranque', 'motor arranque', 'motor partida'], ['motor partida', 'motor arranque', 'arranque']],
  [['turbo', 'turbocompressor'], ['turbina']],
  // o estoque vende o "Motor parcial"; o cliente pede "motor completo"
  [['motor completo'], ['motor parcial']],
  [['calco motor', 'calco coxim', 'coxim motor'], ['coxim motor', 'calco coxim motor', 'calco motor']],
  [['ventoinha', 'eletroventilador', 'eletro ventilador', 'ventilador radiador'], ['ventoinha', 'ventilador', 'motor ventilador', 'eletroventilador']],
  [['reservatorio expansao', 'vaso expansao', 'reservatorio radiador', 'reservatorio arrefecimento'], ['reservatorio agua']],
  // "filtro de ar" no estoque é a "Caixa filtro ar"
  [['filtro ar'], ['caixa filtro ar', 'caixa filtro']],
  [['flauta bico', 'flauta bicos', 'flauta injecao', 'flauta injetor'], ['flauta']],
  [['bomba gasolina', 'bomba combustivel', 'bomba tanque'], ['bomba combustivel', 'bomba gasolina', 'bomba tanque']],
  // freio, direção e suspensão
  [['servo freio', 'servofreio', 'hidro vacuo', 'hidrovacuo'], ['hidrovacuo', 'servo freio', 'servofreio']],
  // o freio de mão no estoque é a "Alavanca freio mão"
  [['freio mao', 'freio estacionamento'], ['alavanca freio mao', 'freio mao']],
  [['homocinetica', 'junta homocinetica'], ['semieixo']],
  [['balanca', 'bandeja', 'leque'], ['bandeja', 'balanca']],
  // elétrica
  [['sensor re', 'sensor estacionamento', 'sensor reverso', 'sensor parking'], ['sensor estacionamento', 'sensor re']],
  [['chave canivete', 'chave presenca', 'chave presencial', 'chave reserva', 'chave carro', 'chave codificada', 'smart key', 'telecomando'],
    ['chave canivete', 'chave presenca', 'chave presencial']],
  // interior
  [['forro porta', 'painel porta', 'forracao', 'forracao porta'], ['forro porta', 'forro']],
  // o estoque não tem o cinto; a fivela é a peça dele que aparece
  [['cinto seguranca', 'cinto'], ['fivela cinto']],
  [['saida ar', 'aerador', 'saida ar condicionado'], ['difusor ar', 'saida ar', 'difusor saida ar']],
  [['tapete', 'tapetes', 'carpete', 'assoalho'], ['tapete', 'carpete']],
  // rodas
  [['estepe', 'step', 'roda reserva', 'roda sobressalente'], ['estepe', 'roda']],
  [['roda', 'rodas', 'aro', 'pneu'], ['estepe', 'roda']],
];

/** Plural de uma palavra (português): sinaleira -> sinaleiras, farol -> farois, motor -> motores, botão -> botoes. */
export function plural(w: string): string {
  if (/[^a-z]/.test(w) || w.length < 3) return w;
  if (w.endsWith('ao')) return `${w.slice(0, -2)}oes`;
  if (/[rz]$/.test(w)) return `${w}es`;
  if (w.endsWith('l')) return `${w.slice(0, -1)}is`;
  if (w.endsWith('m')) return `${w.slice(0, -1)}ns`;
  return w.endsWith('s') ? w : `${w}s`;
}

/** Singulares possíveis de uma palavra no plural ("farois" -> farol; "motores" -> motor; "lanternas" -> lanterna;
 *  "botoes" -> botao; "paineis" -> painel). Quem confere se a forma existe no estoque é lib/busca.ts. */
export function singulares(w: string): string[] {
  if (w.length < 4 || !w.endsWith('s') || /\d/.test(w)) return [];
  const out = new Set<string>();
  const troca = (fim: string, por: string) => { if (w.endsWith(fim)) out.add(w.slice(0, -fim.length) + por); };
  troca('oes', 'ao'); troca('aes', 'ao'); troca('ais', 'al'); troca('eis', 'el'); troca('ois', 'ol'); troca('uis', 'ul');
  troca('res', 'r'); troca('zes', 'z'); troca('ns', 'm'); troca('s', '');
  out.delete(w);
  return [...out];
}

/** gatilho (frase normalizada) -> as frases a procurar também (cada uma uma lista de palavras). Com o plural de cada
 *  gatilho (a última palavra e todas no plural). */
export const MAPA_SINONIMOS: Map<string, string[][]> = (() => {
  const m = new Map<string, string[][]>();
  for (const [gatilhos, alts] of SINONIMOS) {
    const frases = alts.map((a) => normal(a).split(/\s+/).filter((w) => w && !VAZIAS.has(w)));
    for (const g of gatilhos) {
      const ws = normal(g).split(/\s+/).filter((w) => w && !VAZIAS.has(w));
      const variantes = [ws, [...ws.slice(0, -1), plural(ws[ws.length - 1])], ws.map(plural)];
      for (const v of variantes) {
        const k = v.join(' ');
        const ja = m.get(k) ?? [];
        for (const f of frases) if (!ja.some((x) => x.join(' ') === f.join(' '))) ja.push(f);
        m.set(k, ja);
      }
    }
  }
  return m;
})();

/** gatilho (frase normalizada, com o plural) -> as palavras que, no nome ou no tipo da peça, tiram ela do caminho do
 *  sinônimo (a palavra digitada continua achando: "frente painel" acha o painel). */
export const MAPA_FORA: Map<string, string[]> = (() => {
  const m = new Map<string, string[]>();
  for (const [gatilhos, , fora] of SINONIMOS) {
    if (!fora?.length) continue;
    const ws = fora.map(normal);
    for (const g of gatilhos) {
      const p = normal(g).split(/\s+/).filter((w) => w && !VAZIAS.has(w));
      for (const v of [p, [...p.slice(0, -1), plural(p[p.length - 1])], p.map(plural)]) m.set(v.join(' '), ws);
    }
  }
  return m;
})();

/** O tamanho do maior gatilho (em palavras). */
export const MAIOR_GATILHO = Math.max(...[...MAPA_SINONIMOS.keys()].map((k) => k.split(' ').length));
