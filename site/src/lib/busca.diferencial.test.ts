// O JUIZ da busca (rodada 14, depois da revisão que barrou a publicação): cada consulta tem um GABARITO escrito por regra
// do ESTOQUE (o nome da peça certa, o carro, o lado, a posição, o ano), nunca pelo motor que está sendo testado, e roda em
// dois motores sobre o MESMO busca.json:
//   (a) o motor que está NO AR (origin/master na rodada 13, commit fixo abaixo), lido pelo git para node_modules/.cache
//       (sem cópia do repositório) e empacotado com o esbuild;
//   (b) o candidato (lib/busca.ts).
// O candidato não pode perder para o motor do ar em NENHUMA consulta, e não pode falhar o gabarito fora da lista de
// CONHECIDAS (as discutíveis, cada uma com o motivo). Fica no repositório como guarda de regressão (roda em ~3 s;
// BUSCA_RELATORIO=arquivo grava a tabela consulta a consulta e põe a tabela antiga no placar).
//
// As regras (o que cada falha quer dizer):
//   ZERO          o estoque tem a peça pedida e a lista veio vazia;
//   TOPO          o estoque tem a peça e as 5 primeiras (ou quantas houver) não são todas ela;
//   APROX         o estoque tem a peça e a tela diz "nada exato, veja as parecidas";
//   FALTAM        a lista não traz todas as peças certas do estoque;
//   EXATO_ERRADO  o estoque NÃO tem a peça pedida e a lista mostra outra coisa como resultado exato (sem aviso);
//   FAMILIA       o estoque não tem a peça e as "parecidas" do topo não são da família dela;
//   SAIDA         lista vazia por causa do lado/posição e a tela não diz o que faltou nem oferece o outro lado;
//   MEU           o carro salvo ("Meu carro") tem a peça e ela não abre a lista.
// Sem git ou sem o commit (clone raso): a comparação é pulada e o gabarito do candidato continua valendo.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Busca } from './busca';

/** O motor que está no ar (rodada 13): o commit de origin/master no dia da revisão. */
const NO_AR = 'de8e5b91383982c81bca7422248ce6ea7807b76b';
const ix = JSON.parse(readFileSync('public/dados/busca.json', 'utf8'));
const nrm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const junto = (s: string) => nrm(s).replace(/[^a-z0-9]/g, '');

type Meu = { b: string; m: string; y?: number };
type Esp = {
  q: string;
  /** a peça certa: regex no nome (sem acento, minúsculo, com o hífen do estoque: "^para-choque") */
  tipo?: string; nao?: string;
  car?: string; marca?: string; l?: 'E' | 'D'; pos?: 'D' | 'T'; ano?: number; cod?: string;
  /** quando o estoque não tem a peça: a família aceita no topo das parecidas (regex no nome + tipo "s" + bloco "c", as
   *  "famílias" do busca.json). Padrão: o tipo sem a âncora, em qualquer carro */
  fam?: string;
  /** a busca tem palavra que nenhuma peça certa tem ("led", "completo", "reserva"): o aviso de parecidas é aceito */
  aprox?: 'livre';
  /** busca só de carro ou de marca (sem tipo): a lista tem de trazer TODAS as peças dele */
  todas?: boolean;
  /** filtros do catálogo junto com a busca; meu = o carro salvo no "Meu carro" */
  f?: Record<string, unknown>; meu?: Meu;
  /** de onde veio a consulta */
  de: string;
};
type Peca = { k: number; n: string; s: string; c: string; b: string; ms: string[]; ys?: ([number, number] | null)[]; y: [number, number] | null; l?: string; pos?: string; o: string; id: string };

const XC60: Meu = { b: 'Volvo', m: 'XC60', y: 2019 };
const Q: Esp[] = [];
const grupo = (de: string, linhas: [string, string | null, Omit<Esp, 'q' | 'tipo' | 'de'>?][]) => {
  for (const [q, tipo, x] of linhas) Q.push({ q, ...(tipo ? { tipo } : {}), ...(x ?? {}), de });
};

