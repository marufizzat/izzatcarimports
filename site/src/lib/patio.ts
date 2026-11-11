// "Não achou? A gente procura no pátio": a mensagem do WhatsApp com o que a pessoa procura e para qual carro.
// UMA regra para o bloco do catálogo (catalogo/Catalogo.tsx) e a última linha das sugestões da busca do cabeçalho
// (ui/SugestoesBusca.tsx). O texto é o do catálogo da rodada 10, igual letra por letra (patio.test.ts confere).
// Sem node:fs: roda no navegador.
import { codigoJunto, type Carro } from './busca';
import { nomeCarro, type MeuCarro } from './meuCarro';

export type PedidoPatio = {
  /** o que a pessoa digitou */
  q?: string;
  /** filtros do catálogo (marca, modelo, ano, sistema e tipo) */
  marca?: string; modelo?: string; ano?: number; tipo?: string; sub?: string;
  /** o 1º carro reconhecido no texto (Busca.carrosDaBusca[0] ou sugestoes().carros[0]) */
  carroDaBusca?: Carro | null;
  /** o código gravado que a busca achou numa peça (Busca.codigoDaBusca) */
  codigo?: string;
  /** o carro salvo no "Meu carro" */
  meuCarro?: MeuCarro | null;
};

/** "farol compass" -> "farol" (tira da busca as palavras do carro: "Procuro farol para Jeep Compass"). */
export function semCarro(q: string, c: Carro | null | undefined): string {
  if (!c) return q;
  const re = (s: string) => new RegExp(
    `(^|[^\\p{L}\\p{N}])${[...s.replace(/[^\p{L}\p{N}]/gu, '')].map((ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s-]?')}(?=$|[^\\p{L}\\p{N}])`, 'giu');
  return q.replace(re(c.m), '$1').replace(re(c.b), '$1').replace(/\s+/g, ' ').trim();
}

/** O pedido (nunca "Procuro: 1981"): o carro é o do filtro, senão o digitado, senão o salvo; o ano, o do filtro ou o
 *  da busca, senão o do carro salvo (quando é o mesmo carro). Código digitado vira "a peça com o código X".
 *  texto = "Procuro retrovisor direito para Volvo XC60 2019. Não achei no site, tem no pátio?" (só o contexto: a
 *  abertura do site entra em whatsUrl, lib/whats.ts). */
export function pedidoPatio(o: PedidoPatio): { texto: string; procuro: string; oQue: string; digitado: string; carro: string; ano?: number } {
  const q = (o.q || '').trim();
  const m = q.match(/\b(19[89]\d|20[0-3]\d)\b/);
  const qSemAno = m ? q.replace(m[0], ' ').replace(/\s+/g, ' ').trim() : q;
  const anoQ = m ? Number(m[1]) : undefined;
  const mc = o.meuCarro ?? null;
  const cb = o.carroDaBusca ?? null;
  const mesmo = (b: string, mm?: string) => !!mc && mc.b === b && (!mm || mc.m === mm);
  const anoDe = (b: string, mm?: string) => o.ano || anoQ || (mesmo(b, mm) ? mc!.y ?? undefined : undefined);
  const alvo = o.marca ? { b: o.marca, m: o.modelo || '', y: anoDe(o.marca, o.modelo) }
    : cb ? { b: cb.b, m: cb.m, y: anoDe(cb.b, cb.m) }
    : mc ? { b: mc.b, m: mc.m, y: o.ano || anoQ || mc.y || undefined }
    : null;
  const ano = alvo?.y ?? (o.ano || anoQ);
  const carro = alvo ? (alvo.m ? nomeCarro({ b: alvo.b, m: alvo.m, y: alvo.y ?? null }) : `${alvo.b}${alvo.y ? ` ${alvo.y}` : ''}`) : '';
  // o que a pessoa digitou, sem o carro e o ano ("retrovisor xc60 2019" -> "retrovisor"); código: "a peça com o código …"
  const digitado = o.marca ? qSemAno : semCarro(qSemAno, cb);
  const cod = o.codigo || codigoJunto(digitado) || (/^[a-z0-9]{6,20}$/i.test(digitado) && (digitado.match(/\d/g) ?? []).length >= 5 ? digitado : '');
  const oQue = (cod ? `a peça com o código ${cod.toUpperCase()}` : digitado) || (o.sub ? o.sub.toLowerCase() : o.tipo ? `peça de ${o.tipo.toLowerCase()}` : 'peça');
  const paraCarro = carro ? `para ${carro}` : ano ? `para carro ano ${ano}` : '';
  const procuro = [oQue, paraCarro].filter(Boolean).join(' ');
  return { texto: `Procuro ${procuro}. Não achei no site, tem no pátio?`, procuro, oQue, digitado, carro, ano };
}
