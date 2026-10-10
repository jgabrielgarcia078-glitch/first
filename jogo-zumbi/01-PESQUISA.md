# Pesquisa — Project Zomboid (referência para o nosso jogo)

> Objetivo: entender **como o Project Zomboid (PZ) funciona** para construirmos um jogo **nosso**, inspirado nele.
> Não vamos copiar nome, arte, mapa, textos nem código do PZ (são da The Indie Stone, protegidos por direito autoral) — copiamos **ideias de mecânica**, que não são protegidas, e fazemos tudo com arte e conteúdo próprios.
>
> **Sobre a precisão dos números:** a rede deste ambiente bloqueou o acesso direto à wiki oficial (pzwiki.net), então a pesquisa foi feita por buscadores + guias da comunidade + conhecimento prévio do jogo. Os **valores exatos** (custos de traço, chances, dias) mudam a cada build (B41 → B42) e os guias divergem entre si. Por isso tratamos os números abaixo como **referência de equilíbrio**, não como verdade absoluta — no nosso jogo eles viram constantes ajustáveis no topo do código.

---

## 1. Visão geral

| Item | Como é no PZ |
|---|---|
| Gênero | Sobrevivência em mundo aberto, sandbox, "morte permanente". Não tem final: a pergunta é **"como você morreu?"** ("This is how you died"). |
| Câmera | Isométrica 2.5D (vista de cima em diagonal), mundo feito de **tiles** (quadradinhos) empilhados em andares. |
| Motor | Próprio, em **Java + LWJGL (OpenGL)**; scripts e mods em **Lua**. |
| Personagens | Modelos **3D animados** desenhados por cima do mundo 2D de tiles (desde ~2017, Build 36+). Roupas são camadas 3D. |
| Cenário | Kentucky (EUA), julho de 1993, "Knox Event": um vírus (Knox Infection) transforma as pessoas em zumbis. O condado está em quarentena militar. |
| Tempo | Padrão: **1 hora real = 1 dia no jogo** (configurável). Começa em **9 de julho de 1993, 9h**. Ciclo dia/noite, clima e estações. |
| Versões | **Build 41** (estável por anos) e **Build 42** (estável desde meados de 2026): animais, artesanato muito mais profundo, porões, até 32 andares, mapa maior. |
| NPCs | No jogo base **não há sobreviventes NPC** (só zumbis). Multiplayer existe. |

### O "loop" central do jogo
1. Acordar num lugar aleatório da cidade escolhida.
2. **Saquear** (lootear) casas e lojas → comida, água, armas, ferramentas, livros.
3. **Evitar ou lutar** contra zumbis (barulho e visão atraem eles).
4. **Manter o corpo vivo**: fome, sede, sono, temperatura, ferimentos, saúde mental.
5. **Montar uma base**: barricadas, coleta de água da chuva, gerador, horta.
6. **Ficar mais forte**: subir habilidades (XP), ler livros.
7. O mundo **piora** com o tempo: luz e água acabam, zumbis migram, comida apodrece, chega o inverno.
8. Uma mordida ou descuido → morte → tela "assim você morreu" com quantos dias sobreviveu.

---

## 2. O mapa

### Estrutura técnica
- Mundo = grade de **tiles** (cada tile ≈ 1 m²).
- Tiles agrupados em **chunks** (pedaço carregado de uma vez: 10×10 tiles na B41; 8×8 na B42).
- Chunks agrupados em **células/cells** (300×300 tiles na B41; 256×256 na B42 — o arquivo de mapa é dividido por célula).
- **Andares (Z)**: B41 até 8 níveis; B42 até 32, incluindo **porões/bunkers** subterrâneos.
- Só a área perto do jogador é carregada e simulada em detalhe ("streaming"); o resto fica salvo em disco.
- Cada tile pode ter várias camadas: piso, paredes (norte/oeste), portas, janelas, móveis, objetos, vegetação.
- **Zonas** marcadas no mapa decidem o que aparece ali: tipo de loot por cômodo (cozinha, quarto, banheiro, garagem…), tipo de zumbi (policial, médico, militar), floresta/fazenda/água, estacionamentos.

### Knox County (agora "Knox Country" na B42)
Mapa **feito à mão**, baseado em cidades reais de Kentucky, ao longo da rodovia Dixie Highway (US 31W):

