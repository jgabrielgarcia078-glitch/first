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

### Regras do motor de jogo (não quebrar)

- Toda mutação passa por `commit()`; XP positivo usa `gainXp()` (aplica multiplicador) e estornos usam `awardXp()` com o valor bruto salvo em `xpAwarded`. Cura de conclusão fica em `hpAwarded` e é estornada ao reabrir.
- `markActiveDay()` deve rodar **antes** de `gainXp()` para o multiplicador já contar o dia de hoje.
- `processDailyTick()` avalia dias completos de `player.lastTickDate` até ontem (máx. 30), roda na abertura (antes do 1º render, fora do undo), a cada 60 s e ao voltar para a aba. Usa o status **atual** de metas/projetos.
- `player.daily[iso] = { xp, actions }` alimenta o heatmap (o log de atividades é truncado em 300 itens, não usar para histórico longo).
- Salvamento com debounce curto (50 ms) de propósito: fechar a aba logo após uma ação não pode perder dados.

### Validação antes de entregar

Além do `node --check` (regra 7): teste E2E com Playwright abrindo o `.html` via `file://`, usando `page.clock.setFixedTime` para simular a passagem dos dias. Atenção: `page.goto` que só muda o `#hash` não recarrega a página — use `page.reload()`.

## Roadmap completo (fases futuras, nesta ordem)

2. **Kanban + Checkpoints** — drag-and-drop, fotos/evidências, dependências entre metas, submetas, recorrência
3. **Quadro Visual (Canvas)** — a parte tecnicamente mais delicada: blocos arrastáveis/redimensionáveis, conexões/setas, grupos visuais, zoom, tela cheia, bloqueio/ocultação
4. **Gamificação completa** — conquistas padrão + customizadas, recompensas, refino de XP/streak
5. **Calendário + Estatísticas avançadas**
6. **Configurações visuais completas + Backup + Atalhos + Busca + Notificações + Histórico**

## Melhorias da análise comparativa ainda pendentes

Prioridade média (encaixar nas fases indicadas):
- **Modo foco / Pomodoro vinculado a uma meta** (Forest, Finch) — registra tempo em metas de duração. Fase 3 ou 4.
- **Scoreboard semanal/mensal** no Dashboard (esta semana vs. anterior: XP, metas, dias ativos) (Way of Life). Fase 5.
- **Export CSV** além do JSON (por meta/checkpoint, para abrir no Excel). Fase 6.
- **Templates de meta** prontos por categoria (leitura, peso, certificação…) com o tipo de acompanhamento certo. Fase 2.
- **Reflexão na conclusão** ("o que funcionou / o que faria diferente") gravada no histórico. Fase 2 ou 4.
- **Grupos do Canvas com cor e progresso agregado** dentro do retângulo (Miro/Milanote). Fase 3.
- **Atalhos "G depois X"** para navegação (G→D Dashboard, G→P Projetos…) (Linear). Fase 6.

Baixa prioridade: temas extras (ex.: retrô), avatar que evolui com o nível, "melhor dia da semana" nas estatísticas.

Fora de escopo por decisão de arquitetura (arquivo único 100% local): contas/sync em nuvem, multiplayer/festas do Habitica, notificações push do SO, IA integrada.

## Ideias de gamificação em backlog (opcional — só implementar se o usuário pedir explicitamente)

- Títulos temáticos por nível (ligados à jornada financeira do usuário)
- Destaque do caminho crítico de dependências no Quadro Visual

## Comandos úteis

Não há passo de build. Para testar: abrir o `.html` diretamente no navegador. Para validar antes de entregar uma versão: extrair o `<script>` para `.js` e rodar `node --check`.
