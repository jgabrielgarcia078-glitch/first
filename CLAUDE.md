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

## Fase atual: Fase 1 — Fundação

Escopo desta entrega (confirmado com o usuário):

- Modelo de dados versionado + migração
- Camada de armazenamento em IndexedDB
- Estrutura de undo/redo (pode ser só o esqueleto ainda)
- Toasts e sistema de modais reutilizável
- Shell do app: navegação, tema claro/escuro básico
- Dashboard com estatísticas reais (não mockadas)
- CRUD completo de Projetos — visão Lista apenas
- CRUD completo de Metas — tipos de acompanhamento básicos (simples, numérica, percentual, frequência, duração, escala), **sem** dependências/recorrência ainda

**Fora de escopo nesta fase** (não implementar agora): Quadro Visual (Canvas), Kanban, Checkpoints com fotos, Conquistas, Recompensas, Calendário, Estatísticas avançadas, Configurações visuais completas, Backup, atalhos de teclado, busca global, notificações, histórico de atividades.

## Roadmap completo (fases futuras, nesta ordem)

2. **Kanban + Checkpoints** — drag-and-drop, fotos/evidências, dependências entre metas, submetas, recorrência
3. **Quadro Visual (Canvas)** — a parte tecnicamente mais delicada: blocos arrastáveis/redimensionáveis, conexões/setas, grupos visuais, zoom, tela cheia, bloqueio/ocultação
4. **Gamificação completa** — conquistas padrão + customizadas, recompensas, refino de XP/streak
5. **Calendário + Estatísticas avançadas**
6. **Configurações visuais completas + Backup + Atalhos + Busca + Notificações + Histórico**

## Ideias de gamificação em backlog (opcional — só implementar se o usuário pedir explicitamente)

- Multiplicador de XP crescente por manter streak alto
- Títulos temáticos por nível (ligados à jornada financeira do usuário)
- Modo foco (timer tipo Pomodoro vinculado a uma meta, registrando tempo investido)
- Destaque do caminho crítico de dependências no Quadro Visual

## Comandos úteis

Não há passo de build. Para testar: abrir o `.html` diretamente no navegador. Para validar antes de entregar uma versão: extrair o `<script>` para `.js` e rodar `node --check`.
