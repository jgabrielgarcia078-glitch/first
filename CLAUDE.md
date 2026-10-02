# GoalQuest — Contexto do Projeto

Este arquivo é carregado automaticamente pelo Claude Code no início de toda sessão nesta pasta. Leia por completo antes de escrever qualquer código.

## Visão geral

GoalQuest é um app pessoal de gestão de metas gamificado. Uso exclusivo em desktop/PC (responsividade é bônus, não requisito — nunca sacrificar a experiência desktop por causa de mobile). Organiza:

- Metas de estudo (cursos de finanças, formação em Economia, certificações)
- Metas de carreira/negócios (consultoria de investimentos → gestora de recursos → escola de investimentos → grupo financeiro no longo prazo)
- Metas de saúde/fitness (peso e composição corporal)
- Metas pessoais diversas

O usuário é estudante de Economia, atua na área financeira/contábil de uma empresa familiar do agronegócio, e usa o app para dar estrutura à jornada profissional acima. Isso é contexto, não requisito funcional — não construir nada específico de agronegócio no app.

## Estrutura de dados

**Projetos** contêm **Metas**. Sistema gamificado: completar metas e registrar progresso gera XP, sobe nível, mantém streak de dias ativos, desbloqueia conquistas, permite resgatar recompensas customizadas com o XP acumulado (ganho menos gasto).

Cada Meta pode ter: tipo de acompanhamento (simples, numérica, percentual, frequência, duração, escala), dificuldade (fácil/média/difícil/épica — cada uma com XP diferente), prioridade, datas de início/prazo, próxima ação sugerida, dependências (uma meta só libera após outra ser concluída), tags, submetas (checklist), recorrência.

## Requisitos funcionais completos (visão de produto — não é tudo pra agora, ver "Fase atual" abaixo)

- **Dashboard**: estatísticas gerais, próximos prazos, metas atrasadas, atividade recente, resumo do jogador (nível/XP/streak), projetos recentes
- **Projetos**: nome, ícone, descrição, categoria, prioridade, cor, prazo, motivação, capa. Três visões: Lista, Kanban (colunas A fazer/Em andamento/Pausado/Concluído, drag-and-drop) e Quadro Visual
- **Quadro Visual (Canvas)** — prioridade alta do usuário, mas tecnicamente a parte mais arriscada: metas como blocos arrastáveis livremente, redimensionáveis, cor/formato customizáveis; conexões/setas manuais entre blocos; grupos visuais (retângulos com título); zoom in/out; tela cheia; bloqueio e ocultação individual de blocos
- **Checkpoints e evidências**: registro periódico (data, valor, comentário, fotos). Galeria de evidências com lightbox
- **Conquistas**: ícone, nome, descrição, métrica de progresso, objetivo numérico, recompensa em XP, raridade (comum/rara/épica/lendária). Padrão + customizadas pelo usuário
- **Recompensas**: nome, descrição, custo em XP, resgate
- **Calendário**: visão mensal — prazos de projetos/metas, checkpoints agendados, eventos customizados
- **Estatísticas**: progresso médio, atividade por dia, distribuição por status/dificuldade, ranking de projetos, resumo dos últimos 30 dias
- **Backup**: exportar JSON (completo ou só dados), importar (com confirmação), apagar tudo (com confirmação irreversível)
- **Configurações visuais** (prioridade alta): cores de tudo (fundo, superfícies, texto, bordas, destaque, secundária, status, progresso, seleção, conexões do canvas, avatar), tema claro/escuro, escala de fonte, arredondamento, espaçamento, glow/sombra, nome/subtítulo/avatar
- **Extras**: atalhos de teclado, busca global, notificações internas, histórico de atividades, undo/redo, toasts, modais reutilizáveis

## Decisões técnicas obrigatórias

### Formato do arquivo
Um único arquivo HTML autocontido (HTML + CSS + JS vanilla, sem framework, sem bundler, sem dependência de npm). Deve abrir com duplo clique em qualquer navegador moderno, sem servidor. Motivo: uso 100% local, e cada iteração precisa ser um único arquivo fácil de substituir.

### Armazenamento: IndexedDB, nunca localStorage
`localStorage` tem teto de ~5-10MB e só guarda string. O app vai guardar fotos (checkpoints, capas, galeria) em base64 — uma foto de celular comprimida já ocupa 1-3MB. Implementar um wrapper Promise-based próprio para IndexedDB (sem lib externa). Redimensionar/comprimir imagens no client antes de salvar (ex.: máx. 1600px no maior lado, JPEG qualidade ~0.8).

### Modelo de dados versionado
`CURRENT_SCHEMA_VERSION` + objeto de funções de migração aplicadas sequencialmente ao carregar um estado salvo em versão antiga. Nunca quebrar compatibilidade com dados salvos anteriormente sem oferecer migração.

## Regras obrigatórias de estrutura do código (não são sugestões — existem pra eliminar os bugs da tentativa anterior por construção)