| Cidade | Característica |
|---|---|
| **Muldraugh** | Pequena, ao longo da rodovia; clássica para iniciantes. ~8 células. |
| **West Point** | Média, mais densa, lojas grandes; ao norte de Muldraugh. ~6 células. |
| **Riverside** | Afastada a noroeste, às margens do Rio Ohio; tranquila, boa para iniciantes. |
| **Rosewood** | Pequena, tem delegacia, quartel de bombeiros e prisão por perto. |
| **March Ridge** | Condomínio isolado ao sul. |
| **Louisville** | Cidade grande do outro lado da quarentena: prédios, shopping, estádio, multidões de zumbis. |
| B42 | +3 cidades novas e várias vilas menores, mais estradas rurais. |

Entre as cidades: florestas densas, fazendas, rios, lagos, postos de gasolina, base militar secreta, trailer park, armazéns.

**Tamanho**: dezenas de milhares de tiles em cada direção — atravessar o mapa a pé leva vários dias de jogo; é dimensionado para centenas de horas.
**Para nós**: um mapa desse tamanho, feito à mão, é inviável e desnecessário. A solução é **mundo dividido em chunks + geração procedural** (cidades, ruas, casas montadas por regras) + carregar só o que está perto. Assim o PC aguenta tranquilo — um navegador moderno desenha dezenas de milhares de tiles por segundo em Canvas 2D se só desenharmos o que está na tela.

---

## 3. Criação de personagem

### Fluxo
1. Escolher **cidade inicial** e **modo/dificuldade** (Apocalipse, Sobrevivente, Construtor, Infecção inicial, Sandbox personalizado).
2. Escolher **ocupação** (profissão).
3. Escolher **traços** positivos e negativos.
4. Visual: sexo, tom de pele, cabelo, barba, cor, roupa inicial.
5. Nome.

### Sistema de pontos
- Cada ocupação **dá ou custa pontos** (ex.: Desempregado dá **+8**, Veterano custa **−8**).
- **Traços positivos custam** pontos; **traços negativos dão** pontos.
- Regra: o saldo final precisa ser **≥ 0** para começar.
- Habilidades iniciais: a ocupação e alguns traços dão níveis iniciais (+1 a +3) e **multiplicadores de XP** naquela habilidade.

### Ocupações (valores aproximados de referência — B41; a B42 alterou vários)
| Ocupação | Pontos | Vantagens principais |
|---|---|---|
| Desempregado | +8 | Nenhuma habilidade; mais pontos para traços |
| Bombeiro | 0 | Machado, Corrida, Força, Condicionamento |
| Policial | −4 | Pontaria, Recarga, Agilidade |
| Guarda-parques | −4 | Coleta (forrageamento), Carpintaria, Machado |
| Operário de construção | −2 | Arma curta contundente, Carpintaria |
| Segurança | −2 | Corrida, Agilidade; noturno |
| Carpinteiro | +2 | Carpintaria, Arma curta contundente |
| Ladrão (Burglar) | −6 | Ligação direta em carros, Furtividade, Pés leves, Agilidade |
| Chef | −4 | Culinária, Faca; receitas |
| Reparador | −4 | Manutenção, Carpintaria, Arma curta contundente |
| Fazendeiro | +2 | Agricultura |
| Pescador | −2 | Pesca, Coleta |
| Médico | +2 | Primeiros socorros, Lâmina curta |
| Enfermeiro | +2 | Primeiros socorros, Furtividade |
| Veterano | −8 | Pontaria, Recarga; **Dessensibilizado** (não entra em pânico) |
| Lenhador | 0 | Machado; corta árvores mais rápido |
| Instrutor fitness | −6 | Condicionamento, Corrida |
| Atendente de fast food | +2 | Culinária |
| Eletricista | −4 | Elétrica |
| Engenheiro | −4 | Elétrica, Carpintaria; armadilhas/bombas |
| Metalúrgico | −6 | Solda (Metalworking) |
| Mecânico | −4 | Mecânica; conhecimento de veículos |
| (B42) | — | Ferreiro, Ranger, Caçador e outras; custos rebalanceados |

