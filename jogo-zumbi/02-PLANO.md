# Plano de construção — nosso jogo de sobrevivência zumbi

> Baseado na pesquisa em `01-PESQUISA.md`. Nome provisório: **"Condado Perdido"** (trocar quando você escolher).
> Nada de código ainda: este documento é para você aprovar/ajustar antes de começarmos.

---

## 1. Princípios

1. **Inspirado, não copiado.** Mecânicas parecidas com o Project Zomboid; nome, mapa, arte, textos e sons 100% nossos.
2. **Roda no navegador do seu PC**, sem instalar nada: abre com duplo clique (`file://`), igual ao GoalQuest. HTML + CSS + JavaScript puro, sem framework, sem npm.
3. **Jogável desde cedo.** Cada fase termina com algo que dá para abrir e jogar. Nada de 3 meses sem ver resultado.
4. **Tudo que é número vira constante no topo** (velocidade do zumbi, chance de infecção, custo de traço…) → fácil de equilibrar depois.
5. **Dados separados da lógica**: itens, receitas, ocupações, traços e tipos de cômodo em tabelas — adicionar conteúdo novo é editar uma tabela, não reescrever código.
6. **Mesmas regras de código do GoalQuest** (constantes no topo, nada de `onclick` inline, uma função = um lugar, um único ponto de inicialização, regex em uma linha, tudo dentro de uma IIFE, `node --check` antes de entregar).

---

## 2. Como resolver o "PC aguenta?"

O mapa do PZ é gigante, mas o computador nunca processa ele todo de uma vez — e nós faremos igual:

| Problema | Solução |
|---|---|
| Mapa enorme | Mundo dividido em **chunks** de 16×16 tiles. Só ficam na memória os chunks perto do jogador (~ 9×9 chunks). O resto fica salvo. |
| Fazer o mapa à mão é inviável | **Geração procedural com semente (seed)**: ruas, quarteirões, casas, cômodos, móveis e loot gerados por regras. Mesma seed = mesmo mapa. O mundo pode ser praticamente infinito. |
| Salvar o mundo inteiro | Salvamos só **o que o jogador mudou** (diferenças) por chunk, no IndexedDB. O resto é regerado pela seed. |
| Desenhar milhares de tiles | Só desenha o que está na tela; piso e paredes de cada chunk são **pré-desenhados numa imagem em cache** e só redesenhados quando algo muda. |
| Centenas de zumbis | Zumbis perto: simulação completa (IA, caminho, animação). Zumbis longe: simulação "barata" em grupos (hordas virtuais que só andam pelo mapa). **Grade espacial** para achar vizinhos rápido. |
| Caminhos (pathfinding) | A* em grade com limite de passos, e "mapa de fluxo" compartilhado quando muitos zumbis perseguem o mesmo alvo. |
| Meta de desempenho | 60 FPS com ~300 zumbis ativos na tela/arredores em um PC comum; simulação em passo fixo (20 ticks/s) separada do desenho. |

---

## 3. Arquitetura técnica (resumo)

- **Desenho**: Canvas 2D, **isométrico 2:1** (tile 64×32 px), com zoom. Andares empilhados (térreo, 1º andar, porão). Paredes na frente do personagem ficam recortadas/transparentes.
- **Arte**: gerada **por código** na inicialização (pixel art procedural desenhada em canvases escondidos e guardada como sprites). Vantagem: nenhum arquivo externo, sem direito autoral, fácil variar cores (roupas, pele, sangue). Personagens em **8 direções**, montados em camadas ("boneco de papel": corpo → roupa de baixo → roupa de cima → cabelo → mochila → arma), com quadros de animação.
- **Visão**: campo de visão por *shadowcasting* na grade + cone de visão; fora da visão fica escuro e os zumbis não aparecem. Iluminação por tile (dia/noite, lanterna, postes, casas com energia).
- **Som do jogo**: cada barulho vira um "evento de ruído" com raio (passos, porta, vidro, tiro, grito) que os zumbis escutam. Efeitos sonoros sintetizados via WebAudio (sem arquivos).
- **Ações com tempo**: sistema de fila de ações com barra de progresso, interrompível (núcleo de quase tudo).
- **Dados**: tabelas de itens, receitas, ocupações, traços, cômodos/loot, tipos de zumbi, eventos.
- **Salvamento**: IndexedDB com versão de esquema + migrações (igual ao GoalQuest). Autosave periódico + ao sair. Uma vida = um save (morte permanente), com opção de sandbox.
- **Organização dos arquivos** (sugestão — ver pergunta 3 no fim): uma pasta com `index.html` + vários `.js` "clássicos" (não módulos — continuam abrindo com duplo clique), cada um por sistema (`render.js`, `world.js`, `zombies.js`, `items.js`…). Um único HTML ficaria com 20–30 mil linhas no fim, difícil de manter.

---

## 4. Passo a passo (fases)

Cada fase tem: **o que entra**, e **"pronto quando"** (critério de aceite que você mesmo pode testar).