1. Todas as constantes de configuração/dados estáticos (cores padrão, nomes de meses, colunas do Kanban etc.) devem ser declaradas no topo do arquivo, antes de qualquer função que as use.
2. **Proibido `onclick`, `onchange` etc. inline no HTML.** Todo evento é registrado via `addEventListener`, depois que o DOM já existe.
3. Proibido declarar a mesma função mais de uma vez em pontos diferentes do arquivo.
4. Deve existir exatamente um ponto de inicialização, chamado uma única vez, no final do arquivo, dentro de `DOMContentLoaded`.
5. Toda expressão regular deve estar em uma única linha, sem quebras.
6. Envolver todo o JS numa única IIFE (`(function(){ ... })()`) para não vazar variáveis globais — evitar `<script type="module">` porque módulos ES quebram com CORS ao abrir via `file://` em alguns navegadores.
7. Antes de considerar uma versão pronta para entrega: extrair o conteúdo do `<script>` para um arquivo `.js` temporário e rodar `node --check arquivo.js` para validar sintaxe e ordem de declaração antes mesmo de abrir no navegador.

## Erros da tentativa anterior — não repetir

Na primeira tentativa (com outra IA), o código foi colado em 18 blocos sequenciais, o que causou:

- Uma regex quebrada em múltiplas linhas dentro de `normalizeHexColor` (erro de sintaxe que travava o arquivo inteiro)
- Erros "Cannot access X before initialization" — `APPEARANCE_DEFAULTS`, `CALENDAR_MONTH_NAMES`, `KANBAN_COLUMNS` eram `const` declaradas tarde no arquivo, mas usadas antes (inclusive dentro de `onclick` inline, que dispara assim que o botão existe) — clássico *temporal dead zone*
- Funções como `applyGoalQuestAppearance` redefinidas em blocos diferentes, com a versão "que vale" no fim nem sempre sendo a que uma chamada solta no meio do arquivo esperava

As 7 regras acima existem especificamente para tornar essa classe de bug impossível por construção.

## Status

### Fase 1 — Fundação ✅ entregue (v0.1.0)

Modelo de dados versionado + migração, IndexedDB, undo/redo, toasts, modais, shell com navegação e tema claro/escuro, dashboard com estatísticas reais, CRUD de Projetos (visão Lista) e CRUD de Metas com os 6 tipos de acompanhamento (sem dependências/recorrência).

### Fase 1.5 — Melhorias de prioridade alta ✅ entregue (v0.2.0, schema v2)

Vindas da análise comparativa com Habitica, Duolingo, Way of Life, Notion/ClickUp, Linear/Superhuman (pedido explícito do usuário — antecipa partes das Fases 4, 5 e 6):

- **Vitalidade (HP)** estilo Habitica: dano por meta/projeto atrasado e por dia sem atividade; cura ao registrar progresso e concluir. Em 0 HP o jogador fica **exausto** (XP ×0,5 até voltar a 25 HP). **Modo descanso** desliga o dano (férias/doença).
- **Streak com proteções (freeze)**: máx. 2; ganha 1 a cada 7 dias seguidos ou compra com XP disponível; usadas automaticamente só quando cobrem todos os dias parados. **Reparo** de streak perdido (até 3 dias depois) usando proteções + XP.
- **Multiplicador de XP por streak**: 3+ dias ×1,1 · 7+ ×1,25 · 14+ ×1,5 · 30+ ×2.
- **Paleta de comandos Ctrl/Cmd+K** (busca global de projetos, metas e ações, sem acento) + Ctrl+Z / Ctrl+Y (Ctrl+Shift+Z) fora de campos de texto.
- **Heatmap de atividade diária** (53 semanas, estilo GitHub) no Dashboard, com dias protegidos marcados.
- **Áreas da vida**: rollup por categoria de projeto no Dashboard (clique filtra a lista de projetos).

Todos os números do jogo são constantes no topo do arquivo (`HP_*`, `FREEZE_*`, `STREAK_*`, `DIFFICULTIES`); a tela Configurações mostra as regras vigentes.

### Fase 1.6 — Melhorias de prioridade média e baixa ✅ entregue (v0.3.0, schema v3)

- **Modelos de meta** no formulário de nova meta (leitura, certificação, curso, horas de estudo, idioma, peso, treinos, reserva financeira, clientes, hábito, tarefa única). Os sugeridos para a categoria do projeto vêm primeiro; trocar de modelo não apaga o que o usuário digitou.
- **Reflexão ao concluir**: humor (1–5) + "o que funcionou" + "o que faria diferente", salva em `goal.reflection`, exibida no cartão e exportada no CSV. Pode ser desligada (Configurações ou "não perguntar mais").
- **Modo foco (Pomodoro)** vinculado a uma meta: pílula no topo com contagem, pausar/retomar, concluir antes (credita o tempo feito), descartar, pausa de 5 min, som via WebAudio. +1 XP a cada 5 min e +1 HP; em metas de duração o tempo entra no progresso. A sessão sobrevive a recarregar a página.
- **Placar semanal/mensal** (período atual até hoje vs. o mesmo trecho do período anterior) + **melhor dia da semana** (média de XP das últimas 12 semanas).
- **Exportação**: CSV de metas, histórico de progresso e atividade diária (";" + vírgula decimal + BOM, abre no Excel pt-BR) e backup JSON (só dados ou completo com imagens). Importação continua na Fase 6.
- **Atalhos**: G→D/P/M/C, N (nova meta), Shift+N (novo projeto), F (foco), / (busca), ? (lista de atalhos).
- **Temas extras**: Floresta, Sépia e Retrô (C64). **Moldura do avatar** evolui com o nível (Bronze 3, Prata 5, Ouro 8, Esmeralda 12, Diamante 16, Lendária 20) — só visual, sem títulos temáticos.
- Pendente desta lista: **grupos do Canvas com cor e progresso agregado** — depende do Quadro Visual (Fase 3).

