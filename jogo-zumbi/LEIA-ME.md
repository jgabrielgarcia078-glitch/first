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
| M | Mapa (clique anota com um símbolo e texto; botão direito apaga) |
| N | Mostrar / esconder o minimapa |
| Arrastar itens | Entre as janelas e abas do inventário, para "Equipado e vestido" (veste/empunha) ou para fora (larga no chão) |
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
- **Visual**: casas com telhado de duas águas, chão com textura (grama, asfalto rachado, calçada, piso de madeira), árvores sombreadas, sombra junto às paredes. Personagens com corpo masculino e feminino de verdade, roupas visíveis (mangas, saia, vestido, jaqueta, boné, mochila) e zumbis curvados, mancando, com pele manchada, boca ensanguentada e roupas rasgadas.
- **Som de onde ele vem**: gemidos de zumbi sintetizados como voz (rouco, com formantes), cada som vem da direção e da distância certas (esquerda/direita, mais baixo longe, abafado atrás de paredes). Passos mudam com o piso.
- **Clima de apocalipse**: cores apagadas e sujas, o que está fora da sua visão fica cinza e escuro, ruas com lixo, folhas, manchas de óleo, sangue seco, cacos e mato nas rachaduras, paredes manchadas e carros abandonados (alguns com vidro trincado e pneu furado). À noite, os postes e a lanterna fazem poças de luz quente.
- **Interface parecida com a do original**: ícones na barra da esquerda (com o que está nas mãos no topo), relógio digital no canto direito, moodles embaixo dele, e inventário em duas janelas (você / arredores) com colunas e abas de recipiente.
- **Trilha sonora original**, composta na hora pelo próprio jogo: piano e violão melancólicos quando está tudo calmo (com silêncio entre as músicas), coração batendo e cordas tensas quando há zumbi por perto, percussão quando eles estão atrás de você, e um susto quando um zumbi te vê. Volume da música separado no menu (Esc).
- **Eventos aleatórios ao longe**: tiros, rajadas, gritos, pedidos de socorro, cachorros, batida de carro, vidro quebrando, explosão, sirene e alarme de carro. Não há ninguém lá — mas o barulho é real e os zumbis vão até ele. Mais frequentes à noite.
- **Mundo que envelhece**: com os dias o mato toma conta das rachaduras e dos gramados, trepadeiras sobem nas paredes; no inverno a neve se acumula no chão, nos telhados e nos carros (e guarda pegadas). Vento balança árvores e mato, corvos pousam e fogem, moscas rondam os corpos.
- **Fachadas e quintais**: letreiros nas lojas, toldos, vitrines quebradas, placas de rua, outdoors, churrasqueiras, balanços, varais, casinhas de cachorro, canteiros e piscininhas.
- **Zumbis comendo corpos**, levantando devagar do chão, cambaleando depois de um empurrão; cercado por vários, você é derrubado e devorado. Roupa fica suja, rasgada e com sangue (dá para lavar e remendar).
- **Fogo que se espalha** pelo piso, móveis e paredes (pior com vento), casas que queimam até o telhado desabar, extintor e água para apagar; corpos podem ser queimados ou enterrados (corpos podres perto deixam você doente).
- **Grandes hordas** que atravessam a região de tempos em tempos (dá para ouvir chegando).
- **Mecânica de carro por peça**: motor, bateria, 4 pneus e para-brisa, com tirar, trocar e consertar.
- **Bilhetes e recados**: bilhetes para ler (diários, listas, despedidas), recados presos nas portas de quem foi embora, pichações nas paredes ("SAQUEADO", "NÃO ENTRE"...) e acampamentos abandonados no mato.
- **Interface**: arrastar e soltar itens, minimapa no canto, anotações no mapa e o nome das coisas quando o mouse passa por cima (portas, janelas, móveis, corpos, placas).
- **Leve**: só os zumbis perto de você são simulados; os de longe ficam "guardados" e acordam quando você se aproxima (ou se ouvirem um barulho grande).

## Testes

```
sh tests/run-all.sh
```

Esse comando roda a checagem de sintaxe e de regras, a geração do mundo em 3 sementes, simulações de lógica (combate, IA, portas, escadas, necessidades, infecção), 30 dias de jogo acelerados os testes das melhorias (`tests/unit-features.js`), a interface no navegador (`tests/iface.sh`: arrastar e soltar, mapa, minimapa, rótulos) e um teste ponta a ponta no navegador (Playwright).
