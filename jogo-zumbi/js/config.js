/* Condado Perdido — configuração global.
 * Regra 1: TODAS as constantes do jogo ficam aqui, carregadas antes de qualquer outro arquivo.
 * Os outros arquivos só leem CP.C (nunca redefinem). */
(function (CP) {
  'use strict';

  var C = {};

  C.GAME_NAME = 'Condado Perdido';
  C.VERSION = '0.1.0';
  C.SCHEMA_VERSION = 1;

  /* ---------- Projeção isométrica ---------- */
  C.TILE_W = 64;          // largura do losango do piso (px, zoom 1)
  C.TILE_H = 32;          // altura do losango do piso
  C.WALL_H = 84;          // altura de uma parede/andar em px
  C.CUT_WALL_H = 10;      // altura da parede "recortada" (quando está na frente do jogador)
  C.ZOOM_LEVELS = [0.5, 0.65, 0.8, 1, 1.25, 1.5, 2];
  C.ZOOM_DEFAULT_INDEX = 3;

  /* ---------- Mundo ---------- */
  C.CHUNK = 32;                 // tiles por lado de um chunk (= 1 quarteirão do mapa macro)
  C.WORLD_CHUNKS = 48;          // chunks por lado → mundo de 1536×1536 tiles
  C.LEVELS = 3;                 // 0 = térreo, 1 = 1º andar, 2 = telhado de sobrado
  C.LOAD_RADIUS = 2;            // chunks carregados em volta do jogador (5×5)
  C.UNLOAD_RADIUS = 3;          // chunk sai da memória além disso
  C.ROAD_W = 5;                 // faixas de asfalto
  C.TOWN_COUNT_MIN = 5;
  C.TOWN_COUNT_MAX = 7;
  C.TOWN_RADIUS_MIN = 2;        // em chunks
  C.TOWN_RADIUS_MAX = 4;
  C.TOWN_MIN_DIST = 9;          // distância mínima entre centros de cidades (chunks)
  C.BORDER_CHUNKS = 1;          // faixa de quarentena na borda do mundo

  /* Pisos (id → nome). Usados como índice em tabelas de sprite. */
  C.FLOOR = {
    NONE: 0, GRASS: 1, DIRT: 2, ASPHALT: 3, SIDEWALK: 4, WOOD: 5, TILE: 6, CARPET: 7,
    WATER: 8, SAND: 9, FARM: 10, ROOF: 11, CONCRETE: 12, GRAVEL: 13, LINOLEUM: 14,
    DARKGRASS: 15, FURROW: 16, ASPHALT_LINE: 17, FIELD: 18
  };
  C.FLOOR_COUNT = 19;
  C.FLOOR_WALKABLE = [false, true, true, true, true, true, true, true, false, true, true, true, true, true, true, true, true, true, true];
  C.FLOOR_OUTDOOR = [false, true, true, true, true, false, false, false, true, true, true, true, true, true, false, true, true, true, true];

  /* Bordas (paredes ficam nas bordas norte/oeste de cada tile, como no PZ). */
  C.EDGE = {
    NONE: 0, WALL: 1, DOOR: 2, WINDOW: 3, FENCE: 4, FENCE_TALL: 5, DOORWAY: 6, GARAGE: 7
  };
  /* Telhados: inclinação (px de altura por tile), altura máxima da cumeeira e maior largura com telhado de duas águas */
  C.ROOF_SLOPE = 17;
  C.ROOF_MAX_H = 84;
  C.ROOF_PITCH_MAX = 14;

  /* Estilos de parede: índice em C.WALL_STYLES */
  C.WALL_STYLES = [
    { name: 'branca', base: '#d9d4c7', trim: '#a9a395' },
    { name: 'amarela', base: '#d8c27a', trim: '#a8924c' },
    { name: 'azul', base: '#8fa7bd', trim: '#5f7890' },
    { name: 'tijolo', base: '#9a5444', trim: '#6e3a2f', brick: true },
    { name: 'verde', base: '#9cb08e', trim: '#6c805f' },
    { name: 'cinza', base: '#9a9a96', trim: '#6c6c69' },
    { name: 'papel bege', base: '#cdbb9a', trim: '#9e8d6d', interior: true },
    { name: 'papel rosa', base: '#c9a3a3', trim: '#9b7777', interior: true },
    { name: 'papel azul', base: '#a4b4c4', trim: '#77879a', interior: true },
    { name: 'azulejo', base: '#d7dee0', trim: '#a7b0b3', interior: true, tiles: true },
    { name: 'madeira', base: '#8a6440', trim: '#5f432a', interior: true },
    { name: 'concreto', base: '#8d8d88', trim: '#62625e' }
  ];
  C.EXTERIOR_STYLES = [0, 1, 2, 3, 4, 5];
  C.INTERIOR_STYLES = [6, 7, 8, 10, 0];

  /* Objetos de tile (móveis, árvores...). sol = bloqueia passagem, cont = recipiente */
  C.OBJ = {
    NONE: 0, TREE: 1, BUSH: 2, BED_HEAD: 3, BED_FOOT: 4, FRIDGE: 5, STOVE: 6, COUNTER: 7, SINK: 8,
    TABLE: 9, CHAIR: 10, SOFA: 11, SHELF: 12, WARDROBE: 13, TOILET: 14, BATHTUB: 15, TV: 16,
    CRATE: 17, DUMPSTER: 18, LAMPPOST: 19, MAILBOX: 20, STAIRS: 21, DESK: 22, SHOP_SHELF: 23,
    CASH: 24, PUMP: 25, CAR: 26, LOG: 27, ROCK: 28, BARREL: 29, TREE_PINE: 30, WORKBENCH: 31,
    RAIN_BARREL: 32, CAMPFIRE: 33, CROP: 34, MED_CABINET: 35, LOCKER: 36, GENERATOR: 37,
    WALL_SHELF: 38, NIGHTSTAND: 39, DRESSER: 40, TALL_GRASS: 41, FENCE_POST: 42, CORPSE_PILE: 43
  };
  /* Propriedades por objeto: nome, sólido, recipiente (capacidade em kg), altura visual (0..1 de parede), bloqueia visão */
  C.OBJ_INFO = [];
  (function () {
    function o(id, name, solid, cap, h, opaque, extra) {
      var info = { id: id, name: name, solid: solid, cap: cap, h: h, opaque: !!opaque };
      if (extra) { for (var k in extra) { info[k] = extra[k]; } }
      C.OBJ_INFO[id] = info;
    }
    var O = C.OBJ;
    o(O.NONE, '', false, 0, 0);
    o(O.TREE, 'Árvore', true, 0, 2.2, false, { tree: true, chop: 6 });
    o(O.TREE_PINE, 'Pinheiro', true, 0, 2.6, false, { tree: true, chop: 7 });
    o(O.BUSH, 'Arbusto', false, 0, 0.45, false, { slow: 0.55, forage: true });
    o(O.TALL_GRASS, 'Mato alto', false, 0, 0.3, false, { slow: 0.8, forage: true });
    o(O.BED_HEAD, 'Cama', true, 0, 0.32, false, { bed: true, dismantle: ['plank', 3] });
    o(O.BED_FOOT, 'Cama', true, 0, 0.28, false, { bed: true });
    o(O.FRIDGE, 'Geladeira', true, 25, 0.95, false, { fridge: true, dismantle: ['scrap', 3] });
    o(O.STOVE, 'Fogão', true, 10, 0.5, false, { stove: true, dismantle: ['scrap', 2] });
    o(O.COUNTER, 'Balcão', true, 20, 0.5, false, { dismantle: ['plank', 2] });
    o(O.SINK, 'Pia', true, 8, 0.5, false, { water: true });
    o(O.TABLE, 'Mesa', true, 0, 0.42, false, { dismantle: ['plank', 2] });
    o(O.CHAIR, 'Cadeira', false, 0, 0.5, false, { slow: 0.7, seat: true, dismantle: ['plank', 1] });
    o(O.SOFA, 'Sofá', true, 0, 0.38, false, { seat: true, bed: true, dismantle: ['plank', 2] });
    o(O.SHELF, 'Estante', true, 18, 0.95, false, { dismantle: ['plank', 3] });
    o(O.WARDROBE, 'Guarda-roupa', true, 30, 1.0, false, { dismantle: ['plank', 4] });
    o(O.DRESSER, 'Cômoda', true, 20, 0.5, false, { dismantle: ['plank', 2] });
    o(O.NIGHTSTAND, 'Criado-mudo', true, 6, 0.35, false, { dismantle: ['plank', 1] });
    o(O.TOILET, 'Vaso sanitário', true, 0, 0.35, false, { water: true, waterTank: 6 });
    o(O.BATHTUB, 'Banheira', true, 0, 0.3, false, { water: true });
    o(O.TV, 'Televisão', true, 0, 0.55, false, { tv: true });
    o(O.CRATE, 'Caixote', true, 30, 0.45, false, { dismantle: ['plank', 2] });
    o(O.DUMPSTER, 'Caçamba', true, 40, 0.6, false);
    o(O.LAMPPOST, 'Poste', true, 0, 2.4, false, { light: 6 });
    o(O.MAILBOX, 'Caixa de correio', true, 2, 0.5, false);
    o(O.STAIRS, 'Escada', false, 0, 1, false, { stairs: true });
    o(O.DESK, 'Escrivaninha', true, 12, 0.45, false, { dismantle: ['plank', 2] });
    o(O.SHOP_SHELF, 'Prateleira', true, 30, 0.85, false, { dismantle: ['scrap', 2] });
    o(O.CASH, 'Caixa registradora', true, 4, 0.55, false);
    o(O.PUMP, 'Bomba de gasolina', true, 0, 0.8, false, { fuel: true });
    o(O.CAR, 'Carro abandonado', true, 25, 0.6, false, { car: true });
    o(O.LOG, 'Tora', true, 0, 0.25, false);
    o(O.ROCK, 'Pedra', true, 0, 0.3, false);
    o(O.BARREL, 'Barril', true, 15, 0.55, false);
    o(O.WORKBENCH, 'Bancada', true, 25, 0.5, false, { dismantle: ['plank', 3] });
    o(O.RAIN_BARREL, 'Coletor de chuva', true, 0, 0.6, false, { rain: true, waterCap: 40 });
    o(O.CAMPFIRE, 'Fogueira', false, 0, 0.2, false, { fire: true, light: 5 });
    o(O.CROP, 'Plantação', false, 0, 0.3, false, { crop: true });
    o(O.MED_CABINET, 'Armário de remédios', true, 6, 0.6, false);
    o(O.LOCKER, 'Armário metálico', true, 20, 1.0, false);
    o(O.GENERATOR, 'Gerador', true, 0, 0.5, false, { generator: true });
    o(O.WALL_SHELF, 'Prateleira de parede', false, 8, 0.0, false);
    o(O.FENCE_POST, 'Mourão', true, 0, 0.5, false);
    o(O.CORPSE_PILE, 'Pilha de corpos', true, 0, 0.3, false);
  })();

  /* ---------- Tempo ---------- */
  C.TICK_RATE = 30;                    // passos de simulação por segundo (real)
  C.REAL_MINUTES_PER_DAY = 60;         // 1 hora real = 1 dia no jogo (como o PZ)
  C.START_YEAR = 1993;
  C.START_MONTH = 6;                   // 0-based → julho
  C.START_DAY = 9;
  C.START_HOUR = 9;
  C.GAME_SPEEDS = [1, 2, 4, 8];        // velocidades normais (F1..F4 / botões)
  C.SLEEP_SPEED = 60;                  // multiplicador de tempo enquanto dorme
  C.MONTH_NAMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  C.WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  C.DAWN_HOUR = 5.5;
  C.DUSK_HOUR = 20.5;

  /* ---------- Jogador ---------- */
  C.PLAYER_RADIUS = 0.28;
  C.SPEED_WALK = 2.3;           // tiles por segundo
  C.SPEED_RUN = 3.9;
  C.SPEED_SNEAK = 1.35;
  C.SPEED_AIM = 1.4;
  C.SPEED_STAIRS_FACTOR = 0.75;
  C.VISION_RADIUS = 34;         // tiles (dia)
  C.VISION_CONE_DEG = 150;      // ângulo do cone de visão (total)
  C.VISION_NEAR = 2.2;          // dentro desta distância enxerga até pelas costas
  C.FOG_DIM = 0.58;             // brilho de tiles fora da visão
  C.HEARING_RADIUS = 7;         // percebe zumbis "ouvindo" pelas costas
  C.CARRY_BASE = 8;             // kg sem penalidade (ajustado pela Força)
  C.CARRY_PER_STRENGTH = 0.8;
  C.CARRY_HARD_MAX = 50;

  /* ---------- Ruído (raio em tiles que os zumbis escutam) ---------- */
  C.NOISE = {
    STEP_WALK: 4, STEP_RUN: 10, STEP_SNEAK: 1.5, SWING: 5, HIT: 7, SHOVE: 5,
    DOOR: 8, DOOR_BASH: 14, WINDOW_BREAK: 22, SHOUT: 30, GUNSHOT: 60, ALARM: 55,
    CAR_ALARM: 45, BARRICADE: 15, CHOP: 18, BUILD: 15, HELICOPTER: 45, META: 60
  };

  /* ---------- Zumbis (equivalente às opções de sandbox do PZ) ---------- */
  C.ZOMBIE = {
    ACTIVE_IN: 40,             // zumbis "acordam" (são simulados) a esta distância do jogador
    ACTIVE_OUT: 50,            // e voltam a ser só dados além desta
    RADIUS: 0.28,
    SPEED_SHAMBLER: 0.95,      // tiles/s perseguindo
    SPEED_FAST: 1.9,
    SPEED_SPRINTER: 4.4,
    SPEED_WANDER: 0.45,
    SPEED_CRAWL: 0.35,
    HP_MIN: 1.4, HP_MAX: 2.2,  // "vida" (arma média tira ~1 por golpe)
    SIGHT_DAY: 18, SIGHT_NIGHT: 7,
    SIGHT_CONE_DEG: 200,
    HEARING_MULT: 1.0,
    MEMORY_SECONDS: 30,        // quanto tempo continua indo ao último ponto
    ATTACK_RANGE: 0.85,
    ATTACK_WINDUP: 0.65,       // s
    ATTACK_COOLDOWN: 1.25,
    BASH_DAMAGE: 1,            // dano por batida em porta (portas têm ~40 de vida)
    BASH_INTERVAL: 1.6,
    STAGGER_TIME: 1.0,
    DOWN_TIME_MIN: 2.5, DOWN_TIME_MAX: 6,
    CRAWLER_CHANCE: 0.05,
    FAKEDEAD_CHANCE: 0.03,
    SPRINTER_CHANCE: 0.0,      // padrão = só arrastados
    FAST_CHANCE: 0.0,
    LUNGE_DIST: 1.5,
    DRAG_DOWN_COUNT: 3,        // nº de zumbis atacando juntos para derrubar e matar
    DRAG_DOWN_CHANCE: 0.25,
    SCRATCH_W: 0.63, LACER_W: 0.25, BITE_W: 0.12,   // pesos do tipo de ferida
    BITE_BEHIND_BONUS: 0.18,
    POP_TOWN: 16,              // média por chunk de cidade
    POP_DOWNTOWN: 26,
    POP_RURAL: 2,
    POP_FOREST: 1,
    POP_ROAD: 4,
    PATH_MAX_NODES: 2500,
    REPATH_INTERVAL: 0.9,
    THINK_INTERVAL: 0.25,
    GROAN_CHANCE: 0.004
  };
  C.ZOMBIE_SPEED_SETTINGS = {
    shambler: { fast: 0, sprint: 0 },
    mixed: { fast: 0.3, sprint: 0.03 },
    fast: { fast: 1, sprint: 0 },
    sprinters: { fast: 0, sprint: 1 }
  };

  /* Infecção zumbi (Knox → aqui "Febre Cinzenta") */
  C.INFECTION = {
    SCRATCH: 0.07, LACERATION: 0.25, BITE: 1.0,
    HOURS_MIN: 48, HOURS_MAX: 72          // horas até a morte depois de infectado
  };

  /* ---------- Necessidades (por hora de jogo) ---------- */
  C.NEEDS = {
    HUNGER_RATE: 0.035, HUNGER_SLEEP_RATE: 0.018,
    THIRST_RATE: 0.055, THIRST_SLEEP_RATE: 0.025,
    FATIGUE_RATE: 0.042, FATIGUE_SLEEP_RECOVER: 0.13,
    BOREDOM_RATE_IDLE_INDOOR: 0.03, BOREDOM_DECAY_OUTDOOR: 0.02,
    STRESS_DECAY: 0.03,
    PANIC_DECAY_PER_SEC: 4,          // pânico 0..100, cai por segundo real sem ameaça
    ENDURANCE_REGEN: 0.07,           // por segundo real parado
    ENDURANCE_REGEN_WALK: 0.03,
    ENDURANCE_RUN: 0.012,            // gasto por segundo real correndo
    STARVE_DMG: 1.2,                 // vida por hora com fome extrema
    DEHYDRATE_DMG: 2.0,
    CALORIES_PER_HOUR: 95,           // gasto basal
    KG_PER_CALORIE: 1 / 7700,
    HEAL_PER_HOUR: 1.2               // regeneração natural de vida
  };

  /* Moodles: limiares dos níveis 1..4 */
  C.MOODLE_LEVELS = {
    hunger: [0.15, 0.25, 0.45, 0.70],
    thirst: [0.12, 0.25, 0.70, 0.84],
    fatigue: [0.60, 0.70, 0.80, 0.90],
    endurance: [0.75, 0.50, 0.25, 0.10],    // invertido (abaixo de)
    panic: [6, 30, 65, 80],
    stress: [0.25, 0.50, 0.75, 0.90],
    boredom: [0.25, 0.50, 0.75, 0.90],
    unhappy: [0.20, 0.45, 0.60, 0.80],
    sick: [0.25, 0.50, 0.75, 0.90],
    pain: [10, 25, 50, 75],
    hot: [37.5, 38.5, 39.5, 40.5],
    cold: [35.9, 35.0, 33.5, 31.0],         // invertido
    wet: [0.15, 0.40, 0.70, 0.90],
    heavy: [1.0, 1.25, 1.5, 1.75],
    drunk: [0.15, 0.4, 0.65, 0.85],
    stuffed: [0.0, 0.0, 0.0, 0.0]
  };

  /* ---------- Habilidades ---------- */
  C.SKILL_XP = [75, 150, 300, 750, 1500, 3000, 4500, 6000, 7500, 9000]; // XP para passar de N para N+1
  C.SKILL_BOOST_MULT = [1, 1.75, 2.0, 2.25];   // bônus por nível inicial de ocupação/traço (0..3)
  C.BOOK_MULT = [3, 5, 8, 12, 16];              // volume 1..5 (cobre níveis 0-1, 2-3, ...)
  C.START_POINTS = 0;

  /* ---------- Clima ---------- */
  C.WEATHER = {
    CHANGE_HOURS_MIN: 3, CHANGE_HOURS_MAX: 10,
    BASE_TEMP_SUMMER: 27, BASE_TEMP_WINTER: -2, DAILY_SWING: 7
  };

  /* ---------- Eventos do mundo ---------- */
  C.EVENTS = {
    POWER_OFF_MIN_DAY: 3, POWER_OFF_MAX_DAY: 25,
    WATER_OFF_MIN_DAY: 3, WATER_OFF_MAX_DAY: 25,
    HELI_MIN_DAY: 6, HELI_MAX_DAY: 9,
    META_SOUND_PER_DAY: 3,
    ALARM_CHANCE: 0.18,          // ao arrombar uma casa
    ALARM_SECONDS: 90,
    SURVIVOR_HOUSE_CHANCE: 0.03
  };

  /* ---------- Combate ---------- */
  C.COMBAT = {
    SHOVE_RANGE: 1.15, SHOVE_ARC_DEG: 110, SHOVE_COOLDOWN: 0.55, SHOVE_ENDURANCE: 0.035,
    SHOVE_KNOCKDOWN_BASE: 0.22, STOMP_RANGE: 0.9, STOMP_DMG_MIN: 0.35, STOMP_DMG_MAX: 0.8,
    STOMP_COOLDOWN: 0.7, FIST_DMG_MIN: 0.08, FIST_DMG_MAX: 0.22,
    CRIT_MULT: 2.5, LOW_ENDURANCE_DMG_MULT: 0.6
  };

  /* ---------- Salvamento ---------- */
  C.DB_NAME = 'condado-perdido';
  C.DB_VERSION = 1;
  C.AUTOSAVE_SECONDS = 60;

  /* ---------- Cores de interface / personagens ---------- */
  C.SKIN_TONES = ['#f1d2b6', '#e3b48f', '#c98e64', '#a26a43', '#7a4a2c', '#553220'];
  C.HAIR_COLORS = ['#1d1612', '#3b2a1c', '#6b4a2b', '#a77a45', '#d8b878', '#8e3c22', '#9a9a9a', '#e6e2d6'];
  C.HAIR_STYLES = ['curto', 'raspado', 'médio', 'longo', 'rabo', 'careca'];
  C.CLOTH_COLORS = ['#3d5a80', '#98c1d9', '#e0fbfc', '#ee6c4d', '#293241', '#6a994e', '#a7c957', '#bc4749',
    '#f2e8cf', '#386641', '#5e548e', '#9f86c0', '#e9c46a', '#264653', '#2a9d8f', '#e76f51', '#8d99ae', '#2b2d42', '#d4a373', '#606c38'];
  C.ZOMBIE_SKIN = ['#8f9b7f', '#9aa28a', '#7f8c75', '#a0a593', '#86907a', '#b0ae9b', '#6f7a63'];

  CP.C = C;
})(window.CP = window.CP || {});