### Traços positivos (custam pontos — referência B41)
| Traço | Custo | Efeito |
|---|---|---|
| Atlético | 10 | +Condicionamento, corre mais e cansa menos |
| Forte | 10 | +Força: mais dano/empurrão, carrega mais |
| Pele grossa | 8 | Menos chance de arranhão virar ferida |
| Viciado em adrenalina | 8 | Fica mais rápido em pânico |
| Aprende rápido | 6 | +30% XP (exceto Força/Condicionamento) |
| Audição aguçada | 6 | Percebe mais longe ao redor |
| Cura rápida | 6 | Ferimentos curam mais rápido |
| Organizado | 6 | +30% capacidade dos recipientes |
| Pouca sede | 6 | Sede sobe mais devagar |
| Robusto (Stout) / Em forma (Fit) | 6 | Força / condicionamento extras |
| Valente | 4 | Menos pânico |
| Olhos de águia | 4 | Visão mais longa/ampla |
| Gracioso | 4 | Menos barulho ao andar |
| Discreto | 4 | Zumbis notam menos |
| Come pouco | 4 | Fome sobe mais devagar |
| Sortudo | 4 | Loot melhor (removido na B42) |
| Nutricionista | 4 | Vê valores nutricionais |
| Resistente | 4 | Menos doenças, infecção mais lenta |
| Corredor | 4 | +Corrida |
| Estômago de ferro | 3 | Menos intoxicação alimentar |
| Olhos de gato | 2 | Enxerga melhor no escuro |
| Destro | 2 | Mexe no inventário mais rápido |
| Leitor rápido | 2 | Lê livros mais rápido |
| Mateiro | 2 | Não sofre com frio/chuva tanto, não se perde |
| Acordado (Wakeful) | 2 | Precisa de menos sono |
| Demônio da velocidade | 1 | Dirige melhor |
| Hobbies (Pescador, Jardineiro, Primeiros socorros, Caçador, Ginasta, Costureiro, Cozinheiro, Mão na roda, Brigão, Herbalista, Mecânico amador, Jogador de beisebol…) | 4–8 | +1/+2 em habilidades específicas e receitas |

### Traços negativos (dão pontos — referência B41)
| Traço | Ganho | Efeito |
|---|---|---|
| Surdo | 12 | Quase não ouve ao redor |
| Obeso | 10 | Lento, cansa rápido, mais dano ao cair |
| Fraco | 10 | Força muito baixa |
| Fora de forma (Unfit) | 10 | Condicionamento muito baixo |
| Muito abaixo do peso | 10 | Fraco e frágil |
| Analfabeto | 8 | Não lê livros |
| Pele fina | 8 | Ferimentos mais fáceis |
| Sedentário (Out of Shape) / Débil (Feeble) | 6 | Pior condicionamento / força |
| Acima do peso / Abaixo do peso | 6 | Penalidades menores |
| Aprende devagar | 6 | −30% XP |
| Cura lenta | 6 | Ferimentos curam devagar |
| Muita sede | 6 | Sede sobe rápido |
| Sono agitado | 6 | Dorme mal |
| Asmático | 5 | Cansa mais rápido |
| Hemofóbico | 5 | Pânico com sangue, não trata ferimento bem |
| Agorafóbico / Claustrofóbico | 4 | Pânico fora / dentro de casa |
| Chamativo | 4 | Zumbis notam mais |
| Desorganizado | 4 | −capacidade dos recipientes |
| Meio surdo | 4 | Audição reduzida |
| Comilão | 4 | Fome sobe rápido |
| Pacifista | 4 | Aprende combate devagar |
| Propenso a doenças | 4 | Pega resfriado fácil |
| Dorminhoco | 4 | Precisa de mais sono |
| Fumante | 4 | Precisa de cigarro ou fica estressado |
| Azarado | 4 | Loot pior (removido na B42) |
| Estômago fraco | 3 | Intoxica fácil |
| Míope | 2 | Visão curta |
| Desastrado (Clumsy) | 2 | Faz mais barulho |
| Covarde | 2 | Mais pânico |
| Mãos de manteiga (All Thumbs) | 2 | Inventário mais lento |
| Leitor lento | 2 | Lê devagar |
| Motorista de domingo | 1 | Dirige mal/lento |

**Exclusões mútuas** (exemplos): Forte × Fraco/Débil; Atlético × Fora de forma/Sedentário/Obeso/Fumante (na B42); Aprende rápido × Aprende devagar; Olhos de águia × Míope; Surdo × Audição aguçada/Meio surdo; Valente × Covarde; Pele grossa × Pele fina; etc.

---

