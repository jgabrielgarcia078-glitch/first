# Condado Perdido

Jogo de sobrevivência zumbi isométrico inspirado no Project Zomboid, feito do zero em HTML + JavaScript puro.
Toda a arte e todos os sons são gerados por código. Não há nenhum arquivo do Project Zomboid.

## Como abrir

Dê um duplo clique em **`index.html`**. Funciona direto no navegador (Chrome, Edge ou Firefox), sem instalar nada e sem servidor.
O jogo salva sozinho a cada minuto no próprio navegador (IndexedDB). Morreu, acabou: o save é apagado e você começa outro sobrevivente.

## Controles

| Tecla | Ação |
|---|---|
| W A S D / setas | Andar (relativo à tela) |
| Shift | Correr (gasta fôlego) |
| C | Agachar / andar furtivo |
| Clique esquerdo | Atacar com a arma da mão (sem arma: empurrar) |
| Segurar botão direito | Mirar (armas de fogo e arremessos); com ele segurado, o clique esquerdo dispara |
| Clique direito rápido | Menu de contexto (portas, janelas, móveis, chão, carros...) |
| Espaço | Empurrar zumbi / pisar em zumbi caído |
| E | Interagir com o que está à frente |
| R | Recarregar (no modo construção: girar) |
| F | Lanterna |
| Q | Gritar (atrai zumbis!) |
| Z | Sentar / levantar |
| I ou Tab | Inventário e saque |
| H | Saúde (curativos) |
| K | Personagem e habilidades |
| B | Artesanato e construção |
| M | Mapa |
| 1 a 5 | Atalhos (equipar item) |
| [ e ] | Velocidade do tempo (só sem zumbis por perto) |
| Roda do mouse / + − | Zoom |
| Esc | Fechar janela / pausa |
| F1 | Ajuda |
| No carro | G liga o motor · W/S acelera e freia · A/D vira · Espaço freia · E sai |

## O que tem no jogo

- **Mundo gerado por semente** (1536 × 1536 tiles): 5 a 7 cidades com casas, sobrados, lojas, delegacia e clínica, ligadas por rodovias; fazendas, postos de gasolina, florestas, lagos e a cerca da quarentena na borda. Os pedaços do mapa são carregados conforme você anda.
- **Histórias aleatórias**: casas de sobreviventes barricadas e com estoque, festas que viraram ninho de zumbis, acidentes de carro e bloqueios policiais.
- **Personagem**: 22 ocupações, cerca de 70 traços com sistema de pontos e combinações proibidas, aparência e nome.
- **26 habilidades** de nível 0 a 10, com XP por uso, bônus da ocupação, livros (volumes 1 a 5) e revistas de receitas.
- **Mais de 230 itens**: armas brancas, armas de fogo, munição, comida (estraga com o tempo), bebidas, remédios, roupas com proteção por parte do corpo, mochilas, ferramentas, materiais, sementes e livros.
- **Zumbis** que veem, ouvem e lembram onde você estava. Batem em portas e janelas até quebrar, pulam cercas e janelas quebradas, sobem escadas, andam em grupos, podem rastejar ou fingir de mortos, migram e reaparecem com o tempo.
- **Combate**: golpe na direção do mouse, crítico, desgaste das armas, empurrão, pisão, tiros com mira (barulho enorme), arremessos e molotov.
- **Corpo**: fome, sede, sono, fôlego, pânico, estresse, tédio, tristeza, temperatura, molhado, peso carregado, embriaguez e doenças. São 17 partes do corpo com arranhões, cortes, feridas profundas, mordidas, fraturas, queimaduras e vidro. Curativo, desinfetante, sutura, pinça, tala e remédios. **Infecção zumbi**: mordida ≈ 100%, corte 25%, arranhão 7%.
- **Tempo e mundo vivo**: 1 hora real = 1 dia, clima (chuva, tempestade, neblina, neve), estações, dia e noite com iluminação, corte de energia e de água, helicóptero, tiros e gritos distantes, alarmes, rádio e TV.
- **Sobrevivência longa**: barricadas, carpintaria (paredes, portas, cercas, pisos, caixotes, coletor de chuva, fogueira, bancada), desmontar móveis, cortar árvores, ferver água, cozinhar, agricultura, coleta, pesca e gerador.
- **Veículos**: carros com chave ou ligação direta, gasolina, dano, atropelamento, porta-malas e faróis.

## Testes

```
sh tests/run-all.sh
```

Esse comando roda a checagem de sintaxe e de regras, a geração do mundo em 3 sementes, simulações de lógica (combate, IA, portas, escadas, necessidades, infecção), 30 dias de jogo acelerados e um teste ponta a ponta no navegador (Playwright).
