/* Carrega os scripts do jogo no Node (sem navegador) para testes de lógica.
 * Usa new Function (mesmo "realm") — vm.createContext deixa o código ~25x mais lento. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function scriptOrder() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const re = /<script src="([^"]+)"><\/script>/g;
  const out = [];
  let m;
  while ((m = re.exec(html))) { out.push(m[1]); }
  return out;
}

function load(files) {
  const store = {};
  const win = {
    localStorage: { getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    addEventListener() {}, removeEventListener() {}, innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1
  };
  const doc = { addEventListener() {}, getElementById() { return null; }, querySelector() { return null }, createElement() { return { getContext() { return null; }, style: {}, appendChild() {} }; }, body: { appendChild() {} } };
  const perf = { now: () => Number(process.hrtime.bigint()) / 1e6 };
  const list = files || scriptOrder();
  for (const f of list) {
    const code = fs.readFileSync(path.join(ROOT, f), 'utf8');
    new Function('window', 'document', 'performance', 'navigator', 'requestAnimationFrame', 'localStorage', code + '\n//# sourceURL=' + f)(win, doc, perf, { userAgent: 'node' }, () => 0, win.localStorage);
  }
  win.document = doc;
  return win;
}

module.exports = { load, scriptOrder, ROOT };