### Fase 2 — Kanban + Checkpoints ✅ entregue (v0.4.0, schema v4)

- **Kanban** (colunas = `KANBAN_COLUMNS`, mesmos ids de `STATUSES`) no projeto e na página Metas, alternável com Lista (tecla V; preferência salva em `settings.projectView/goalsView`). Arrastar entre colunas muda o status pelas regras normais (XP, bloqueio); arrastar dentro da coluna reordena (`goal.kanbanOrder`). Aba "Quadro visual" já aparece desabilitada (Fase 3).
- **Detalhe da meta** (janela com `liveBody`, re-renderizada a cada commit): checklist, checkpoints com fotos, dependências (depende de / libera), recorrência com histórico, números.
- **Checklist (submetas)**: `goal.subtasks`; +1 XP por submeta (estornado ao desmarcar); em meta simples o progresso é a fração feita e concluir tudo conclui a meta. Editável também por texto no formulário (uma por linha; linhas iguais mantêm o estado).
- **Checkpoints com fotos**: registro de progresso com até 6 fotos (comprimidas, store `media`), também em metas simples (comentário/foto sem valor). Lembrete `goal.checkpointEvery` (diário/semanal/mensal) com card no Dashboard. Galeria por meta e por projeto + visualizador (← →, Esc, baixar). Excluir registro recalcula o valor.
- **Dependências**: `goal.dependsOn`; meta bloqueada não pode ir para "Em andamento"/"Concluído", nem registrar progresso, foco ou marcar submeta (`userError` → aviso e rollback). Seletor sem ciclos (`dependentsClosure`). Ao concluir, avisa as metas liberadas. Bloqueadas não sofrem dano de atraso. Reabrir uma dependência re-bloqueia a dependente sem mudar o status dela.
- **Recorrência** (`goal.recurrence`, dia/semana/mês): renova a cada período no `processDailyTick` (status "a fazer", progresso zerado, submetas desmarcadas, XP ganho fica), com sequência e recorde por meta. Período não cumprido: −dano da dificuldade uma vez (não conta se pausada, bloqueada, projeto pausado ou modo descanso). O prazo de uma recorrente é o fim do período.
- Modelos novos: Revisão semanal (recorrente + checklist), Treinos semanais (3×/semana recorrente), Hábito diário; Peso já vem com checkpoint semanal; Certificação traz checklist.

### Fase 3 — Quadro Visual (Canvas) ✅ entregue (v0.5.0, schema v5)

Terceira visão do projeto (Lista · Kanban · 🧩 Quadro visual; V alterna). Dados em `project.board`:
`blocks` (por id de meta: x, y, w, h, cor, formato, locked, hidden), `connections` (from → to, rótulo, cor), `groups` (retângulos com título, cor, locked), `viewport` (câmera x, y, zoom), `showDeps`, `snap`.

- **Blocos**: arrastar livremente (alinha à grade de 20px, desligável), redimensionar pela alça, cor (automática = cor do status) e formato (arredondado, retângulo, pílula, nota), fixar posição (📌) e ocultar (painel "Ocultos" para mostrar de novo). Duplo clique abre o detalhe da meta. Metas novas entram no centro da visão; na 1ª abertura, layout em colunas por status.
- **Seleção**: clique, Shift + clique, Shift + arrastar no fundo (área). Inspetor à direita conforme a seleção.
- **Conexões/setas manuais**: arrastar a alça roxa do bloco até outro, ou modo "🔗 Conectar" (origem → destino). Rótulo, cor, inverter, excluir (Delete).
- **Grupos**: "▭ Grupo" ou "Agrupar" a seleção; arrastar pelo cabeçalho leva as metas de dentro (participação geométrica: centro do bloco dentro do retângulo); título, cor, fixar; **progresso agregado** das metas de dentro no cabeçalho.
- **Dependências** das metas aparecem como setas tracejadas (liga/desliga "⛓ Dependências").
- **Zoom/pan**: roda = zoom no ponto do mouse, Shift + roda = rolar para os lados, arrastar o fundo = mover, botões −/100%/+/⤢ Ajustar, teclas + − Shift+1 Shift+0. **Tela cheia** (⛶): cobre a janela e usa a Fullscreen API quando disponível; Esc sai.
- Teclado: setas movem a seleção 20px; Delete oculta bloco / exclui grupo ou conexão; Esc limpa seleção / sai da tela cheia.

### Regras do motor de jogo (não quebrar)

