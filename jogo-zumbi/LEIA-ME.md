# Condado Perdido

Jogo de sobrevivência zumbi isométrico inspirado no Project Zomboid, feito do zero em HTML + JavaScript puro.
Toda a arte e todos os sons são gerados por código. Não há nenhum arquivo do Project Zomboid.

## Como abrir

Dê um duplo clique em **`index.html`**. Funciona direto no navegador (Chrome, Edge ou Firefox), sem instalar nada e sem servidor.
O jogo salva sozinho a cada minuto no próprio navegador (IndexedDB). Morreu, acabou para aquele sobrevivente — mas o mundo continua e você pode começar outro nele.

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
| O | Modo de busca: anda devagar procurando coisas no chão (frutas, cogumelos, minhocas, gravetos, pedras, ervas) |
| J | Diário do sobrevivente |
| Clique esquerdo agachado, com faca, atrás de um zumbi distraído | Matar em silêncio |
| Arrastar itens | Entre as janelas e abas do inventário, para "Equipado e vestido" (veste/empunha) ou para fora (larga no chão) |
| 1 a 5 | Atalhos (equipar item) |
| [ e ] | Velocidade do tempo (só sem zumbis por perto) |
| Roda do mouse / + − | Zoom |
| Esc | Fechar janela / pausa (volume, gráficos, escala da interface e **troca de teclas**) |
| F1 | Ajuda |
| No carro | G liga o motor · W/S acelera e freia · A/D vira · Espaço freia · Q buzina · R rádio · L sirene (viatura e ambulância) · E sai |

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
- **Casas vivas à noite**: com energia, os cômodos têm luz (interruptor no menu de contexto) e as janelas acesas aparecem da rua. Cortinas abrem e fecham (ou pendure um lençol). Luz acesa à noite — lanterna ou cômodo iluminado sem cortina — chama os zumbis que estão olhando.
- **Clima e tempo deixam marcas**: poças que enchem com a chuva e secam devagar, folhas secas no chão no outono, sangue que respinga nas paredes, rastejantes deixando rastro, e corpos que incham, escurecem e viram esqueleto com as semanas. Roupa molhada fica mais escura e no frio a respiração vira vapor.
- **Veículos variados**: sedã, picape (com caçamba), van, viatura (com giroflex e sirene) e ambulância, cada um com o seu porta-malas. Buzina, rádio e sirene fazem barulho e chamam zumbis.
- **Furtividade e fuga**: agachado e com faca, mate zumbis distraídos por trás sem barulho; pendure uma corda de lençol na janela do andar de cima para descer (e subir de volta); arraste corpos para tirá-los do caminho.
- **Vida no mato**: armadilhas de caixa e de laço (com isca) pegam coelhos, esquilos, pássaros e ratos; modo de busca; exercícios para Força e Condicionamento (com dor muscular no dia seguinte); ensopado, salada e sanduíche montados com o que você tiver.
- **Chaves de casa**: moradores que viraram zumbi às vezes têm a chave no bolso, e às vezes há uma reserva debaixo do vaso. Com a chave, dá para destrancar e trancar a porta da frente por fora.
- **Morrer não é o fim do mundo**: o corpo fica onde caiu (ou se levanta como zumbi, com tudo o que você levava) e você pode começar um novo sobrevivente no mesmo mundo, com o tempo continuando de onde parou.
- **Interface**: arrastar e soltar itens, minimapa no canto, mapa com zoom (roda) e arrastar, nomes das ruas, anotações no mapa e o nome das coisas quando o mouse passa por cima (portas, janelas, móveis, corpos, placas, pichações, armadilhas).
- **Golpes de verdade**: machado e taco por cima da cabeça, lança e faca em estocada; arma longa e mochila aparecem nas costas. Sentar, ler, comer e dormir coberto têm pose própria.
- **Corpo que muda**: o cabelo cresce e a barba aparece com os dias (corte e faça a barba no espelho do banheiro com tesoura ou lâmina), engordar e emagrecer muda a silhueta, curativos aparecem no corpo, ferimentos graves deixam cicatriz e perna machucada faz mancar.
- **Clima forte**: nevasca que fecha a visão, raio que põe fogo em árvore, galhos caídos depois da tempestade; velas, tochas e lampiões para iluminar (a tocha apaga na chuva).
- **Lugares especiais**: escola e prefeitura em toda cidade, hospital e shopping nas maiores, e uma base militar escondida no mato (com fardas, rações e armas).
- **Animais vivos**: coelhos, veados e pássaros no mato. Fogem de você e de barulho; chegue agachado por trás ou use arma de fogo. O bicho abatido vira carne.
- **Mover móveis**: pegue um móvel vazio (precisa de força para os pesados), carregue e coloque onde quiser — encostado numa porta fechada, ele a trava e os zumbis demoram muito mais para entrar.
- **Escada de mão e telhado**: apoie a escada numa parede e suba no telhado, onde os zumbis não chegam.
- **Resfriado**: frio e roupa molhada podem dar resfriado; espirros e tosse fazem barulho (lenço de papel abafa), descanse aquecido ou tome remédio para gripe.
- **Cozinha completa**: botijão de gás no fogão quando a energia acaba, micro-ondas (nunca coloque lata de metal!), comida que pode queimar, comida quente que anima e latas abertas que dá para esquentar.
- **Metalurgia**: com maçarico e máscara de solda, construa paredes e portões de metal e blinde um carro com chapas.
- **Rádio**: estações que vão saindo do ar com os dias, o sistema de emergência que se despede, walkie-talkie e rádio amador para falar com outros sobreviventes (às vezes alguém responde e conta onde há coisas boas, que vão para o mapa). Rádio alto chama zumbis.
- **Carros**: porta-luvas e banco do passageiro para guardar coisas, e picapes com reboque para engatar (mais carga, carro mais lento).
- **Sono de verdade**: insônia quando está estressado ou com dor, pesadelos, barulho perto acorda e o despertador toca na hora marcada.
- **Zumbis mais espertos**: alguns giram a maçaneta de porta destrancada, eles seguem na direção em que você fugiu e ouvem motor de carro de longe.
- **Diário do sobrevivente** (J): dias vivo, zumbis mortos por tipo de arma, lugares visitados, linha do tempo e todos os sobreviventes que já passaram pelo mundo.
- **Desafios e opções do mundo**: inverno eterno, cidade lotada, seis meses depois, sem energia; resistência, força, visão, audição e memória dos zumbis; quando acabam a energia e a água.
- **Leve**: só os zumbis perto de você são simulados; os de longe ficam "guardados" e acordam quando você se aproxima (ou se ouvirem um barulho grande).

## Testes

```
sh tests/run-all.sh
```

Esse comando roda a checagem de sintaxe e de regras, a geração do mundo em 3 sementes, simulações de lógica (combate, IA, portas, escadas, necessidades, infecção), 30 dias de jogo acelerados, os testes das melhorias (`tests/unit-features.js`), os desafios, o diário e a troca de teclas (`tests/unit-modes.js`), a interface no navegador (`tests/iface.sh`: arrastar e soltar, mapa, minimapa, rótulos), a morte e o mesmo mundo (`tests/death.sh`) e um teste ponta a ponta no navegador (Playwright).
