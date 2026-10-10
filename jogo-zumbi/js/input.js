/* Entrada: teclado e mouse. Guarda estado (tecla segurada) e fila de "apertos" por quadro. */
(function (CP) {
  'use strict';

  var I = {
    down: {},          // code → true enquanto segurada
    pressed: [],       // codes apertados desde o último consumo
    mouse: { x: 0, y: 0, left: false, right: false, middle: false },
    clicks: [],        // { button, x, y, shift, ctrl }
    wheel: 0,
    rightDownAt: 0, rightMoved: false,
    enabled: true,
    blockGame: false   // true quando uma janela de UI captura teclas
  };

  function isTyping(e) {
    var t = e.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  }

  I.bind = function (canvas) {
    window.addEventListener('keydown', function (e) {
      if (isTyping(e)) { return; }
      var code = e.code;
      // evita rolagem/atalhos do navegador nas teclas do jogo
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F1', 'F2', 'F3', 'F4', 'AltLeft', 'AltRight'].indexOf(code) >= 0 || (e.ctrlKey && (code === 'KeyS'))) { e.preventDefault(); }
      if (!I.down[code]) { I.pressed.push({ code: code, shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey, alt: e.altKey }); }
      I.down[code] = true;
    });
    window.addEventListener('keyup', function (e) { I.down[e.code] = false; });
    window.addEventListener('blur', function () { I.down = {}; I.mouse.left = I.mouse.right = false; });
    canvas.addEventListener('mousemove', function (e) {
      if (I.mouse.right && (Math.abs(e.clientX - I.mouse.x) + Math.abs(e.clientY - I.mouse.y) > 3)) { I.rightMoved = true; }
      I.mouse.x = e.clientX; I.mouse.y = e.clientY;
    });
    canvas.addEventListener('mousedown', function (e) {
      I.mouse.x = e.clientX; I.mouse.y = e.clientY;
      if (e.button === 0) { I.mouse.left = true; I.clicks.push({ button: 0, x: e.clientX, y: e.clientY, shift: e.shiftKey, ctrl: e.ctrlKey }); }
      if (e.button === 2) { I.mouse.right = true; I.rightDownAt = performance.now(); I.rightMoved = false; }
      if (e.button === 1) { I.mouse.middle = true; e.preventDefault(); }
    });
    window.addEventListener('mouseup', function (e) {
      if (e.button === 0) { I.mouse.left = false; }
      if (e.button === 2) {
        if (I.mouse.right && !I.rightMoved && performance.now() - I.rightDownAt < 260) { I.clicks.push({ button: 2, x: e.clientX, y: e.clientY }); }
        I.mouse.right = false;
      }
      if (e.button === 1) { I.mouse.middle = false; }
    });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    canvas.addEventListener('wheel', function (e) { e.preventDefault(); I.wheel += e.deltaY > 0 ? 1 : -1; }, { passive: false });
  };

  I.isDown = function (code) { return !!I.down[code]; };
  I.consumePressed = function () { var p = I.pressed; I.pressed = []; return p; };
  I.consumeClicks = function () { var c = I.clicks; I.clicks = []; return c; };
  I.consumeWheel = function () { var w = I.wheel; I.wheel = 0; return w; };
  /* segurando o botão direito por mais de 260ms = mirar */
  I.aiming = function () { return I.mouse.right && (performance.now() - I.rightDownAt > 200 || I.rightMoved); };

  CP.Input = I;
})(window.CP = window.CP || {});