## 4. Habilidades (perks/skills)

- Todas vão de **nível 0 a 10**. XP ganha **fazendo** a ação (bater com machado sobe Machado).
- **Multiplicadores**: ocupação/traços dão bônus de XP; **livros de habilidade** (volumes 1–5, cada um cobre 2 níveis) multiplicam o XP (×3, ×5, ×8…) daquela faixa; **revistas** ensinam receitas; **TV/VHS** ("Life and Living") dão XP direto.
- Força e Condicionamento são **passivas**: sobem/caem com exercício, peso e alimentação; começam em 5.

| Categoria | Habilidades |
|---|---|
| Passivas | Condicionamento (Fitness), Força (Strength) |
| Agilidade | Corrida (Sprinting), Pés leves (Lightfooted — menos barulho), Agilidade (Nimble — mover ao mirar), Furtividade (Sneaking) |
| Combate | Machado, Contundente longa (taco), Contundente curta (martelo), Lâmina longa (katana/facão), Lâmina curta (faca), Lança, Manutenção (desgaste das armas) |
| Armas de fogo | Pontaria (Aiming), Recarga (Reloading) |
| Artesanato | Carpintaria, Culinária, Agricultura, Primeiros socorros, Elétrica, Solda/Metalurgia, Mecânica, Costura (Tailoring) |
| Sobrevivência | Pesca, Armadilhas (Trapping), Coleta (Foraging) |
| Novas na B42 (~35 no total) | Ferraria, Cerâmica, Alvenaria, Entalhe (Carving), Lascamento de pedra (Knapping), Vidraria, Criação de animais, Açougue, Rastreamento… |

---

## 5. Necessidades e "Moodles" (ícones de estado)

Moodles são ícones à direita da tela; cada um tem **4 níveis** de intensidade, e afetam o personagem.

| Moodle | Causa | Efeito |
|---|---|---|
| Fome | Tempo sem comer | Perde peso; em níveis altos, perde vida |
| Sede | Tempo sem beber (sobe mais rápido) | Perde vida em níveis altos |
| Cansaço (Tired) | Sono acumulado | Visão menor, combate pior, pode desmaiar |
| Exaustão física (Endurance) | Correr, lutar | Ataca/corre devagar; nível 4 = quase parado |
| Pânico | Ver zumbis, ser cercado | Mira pior, visão em túnel |
| Estresse | Pânico prolongado, fumante sem cigarro | Leva a Tristeza |
| Tédio | Fazer sempre o mesmo, ficar parado | Leva a Tristeza |
| Tristeza (Unhappy) | Tédio/estresse | Ações mais lentas; depressão |
| Ferido / Dor | Ferimentos | Ações mais lentas |
| Sangramento | Ferida aberta | Perde vida até enfaixar |
| Enjoado / Doente | Comida estragada, corpos, infecção | Vomita, perde vida; "Queasy" pode ser a Knox |
| Resfriado | Frio + molhado | Espirros/tosse fazem barulho |
| Calor / Frio (Hiper/Hipotermia) | Roupa vs. clima | Perde vida; frio extremo mata |
| Molhado | Chuva, nadar | Esfria o corpo |
| Carga pesada | Peso acima da capacidade | Lento, cansa |
| Bêbado | Álcool | Mira/ações piores, menos pânico |
| Empanturrado | Comer demais | Lento por um tempo |
| Desconfortável (B42) | Roupa inadequada | Leva a Tristeza |

**Outros valores ocultos**: peso corporal (afeta força/velocidade), calorias, proteínas/gorduras/carboidratos, temperatura corporal.

---

## 6. Saúde e ferimentos

- Corpo dividido em **partes** (cabeça, pescoço, tronco superior/inferior, braços, antebraços, mãos, coxas, canelas, pés — esquerda/direita).
- Cada parte pode ter: **arranhão**, **laceração**, **ferida profunda**, **mordida**, **fratura**, **queimadura**, **bala alojada/vidro/estilhaço**, **infecção comum**.
- Tratamento: desinfetar → (remover estilhaço/bala com pinça) → (costurar ferida profunda com agulha e linha) → **enfaixar** → trocar curativo sujo; **tala** para fratura; antibióticos para infecção comum; analgésicos para dor.
- **Infecção Knox (zumbificação)**: chance por tipo de ferida causada por zumbi — arranhão ≈ **7%**, laceração ≈ **25%**, mordida ≈ **100%**. Não tem cura no jogo base: morre em ~2–3 dias e vira zumbi.
- **Roupa** protege partes do corpo contra mordida/arranhão (jaquetas de couro, capacetes…), e rasga/estraga.