// ---------------------------------------------------------------------------------------------------------------------
// 1) As 291 consultas do revisor (revisão 14, parte A: scripts/a-consultas.mjs), com o gabarito dele
// ---------------------------------------------------------------------------------------------------------------------
grupo('revisor', [
  ['sinaleira', '^lanterna'],
  ['sinaleira xc60', '^lanterna', { car: 'XC60' }],
  ['sinaleira direita tracker', '^lanterna', { car: 'Tracker', l: 'D' }],
  ['sinaleira esquerda gol', '^lanterna', { car: 'Gol', l: 'E' }],
  ['sinaleiras onix', '^lanterna', { car: 'Onix' }],
  ['lanterna traseira gol', '^lanterna', { car: 'Gol' }],
  ['lanterna traseira esquerda onix', '^lanterna', { car: 'Onix', l: 'E' }],
  ['lanterna tampa xc60', '^lanterna.*tampa', { car: 'XC60' }],
  ['lanterna da tampa traseira direita xc60', '^lanterna.*tampa', { car: 'XC60', l: 'D' }],
  ['farol', '^farol'],
  ['farol de milha', '^farol.*(milha|neblina|aux)|^milha'],
  ['farol milha kardian', '^farol.*(milha|neblina|aux)', { car: 'Kardian', fam: 'farol' }],
  ['farol compass', '^farol', { car: 'Compass', fam: 'farol|farois|lanterna' }],
  ['farolete', '^farol.*(milha|neblina|aux)|^farolete'],
  ['farol esquerdo xc60', '^farol', { car: 'XC60', l: 'E' }],
  ['farol de neblina direito', '^farol.*(milha|neblina|aux)', { l: 'D' }],
  ['luz de placa', '^(luz|lanterna).*placa'],
  ['brake light', '^brake'],
  ['terceira luz de freio', '^brake|luz.*freio'],
  ['luz de teto xc60', '^luz.*teto', { car: 'XC60' }],
  ['pisca', null],
  ['pisca alerta gol', '^botao (pisca-)?alerta', { car: 'Gol' }],
  ['chave de seta gol', '^chave seta', { car: 'Gol' }],
  ['chave de seta corsa', '^chave seta', { car: 'Corsa' }],
  ['alavanca de seta palio', '^chave seta', { car: 'Palio' }],
  ['botao farol gol', '^botao farol', { car: 'Gol' }],
  ['interruptor de farol', '^(botao|interruptor|chave|comando).*farol'],
  ['paralama', '^para-lama'],
  ['para-lama direito', '^para-lama', { l: 'D' }],
  ['paralama esquerdo xc60', '^para-lama', { car: 'XC60', l: 'E' }],
  ['para lama', '^para-lama'],
  ['parachoque', '^para-choque'],
  ['para choque dianteiro hb20', '^para-choque', { car: 'HB20', pos: 'D' }],
  ['parachoque traseiro gol', '^para-choque', { car: 'Gol', pos: 'T' }],
  ['para-choque xc60', '^para-choque', { car: 'XC60' }],
  ['capô', '^capo'],
  ['capo gol', '^capo', { car: 'Gol' }],
  ['fechadura do capô', '^fechadura.*capo'],
  ['dobradiça do capô tracker', '^dobradica capo', { car: 'Tracker', fam: 'dobradica' }],
  ['retrovisor', '^retrovisor'],
  ['retrovisor direito xc60', '^retrovisor', { car: 'XC60', l: 'D' }],
  ['retrovisor esquerdo compass', '^retrovisor', { car: 'Compass', l: 'E' }],
  ['espelho retrovisor esquerdo kicks', '^retrovisor|^espelho', { car: 'Kicks', l: 'E' }],
  ['retrovisor interno', '^retrovisor interno'],
  ['retrovisor eletrico hb20', '^retrovisor', { car: 'HB20', aprox: 'livre' }],
  ['capa do retrovisor', '^capa.*retrovisor'],
  ['retrovisor motorista gol', '^retrovisor', { car: 'Gol', l: 'E' }],
  ['retrovisor lado passageiro onix', '^retrovisor', { car: 'Onix', l: 'D' }],
  ['maçaneta externa gol', '^macaneta externa', { car: 'Gol' }],
  ['macaneta interna esquerda sandero', '^macaneta interna', { car: 'Sandero', l: 'E' }],
  ['massaneta', '^macaneta'],
  ['maçaneta', '^macaneta'],
  ['puxador de porta', '^puxador.*porta( |$)'],
  ['porta dianteira direita', '^porta( |$)', { l: 'D', pos: 'D' }],
  ['tampa traseira', '^tampa traseira'],
  ['tampa do porta malas', '^tampa (porta-malas|traseira)'],
  ['grade', '^grade'],
  ['grade dianteira xc60', '^grade', { car: 'XC60' }],
  ['churrasqueira', 'churrasqueira'],
  ['frente xc60', '^(grade|farol|capo|para-choque|churrasqueira)', { car: 'XC60', fam: 'grade|farol|capo|para-choque|para-lama|churrasqueira|frontal' }],
  ['soleira', '^soleira'],
  ['friso', '^frisos?( |$)'],
  ['aerofolio', '^aerofolio'],
  ['emblema', '^emblema'],
  ['parabarro', '^para-barro'],
  ['vidro porta', '^vidro.*porta'],
  ['fechadura porta dianteira esquerda gol', '^fechadura', { car: 'Gol', l: 'E', pos: 'D' }],
  ['trava eletrica', '^(trava eletrica|fechadura eletrica|fechadura trava)'],
  ['fechadura tampa traseira xc60', '^fechadura.*tampa', { car: 'XC60', fam: 'fechadura|tampa' }],
  ['máquina de vidro', '^(maquina vidro|motor (maquina )?vidro)'],
  ['maquina de vidro dianteira esquerda gol', '^(maquina vidro|motor (maquina )?vidro)', { car: 'Gol', l: 'E', pos: 'D' }],
  ['motor do vidro xc60', '^(maquina vidro|motor (maquina )?vidro)', { car: 'XC60' }],
  ['motor vidro eletrico traseiro direito duster', '^(maquina vidro|motor (maquina )?vidro)', { car: 'Duster', l: 'D', pos: 'T' }],
  ['vidro eletrico', '^(maquina vidro|motor (maquina )?vidro|botao vidro|comando vidro|botoneira vidro)'],
  ['botão do vidro', '^(botao|comando|botoneira).*vidro'],
  ['botao vidro motorista onix', '^(botao|comando|botoneira).*vidro', { car: 'Onix', l: 'E' }],
  ['comando de vidro palio', '^(botao|comando|botoneira).*vidro', { car: 'Palio' }],
  ['botoneira', '^botoneira'],
  ['regulador de vidro', '^(maquina vidro|motor (maquina )?vidro)'],
  ['bobina', '^bobina'],
  ['bobina de ignição gol', '^bobina', { car: 'Gol' }],
  ['caneta', '^bobina'],
  ['caneta xc60', '^bobina', { car: 'XC60' }],
  ['bobinas', '^bobina'],
  ['módulo', '^modulo'],
  ['modulo de injeção', '^modulo injecao'],
  ['central de injeção gol', '^modulo injecao', { car: 'Gol' }],
  ['ecu palio', '^modulo injecao', { car: 'Palio' }],
  ['modulo abs', '^modulo abs'],
  ['central abs', '^modulo abs'],
  ['modulo conforto gol', '^modulo conforto', { car: 'Gol' }],
  ['bcm', '^modulo.*bcm'],
  ['bsi c3', '^modulo.*bsi', { car: 'C3' }],
  ['modulo airbag', '^modulo.*airbag'],
  ['central airbag', '^modulo.*airbag'],
  ['modulo cambio', '^modulo.*cambio'],
  ['central multimidia', '^(central )?multimidia|^radio'],
  ['central xc60', '^(modulo|central)', { car: 'XC60' }],
  ['alternador', '^alternador'],
  ['alternador gol', '^alternador', { car: 'Gol' }],
  ['alternador xc60', '^alternador', { car: 'XC60' }],
  ['motor de arranque', '^motor (partida|arranque)'],
  ['motor de partida', '^motor (partida|arranque)'],
  ['arranque wr-v', '^motor (partida|arranque)', { car: 'WR-V' }],
  ['motor de arranque corsa', '^motor (partida|arranque)', { car: 'Corsa' }],
  ['chicote porta xc60', '^chicote.*porta', { car: 'XC60' }],
  ['caixa de fusível', '^caixa fusive'],
  ['caixa de fusiveis gol', '^caixa fusive', { car: 'Gol' }],
  ['rele', '^rele'],
  ['sensor de estacionamento', '^sensor (re )?estacionamento'],
  ['sensor de ré', '^sensor (estacionamento|re)'],
  ['camera de re', '^camera (de )?re'],
  ['sonda lambda', '^sonda'],
  ['sonda lambda gol', '^sonda', { car: 'Gol' }],
  ['sonda', '^sonda'],
  ['sensor map', '^sensor map'],
  ['sensor de rotação', '^sensor rotacao'],
  ['sensor de fase', '^sensor fase'],
  ['sensor abs', '^sensor.*abs'],
  ['buzina', '^buzina'],
  ['antena', '^antena'],
  ['radio', '^radio'],
  ['multimidia', '^(central )?multimidia|^radio|^tela multimidia'],
  ['alto falante', '^alto-falante'],
  ['chave canivete', '^chave (canivete|presenc|ignicao)'],
  ['comutador de ignição', '^comutador.*ignicao'],
  ['cilindro de ignição', '^(cilindro|miolo|comutador).*ignicao'],
  ['tbi', '^(tbi|corpo borboleta)'],
  ['corpo de borboleta', '^(tbi|corpo borboleta)'],
  ['tbi gol', '^(tbi|corpo borboleta)', { car: 'Gol' }],
  ['borboleta palio', '^(tbi|corpo borboleta)', { car: 'Palio' }],
  ['bico injetor', '^bico'],
  ['bicos injetores', '^bico'],
  ['bico injetor corsa', '^bico', { car: 'Corsa' }],
  ['flauta', '^flauta'],
  ['coxim', '^coxi(m|ns)'],
  ['coxim do motor', '^coxi(m|ns).*motor'],
  ['coxim motor gol', '^coxi(m|ns).*motor', { car: 'Gol' }],
  ['coxim cambio', '^coxi(m|ns).*cambio'],
  ['calço do motor', '^(calco|coxi(m|ns)).*motor'],
  ['compressor do ar', '^compressor (de )?ar'],
  ['compressor ar condicionado xc60', '^compressor.*condicionado', { car: 'XC60' }],
  ['compressor de ar onix', '^compressor', { car: 'Onix' }],
  ['bomba de combustível', '^bomba combustivel'],
  ['bomba de gasolina gol', '^bomba combustivel', { car: 'Gol', fam: 'bomba (combustivel|gasolina|tanque)' }],
  ['bomba d\'agua', '^bomba agua'],
  ['bomba dagua', '^bomba agua'],
  ['bomba de oleo', '^bomba oleo'],
  ['bomba de vácuo', '^bomba vacuo'],
  ['radiador', '^radiador'],
  ['radiador xc60', '^radiador', { car: 'XC60' }],
  ['ventoinha', '^(ventoinha|ventilador|motor ventilador|eletroventilador)'],
  ['eletroventilador', '^(ventoinha|ventilador|motor ventilador|eletroventilador)'],
  ['intercooler', '^intercooler'],
  ['turbina', '^turbina'],
  ['turbo', '^turbina'],
  ['coletor de admissão', '^coletor admissao'],
  ['coletor admissao gol', '^coletor admissao', { car: 'Gol' }],
  ['coletor de escape', '^coletor escap'],
  ['tampa de válvula', '^tampa valvula'],
  ['cabeçote', '^cabecote'],
  ['carter', '^carter'],
  ['motor parcial', '^motor parcial'],
  ['motor completo', '^motor (parcial|completo)'],
  ['bloco do motor', '^bloco motor'],
  ['tensor', '^tensor'],
  ['polia', '^polia'],
  ['pedal do acelerador gol', '^pedal acelerador', { car: 'Gol' }],
  ['pedal de embreagem', '^pedal.*embreagem'],
  ['reservatorio de agua', '^reservatorio.*agua'],
  ['reservatório de expansão', '^reservatorio.*(expansao|agua|arrefec)'],
  ['motor do limpador', '^motor limpador'],
  ['motor limpador traseiro', '^motor limpador', { pos: 'T' }],
  ['catalisador', '^catalisador'],
  ['filtro de ar', '^(filtro ar|caixa filtro)'],
  ['caixa do filtro de ar', '^caixa.*filtro'],
  ['mangueira do radiador', '^mangueira.*radiador'],
  ['mangueira intercooler', '^mangueira.*intercooler'],
  ['hidrovacuo', '^hidrovacuo'],
  ['servo freio', '^(hidrovacuo|servo)'],
  ['cilindro mestre', '^cilindro mestre'],
  ['escapamento', '^(escapamento|silencioso|abafador)'],
  ['bieleta', '^bieleta'],
  ['pivô', '^pivo'],
  ['homocinética', '^(homocinetica|semieixo|semi-eixo)'],
  ['semi eixo', '^semieixo'],
  ['semieixo', '^semieixo'],
  ['amortecedor', '^amortecedor'],
  ['amortecedor dianteiro', '^amortecedor dianteiro'],
  ['amortecedor traseiro xc60', '^amortecedor', { car: 'XC60', pos: 'T', nao: 'tampa|capo' }],
  ['amortecedor da tampa', '^amortecedor.*(tampa|porta-malas)'],
  ['mola', '^mola'],
  ['bandeja', '^bandeja'],
  ['balança', '^(balanca|bandeja)'],
  ['manga de eixo', '^manga'],
  ['cubo de roda', '^cubo'],
  ['pinça de freio', '^pinca'],
  ['caixa de direção', '^caixa direcao'],
  ['coluna de direção', '^coluna direcao'],
  ['suspensão xc60', null, { car: 'XC60' }],
  ['painel de instrumentos gol', '^painel instrumentos', { car: 'Gol' }],
  ['velocimetro', '^(painel instrumentos|velocimetro)'],
  ['quadro de instrumentos', '^(painel instrumentos|velocimetro)'],
  ['porta-luvas', '^porta-luvas'],
  ['porta luvas gol', '^porta-luvas', { car: 'Gol' }],
  ['portaluvas', '^porta-luvas'],
  ['console', '^console'],
  ['volante', '^volante'],
  ['airbag', '^(airbag|bolsa.*airbag|cortina airbag)'],
  ['cinto de segurança', '^(cinto|fivela)'],
  ['forro de porta', '^forro.*porta'],
  ['quebra sol', '^quebra-sol'],
  ['tapa sol', '^quebra-sol'],
  ['difusor de ar', '^difusor ar'],
  ['saida de ar', '^(difusor|saida)( saida)?( de)? ar'],
  ['comando do ar', '^comando ar'],
  ['ar condicionado', 'ar[- ]condicionado'],
  ['alavanca de cambio', '^alavanca cambio'],
  ['freio de mao', '^(alavanca freio|botao freio|freio)'],
  ['tapete', '^(tapete|carpete)'],
  ['roda', '^roda'],
  ['estepe', '^(estepe|roda)'],
  ['macaco', '^macaco'],
  ['chave de roda', '^chave roda'],
  ['porta copos', '^porta-copos'],
  ['acendedor', '^acendedor'],
  ['retrovizor', '^retrovisor'],
  ['lanterna trazeira', '^lanterna', { pos: 'T' }],
  ['maçanetas', '^macaneta'],
  ['farois', '^farol'],
  ['modulos', '^modulo'],
  ['alternadro', '^alternador'],
  ['sinalera', '^lanterna'],
  ['parachoqe', '^para-choque'],
  ['amortesedor', '^amortecedor'],
  ['coxin', '^coxi'],
  ['radiadro', '^radiador'],
  ['xc 60', null, { car: 'XC60' }],
  ['xc-60 retrovisor', '^retrovisor', { car: 'XC60' }],
  ['retrovisor hb 20', '^retrovisor', { car: 'HB20' }],
  ['lanterna wrv', '^lanterna', { car: 'WR-V' }],
  ['lanterna wr v', '^lanterna', { car: 'WR-V' }],
  ['lanterna t cross', '^lanterna', { car: 'T-Cross' }],
  ['lanterna tcross', '^lanterna', { car: 'T-Cross' }],
  ['modulo c4 cactus', '^modulo', { car: 'C4 Cactus' }],
  ['lanterna epace', '^lanterna', { car: 'E-Pace' }],
  ['lanterna e pace', '^lanterna', { car: 'E-Pace' }],
  ['modulo classe c', '^modulo', { car: 'Classe C' }],
  ['modulo c180', '^modulo', { car: 'C180' }],
  ['modulo c 180', '^modulo', { car: 'C180' }],
  ['modulo 320i', '^modulo', { car: '320i' }],
  ['lanterna new fiesta', '^lanterna', { car: 'New Fiesta' }],
  ['modulo serie 3', '^modulo', { car: 'Série 3' }],
  ['onix 2018 lanterna', '^lanterna', { car: 'Onix', ano: 2018 }],
  ['gol 2012', null, { car: 'Gol', ano: 2012 }],
  ['retrovisor xc60 2019', '^retrovisor', { car: 'XC60', ano: 2019 }],
  ['lanterna traseira direita tracker 2022', '^lanterna', { car: 'Tracker', l: 'D', ano: 2022 }],
  ['LANTERNA TRASEIRA GOL', '^lanterna', { car: 'Gol' }],
  ['  retrovisor   xc60  ', '^retrovisor', { car: 'XC60' }],
  ['peça original retrovisor para xc60', '^retrovisor', { car: 'XC60' }],
  ['volvo', null],
  ['mercedes', null],
  ['vw gol lanterna', '^lanterna', { car: 'Gol' }],
  ['chevrolet onix modulo', '^modulo', { car: 'Onix' }],
  ['gm onix modulo', '^modulo', { car: 'Onix' }],
  ['5u0823509h', null, { cod: '5u0823509h' }],
  ['5u0 823 509 h', null, { cod: '5u0823509h' }],
  ['34D-937-084', null, { cod: '34d937084' }],
  ['8200 733 848', null, { cod: '8200733848' }],
  ['1j0 858 601 d', null, { cod: '1j0858601d' }],
  ['DS7T-10890-GA', null, { cod: 'ds7t10890ga' }],
  ['ds7t 10890 ga', null, { cod: 'ds7t10890ga' }],
  ['31476671', null, { cod: '31476671' }],
  ['8M5T-15K603-KA', null, { cod: '8m5t15k603ka' }],
  ['5wk49706', null, { cod: '5wk49706' }],
  ['A 203 750 00 81', null, { cod: 'a2037500081' }],
  ['117103885R', null, { cod: '117103885r' }],
  ['7m5t 14529 aa', null, { cod: '7m5t14529aa' }],
  ['88650-0D880', null, { cod: '886500d880' }],
  ['430100f0', null, { cod: '430100f0' }],
  ['8200.733.848', null, { cod: '8200733848' }],
  ['cod 31476671', null, { cod: '31476671' }],
  ['retrovisor 31476671', null],
  ['31476', null],
  ['MLB4779038537', null],
  ['retrovisor', '^retrovisor', { f: { marca: 'Volvo', modelo: 'XC60', ano: 2019 }, car: 'XC60', ano: 2019 }],
  ['modulo', '^modulo', { f: { marca: 'Mercedes-Benz', modelo: 'C180' }, car: 'C180' }],
  ['lanterna', '^lanterna', { f: { marca: 'Ford', modelo: 'New Fiesta' }, car: 'New Fiesta' }],
  ['lanterna', '^lanterna', { f: { marca: 'Ford', modelo: 'Fiesta' }, car: 'Fiesta' }],
  ['sinaleira', '^lanterna', { f: { lado: 'D' }, l: 'D' }],
  ['lanterna esquerda', '^lanterna', { f: { lado: 'D' }, l: 'D' }],
]);

