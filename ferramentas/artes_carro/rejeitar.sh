#!/bin/zsh
# rejeitar.sh <chave> "<motivo>" "<correção para o prompt>"  -> guarda a miniatura da 1ª, apaga o PNG e gera a 2ª (única) tentativa
R=/Users/izzat/Projects/izzatcar-wt/_r16carros
PY=/private/tmp/claude-501/-Users-izzat/96380c2f-65b2-4c40-9354-343e44e39751/scratchpad/venv-rembg/bin/python
k=$1
[[ -e $R/rejeitados/carro-${k}_rejeitado_1.jpg ]] && { echo "$k ja teve 2a tentativa"; exit 1; }
$PY -c "
from PIL import Image
im=Image.open('$R/gerados/carro-$k.png').convert('RGB'); im.thumbnail((768,512)); im.save('$R/rejeitados/carro-${k}_rejeitado_1.jpg',quality=80)" && rm $R/gerados/carro-$k.png
echo "$k|$2" >> $R/qa/_rejeitadas.txt
$R/scripts/gerar.sh $k 2 "$3" && [[ -e $R/gerados/carro-${k}__t2.png ]] && mv $R/gerados/carro-${k}__t2.png $R/gerados/carro-$k.png