### Fase 0 — Decisões e esqueleto (curta)
- Você responde as perguntas do fim deste documento.
- Criar a pasta, o `index.html`, o loop do jogo (passo fixo + desenho), o sistema de entrada (teclado/mouse) e as regras de validação (`node --check` + teste automático com Playwright).
- **Pronto quando:** abre com duplo clique e mostra uma tela com FPS e um quadrado se mexendo com WASD.

### Fase 1 — Motor isométrico e personagem andando
- Câmera isométrica com zoom, grade de tiles, piso/paredes/portas/janelas.
- Personagem com sprite procedural em 8 direções, animação de andar/correr/agachar.
- Colisão com paredes e móveis; abrir/fechar portas; pular janela e cerca.
- Um mapa de teste fixo: uma rua com 3 casas.
- **Pronto quando:** você anda pela rua, entra nas casas, sobe uma escada para o 2º andar, e as paredes da frente somem quando você está dentro.

### Fase 2 — Mundo procedural e visão
- Gerador de cidade por seed: malha de ruas, quarteirões, lotes, casas (cômodos: sala, cozinha, quarto, banheiro, garagem), lojas, posto, mato/floresta entre cidades.
- Chunks carregando/descarregando conforme você anda; salvar só as diferenças.
- Campo de visão + cone, escuridão fora da visão, iluminação básica.
- Minimapa e mapa grande que vai se revelando ao explorar.
- **Pronto quando:** você anda 10 minutos em linha reta sem travar e sem acabar o mundo, e a mesma seed gera a mesma cidade.

### Fase 3 — Zumbis e combate corpo a corpo  ⭐ *(primeira versão "jogável de verdade")*
- Zumbis com sprites próprios (pele, roupas variadas, sangue), estados: parado → vagando → alerta → perseguindo → atacando → batendo na porta.
- Audição (eventos de ruído) e visão (luz, agachado, distância), memória do último ponto.
- Pathfinding, grupos, rastejantes, "falso morto".
- Combate: empurrão, pisão, ataque com arma na direção do mouse, crítico, resistência (cansaço), durabilidade.
- Ser agarrado/mordido → dano → **tela "assim você morreu"** com dias sobrevividos e zumbis mortos.
- Configurações de zumbi (velocidade, força, população…) como constantes.
- **Pronto quando:** dá para morrer de verdade, e fugir/lutar contra uma horda tem tensão.

### Fase 4 — Criação de personagem e habilidades
- Tela de criação: ocupações, traços positivos/negativos com sistema de pontos (saldo ≥ 0), exclusões mútuas, visual (sexo, pele, cabelo, barba, roupa), nome, cidade/ponto inicial, dificuldade.
- ~20 habilidades nível 0–10 com XP, multiplicadores de ocupação/traços, Força e Condicionamento passivos.
- Livros de habilidade (volumes) e revistas de receita.
- **Pronto quando:** um Lenhador Forte mata zumbis visivelmente melhor que um Desempregado Fraco, e as habilidades sobem com o uso.

### Fase 5 — Itens, inventário e loot
- ~150 itens iniciais (armas, ferramentas, comida, bebida, remédios, roupas, mochilas, livros, materiais), por **peso**.
- Janela de inventário (você × recipiente), arrastar e soltar, equipar nas mãos, vestir por parte do corpo, mochilas que reduzem peso.
- Loot gerado por tipo de cômodo/recipiente (geladeira, armário, guarda-roupa…), e em zumbis conforme a roupa deles.
- Fila de ações com tempo (saquear, transferir, vestir) e menu de clique direito.
- **Pronto quando:** você entra numa casa, revista a cozinha e o quarto, pega uma mochila e um machado e sai mais forte.

### Fase 6 — Corpo: necessidades, moodles e saúde
- Fome, sede, sono, resistência, pânico, estresse, tédio, tristeza, temperatura corporal, peso, calorias.
- Moodles com 4 níveis, efeitos reais (visão menor cansado, mira pior em pânico…).
- Saúde por parte do corpo: arranhão, laceração, ferida profunda, mordida, fratura, sangramento, infecção comum.
- Primeiros socorros (desinfetar, enfaixar, costurar, tala), remédios, **infecção zumbi** com chances por tipo de ferida.
- Proteção das roupas por parte do corpo; roupas rasgam e sujam.
- Dormir (com risco), comer, beber, ler.
- **Pronto quando:** ficar dias sem comer, ou ser arranhado e não tratar, tem consequências claras e visíveis no painel de saúde.

### Fase 7 — Tempo e mundo vivo
- Relógio e calendário (1 h real = 1 dia, configurável), dia/noite com iluminação, clima (chuva, tempestade, neblina, neve, calor), estações.
- Corte de energia e de água entre os dias X e Y; geladeira desliga e comida estraga mais rápido.
- Eventos: helicóptero (dia 6–9), tiros e gritos distantes, alarmes de casa/carro, migração e reaparecimento de zumbis.
- Rádio e TV com transmissões próprias (notícias da queda, alerta de clima, programas que dão XP).
- "Histórias" aleatórias: casa de sobrevivente barricada, acidente de carro, bloqueio policial, cômodos com cenas.
- **Pronto quando:** cada partida tem uma "linha do tempo" — os primeiros dias são diferentes da segunda semana.