// ---------------------------------------------------------------------------------------------------------------------
// 2) As outras consultas citadas na revisão (partes A2 a A22, P1-3/4/5 e P2 1 a 11) que não estavam nas 291
// ---------------------------------------------------------------------------------------------------------------------
const BOMBA_AGUA = "^bomba (de |d'|auxiliar )?agua";
const FORA_AGUA = 'limpador|para-brisa|reservatorio';
grupo('revisão', [
  // A2 / P1-3: composta digitada com espaço
  ['porta luvas', '^porta-luvas'], ['para choque', '^para-choque'], ['para choque traseiro', '^para-choque', { pos: 'T' }],
  ['para brisa', 'para-brisa'], ['limpador para brisa', 'limpador.*para-brisa|para-brisa.*limpador'],
  ['porta malas', 'porta-malas'], ['porta objetos', 'porta-objetos'], ['pisca alerta', 'pisca-alerta'],
  
  // A3 / P1-4: gatilho e destino do mesmo sinônimo
  ['espelho retrovisor', '^(retrovisor|espelho retrovisor)'], ['espelho retrovisor kicks', '^(retrovisor|espelho retrovisor)', { car: 'Kicks' }],
  ['retrovisor esquerdo kicks', '^retrovisor', { car: 'Kicks', l: 'E' }], ['espelho esquerdo kicks', '^retrovisor', { car: 'Kicks', l: 'E' }],
  // A4 / P1-4: a 2ª palavra que não está no nome
  ['freio de mão', 'freio (de )?mao'], ['luz de freio', 'luz de freio'], ['bomba de gasolina', '^bomba (combustivel|gasolina|tanque)'],
  ['forro de teto', '^forro.*teto', { fam: '^forro' }],
  ['motor completo xc60', '^motor (parcial|completo)', { car: 'XC60', aprox: 'livre' }],
  ['lanterna led gol', '^lanterna', { car: 'Gol', aprox: 'livre' }],
  ['retrovisor com pisca xc60', '^retrovisor', { car: 'XC60', aprox: 'livre' }],
  ['chave reserva xc60', '^chave (canivete|presenca)', { car: 'XC60', aprox: 'livre' }],
  // A5 / P1-5: bomba d'água
  ["bomba d'água", BOMBA_AGUA, { nao: FORA_AGUA }], 
  ['bomba agua', BOMBA_AGUA, { nao: FORA_AGUA }], ['bomba de agua', BOMBA_AGUA, { nao: FORA_AGUA }],
  ["bomba d'água", BOMBA_AGUA, { nao: FORA_AGUA, meu: XC60 }],
  // A8 / P2-3: "gol" não é "Golf"
  ['lanterna gol', '^lanterna', { car: 'Gol' }],
  // A11 / P2-6: lado + posição juntos
  ['lanterna traseira direita tracker', '^lanterna', { car: 'Tracker', l: 'D', pos: 'T' }],
  // A14 / P2-8: o carro salvo sobe
  ['alternador', '^alternador', { meu: XC60 }], ['modulo abs', '^modulo abs', { meu: XC60 }], ['retrovisor', '^retrovisor', { meu: XC60 }],
  // A15 / P2-9: sinônimo + carro
  ['bobina xc60', '^bobina', { car: 'XC60' }],
  // A17 / P2-11: a palavra digitada é o LUGAR, não a peça
  ['porta-malas', 'porta-malas'], ['teto', '(^| )teto( |$)'], ['banco', '(^| )bancos?( |$)'],
]);

