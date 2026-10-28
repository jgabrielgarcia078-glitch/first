# Gestão Empresarial (ERP) — Contexto do Projeto

Vale para tudo dentro de `erp/`. A raiz do repositório é outro projeto (GoalQuest); as 7 regras de estrutura de código de lá valem aqui também e estão repetidas abaixo.

## Visão geral

Sistema de gestão empresarial próprio, construído aos poucos tendo como referência o sistema que o usuário usa hoje na empresa da família (Solozar "Gestão Empresarial", empresa do agronegócio — o menu tem até CPR, Cédula de Produto Rural). Não há pressa.

Método de trabalho: o usuário manda prints de cada tela, explica o que ela faz e quais ele mais usa; cada tela vira um **programa** deste sistema. Prioridade = os Favoritos dele (o que mais usa). A referência é só funcional: não copiar marca, logo nem nome do Solozar.

Uso em desktop/PC (Windows). Telas densas, estilo sistema de gestão clássico: barra de menus, janelas internas, atalhos de teclado.

## Decisões técnicas (v0.1.0)

- **Arquivo único** `erp/gestao.html` (HTML + CSS + JS vanilla, sem framework, sem npm). Abre com duplo clique via `file://`.
- **IndexedDB** (banco `gestao-empresarial`), nunca localStorage.
- **Diferente do GoalQuest: nada de "estado único" em memória.** Um ERP acumula milhares de registros (clientes, produtos, títulos, lançamentos). Cada cadastro ganha o seu object store, com índices, criado em `DB_UPGRADES[n]` (estrutura do IndexedDB, `DB_VERSION`). O formato de cada registro é versionado com `CURRENT_SCHEMA_VERSION` + `MIGRATIONS` (nunca quebrar dados salvos sem migração).
- **Toda leitura/gravação passa pela seção 4 (Armazenamento).** As telas nunca chamam o IndexedDB direto, para que um dia dê para trocar por um servidor sem reescrevê-las.
- Hoje só existe o store `config`, com o registro `settings` (empresa, usuário, favoritos).
- Gravação: `scheduleSave()` agenda numa microtask (sem `setTimeout`), como no GoalQuest.

## Em aberto (decidir com o usuário antes de crescer muito)

- **Quem usa:** só ele num PC (dados ficam no navegador daquele PC) ou várias pessoas/PCs ao mesmo tempo (exige um servidor local na rede + banco de dados).
- **Objetivo:** substituir o sistema atual ou rodar em paralelo. Substituir inclui emitir NF-e, o que exige um serviço local com o certificado A1 conversando com a SEFAZ (não dá para fazer só no navegador).
- Nome definitivo do sistema (hoje: "Gestão Empresarial", provisório).

## Regras obrigatórias de estrutura do código

1. Constantes e dados estáticos (menus, programas, limites) no topo do script, antes de qualquer função.
2. Proibido `onclick`/`onchange` etc. inline. Todo evento via `addEventListener`, depois que o DOM existe.
3. Proibido declarar a mesma função duas vezes.
4. Exatamente um ponto de inicialização (`init`), chamado uma vez, no fim, dentro de `DOMContentLoaded`.
5. Toda expressão regular em uma única linha.
6. Todo o JS numa única IIFE; nada de `<script type="module">`.
7. Antes de entregar: extrair o `<script>` para `.js` e rodar `node --check`.

## Arquitetura da casca

- **`MENU_TREE`** — a árvore de menus como dados. Rótulo com `&` marca a letra do Alt+letra. Itens:
  `{ program: id }` abre um programa · `{ action: id, label }` executa uma ação (`runAction`) · `{ label, items: [...] }` submenu conhecido · `{ label, pending: true }` submenu ainda não visto (mostra "Aguardando o print") · `{ note, pending }` linha informativa · `MENU_SEP`. Item de topo com `action` (Sair) executa direto; `dynamic: 'janela'` é montado na hora (`buildWindowMenuItems`).
