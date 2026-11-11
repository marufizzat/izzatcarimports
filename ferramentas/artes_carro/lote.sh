#!/bin/zsh
# lote.sh <chave>...  -> confere o disco (>= 5 GB livres) e gera 1 imagem por carro, 3 jobs por vez
livre=$(df -g ~ | tail -1 | awk '{print $4}')
echo "disco livre: ${livre} GB"
(( livre < 8 )) && { echo "PARADO: menos de 8 GB livres"; exit 3; }
printf '%s\n' "$@" | xargs -P 3 -I{} /Users/izzat/Projects/izzatcar-wt/_r16carros/scripts/gerar.sh {} 1
echo "lote terminado; livre: $(df -g ~ | tail -1 | awk '{print $4}') GB"
