"""O vocabulário da loja para os testes do site: os nomes de bloco e de tipo que o preparar_dados.py SABE escrever.

    python ferramentas/vocabulario_loja.py          # grava site/testes/fixtures/vocabulario.json
    python ferramentas/vocabulario_loja.py --conferir   # sai com erro se o arquivo está fora de dia

Para que serve: os mapas do site (Raio-x, kit da batida, vistas por dentro, palco da abertura) citam blocos e tipos pelo
NOME. O teste deles não pode perguntar ao estoque do dia se o nome existe (um tipo some quando a última peça dele vende,
e o robô parava a loja): pergunta a este arquivo, que não muda com o estoque. Mudou um nome em BLOCOS ou em
_TIPOS_DO_BLOCO: rode este roteiro e commite o json junto (testes/test_dados.py confere que os dois andam juntos).
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
ARQ = ROOT / "site" / "testes" / "fixtures" / "vocabulario.json"


def vocabulario():
    import preparar_dados as pd
    nome = dict(pd.BLOCOS)
    tipos = {t: nome[k] for t, k in sorted(pd.BLOCO_POR_TIPO.items())}
    tipos["Outros"] = "Outros"   # o tipo e o bloco do que não cai em nada
    return {"blocos": [n for _, n in pd.BLOCOS] + ["Outros"], "tipos": tipos}


def texto():
    return json.dumps(vocabulario(), ensure_ascii=False, indent=1) + "\n"


if __name__ == "__main__":
    if "--conferir" in sys.argv:
        ok = ARQ.exists() and ARQ.read_text(encoding="utf-8") == texto()
        print("vocabulario.json em dia" if ok else "vocabulario.json FORA DE DIA: rode python ferramentas/vocabulario_loja.py")
        sys.exit(0 if ok else 1)
    ARQ.parent.mkdir(parents=True, exist_ok=True)
    ARQ.write_text(texto(), encoding="utf-8")
    v = vocabulario()
    print(f"{ARQ.relative_to(ROOT)}: {len(v['blocos'])} blocos, {len(v['tipos'])} tipos")
