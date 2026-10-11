#!/bin/sh
# Interface no navegador: arrastar e soltar, anotações no mapa, minimapa e rótulos (falha se o roteiro registrar falhas ou erros)
cd "$(dirname "$0")/.."
out=$(SEED=777 node tests/play.js tests/scenarios/iface.js "${1:-/tmp/condado-iface}" 2>&1)
echo "$out" | grep -v screenshot
echo "$out" | grep -q "FALHAS nenhuma" && echo "$out" | grep -q "sem erros no console" || { echo "FALHOU interface"; exit 1; }
echo "iface OK"