- Toda mutação passa por `commit()`; XP positivo usa `gainXp()` (aplica multiplicador) e estornos usam `awardXp()` com o valor bruto salvo em `xpAwarded`. Cura de conclusão fica em `hpAwarded` e é estornada ao reabrir.
- `markActiveDay()` deve rodar **antes** de `gainXp()` para o multiplicador já contar o dia de hoje.
- `processDailyTick()` avalia dias completos de `player.lastTickDate` até ontem (máx. 30), roda na abertura (antes do 1º render, fora do undo), a cada 60 s e ao voltar para a aba. Usa o status **atual** de metas/projetos.
- `player.daily[iso] = { xp, actions }` alimenta o heatmap (o log de atividades é truncado em 300 itens, não usar para histórico longo).
- Salvamento sem debounce de tempo: `scheduleSave()` agenda `persistNow()` numa microtask (várias alterações na mesma rodada viram uma gravação). Fechar/recarregar logo após uma ação não pode perder dados — não reintroduzir `setTimeout` aqui.
- `state.focus` (sessão de foco em andamento) fica **fora** do undo/redo: `performUndo/Redo` preservam o valor atual, senão desfazer um crédito ressuscitaria um timer vencido.
- Conclusões de meta entram em `pendingReflections` dentro do `commit`; o prompt de reflexão abre depois do render (`maybePromptReflection`).
- Formulários de criação zeram título/nome do rascunho (a normalização troca vazio por "Meta sem título").
- Regras de negócio violadas dentro de um `commit` lançam `userError(msg)`: o commit desfaz tudo e mostra só a mensagem (aviso), sem "Erro ao aplicar".
- Janelas com `liveBody` são re-renderizadas em `renderApp()`; retornar `null` fecha a janela (ex.: meta excluída). Ações `data-action` funcionam dentro de janelas.
- Fotos de checkpoints ficam em `log[].photos` (ids do store `media`); `garbageCollectMedia()` considera capas e fotos de registros.
- Quadro visual: durante um gesto (arrastar, redimensionar, pan) só o DOM muda; o estado é gravado **uma vez** ao soltar (1 passo de desfazer). Eventos de ponteiro/roda são registrados uma única vez no documento (`bindBoardEvents`). A câmera (`board.viewport`) e a sessão de foco ficam **fora** do desfazer (`keepAcrossHistory`). Mover vários blocos ou um grupo alinha só o elemento arrastado e aplica o mesmo deslocamento aos demais. Duplo clique usa `e.timeStamp` e é zerado após um arrasto.
- `normalizeState` remove do quadro blocos/conexões de metas que não pertencem mais ao projeto; excluir uma meta limpa o bloco e as conexões dela.

### Validação antes de entregar

Além do `node --check` (regra 7): teste E2E com Playwright abrindo o `.html` via `file://`, usando `page.clock.setFixedTime` para simular a passagem dos dias. Atenção: `page.goto` que só muda o `#hash` não recarrega a página — use `page.reload()`.

## Roadmap completo (fases futuras, nesta ordem)

2. **Kanban + Checkpoints** — drag-and-drop, fotos/evidências, dependências entre metas, submetas, recorrência
3. **Quadro Visual (Canvas)** — a parte tecnicamente mais delicada: blocos arrastáveis/redimensionáveis, conexões/setas, grupos visuais, zoom, tela cheia, bloqueio/ocultação
4. **Gamificação completa** — conquistas padrão + customizadas, recompensas, refino de XP/streak
5. **Calendário + Estatísticas avançadas**
6. **Configurações visuais completas + Backup + Atalhos + Busca + Notificações + Histórico**

## Melhorias da análise comparativa

Todas entregues (Fases 1.5, 1.6 e 3 — os grupos do Canvas com cor e progresso agregado vieram com o Quadro Visual).

Fora de escopo por decisão de arquitetura (arquivo único 100% local): contas/sync em nuvem, multiplayer/festas do Habitica, notificações push do SO, IA integrada.

## Ideias de gamificação em backlog (opcional — só implementar se o usuário pedir explicitamente)

- Títulos temáticos por nível (ligados à jornada financeira do usuário)
- Destaque do caminho crítico de dependências no Quadro Visual

## Comandos úteis

Não há passo de build. Para testar: abrir o `.html` diretamente no navegador. Para validar antes de entregar uma versão: extrair o `<script>` para `.js` e rodar `node --check`.

## Outros projetos no repositório

