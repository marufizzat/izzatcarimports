"""
IZZAT CAR — folha "capas para revisar" (versão 2 das capas de estúdio).

O capas_estudio.py (ESTUDIO_VERSAO=2) anota em <pasta>/_revisar.json as capas suspeitas:
  - montagem separada ......... foto montagem (ex.: painel do carro + peça) em que só o bloco da peça ficou;
  - montagem sem separar ...... montagem em que não deu para separar (tentou a próxima foto);
  - capa de foto montagem ..... nenhuma outra foto serviu: a capa saiu da montagem;
  - carro colado na foto ...... a foto tinha o carrinho do anúncio grudado na peça: usou outra foto;
  - cortada na capa ........... a peça veio cortada da foto (encosta na borda ou acaba na reta do recorte do
                                vendedor) e nenhuma foto do anúncio a mostra inteira: a capa saiu menor, com margem;
                                ou a peça chegou perto demais da borda da capa;
  - peça cortada na foto ...... (nome antigo do motivo acima, em _revisar.json de antes de 10/11);
  - N pedaços grandes ......... a capa tem mais de um pedaço grande (par, kit, duas vistas coladas...);
  - sem foto limpa (reserva) .. só sobrou a foto com carro/sujeira.
Esta ferramenta junta tudo numa página para o olho humano (capa | foto original do anúncio | motivos)
e calcula a proporção sobre as capas geradas.

Uso:
  python ferramentas/folha_revisar.py <pasta_das_capas> [saida.html]
"""

import html
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GRUPOS = [
    ("montagem separada", "Montagem: separada sozinha (conferir se ficou só a peça)"),
    ("montagem sem separar", "Montagem: não deu para separar nesta foto"),
    ("capa de foto montagem", "Montagem: a capa saiu da montagem (nenhuma outra foto serviu)"),
    ("carro colado", "Carro do anúncio colado na peça: pulou essa foto (conferir a escolhida)"),
    ("cortada na capa", "Cortada na capa: peça cortada na foto e nenhuma foto inteira (saiu menor, com margem)"),
    ("peça cortada", "Peça cortada na foto (encosta na borda; não havia foto melhor)"),
    ("pedaços grandes", "Mais de um pedaço grande na capa"),
    ("reserva", "Sem foto limpa (reserva)"),
]


def grupo(motivo):
    for chave, _ in GRUPOS:
        if chave in motivo:
            return chave
    return motivo


def ler(pasta):
    dados = {}
    for arq in sorted(pasta.glob("_revisar*.json")):
        dados.update(json.loads(arq.read_text(encoding="utf-8")))
    return dados


def main():
    pasta = Path(sys.argv[1]).resolve()
    saida = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else pasta / "_revisar.html"
    dados = ler(pasta)
    pecas = {}
    arq_pecas = ROOT / "site" / "src" / "data" / "pecas.json"
    if arq_pecas.exists():
        pecas = {x["id"]: x for x in json.loads(arq_pecas.read_text(encoding="utf-8"))}
    total = len(list(pasta.glob("*.webp")))
    por_grupo = {}
    for mlb, v in dados.items():
        for g in sorted({grupo(m) for m in v["motivos"]}):
            por_grupo.setdefault(g, []).append(mlb)
    cont = Counter({g: len(v) for g, v in por_grupo.items()})
    algum = len(dados)

    def rel(p):
        try:
            return str(Path(p).resolve().relative_to(saida.parent))
        except ValueError:
            return Path(p).resolve().as_uri()

    secoes = []
    for chave, titulo in GRUPOS + [(g, g) for g in por_grupo if g not in dict(GRUPOS)]:
        ids = por_grupo.get(chave)
        if not ids:
            continue
        cartoes = []
        for mlb in sorted(ids):
            v = dados[mlb]
            p = pecas.get(mlb, {})
            foto = v.get("foto")
            orig = f"https://http2.mlstatic.com/D_{foto}-O.jpg" if foto else ""
            cartoes.append(
                f'<figure><div class="par"><img loading="lazy" src="{html.escape(rel(pasta / (mlb + ".webp")))}" alt="">'
                + (f'<a href="{orig}" target="_blank" rel="noopener"><img loading="lazy" src="{orig}" alt=""></a>' if orig else "")
                + f'</div><figcaption><b>{html.escape(p.get("n", mlb))}</b> · '
                + (f'<a href="{html.escape(p["ml"])}" target="_blank" rel="noopener">{mlb}</a>' if p.get("ml") else mlb)
                + f'<br><small>{html.escape("; ".join(v["motivos"]))}</small></figcaption></figure>')
        secoes.append(f'<h2>{html.escape(titulo)} <span>{len(ids)} ({len(ids) / max(total, 1):.1%})</span></h2>'
                      f'<div class="grade">{"".join(cartoes)}</div>')
    resumo = "".join(f"<li><b>{html.escape(dict(GRUPOS).get(g, g))}</b>: {n} "
                     f"({n / max(total, 1):.1%} das capas; ~{round(n / max(total, 1) * 5312)} no catálogo de 5.312)</li>"
                     for g, n in cont.most_common())
    pagina = f"""<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Capas para revisar</title>
<style>
body{{font:15px/1.45 system-ui,-apple-system,sans-serif;margin:0;padding:24px 28px;background:#f5f5f7;color:#1d1d1f}}
h1{{margin:0 0 6px;font-size:26px}} h2{{margin:34px 0 12px;font-size:19px}} h2 span{{color:#65656b;font-weight:500}}
.grade{{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}}
figure{{margin:0;background:#fff;border-radius:14px;padding:8px;box-shadow:0 1px 2px rgb(0 0 0/.06)}}
.par{{display:grid;grid-template-columns:1fr 1fr;gap:6px}} .par img{{width:100%;aspect-ratio:1;object-fit:contain;
background:#fff;border-radius:8px;box-shadow:inset 0 0 0 1px #e2e2e7}}
figcaption{{font-size:13px;padding:6px 4px 2px}} small{{color:#c2410c}} a{{color:inherit}}
</style></head><body>
<h1>Capas para revisar</h1>
<p>{algum} de {total} capas geradas ({algum / max(total, 1):.1%}) têm algum alerta. Cada cartão: <b>capa</b> | <b>foto original do anúncio</b> (toque para abrir).</p>
<ul>{resumo}</ul>
{"".join(secoes)}
</body></html>"""
    saida.write_text(pagina, encoding="utf-8")
    print(f"folha: {saida}  ({algum} suspeitas de {total} capas)")
    for g, n in cont.most_common():
        print(f"  {g}: {n} ({n / max(total, 1):.1%})")


if __name__ == "__main__":
    main()
