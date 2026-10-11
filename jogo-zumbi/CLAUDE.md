# Condado Perdido — contexto para desenvolvimento

Jogo de sobrevivência zumbi isométrico inspirado no Project Zomboid. A pesquisa está em `01-PESQUISA.md`, o plano em `02-PLANO.md` e as instruções para o jogador em `LEIA-ME.md`.
**Nunca usar nome, arte, mapa, textos ou sons do Project Zomboid.** Só ideias de mecânica. Prints do original servem só de referência visual (cores, proporções, luz, layout da interface): tudo é redesenhado por código.

Referências de visual já aplicadas: dia claro e colorido (grama verde viva, asfalto cinza médio); noite azul-arroxeada (`C.NIGHT`, `lightColor`); fora da visão mais escuro; interiores não vistos pretos (`voidAt`); madeira em tábuas estreitas, tijolo com rejunte, papel de parede estampado; móveis com frente detalhada; janelas do inventário cinza com abas em cima; saúde com silhueta e tabela de proteção; personagens com proporção de pessoa (cabeça pequena, ~7 cabeças de altura; membros finos; sombreado suave) e **sem contorno nenhum** (o usuário pediu: contorno tira a imersão; nenhuma linha entre as partes, senão parece boneco montado) — com uniformes (`D.OUTFITS`, cor fixa com `id:#cor`); ruas com postes de fiação e fios (`drawWires`), bancos, lixeiras e corpos; cercas de tábua; chaminés; lojas de teto plano com vitrines (estilos de parede `store`).

## Formato

- `index.html` + `css/style.css` + `js/*.js` **clássicos** (sem módulos ES, sem npm, sem bundler). Abre com duplo clique (`file://`).
- Cada arquivo é uma IIFE `(function (CP) { ... })(window.CP = window.CP || {});`. O único global é `CP`.
- A ordem dos `<script>` no `index.html` importa: `config.js` (todas as constantes) vem primeiro. Os módulos só usam uns aos outros dentro de funções (em tempo de execução), nunca no carregamento.
- Ponto único de inicialização: `js/main.js` → `DOMContentLoaded`.
- Proibido `onclick`/`onchange` inline. A interface usa delegação com `data-a="ação"` em `ui.js`.
- Regex sempre numa linha só. Todos os números de equilíbrio ficam em `config.js` (`C.*`) ou em `data.js` (`D.*`).

## Módulos

