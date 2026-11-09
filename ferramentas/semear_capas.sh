#!/usr/bin/env bash
# Semeia o ramo `capas-estudio` com as capas LOCAIS (Mac) de site/public/estudio.
#
# Troca TODO o conteudo do ramo por um commit ORFAO novo (force push). O robo do GitHub
# (atualizar.yml) baixa esse ramo a cada rodada e so gera as capas das pecas novas.
#
# NAO roda sozinho. So o dono manda publicar. Padrao = ENSAIO (confere e mostra, nao envia):
#   ferramentas/semear_capas.sh              -> ensaio
#   ferramentas/semear_capas.sh --publicar   -> commit orfao + force push do ramo capas-estudio
#   ferramentas/semear_capas.sh --publicar --forcar-menor   -> aceita menos capas que o ramo atual
#
# Antes de --publicar: olhe a aba Actions e confirme que NENHUMA execucao do "Atualizar catalogo"
# esta rodando (senao o robo e o force push disputam o mesmo ramo). Melhor entre as rodadas de 30 min.
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
ORIGEM="$RAIZ/site/public/estudio"
PECAS="$RAIZ/site/src/data/pecas.json"
RAMO="capas-estudio"
PUBLICAR=0
FORCAR_MENOR=0
for a in "$@"; do
  case "$a" in
    --publicar) PUBLICAR=1 ;;
    --forcar-menor) FORCAR_MENOR=1 ;;
    *) echo "argumento desconhecido: $a"; exit 2 ;;
  esac
done

say() { printf '%s\n' "$*"; }
falha() { say "RECUSADO: $*"; exit 1; }

# ---- 1) conferencias da origem (Mac) ----
[ -d "$ORIGEM" ] || falha "pasta $ORIGEM nao existe"
N=$(find "$ORIGEM" -maxdepth 1 -name '*.webp' | wc -l | tr -d ' ')
[ "$N" -gt 0 ] || falha "nenhuma capa .webp em $ORIGEM"
[ -f "$PECAS" ] || falha "falta $PECAS (rode preparar_dados.py)"
IDS=$(python3 -c 'import json,sys;print(len(json.load(open(sys.argv[1]))))' "$PECAS")
say "capas locais: $N | pecas no catalogo: $IDS"

# arquivos vazios ou pequenos demais (capa valida tem ~20 KB+)
RUINS=$(find "$ORIGEM" -maxdepth 1 -name '*.webp' -size -3k | wc -l | tr -d ' ')
[ "$RUINS" -eq 0 ] || falha "$RUINS capas menores que 3 KB (corrompidas?) — rode capas_estudio.py de novo"
# assinatura RIFF/WEBP em todas (amostra de 300 para nao demorar)
ERRADAS=0
while IFS= read -r f; do
  [ "$(head -c 4 "$f")" = "RIFF" ] || ERRADAS=$((ERRADAS + 1))
done < <(find "$ORIGEM" -maxdepth 1 -name '*.webp' | head -300)
[ "$ERRADAS" -eq 0 ] || falha "$ERRADAS arquivos que nao sao WebP"
TAM_MB=$(du -sm "$ORIGEM" | cut -f1)
say "tamanho: ${TAM_MB} MB | amostra de WebP: ok"

# ---- 2) comparar com o ramo atual (so leitura) ----
URL=$(git -C "$RAIZ" remote get-url origin)
TMP=$(mktemp -d "${TMPDIR:-/tmp}/semear-capas.XXXXXX")
trap 'rm -rf "$TMP"' EXIT
ATUAL=0
if git -C "$RAIZ" ls-remote --exit-code --heads "$URL" "$RAMO" >/dev/null 2>&1; then
  git -C "$TMP" init -q
  git -C "$TMP" fetch -q --depth=1 "$URL" "$RAMO"
  ATUAL=$(git -C "$TMP" ls-tree -r --name-only FETCH_HEAD | grep -c '\.webp$' || true)
  say "ramo $RAMO atual: $ATUAL capas (commit $(git -C "$TMP" rev-parse --short FETCH_HEAD))"
else
  say "ramo $RAMO ainda nao existe no remoto"
fi
if [ "$ATUAL" -gt 0 ] && [ "$N" -lt $((ATUAL * 90 / 100)) ] && [ "$FORCAR_MENOR" -eq 0 ]; then
  falha "menos capas ($N) que o ramo atual ($ATUAL). Se for de proposito, use --forcar-menor"
fi

# ---- 3) monta o commit orfao numa pasta temporaria (nao mexe no indice do worktree) ----
rm -rf "$TMP/semear"
mkdir -p "$TMP/semear"
cd "$TMP/semear"
git init -q -b "$RAMO"
mkdir -p .
find "$ORIGEM" -maxdepth 1 -name '*.webp' -exec cp {} . \;
[ -f "$ORIGEM/_falhas.json" ] && cp "$ORIGEM/_falhas.json" .
git add -A
git -c user.name="izzat-bot" -c user.email="izzat-bot@users.noreply.github.com" \
  commit -q -m "Capas de estudio: semeadas do Mac ($N capas)"
HASH=$(git rev-parse --short HEAD)
say "commit orfao pronto: $HASH ($N arquivos, ${TAM_MB} MB)"

if [ "$PUBLICAR" -eq 0 ]; then
  say ""
  say "ENSAIO: nada enviado. Para publicar de verdade:"
  say "  ferramentas/semear_capas.sh --publicar"
  say "Depois: a proxima rodada do robo baixa o ramo e gera so as pecas novas."
  exit 0
fi

git remote add origin "$URL"
git push -q --force origin "$RAMO"
say "PUBLICADO: $RAMO = $HASH ($N capas)."
say "Conferir: a proxima rodada do robo deve dizer 'capas de estudio ja prontas: $N'."
