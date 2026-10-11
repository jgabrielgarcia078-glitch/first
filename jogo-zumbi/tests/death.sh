#!/bin/sh
# Morte e "continuar no mesmo mundo" no navegador (zumbi com os pertences, novo sobrevivente, salvar/recarregar)
cd "$(dirname "$0")/.."
out=$(SEED=777 node tests/play.js tests/scenarios/death.js "${1:-/tmp/condado-death}" 2>&1)
echo "$out" | grep -v screenshot | tail -3
echo "$out" | grep -q "FALHAS nenhuma" && echo "$out" | grep -q "sem erros no console" || { echo "$out" | tail -20; echo "FALHOU morte/mesmo mundo"; exit 1; }
echo "morte OK"
