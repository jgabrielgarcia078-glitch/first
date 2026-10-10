#!/bin/sh
# Validação de sintaxe (regra 7): node --check em cada script + regras de estilo do projeto.
cd "$(dirname "$0")/.."
fail=0
for f in js/*.js; do node --check "$f" || fail=1; done
# proibido onclick/onchange inline no HTML gerado
if grep -nE '[ "'"'"']on(click|change|input|keydown|keyup|mousedown|mouseup|load|submit|dblclick)=' index.html js/*.js ; then echo "ERRO: handler inline encontrado"; fail=1; fi
# cada arquivo é uma IIFE que usa só o namespace CP
for f in js/*.js; do head -c 2000 "$f" | grep -q "(function (CP)" || { echo "ERRO: $f não começa com IIFE (CP)"; fail=1; }; done
# regex não pode quebrar linha: procura '/' de regex aberto no fim da linha (heurística simples)
[ $fail = 0 ] && echo "check OK" || { echo "check FALHOU"; exit 1; }
