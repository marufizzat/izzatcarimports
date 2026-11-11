#!/bin/zsh
R=/Users/izzat/Projects/izzatcar-wt/_r16carros
cd $R
scripts/rejeitar.sh volvo-v40 "barra diagonal com a placa do símbolo no centro da grade (a marca da Volvo, só sem o desenho)" "a tentativa anterior saiu com uma barra diagonal e uma plaquinha quadrada no centro da grade. Agora a grade tem SÓ lâminas horizontais pretas dentro da moldura cromada: nenhuma barra diagonal, nenhuma placa, nenhum círculo no centro." &
scripts/gerar.sh nissan-sentra 1 &
scripts/gerar.sh peugeot-308 2 "a tentativa anterior saiu com a grade cheia de frisos cromados (uns sete). A grade certa é a da foto real: pequena, trapezoidal de cantos arredondados, com moldura cromada fina e só três lâminas horizontais pretas, flutuando no meio do para-choque; faróis, capô e LEDs diurnos nas pontas do para-choque como na foto real." &
wait
scripts/gerar.sh volkswagen-bora 2 "a tentativa anterior saiu com repetidores âmbar nas laterais do para-choque (detalhe da versão norte-americana). Agora o para-choque é liso, na cor do carro, SEM repetidor âmbar e sem refletor lateral; os piscas ficam só dentro dos faróis, como na foto real." &
scripts/gerar.sh citroen-c3-aircross 2 "esta é uma segunda versão para comparar: seguir com rigor a frente das DUAS fotos reais (imagens 3 e 4; a imagem 4 é outra foto real do mesmo carro, de lado): as duas barras cromadas finas no alto ligando os faróis, o desenho dos faróis, a grade e o para-choque com protetor exatamente como nas fotos; molduras pretas nas caixas de roda e barras de teto como nas fotos." &
wait
echo FIM
