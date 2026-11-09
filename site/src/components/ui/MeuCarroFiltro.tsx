// "Meu carro" no catálogo: hook que lê o carro salvo (só no navegador, depois da montagem)
// e o botão "Ver só peças do meu carro" que aplica marca/modelo/ano nos filtros existentes.
import { useEffect, useState } from 'react';
import { lerMeuCarro, nomeCarro, EVENTO, type MeuCarro } from '../../lib/meuCarro';

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

export default function MeuCarroFiltro({ marca, modelo, ano, aoAplicar }: Props) {
  const carro = useMeuCarro();
  if (!carro) return null;
  const filtrado = marca === carro.b && modelo === carro.m && (carro.y == null || ano === carro.y);
  return (
    <div className="cat-meu">
      <p>
        <span>{filtrado ? 'Mostrando as peças do seu carro' : 'Seu carro'}</span>
        <b>{nomeCarro(carro)}</b>
      </p>
      {filtrado ? (
        <button type="button" className="botao botao-linha" onClick={() => aoAplicar({ marca: undefined, modelo: undefined, ano: undefined })}>
          Ver todas as peças
        </button>
      ) : (
        <button type="button" className="botao botao-grafite" onClick={() => aoAplicar({ marca: carro.b, modelo: carro.m, ano: carro.y ?? undefined })}>
          Ver só peças do meu carro
        </button>
      )}
    </div>
  );
}