- **`PROGRAMS`** — registro de telas (`id → { title, icon, status, view, w, h, own }`). Sem `view` = placeholder "A construir" com o que mandar. Para construir uma tela: dar a ela um `view`, tratar o caso em `mountProgramView`, marcar `status: 'pronto'`. `own: true` = tela que não existe no sistema de referência (fica fora das contagens do mapa).
- Programas vistos só nos Favoritos (Cadastro de Produtos, Baixa de Títulos…) ainda não têm lugar no `MENU_TREE`. Quando chegar o print do submenu, trocar o `{ label, pending: true }` por `{ label, items: [...] }` com eles dentro — o caminho no menu (`programPaths`) e o Mapa do sistema se atualizam sozinhos.
- **Janelas internas (MDI):** uma instância por programa (abrir de novo foca a existente); arrastar pelo título, redimensionar pelas bordas direita/inferior, duplo clique maximiza, minimizar vai para a barra de tarefas no rodapé da área de trabalho; menu Janela com cascata, lado a lado e lista numerada. Eventos registrados uma única vez em `bindGlobalEvents` (delegação em `#win-area`).
- **Teclado:** `keydown` em fase de captura. Com menu aberto, o menu consome a tecla (`stopPropagation`). Alt+letra, F10, setas, Enter, letra = pula para o item, Esc; Ctrl+K = busca; Esc fecha a janela ativa quando o foco não está num campo. Alt+E pode ser capturado pelo próprio Chrome/Edge.
- **Favoritos:** `settings.favoritos` (padrão = os 10 do print, na mesma ordem). ☆ na barra da janela, botão direito num item do menu (liga/desliga), botão direito num favorito (abrir, mover, remover). A caixa de busca procura em todos os programas, sem acento, e mostra o caminho no menu.
- **Quadro ATENÇÃO:** `collectAlerts()` devolve frases. É onde entrarão os avisos reais (NF-e pendentes na SEFAZ, certidões vencendo, lista de impostos aproximados vencendo, títulos vencidos…).
- **Barra de status:** usuário, empresa, CAPS, NUM, relógio, NF-e (placeholder).
- **Sair:** fecha os programas e mostra a tela "Sessão encerrada" (o navegador não deixa a página fechar a própria aba). Login/senha de verdade virá com o menu Sistema.

## O que já vimos do sistema atual (prints de 28/10/2026)

- **Tela principal:** título "Gestão Empresarial - Licenciado para <EMPRESA> - <usuário>"; barra de menus Cadastros, Lançamentos, Estoque, Consultas, CPR, Sistema, Ajuda, Sair, Aguardar, Janela; painel Favoritos com busca e 10 atalhos; quadro ATENÇÃO (ex.: "3 NF-e pendentes de retorno na SEFAZ", "faltam 11 dias para vencer a Certidão Negativa de Débitos — sem ela não fatura nota interestadual", "faltam 3 dias para vencer a Lista de Impostos Aproximados"); "Programas Abertos N"; botões chave, atualizar e desligar; "Versão Atual: data/hora"; barra de status com NUM, hora - data e "NF-e: Ambiente: Produção | Versão NF-e: 4.00 | Dt Validade Cert.".
- **Menus já abertos nos prints:** Cadastros, Lançamentos, Estoque, Consultas (conteúdo transcrito em `MENU_TREE`).
- **Ainda não vistos:** menus CPR, Sistema, Ajuda, Aguardar, Janela e todos os submenus (›).
- **Dúvidas para o usuário:** o que faz "Aguardar"; o que significa o ✓ ao lado de "Clientes e Fornecedores" no menu (por ora interpretado como "está nos Favoritos", mostrado como ★); o que exatamente fazem os botões chave e atualizar.

## Status

### Fase 0 — Casca ✅ (v0.1.0, schema v1)

Tela principal no layout do sistema atual: menus completos dos 4 prints (mouse e teclado, submenus com atraso para atravessar na diagonal), janelas internas, barra de tarefas, menu Janela, Favoritos com busca e reordenação, quadro ATENÇÃO, barra de status com relógio e CAPS/NUM, primeiro uso pede empresa e usuário, Sistema › Mapa do sistema (o que já foi mapeado e o que falta de print), Ajuda › Atalhos/Sobre, Sair. Todas as telas ainda são placeholders.

### Próximos passos sugeridos

Seguir os Favoritos: **Clientes e Fornecedores** primeiro (é a base de pedidos, títulos e do Histórico da Vida do Cliente), depois **Cadastro de Produtos**, depois o financeiro (Lançamento de Caixa/Banco/Cartões, Baixa de Títulos, Conciliação Bancária, Emissão de Cheques) e as consultas.

## Validação antes de entregar

Além do `node --check` (regra 7): teste E2E com Playwright abrindo o `.html` via `file://`, cobrindo primeiro uso, menus por mouse e teclado, janelas (arrastar, redimensionar, maximizar, minimizar, lado a lado), busca, favoritos persistindo após `page.reload()`, Mapa do sistema e Sair. Conferir também em viewport baixa (~1366×640, a tela do usuário descontando o navegador): os 10 favoritos devem caber sem rolagem.