// ---------------------------------------------------------------------------------------------------------------------
// 3) Mais 190 consultas do jeito que o cliente e o mecânico digitam (duas e três palavras, composta com espaço, hífen e
//    junta, com carro, ano, lado e posição, erro de digitação, abreviação de marca, "gol" x "Golf", "new fiesta")
// ---------------------------------------------------------------------------------------------------------------------
grupo('cliente', [
  // para-choque
  ['para-choque', '^para-choque'], ['parachoques', '^para-choque'], ['para choques', '^para-choque'],
  ['pára-choque dianteiro', '^para-choque', { pos: 'D' }], ['parachoque traseiro', '^para-choque', { pos: 'T' }],
  ['para choque dianteiro completo', '^para-choque dianteiro completo'], ['guia para choque', '^guia.*para-choque'],
  ['guia do parachoque traseiro', '^guia.*para-choque', { pos: 'T' }], ['suporte para choque', '^suporte.*para-choque'],
  ['alma do para choque', '^alma para-choque'], ['para choque e-pace', '^para-choque', { car: 'E-Pace' }],
  ['para choque gol', '^para-choque', { car: 'Gol', fam: 'para-choque' }],
  // porta-luvas
  ['porta luva', '^porta-luvas'], ['porta luvas onix', '^porta-luvas', { car: 'Onix' }],
  ['porta luvas hb20', '^porta-luvas', { car: 'HB20' }], ['porta luvas completo', '^porta-luvas completo'], ['portaluvas gol', '^porta-luvas', { car: 'Gol' }],
  // porta-malas
  ['portamalas', 'porta-malas'], ['fechadura porta malas', '^fechadura.*porta-malas'], ['fechadura do porta-malas', '^fechadura.*porta-malas'],
  ['forro porta malas', '^forro.*porta-malas'], ['soleira porta malas', '^soleira.*porta-malas'], ['botão porta malas', '^botao.*porta-malas'],
  // para-lama
  ['para-lama', '^para-lama'], ['paralamas', '^para-lama'], ['para lama direito', '^para-lama', { l: 'D' }],
  ['paralama dianteiro esquerdo', '^para-lama', { l: 'E', pos: 'D' }], ['para lama onix', '^para-lama', { car: 'Onix', fam: 'para-lama' }],
  ['moldura para lama', '^moldura.*para-lama'], ['suporte do paralama', '^suporte.*para-lama'],
  // para-brisa e limpador
  ['parabrisa', 'para-brisa'], ['para-brisa', 'para-brisa'], ['limpador de parabrisa', 'limpador.*para-brisa|para-brisa.*limpador'],
  ['motor limpador para brisa', '^motor limpador.*para-brisa'], ['braço limpador para brisa', '^braco.*limpador.*para-brisa|^braco.*para-brisa.*limpador'],
  ['motor do limpador traseiro', '^motor limpador', { pos: 'T' }], ['chave limpador', '^chave (seta )?limpador'],
  // quebra-sol, semieixo, alto-falante, pisca-alerta, porta-copos
  ['quebra-sol', '^quebra-sol'], ['quebrasol', '^quebra-sol'], ['quebra sol direito', '^quebra-sol', { l: 'D' }], ['quebra sol esquerdo', '^quebra-sol', { l: 'E' }],
  ['semi-eixo', '^semieixo'], ['semi eixo direito', '^semieixo', { l: 'D' }], ['suporte semi eixo', '^suporte.*semieixo'],
  ['alto-falante', 'alto-falante'], ['altofalante', 'alto-falante'], ['alto falantes', 'alto-falante'], ['grade alto falante', '^grade alto-falante'],
  ['tampa alto falante', '^tampa.*alto-falante'],
  ['pisca-alerta', 'pisca-alerta'], ['botão pisca alerta', '^botao.*pisca-alerta'], ['botao do pisca alerta', '^botao.*pisca-alerta'],
  ['pisca alerta onix', 'pisca-alerta', { car: 'Onix' }],
  ['porta-copos', '^porta-copos'], ['porta copo', '^porta-copos'], ['porta trecos', '^porta-trecos'], ['porta-objetos', 'porta-objetos'],
  // ar-condicionado
  ['ar-condicionado', 'ar[- ]condicionado'], ['arcondicionado', 'ar[- ]condicionado'], ['comando ar condicionado', '^comando ar condicionado'],
  ['comando do ar condicionado gol', '^comando ar', { car: 'Gol' }], ['compressor ar condicionado', '^compressor.*ar condicionado'],
  ['compressor do ar condicionado', '^compressor.*ar condicionado'], ['mangueira ar condicionado', '^mangueira.*ar condicionado'],
  ['resistencia ar condicionado', '^resistencia.*ar condicionado'], ['evaporador', '^evaporador'], ['difusor de ar onix', '^difusor ar', { car: 'Onix' }],
  // freio
  ['freio mao', 'freio (de )?mao'], ['alavanca freio de mão', '^alavanca.*freio (de )?mao'],
  ['alavanca do freio de mão hb20', '^alavanca.*freio (de )?mao', { car: 'HB20' }], ['luz freio', 'luz de freio'], ['brake light gol', '^brake', { car: 'Gol', fam: 'brake|luz' }],
  ['pedal de freio', '^pedal.*freio'], ['pinça freio', '^pinca'], ['hidrovácuo', '^hidrovacuo'], ['modulo abs gol', '^modulo.*abs', { car: 'Gol' }],
  // luzes
  ['luz de teto', '^luz.*teto'], ['luz teto gol', '^luz.*teto', { car: 'Gol' }], ['luz de cortesia', '^luz.*cortesia'], ['luz placa', '^luz de placa'],
  ['lanterna traseira', '^lanterna traseira'], ['lanterna traseira esquerda', '^lanterna', { l: 'E', pos: 'T' }], ['lanterna traseira esquerda tracker', '^lanterna', { car: 'Tracker', l: 'E', pos: 'T' }],
  ['lanterna tampa traseira', '^lanterna.*tampa'], ['farol direito', '^farol', { l: 'D' }], ['farol esquerdo hb20', '^farol', { car: 'HB20', l: 'E' }],
  ['lanterna golf', '^lanterna', { car: 'Golf' }], ['sinaleira gol', '^lanterna', { car: 'Gol' }],
  ['lanterna onix 2018', '^lanterna', { car: 'Onix', ano: 2018 }], ['lanterna gol 2010', '^lanterna', { car: 'Gol', ano: 2010 }],
  // filtro e ar
  ['filtro ar', '^caixa filtro (de )?ar'], ['caixa filtro de ar', '^caixa filtro (de )?ar'], ['caixa do filtro de ar gol', '^caixa filtro', { car: 'Gol' }],
  ['mangueira filtro de ar', '^mangueira.*filtro (de )?ar'], ['filtro canister', '^filtro canister'],
  // bombas
  ['bomba d agua', BOMBA_AGUA, { nao: FORA_AGUA }], ['bomba d’água', BOMBA_AGUA, { nao: FORA_AGUA }], ['bomba dágua', BOMBA_AGUA, { nao: FORA_AGUA }],
  ["bomba d'agua xc60", BOMBA_AGUA, { nao: FORA_AGUA, car: 'XC60' }], ['bomba de agua auxiliar', '^bomba.*auxiliar', { nao: 'ar auxiliar' }],
  ['bomba gasolina', '^bomba (combustivel|gasolina|tanque)'], ['bomba de combustivel onix', '^bomba (combustivel|gasolina|tanque)', { car: 'Onix' }],
  ['bomba do tanque', '^bomba (combustivel|gasolina|tanque)'], ['bomba de vacuo', '^bomba vacuo'], ['bomba direção hidraulica', '^bomba direcao'],
  // reservatório
  ['reservatório água radiador', '^reservatorio agua radiador'], ['reservatorio do radiador', '^reservatorio agua radiador'],
  ['reservatorio fluido de freio', '^reservatorio fluido freio'], ['reservatório expansão gol', '^reservatorio agua', { car: 'Gol', aprox: 'livre' }],
  // retrovisor
  ['espelho', '^(retrovisor|espelho)'], ['espelho xc60', '^(retrovisor|espelho)', { car: 'XC60' }], ['retrovisor externo', '^retrovisor', { nao: 'interno' }],
  ['espelho retrovisor interno', '^(espelho )?retrovisor interno'], ['retrovisor direito', '^retrovisor', { l: 'D' }], ['retrovisor eletrico direito onix', '^retrovisor', { car: 'Onix', l: 'D', aprox: 'livre' }],
  ['capa retrovisor', '^capa.*retrovisor'], ['retrovisores', '^retrovisor'],
  // motor
  ['motor parcial xc60', '^motor parcial', { car: 'XC60' }], ['motor xc60', null, { car: 'XC60' }],
  ['coxim do motor gol', '^coxi(m|ns).*motor', { car: 'Gol' }], ['coxim cambio gol', '^coxi(m|ns).*cambio', { car: 'Gol' }],
  ['tampa de valvula', '^tampa valvula'], ['coletor de admissao', '^coletor admissao'], ['corpo borboleta gol', '^(tbi|corpo borboleta)', { car: 'Gol' }],
  ['bico injetor gol', '^bico', { car: 'Gol' }], ['flauta de bico', '^flauta'], ['turbina xc60', '^turbina', { car: 'XC60' }], 
  ['motor de arranque gol', '^motor (partida|arranque)', { car: 'Gol' }], ['arranque', '^motor (partida|arranque)'], ['radiador gol', '^radiador', { car: 'Gol' }],
  ['pedal acelerador', '^pedal acelerador'], ['tensor da correia', '^tensor correia'],
  // chaves
  ['chave reserva', '^chave (canivete|presen)', { aprox: 'livre' }], ['chave xc60', '^chave', { car: 'XC60' }], ['chave presença', '^chave.*presen'],
  ['chave de seta', '^chave seta'], ['chave de seta onix', '^chave seta', { car: 'Onix' }], 
  // forro, teto, interior
  ['forro teto', '^forro.*teto', { fam: '^forro' }], ['forro do teto gol', '^forro.*teto', { car: 'Gol', fam: 'forro|teto' }], ['forro de porta gol', '^forro.*porta', { car: 'Gol', fam: 'forro' }],
  ['forro porta dianteira esquerda', '^forro.*porta', { l: 'E', pos: 'D' }], ['teto solar', 'teto solar'], ['alça de teto', '^alca.*teto'],
  ['console central', '^console central'], ['painel de instrumentos palio 2010', '^painel instrumento', { car: 'Palio', ano: 2010 }], ['volante gol', '^volante', { car: 'Gol' }],
  ['cinto de segurança dianteiro', '^cinto', { pos: 'D' }], 
  // sensores e câmera
  ['sensor re', '^sensor (estacionamento|re)'], ['sensor estacionamento', '^sensor (estacionamento|re)'], ['sensor de estacionamento xc60', '^sensor (estacionamento|re)', { car: 'XC60' }],
  ['camera de ré', '^camera (de )?re'], ['câmera ré', '^camera (de )?re'], ['sensor de temperatura', '^sensor temperatura'], ['sensor map gol', '^sensor map', { car: 'Gol' }],
  // direção e suspensão
  ['caixa direção', '^caixa direcao', { fam: 'direcao' }], ['caixa de direção gol', '^caixa direcao', { car: 'Gol', fam: 'direcao' }], ['coluna de direcao', '^coluna direcao'],
  ['amortecedor dianteiro direito', '^amortecedor', { l: 'D', pos: 'D', nao: 'tampa|capo' }], ['amortecedor tampa traseira', '^amortecedor.*tampa'],
  ['bandeja suspensão', '^bandeja'], ['braço suspensão', '^braco suspensao'], ['manga de eixo direita', '^manga', { l: 'D' }],
  // portas, vidros, fechaduras
  ['porta traseira direita', '^porta( |$)', { l: 'D', pos: 'T' }], ['maçaneta externa dianteira direita', '^macaneta externa', { l: 'D', pos: 'D' }],
  ['maçaneta interna hb20', '^macaneta interna', { car: 'HB20' }], ['macaneta hb20 2015', '^macaneta', { car: 'HB20', ano: 2015 }],
  ['maquina de vidro traseira esquerda', '^(maquina vidro|motor (maquina )?vidro)', { l: 'E', pos: 'T' }], ['motor vidro gol', '^(maquina vidro|motor (maquina )?vidro)', { car: 'Gol' }],
  ['botao vidro eletrico', '^(botao|comando|botoneira).*vidro'], ['fechadura dianteira esquerda', '^fechadura', { l: 'E', pos: 'D' }],
  ['fechadura gol', '^fechadura', { car: 'Gol' }], ['fechadura capo', '^fechadura.*capo'], ['dobradiça porta', '^dobradica.*porta'], ['limitador de porta', '^limitador porta'],
  // módulos, elétrica
  ['modulo gol', '^modulo', { car: 'Gol' }], ['modulo golf', '^modulo', { car: 'Golf' }], ['modulo de injeção gol', '^modulo injecao', { car: 'Gol' }],
  ['central gol', '^modulo', { car: 'Gol' }], ['modulo conforto', '^modulo conforto'], ['modulo abs gol 2012', '^modulo.*abs', { car: 'Gol', ano: 2012 }],
  ['caixa de fusivel', '^caixa fusive'], ['caixa fusiveis onix', '^caixa fusive', { car: 'Onix' }], ['chicote da porta', '^chicote.*porta'],
  ['sonda lambda onix', '^sonda', { car: 'Onix' }], ['bobina de ignicao', '^bobina'], ['painel instrumentos', '^painel (de )?instrumento'],
  // erro de digitação
  ['retovisor', '^retrovisor'], ['retrovisro', '^retrovisor'], ['lanterna trazeira gol', '^lanterna', { car: 'Gol', pos: 'T' }], ['masaneta', '^macaneta'],
  ['modolo abs', '^modulo abs'], ['compresor', '^compressor'], ['resevatorio', '^reservatorio'], ['difuzor', '^difusor'], ['fexadura', '^fechadura'],
  ['bubina', '^bobina'], ['alternadro gol', '^alternador', { car: 'Gol', fam: 'alternador' }], ['para choqe', '^para-choque'], ['amortesedor dianteiro', '^amortecedor', { pos: 'D', nao: 'tampa|capo' }],
  // marca abreviada, "gol" x "Golf", "new fiesta"
  ['lanterna gol vw', '^lanterna', { car: 'Gol' }], ['vw golf lanterna', '^lanterna', { car: 'Golf' }], ['modulo onix gm', '^modulo', { car: 'Onix' }],
  ['gm', null, { marca: 'Chevrolet', todas: true }], ['vw', null, { marca: 'Volkswagen', todas: true }], ['volks gol modulo', '^modulo', { car: 'Gol' }],
  ['mercedes c180 modulo', '^modulo', { car: 'C180' }], ['fiat palio modulo', '^modulo', { car: 'Palio' }], ['chave de seta golf', '^chave seta', { car: 'Golf' }],
  ['gol', null, { car: 'Gol', todas: true }], ['golf', null, { car: 'Golf', todas: true }], ['new fiesta', null, { car: 'New Fiesta', todas: true }], ['modulo new fiesta', '^modulo', { car: 'New Fiesta' }],
  ['lanterna fiesta', '^lanterna', { car: 'Fiesta' }], ['new civic modulo', '^modulo', { car: 'New Civic' }],
  // o carro salvo sobe sem esconder os outros
  ['lanterna', '^lanterna', { meu: XC60 }], ['bomba de agua', BOMBA_AGUA, { nao: FORA_AGUA, meu: XC60 }], ['farol', '^farol', { meu: XC60 }],
]);

