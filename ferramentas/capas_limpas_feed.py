#!/usr/bin/env python3
"""Capas SEM o logo para o feed do Google, só nas peças que não têm outra foto além da montagem com o carro.

O feed (site/src/lib/feed.ts: itemFeed) usa as fotos reais do anúncio, porque o Google não aceita o logo sobre a foto.
Quando todas as fotos da galeria são montagem (classe "c" em site/src/data/fotos-ml-caixas.json), a imagem principal
seria o carro do vendedor ao lado da peça; aí o feed usa a capa de estúdio sem o logo (site/public/estudio-limpa/<id>.webp),
que o capas_estudio.py grava em ESTUDIO_SAIDA_LIMPA. Peça sem a cópia limpa: o feed fica com a montagem (nada inventado).

Este script põe em site/public/estudio-limpa/ a cópia limpa das peças "só montagem" e tira as que não são mais.
Rodar no Mac depois de preparar_dados.py e de medir_fotos_ml.py --reclassificar; commitar a pasta junto.
    python ferramentas/capas_limpas_feed.py [pasta das capas limpas]   (padrão: $ESTUDIO_SAIDA_LIMPA ou
                                                                        ~/izzatcar-capas-v2/estudio-limpa)
    --ensaio   só mostra o que faria
"""
import json
import os
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from preparar_dados import fotos_galeria, ler_classes_fotos  # noqa: E402

PECAS = ROOT / "site" / "src" / "data" / "pecas.json"
DESTINO = ROOT / "site" / "public" / "estudio-limpa"


def so_montagem(fotos, classes):
    """A peça cujas fotos da galeria são todas montagem com o carro."""
    g = fotos_galeria(fotos, classes)
    return bool(g) and all(classes.get(k) == "c" for k in g)


def main(argv):
    ensaio = "--ensaio" in argv
    args = [a for a in argv if not a.startswith("--")]
    origem = Path(args[0] if args else os.getenv("ESTUDIO_SAIDA_LIMPA")
                  or Path.home() / "izzatcar-capas-v2" / "estudio-limpa")
    classes = ler_classes_fotos()
    pecas = json.loads(PECAS.read_text(encoding="utf-8"))
    alvo = sorted(p["id"] for p in pecas if so_montagem(p.get("fotos") or [], classes))
    tem = {f.stem for f in DESTINO.glob("*.webp")} if DESTINO.exists() else set()
    poe, falta = [], []
    for i in alvo:
        arq = origem / f"{i}.webp"
        if not arq.exists():
            falta.append(i)
        elif i not in tem or arq.read_bytes() != (DESTINO / f"{i}.webp").read_bytes():
            poe.append(arq)
    tira = sorted(tem - set(alvo))
    print(f"peças só com a montagem: {len(alvo)} | cópia limpa nova/mudada: {len(poe)} | sem cópia limpa "
          f"(o feed fica com a montagem): {len(falta)} {falta[:10]} | sai: {len(tira)}")
    if ensaio:
        return
    DESTINO.mkdir(parents=True, exist_ok=True)
    for arq in poe:
        shutil.copyfile(arq, DESTINO / arq.name)
    for i in tira:
        (DESTINO / f"{i}.webp").unlink()


if __name__ == "__main__":
    main(sys.argv[1:])
