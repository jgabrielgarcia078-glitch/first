/* Bilhetes, recados e pichações: textos originais gerados pelo RNG (o mesmo chunk gera sempre o mesmo texto).
 * Usado pelos itens "Bilhete" (it.text), recados presos em portas (estado da porta: st.note) e pichações nas fachadas. */
(function (CP) {
  'use strict';

  var N = {};
  var NAMES = ['Joe', 'Martha', 'Hank', 'Linda', 'Bobby', 'Sue', 'Carl', 'Amy', 'Dale', 'Ruth', 'Tommy', 'Jean', 'Walt', 'Peggy', 'Rick', 'Donna', 'Ed', 'Kathy', 'Lou', 'Tina'];
  var KIN = ['mãe', 'pai', 'vó', 'tia', 'mano', 'filha', 'amor'];
  /* {A} {B} {C} = nomes, {K} = parente, {T} = cidade, {D} = dia */
  var TEMPL = {
    goodbye: [
      '{K},\nfomos para a casa dos {C} em {T}. Pegamos o carro e o que deu.\nNão espere por nós aqui. Te amamos.\n— {B}',
      'Se o {A} voltar: estamos no ginásio da escola, disseram que lá tem soldado e comida.\nDeixamos a chave debaixo do vaso.\n{B} e as crianças',
      '{A}, esperei três dias. Não dá mais.\nVou seguir a rodovia para o norte. Se você ler isto, me encontra em {T}.\nCom amor, {B}',
      'Saímos às pressas. O rádio mandou ir para {T}.\nNão deixe a porta aberta, tem uns deles rondando a rua.\n— Família {C}'
    ],
    warning: [
      'NÃO ENTRE.\nO {A} foi mordido e está trancado no quarto dos fundos.\nNão tivemos coragem.',
      'TEM GENTE ARMADA AQUI DENTRO.\nSiga seu caminho que ninguém se machuca.',
      'Casa já revirada. Não tem comida.\nNão perca seu tempo.',
      'Eles entram pela janela da cozinha.\nPregamos tábua mas não segurou.\nSe estiver lendo isso, corra.',
      'Mordido. Tranquei a porta por dentro e joguei a chave fora.\nNão abra esta porta. Por favor.\n— {A}'
    ],
    diary: [
      'Dia {D}. A TV parou de falar do surto. Só passa a tela de emergência agora.\nO {A} pregou as janelas. A gente racionou a comida: dá pra umas duas semanas.',
      'Dia {D}. Barulho no quintal a noite inteira. Ninguém dormiu.\nO cachorro do vizinho parou de latir ontem.',
      'Dia {D}. Acabou a água da torneira por um tempo, depois voltou marrom.\nEnchi a banheira e todas as garrafas.\n{A} está com febre desde o arranhão. Diz que não é nada.',
      'Dia {D}. Ouvimos um helicóptero. Acenamos com o lençol no telhado.\nNão voltou.',
      'Dia {D}. {A} não é mais {A}.\nNão sei quanto tempo a porta do porão aguenta.'
    ],
    family: [
      '{A},\nse você achar isto, saiba que eu tentei voltar para casa.\nA ponte está bloqueada. Vou dar a volta pelo campo.\nCuide do seu irmão.\n— {K}',
      '{A},\nguardei os remédios da vó na gaveta da cozinha.\nNão saia de casa depois que escurecer.\nVolto logo.\n— {B}',
      'Para quem encontrar meu corpo:\nmeu nome é {A} {C}. Morava em {T}.\nAvise a minha família, se alguém ainda estiver vivo.'
    ],
    list: [
      'Lista:\n- pilhas (muitas)\n- água\n- feijão em lata\n- fita adesiva\n- remédio da vó\n- pregos',
      'Coisas pra pegar no mercado:\n- leite em pó\n- fraldas\n- velas\n- fósforo\n- cigarro pro {A}',
      'Lugares já revistados:\n- posto da rodovia (vazio)\n- farmácia (zumbis demais)\n- casa azul da esquina (ok)\nFaltam: escola, igreja'
    ],
    camp: [
      'Montamos o acampamento aqui, longe da cidade.\n{A} foi buscar água no riacho ontem cedo e não voltou.\nVou procurar. Se eu não voltar, a comida está na caixa.',
      'Dia {D} no mato. Frio à noite, mas eles quase não aparecem aqui.\nCuidado com o fogo: a fumaça chama atenção.',
      'Quem achar: pode ficar com as coisas.\nEu e {A} vamos tentar chegar em {T} pela linha do trem.'
    ],
    misc: [
      '(desenho de criança: uma casa, o sol e três pessoas de mãos dadas.\nEmbaixo está escrito "MINHA FAMILIA" com letras tortas.)',
      'Recado do rádio, anotado às pressas:\n"...evitem as rodovias... centros de apoio em {T}... não se aproximem dos infectados..."',
      '{A} — o turno de sábado foi cancelado.\nO patrão mandou todo mundo ficar em casa até segunda ordem.',
      'Lembrete: consulta do {A} quinta às 10h.\n(Nunca vai acontecer.)',
      'Se alguém estiver vivo, a gente se encontra na igreja de {T} todo domingo ao meio-dia.\nTragam o que puderem.'
    ]
  };
  /* pichações: o que sobreviventes escreveram nas paredes */
  N.GRAFFITI = {
    generic: ['SOCORRO', 'NÃO ENTRE', 'FOMOS PRO NORTE', 'DEUS NOS PERDOE', 'ESTAMOS VIVOS', 'O FIM CHEGOU', 'ARMADOS', '→ ABRIGO', 'TEM COMIDA?', 'MORTOS LÁ DENTRO', 'X'],
    store: ['SAQUEADO', 'VAZIO', 'SEM COMIDA', 'SAQUEADORES SERÃO BALEADOS', 'FECHADO'],
    survivor: ['ESTAMOS VIVOS', 'SOBREVIVENTES AQUI', 'NÃO ATIRE'],
    party: ['MORTOS LÁ DENTRO', 'NÃO ABRA', 'X'],
    goodbye: ['FOMOS PRO NORTE', 'VAZIO', 'X']
  };
  N.KINDS = Object.keys(TEMPL);

  function fill(t, rng, town) {
    var a = rng.pick(NAMES), b = rng.pick(NAMES), c = rng.pick(['Miller', 'Johnson', 'Carlson', 'Baker', 'Hayes', 'Turner', 'Price', 'Walsh']);
    while (b === a) { b = rng.pick(NAMES); }
    return t.split('{A}').join(a).split('{B}').join(b).split('{C}').join(c).split('{K}').join(rng.pick(KIN))
      .split('{T}').join(town || 'a cidade').split('{D}').join(String(rng.int(2, 19)));
  }
  N.townName = function (rng) {
    var m = CP.W && CP.W.macro;
    return m && m.towns && m.towns.length ? rng.pick(m.towns).name : null;
  };
  /* texto de um bilhete do tipo kind (ou de um tipo qualquer) */
  N.gen = function (rng, kind, town) {
    if (!kind || !TEMPL[kind]) { kind = rng.pick(['goodbye', 'warning', 'diary', 'family', 'list', 'misc', 'misc']); }
    return fill(rng.pick(TEMPL[kind]), rng, town || N.townName(rng));
  };
  /* pichação determinística pela posição */
  N.graffiti = function (h, kind) {
    var list = N.GRAFFITI[kind] || N.GRAFFITI.generic;
    return list[h % list.length];
  };
  /* primeira linha (título curto do bilhete) */
  N.title = function (text) {
    var l = String(text || '').split('\n')[0];
    return l.length > 34 ? l.slice(0, 32) + '…' : l;
  };

  CP.Notes = N;
})(window.CP = window.CP || {});
