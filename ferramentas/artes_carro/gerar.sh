#!/bin/zsh
# gerar.sh <chave> <tentativa 1|2> ["correção"]  -> um job do Codex, UMA imagem, em gerados/carro-<k>[__t2].png
set -u
R=/Users/izzat/Projects/izzatcar-wt/_r16carros
PY=/private/tmp/claude-501/-Users-izzat/96380c2f-65b2-4c40-9354-343e44e39751/scratchpad/venv-rembg/bin/python
k=$1; t=${2:-1}; extra=${3:-}
suf=""; [[ $t != 1 ]] && suf="__t$t"
out=$R/gerados/carro-$k$suf.png
[[ -e $out ]] && { echo "ja existe: $out"; exit 0; }
$PY - "$k" "$extra" "$out" > $R/briefs/$k$suf.txt <<'P'
import sys, json
sys.path.insert(0, '/Users/izzat/Projects/izzatcar-wt/_r16carros/scripts')
import carros
k, extra, out = sys.argv[1:4]
p, refs = carros.prompt(k, extra)
json.dump({'key': k, 'prompt': p, 'referencias': refs}, open(out.replace('/gerados/', '/briefs/').replace('.png', '.json'), 'w'), ensure_ascii=False, indent=1)
print(f"""Image-generation job: ONE car studio art for a website. Use the built-in image generation tool (image_gen).

Do exactly this, nothing else:
1. Make ONE new image generation request (not an edit of any image), landscape 3:2, size 1536x1024, attaching these reference images in this order:
""" + '\n'.join(f'   Image {i+1}: {r}' for i, r in enumerate(refs)) + f"""
   with this prompt, verbatim (it is in Portuguese on purpose):

{p}

2. Copy the generated PNG, unmodified, to: {out}
3. Print its pixel size.

Hard rules: generate exactly ONE image in this job. Do NOT retry, do NOT make variations, do NOT edit or post-process the result, even if you think it could be better (a human reviews it). Do not write, move or delete any other file anywhere. Do not use the web. If the generation fails or is refused, say why in one line and stop without retrying. Final answer: the output path and its pixel size, one line.""")
P
/Users/izzat/.local/bin/codex exec --skip-git-repo-check -s workspace-write -C $R -c model_reasoning_effort=low - < $R/briefs/$k$suf.txt > $R/logs/$k$suf.log 2>&1
echo "$k t$t: $(tail -2 $R/logs/$k$suf.log | tr '\n' ' ' | cut -c1-300) | $(ls -la $out 2>/dev/null | awk '{print $5}')"