---

## 7. Zumbis (o "mob" do jogo)

No jogo base o **único inimigo é o zumbi** (B42 adiciona animais: cervos, coelhos, ratos, galinhas, vacas, ovelhas, porcos — a maioria não agressiva). Não há "tipos especiais" estilo Left 4 Dead; a variedade vem de **atributos** e de **roupas**.

| Atributo (configurável) | Opções |
|---|---|
| Velocidade | Arrastado (Shambler, padrão), Arrastado rápido, **Corredor (Sprinter)**, Aleatório |
| Força | Sobre-humana, Normal, Fraca |
| Resistência | Sobre-humana, Normal, Frágil |
| Transmissão | Sangue+saliva (padrão), Só saliva, Todos infectados, Nenhuma |
| Mortalidade | Instantânea … 2–3 dias (padrão) … nunca |
| Cognição | Navegar + abrir portas / Só navegar / Básica |
| Memória | Longa, Normal, Curta, Nenhuma |
| Visão / Audição | Águia, Normal, Fraca |
| População | Insana → Baixa; pico de população em X dias |
| Respawn / Migração | Reaparecem em áreas limpas após N horas; grupos migram |

### Comportamento
- Andam em **grupos/hordas**, vagueiam, ficam parados até detectarem algo.
- Detectam por **som** (tiros, gritos, alarmes, quebrar vidro, carro) e **visão** (influenciada por luz, furtividade, agachar).
- Perseguem o último ponto onde ouviram/viram; **batem em portas, janelas e barricadas** até quebrar.
- Variações: **rastejantes** (sem pernas, agarram o tornozelo), **"falso morto"** (parecem cadáveres e levantam), zumbis caídos que agarram quem passa perto.
- **Atacam** agarrando e mordendo; vários juntos = morte quase certa. Podem **derrubar** o jogador por trás.
- **Roupas e loot**: zumbis usam a roupa de quem eram (policial, médico, militar, soldado, bombeiro, noiva, palhaço…) e carregam itens relacionados.
- Visual: corpos em estados de decomposição, sangue que suja a roupa.

---

## 8. Combate

- **Corpo a corpo**: clique para atacar na direção do mouse. Cada arma tem dano, alcance, velocidade, chance de crítico, **durabilidade** (quebra), peso e quantos inimigos acerta por golpe.
- **Empurrão** (espaço/clique sem arma): derruba o zumbi; **pisão** (stomp) num zumbi caído mata sem gastar arma.
- Golpes gastam **resistência** (Endurance) e fazem barulho; dano maior com crítico e skill alto.
- **Armas de fogo**: mira com botão direito, cone de precisão, munição/carregadores, recarregar, **barulho enorme** (atrai horda).
- **Furtividade**: agachado é mais silencioso; atacar zumbi distraído por trás = execução.
- Também: chute em porta, jogar objetos/garrafas para distrair, **molotov**, armadilhas.

---

## 9. Movimentação e animações do personagem

| Ação | Controle típico |
|---|---|
| Andar | WASD |
| Correr (Run) / Disparar (Sprint) | Shift / Alt |
| Agachar e andar furtivo | C |
| Mirar | Botão direito |
| Atacar / empurrar | Clique esquerdo / Espaço |
| Interagir (portas, recipientes) | E / clique |
| Gritar | Q |
| Recarregar | R |
| Pular cerca/janela | Andar contra ela + ação |
| Inventário | Tab / I |

Animações do modelo: parado, andar, correr, disparar, agachado, mirando, golpear (por tipo de arma), empurrar, pisar, pular cerca, pular janela (cai e se corta no vidro), escalar corda de lençol, cair/tropeçar, sentar no chão, deitar/dormir, ler, comer/beber, mexer em coisas (ação genérica), ser agarrado, morrer, levantar como zumbi. Personagem olha para 8 direções no isométrico.

---

## 10. Ações ("timed actions")

