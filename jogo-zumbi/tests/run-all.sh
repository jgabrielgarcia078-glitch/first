#!/bin/sh
# Roda todos os testes: sintaxe/regras, geração de mundo, simulação de lógica e E2E no navegador.
cd "$(dirname "$0")/.."
set -e
# roda um teste mostrando só o fim da saída, mas falhando se o teste falhar
run() { out=$("$@" 2>&1) || { echo "$out" | tail -15; echo "FALHOU: $*"; exit 1; }; echo "$out" | tail -2; }
run sh tests/check.sh
run node tests/unit-worldgen.js 12345
run node tests/unit-sim.js
run node tests/unit-days.js
run node tests/e2e.js "${1:-/tmp/condado-e2e}"
echo "TODOS OS TESTES OK"