| Arquivo | O quê |
|---|---|
| config.js | Constantes: projeção, mundo, tempo, ruído, zumbis, necessidades, moodles, combate |
| util.js | RNG com semente (mulberry32), hash, ruído fbm, heap, cores, eventos |
| data.js | Habilidades, ocupações, traços, partes do corpo, itens (~230), loot por cômodo, receitas, construções, roupas iniciais |
| world.js | Chunks 32×32×3 níveis, paredes nas bordas N/O de cada tile, portas e janelas (`edges`), colisão de círculo deslizante, linha de visão, escadas (z contínuo), `stepLevel` para pathfinding |
| worldgen.js | Mapa macro (cidades, rodovias, tipos de quarteirão) e geração determinística por chunk (casas por BSP com cômodos e portas, lojas, sobrados com escada, fazendas, postos, natureza, zumbis, histórias aleatórias) |
| sprites.js | Arte procedural com cache e variações de luz; telhados de duas águas (`S.roof`, código montado em `render.js`); personagens desenhados por vetor a cada quadro (`drawHuman`, aparência por `S.buildLook` a partir das roupas: corpo masculino/feminino, mangas, saia/vestido, zumbis curvados e rasgados). O volume vem só do sombreado (lado da sombra dos membros, gradiente do tronco e da cabeça). Não usar canvas por personagem nem `shadowBlur`: custa ~4× numa horda |
| fov.js | Campo de visão por raios (com cone) e mapa de luz (`V.sources` guarda as luzes para o brilho quente em `FX.drawGlows`) |
| render.js | Isométrico 2:1, ordem por diagonal com todos os níveis, recorte de paredes e telhado transparente perto do jogador. Código de luz por tile (`tileCode`): o que está fora da visão usa a versão sem cor (`S.litFog`) com borda suave; lixo/abandono por posição (`litterAt`); paredes com 3 níveis de sujeira |
| input.js | Teclado e mouse (clique direito curto = menu; segurar = mirar) |
| items.js | Instâncias de item, peso, envelhecimento de comida, inventário e loot |
| player.js | Criação pela ficha (pontos), habilidades e XP, movimento |
| path.js | A* com arrays tipados numa janela de 160×160×3 |
| zombies.js | Dados/entidades, ativação por chunk, percepção, IA (idle/wander/investigate/chase/attack/bash/climb), dano, cadáveres, migração/reaparecimento diários |
| combat.js | Golpes (com assistência de mira), empurrão, pisão, tiros, ataques de zumbi |
| body.js | Necessidades, moodles, temperatura, ferimentos, primeiros socorros, infecção, sono, morte |
| time.js | Relógio, clima, luz, energia/água, helicóptero, eventos distantes (`C.META_EVENTS`: só som + barulho que atrai zumbis, nunca há alguém lá), alarmes, rádio/TV |
| fx.js | Sangue persistente, efeitos, chuva/neblina/relâmpago, vinheta |
| notes.js | Nomes de rua (`N.streetName`, `N.address`, `N.keyId` das chaves de casa). Textos de bilhetes (`N.gen(rng, tipo, cidade)`), recados de porta (`st.note` no estado da porta) e pichações (`N.graffiti`). Item `note` guarda o texto em `it.text` |
| ambient.js | Mundo vivo: erosão (`C.EROSION`, mato/trepadeiras assados nos sprites de piso), neve acumulada e pegadas, vento (`sway`: sprites pré-inclinados `S.objLean`, nunca inclinar por quadro), corvos, moscas |
| fire.js | Fogo por tile em `ws.fires` (+ `ch.fires`): inflamabilidade, vento, paredes; carboniza pisos/paredes (estilo 15), derruba o telhado a 50%; extintor/água; queimar/enterrar corpos |
| horde.js | Grande horda como grupo virtual (`ws.horde`) que anda no tempo de jogo; vira zumbis reais só perto do jogador (`C.HORDE`) |
| survival.js | `CP.Surv`: armadilhas (`ch.traps`, objetos TRAP_BOX/TRAP_SNARE, `C.TRAPS`, checadas de hora em hora longe do jogador), modo de busca (tecla O, `C.SEARCH`, achados no chão com marca), exercícios (`p.body.strain` = dor muscular que entra em `Body.pain`), pratos montados (`it.dish` + `it.ingr`: ensopado/salada/sanduíche; `Use.eat` usa `it.dish` se existir) |
| actions.js | Ações com tempo (fila) e interações com o mundo (menu de contexto e tecla E) |
| use.js | Uso de itens, artesanato, construção (`CP.Build`) e agricultura (`CP.Farm`) |
| vehicles.js | Carros dirigíveis (os objetos CAR do mapa viram entidades ao ativar o chunk) |
| audio.js | Sons sintetizados (WebAudio): vozes de zumbi por formantes, tudo posicional (pan + distância + abafado por parede), reverb, limite de vozes |
| music.js | Trilha sonora **original** composta em tempo real (nunca usar a trilha do PZ): violão Karplus-Strong, piano, pad, cello; camadas calma/tensão/perseguição pela intensidade do perigo, peças com intro/A/B/final e silêncio entre elas, sustos (`spotted`, `event`, `death`). Mixagem: nada abaixo de `C.MUSIC.LOW_CUT` (alto-falante de celular estoura com subgrave), compressor + limitador próprios, e tudo sai pelo limitador final `CP.Audio.out`. Conferir com `tests/scenarios/mix.js` (pico, cortes, % abaixo de 80 Hz) |
| save.js | IndexedDB (stores `saves`, `chunks`, `settings`), versão de esquema e migrações |
| ui.js | Arrastar e soltar itens (`UI.dropTarget`/`UI.dropItem`), mapa com anotações (`p.mapNotes`), minimapa girado 45° (buffer de pixels a cada 0,5 s), rótulo do mouse (`UI.hoverText`, só tiles visíveis), bilhete aberto (`UI.showNote`). Menu (no estilo do original: título e opções à esquerda), criação de personagem, HUD (barra lateral de ícones com as mãos, relógio digital, moodles à direita, atalhos embaixo), painéis (inventário em duas janelas com colunas e abas de recipiente), menu de contexto, morte |
| game.js | Estado da partida, loop de passo fixo (30/s), ativação de chunks, câmera, desenho |

## Regras que não podem quebrar

- Estado novo de chunk que precisa ir para o save entra em `Save.serializeChunk` (hoje: `wallBlood`, `traps`, além dos antigos). Estado de porta/janela fica no objeto da borda (`ch.edges`): `note`, `hasCurt`/`curtain`, `rope`, `spareChecked`.
- `ws().wet` é o mapa de tiles molhados do fogo; a umidade do chão (poças) é `ws().groundWet`.
- Morrer não apaga o mundo: `Save.saveDead` guarda tudo com `player: null`; o menu oferece "Continuar o mundo" e `Game.newSurvivor` cria o próximo sobrevivente (o anterior vira corpo, ou zumbi com `data.carry`/`data.look`, com os pertences).

