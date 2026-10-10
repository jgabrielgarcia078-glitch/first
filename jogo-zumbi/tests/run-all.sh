#!/bin/sh
# Roda todos os testes: sintaxe/regras, geração de mundo, simulação de lógica e E2E no navegador.
cd "$(dirname "$0")/.."
set -e
sh tests/check.sh
node tests/unit-worldgen.js 12345 | tail -2
node tests/unit-sim.js | tail -1
node tests/e2e.js "${1:-/tmp/condado-e2e}" | tail -1
echo "TODOS OS TESTES OK"