Quase tudo no PZ é uma **ação com tempo e barra de progresso**, colocada numa **fila**: se um zumbi chega, interrompe. Exemplos:
- Saquear recipientes (armários, geladeiras, corpos), transferir itens, equipar, vestir/despir.
- Abrir/fechar/trancar portas e janelas, quebrar vidro, retirar cacos, **barricar** com tábuas/chapas.
- Comer, beber, ler, dormir, sentar, fumar, tomar remédio, se tratar.
- Construir (paredes, pisos, cercas, móveis, coletor de chuva), desmontar móveis, cortar árvores, cavar.
- Cozinhar, encher garrafas, purificar água, plantar/regar/colher, pescar, armadilhas, coletar (forrageamento).
- Mecânica: abrir capô, trocar peças, abastecer, fazer ligação direta.
- Elétrica: ligar gerador, consertar rádio.

---

## 11. Itens (milhares — por categoria)

| Categoria | Exemplos |
|---|---|
| Armas brancas | Machados, tacos, martelos, panelas, facas, facões, katanas, lanças, chaves de roda, pés de cabra |
| Armas de fogo | Pistolas, revólveres, espingardas (cano serrado), rifles, munição, carregadores, acessórios (mira, laser) |
| Roupas | Por parte do corpo com proteção contra mordida/arranhão, isolamento térmico, sujeira/sangue, rasgos |
| Recipientes | Mochilas, bolsas, sacolas — capacidade e redução de peso |
| Comida | Enlatados, frescos (estragam), ingredientes, refeições cozidas; calorias e nutrientes |
| Bebida | Água (limpa/contaminada), refrigerante, álcool |
| Médicos | Bandagens, desinfetante, analgésicos, antibióticos, agulha/linha, pinça, tala |
| Ferramentas | Martelo, serra, chave de fenda, alicate, pá, enxada, maçarico, abridor de lata |
| Literatura | Livros de habilidade (vol. 1–5), revistas de receita, livros de lazer (tiram tédio) |
| Eletrônicos | Rádio, walkie-talkie, lanterna, pilhas, gerador, TV |
| Materiais | Tábuas, pregos, chapas de metal, tijolos, cordas, lençóis |
| Agricultura | Sementes, regador, fertilizante |
| Veículos | Peças (pneus, bateria, motor, portas, tanque), gasolina |

Propriedades comuns: **peso**, condição/durabilidade, estragar (comida), consumíveis com usos, etc. O inventário é limitado por **peso** (não por slots).

---

## 12. Mundo vivo e eventos

| Evento | Descrição |
|---|---|
| **Helicóptero** | Uma vez por partida (padrão), entre o **dia 6 e 9**, de dia: um helicóptero passa e segue o jogador se ele estiver ao ar livre, arrastando hordas. |
| **Corte de energia** | Entre 0 e 30 dias (padrão): geladeiras param, luzes apagam, sem TV. |
| **Corte de água** | Também 0–30 dias: torneiras secam; precisa coletar chuva/rio e ferver. |
| **Eventos sonoros ("meta")** | Tiros distantes, gritos, cachorros latindo — movem zumbis pelo mapa. |
| **Alarmes** | Casas/lojas/carros com alarme disparam ao entrar → atraem zumbis. |
| **Histórias aleatórias** | "Casas de sobreviventes" (barricadas, bom loot, cheias de zumbis), cenas em carros (acidente, posto policial, troca de pneu), cômodos com histórias (assalto, festa, quarentena). |
| **Rádio/TV** | Transmissões nos primeiros dias contando a queda; Sistema de Emergência avisa clima e o helicóptero; programas de TV dão XP. |
| **Clima** | Chuva, tempestade, neblina, neve, nevasca, ondas de calor; vento; estações com temperatura e luz do dia diferentes. |
| **Decadência** | Plantas crescem nas ruas, comida estraga, zumbis se acumulam, corpos apodrecem e deixam doente. |
| **Incêndios** | Fogo se espalha (molotov, fogão esquecido). |

---

## 13. Construção, sobrevivência de longo prazo

- **Carpintaria**: paredes, pisos, escadas, portas, cercas, móveis, coletores de chuva, caixas.
- **Barricadas** em portas/janelas.
- **Agricultura**: canteiros, sementes, rega, pragas/doenças, estações (B42 reformulou).
- **Pesca, armadilhas, coleta, caça** (B42: animais, abate, açougue).
- **Culinária**: receitas (ensopados, saladas, assados), conservas.
- **Gerador** com combustível para manter energia.
- **Veículos**: dirigir, trancar, consertar, abastecer em postos (com energia ou mangueira).

