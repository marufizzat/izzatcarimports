// "Meu carro" no catálogo: hook que lê o carro salvo (só no navegador, depois da montagem) e a linha "Seu carro",
// que aplica marca/modelo/ano nos filtros existentes. Uma linha só (também no celular), num lugar que o cabeçalho já
// guardou quando há carro salvo (html[data-carro] + .cat-meu-lugar, ver MeuCarroEstilo.astro): a grade não pula.
// O estoque muda (peça vende, modelo sai): sem peça do ano salvo, a linha oferece o modelo em todos os anos, com aviso;
// modelo que saiu do site, o WhatsApp ("a gente procura no pátio"). Nunca um "Ver só as dele" que dá zero.
import { useEffect, useState, type ReactNode } from 'react';
import { lerMeuCarro, nomeCarro, carregarGaragem, estoqueDoCarro, EVENTO, ABRIR, type MeuCarro, type Estoque } from '../../lib/meuCarro';
import { whatsUrl } from '../../lib/whats';

export function useMeuCarro(): MeuCarro | null {
  const [carro, setCarro] = useState<MeuCarro | null>(null);
  useEffect(() => {
    setCarro(lerMeuCarro());
    const ao = (e: Event) => setCarro((e as CustomEvent<MeuCarro | null>).detail ?? null);
    window.addEventListener(EVENTO, ao);
    return () => window.removeEventListener(EVENTO, ao);
  }, []);
  return carro;
}

type Props = {
  marca?: string;
  modelo?: string;
  ano?: number;
  aoAplicar: (f: { marca?: string; modelo?: string; ano?: number }) => void;
};

const CarroIcone = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 17h14M3 13l2-5.5A2 2 0 0 1 6.9 6h10.2a2 2 0 0 1 1.9 1.5L21 13v4a1 1 0 0 1-1 1h-1.5M3 13v4a1 1 0 0 0 1 1h1.5M3 13h18" /><circle cx="7.5" cy="17.5" r="1.5" /><circle cx="16.5" cy="17.5" r="1.5" /></svg>
);
/** Rótulo curto no celular e completo no PC (a linha nunca quebra). */
const Rotulo = ({ pc, cel }: { pc: string; cel: string }) => (
  <><span className="so-pc">{pc}</span><span className="so-cel">{cel}</span></>
);

export default function MeuCarroFiltro({ marca, modelo, ano, aoAplicar }: Props) {
  const carro = useMeuCarro();
  const [estoque, setEstoque] = useState<Estoque | null>(null);
  useEffect(() => {
    setEstoque(null);
    if (!carro) return;
    let vivo = true;
    carregarGaragem().then((g) => { if (vivo) setEstoque(estoqueDoCarro(g, carro)); }).catch(() => { /* sem a garagem: segue como antes */ });
    return () => { vivo = false; };
  }, [carro?.b, carro?.m, carro?.y]);

  // o lugar existe sempre (vazio no HTML e na montagem): o carro entra nele sem empurrar a grade
  if (!carro) return <div className="cat-meu-lugar" />;
  const qualAno = () => window.dispatchEvent(new CustomEvent(ABRIR));
  const semAno = estoque?.estado === 'sem-ano';
  const anoUsado = semAno ? null : carro.y; // ano sem peça agora: o modelo em todos os anos
  const filtrado = marca === carro.b && modelo === carro.m && (anoUsado == null ? !semAno || ano == null : ano === anoUsado);

  let linha: ReactNode;
  if (estoque?.estado === 'sem-modelo') {
    linha = (
      <>
        <p className="cat-meu-txt"><span>Sem peças do seu carro no site agora</span><b>{nomeCarro(carro)}</b></p>
        <a className="botao botao-laranja cat-meu-whats" href={whatsUrl(`Procuro peça para ${nomeCarro(carro)}. Tem no pátio?`)}>
          <Rotulo pc="Procurar no pátio" cel="Procurar" />
        </a>
      </>
    );
  } else {
    const rotulo = semAno
      ? <span>Sem peças de {carro.y} agora</span>
      : carro.y == null
        ? <span>{filtrado ? 'Peças do seu carro' : 'Meu carro'} · <button type="button" onClick={qualAno}>qual o ano?</button></span>
        : <span>{filtrado ? 'Peças do seu carro' : 'Meu carro'}</span>;
    linha = (
      <>
        <p className="cat-meu-txt">{rotulo}<b>{semAno ? `${carro.b} ${carro.m}${filtrado ? ' · todos os anos' : ''}` : nomeCarro(carro)}</b></p>
        {filtrado ? (
          <button type="button" className="botao botao-linha" onClick={() => aoAplicar({ marca: undefined, modelo: undefined, ano: undefined })}>
            <Rotulo pc="Ver todas as peças" cel="Ver todas" />
          </button>
        ) : (
          <button type="button" className="botao botao-grafite" onClick={() => aoAplicar({ marca: carro.b, modelo: carro.m, ano: anoUsado ?? undefined })}>
            {semAno ? <Rotulo pc={`Ver o ${carro.m} de todos os anos`} cel="Ver todos os anos" /> : <Rotulo pc="Ver só as peças do meu carro" cel="Só o meu carro" />}
          </button>
        )}
      </>
    );
  }
  return (
    <div className="cat-meu-lugar">
      <div className="cat-meu" aria-live="polite">
        <span className="cat-meu-icone"><CarroIcone /></span>
        {linha}
      </div>
    </div>
  );
}
