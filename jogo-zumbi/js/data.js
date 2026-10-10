/* Dados estáticos: habilidades, ocupações, traços, partes do corpo, itens, receitas, loot. */
(function (CP) {
  'use strict';

  var D = {};

  /* ================= HABILIDADES ================= */
  D.SKILLS = [
    { id: 'fitness', name: 'Condicionamento', cat: 'Passivas', passive: true },
    { id: 'strength', name: 'Força', cat: 'Passivas', passive: true },
    { id: 'sprinting', name: 'Corrida', cat: 'Agilidade' },
    { id: 'lightfooted', name: 'Pés leves', cat: 'Agilidade' },
    { id: 'nimble', name: 'Agilidade', cat: 'Agilidade' },
    { id: 'sneaking', name: 'Furtividade', cat: 'Agilidade' },
    { id: 'axe', name: 'Machado', cat: 'Combate' },
    { id: 'longBlunt', name: 'Contundente longa', cat: 'Combate' },
    { id: 'shortBlunt', name: 'Contundente curta', cat: 'Combate' },
    { id: 'longBlade', name: 'Lâmina longa', cat: 'Combate' },
    { id: 'shortBlade', name: 'Lâmina curta', cat: 'Combate' },
    { id: 'spear', name: 'Lança', cat: 'Combate' },
    { id: 'maintenance', name: 'Manutenção', cat: 'Combate' },
    { id: 'aiming', name: 'Pontaria', cat: 'Armas de fogo' },
    { id: 'reloading', name: 'Recarga', cat: 'Armas de fogo' },
    { id: 'carpentry', name: 'Carpintaria', cat: 'Artesanato' },
    { id: 'cooking', name: 'Culinária', cat: 'Artesanato' },
    { id: 'farming', name: 'Agricultura', cat: 'Artesanato' },
    { id: 'firstAid', name: 'Primeiros socorros', cat: 'Artesanato' },
    { id: 'electrical', name: 'Elétrica', cat: 'Artesanato' },
    { id: 'metalworking', name: 'Metalurgia', cat: 'Artesanato' },
    { id: 'mechanics', name: 'Mecânica', cat: 'Artesanato' },
    { id: 'tailoring', name: 'Costura', cat: 'Artesanato' },
    { id: 'fishing', name: 'Pesca', cat: 'Sobrevivência' },
    { id: 'trapping', name: 'Armadilhas', cat: 'Sobrevivência' },
    { id: 'foraging', name: 'Coleta', cat: 'Sobrevivência' }
  ];
  D.SKILL = {};
  D.SKILLS.forEach(function (s) { D.SKILL[s.id] = s; });

  /* ================= OCUPAÇÕES ================= */
  /* pts: positivo = DÁ pontos; negativo = CUSTA pontos */
  D.OCCUPATIONS = [
    { id: 'unemployed', name: 'Desempregado', pts: 8, skills: {}, desc: 'Nenhuma habilidade, mas muitos pontos livres para traços.' },
    { id: 'firefighter', name: 'Bombeiro', pts: 0, skills: { axe: 1, fitness: 1, sprinting: 1, strength: 1 }, desc: 'Machado, corrida e físico forte.' },
    { id: 'police', name: 'Policial', pts: -4, skills: { aiming: 3, reloading: 2, nimble: 1 }, desc: 'Ótima pontaria e recarga.' },
    { id: 'ranger', name: 'Guarda-parques', pts: -4, skills: { foraging: 2, carpentry: 1, axe: 1, trapping: 1 }, desc: 'Sobrevivência na mata.' },
    { id: 'construction', name: 'Operário', pts: -2, skills: { shortBlunt: 3, carpentry: 1 }, desc: 'Martelos e marretas.' },
    { id: 'security', name: 'Segurança', pts: -2, skills: { sprinting: 2, lightfooted: 1 }, traits: ['nightowl'], desc: 'Acostumado à noite; corre bem.' },
    { id: 'carpenter', name: 'Carpinteiro', pts: 2, skills: { carpentry: 3, shortBlunt: 1 }, desc: 'Constrói e barrica com facilidade.' },
    { id: 'burglar', name: 'Ladrão', pts: -6, skills: { nimble: 2, sneaking: 2, lightfooted: 2 }, traits: ['hotwire'], desc: 'Silencioso, ágil, faz ligação direta.' },
    { id: 'chef', name: 'Chef', pts: -4, skills: { cooking: 3, shortBlade: 1, maintenance: 1 }, desc: 'Cozinha refeições melhores.' },
    { id: 'repairman', name: 'Reparador', pts: -4, skills: { carpentry: 1, maintenance: 2, shortBlunt: 1 }, desc: 'Armas duram mais.' },
    { id: 'farmer', name: 'Fazendeiro', pts: 2, skills: { farming: 3 }, desc: 'Planta e colhe muito bem.' },
    { id: 'fisherman', name: 'Pescador', pts: -2, skills: { fishing: 3, foraging: 1 }, desc: 'Peixe nunca falta.' },
    { id: 'doctor', name: 'Médico', pts: 2, skills: { firstAid: 3, shortBlade: 1 }, desc: 'Trata ferimentos com perfeição.' },
    { id: 'nurse', name: 'Enfermeiro', pts: 2, skills: { firstAid: 2, lightfooted: 1 }, desc: 'Primeiros socorros e passos leves.' },
    { id: 'veteran', name: 'Veterano', pts: -8, skills: { aiming: 2, reloading: 2 }, traits: ['desensitized'], desc: 'Nunca entra em pânico.' },
    { id: 'lumberjack', name: 'Lenhador', pts: 0, skills: { axe: 2, strength: 1 }, traits: ['axeman'], desc: 'Machado mais rápido; corta árvores rápido.' },
    { id: 'fitness', name: 'Instrutor fitness', pts: -6, skills: { fitness: 3, sprinting: 2 }, traits: ['nutritionist'], desc: 'Em ótima forma.' },
    { id: 'burger', name: 'Chapeiro', pts: 2, skills: { cooking: 2, maintenance: 1 }, desc: 'Cozinha o básico.' },
    { id: 'electrician', name: 'Eletricista', pts: -4, skills: { electrical: 3 }, desc: 'Geradores e eletrônicos.' },
    { id: 'engineer', name: 'Engenheiro', pts: -4, skills: { electrical: 1, carpentry: 1, trapping: 1 }, desc: 'Armadilhas e engenhocas.' },
    { id: 'metalworker', name: 'Metalúrgico', pts: -6, skills: { metalworking: 3 }, desc: 'Solda e metal.' },
    { id: 'mechanic', name: 'Mecânico', pts: -4, skills: { mechanics: 3, shortBlunt: 1 }, traits: ['hotwire'], desc: 'Conserta e liga carros.' }
  ];
  D.OCC = {};
  D.OCCUPATIONS.forEach(function (o) { D.OCC[o.id] = o; });

  /* ================= TRAÇOS ================= */
  /* cost: positivo = CUSTA pontos (traço bom); negativo = DÁ pontos (traço ruim). hidden = só via ocupação */
  D.TRAITS = [
    // positivos
    { id: 'athletic', name: 'Atlético', cost: 10, desc: '+4 Condicionamento. Corre mais e cansa menos.', skills: { fitness: 4 }, excl: ['unfit', 'outofshape', 'fit', 'obese', 'overweight', 'smoker'] },
    { id: 'strong', name: 'Forte', cost: 10, desc: '+4 Força: mais dano, empurra mais, carrega mais.', skills: { strength: 4 }, excl: ['weak', 'feeble', 'stout'] },
    { id: 'thickskin', name: 'Pele grossa', cost: 8, desc: 'Arranhões e mordidas atravessam menos.', fx: { woundMult: 0.75 }, excl: ['thinskin'] },
    { id: 'adrenaline', name: 'Viciado em adrenalina', cost: 8, desc: 'Fica mais rápido quando em pânico.', fx: { panicSpeed: 0.15 } },
    { id: 'fastlearner', name: 'Aprende rápido', cost: 6, desc: '+30% de XP (exceto Força e Condicionamento).', fx: { xpMult: 1.3 }, excl: ['slowlearner'] },
    { id: 'keenhearing', name: 'Audição aguçada', cost: 6, desc: 'Percebe zumbis atrás de você de mais longe.', fx: { hearing: 1.5 }, excl: ['deaf', 'hardofhearing'] },
    { id: 'fasthealer', name: 'Cura rápida', cost: 6, desc: 'Ferimentos saram mais rápido.', fx: { healMult: 1.5 }, excl: ['slowhealer'] },
    { id: 'organized', name: 'Organizado', cost: 6, desc: '+30% de capacidade em mochilas e bolsas.', fx: { bagCap: 1.3 }, excl: ['disorganized'] },
    { id: 'lowthirst', name: 'Pouca sede', cost: 6, desc: 'Sede aumenta mais devagar.', fx: { thirstMult: 0.5 }, excl: ['highthirst'] },
    { id: 'stout', name: 'Robusto', cost: 6, desc: '+2 Força.', skills: { strength: 2 }, excl: ['weak', 'feeble', 'strong'] },
    { id: 'fit', name: 'Em forma', cost: 6, desc: '+2 Condicionamento.', skills: { fitness: 2 }, excl: ['unfit', 'outofshape', 'athletic', 'obese'] },
    { id: 'brave', name: 'Valente', cost: 4, desc: 'Entra menos em pânico.', fx: { panicMult: 0.5 }, excl: ['cowardly'] },
    { id: 'eagleeyed', name: 'Olhos de águia', cost: 4, desc: 'Vê mais longe e com cone maior.', fx: { sight: 1.2 }, excl: ['shortsighted'] },
    { id: 'graceful', name: 'Gracioso', cost: 4, desc: 'Faz menos barulho ao andar.', fx: { noiseMult: 0.6 }, excl: ['clumsy'] },
    { id: 'inconspicuous', name: 'Discreto', cost: 4, desc: 'Zumbis demoram mais para notar você.', fx: { notice: 0.7 }, excl: ['conspicuous'] },
    { id: 'lighteater', name: 'Come pouco', cost: 4, desc: 'Fome aumenta mais devagar.', fx: { hungerMult: 0.75 }, excl: ['heartyappetite'] },
    { id: 'nutritionist', name: 'Nutricionista', cost: 4, desc: 'Vê calorias e nutrientes da comida.', fx: { nutrition: true } },
    { id: 'resilient', name: 'Resistente', cost: 4, desc: 'Menos doenças; a infecção avança mais devagar.', fx: { sickMult: 0.6 }, excl: ['proneillness'] },
    { id: 'runner', name: 'Corredor', cost: 4, desc: '+1 Corrida.', skills: { sprinting: 1 } },
    { id: 'irongut', name: 'Estômago de ferro', cost: 3, desc: 'Comida estragada faz menos mal.', fx: { poisonMult: 0.5 }, excl: ['weakstomach'] },
    { id: 'catseyes', name: 'Olhos de gato', cost: 2, desc: 'Enxerga melhor no escuro.', fx: { night: 1.5 } },
    { id: 'dextrous', name: 'Destro', cost: 2, desc: 'Mexe no inventário mais rápido.', fx: { invSpeed: 0.6 }, excl: ['allthumbs'] },
    { id: 'fastreader', name: 'Leitor rápido', cost: 2, desc: 'Lê livros mais rápido.', fx: { readSpeed: 0.7 }, excl: ['slowreader', 'illiterate'] },
    { id: 'outdoorsman', name: 'Mateiro', cost: 2, desc: 'Menos afetado por frio e chuva.', fx: { weather: 0.5 } },
    { id: 'wakeful', name: 'Desperto', cost: 2, desc: 'Precisa de menos sono.', fx: { fatigueMult: 0.7 }, excl: ['sleepyhead'] },
    { id: 'firstaider', name: 'Socorrista (hobby)', cost: 4, desc: '+1 Primeiros socorros.', skills: { firstAid: 1 } },
    { id: 'handy', name: 'Habilidoso (hobby)', cost: 8, desc: '+1 Carpintaria, +1 Manutenção; barrica mais rápido.', skills: { carpentry: 1, maintenance: 1 } },
    { id: 'gardener', name: 'Jardineiro (hobby)', cost: 4, desc: '+1 Agricultura.', skills: { farming: 1 } },
    { id: 'angler', name: 'Pescador (hobby)', cost: 4, desc: '+1 Pesca.', skills: { fishing: 1 } },
    { id: 'cook', name: 'Cozinheiro (hobby)', cost: 6, desc: '+2 Culinária.', skills: { cooking: 2 } },
    { id: 'brawler', name: 'Brigão', cost: 6, desc: '+1 Contundente longa, +1 Machado.', skills: { longBlunt: 1, axe: 1 } },
    { id: 'baseball', name: 'Jogador de beisebol', cost: 4, desc: '+1 Contundente longa.', skills: { longBlunt: 1 } },
    { id: 'hunter', name: 'Caçador', cost: 8, desc: '+1 Pontaria, +1 Furtividade, +1 Armadilhas, +1 Lâmina curta.', skills: { aiming: 1, sneaking: 1, trapping: 1, shortBlade: 1 } },
    { id: 'gymnast', name: 'Ginasta', cost: 5, desc: '+1 Agilidade, +1 Pés leves.', skills: { nimble: 1, lightfooted: 1 } },
    { id: 'tailor', name: 'Costureiro (hobby)', cost: 4, desc: '+1 Costura.', skills: { tailoring: 1 } },
    { id: 'herbalist', name: 'Herbalista', cost: 6, desc: '+1 Coleta; acha ervas medicinais.', skills: { foraging: 1 } },
    { id: 'speeddemon', name: 'Pé de chumbo', cost: 1, desc: 'Dirige mais rápido.', fx: {} },
    // ocultos (vêm de ocupações)
    { id: 'desensitized', name: 'Dessensibilizado', cost: 0, hidden: true, desc: 'Não entra em pânico.', fx: { panicMult: 0 } },
    { id: 'axeman', name: 'Lenhador nato', cost: 0, hidden: true, desc: 'Machado mais rápido, corta árvores rápido.', fx: { axeSpeed: 1.25 } },
    { id: 'nightowl', name: 'Coruja', cost: 0, hidden: true, desc: 'Dorme menos e acorda fácil.', fx: { fatigueMult: 0.85 } },
    { id: 'hotwire', name: 'Ligação direta', cost: 0, hidden: true, desc: 'Sabe fazer ligação direta em carros.', fx: {} },
    // negativos
    { id: 'deaf', name: 'Surdo', cost: -12, desc: 'Não percebe nada pelas costas.', fx: { hearing: 0.1 }, excl: ['keenhearing', 'hardofhearing'] },
    { id: 'obese', name: 'Obeso', cost: -10, desc: 'Lento e cansa rápido. Começa com 105 kg.', fx: { weight: 105, speedMult: 0.85 }, excl: ['athletic', 'fit', 'overweight', 'underweight', 'veryunderweight'] },
    { id: 'weak', name: 'Fraco', cost: -10, desc: '−5 Força.', skills: { strength: -5 }, excl: ['strong', 'stout', 'feeble'] },
    { id: 'unfit', name: 'Fora de forma', cost: -10, desc: '−4 Condicionamento.', skills: { fitness: -4 }, excl: ['athletic', 'fit', 'outofshape'] },
    { id: 'veryunderweight', name: 'Muito magro', cost: -10, desc: 'Fraco e frágil. Começa com 55 kg.', fx: { weight: 55 }, excl: ['obese', 'overweight', 'underweight'] },
    { id: 'illiterate', name: 'Analfabeto', cost: -8, desc: 'Não consegue ler livros.', fx: { illiterate: true }, excl: ['fastreader', 'slowreader'] },
    { id: 'thinskin', name: 'Pele fina', cost: -8, desc: 'Ferimentos acontecem com mais facilidade.', fx: { woundMult: 1.3 }, excl: ['thickskin'] },
    { id: 'outofshape', name: 'Sedentário', cost: -6, desc: '−2 Condicionamento.', skills: { fitness: -2 }, excl: ['athletic', 'fit', 'unfit'] },
    { id: 'feeble', name: 'Débil', cost: -6, desc: '−2 Força.', skills: { strength: -2 }, excl: ['strong', 'stout', 'weak'] },
    { id: 'overweight', name: 'Acima do peso', cost: -6, desc: 'Começa com 95 kg.', fx: { weight: 95, speedMult: 0.93 }, excl: ['obese', 'underweight', 'veryunderweight'] },
    { id: 'underweight', name: 'Abaixo do peso', cost: -6, desc: 'Começa com 62 kg.', fx: { weight: 62 }, excl: ['obese', 'overweight', 'veryunderweight'] },
    { id: 'slowlearner', name: 'Aprende devagar', cost: -6, desc: '−30% de XP.', fx: { xpMult: 0.7 }, excl: ['fastlearner'] },
    { id: 'slowhealer', name: 'Cura lenta', cost: -6, desc: 'Ferimentos demoram a sarar.', fx: { healMult: 0.6 }, excl: ['fasthealer'] },
    { id: 'highthirst', name: 'Muita sede', cost: -6, desc: 'Sede aumenta rápido.', fx: { thirstMult: 1.6 }, excl: ['lowthirst'] },
    { id: 'restless', name: 'Sono agitado', cost: -6, desc: 'Descansa menos dormindo.', fx: { sleepMult: 0.7 } },
    { id: 'asthmatic', name: 'Asmático', cost: -5, desc: 'Gasta fôlego mais rápido.', fx: { enduranceMult: 1.4 } },
    { id: 'hemophobic', name: 'Hemofóbico', cost: -5, desc: 'Pânico e estresse ao ver sangue; trata feridas devagar.', fx: { hemophobic: true } },
    { id: 'agoraphobic', name: 'Agorafóbico', cost: -4, desc: 'Pânico ao ar livre.', fx: { agoraphobic: true }, excl: ['claustrophobic'] },
    { id: 'claustrophobic', name: 'Claustrofóbico', cost: -4, desc: 'Pânico dentro de construções.', fx: { claustrophobic: true }, excl: ['agoraphobic'] },
    { id: 'conspicuous', name: 'Chamativo', cost: -4, desc: 'Zumbis notam você mais fácil.', fx: { notice: 1.4 }, excl: ['inconspicuous'] },
    { id: 'disorganized', name: 'Desorganizado', cost: -4, desc: '−30% de capacidade em mochilas.', fx: { bagCap: 0.7 }, excl: ['organized'] },
    { id: 'hardofhearing', name: 'Meio surdo', cost: -4, desc: 'Ouve menos ao redor.', fx: { hearing: 0.6 }, excl: ['deaf', 'keenhearing'] },
    { id: 'heartyappetite', name: 'Comilão', cost: -4, desc: 'Fome aumenta rápido.', fx: { hungerMult: 1.35 }, excl: ['lighteater'] },
    { id: 'pacifist', name: 'Pacifista', cost: -4, desc: '−25% de XP em combate.', fx: { combatXp: 0.75 } },
    { id: 'proneillness', name: 'Propenso a doenças', cost: -4, desc: 'Fica doente fácil.', fx: { sickMult: 1.6 }, excl: ['resilient'] },
    { id: 'sleepyhead', name: 'Dorminhoco', cost: -4, desc: 'Precisa de mais sono.', fx: { fatigueMult: 1.3 }, excl: ['wakeful'] },
    { id: 'smoker', name: 'Fumante', cost: -4, desc: 'Fica estressado sem cigarro.', fx: { smoker: true }, excl: ['athletic'] },
    { id: 'weakstomach', name: 'Estômago fraco', cost: -3, desc: 'Intoxica fácil com comida ruim.', fx: { poisonMult: 1.6 }, excl: ['irongut'] },
    { id: 'shortsighted', name: 'Míope', cost: -2, desc: 'Visão mais curta.', fx: { sight: 0.75 }, excl: ['eagleeyed'] },
    { id: 'clumsy', name: 'Desastrado', cost: -2, desc: 'Faz mais barulho ao andar.', fx: { noiseMult: 1.5 }, excl: ['graceful'] },
    { id: 'cowardly', name: 'Covarde', cost: -2, desc: 'Entra em pânico fácil.', fx: { panicMult: 1.6 }, excl: ['brave'] },
    { id: 'allthumbs', name: 'Mãos de manteiga', cost: -2, desc: 'Mexe no inventário devagar.', fx: { invSpeed: 1.5 }, excl: ['dextrous'] },
    { id: 'slowreader', name: 'Leitor lento', cost: -2, desc: 'Lê devagar.', fx: { readSpeed: 1.4 }, excl: ['fastreader', 'illiterate'] },
    { id: 'sundaydriver', name: 'Motorista de domingo', cost: -1, desc: 'Dirige devagar.', fx: {} }
  ];
  D.TRAIT = {};
  D.TRAITS.forEach(function (t) { D.TRAIT[t.id] = t; });

  /* ================= CORPO ================= */
  D.BODY_PARTS = [
    { id: 'head', name: 'Cabeça', w: 3, vital: 3 }, { id: 'neck', name: 'Pescoço', w: 4, vital: 3 },
    { id: 'torso', name: 'Tronco', w: 8, vital: 2 }, { id: 'belly', name: 'Barriga', w: 5, vital: 2 }, { id: 'groin', name: 'Virilha', w: 2, vital: 1.5 },
    { id: 'uarmL', name: 'Braço esq.', w: 6, vital: 1 }, { id: 'uarmR', name: 'Braço dir.', w: 6, vital: 1 },
    { id: 'farmL', name: 'Antebraço esq.', w: 10, vital: 1 }, { id: 'farmR', name: 'Antebraço dir.', w: 10, vital: 1 },
    { id: 'handL', name: 'Mão esq.', w: 9, vital: 0.8 }, { id: 'handR', name: 'Mão dir.', w: 9, vital: 0.8 },
    { id: 'thighL', name: 'Coxa esq.', w: 4, vital: 1 }, { id: 'thighR', name: 'Coxa dir.', w: 4, vital: 1 },
    { id: 'shinL', name: 'Canela esq.', w: 5, vital: 1 }, { id: 'shinR', name: 'Canela dir.', w: 5, vital: 1 },
    { id: 'footL', name: 'Pé esq.', w: 2, vital: 0.8 }, { id: 'footR', name: 'Pé dir.', w: 2, vital: 0.8 }
  ];
  D.PART = {};
  D.BODY_PARTS.forEach(function (p) { D.PART[p.id] = p; });
  D.WOUND_NAMES = { scratch: 'Arranhão', laceration: 'Corte', deep: 'Ferida profunda', bite: 'Mordida', fracture: 'Fratura', burn: 'Queimadura', glass: 'Caco de vidro', bullet: 'Bala alojada' };

  /* ================= ITENS ================= */
  var I = {};
  D.ITEMS = I;
  function def(id, o) { o.id = id; I[id] = o; }
  /* ---- armas brancas ---- */
  function weapon(id, name, icon, w, type, skill, dmin, dmax, opts) {
    var o = { name: name, icon: icon, w: w, cat: 'weapon', weapon: { type: type, skill: skill, dmin: dmin, dmax: dmax, range: 1.1, arc: 80, hits: 1, cd: 0.9, end: 0.03, crit: 0.08, cond: 12, lower: 15, knock: 0.3 } };
    for (var k in opts) { if (k === 'tags') { o.tags = opts.tags; } else { o.weapon[k] = opts[k]; } }
    def(id, o);
  }
  weapon('bat', 'Taco de beisebol', '🏏', 1.6, 'blunt_long', 'longBlunt', 0.7, 1.25, { range: 1.35, arc: 110, hits: 2, cd: 1.0, end: 0.035, crit: 0.1, cond: 14, lower: 20, knock: 0.6 });
  weapon('bat_nails', 'Taco com pregos', '🏏', 1.8, 'blunt_long', 'longBlunt', 0.9, 1.5, { range: 1.35, arc: 110, hits: 2, cd: 1.05, end: 0.037, crit: 0.14, cond: 12, lower: 14, knock: 0.6 });
  weapon('crowbar', 'Pé de cabra', '🔧', 2.0, 'blunt_long', 'longBlunt', 0.6, 1.1, { range: 1.25, arc: 95, hits: 1, cd: 0.95, cond: 25, lower: 35, knock: 0.5, tags: ['crowbar'] });
  weapon('golfclub', 'Taco de golfe', '🏌️', 1.2, 'blunt_long', 'longBlunt', 0.5, 1.0, { range: 1.35, arc: 100, hits: 2, cd: 0.9, cond: 8, lower: 10 });
  weapon('shovel', 'Pá', '🪏', 2.2, 'blunt_long', 'longBlunt', 0.7, 1.3, { range: 1.45, arc: 100, hits: 2, cd: 1.15, end: 0.045, cond: 14, lower: 16, knock: 0.6, tags: ['shovel'] });
  weapon('sledge', 'Marreta', '🔨', 5.0, 'blunt_long', 'longBlunt', 2.0, 4.0, { range: 1.35, arc: 120, hits: 3, cd: 2.1, end: 0.09, crit: 0.2, cond: 30, lower: 40, knock: 1.4, twoHand: true, tags: ['sledge'] });
  weapon('hammer', 'Martelo', '🔨', 1.0, 'blunt_short', 'shortBlunt', 0.5, 1.0, { range: 1.0, arc: 70, cd: 0.75, end: 0.022, crit: 0.1, cond: 20, lower: 25, knock: 0.3, tags: ['hammer'] });
  weapon('wrench', 'Chave de roda', '🔧', 1.4, 'blunt_short', 'shortBlunt', 0.6, 1.1, { range: 1.0, arc: 70, cd: 0.85, cond: 22, lower: 30, tags: ['wrench'] });
  weapon('pan', 'Frigideira', '🍳', 1.2, 'blunt_short', 'shortBlunt', 0.6, 1.05, { range: 1.0, arc: 70, cd: 0.85, cond: 14, lower: 18, tags: ['pan'] });
  weapon('pipe', 'Cano de metal', '🔩', 1.8, 'blunt_long', 'longBlunt', 0.7, 1.2, { range: 1.3, arc: 95, hits: 2, cd: 1.0, cond: 18, lower: 25 });
  weapon('nightstick', 'Cassetete', '🦯', 0.8, 'blunt_short', 'shortBlunt', 0.6, 1.1, { range: 1.05, arc: 70, cd: 0.7, crit: 0.12, cond: 20, lower: 30 });
  weapon('plank_w', 'Tábua (arma)', '🪵', 1.0, 'blunt_long', 'longBlunt', 0.4, 0.8, { range: 1.3, arc: 100, hits: 2, cd: 0.95, cond: 6, lower: 6 });
  weapon('axe', 'Machado', '🪓', 2.4, 'axe', 'axe', 1.0, 2.0, { range: 1.25, arc: 100, hits: 2, cd: 1.15, end: 0.05, crit: 0.15, cond: 14, lower: 20, knock: 0.7, twoHand: true, tags: ['axe', 'chop'] });
  weapon('hatchet', 'Machadinha', '🪓', 1.2, 'axe', 'axe', 0.7, 1.4, { range: 1.0, arc: 80, cd: 0.85, end: 0.03, crit: 0.12, cond: 12, lower: 16, tags: ['axe', 'chop'] });
  weapon('fireaxe', 'Machado de bombeiro', '🪓', 3.0, 'axe', 'axe', 1.3, 2.3, { range: 1.3, arc: 110, hits: 2, cd: 1.3, end: 0.06, crit: 0.2, cond: 18, lower: 25, knock: 0.8, twoHand: true, tags: ['axe', 'chop', 'crowbar'] });
  weapon('machete', 'Facão', '🗡️', 1.0, 'blade_long', 'longBlade', 1.0, 2.0, { range: 1.25, arc: 90, cd: 0.85, end: 0.03, crit: 0.2, cond: 12, lower: 18, tags: ['knife', 'chop'] });
  weapon('katana', 'Katana', '⚔️', 1.2, 'blade_long', 'longBlade', 1.6, 2.4, { range: 1.4, arc: 100, cd: 0.9, end: 0.03, crit: 0.3, cond: 14, lower: 22, twoHand: true });
  weapon('knife', 'Faca de cozinha', '🔪', 0.3, 'blade_short', 'shortBlade', 0.3, 0.7, { range: 0.9, arc: 50, cd: 0.55, end: 0.015, crit: 0.35, cond: 6, lower: 10, tags: ['knife'] });
  weapon('huntknife', 'Faca de caça', '🔪', 0.4, 'blade_short', 'shortBlade', 0.5, 1.0, { range: 0.95, arc: 55, cd: 0.6, end: 0.018, crit: 0.4, cond: 14, lower: 20, tags: ['knife'] });
  weapon('screwdriver', 'Chave de fenda', '🪛', 0.3, 'blade_short', 'shortBlade', 0.3, 0.6, { range: 0.85, arc: 45, cd: 0.55, crit: 0.3, cond: 8, lower: 10, tags: ['screwdriver'] });
  weapon('spear', 'Lança improvisada', '🗡️', 1.5, 'spear', 'spear', 0.8, 1.6, { range: 1.75, arc: 40, cd: 1.0, end: 0.035, crit: 0.3, cond: 8, lower: 8, twoHand: true });
  weapon('spear_knife', 'Lança com faca', '🗡️', 1.6, 'spear', 'spear', 1.0, 2.0, { range: 1.8, arc: 40, cd: 1.0, end: 0.035, crit: 0.4, cond: 12, lower: 12, twoHand: true });
  weapon('saw', 'Serrote', '🪚', 0.8, 'blade_short', 'shortBlade', 0.3, 0.6, { range: 0.95, arc: 60, cd: 0.8, cond: 10, lower: 10, tags: ['saw'] });
  weapon('trowel', 'Pá de jardim', '🥄', 0.4, 'blade_short', 'shortBlade', 0.2, 0.5, { range: 0.85, arc: 50, cd: 0.6, cond: 8, lower: 10, tags: ['trowel'] });
  /* ---- armas de fogo ---- */
  function gun(id, name, icon, w, type, o) {
    def(id, { name: name, icon: icon, w: w, cat: 'firearm', gun: o, weapon: { type: type, skill: 'aiming', dmin: 0.2, dmax: 0.5, range: 1.0, arc: 60, hits: 1, cd: 0.9, end: 0.03, crit: 0.05, cond: 30, lower: 30, knock: 0.4, twoHand: o.twoHand } });
  }
  gun('pistol', 'Pistola 9mm', '🔫', 1.0, 'pistol', { ammo: 'ammo9', mag: 15, dmin: 0.8, dmax: 1.5, range: 12, acc: 0.7, noise: 50, cd: 0.45, reload: 2.2 });
  gun('revolver', 'Revólver .38', '🔫', 1.1, 'pistol', { ammo: 'ammo38', mag: 6, dmin: 1.0, dmax: 1.8, range: 12, acc: 0.72, noise: 55, cd: 0.6, reload: 3.0 });
  gun('shotgun', 'Espingarda', '🔫', 3.3, 'shotgun', { ammo: 'shells', mag: 6, dmin: 1.2, dmax: 2.4, range: 8, acc: 0.85, noise: 80, cd: 1.1, reload: 3.6, pellets: 4, spread: 0.35, twoHand: true });
  gun('rifle', 'Rifle de caça', '🔫', 3.6, 'rifle', { ammo: 'ammo308', mag: 5, dmin: 2.0, dmax: 3.5, range: 22, acc: 0.82, noise: 85, cd: 1.4, reload: 3.8, twoHand: true });
  /* ---- munição ---- */
  def('ammo9', { name: 'Balas 9mm', icon: '🟡', w: 0.01, cat: 'ammo', stack: 200 });
  def('ammo38', { name: 'Balas .38', icon: '🟡', w: 0.01, cat: 'ammo', stack: 200 });
  def('shells', { name: 'Cartuchos calibre 12', icon: '🔴', w: 0.03, cat: 'ammo', stack: 100 });
  def('ammo308', { name: 'Balas .308', icon: '🟠', w: 0.02, cat: 'ammo', stack: 100 });
  /* ---- comida ---- fresh/rot em dias; hunger = quanto reduz a fome (0..1); cal = calorias */
  function food(id, name, icon, w, hunger, cal, o) {
    var f = { name: name, icon: icon, w: w, cat: 'food', food: { hunger: hunger, cal: cal, thirst: 0, boredom: 0, unhappy: 0, fresh: 0, rot: 0 } };
    for (var k in o) { if (k === 'tags') { f.tags = o.tags; } else { f.food[k] = o[k]; } }
    def(id, f);
  }
  food('beans', 'Feijão enlatado', '🥫', 0.6, 0.2, 400, { canned: true, opens: 'beans_open', boredom: 0.02 });
  food('beans_open', 'Feijão (lata aberta)', '🥫', 0.6, 0.2, 400, { fresh: 2, rot: 4, boredom: 0.02 });
  food('soup', 'Sopa enlatada', '🥫', 0.6, 0.18, 300, { canned: true, opens: 'soup_open', thirst: -0.05 });
  food('soup_open', 'Sopa (lata aberta)', '🥫', 0.6, 0.18, 300, { fresh: 2, rot: 4, thirst: -0.05 });
  food('tuna', 'Atum enlatado', '🐟', 0.3, 0.12, 200, { canned: true, opens: 'tuna_open' });
  food('tuna_open', 'Atum (lata aberta)', '🐟', 0.3, 0.12, 200, { fresh: 1, rot: 3 });
  food('corn', 'Milho enlatado', '🌽', 0.5, 0.14, 250, { canned: true, opens: 'corn_open' });
  food('corn_open', 'Milho (lata aberta)', '🌽', 0.5, 0.14, 250, { fresh: 2, rot: 4 });
  food('chips', 'Batata chips', '🥔', 0.1, 0.08, 280, { thirst: 0.04, unhappy: -0.05, boredom: -0.05 });
  food('candy', 'Barra de chocolate', '🍫', 0.1, 0.06, 250, { unhappy: -0.12, boredom: -0.05 });
  food('crackers', 'Bolachas', '🍪', 0.2, 0.1, 300, { thirst: 0.03 });
  food('cereal', 'Cereal', '🥣', 0.4, 0.15, 450, {});
  food('peanutbutter', 'Pasta de amendoim', '🥜', 0.5, 0.2, 900, { thirst: 0.05 });
  food('bread', 'Pão', '🍞', 0.3, 0.15, 350, { fresh: 3, rot: 6 });
  food('apple', 'Maçã', '🍎', 0.2, 0.08, 95, { fresh: 6, rot: 12, thirst: -0.02 });
  food('banana', 'Banana', '🍌', 0.2, 0.08, 105, { fresh: 4, rot: 8 });
  food('orange', 'Laranja', '🍊', 0.2, 0.07, 70, { fresh: 8, rot: 14, thirst: -0.04 });
  food('carrot', 'Cenoura', '🥕', 0.15, 0.06, 40, { fresh: 8, rot: 16 });
  food('potato', 'Batata', '🥔', 0.3, 0.1, 160, { fresh: 20, rot: 40, cookable: 'potato_baked' });
  food('potato_baked', 'Batata assada', '🥔', 0.3, 0.16, 200, { fresh: 3, rot: 6, unhappy: -0.03 });
  food('tomato', 'Tomate', '🍅', 0.15, 0.05, 25, { fresh: 5, rot: 10, thirst: -0.03 });
  food('cabbage', 'Repolho', '🥬', 0.5, 0.1, 50, { fresh: 8, rot: 16 });
  food('lettuce', 'Alface', '🥬', 0.3, 0.06, 15, { fresh: 3, rot: 6 });
  food('steak', 'Bife cru', '🥩', 0.4, 0.2, 500, { fresh: 2, rot: 4, raw: true, cookable: 'steak_cooked' });
  food('steak_cooked', 'Bife grelhado', '🥩', 0.4, 0.28, 600, { fresh: 2, rot: 5, unhappy: -0.15, boredom: -0.1 });
  food('chicken', 'Frango cru', '🍗', 0.5, 0.2, 450, { fresh: 2, rot: 4, raw: true, cookable: 'chicken_cooked' });
  food('chicken_cooked', 'Frango assado', '🍗', 0.5, 0.28, 550, { fresh: 2, rot: 5, unhappy: -0.12 });
  food('fish', 'Peixe cru', '🐟', 0.4, 0.15, 300, { fresh: 1, rot: 3, raw: true, cookable: 'fish_cooked' });
  food('fish_cooked', 'Peixe assado', '🐟', 0.4, 0.22, 350, { fresh: 2, rot: 4, unhappy: -0.08 });
  food('egg', 'Ovo', '🥚', 0.06, 0.05, 80, { fresh: 10, rot: 20, raw: true, cookable: 'egg_cooked' });
  food('egg_cooked', 'Ovo cozido', '🥚', 0.06, 0.07, 80, { fresh: 3, rot: 6 });
  food('cheese', 'Queijo', '🧀', 0.3, 0.12, 400, { fresh: 8, rot: 16 });
  food('milk', 'Leite', '🥛', 1.0, 0.08, 400, { fresh: 3, rot: 6, thirst: -0.25 });
  food('icecream', 'Sorvete', '🍨', 0.5, 0.1, 500, { fresh: 1, rot: 2, unhappy: -0.25, boredom: -0.1 });
  food('pizza', 'Pizza congelada', '🍕', 0.6, 0.25, 900, { fresh: 4, rot: 8, cookable: 'pizza_cooked' });
  food('pizza_cooked', 'Pizza', '🍕', 0.6, 0.3, 900, { fresh: 2, rot: 4, unhappy: -0.25, boredom: -0.15 });
  food('berries', 'Frutas silvestres', '🫐', 0.1, 0.04, 50, { fresh: 2, rot: 4 });
  food('mushroom', 'Cogumelos', '🍄', 0.1, 0.04, 30, { fresh: 2, rot: 4 });
  food('stew', 'Ensopado', '🍲', 1.0, 0.45, 900, { fresh: 3, rot: 6, unhappy: -0.2, boredom: -0.15, thirst: -0.1 });
  food('dogfood', 'Ração de cachorro', '🥫', 0.6, 0.2, 500, { canned: true, opens: 'dogfood_open', unhappy: 0.2, boredom: 0.1 });
  food('dogfood_open', 'Ração (aberta)', '🥫', 0.6, 0.2, 500, { fresh: 2, rot: 4, unhappy: 0.2, boredom: 0.1 });
  food('rice', 'Arroz cru', '🍚', 1.0, 0.1, 1300, { needsCooking: true });
  food('pasta', 'Macarrão cru', '🍝', 0.5, 0.1, 700, { needsCooking: true });
  /* ---- bebidas ---- (uses = goles) */
  function drink(id, name, icon, w, thirst, uses, o) {
    var d = { name: name, icon: icon, w: w, cat: 'drink', drink: { thirst: thirst, uses: uses, unhappy: 0, cal: 0 } };
    for (var k in o) { if (k === 'tags') { d.tags = o.tags; } else { d.drink[k] = o[k]; } }
    def(id, d);
  }
  drink('water_bottle', 'Garrafa d\'água', '🧴', 0.6, 0.3, 4, { refill: true, tags: ['bottle'] });
  drink('soda', 'Refrigerante', '🥤', 0.4, 0.25, 2, { unhappy: -0.08, cal: 140 });
  drink('juice', 'Suco de caixinha', '🧃', 0.3, 0.2, 2, { cal: 110 });
  drink('beer', 'Cerveja', '🍺', 0.4, 0.15, 2, { unhappy: -0.15, drunk: 0.15, cal: 150 });
  drink('whiskey', 'Uísque', '🥃', 1.0, 0.05, 6, { unhappy: -0.15, drunk: 0.25, cal: 100 });
  drink('water_dirty', 'Água suja', '🫗', 0.6, 0.3, 4, { refill: true, dirty: true, tags: ['bottle'] });
  def('bottle_empty', { name: 'Garrafa vazia', icon: '🧴', w: 0.1, cat: 'misc', tags: ['bottle', 'empty_bottle'] });
  def('pot', { name: 'Panela', icon: '🍲', w: 1.0, cat: 'tool', tags: ['pot'] });
  def('pot_water', { name: 'Panela com água', icon: '🍲', w: 3.0, cat: 'tool', tags: ['pot'], potWater: true });
  /* ---- médicos ---- */
  def('bandage', { name: 'Bandagem', icon: '🩹', w: 0.1, cat: 'medical', med: { type: 'bandage', quality: 1 } });
  def('rag', { name: 'Pano rasgado', icon: '🧻', w: 0.05, cat: 'medical', med: { type: 'bandage', quality: 0.5 }, stack: 0 });
  def('rag_sterile', { name: 'Pano esterilizado', icon: '🧻', w: 0.05, cat: 'medical', med: { type: 'bandage', quality: 0.9, sterile: true } });
  def('disinfectant', { name: 'Desinfetante', icon: '🧪', w: 0.3, cat: 'medical', med: { type: 'disinfect', uses: 10 } });
  def('alcohol_wipes', { name: 'Lenços com álcool', icon: '🧻', w: 0.05, cat: 'medical', med: { type: 'disinfect', uses: 1 } });
  def('painkillers', { name: 'Analgésicos', icon: '💊', w: 0.1, cat: 'medical', med: { type: 'pain', uses: 10 } });
  def('antibiotics', { name: 'Antibióticos', icon: '💊', w: 0.1, cat: 'medical', med: { type: 'antibiotic', uses: 5 } });
  def('betablockers', { name: 'Betabloqueadores', icon: '💊', w: 0.1, cat: 'medical', med: { type: 'panic', uses: 10 } });
  def('antidepressants', { name: 'Antidepressivos', icon: '💊', w: 0.1, cat: 'medical', med: { type: 'happy', uses: 10 } });
  def('sleeping_pills', { name: 'Remédio para dormir', icon: '💊', w: 0.1, cat: 'medical', med: { type: 'sleep', uses: 10 } });
  def('suture_needle', { name: 'Agulha de sutura', icon: '🪡', w: 0.05, cat: 'medical', med: { type: 'suture', uses: 4 } });
  def('tweezers', { name: 'Pinça', icon: '🔧', w: 0.05, cat: 'medical', med: { type: 'tweezers' } });
  def('splint', { name: 'Tala', icon: '🩼', w: 0.3, cat: 'medical', med: { type: 'splint' } });
  def('thread', { name: 'Linha', icon: '🧵', w: 0.05, cat: 'material', tags: ['thread'] });
  def('needle', { name: 'Agulha', icon: '🪡', w: 0.02, cat: 'tool', tags: ['needle'] });
  def('cigarettes', { name: 'Cigarros', icon: '🚬', w: 0.1, cat: 'misc', smoke: { uses: 20 } });
  /* ---- ferramentas ---- */
  def('canopener', { name: 'Abridor de latas', icon: '🥫', w: 0.2, cat: 'tool', tags: ['canopener'] });
  def('lighter', { name: 'Isqueiro', icon: '🔥', w: 0.1, cat: 'tool', tags: ['lighter'], uses: 30 });
  def('matches', { name: 'Fósforos', icon: '🔥', w: 0.05, cat: 'tool', tags: ['lighter'], uses: 10 });
  def('flashlight', { name: 'Lanterna', icon: '🔦', w: 0.5, cat: 'tool', light: { r: 11, battery: 1 }, tags: ['flashlight'] });
  def('battery', { name: 'Pilha', icon: '🔋', w: 0.05, cat: 'misc', tags: ['battery'] });
  def('radio', { name: 'Rádio portátil', icon: '📻', w: 0.8, cat: 'electronics', tags: ['radio'] });
  def('nails', { name: 'Pregos', icon: '📌', w: 0.005, cat: 'material', stack: 200, tags: ['nails'] });
  def('screws', { name: 'Parafusos', icon: '🔩', w: 0.005, cat: 'material', stack: 200, tags: ['screws'] });
  def('plank', { name: 'Tábua', icon: '🪵', w: 1.0, cat: 'material', tags: ['plank'], asWeapon: 'plank_w' });
  def('log', { name: 'Tora', icon: '🪵', w: 6.0, cat: 'material', tags: ['log'] });
  def('sheet', { name: 'Lençol', icon: '🛏️', w: 0.5, cat: 'material', tags: ['sheet', 'rippable'] });
  def('rope', { name: 'Corda', icon: '🪢', w: 0.4, cat: 'material', tags: ['rope'] });
  def('sheet_rope', { name: 'Corda de lençol', icon: '🪢', w: 0.6, cat: 'material', tags: ['rope'] });
  def('scrap', { name: 'Sucata de metal', icon: '🔩', w: 0.8, cat: 'material', tags: ['scrap'] });
  def('metal_sheet', { name: 'Chapa de metal', icon: '⬜', w: 3.0, cat: 'material', tags: ['metal_sheet'] });
  def('gas_can', { name: 'Galão de gasolina', icon: '⛽', w: 5.0, cat: 'tool', tags: ['gas'], fuel: 10 });
  def('gas_can_empty', { name: 'Galão vazio', icon: '⛽', w: 0.5, cat: 'tool', tags: ['gas_empty'] });
  def('seeds_carrot', { name: 'Sementes de cenoura', icon: '🌱', w: 0.05, cat: 'seed', seed: { crop: 'carrot', days: 14, yield: [3, 6] }, stack: 50 });
  def('seeds_potato', { name: 'Sementes de batata', icon: '🌱', w: 0.05, cat: 'seed', seed: { crop: 'potato', days: 20, yield: [3, 6] }, stack: 50 });
  def('seeds_tomato', { name: 'Sementes de tomate', icon: '🌱', w: 0.05, cat: 'seed', seed: { crop: 'tomato', days: 16, yield: [4, 8] }, stack: 50 });
  def('seeds_cabbage', { name: 'Sementes de repolho', icon: '🌱', w: 0.05, cat: 'seed', seed: { crop: 'cabbage', days: 12, yield: [2, 4] }, stack: 50 });
  def('fishing_rod', { name: 'Vara de pescar', icon: '🎣', w: 1.0, cat: 'tool', tags: ['fishing_rod'] });
  def('bucket', { name: 'Balde', icon: '🪣', w: 1.0, cat: 'tool', tags: ['bucket'] });
  def('watering_can', { name: 'Regador', icon: '🚿', w: 0.8, cat: 'tool', tags: ['watering'], water: 10 });
  def('generator_item', { name: 'Gerador portátil', icon: '⚡', w: 30, cat: 'tool', tags: ['generator'] });
  def('map', { name: 'Mapa da região', icon: '🗺️', w: 0.05, cat: 'misc', tags: ['map'] });
  def('car_key', { name: 'Chave de carro', icon: '🔑', w: 0.02, cat: 'misc' });
  def('molotov', { name: 'Coquetel molotov', icon: '🍾', w: 0.8, cat: 'throwable', throwable: { fire: true, noise: 20 } });
  def('empty_beer', { name: 'Garrafa de vidro', icon: '🍾', w: 0.3, cat: 'throwable', throwable: { noise: 18 }, tags: ['glass_bottle'] });
  def('alarm_clock', { name: 'Despertador', icon: '⏰', w: 0.3, cat: 'throwable', throwable: { noise: 25, alarm: true } });
  def('watch', { name: 'Relógio de pulso', icon: '⌚', w: 0.05, cat: 'misc', tags: ['watch'] });
  def('wallet', { name: 'Carteira', icon: '👛', w: 0.1, cat: 'junk' });
  def('photo', { name: 'Foto de família', icon: '🖼️', w: 0.02, cat: 'junk', leisure: { unhappy: 0.05 } });
  def('toy', { name: 'Brinquedo', icon: '🧸', w: 0.2, cat: 'junk' });
  def('keyring', { name: 'Molho de chaves', icon: '🔑', w: 0.05, cat: 'junk' });
  /* ---- livros/revistas ---- */
  var BOOK_SKILLS = ['carpentry', 'cooking', 'farming', 'firstAid', 'electrical', 'metalworking', 'mechanics', 'tailoring', 'fishing', 'trapping', 'foraging'];
  BOOK_SKILLS.forEach(function (sk) {
    for (var v = 1; v <= 5; v++) {
      def('book_' + sk + '_' + v, { name: D.SKILL[sk].name + ' vol. ' + v, icon: '📘', w: 0.8, cat: 'book', book: { skill: sk, vol: v, pages: 160 + v * 60 } });
    }
  });
  def('novel', { name: 'Romance de bolso', icon: '📕', w: 0.4, cat: 'book', leisure: { boredom: -0.5, unhappy: -0.25, stress: -0.1, pages: 200 } });
  def('magazine', { name: 'Revista', icon: '📰', w: 0.2, cat: 'book', leisure: { boredom: -0.25, unhappy: -0.15, pages: 40 } });
  def('comic', { name: 'Gibi', icon: '📗', w: 0.1, cat: 'book', leisure: { boredom: -0.3, unhappy: -0.2, pages: 30 } });
  def('newspaper', { name: 'Jornal', icon: '📰', w: 0.3, cat: 'book', leisure: { boredom: -0.15, unhappy: 0.02, pages: 30 }, news: true });
  def('mag_recipes', { name: 'Revista de culinária', icon: '📙', w: 0.2, cat: 'book', recipe: ['stew'], leisure: { boredom: -0.2, pages: 40 } });
  def('mag_molotov', { name: 'Revista de sobrevivência', icon: '📙', w: 0.2, cat: 'book', recipe: ['molotov', 'spear_knife'], leisure: { boredom: -0.2, pages: 40 } });
  def('mag_carpentry', { name: 'Revista Faça Você Mesmo', icon: '📙', w: 0.2, cat: 'book', recipe: ['rain_barrel', 'bat_nails'], leisure: { boredom: -0.2, pages: 40 } });
  /* ---- roupas ---- parts: partes cobertas; bite/scratch: defesa 0..100; ins: isolamento */
  function cloth(id, name, icon, w, slot, parts, bite, scratch, ins, colors, o) {
    var c = { name: name, icon: icon, w: w, cat: 'clothing', cloth: { slot: slot, parts: parts, bite: bite, scratch: scratch, ins: ins, colors: colors || null } };
    if (o) { for (var k in o) { c.cloth[k] = o[k]; } }
    def(id, c);
  }
  var TORSO = ['torso', 'belly'], ARMS_U = ['uarmL', 'uarmR'], ARMS = ['uarmL', 'uarmR', 'farmL', 'farmR'], LEGS = ['groin', 'thighL', 'thighR', 'shinL', 'shinR'];
  cloth('tshirt', 'Camiseta', '👕', 0.15, 'shirt', TORSO.concat(ARMS_U), 0, 10, 0.1, ['#3d5a80', '#e0e0e0', '#bc4749', '#6a994e', '#2b2d42', '#e9c46a', '#8d99ae']);
  cloth('shirt', 'Camisa social', '👔', 0.25, 'shirt', TORSO.concat(ARMS), 0, 15, 0.2, ['#f2e8cf', '#98c1d9', '#ffffff', '#d4a373']);
  cloth('sweater', 'Suéter', '🧶', 0.6, 'shirt', TORSO.concat(ARMS), 2, 25, 0.55, ['#606c38', '#9f86c0', '#bc4749', '#264653']);
  cloth('tanktop', 'Regata', '🎽', 0.1, 'shirt', TORSO, 0, 5, 0.05, ['#ffffff', '#2b2d42', '#e76f51']);
  cloth('jacket', 'Jaqueta', '🧥', 1.0, 'jacket', ['torso', 'belly', 'neck'].concat(ARMS), 10, 40, 0.6, ['#2a3a4a', '#3a2a1a', '#4a4a3a', '#5a2a2a']);
  cloth('leather_jacket', 'Jaqueta de couro', '🧥', 1.6, 'jacket', ['torso', 'belly', 'neck'].concat(ARMS), 30, 70, 0.7, ['#1e1a18', '#3a2418']);
  cloth('hoodie', 'Moletom', '🧥', 0.8, 'jacket', ['torso', 'belly'].concat(ARMS), 5, 30, 0.6, ['#5a5a5a', '#2a4a6a', '#6a2a3a', '#3a5a3a']);
  cloth('police_jacket', 'Jaqueta de policial', '🧥', 1.2, 'jacket', ['torso', 'belly', 'neck'].concat(ARMS), 20, 50, 0.6, ['#1f2a44']);
  cloth('fire_jacket', 'Casaco de bombeiro', '🧥', 2.5, 'jacket', ['torso', 'belly', 'neck', 'groin'].concat(ARMS), 40, 80, 0.9, ['#c8a03a']);
  cloth('vest', 'Colete à prova de balas', '🦺', 3.0, 'vest', TORSO, 60, 90, 0.3, ['#3a4a3a']);
  cloth('jeans', 'Calça jeans', '👖', 0.6, 'pants', LEGS, 5, 35, 0.3, ['#2f4f7f', '#3a5a8a', '#1f2f4f', '#4a4a4a']);
  cloth('pants', 'Calça social', '👖', 0.4, 'pants', LEGS, 0, 20, 0.3, ['#2b2d42', '#5a4a3a', '#3a3a3a', '#8a7a5a']);
  cloth('shorts', 'Bermuda', '🩳', 0.2, 'pants', ['groin', 'thighL', 'thighR'], 0, 10, 0.1, ['#8d99ae', '#d4a373', '#3d5a80']);
  cloth('skirt', 'Saia', '👗', 0.2, 'pants', ['groin', 'thighL', 'thighR'], 0, 5, 0.1, ['#9f86c0', '#2b2d42', '#bc4749']);
  cloth('police_pants', 'Calça de policial', '👖', 0.5, 'pants', LEGS, 5, 30, 0.3, ['#1f2a44']);
  cloth('sneakers', 'Tênis', '👟', 0.5, 'shoes', ['footL', 'footR'], 10, 30, 0.1, ['#e0e0e0', '#2b2d42', '#bc4749']);
  cloth('boots', 'Botas de couro', '🥾', 1.2, 'shoes', ['footL', 'footR', 'shinL', 'shinR'], 50, 70, 0.3, ['#3a2418', '#1e1a18']);
  cloth('shoes', 'Sapatos', '👞', 0.6, 'shoes', ['footL', 'footR'], 10, 25, 0.1, ['#1e1a18', '#5a3a1a']);
  cloth('gloves', 'Luvas de trabalho', '🧤', 0.2, 'gloves', ['handL', 'handR'], 20, 60, 0.2, ['#8a6a3a']);
  cloth('leather_gloves', 'Luvas de couro', '🧤', 0.2, 'gloves', ['handL', 'handR'], 30, 70, 0.3, ['#1e1a18']);
  cloth('cap', 'Boné', '🧢', 0.1, 'hat', ['head'], 0, 5, 0.05, ['#bc4749', '#3d5a80', '#2b2d42', '#e9c46a']);
  cloth('helmet', 'Capacete de moto', '⛑️', 1.5, 'hat', ['head', 'neck'], 60, 90, 0.3, ['#2b2d42', '#bc4749']);
  cloth('beanie', 'Gorro', '🧶', 0.1, 'hat', ['head'], 0, 10, 0.3, ['#264653', '#9a3a3a']);
  cloth('scarf', 'Cachecol', '🧣', 0.2, 'neck', ['neck'], 5, 30, 0.3, ['#9a3a3a', '#3a5a8a']);
  cloth('dress', 'Vestido', '👗', 0.3, 'shirt', TORSO.concat(['groin', 'thighL', 'thighR']), 0, 10, 0.15, ['#9f86c0', '#bc4749', '#2a9d8f', '#f2e8cf']);
  cloth('scrubs', 'Jaleco hospitalar', '🥼', 0.3, 'jacket', TORSO.concat(ARMS_U), 0, 15, 0.15, ['#5fa8a0', '#e8e8e8']);
  cloth('coat', 'Sobretudo de inverno', '🧥', 2.0, 'jacket', ['torso', 'belly', 'neck', 'groin', 'thighL', 'thighR'].concat(ARMS), 15, 45, 1.0, ['#3a3a3a', '#5a4a3a', '#2a3a4a']);
  /* ---- mochilas/bolsas ---- */
  function bag(id, name, icon, w, cap, wr, slot) { def(id, { name: name, icon: icon, w: w, cat: 'bag', bag: { cap: cap, wr: wr, slot: slot } }); }
  bag('plastic_bag', 'Sacola plástica', '🛍️', 0.1, 3, 0, 'hand');
  bag('tote', 'Bolsa de ombro', '👜', 0.4, 6, 0.1, 'hand');
  bag('schoolbag', 'Mochila escolar', '🎒', 0.6, 10, 0.3, 'back');
  bag('duffel', 'Bolsa de viagem', '💼', 0.8, 16, 0.35, 'back');
  bag('hiking_bag', 'Mochila de trilha', '🎒', 1.0, 20, 0.6, 'back');
  bag('military_bag', 'Mochila militar', '🎒', 1.2, 24, 0.7, 'back');
  bag('garbage_bag', 'Saco de lixo', '🗑️', 0.1, 8, 0, 'hand');
  bag('toolbox', 'Caixa de ferramentas', '🧰', 1.0, 6, 0.3, 'hand');
  bag('first_aid_kit', 'Kit de primeiros socorros', '🧰', 0.5, 2, 0.3, 'hand');

  /* aparência da arma na mão (tipo usado pelo desenho) */
  D.weaponLook = function (id) {
    var it = I[id];
    if (!it) { return null; }
    if (it.weapon) { return it.weapon.type; }
    return 'tool';
  };

  /* ================= LOOT ================= */
  /* por tipo de recipiente (objeto) e tipo de sala: listas [id, peso]; n = [min,max] itens */
  D.LOOT = {
    fridge: { n: [1, 5], list: [['milk', 4], ['cheese', 4], ['apple', 4], ['banana', 3], ['orange', 3], ['carrot', 3], ['tomato', 3], ['lettuce', 2], ['steak', 3], ['chicken', 3], ['egg', 4], ['icecream', 2], ['pizza', 2], ['soda', 4], ['beer', 4], ['juice', 3], ['water_bottle', 3], ['cabbage', 2], ['fish', 1]] },
    kitchen: { n: [1, 4], list: [['beans', 5], ['soup', 5], ['tuna', 4], ['corn', 4], ['chips', 4], ['candy', 3], ['crackers', 4], ['cereal', 4], ['peanutbutter', 3], ['bread', 3], ['potato', 3], ['rice', 3], ['pasta', 3], ['knife', 5], ['canopener', 4], ['pan', 3], ['pot', 3], ['matches', 3], ['lighter', 1], ['water_bottle', 3], ['bottle_empty', 2], ['whiskey', 1], ['dogfood', 1], ['mag_recipes', 1], ['garbage_bag', 2]] },
    bathroom: { n: [0, 3], list: [['bandage', 6], ['disinfectant', 4], ['painkillers', 5], ['antibiotics', 1], ['betablockers', 2], ['antidepressants', 2], ['sleeping_pills', 2], ['alcohol_wipes', 3], ['tweezers', 2], ['suture_needle', 1], ['rag', 2], ['magazine', 1]] },
    bedroom: { n: [1, 4], list: [['tshirt', 6], ['shirt', 4], ['sweater', 4], ['jeans', 5], ['pants', 3], ['shorts', 3], ['skirt', 2], ['dress', 2], ['hoodie', 3], ['jacket', 2], ['sneakers', 3], ['shoes', 2], ['cap', 2], ['beanie', 2], ['scarf', 1], ['coat', 1], ['sheet', 4], ['schoolbag', 2], ['duffel', 1], ['novel', 3], ['magazine', 3], ['comic', 2], ['watch', 2], ['wallet', 2], ['photo', 2], ['toy', 1], ['cigarettes', 1], ['flashlight', 1], ['battery', 1], ['bat', 1], ['pistol', 0.3], ['ammo9', 0.5], ['revolver', 0.2], ['ammo38', 0.4], ['leather_jacket', 0.5], ['tote', 1]] },
    living: { n: [0, 3], list: [['novel', 4], ['magazine', 4], ['comic', 3], ['newspaper', 4], ['candy', 2], ['chips', 2], ['soda', 2], ['beer', 2], ['cigarettes', 1], ['lighter', 1], ['battery', 2], ['radio', 1], ['flashlight', 1], ['photo', 2], ['keyring', 2], ['golfclub', 0.3], ['mag_molotov', 0.3]] },
    garage: { n: [1, 4], list: [['hammer', 5], ['screwdriver', 4], ['wrench', 3], ['saw', 3], ['nails', 6], ['screws', 3], ['plank', 4], ['crowbar', 1.5], ['axe', 0.8], ['hatchet', 1], ['shovel', 2], ['trowel', 2], ['rope', 2], ['gas_can', 1], ['gas_can_empty', 2], ['toolbox', 1], ['gloves', 2], ['bucket', 2], ['seeds_carrot', 1], ['seeds_potato', 1], ['watering_can', 1], ['pipe', 1], ['sledge', 0.3], ['flashlight', 1], ['battery', 2], ['scrap', 2], ['mag_carpentry', 0.5], ['fishing_rod', 0.7], ['book_carpentry_1', 0.5], ['book_mechanics_1', 0.4]] },
    storage: { n: [1, 4], list: [['nails', 3], ['plank', 3], ['hammer', 2], ['saw', 1], ['screwdriver', 2], ['rope', 1], ['bucket', 1], ['garbage_bag', 2], ['sheet', 2], ['beans', 2], ['water_bottle', 2], ['scrap', 2], ['battery', 1]] },
    office: { n: [0, 3], list: [['magazine', 3], ['newspaper', 3], ['candy', 2], ['soda', 2], ['battery', 2], ['watch', 1], ['wallet', 1], ['painkillers', 1], ['tote', 1], ['radio', 0.5]] },
    grocery: { n: [3, 8], list: [['beans', 6], ['soup', 6], ['tuna', 5], ['corn', 5], ['chips', 5], ['candy', 5], ['crackers', 5], ['cereal', 4], ['peanutbutter', 3], ['bread', 4], ['potato', 3], ['apple', 3], ['rice', 3], ['pasta', 3], ['soda', 5], ['juice', 4], ['water_bottle', 6], ['beer', 3], ['canopener', 2], ['plastic_bag', 4], ['dogfood', 2], ['battery', 2], ['matches', 2], ['seeds_tomato', 1], ['seeds_cabbage', 1]] },
    pharmacy: { n: [3, 7], list: [['bandage', 8], ['disinfectant', 6], ['painkillers', 7], ['antibiotics', 4], ['betablockers', 4], ['antidepressants', 4], ['sleeping_pills', 4], ['alcohol_wipes', 6], ['suture_needle', 3], ['tweezers', 3], ['splint', 2], ['first_aid_kit', 2], ['candy', 2], ['water_bottle', 2], ['book_firstAid_1', 1], ['book_firstAid_2', 0.5]] },
    hardware: { n: [2, 6], list: [['hammer', 5], ['saw', 4], ['screwdriver', 4], ['wrench', 3], ['nails', 7], ['screws', 4], ['plank', 4], ['crowbar', 3], ['axe', 2], ['hatchet', 2], ['shovel', 3], ['trowel', 3], ['sledge', 1], ['rope', 3], ['gloves', 3], ['flashlight', 3], ['battery', 4], ['gas_can_empty', 2], ['watering_can', 2], ['bucket', 2], ['seeds_carrot', 2], ['seeds_potato', 2], ['seeds_tomato', 2], ['seeds_cabbage', 2], ['toolbox', 2], ['metal_sheet', 1], ['generator_item', 0.3], ['book_carpentry_1', 1], ['book_carpentry_2', 0.6], ['book_electrical_1', 0.5], ['book_farming_1', 0.8], ['mag_carpentry', 1]] },
    diner: { n: [1, 5], list: [['steak', 3], ['chicken', 3], ['bread', 3], ['potato', 3], ['cheese', 2], ['egg', 3], ['soda', 4], ['beer', 2], ['knife', 3], ['pan', 3], ['pot', 3], ['matches', 2], ['canopener', 1], ['pizza', 2]] },
    clothes: { n: [3, 7], list: [['tshirt', 6], ['shirt', 5], ['sweater', 4], ['jeans', 5], ['pants', 4], ['shorts', 3], ['skirt', 3], ['dress', 3], ['hoodie', 4], ['jacket', 3], ['leather_jacket', 1], ['coat', 2], ['sneakers', 4], ['boots', 1.5], ['shoes', 3], ['cap', 3], ['beanie', 3], ['scarf', 2], ['gloves', 1], ['leather_gloves', 1], ['schoolbag', 2], ['tote', 2], ['hiking_bag', 0.5]] },
    bar: { n: [1, 5], list: [['beer', 8], ['whiskey', 4], ['soda', 3], ['chips', 3], ['cigarettes', 3], ['lighter', 2], ['bat', 0.5], ['empty_beer', 3], ['newspaper', 2]] },
    gunstore: { n: [2, 5], list: [['pistol', 3], ['revolver', 2], ['shotgun', 2], ['rifle', 1.5], ['ammo9', 5], ['ammo38', 4], ['shells', 4], ['ammo308', 3], ['huntknife', 3], ['vest', 0.5], ['boots', 1], ['hiking_bag', 1], ['military_bag', 0.4]] },
    bookstore: { n: [3, 7], list: [['novel', 6], ['magazine', 5], ['comic', 5], ['newspaper', 2], ['mag_recipes', 2], ['mag_molotov', 1], ['mag_carpentry', 2]].concat(BOOK_SKILLS.map(function (s) { return ['book_' + s + '_1', 1.2]; })).concat(BOOK_SKILLS.map(function (s) { return ['book_' + s + '_2', 0.7]; })).concat(BOOK_SKILLS.map(function (s) { return ['book_' + s + '_3', 0.35]; })).concat(BOOK_SKILLS.map(function (s) { return ['book_' + s + '_4', 0.15]; })).concat(BOOK_SKILLS.map(function (s) { return ['book_' + s + '_5', 0.08]; })) },
    electronics: { n: [2, 5], list: [['radio', 4], ['flashlight', 4], ['battery', 7], ['watch', 2], ['alarm_clock', 3], ['generator_item', 0.4], ['book_electrical_1', 1]] },
    warehouse: { n: [1, 5], list: [['plank', 5], ['nails', 5], ['scrap', 4], ['metal_sheet', 2], ['rope', 2], ['gas_can', 1], ['gas_can_empty', 2], ['crowbar', 1], ['sledge', 0.6], ['beans', 2], ['water_bottle', 2], ['garbage_bag', 2], ['gloves', 2], ['boots', 0.5]] },
    police: { n: [1, 4], list: [['nightstick', 4], ['pistol', 3], ['shotgun', 1.5], ['ammo9', 5], ['shells', 3], ['police_jacket', 2], ['police_pants', 2], ['vest', 1], ['flashlight', 3], ['battery', 3], ['bandage', 2], ['radio', 2]] },
    clinic: { n: [2, 6], list: [['bandage', 6], ['disinfectant', 5], ['painkillers', 4], ['antibiotics', 4], ['suture_needle', 4], ['tweezers', 3], ['splint', 3], ['alcohol_wipes', 5], ['scrubs', 2], ['first_aid_kit', 2], ['book_firstAid_1', 1], ['book_firstAid_2', 1], ['book_firstAid_3', 0.5]] },
    gas: { n: [2, 6], list: [['chips', 6], ['candy', 6], ['soda', 6], ['water_bottle', 5], ['beer', 3], ['cigarettes', 4], ['lighter', 3], ['matches', 2], ['map', 3], ['battery', 3], ['flashlight', 1], ['gas_can_empty', 2], ['newspaper', 2], ['crackers', 3]] },
    mailbox: { n: [0, 1], list: [['newspaper', 4], ['magazine', 2], ['photo', 1]] },
    car: { n: [0, 3], list: [['map', 3], ['water_bottle', 2], ['soda', 2], ['chips', 2], ['wrench', 2], ['flashlight', 1], ['car_key', 1], ['cigarettes', 1], ['tote', 1], ['jacket', 1], ['first_aid_kit', 0.5], ['gas_can_empty', 0.5]] },
    dumpster: { n: [0, 4], list: [['bottle_empty', 4], ['empty_beer', 4], ['garbage_bag', 3], ['scrap', 2], ['plank', 1], ['newspaper', 2], ['rag', 2], ['dogfood', 1], ['chips', 1]] },
    crate: { n: [0, 3], list: [['plank', 3], ['nails', 3], ['scrap', 2], ['rope', 1], ['beans', 1], ['water_bottle', 1], ['sheet', 1], ['bottle_empty', 1]] },
    barn: { n: [1, 4], list: [['shovel', 3], ['trowel', 2], ['seeds_carrot', 3], ['seeds_potato', 3], ['seeds_tomato', 2], ['seeds_cabbage', 2], ['watering_can', 2], ['bucket', 2], ['rope', 2], ['axe', 1], ['hatchet', 1], ['gas_can', 1], ['plank', 3], ['nails', 2], ['potato', 2], ['egg', 2], ['book_farming_1', 0.8], ['book_farming_2', 0.4], ['gloves', 1], ['boots', 1]] }
  };

  /* ================= RECEITAS ================= */
  /* needs: [{ tag|item, n, keep }]; skill: [skillId, nível mínimo]; out: [{item, n}] */
  D.RECIPES = [
    { id: 'rip_sheet', name: 'Rasgar lençol em panos', needs: [{ item: 'sheet', n: 1 }], out: [{ item: 'rag', n: 4 }], time: 3 },
    { id: 'sheet_rope', name: 'Corda de lençol', needs: [{ item: 'sheet', n: 2 }], out: [{ item: 'sheet_rope', n: 1 }], time: 4 },
    { id: 'sterile_rag', name: 'Esterilizar pano (com desinfetante)', needs: [{ item: 'rag', n: 1 }, { item: 'disinfectant', n: 1, uses: 1 }], out: [{ item: 'rag_sterile', n: 1 }], time: 2 },
    { id: 'spear', name: 'Lança improvisada', needs: [{ item: 'plank', n: 1 }, { tag: 'knife', n: 1, keep: true }], out: [{ item: 'spear', n: 1 }], time: 6, xp: ['carpentry', 3] },
    { id: 'spear_knife', name: 'Lança com faca', needs: [{ item: 'spear', n: 1 }, { item: 'knife', n: 1 }, { item: 'rag', n: 1 }], out: [{ item: 'spear_knife', n: 1 }], time: 5, learned: true },
    { id: 'bat_nails', name: 'Taco com pregos', needs: [{ item: 'bat', n: 1 }, { item: 'nails', n: 5 }, { tag: 'hammer', n: 1, keep: true }], out: [{ item: 'bat_nails', n: 1 }], time: 5, learned: true },
    { id: 'molotov', name: 'Coquetel molotov', needs: [{ item: 'empty_beer', n: 1 }, { item: 'rag', n: 1 }, { tag: 'gas', n: 1, fuel: 1 }], out: [{ item: 'molotov', n: 1 }], time: 3, learned: true },
    { id: 'plank', name: 'Serrar tábuas (tora)', needs: [{ item: 'log', n: 1 }, { tag: 'saw', n: 1, keep: true }], out: [{ item: 'plank', n: 3 }], time: 8, xp: ['carpentry', 2] },
    { id: 'splint', name: 'Tala improvisada', needs: [{ item: 'plank', n: 1 }, { item: 'rag', n: 1 }], out: [{ item: 'splint', n: 1 }], time: 3, xp: ['firstAid', 2] },
    { id: 'stew', name: 'Ensopado (panela com água + 2 ingredientes)', needs: [{ item: 'pot_water', n: 1 }, { cat: 'food', n: 2, fresh: true }], out: [{ item: 'stew', n: 1 }], time: 6, xp: ['cooking', 6], needsHeat: true, learned: true },
    { id: 'empty_bottle_from_beer', name: 'Esvaziar garrafa de vidro', needs: [{ item: 'beer', n: 1 }], out: [{ item: 'empty_beer', n: 1 }], time: 1 }
  ];
  D.RECIPE = {};
  D.RECIPES.forEach(function (r) { D.RECIPE[r.id] = r; });

  /* ================= CONSTRUÇÃO (carpintaria) ================= */
  D.BUILDS = [
    { id: 'b_wall', name: 'Parede de madeira', kind: 'edge', edge: 'WALL', mats: [{ item: 'plank', n: 3 }, { item: 'nails', n: 4 }], tool: 'hammer', skill: 2, time: 10, xp: 6 },
    { id: 'b_doorframe', name: 'Batente com porta', kind: 'edge', edge: 'DOOR', mats: [{ item: 'plank', n: 5 }, { item: 'nails', n: 6 }], tool: 'hammer', skill: 3, time: 14, xp: 8 },
    { id: 'b_fence', name: 'Cerca baixa', kind: 'edge', edge: 'FENCE', mats: [{ item: 'plank', n: 2 }, { item: 'nails', n: 2 }], tool: 'hammer', skill: 0, time: 6, xp: 3 },
    { id: 'b_floor', name: 'Piso de madeira', kind: 'floor', mats: [{ item: 'plank', n: 1 }, { item: 'nails', n: 1 }], tool: 'hammer', skill: 1, time: 5, xp: 2 },
    { id: 'b_crate', name: 'Caixote', kind: 'obj', obj: 'CRATE', mats: [{ item: 'plank', n: 3 }, { item: 'nails', n: 3 }], tool: 'hammer', skill: 1, time: 8, xp: 4 },
    { id: 'b_rain', name: 'Coletor de chuva', kind: 'obj', obj: 'RAIN_BARREL', mats: [{ item: 'plank', n: 4 }, { item: 'nails', n: 4 }, { item: 'garbage_bag', n: 1 }], tool: 'hammer', skill: 4, time: 12, xp: 8, recipe: 'rain_barrel' },
    { id: 'b_campfire', name: 'Fogueira', kind: 'obj', obj: 'CAMPFIRE', mats: [{ item: 'plank', n: 2 }], tool: null, skill: 0, time: 6, xp: 1 },
    { id: 'b_workbench', name: 'Bancada', kind: 'obj', obj: 'WORKBENCH', mats: [{ item: 'plank', n: 4 }, { item: 'nails', n: 4 }], tool: 'hammer', skill: 2, time: 12, xp: 5 }
  ];
  D.BUILD = {};
  D.BUILDS.forEach(function (b) { D.BUILD[b.id] = b; });

  /* ================= ROUPAS INICIAIS / ZUMBIS ================= */
  D.OUTFITS = {
    civil_m: [['tshirt', 'jeans', 'sneakers'], ['shirt', 'pants', 'shoes'], ['hoodie', 'jeans', 'sneakers'], ['tanktop', 'shorts', 'sneakers'], ['sweater', 'jeans', 'shoes'], ['jacket', 'tshirt', 'jeans', 'boots']],
    civil_f: [['tshirt', 'jeans', 'sneakers'], ['dress', 'shoes'], ['shirt', 'skirt', 'shoes'], ['sweater', 'pants', 'sneakers'], ['tanktop', 'shorts', 'sneakers'], ['hoodie', 'jeans', 'sneakers']],
    police: [['police_jacket', 'shirt', 'police_pants', 'shoes']],
    doctor: [['scrubs', 'tshirt', 'pants', 'shoes']],
    worker: [['tshirt', 'jeans', 'boots', 'gloves'], ['jacket', 'jeans', 'boots']],
    fire: [['fire_jacket', 'pants', 'boots']]
  };
  D.OCC_OUTFIT = { police: 'police', doctor: 'doctor', nurse: 'doctor', firefighter: 'fire', construction: 'worker', lumberjack: 'worker', mechanic: 'worker', carpenter: 'worker', metalworker: 'worker' };

  CP.D = D;
})(window.CP = window.CP || {});