- O mundo é determinístico por semente: `Gen.genChunk(cx, cy, seed, macro)` não pode depender da ordem de geração. Use o RNG do chunk (`ctx.rng`).
- Toda mudança num chunk que precisa ser salva deve deixar `chunk.saveDirty = true` (chunks ativos já são salvos sempre).
- Zumbis ativos ficam em `CP.Game.zombies`. Os inativos ficam como dados em `chunk.zombies`. Converter só com `Zombies.fromData`/`toData`.
- Funções (`draw`) nunca vão para o IndexedDB: `Save.serializeChunk` copia os campos explicitamente.
- O tempo de jogo (`state.time`, em segundos) anda 24× o real (`settings.dayMinutes`). Durante o sono, o relógio anda `SLEEP_SPEED` vezes mais rápido, mas a física continua em passos normais.
- Ações com tempo passam por `CP.Actions.start`. Andar cancela a ação.

## Desempenho

- Sprites guardam só a área pintada (`trim` em `store`) e variações de luz sem uso por ~30 s são descartadas (`S.sweep`): sem isso a memória de vídeo estoura e o quadro dobra de tempo com vento/tempestade.
- Medir desempenho sempre com `SEED=777`, zumbis removidos e o jogo pausado (os zumbis convergem no jogador e distorcem a medida).
- Nada de filtros de tela cheia por quadro (`saturation`, `soft-light`, `overlay` custam ~10 ms sem placa de vídeo). A gradação de cor (`C.GRADE`) é aplicada uma vez em cada sprite (`store` → `gradeCanvas`) e nas cores dos personagens (`S.gradeHex`); vinheta e grão são camadas CSS (`#vignette`, `#grain`).

- Zumbis só viram entidades (simuladas) a até `C.ZOMBIE.ACTIVE_IN` tiles do jogador e voltam a ser dados além de `ACTIVE_OUT` (exceto quem está perseguindo). Testes que movem zumbis devem manter o jogador dentro desse raio.
- O A* tem orçamento de nós por quadro (`Z.nodeBudget`). O HUD só troca o HTML quando muda (`setHtml`).

## Validação antes de entregar

`sh tests/run-all.sh` (precisa passar tudo):

- `tests/check.sh`: `node --check` em todos os JS, sem handler inline, IIFE em todos os arquivos.
- `tests/unit-worldgen.js [seed]`: todos os tiles internos de todos os prédios são alcançáveis pela porta, e as escadas são consistentes.
- `tests/unit-sim.js`: integridade dos dados, combate, IA (ver, ouvir, perseguir, arrombar porta, subir escada), necessidades, sono, curativo, infecção, loot, serialização.
- `tests/unit-days.js`: 30 dias acelerados (energia, água, helicóptero, clima, plantação, migração).
- `tests/unit-features.js`: melhorias "mais perto do original" (neve, erosão, vento, corvos, comer corpos, derrubar, sujeira, fogo, corpos, hordas, carro por peça, bilhetes, recados, fogueira apagada, cortinas, interruptor, luz que chama zumbis, poças, sangue na parede, decomposição, modelos de carro, buzina/sirene/rádio, roupa molhada, vapor, matar por trás, arrastar corpo, corda de lençol, armadilhas, busca, exercícios, pratos, chaves de casa).
- `tests/death.sh`: morrer infectado (zumbi com os pertences), novo sobrevivente no mesmo mundo, morrer de novo, recarregar e continuar pelo menu.
- `tests/iface.sh`: no navegador, arrastar e soltar itens, anotações no mapa, minimapa e rótulos (falha se o roteiro `tests/scenarios/iface.js` registrar falha).
- `tests/e2e.js`: Chromium via `file://` (menu → criação → jogo → painéis → salvar → recarregar → continuar).
- Cenários visuais: `node tests/play.js tests/scenarios/<nome>.js <pasta>` tira screenshots (combate, noite, escada, interações, dirigir, desempenho, `chars` = folha de personagens, `ui` = painéis, `hitches` = tempos por quadro, `uniforms` = uniformes em humanos e zumbis, `audio` = níveis de som, `music` = camadas da trilha e eventos distantes com lado L/R, `mix` = pico/cortes/subgrave na saída final, `world` = erosão/neve/fachadas, `anims` = poses de zumbi e do jogador, `fire` = incêndio/casa queimada/horda/mecânica, `iface` = interface nova, `notes` = recados/pichações/acampamento, `lights` = janelas acesas e interruptor, `decay` = poças/outono/sangue na parede/decomposição, `cars` = modelos de veículo/giroflex/molhado/vapor, `stealth` = matar por trás/arrastar corpo/corda de lençol, `survival` = armadilhas/busca/exercícios, `death` = morte e mesmo mundo).