---

## 14. Interface (UI)

- Moodles à direita; barra de equipamentos rápidos (hotbar); inventário em janela com "seu inventário" × "recipiente aberto"; painel de saúde (boneco com partes do corpo); painel de habilidades; mapa (encontrado em itens ou revelado ao explorar); menu de contexto por clique direito em tudo; relógio.
- Tela de morte: "Assim você morreu" + dias sobrevividos + zumbis mortos.

---

## 15. Arte e visual (para referência, não para copiar)

- Mundo: tiles isométricos desenhados à mão, paleta realista e um pouco desbotada, iluminação dinâmica (lanterna, luz de casas, noite escura, relâmpagos).
- Personagens: modelos 3D low-poly com texturas, roupas em camadas, sangue e sujeira acumulam.
- Visão: a área fora do campo de visão do personagem fica escurecida (cone de visão); paredes na frente do personagem ficam transparentes/recortadas.

**Para o nosso jogo** não é viável nem permitido usar esses assets. Vamos fazer arte própria (ver plano).

---

## Fontes consultadas

- [PZwiki — Knox County](https://pzwiki.net/wiki/Knox_County) · [PZwiki — Metagame](https://pzwiki.net/wiki/Metagame)
- [Project Zomboid Maps Index (pzfans)](https://pzfans.com/project-zomboid-maps/) · [Supercraft — mapa B42](https://www.supercraft.host/article/project-zomboid-map/)
- [Skills Guide B42 (pzfans)](https://pzfans.com/skills/) · [XGamingServer — Skills](https://xgamingserver.com/blog/project-zomboid-skills-leveling-guide/)
- [Fandom — Profession](https://projectzomboid.fandom.com/wiki/Profession) · [BisectHosting — Occupation List](https://help.bisecthosting.com/hc/en-us/articles/54194728914843-Project-Zomboid-Occupation-List) · [game-rack — Traits & Occupations](https://game-rack.com/en/articles/en-project-zomboid-best-beginner-builds-1065) · [Steam — B42 Tier List](https://steamcommunity.com/sharedfiles/filedetails/?id=3625646827)
- [GGRecon — Best Traits](https://www.ggrecon.com/guides/best-project-zomboid-traits/) · [Guides Factory — Traits B42](https://guides-factory.com/guides/project-zomboid-positive-traits-guide-build-42-tier-list)
- [BisectHosting — Moodles](https://www.bisecthosting.com/pt-br/blog/project-zomboid-moodles-status-effects-pictures-icons-faces-moods)
- [XGamingServer — Zombie Settings](https://xgamingserver.com/docs/project-zomboid/zombie-settings) · [Sandbox Guide](https://xgamingserver.com/blog/project-zomboid-sandbox-settings-guide/)
- [pzfans — First Aid](https://pzfans.com/first-aid/) · [GameSpot — Healing](https://Gamespot.com/articles/how-to-heal-injuries-in-project-zomboid/1100-6499688/)
- [projectzomboid.wiki — Combat basics](https://projectzomboid.wiki/guides/combat-basics/) · [pzfans — Shove tactics](https://pzfans.com/knock_tactics_breakdown_build_41_vs_42_zomboid_secrets/)
- [pzfans — Helicóptero B41 vs B42](https://pzfans.com/surviving_the_helicopter_event_in_project_zomboid_build_41_vs_build_42)
- [XGamingServer — Farming](https://xgamingserver.com/blog/project-zomboid-farming-guide/) · [Cooking & Food](https://xgamingserver.com/blog/project-zomboid-cooking-food-guide/)
- [GGRecon — Hotwire](https://www.ggrecon.com/guides/project-zomboid-hotwire-cars-how-to/)
- [Game Developer — Build 42 trailer](https://www.gamedeveloper.com/press-release/project-zomboid-build-42-out-now-watch-the-new-features-trailer) · [G-Portal — Build 42](https://www.g-portal.com/en/news/project-zomboid-build-42-update-en)
- [PCGamesN — map seeds / histórias aleatórias](https://www.pcgamesn.com/project-zomboid/map-seeds)
- [Le Bottin des Jeux Linux — motor Java/LWJGL](https://lebottinlinux.vps.a-lec.org/Bottin_P-Q_files/Project_Zomboid-12387.html)
