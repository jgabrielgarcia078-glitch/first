/* Ponto único de inicialização (regra 4): chamado uma vez no DOMContentLoaded. */
(function (CP) {
  'use strict';
  function init() {
    var canvas = document.getElementById('game');
    CP.Render.init(canvas);
    CP.Input.bind(canvas);
    window.addEventListener('resize', CP.Render.resize);
    if (CP.UI) { CP.UI.init(); } else {
      var seed = Number(new URLSearchParams(location.search).get('seed')) || 12345;
      CP.Game.newGame({ seed: seed });
    }
    CP.Game.start();
  }
  document.addEventListener('DOMContentLoaded', init);
})(window.CP = window.CP || {});