// ---------------------------------------------------------------------------------------------------------------------
// O estoque como o gabarito o lê (nada do motor)
// ---------------------------------------------------------------------------------------------------------------------
const PECAS: Peca[] = ix.id.map((id: string, k: number) => ({
  k, id, n: nrm(ix.n[k]), s: nrm(ix.tipos[ix.s[k]] ?? ''), c: nrm(ix.familias[ix.c[k]] ?? ''), b: ix.marcas[ix.b[k]] ?? '', ms: ix.ms?.[k] ?? [ix.m[k]], ys: ix.ys?.[k],
  y: ix.y[k] || null, l: ix.l?.[k], pos: ix.pos?.[k], o: ix.o[k] ?? '', t: nrm(ix.t[k]),
}));
// carro unido: o apelido ("New Fiesta", "C180") vale pelo carro principal (o modelo que mais aparece nas peças dele)
const PRINCIPAL = new Map<string, string>();
for (const ap of (ix.apelidos ?? []) as string[]) {
  const [b, a] = ap.split('|');
  const conta = new Map<string, number>();
  for (const p of PECAS) if (p.b === b && p.ms.includes(a)) for (const m of p.ms) if (m !== a) conta.set(m, (conta.get(m) ?? 0) + 1);
  const principal = [...conta].sort((x, y) => y[1] - x[1])[0]?.[0];
  if (principal) PRINCIPAL.set(junto(a), principal);
}
const nomesDoCarro = (car: string) => [car, PRINCIPAL.get(junto(car))].filter(Boolean).map((c) => junto(c!));
/** A peça serve no carro: pelo dado (o modelo ou um dos carros da peça de 2+ carros; o apelido vale pelo principal). */
const doCarro = (p: Peca, car: string) => { const ns = nomesDoCarro(car); return p.ms.some((m) => ns.includes(junto(m))); };
/** ...ou o título do anúncio cita o carro por extenso ("Alternador Jeep Renegade Fiat Toro" para "toro") */
const citaCarro = (p: Peca & { t?: string }, car: string) => {
  const ws = (p.t ?? '').split(/[^a-z0-9]+/).filter(Boolean); const c = junto(car);
  return ws.some((_, i) => [1, 2, 3].some((n) => ws.slice(i, i + n).join('') === c));
};
const noAno = (p: Peca, ano: number, car?: string) => {
  let y = p.y;
  if (p.ys && car) { const ns = nomesDoCarro(car); const i = p.ms.findIndex((m) => ns.includes(junto(m))); if (i >= 0 && p.ys[i]) y = p.ys[i]; }
  return !y || (ano >= y[0] && ano <= y[1]);
};
const certa = (p: Peca, e: Esp) =>
  (!e.tipo || new RegExp(e.tipo).test(p.n)) && (!e.nao || !new RegExp(e.nao).test(p.n)) &&
  (!e.car || doCarro(p, e.car)) && (!e.marca || p.b === e.marca) && (!e.l || p.l === e.l) &&
  (!e.pos || p.pos === e.pos || p.pos === 'A') && (!e.ano || noAno(p, e.ano, e.car)) &&
  (!e.cod || p.o.replace(/[^a-z0-9 ]/g, '').split(' ').includes(e.cod));