- `strikezone.html` — **StrikeZone** (v1.7), FPS tático inspirado no CS:GO, com modos estilo Call of Duty/Battlefield e modos estilo Apex Legends (**Arenas** e **Battle Royale**). Menu principal em três abas (`#menu-tabs`, `settings.menuTab`): **Tático** (CS: bomba, Wingman, Retakes, treino), **Guerra** (CoD/BF: `WAR_MODES` em `#war-modes`, classes) e **Lendas** (Apex: Battle Royale e Arenas, tela `#arenas` reaproveitada com `hud.arMode` 'br'/'arenas'); elementos com `data-tabs` aparecem só nas abas listadas. Modos em `MODES` (+ `MODE_ORDER`; flags `rounds`, `respawn`, `cod`, `classes`, `roles`, `streaks`, `regen`, `destroy`, `flags`, `delay`, `time`): **Desarme de bomba** (5 contra 5), **Wingman 2×2** (um bomb só, `M.wingman`, rodadas de 1:30), **Retakes** (C4 já plantada num `plantSpots`, TRs no `postplant`, CTs no `rally`, armas sorteadas, sem loja), **Mata-mata em equipe**, **Corrida armamentista** (`GUNGAME_LADDER`, faca rebaixa), **Matar e Confirmar** (plaquetas), **Dominação** (bandeiras A/B/C em `M.dom`), **Fortificação** (zona que gira por `M.hpZones`), **Conquista** (16×16, bandeiras + tíquetes), **Conquista Grande** (30×30, só no `cq_vale`), **Ruptura** (`rush`: o ataque toma setores em ordem com tíquetes limitados, `M.rush.sectors`; base do ataque avança, defesa renasce nas bandeiras do setor), **Jogo personalizado** (qualquer modo, mapa, lado, até 31 aliados e 32 inimigos — `MAX_ALLIES`/`MAX_ENEMIES`) e **Treino de mira** com exercícios e recordes. `mapSupports(mapa, modo)` usa `m.modes` (sem a lista: todos menos os `BIG_MODES`); `startMode` troca para um mapa compatível. `bigMode()` = Conquista, Conquista Grande ou Ruptura; `hugeAllies/hugeEnemies` do modo valem em mapas com `huge`. Independente do GoalQuest: não compartilha código nem dados. Segue as mesmas 7 regras de estrutura (arquivo único, IIFE, sem handlers inline, constantes/estado no topo, um único `init` no `DOMContentLoaded`). WebGL 2 puro sem bibliotecas (materiais procedurais e pinturas de arma assados uma vez numa texture array, oclusão de ambiente assada por vértice, cor por vértice na malha estática, objetos dinâmicos instanciados, sombra estática + sombra dinâmica pequena, bloom opcional em buffer MSAA, resolução interna configurável), áudio sintetizado com WebAudio (som 3D HRTF opcional), `localStorage` só para preferências (`strikezone.settings.v2`, migra da v1; inclui `map`, `role`, `classIdx` e as opções `cg*` do jogo personalizado), classes (`strikezone.classes.v1`) e recordes do treino (`strikezone.records.v1`).
  - **Arenas** (`arenas2` 2×2 e `arenas3` 3×3; flags `arenas`, `cod`, `revive`; fora do `MODE_ORDER`, menu `#arenas` com tamanho, mapa e lenda): fontes do build em `p2d.js` (constantes `ARENA_*`, `RING_*`, `SHIELD_TIERS`, `HEAL_ITEMS`, `RARITY`, `ARENA_SHOP`, `LEGENDS`/`LEGEND_ORDER` e números das habilidades `PHASE_*`, `SCAN_*`, `DOME_*`, `STIM_*`, `DRONE_*`, `GRAPPLE_*`, `ZIP_*`, `LIFT_*`, `HOLE_*`, `PORTAL_*`), `p6c.js` (motor), `p4b.js` (efeitos de energia e visual das lendas) e `p8c.js` (menu, loja Arsenal, HUD, números de dano). Estado em `game.arena` (`phase` buy/live/over, anel, gadgets `pads/zips/domes/drones/lifts/holes/portals/packs/scans`). Rodadas: compra de `ARENA_BUY_TIME` s (loja abre sozinha, tecla B), vence quem fizer `ARENA_WIN` com `ARENA_LEAD` de vantagem (máx. `ARENA_MAX_ROUNDS`); anel começa após `RING_DELAY` s e o dano ignora escudo. Materiais ◆ em `p.mats`; escudo em `p.armor` com nível `p.shieldTier`; curas em `p.heals` (H usa `bestHeal`, canalizado); raridade da arma em `inst.tier` (pente, coice, recarga); equipamento guardado em `p.arenaLoadout` no início da rodada ao vivo. Abatido pode ser reanimado por qualquer colega (E) em `ARENA_KNOCK_TIME` s. 12 lendas com passiva, tática (Q, com cargas: `p.tacCharges`/`tacMax`, recarga em `p.tacReady`, `spendTactical`/`tacticalCharge`) e suprema (Z, `p.ultCharge` 0..1): Vulto (aviso de mira, fase, fenda), Faro (pegadas `A.tracks`, varredura, caçada), Muralha (robusto + escudo de braço mirando `gunShieldAbsorb`, domo, bombardeio), Turbo, Brisa (drone que também reanima `droneRevive`, suprimentos), Rastro (vê o próximo anel, gancho, tirolesa), Fumaça (2 cargas, barragem que deixa lento), Órbita, Toxina (barris e nuvem de gás `A.traps`/`A.gas`: corrói vida ignorando escudo e deixa lento), Voltagem (cercas `A.fences` e pilão `A.pylons` que recarrega escudo e derruba granadas/mísseis/bombardeios inimigos), Asa (mochila a jato, enxame de mísseis `A.missiles`, voo alto `p.glide`) e Vidente (batimentos mirando, foco `focusBlast`, vitrine `A.spheres`) — nomes e armas originais, não usar marcas da Apex. Lógica das lendas novas em `p6d.js` (`legendTick` por jogador, `updateLegendGadgets`, `botAbilities` com regras por lenda); constantes `GAS_*`, `TRAP_*`, `FENCE_*`, `PYLON_*`, `JET_*`, `MISSILE_*`, `SKY_*`, `GLIDE_*`, `HEART_*`, `FOCUS_*`, `EXHIBIT_*`, `TRACK_*`, `GUNSHIELD_*`, `SLOW_*` em `p2d.js`. Lentidão em `p.slowUntil`/`p.gasUntil` (entra em `arenaSpeedMult`). 11 armas `apex: true` (pulga, sopro, ferrao, vespa, faisca, brasa, raio, trovao, rajada, lanca, dragao; energia com traçante colorido, `spinup`/`ramp`) que ficam fora do editor de classes. Domos param bala (`domeBlockT` no `traceBullet` e na visão dos bots). Bots: `arenaBotBuy`, `decideArenas`, `botAbilities`.
  - **Battle Royale** (`br`; flags `arenas`, `br`, `cod`, `revive`; `p6e.js`): esquadrões de `BR_SQUAD` (o do jogador é 'CT'; os outros ganham ids 'T', 'S2'… com entrada criada em `TEAM_INFO` e apagada no `startMatch`), quantidade em `settings.brSquads` (`BR_SQUAD_OPTS`). Estado em `game.br` (`phase` ship/live/over, `squads`, `loot` + grade `grid` de `BR_LOOT_CELL` m, `beacons`, `stage` do anel). Nave reta (`br.ship`, `shipPos`) a `BR_SHIP_ALT`; `p.onShip` (escondido, `playerTick` só segue a nave, bots esperam em `brBotShip`), salto com Espaço/E (`brJump`; o esquadrão do jogador salta junto) e queda planando/mergulhando com `p.glide = { dive }` (olhar para baixo mergulha; o mesmo planar do Voo alto). Saque em `M.loot` ([x, z, peso]) vira itens `weapon` (raridade `rollTier`/`BR_TIER_ODDS`), `heal`, `shield`, `ammo`; curas, munição e escudo melhor são pegos ao passar (`brAutoPickup`), arma com E (`brLocalUse`, troca e larga a antiga). Anel em fases `BR_RING` (espera, fechamento, raio, dano; `brSetRing`/`brRingUpdate`; `A.ring.nx/nz/r1` é o próximo círculo). Escudo evolui com o dano causado (`p.evoDmg`, `BR_EVO`, tier 3 vermelho só no BR). Abatido fica `BR_KNOCK_TIME` s para ser reanimado; morte de vez (`brFinalDeath`) larga armas, curas, escudo e a faixa (`banner`), que o colega leva até uma baliza de `M.beacons` (segurar E `BR_BEACON_TIME` s, `brRespawnAt`). Fim quando sobra um esquadrão (`brCheckEnd`, posição em `squads[id].place`, tela `brEndScreen`, placar `brBoardHtml`). Bots: `decideBR` (anel → faixa/baliza → saque com reserva `claim` → esquadrão → caça → pontos de interesse). Mapa `br_serra` (384×384, `gen_serra.js` → `map_serra.js`, só `modes: ['br']`): vale entre serras (paredões nas bordas, serra do norte, Pico do Vento com mirante, serra oeste), rio com cachoeira, lago, pontes e vau, florestas; pontos de interesse Vila da Serra, Mina, Mirante, Nave caída, Estação Orbital, Usina, Fazenda, Acampamento e Lago, com `jumpPads`, `ziplines`, `beacons` e `loot`.
  - **Marcações (ping)** em todos os modos (`p7d.js` + roda em `p8c.js`): T ou botão do meio — toque marca o inimigo na mira (ou "vamos para lá"), dois toques "inimigo aqui", segurar abre a roda `PING_WHEEL` (1/2/3+ inimigos, vamos, defender, vigiar/saque, cuidado, reagrupar). `game.pings` (`PING_TYPES`, até `PING_MAX_PER` por jogador) aparecem na tela (`updateMarkers`) e no radar (`drawPingRadar`). `pingReact` muda a tática dos bots do time: em menor número seguram posição coberta, em vantagem flanqueiam (`b.ping` kind flank/hold/go/regroup, executado em `botPingPlan` antes da decisão do modo), no desarme de bomba os TRs trocam de bomb (`tSwitchSite`) e os CTs rotacionam; marcações de inimigo/cuidado esquentam o mapa de perigo. Bots também marcam o que veem (`botAutoPing`, a cada `PING_BOT_EVERY` s). O mapa de perigo aceita qualquer time (`dangerArr`).
  - Visual v1.7: corpo dos personagens arredondado em todos os modos (`drawLeg`, `drawArm`, `drawFace`: coxa/canela/braço cilíndricos com joelho, cotovelo e ombro esféricos, joelheira, bolso na coxa, bota com bico e sola, luva com dedos, nariz/orelhas/sobrancelhas), armas das Arenas/BR remodeladas com muito mais peças, explosões com orçamento adaptativo (`fxBudget`: menos partículas quando a tela já está cheia) e `MAX_PARTICLES` menor.
  - Mapa `ar_cascata` (112×112, `gen_cascata.js` → `map_cascata.js`): cânion ao pôr do sol com cachoeira, rio (ponte e vau), estação de pesquisa com torre, nave caída, vila e mirante; `M.jumpPads` ([x, z, força, direção]) e `M.ziplines` viram gadgets das Arenas; barreira desencontrada na saída de cada base garante que os spawns não se enxerguem. Materiais novos `CLAY` e `TECH`; decorações `dropship`, `neon`, `bin`, `holo`, `waterfall`. Luz por mapa em `M.light` (`mapLight()` → `R.light`, céu com `uZenith`/`uSunGlow`). Efeitos de energia num passe aditivo próprio (`drawEnergyFx`, intensidade `FX_GAIN`), silhueta através das paredes para inimigos revelados (`R.forceCol`/`XRAY_COL`). Personagens de todos os modos ganharam cabeça/capacete esféricos, ombreiras, bolsos, mochila e joelheiras (`MESH_SPH`); lendas têm modelo próprio (`drawLegendTorso`/`drawLegendHead`).
  - Modos com renascimento (`modeUpdate`, `respawnPlayer`, `onModeKill`, `checkModeEnd`): proteção curta ao renascer (`SPAWN_PROTECT`), vida que volta sozinha (`REGEN_*`), spawn longe e fora da visão dos inimigos (`spawnPointNear`). Bots decidem em `decideRespawnMode` (plaqueta, bandeira, zona, reanimar, mata-mata).
  - Movimento CoD (só onde `cod`): Shift corre (`SPRINT_*`), C correndo desliza (`SLIDE_*`), espaço escala obstáculos até `MANTLE_MAX`, botão direito mira pelo cano (`ADS_*`; tiro sem mirar fica `HIPFIRE_MULT` pior), T/botão do meio marca inimigo (`MARK_TIME`). Fora desses modos o jogo continua igual ao CS.
  - Classes (Matar e Confirmar, Dominação, Fortificação): 5 editáveis no menu Classes (arma + 2 acessórios de `ATTACHMENTS`, pistola, letal/tática de `LETHALS`/`TACTICALS`, 3 perks de `PERKS`); morto, 1–5 troca a classe. Sequências de abates (`STREAKS`, tecla X): drone espião, ataque aéreo no ponto mirado, helicóptero que caça inimigos (pode ser derrubado).
  - Modos grandes: esquadrões de 4 (`assignSquads`, campo `p.fireteam` — **não** usar `p.squad`, que é o lado do placar), renascer no colega (`'sq'` no painel de renascer, `squadSpawnOk`), bandeiras com vantagem (`perk: 'radar'` revela inimigos, `perk: 'arty'` chama artilharia), corrida tática (dois toques no Shift, `TAC_*`) e queda da bala em fuzis/snipers nos mapas `big` (`BULLET_*`, bots compensam). HUD compacto: nomes só perto (`PLATE_RANGE_BIG`), contagem em vez de bolinhas (`PIPS_MAX`), placar em duas colunas.
  - Bots táticos (`p7c.js` no build, seção 9c): mapa de perigo por time (`DANGER_*`, mortes e inimigos vistos esquentam a área e entram no custo do A* via `nav.ctx`), rotas de flanco por bot (`FLANK_*`), busca de cobertura ao recarregar/ferido/suprimido (`findCover`, `COVER_*`), rádio entre bots com reações (`teamComm`/`COMM_LINES`: contato, ajuda, bandeira atacada, recarregando, granada, sniper), granada no último ponto visto, desvio de granadas e supressão (`SUPPRESS_*`). Desempenho com 60 jogadores: orçamento de A* por quadro (`PATH_BUDGET*`), heurística mais forte em mapas grandes (`NAV_HEUR_BIG`), cache de linha de visão (`VIS_CACHE_TIME`). Medir com `simulate` + profiler do Chrome antes de mexer.
  - Conquista: funções de esquadrão (`ROLES`: médico cura e reanima com E, apoio reabastece, engenheiro com lança-foguetes `rpg` e minas, reconhecimento com sensores), abatido pode ser reanimado por `REVIVE_WINDOW` s (espaço desiste), escolha de função e ponto de renascer (QG ou bandeira do time) no painel `#deploy`.
  - Destruição (`destroy`): caixotes, barris, paletes e sacos de areia têm vida (`PROP_HP`) e somem (`setPropVisible` zera o trecho do índice estático e `refreshNavArea` refaz a navegação local).
  - Mapas em `MAPS` (+ `MAP_ORDER`), grade de 1 m: `de_duna` (Dust II) e `de_miragem` (Mirage), 144×144; `cq_oasis` (256×256, cidade no deserto: bairros com ruas, uádi com oásis e passarela, forte em ruínas no morro, refinaria, mesquita com minarete, mercado) e `cq_vale` (384×384, vale verde: rio com ponte de pedra/ponte de ferro/vau, vila com igreja, fazenda com milharal, estação, serraria, pedreira, morro da antena e colina da artilharia). Os dois grandes foram gerados por um script Node (fora do repositório) e usam o relevo: `terrain: { base, prims }` (hill, ridge, noise, flat, ramp, channel, set), ops `terrain`/`water`, alturas relativas `'g'`/`'g2.5'` medidas no relevo, `world.hv` (alturas nos vértices, triângulos divididos na diagonal), água animada (vadear deixa lento), grama/terra/pedra/asfalto. Natureza em `decorNature` (árvore, pinheiro, arbusto, pedra, tronco, cerca, fardo…) e `decorExtra` (nave, neon, lixeira, holograma, cachoeira, cúpula, trilho, milharal, canhão, helicóptero caído, coluna, barraca, bomba de gasolina, lápide, barco, tanque); arbustos, copas e milho escondem jogadores dos bots (`foliageThickness`, `FOLIAGE_HIDE`) mas não param bala. Cada mapa traz `ops` (open/stairs/roof/wall/window/wallh/wallmat/floormat), `props`, `ladders`, `decor`, `facade` e os dados dos bots (`nav`, `tRoutes` com `stage`, `ctHolds`, `postplant`, `plantSpots`, `lineups`, `rally`), `places`, `practice`, `spawnYaw`, `radarLabels`, `dom`, `hpZones`, `wingman`; mapa de Conquista tem `modes`, `big`/`huge`, `conquest` (`flags` — com `perk` opcional —, `hq`) e `rush` (`att`, `sectors`) e não tem `sites` (as funções de bomb checam `M.sites`). Estado do mapa atual em `M`; `loadMap(id)` refaz grade, navegação, malha, radar e decalques. Regra: **os spawns não podem se enxergar** — validar com um teste de linha de visão entre todas as células dos dois spawns ao mexer num mapa, e recalibrar os `lineups` com `solveThrow` (erro < 1,5 m).
  - Granadas caem com `NADE_GRAVITY` (0,4× como no CS) para alcançar os lineups longos. Decoração usa sorteio com semente (`drand`) para sair igual toda vez.
  - Miras de tela (`updateSight`, canvas `#sight`): luneta com duplex/mil-dots e sombra que balança, luneta iluminada (AUG/SG), holográfica (fuzis/metralhadora com acessório de mira) e ponto vermelho (SMG/pistola), alça de mira 2D ao mirar pelo cano sem acessório (fuzil, pistola, espingarda). Nos modos CoD a mira de tela abre com a imprecisão.
  - Tiro: padrões de spray fixos por arma (`SPRAY_PATTERNS`), precisão total abaixo de `ACCURATE_SPEED_FRAC` da velocidade (counter-strafe), penetração por material (`MAT_PEN`), tag por classe de arma (`TAG_SLOW`). Armas: pistolas (Glock, USP-S, P250, Tec-9, Five-SeveN, CZ75-Auto, Deagle), SMGs (MAC-10, MP9, MP7, UMP-45, PP-Bizon, P90), pesadas (Nova, XM1014, MAG-7, Sawed-Off, Negev), rifles (Galil, FAMAS, AK-47, M4A4, SG 553 e AUG com luneta que não sai ao atirar — `keepScope`, SSG 08, AWP) e Zeus x27 (slot `zeus`, some depois do tiro). Mira desenhada em canvas alinhado ao pixel (por padrão **não abre ao atirar**). A mira do mouse não tem suavização: tranco de câmera (`viewRecoil`), balanço da arma (`vmBob`) e soco ao levar tiro (`HIT_PUNCH`) são pequenos de propósito — não aumentar sem pedido do usuário.
  - Bots (dificuldades em `DIFFICULTIES` — não deixar mais difíceis sem pedido): personalidades (`BOT_PERSONAS`), economia de time com variedade de armas, granadas com posições fixas por mapa (`M.lineups`), execução quando ~65% do time chega no ponto de espera (espera curta pelas granadas; o entry entra quando a primeira estoura), nunca voltam para um ponto da rota que já passou (`syncRouteIdx`), só viram de costas para a flash do próprio time parados e no instante em que ela estoura, destravam em etapas (pulo + passo de lado, novo caminho, desvio) e desviam de colegas (`makeWay`; colegas bots se atravessam só enquanto um está destravando). Retake com ponto de encontro, rotação por sinais de TR, times grandes espalhados pelas posições (`holdOff`), comandos de rádio na tecla Z.
  - Morto, **E** assume o bot aliado observado (uma vez por rodada, `takeOverBot`). Extras: galinhas, killfeed com HS/parede/sem mira/cego/fumaça, histórico de rodadas e dinheiro do time no placar (Tab), mapa grande (M), kit que cai do CT morto, trajetória da granada no treino.
  - Fumaça reativa: tiros abrem túneis e a HE abre um buraco que volta a fechar; a linha de visão (`smokeBlocks`) respeita os buracos. Mortos viram ragdoll (Verlet, `RAG_*`).
  - Abrir com `?debug=1` expõe `window.__SZ` (estado, `simulate(segundos)`, `play(modo, exercício, custom)`, `set(chave, valor)`, `loadMap`, `map()`, `killPlayer`, `takeOverBot`, `issueRadioCommand`, `solveThrow`, `throwPath`, `findPath`, `losClear`, `siteAt`, `buy`, `vmPose`, `useTactical`, `useUltimate`, `tryZip`, `startHeal`, `bestHeal`, `applyDamage`, `LEGENDS`, `placePing`, `smartPing`, `give(id, tier)`) e `game.debugLog` (granadas dos bots) para testes com Playwright.