### Fase 8 — Base e sobrevivência de longo prazo
- Barricadas (tábuas, chapas), carpintaria (paredes, pisos, portas, cercas, móveis, escada, caixas), desmontar móveis para materiais.
- Água: coletor de chuva, ferver, garrafas. Fogo: fogueira, fogão.
- Culinária com receitas; estragar de comida; conservas.
- Agricultura (plantar, regar, colher, estações), coleta na floresta, pesca, armadilhas.
- Gerador com combustível.
- **Pronto quando:** dá para sobreviver um inverno numa base própria sem depender de saque.

### Fase 9 — Armas de fogo e furtividade avançada
- Pistolas, espingardas, rifles; munição, carregadores, recarga, mira com cone de precisão, barulho enorme.
- Furtividade completa (agachado, pés leves, execução por trás), distrações (jogar garrafa, fogos), molotov, fogo que se espalha.
- **Pronto quando:** atirar resolve um problema e cria outro maior (a horda que vem com o barulho).

### Fase 10 — Veículos *(a mais arriscada — pode virar opcional)*
- Carros parados no mapa, chaves ou ligação direta, dirigir com física simples, combustível, dano, peças, porta-malas, atropelar (e o carro sofrer).
- **Pronto quando:** dá para fugir de carro para outra cidade e o carro quebrar no caminho.

### Fase 11 — Modos, salvamento e acabamento
- Modos/dificuldade (equivalentes a Apocalipse, Sobrevivente, Construtor, Infecção inicial) + **Sandbox** com todas as constantes editáveis.
- Salvar/carregar robusto, vários saves, exportar/importar.
- Configurações (teclas, volume, zoom, interface), atalhos, tutorial curto, estatísticas da partida.
- Áudio ambiente (vento, chuva, zumbis distantes), música opcional.
- **Pronto quando:** você joga uma partida longa sem perder progresso e consegue ajustar a dificuldade do jeito que gosta.

### Fase 12 — Expansão de conteúdo (contínua)
- Mais tipos de construção (prédios, escola, hospital, delegacia, base militar), mais biomas, mais itens e receitas, animais (B42), porões.
- Ideias nossas, que o PZ não tem (só se você quiser): sobreviventes NPC, missões opcionais, diário do personagem, conquistas.

---

## 5. O que fica de fora (por decisão, não por esquecimento)

- **Multiplayer** (exige servidor; o jogo é 100% local).
- **Mods em Lua** e editor de mapa.
- **Gráficos 3D de verdade** (usamos 2D isométrico com sprites em camadas — fica bonito e roda leve).
- Mapa real de Kentucky / qualquer conteúdo copiado do PZ.

---

## 6. Riscos e como lidamos

| Risco | Mitigação |
|---|---|
| Desempenho com muitos zumbis | Simulação em níveis de detalhe, grade espacial, cache de desenho por chunk; medimos FPS desde a Fase 0. |
| Arte procedural ficar "feia" | Começar simples e consistente (paleta limitada, contorno escuro); a arte é isolada num módulo — dá para trocar por sprites desenhados depois sem mexer no resto. |
| Escopo enorme | Fases fechadas e jogáveis; Fase 10 (veículos) é opcional; conteúdo cresce por tabelas. |
| Bugs que travam tudo (como na 1ª tentativa do GoalQuest) | Regras de código do GoalQuest + `node --check` + teste automático no navegador (Playwright) a cada entrega. |
| Perder o save | IndexedDB com versão + migração, autosave, exportação manual. |

---

## 7. Perguntas para você antes de começar

1. **Nome do jogo** — tem algum em mente? (provisório: "Condado Perdido")
2. **Visual**: isométrico (como o PZ — mais bonito, mais trabalho) **[recomendo]** ou visto de cima reto (top-down — mais simples e rápido)?
3. **Arquivos**: pasta com `index.html` + vários `.js` (abre com duplo clique igual) **[recomendo, pelo tamanho]** ou um único `.html` como o GoalQuest?
4. **Mapa**: cidade gerada por seed (mundo diferente a cada partida, praticamente infinito) **[recomendo]**, ou uma cidade fixa desenhada por nós (sempre igual, mais "decorável", mas pequena)? Dá para misturar: gerador + alguns lugares fixos especiais.
5. **Ambientação**: Kentucky/EUA anos 90 (como o PZ) ou algo nosso — por exemplo, **interior do Brasil** (cidade pequena, fazendas, rodovia, posto, mercadinho)?
6. **Ordem**: concorda em ir até a Fase 3 primeiro (andar + zumbis + combate + morte) para já ter algo jogável, e só depois personagem/itens/necessidades?