const temGabarito = (e: Esp) => !!(e.tipo || e.cod || e.car || e.marca);

// ---------------------------------------------------------------------------------------------------------------------
// O juiz: roda a consulta num motor e diz o que falhou
// ---------------------------------------------------------------------------------------------------------------------
type Veredito = {
  falhas: string[]; n: number; aprox: boolean; nExatas: number; certas: number; noTopo10: number; achadas: number;
  topo: string[];
};
type Motor = { procurar: (f: any, meu?: Meu) => any[]; aproximado: boolean; nExatas?: number; faltou?: unknown; outrosLados?: unknown[] };

function julgar(motor: Motor, e: Esp): Veredito {
  const lista = motor.procurar({ q: e.q, ...(e.f ?? {}) }, e.meu);
  const aprox = !!motor.aproximado;
  // quantas peças do começo da lista a tela apresenta como "é isto que você digitou"
  const nExatas = aprox ? 0 : typeof motor.nExatas === 'number' ? motor.nExatas : lista.length;
  const S = temGabarito(e) ? PECAS.filter((p) => certa(p, e)) : [];
  const ehCerta = new Set(S.map((p) => p.k));
  const falhas: string[] = [];
  const achadas = lista.filter((it) => ehCerta.has(it.k)).length;
  const noTopo10 = lista.slice(0, 10).filter((it) => ehCerta.has(it.k)).length;
  if (temGabarito(e) && S.length) {
    if (!lista.length) falhas.push('ZERO');
    else {
      const K = Math.min(5, S.length, lista.length);
      if (!lista.slice(0, K).every((it) => ehCerta.has(it.k))) falhas.push('TOPO');
      if (aprox && e.aprox !== 'livre') falhas.push('APROX');
      if ((e.tipo || e.cod || e.todas) && achadas < S.length) falhas.push(`FALTAM(${achadas}/${S.length})`);
      // carro digitado: nada de outro carro como resultado exato ("gol" não é "Golf")
      if (e.car && !e.f && lista.slice(0, Math.min(10, nExatas)).some((it) => !doCarro(PECAS[it.k], e.car!) && !citaCarro(PECAS[it.k], e.car!))) falhas.push('CARRO');
      if (e.meu && S.some((p) => doCarro(p, e.meu!.m)) && !(ehCerta.has(lista[0].k) && doCarro(PECAS[lista[0].k], e.meu.m))) falhas.push('MEU');
    }
  } else if (temGabarito(e)) {
    // o estoque não tem a peça pedida: nada pode aparecer como achado exato; as parecidas do topo são da família
    if (lista.length && nExatas > 0) falhas.push('EXATO_ERRADO');
    const fam = new RegExp(e.fam ?? (e.tipo ?? '').replace(/\^/g, ''));
    if (lista.length && (e.fam || e.tipo) && !lista.slice(0, 5).every((it) => fam.test(`${PECAS[it.k].n} ${PECAS[it.k].s} ${PECAS[it.k].c}`))) falhas.push('FAMILIA');
    // lado/posição que falta, com a peça do outro lado no estoque: a tela diz o que faltou e oferece o outro lado
    if (!lista.length && e.l) {
      const outro = PECAS.some((p) => certa(p, { ...e, l: e.l === 'E' ? 'D' : 'E' }));
      if (outro && !(motor.faltou && motor.outrosLados?.length)) falhas.push('SAIDA');
    }
  }
  const topo = lista.slice(0, 3).map((it) => `${it.n} [${it.b} ${(it.ms ?? [it.m]).join('/')}]`);
  return { falhas, n: lista.length, aprox, nExatas, certas: S.length, noTopo10, achadas, topo };
}

/** O candidato ficou pior que o motor do ar nesta consulta? (falha o que o outro cumpre, ou traz menos peças certas) */
function perdeu(e: Esp, c: Veredito, a: Veredito): string {
  if (c.falhas.length && !a.falhas.length) return `falha ${c.falhas.join('+')} e o do ar não`;
  if (c.certas && c.noTopo10 < a.noTopo10) return `${c.noTopo10} certas nas 10 primeiras (no ar: ${a.noTopo10})`;
  if (c.certas && c.achadas < a.achadas) return `${c.achadas} certas na lista (no ar: ${a.achadas})`;
  if (!temGabarito(e) && !c.n && a.n) return `zero (no ar: ${a.n})`;
  return '';
}

// ---------------------------------------------------------------------------------------------------------------------
// O motor do ar: as fontes do commit NO_AR pelo git, num módulo temporário em node_modules/.cache (fora do git)
// ---------------------------------------------------------------------------------------------------------------------
async function motorNoAr(): Promise<(new (ix: unknown) => Motor) | null> {
  const dir = join(process.cwd(), 'node_modules', '.cache', 'busca-no-ar', NO_AR.slice(0, 12));
  const saida = join(dir, 'busca.mjs');
  try {
    if (!existsSync(saida)) {
      mkdirSync(dir, { recursive: true });
      for (const arq of ['busca.ts', 'sinonimos.ts', 'meuCarro.ts']) {
        writeFileSync(join(dir, arq), execFileSync('git', ['show', `${NO_AR}:site/src/lib/${arq}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
      }
      const { build } = await import('esbuild');
      await build({ entryPoints: [join(dir, 'busca.ts')], bundle: true, format: 'esm', outfile: saida, logLevel: 'silent', nodePaths: [join(process.cwd(), 'node_modules')] });
    }
    return (await import(/* @vite-ignore */ pathToFileURL(saida).href)).Busca;
  } catch {
    return null;
  }
}

/** As consultas da tabela antiga (lib/busca.regressao.ts) entram no placar pelo gabarito dela. */
import { casos, avaliar } from './busca.regressao';

/** Consultas que o candidato ainda não cumpre (e por quê). Cada uma é discutível ou depende de dado que a busca não tem;
 *  o motor do ar também não cumpre nenhuma delas. Tirar daqui quando passar a cumprir. */
const CONHECIDAS: Record<string, string> = {
};

const chave = (e: Esp) => `${e.q}${e.f ? ` ${JSON.stringify(e.f)}` : ''}${e.meu ? ` [meu ${e.meu.m}]` : ''}`;

describe('busca: o juiz diferencial (gabarito pelo estoque; candidato × motor do ar)', () => {
  let Ar: (new (ix: unknown) => Motor) | null = null;
  let Cand: new (ix: unknown) => unknown = Busca as never;
  let cand = null as unknown as Motor;
  const vc = new Map<string, Veredito>();
  beforeAll(async () => {
    Ar = await motorNoAr();
    // para medir outro motor com o mesmo juiz (o candidato de antes da correção): BUSCA_CANDIDATO=/caminho/busca.mjs
    if (process.env.BUSCA_CANDIDATO) Cand = (await import(/* @vite-ignore */ pathToFileURL(process.env.BUSCA_CANDIDATO).href)).Busca;
    cand = new Cand(JSON.parse(JSON.stringify(ix))) as Motor;
    for (const e of Q) vc.set(chave(e), julgar(cand, e));
  }, 60000);

  it('a tabela tem as consultas da revisão e mais de 150 do cliente, sem repetição', () => {
    expect(Q.filter((e) => e.de === 'revisor').length).toBe(291);
    expect(Q.filter((e) => e.de === 'cliente').length).toBeGreaterThanOrEqual(150);
    const rep = Q.map(chave).filter((k, i, a) => a.indexOf(k) !== i && Q.filter((e) => chave(e) === k).some((e) => e.de !== 'revisor'));
    expect([...new Set(rep)]).toEqual([]);
  });

  it('o candidato cumpre o gabarito em todas as consultas (fora as conhecidas, que seguem falhando)', () => {
    const falhas = Q.filter((e) => vc.get(chave(e))!.falhas.length && !CONHECIDAS[chave(e)])
      .map((e) => `${chave(e)} | ${vc.get(chave(e))!.falhas.join('+')} | ${vc.get(chave(e))!.topo[0] ?? '(vazio)'}`);
    expect([...new Set(falhas)]).toEqual([]);
    const curadas = Object.keys(CONHECIDAS).filter((k) => Q.some((e) => chave(e) === k) && !vc.get(k)!.falhas.length);
    expect(curadas, 'estas já passam: tirar das CONHECIDAS').toEqual([]);
  });

  it('o candidato não perde para o motor do ar em nenhuma consulta (e o placar)', () => {
    if (!Ar) { console.warn('motor do ar indisponível (sem git ou sem o commit): comparação pulada'); return; }
    const ar = new Ar(JSON.parse(JSON.stringify(ix)));
    const linhas: string[] = []; const perdas: string[] = [];
    const placar = { consultas: 0, vitorias: 0, empates: 0, derrotas: 0, candOk: 0, arOk: 0 };
    for (const e of Q) {
      const c = vc.get(chave(e))!; const a = julgar(ar, e);
      const p = perdeu(e, c, a);
      const ganhou = !p && ((!c.falhas.length && a.falhas.length > 0) || (c.certas > 0 && (c.noTopo10 > a.noTopo10 || c.achadas > a.achadas)));
      placar.consultas++; if (p) placar.derrotas++; else if (ganhou) placar.vitorias++; else placar.empates++;
      if (!c.falhas.length) placar.candOk++; if (!a.falhas.length) placar.arOk++;
      if (p) perdas.push(`${chave(e)} | ${p} | cand: ${c.topo[0] ?? '(vazio)'} | ar: ${a.topo[0] ?? '(vazio)'}`);
      linhas.push([p ? 'PERDE' : ganhou ? 'GANHA' : 'igual', e.de, chave(e), `estoque ${c.certas}`,
        `cand ${c.n}${c.aprox ? '~' : ''} ex${c.nExatas} top10=${c.noTopo10} ${c.falhas.join('+') || 'ok'}`,
        `ar ${a.n}${a.aprox ? '~' : ''} top10=${a.noTopo10} ${a.falhas.join('+') || 'ok'}`, `C: ${c.topo.join(' ; ')}`, `A: ${a.topo.join(' ; ')}`].join(' | '));
    }
    console.log(`PLACAR juiz: ${JSON.stringify(placar)}`);
    // a tabela antiga (926 consultas geradas, gabarito dela) no placar: só no modo relatório, porque dobra o tempo do
    // teste e não guarda nada a mais (busca.regressao.test.ts já exige as 926 do candidato: quem acerta todas não perde)
    let antiga: Record<string, number> | undefined;
    if (process.env.BUSCA_RELATORIO) {
      const lista = casos(ix);
      const rc = avaliar(Cand as any, JSON.parse(JSON.stringify(ix)), lista).rows; const ra = avaliar(Ar as any, JSON.parse(JSON.stringify(ix)), lista).rows;
      antiga = { consultas: lista.length, candOk: rc.filter((r) => r.ok).length, arOk: ra.filter((r) => r.ok).length, vitorias: 0, derrotas: 0 };
      rc.forEach((r, i) => { if (r.ok && !ra[i].ok) antiga!.vitorias++; if (!r.ok && ra[i].ok) { antiga!.derrotas++; perdas.push(`[tabela antiga] ${r.q} | ${r.motivo} | ${r.top1}`); } });
      console.log(`PLACAR tabela antiga: ${JSON.stringify(antiga)}`);
      writeFileSync(process.env.BUSCA_RELATORIO, `${linhas.join('\n')}\n\n${JSON.stringify({ placar, antiga }, null, 1)}\n`);
    }
    expect(perdas).toEqual([]);
  }, 60000);

  it('tempo: a busca não pesa na digitação (mediana por consulta nova, índice pronto)', () => {
    const b = new Cand(JSON.parse(JSON.stringify(ix))) as Motor;
    const qs = [...new Set(Q.map((e) => e.q))];
    for (const q of qs.slice(0, 40)) b.procurar({ q }); // aquece o índice e o JIT
    const ts: number[] = [];
    for (const q of qs.slice(40)) { const t = performance.now(); b.procurar({ q }); ts.push(performance.now() - t); }
    ts.sort((x, y) => x - y);
    const med = ts[Math.floor(ts.length / 2)], p95 = ts[Math.floor(ts.length * 0.95)];
    console.log(`TEMPO candidato: mediana ${med.toFixed(2)} ms, p95 ${p95.toFixed(2)} ms, ${ts.length} consultas`);
    // folga para máquina de CI lenta; o número medido no Mac vai no relatório da rodada
    expect(med).toBeLessThan(3);
  });
});
