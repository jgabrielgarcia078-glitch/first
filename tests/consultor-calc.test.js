/* Testes fórmula por fórmula. Cada valor esperado é calculado de forma independente
   (fórmula fechada, soma direta ou conta feita à mão), nunca chamando a função testada. */
// Uso: node tests/consultor-calc.test.js   (extrai o <script> de consultor.html e testa as funções de cálculo)
const fs = require('fs'), path = require('path'), os = require('os');
const html = fs.readFileSync(path.join(__dirname, '..', 'consultor.html'), 'utf8');
const script = html.match(/<script>\n([\s\S]*)<\/script>/)[1];
const tmp = path.join(os.tmpdir(), 'consultor-script-' + process.pid + '.js');
fs.writeFileSync(tmp, script);
const C = require(tmp);
fs.unlinkSync(tmp);
let pass = 0, fail = 0;
const fails = [];
function near(name, got, exp, tol) {
  tol = tol === undefined ? 0.01 : tol;
  const ok = typeof got === 'number' && isFinite(got) && Math.abs(got - exp) <= tol;
  if (ok) pass++; else { fail++; fails.push(name + ' -> obtido ' + got + ', esperado ' + exp + ' (±' + tol + ')'); }
}
function rel(name, got, exp, pct) { near(name, got, exp, Math.abs(exp) * (pct === undefined ? 1e-9 : pct) + 1e-9); }
function ok(name, cond) { if (cond) pass++; else { fail++; fails.push(name); } }
function defaults(id, env) {
  env = env || { facts: {}, premissas: C.DEFAULT_PREMISSAS };
  const o = {};
  C.TOOL_DEFS.find(t => t.id === id).fields.forEach(f => { if (f.k) o[f.k] = typeof f.d === 'function' ? f.d(env) : JSON.parse(JSON.stringify(f.d === undefined ? null : f.d)); });
  return o;
}
const ENV = { facts: {}, premissas: C.DEFAULT_PREMISSAS };

/* ---------- 1. Blocos básicos ---------- */
rel('taxa mensal equivalente a 12% a.a.', C.rateMonthly(12), Math.pow(1.12, 1 / 12) - 1);
near('12 meses da taxa mensal recompõem a anual', Math.pow(1 + C.rateMonthly(13.65), 12), 1.1365, 1e-12);
near('fator de anuidade 1% x 12', C.annuityFactor(0.01, 12), 11.2550775, 1e-6);
near('fator de anuidade antecipada 1% x 12', C.annuityDueFactor(0.01, 12), 11.2550775 * 1.01, 1e-6);
near('fator de valor futuro 1% x 12', C.fvFactor(0.01, 12), 12.6825030, 1e-6);
near('anuidade com taxa zero', C.annuityFactor(0, 24), 24, 0);
near('valor futuro com taxa zero', C.fvFactor(0, 24), 24, 0);

/* ---------- 2. Tabelas de imposto ---------- */
[[1, 22.5], [180, 22.5], [181, 20], [360, 20], [361, 17.5], [720, 17.5], [721, 15], [3000, 15]].forEach(p => near('IR renda fixa ' + p[0] + ' dias', C.irRendaFixa(p[0]), p[1], 0));
[[1, 96], [2, 93], [10, 66], [15, 50], [20, 33], [29, 3], [30, 0], [45, 0]].forEach(p => near('IOF dia ' + p[0], C.iofPct(p[0]), p[1], 0));
[[1, 35], [2, 35], [3, 30], [4, 30], [5, 25], [7, 20], [9, 15], [10, 15], [10.01, 10], [25, 10]].forEach(p => near('previdência regressiva ' + p[0] + ' anos', C.aliquotaRegressiva(p[0]), p[1], 0));
near('IRPF base isenta', C.irpfTabela(29145.60), 0, 0.001);
near('IRPF base 32.000 (7,5%)', C.irpfTabela(32000), 32000 * 0.075 - 2185.92, 0.001);
near('IRPF base 40.000 (15%)', C.irpfTabela(40000), 1270.08, 0.001);
near('IRPF base 50.000 (22,5%)', C.irpfTabela(50000), 50000 * 0.225 - 8105.88, 0.001);
near('IRPF base 100.000 (27,5%)', C.irpfTabela(100000), 16595.24, 0.001);
// continuidade da tabela nas mudanças de faixa
// (as parcelas a deduzir oficiais são arredondadas: a tabela da Receita tem degraus de centavos)
[29145.60, 33919.80, 45012.60, 55976.16].forEach(b => near('IRPF contínuo em ' + b, C.irpfTabela(b + 0.01) - C.irpfTabela(b), 0, 0.10));
near('redutor: renda 60 mil zera o imposto', C.irpfDevido(60000, 48000), 0, 0.001);
near('redutor: renda 70 mil', C.irpfDevido(70000, 56000), (56000 * 0.275 - 10904.76) - (8429.73 - 0.095575 * 70000), 0.001);
near('redutor: acaba em 88,2 mil', C.irpfDevido(88200, 88200) - C.irpfTabela(88200), 0, 0.02);
near('sem redutor acima de 88,2 mil', C.irpfDevido(120000, 100000), 16595.24, 0.001);

/* ---------- 3. Juros compostos ---------- */
(function () {
  const i = { inicial: 10000, aporte: 1000, taxa: 10, anos: 20, crescAporte: 0, inflacao: 4.5, custo: 0, ir: 15, atraso: 5 };
  const r = C.computeJuros(i);
  const rm = Math.pow(1.1, 1 / 12) - 1;
  const fv = 10000 * Math.pow(1.1, 20) + 1000 * (Math.pow(1.1, 20) - 1) / rm;
  rel('juros: saldo bruto (fórmula fechada)', r.bruto, fv, 1e-10);
  near('juros: total investido', r.investido, 10000 + 240 * 1000, 1e-6);
  rel('juros: IR sobre o ganho', r.ir, (fv - 250000) * 0.15, 1e-10);
  rel('juros: líquido', r.liquido, fv - (fv - 250000) * 0.15, 1e-10);
  rel('juros: líquido real', r.liquidoReal, (fv - (fv - 250000) * 0.15) / Math.pow(1.045, 20), 1e-10);
  rel('juros: taxa real', r.taxaReal, (1.1 / 1.045 - 1) * 100, 1e-10);
  rel('juros: renda perpétua real', r.rendaPerpetua, r.liquidoReal * (Math.pow(1.1 / 1.045, 1 / 12) - 1), 1e-10);
  near('juros: série tem um ponto por ano', r.series.saldo.length, 21, 0);
  rel('juros: saldo no ano 10', r.series.saldo[10], 10000 * Math.pow(1.1, 10) + 1000 * (Math.pow(1.1, 10) - 1) / rm, 1e-10);
  rel('juros: saldo real no ano 10', r.series.real[10], r.series.saldo[10] / Math.pow(1.045, 10), 1e-10);
  // adiar 5 anos: mesma conta com 15 anos
  const fv15 = 10000 * Math.pow(1.1, 15) + 1000 * (Math.pow(1.1, 15) - 1) / rm;
  const liq15 = fv15 - (fv15 - 190000) * 0.15;
  rel('juros: líquido adiando 5 anos', r.atraso.liquido, liq15, 1e-10);
  rel('juros: custo de adiar', r.atraso.custo, r.liquido - liq15, 1e-9);
  // mês em que os juros superam o aporte: saldo anterior × taxa >= 1000
  let bal = 10000, m = 0;
  while (bal * rm < 1000) { bal = bal * (1 + rm) + 1000; m++; }
  near('juros: mês em que os juros superam o aporte', r.cruzamento, m + 1, 0);
  // marco de R$ 100 mil
  let b2 = 10000, m2 = 0;
  while (b2 < 100000) { b2 = b2 * (1 + rm) + 1000; m2++; }
  near('juros: mês do primeiro R$ 100 mil', r.marcos[0].mes, m2, 0);
  near('juros: R$ 5 mi não é atingido', r.marcos[3].mes === null ? 1 : 0, 1, 0);
  // taxas reduzem a rentabilidade: (1+r)(1-c)-1
  const rc = C.computeJuros(Object.assign({}, i, { custo: 2 }));
  rel('juros: taxa líquida de custos', rc.taxaLiq, (1.1 * 0.98 - 1) * 100, 1e-10);
  const rmc = Math.pow(1.1 * 0.98, 1 / 12) - 1;
  rel('juros: saldo com custos', rc.bruto, 10000 * Math.pow(1.1 * 0.98, 20) + 1000 * (Math.pow(1.1 * 0.98, 20) - 1) / rmc, 1e-10);
  // aporte crescente: soma ano a ano em fórmula fechada
  const g = C.computeJuros(Object.assign({}, i, { crescAporte: 5 }));
  let exp = 10000 * Math.pow(1.1, 20), inv = 10000;
  for (let y = 0; y < 20; y++) {
    const ap = 1000 * Math.pow(1.05, y);
    exp += ap * (Math.pow(1 + rm, 12) - 1) / rm * Math.pow(1.1, 19 - y);
    inv += ap * 12;
  }
  rel('juros: aporte crescente 5% a.a.', g.bruto, exp, 1e-10);
  rel('juros: investido com aporte crescente', g.investido, inv, 1e-10);
  // sem IR e sem inflação
  const z = C.computeJuros(Object.assign({}, i, { ir: 0, inflacao: 0 }));
  rel('juros: sem IR o líquido é o bruto', z.liquido, z.bruto, 1e-12);
  rel('juros: sem inflação o real é o nominal', z.liquidoReal, z.liquido, 1e-12);
})();

/* ---------- 4. Independência financeira ---------- */
(function () {
  const i = { idade: 38, idadeApos: 60, expectativa: 95, patrimonio: 250000, aporte: 2500, rendaDesejada: 12000, outrasRendas: 3000, retAcum: 5, retApos: 4, vol: 8, crescAporte: 0, legado: 0 };
  const r = C.computeIndep(i);
  const rmA = Math.pow(1.05, 1 / 12) - 1, rmD = Math.pow(1.04, 1 / 12) - 1;
  const pat = 250000 * Math.pow(1.05, 22) + 2500 * (Math.pow(1.05, 22) - 1) / rmA;
  rel('indep: patrimônio na data (fórmula fechada)', r.patApos, pat, 1e-10);
  let nec = 0;
  for (let k = 0; k < 35 * 12; k++) nec += 9000 / Math.pow(1 + rmD, k);
  rel('indep: patrimônio necessário (soma direta)', r.necessario, nec, 1e-9);
  rel('indep: sobra ou falta', r.gap, pat - nec, 1e-8);
  // renda sustentável: sacando-a, o saldo zera exatamente no fim
  let b = pat;
  for (let m = 0; m < 35 * 12; m++) b = (b - (r.rendaSust - 3000)) * (1 + rmD);
  near('indep: renda sustentável zera o saldo no fim', b, 0, 0.01);
  // aporte necessário: com ele, chega-se exatamente ao necessário
  let b3 = 250000;
  for (let m = 0; m < 22 * 12; m++) b3 = b3 * (1 + rmA) + r.aporteReq;
  rel('indep: aporte necessário atinge o alvo', b3, nec, 1e-9);
  // idade em que o dinheiro acaba (simulação direta)
  let b4 = pat, fim = null;
  for (let m = 1; m <= 35 * 12 && fim === null; m++) { b4 = (b4 - 9000) * (1 + rmD); if (b4 < 0) fim = 60 + Math.floor((m - 1) / 12); }
  ok('indep: idade em que o dinheiro acaba', r.idadeFim === fim);
  // anos extras: é o menor k que fecha a conta
  const funded = k => {
    const p = 250000 * Math.pow(1.05, 22 + k) + 2500 * (Math.pow(1.05, 22 + k) - 1) / rmA;
    let n = 0; for (let j = 0; j < (35 - k) * 12; j++) n += 9000 / Math.pow(1 + rmD, j);
    return p >= n;
  };
  let kk = 0; while (!funded(kk)) kk++;
  near('indep: anos a mais de trabalho', r.anosExtras, kk, 0);
  near('indep: série cobre da idade atual até o fim', r.series.labels.length, 95 - 38 + 1, 0);
  rel('indep: série na data da independência', r.series.det[22], pat, 1e-10);
  // legado: valor presente descontado
  const rl = C.computeIndep(Object.assign({}, i, { legado: 500000 }));
  rel('indep: necessário com herança', rl.necessario, nec + 500000 / Math.pow(1.04, 35), 1e-9);
  let b5 = rl.patApos;
  for (let m = 0; m < 35 * 12; m++) b5 = (b5 - (rl.rendaSust - 3000)) * (1 + rmD);
  near('indep: renda sustentável preserva a herança', b5, 500000, 0.01);
  // Monte Carlo sem oscilação: resultado determinístico
  const folga = C.computeIndep(Object.assign({}, i, { vol: 0, rendaDesejada: 8000 }));
  const aperto = C.computeIndep(Object.assign({}, i, { vol: 0, rendaDesejada: 20000 }));
  near('indep: sem oscilação e com folga, 100% dos cenários', folga.prob, 100, 0);
  near('indep: sem oscilação e faltando, 0% dos cenários', aperto.prob, 0, 0);
  rel('indep: mediana sem oscilação segue a projeção', folga.series.p50[22], folga.patApos, 0.02);
  rel('indep: mediana com oscilação segue a projeção', r.series.p50[22], r.patApos, 0.04);
  ok('indep: p10 < p50 < p90', r.series.p10[22] < r.series.p50[22] && r.series.p50[22] < r.series.p90[22]);
  ok('indep: probabilidade entre 0 e 100', r.prob >= 0 && r.prob <= 100);
  // mais aporte nunca piora
  const mais = C.computeIndep(Object.assign({}, i, { aporte: 6000 }));
  ok('indep: mais aporte aumenta a probabilidade', mais.prob >= r.prob && mais.patApos > r.patApos);
  // já independente (idade = idade alvo)
  const ja = C.computeIndep(Object.assign({}, i, { idade: 60 }));
  near('indep: já na idade alvo, patrimônio é o atual', ja.patApos, 250000, 1e-6);
})();

/* ---------- 5. Gerador aleatório e distribuição ---------- */
(function () {
  const z = C.gaussianMatrix(2000, 30, 12345);
  let s = 0, s2 = 0, n = 0;
  z.forEach(row => row.forEach(v => { s += v; s2 += v * v; n++; }));
  near('normal: média ≈ 0', s / n, 0, 0.02);
  near('normal: desvio ≈ 1', Math.sqrt(s2 / n - Math.pow(s / n, 2)), 1, 0.02);
  const z2 = C.gaussianMatrix(5, 30, 12345);
  ok('normal: mesma semente, mesmos números', z2[3][2] === z[3][2]);
  near('lognormal: z = 0 devolve a taxa informada', C.lognormalReturn(5, 10, 0), 0.05, 1e-12);
  near('lognormal: z = 1', C.lognormalReturn(5, 10, 1), Math.exp(Math.log(1.05) + 0.1) - 1, 1e-12);
  near('percentil: mediana', C.percentile([1, 2, 3, 4, 5], 0.5), 3, 0);
  near('percentil: interpolação', C.percentile([10, 20], 0.25), 12.5, 1e-9);
})();

/* ---------- 6. Renda com guardrails ---------- */
(function () {
  const base = { patrimonio: 1000000, rendaMensal: 4000, anos: 30, ret: 4, vol: 0, faixa: 20, ajuste: 10 };
  const r = C.computeRenda(base);
  const afd = n => (1 - Math.pow(1.04, -n)) / 0.04 * 1.04;
  const M = 3; // anos de margem de longevidade
  const sust = 1000000 / afd(30 + M);
  rel('renda: retirada sustentável com 3 anos de margem (fórmula fechada)', r.sustentavel * 12, sust, 1e-12);
  near('renda: abaixo do sustentável e sem oscilação, 100% de sucesso', r.fixo, 100, 0);
  // sem oscilação e sem regra, o dinheiro dura exatamente até P0 / fator de 30 anos
  const limite = 1000000 / afd(30);
  near('renda: sem regra, logo abaixo do limite de 30 anos dura', C.computeRenda(Object.assign({}, base, { rendaMensal: limite / 12 - 1 })).fixo, 100, 0);
  near('renda: sem regra, logo acima do limite de 30 anos acaba', C.computeRenda(Object.assign({}, base, { rendaMensal: limite / 12 + 1 })).fixo, 0, 0);
  near('renda: taxa de retirada inicial', r.taxaInicial, 4.8, 1e-9);
  rel('renda: piso de patrimônio na próxima revisão', r.pisoPatrimonio, 1000000 * afd(29 + M) / afd(30 + M) / 1.2, 1e-12);
  rel('renda: teto de patrimônio na próxima revisão', r.tetoPatrimonio, 1000000 * afd(29 + M) / afd(30 + M) / 0.8, 1e-12);
  near('renda: valor após corte', r.rendaCorte, 3600, 1e-9);
  near('renda: valor após aumento', r.rendaAumento, 4400, 1e-9);
  ok('renda: 4.000 está abaixo do sustentável', !r.acimaDoSustentavel);
  // no piso, a relação retirada ÷ sustentável é exatamente a inicial × 1,2
  const k0 = 48000 / sust;
  near('renda: no piso a relação é a inicial × 1,2', 48000 / (r.pisoPatrimonio / afd(29 + M)) / k0, 1.2, 1e-12);
  near('renda: no teto a relação é a inicial × 0,8', 48000 / (r.tetoPatrimonio / afd(29 + M)) / k0, 0.8, 1e-12);
  // plano acima do sustentável: a referência passa a ser 1 (e não a relação inicial)
  const ag = C.computeRenda(Object.assign({}, base, { rendaMensal: 6000 }));
  ok('renda: 6.000 está acima do sustentável', ag.acimaDoSustentavel);
  rel('renda: piso de um plano agressivo usa a referência 1', ag.pisoPatrimonio, 72000 * afd(29 + M) / 1.2, 1e-12);
  // sem oscilação e retirando exatamente o sustentável, a regra nunca dispara e sobra a margem no fim
  const exato = C.simulateWithdrawals(1000000, sust, 30, 4, 0, [new Float64Array(30)], { faixa: 0.2, ajuste: 0.1 });
  near('renda: plano exato não sofre ajuste', exato.cortes, 0, 0);
  rel('renda: plano exato termina com os 3 anos de margem', exato.saldos[0][30], sust * afd(M), 1e-9);
  rel('renda: plano exato paga a mesma renda até o fim', exato.rendas[0][29], sust / 12, 1e-12);
  const v = C.computeRenda(Object.assign({}, base, { vol: 10, rendaMensal: 5000 }));
  ok('renda: a regra de ajuste aumenta a chance de durar', v.guard >= v.fixo);
  ok('renda: manter a renda é mais exigente que durar', v.firme <= v.guard);
  ok('renda: pior renda não passa da inicial', v.piorRenda <= 5000 + 1e-9);
  ok('renda: p10 <= p50 <= p90', v.series.p10[15] <= v.series.p50[15] && v.series.p50[15] <= v.series.p90[15]);
  near('renda: primeiro ano paga a retirada cheia', v.series.p50[0], 5000, 1e-9);
  // retirar menos nunca piora as chances
  const menos = C.computeRenda(Object.assign({}, base, { vol: 10, rendaMensal: 3500 }));
  ok('renda: retirar menos melhora as chances', menos.firme >= v.firme && menos.guard >= v.guard && menos.fixo >= v.fixo);
  // mesmo num plano muito agressivo a regra evita que o dinheiro acabe na maioria dos cenários
  const muito = C.computeRenda(Object.assign({}, base, { vol: 8, rendaMensal: 8000 }));
  ok('renda: plano agressivo, a regra preserva o patrimônio mas não a renda', muito.guard > 90 && muito.fixo < 5 && muito.firme < 5);
  // simulação direta de um caminho, comparada à função
  const z = [new Float64Array([-1.5, -1.5, 0.2, 1.8, 1.8])];
  const sim = C.simulateWithdrawals(1000000, 250000, 5, 4, 10, z, { faixa: 0.2, ajuste: 0.1 });
  const kRef = Math.min(1, 250000 / (1000000 / afd(5 + M)));
  let b = 1000000, w = 250000; const pagos = [];
  for (let y = 0; y < 5; y++) {
    if (y > 0) { const k = w / (b / afd(5 - y + M)); if (k > kRef * 1.2) w *= 0.9; else if (k < kRef * 0.8) w *= 1.1; }
    const pago = Math.min(w, b); pagos.push(pago / 12); b = (b - pago) * Math.exp(Math.log(1.04) + 0.1 * z[0][y]);
  }
  for (let y = 0; y < 5; y++) rel('renda: caminho manual, ano ' + (y + 1), sim.rendas[0][y], pagos[y], 1e-12);
  rel('renda: caminho manual, saldo final', sim.saldos[0][5], b, 1e-9);
  ok('renda: o caminho manual teve cortes', pagos[2] < pagos[0] && sim.cortes === 100);
})();

/* ---------- 7. Metas ---------- */
(function () {
  const i = { capacidade: 3000, retCurto: 3, retMedio: 4.5, retLongo: 5.5, rows: [
    { nome: 'A', valor: 100000, anos: 5, reservado: 20000, prio: 2 },
    { nome: 'B', valor: 60000, anos: 1, reservado: 0, prio: 1 },
    { nome: 'C', valor: 300000, anos: 12, reservado: 0, prio: 2 }] };
  const r = C.computeMetas(i);
  const A = r.metas.find(m => m.nome === 'A'), B = r.metas.find(m => m.nome === 'B'), Cc = r.metas.find(m => m.nome === 'C');
  const rm = Math.pow(1.045, 1 / 12) - 1;
  const falta = 100000 - 20000 * Math.pow(1.045, 5);
  rel('metas: parcela mensal (fórmula fechada)', A.pmt, falta * rm / (Math.pow(1.045, 5) - 1), 1e-10);
  let b = 20000; for (let m = 0; m < 60; m++) b = b * (1 + rm) + A.pmt;
  rel('metas: a parcela leva exatamente ao valor da meta', b, 100000, 1e-10);
  near('metas: quanto já está pronto', A.pronto, 20000 * Math.pow(1.045, 5) / 100000 * 100, 1e-9);
  const rmB = Math.pow(1.03, 1 / 12) - 1;
  rel('metas: curto prazo usa a taxa de curto prazo', B.pmt, 60000 * rmB / (Math.pow(1.03, 1) - 1), 1e-10);
  const rmC = Math.pow(1.055, 1 / 12) - 1;
  rel('metas: longo prazo usa a taxa de longo prazo', Cc.pmt, 300000 * rmC / (Math.pow(1.055, 12) - 1), 1e-10);
  ok('metas: prioridade alta vem primeiro', r.metas[0].nome === 'B' && r.metas[1].nome === 'A' && r.metas[2].nome === 'C');
  rel('metas: total necessário', r.necessario, A.pmt + B.pmt + Cc.pmt, 1e-12);
  near('metas: nunca aloca mais que o disponível', r.metas.reduce((s, m) => s + m.alocado, 0), Math.min(3000, r.necessario), 1e-6);
  near('metas: a prioritária fica com tudo que precisa ou com o que há', B.alocado, Math.min(B.pmt, 3000), 1e-9);
  rel('metas: saldo', r.saldo, 3000 - r.necessario, 1e-12);
  const folga = C.computeMetas(Object.assign({}, i, { capacidade: 50000 }));
  near('metas: com folga, todas cobertas', folga.cobertas, 3, 0);
})();

/* ---------- 8. Raio-X financeiro ---------- */
(function () {
  const i = { idade: 38, tipoRenda: 'clt', renda: 18000, despesas: 12000, aporte: 2500, parcelas: 3200, reserva: 30000, investimentos: 250000, imobilizado: 900000, dividas: 280000, dependentes: 2, seguro: 200000 };
  const r = C.computeRaioX(i);
  const by = id => r.indicadores.find(x => x.id === id);
  near('raio-x: taxa de poupança', by('poupanca').valor, 2500 / 18000 * 100, 1e-9);
  near('raio-x: nota da poupança', by('poupanca').score, 2500 / 18000 / 0.2 * 100, 1e-9);
  near('raio-x: meses de reserva', by('reserva').valor, 2.5, 1e-9);
  near('raio-x: nota da reserva', by('reserva').score, 2.5 / 6 * 100, 1e-9);
  near('raio-x: renda comprometida', by('parcelas').valor, 3200 / 18000 * 100, 1e-9);
  near('raio-x: nota das parcelas', by('parcelas').score, (45 - 3200 / 180) / 30 * 100, 1e-9);
  near('raio-x: endividamento', by('endividamento').valor, 280000 / 1150000 * 100, 1e-9);
  near('raio-x: nota do endividamento', by('endividamento').score, (60 - 28000 / 1150) / 50 * 100, 1e-9);
  near('raio-x: liquidez', by('liquidez').valor, 250000 / 1150000 * 100, 1e-9);
  near('raio-x: nota da liquidez', by('liquidez').score, 25000 / 1150 / 40 * 100, 1e-9);
  near('raio-x: cobertura da família', by('protecao').valor, 450000 / 1080000 * 100, 1e-9);
  near('raio-x: múltiplo da renda anual', by('aposentadoria').valor, 250000 / 216000, 1e-9);
  near('raio-x: referência aos 38 anos', C.benchAposentadoria(38), 2.6, 1e-9);
  near('raio-x: referência aos 30 anos', C.benchAposentadoria(30), 1, 1e-9);
  near('raio-x: referência aos 70 anos', C.benchAposentadoria(70), 10, 1e-9);
  near('raio-x: nota do rumo da aposentadoria', by('aposentadoria').score, 250000 / 216000 / 2.6 * 100, 1e-9);
  const nota = (by('poupanca').score * 20 + by('reserva').score * 20 + by('parcelas').score * 15 + by('endividamento').score * 10 + by('liquidez').score * 10 + by('protecao').score * 10 + by('aposentadoria').score * 15) / 100;
  near('raio-x: nota geral ponderada', r.nota, nota, 1e-9);
  near('raio-x: nota geral (conta à mão)', r.nota, 59.24, 0.05);
  ok('raio-x: faixa Atenção', r.faixa === 'Atenção');
  ok('raio-x: prioridades em ordem de urgência', r.prioridades.length === 3 && r.prioridades[0].score <= r.prioridades[1].score && r.prioridades[1].score <= r.prioridades[2].score);
  const sem = C.computeRaioX(Object.assign({}, i, { dependentes: 0 }));
  near('raio-x: sem dependentes, proteção não penaliza', sem.indicadores.find(x => x.id === 'protecao').score, 100, 0);
  const auto = C.computeRaioX(Object.assign({}, i, { tipoRenda: 'autonomo' }));
  near('raio-x: autônomo precisa de 12 meses', auto.indicadores.find(x => x.id === 'reserva').score, 2.5 / 12 * 100, 1e-9);
  const otimo = C.computeRaioX({ idade: 40, tipoRenda: 'clt', renda: 20000, despesas: 10000, aporte: 6000, parcelas: 0, reserva: 100000, investimentos: 2000000, imobilizado: 1000000, dividas: 0, dependentes: 1, seguro: 500000 });
  near('raio-x: caso exemplar tira 100', otimo.nota, 100, 1e-9);
})();

/* ---------- 9. Perfil de risco e carteiras ---------- */
(function () {
  Object.keys(C.MODEL_PORTFOLIOS).forEach(k => near('carteira-modelo ' + k + ' soma 100%', Object.values(C.MODEL_PORTFOLIOS[k]).reduce((a, b) => a + b, 0), 100, 1e-9));
  let sym = true;
  for (let a = 0; a < 8; a++) for (let b = 0; b < 8; b++) if (C.ASSET_CORR[a][b] !== C.ASSET_CORR[b][a] || (a === b && C.ASSET_CORR[a][b] !== 1)) sym = false;
  ok('correlações: matriz simétrica com diagonal 1', sym);
  // variância nunca negativa para carteiras quaisquer (inclusive vendidas)
  let seed = 7, minVar = Infinity;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let t = 0; t < 4000; t++) {
    const w = C.ASSET_CLASSES.map(() => rnd() - 0.5); let v = 0;
    for (let a = 0; a < 8; a++) for (let b = 0; b < 8; b++) v += w[a] * w[b] * C.ASSET_CORR[a][b] * C.ASSET_CLASSES[a].vol * C.ASSET_CLASSES[b].vol;
    minVar = Math.min(minVar, v);
  }
  ok('correlações: matriz válida (variância sempre positiva)', minVar > 0);
  const s1 = C.portfolioStats({ acoes: 100 });
  near('carteira 100% ações: retorno', s1.ret, 8, 1e-9); near('carteira 100% ações: risco', s1.vol, 24, 1e-9);
  const s2 = C.portfolioStats({ pos: 50, acoes: 50 });
  near('carteira 50/50: retorno', s2.ret, 6.25, 1e-9);
  near('carteira 50/50: risco (correlação zero)', s2.vol, Math.sqrt(0.25 * 1 + 0.25 * 576), 1e-9);
  const s3 = C.portfolioStats({ ipca: 50, pre: 50 });
  near('carteira IPCA+/pré: risco com correlação 0,7', s3.vol, Math.sqrt(0.25 * 49 + 0.25 * 36 + 2 * 0.25 * 0.7 * 7 * 6), 1e-9);
  const rg = C.range95(8, 24, 0.5);
  near('faixa de 95% em 6 meses: piso', rg.lo, (Math.sqrt(1.08) - 1) * 100 - 1.96 * 24 * Math.sqrt(0.5), 1e-9);
  near('faixa de 95% em 6 meses: teto', rg.hi, (Math.sqrt(1.08) - 1) * 100 + 1.96 * 24 * Math.sqrt(0.5), 1e-9);
  near('estresse 2008 em 100% ações', C.stressImpact({ acoes: 100 }, C.STRESS_SCENARIOS[0]), -41, 1e-9);
  near('estresse 2008 em 50% ações / 50% CDI', C.stressImpact({ acoes: 50, pos: 50 }, C.STRESS_SCENARIOS[0]), -14.5, 1e-9);
  const q = v => ({ patrimonio: 500000, q1: v[0], q2: v[1], q3: v[2], q4: v[3], q5: v[4], q6: v[5], q7: v[6], q8: v[7] });
  ok('risco: tudo no mínimo é conservador', C.computeRisco(q([0, 0, 0, 0, 0, 0, 0, 0])).perfil.id === 'conservador');
  ok('risco: tudo no máximo é agressivo', C.computeRisco(q([3, 3, 3, 3, 3, 3, 3, 3])).perfil.id === 'agressivo');
  const mix = C.computeRisco(q([3, 3, 3, 3, 0, 1, 1, 1]));
  near('risco: capacidade soma 12', mix.cap, 12, 0); near('risco: tolerância soma 3', mix.tol, 3, 0);
  ok('risco: vale o menor entre capacidade e tolerância', mix.perfil.id === 'conservador' && mix.divergente);
  ok('risco: 4–6 pontos é moderado', C.computeRisco(q([1, 1, 1, 1, 2, 1, 1, 1])).perfil.id === 'moderado');
  ok('risco: 7–9 pontos é arrojado', C.computeRisco(q([2, 2, 2, 2, 2, 2, 2, 1])).perfil.id === 'arrojado');
  ok('risco: incompleto sem todas as respostas', !C.computeRisco(q([1, 1, null, 1, 2, 1, 1, 1])).completo);
  const t = C.computeRisco(q([1, 1, 1, 1, 1, 1, 1, 1])).tabela;
  ok('risco: perda possível cresce com o perfil', t[0].loRs > t[1].loRs && t[1].loRs > t[2].loRs && t[2].loRs > t[3].loRs);
  const sm = C.portfolioStats(C.MODEL_PORTFOLIOS.moderado), r6 = C.range95(sm.ret, sm.vol, 0.5);
  rel('risco: perda em reais do moderado', t[1].loRs, 500000 * r6.lo / 100, 1e-12);
})();

/* ---------- 10. Raio-X de custos ---------- */
(function () {
  const i = defaults('custos');
  const r = C.computeCustos(i);
  near('custos: patrimônio total', r.total, 1000000, 1e-6);
  near('custos: custo anual em reais', r.custoRs, 7500 + 4950 + 4600 + 1500 + 750, 1e-6);
  near('custos: custo médio ponderado', r.custoPct, 1.93, 1e-9);
  near('custos: custo da proposta', r.novoPct, 1.1, 1e-12);
  rel('custos: patrimônio futuro atual', r.fvAtual, 1000000 * Math.pow(1.1 * (1 - 0.0193), 20), 1e-10);
  rel('custos: patrimônio futuro proposto', r.fvNovo, 1000000 * Math.pow(1.1 * (1 - 0.011), 20), 1e-10);
  rel('custos: diferença', r.diferenca, r.fvNovo - r.fvAtual, 1e-12);
  rel('custos: custo acumulado', r.custoAcumulado, 1000000 * Math.pow(1.1, 20) - r.fvAtual, 1e-10);
  ok('custos: ordenado do mais caro para o mais barato', r.rows[0].nome === 'Fundo multimercado do banco' && r.rows[4].nome === 'CDB');
})();

/* ---------- 11. Renda fixa ---------- */
(function () {
  const mk = rows => ({ valor: 100000, dias: 365, cdi: 13.65, ipca: 4.6, mtmTaxa: 7.3, mtmAnos: 10, rows: rows });
  const one = (row, extra) => C.computeRendaFixa(Object.assign(mk([row]), extra || {}), ENV).rows[0];
  const cdb = one({ nome: 'CDB', tipo: 'cdi', taxa: 100, isento: false, custo: 0 });
  near('renda fixa: 100% do CDI em 1 ano, bruto', cdb.bruto, 113650, 1e-6);
  near('renda fixa: IR de 17,5% entre 361 e 720 dias', cdb.ir, 13650 * 0.175, 1e-6);
  near('renda fixa: líquido', cdb.liquido, 111261.25, 1e-6);
  near('renda fixa: taxa líquida a.a.', cdb.liqAa, 11.26125, 1e-6);
  near('renda fixa: taxa real', cdb.realAa, (1.1126125 / 1.046 - 1) * 100, 1e-6);
  near('renda fixa: CDB equivale a ele mesmo', cdb.equiv, 100, 1e-6);
  const d = Math.pow(1.1365, 1 / 252) - 1;
  const cdb110 = one({ nome: 'CDB', tipo: 'cdi', taxa: 110, isento: false, custo: 0 });
  rel('renda fixa: 110% do CDI', cdb110.bruto, 100000 * Math.pow(1 + d * 1.1, 252), 1e-12);
  const lca = one({ nome: 'LCA', tipo: 'cdi', taxa: 92, isento: true, custo: 0 });
  rel('renda fixa: LCA isenta', lca.liquido, 100000 * Math.pow(1 + d * 0.92, 252), 1e-12);
  near('renda fixa: LCA não paga IR', lca.ir, 0, 0);
  // o CDB equivalente, recalculado, entrega o mesmo líquido da LCA
  const eq = one({ nome: 'CDB eq', tipo: 'cdi', taxa: lca.equiv, isento: false, custo: 0 });
  rel('renda fixa: equivalência LCA → CDB confere', eq.liquido, lca.liquido, 1e-9);
  const pre = one({ nome: 'Pré', tipo: 'pre', taxa: 13.4, isento: false, custo: 0 });
  near('renda fixa: prefixado 13,4% em 1 ano', pre.liquido, 100000 + 13400 * 0.825, 1e-6);
  const ip = one({ nome: 'IPCA+', tipo: 'ipca', taxa: 7.3, isento: false, custo: 0 });
  near('renda fixa: IPCA + 7,3%', ip.liquido, 100000 + (1.046 * 1.073 - 1) * 100000 * 0.825, 1e-6);
  const poup = one({ nome: 'Poupança', tipo: 'poup', taxa: 0, isento: true, custo: 0 });
  rel('renda fixa: poupança com Selic acima de 8,5%', poup.liquido, 100000 * Math.pow(1.005, 12) * 1.02, 1e-10);
  rel('poupança: Selic baixa rende 70% da Selic', C.poupancaMensal(6, 0), (Math.pow(1.06, 1 / 12) - 1) * 0.7, 1e-12);
  const ts = one({ nome: 'Tesouro Selic', tipo: 'cdi', taxa: 100, isento: false, custo: 0.2 });
  near('renda fixa: custo de 0,2% a.a.', ts.liquido, 100000 + (1.1365 * 0.998 - 1) * 100000 * 0.825, 1e-6);
  // prazo de 720 dias: 497 dias úteis
  const l720 = one({ nome: 'CDB', tipo: 'cdi', taxa: 110, isento: false, custo: 0 }, { dias: 720 });
  rel('renda fixa: 720 dias usa 497 dias úteis', l720.bruto, 100000 * Math.pow(1 + d * 1.1, 497), 1e-12);
  rel('renda fixa: 720 dias paga 17,5%', l720.ir, (l720.bruto - 100000) * 0.175, 1e-12);
  const l721 = one({ nome: 'CDB', tipo: 'cdi', taxa: 110, isento: false, custo: 0 }, { dias: 721 });
  rel('renda fixa: 721 dias paga 15%', l721.ir, (l721.bruto - 100000) * 0.15, 1e-12);
  // IOF em resgate com 10 dias
  const curto = one({ nome: 'CDB', tipo: 'cdi', taxa: 100, isento: false, custo: 0 }, { dias: 10 });
  const g10 = 100000 * (Math.pow(1 + d, 7) - 1);
  rel('renda fixa: IOF + IR em 10 dias', curto.ir, g10 * 0.66 + g10 * 0.34 * 0.225, 1e-10);
  const rank = C.computeRendaFixa(defaults('rendafixa', ENV), ENV).rows;
  ok('renda fixa: ordenado pelo líquido', rank.every((r, k) => k === 0 || rank[k - 1].liquido >= r.liquido));
  const m = C.computeRendaFixa(mk([]), ENV).mtm;
  near('marcação a mercado: juros +1 p.p. em 10 anos', m.find(x => x.delta === 1).variacao, (Math.pow(1.073 / 1.083, 10) - 1) * 100, 1e-9);
  near('marcação a mercado: juros −2 p.p. em 10 anos', m.find(x => x.delta === -2).variacao, (Math.pow(1.073 / 1.053, 10) - 1) * 100, 1e-9);
  ok('marcação a mercado: juro sobe, preço cai', m.find(x => x.delta === 1).variacao < 0 && m.find(x => x.delta === -1).variacao > 0);
})();

/* ---------- 12. Alocação e rebalanceamento ---------- */
(function () {
  const i = defaults('alocacao');
  const a = C.computeAlocacao(i);
  near('alocação: total atual', a.total, 1000000, 1e-6);
  near('alocação: total com dinheiro novo', a.final, 1050000, 1e-6);
  near('alocação: alvo soma 100%', a.somaAlvo, 100, 1e-9);
  near('alocação: só com aporte, ordens somam o aporte', a.rows.reduce((s, r) => s + r.ordem, 0), 50000, 1e-6);
  ok('alocação: só com aporte, nunca vende', a.rows.every(r => r.ordem >= -1e-9));
  ok('alocação: só com aporte, nunca passa do alvo', a.rows.every(r => r.atual >= r.alvoRs || r.depois <= r.alvoRs + 1e-6));
  // conta à mão: déficits = IPCA 182.500, pré 2.500, exterior 73.500, FII 2.500 → soma 261.000
  near('alocação: compra de IPCA+ proporcional ao déficit', a.rows.find(r => r.id === 'ipca').ordem, 50000 * 182500 / 261000, 1e-6);
  near('alocação: compra de exterior proporcional ao déficit', a.rows.find(r => r.id === 'ext').ordem, 50000 * 73500 / 261000, 1e-6);
  near('alocação: desvio do pós-fixado', a.rows.find(r => r.id === 'pos').desvio, 2, 1e-9);
  near('alocação: maior desvio', a.desvioMax, 17, 1e-9);
  const c = C.computeAlocacao(Object.assign({}, i, { modo: 'completo' }));
  near('alocação: completo, ordens somam o aporte', c.rows.reduce((s, r) => s + r.ordem, 0), 50000, 1e-6);
  ok('alocação: completo, cada classe termina no alvo', c.rows.every(r => Math.abs(r.depois - r.alvoRs) < 1e-6 && Math.abs(r.depoisPct - r.alvo) < 1e-9));
  near('alocação: completo, venda de multimercado', c.rows.find(r => r.id === 'multi').ordem, 105000 - 250000, 1e-6);
  const w = {}; i.rows.forEach(r => { w[r.id] = r.atual / 10000; });
  const st = C.portfolioStats(w);
  near('alocação: retorno esperado da carteira atual', a.atual.ret, st.ret, 1e-9);
  near('alocação: retorno atual (conta à mão)', a.atual.ret, 0.42 * 4.5 + 0.08 * 6 + 0.05 * 5.5 + 0.25 * 5.5 + 0.15 * 8 + 0.05 * 7, 1e-9);
  near('alocação: estresse 2008 na carteira atual', a.stress[0].atual, 0.42 * 12 + 0.08 * 11 + 0.05 * 14 + 0.25 * 5 + 0.15 * -41 + 0.05 * -15, 1e-9);
  const inval = C.computeAlocacao(Object.assign({}, i, { rows: i.rows.map(r => Object.assign({}, r, { alvo: 10 })) }));
  ok('alocação: detecta alvo diferente de 100%', !inval.valido);
})();

/* ---------- 13. PGBL e imposto de renda ---------- */
(function () {
  const i = { rendaAnual: 300000, contribui: true, inss: 12800, dependentes: 2, saude: 14000, educacao: 7123, pensao: 0, pgblFeito: 0, anos: 20, retorno: 10 };
  const r = C.computePgbl(i);
  near('pgbl: limite de 12%', r.limite, 36000, 1e-9);
  near('pgbl: IR na simplificada', r.simplificada, (300000 - 16754.34) * 0.275 - 10904.76, 0.001);
  near('pgbl: IR na completa sem PGBL', r.completaHoje, (300000 - 12800 - 4550.16 - 14000 - 7123) * 0.275 - 10904.76, 0.001);
  near('pgbl: IR na completa com PGBL cheio', r.completaMax, (300000 - 12800 - 4550.16 - 14000 - 7123 - 36000) * 0.275 - 10904.76, 0.001);
  near('pgbl: economia = 27,5% do aporte', r.economia, 9900, 0.001);
  near('pgbl: aporte ideal é o limite', r.ideal, 36000, 0.01);
  near('pgbl: retorno imediato', r.retornoImediato, 27.5, 0.001);
  ok('pgbl: declaração completa é a melhor', r.melhor === 'completa' && r.vale);
  near('pgbl: curva começa na completa sem PGBL', r.curva.completa[0], r.completaHoje, 0.001);
  near('pgbl: curva termina na completa com PGBL cheio', r.curva.completa[24], r.completaMax, 0.001);
  // simplificada vence sem PGBL, mas a completa vence com ele
  const j = { rendaAnual: 120000, contribui: true, inss: 10000, dependentes: 0, saude: 0, educacao: 0, pensao: 0, pgblFeito: 0, anos: 20, retorno: 10 };
  const s = C.computePgbl(j);
  near('pgbl: caso 2, simplificada', s.simplificada, 17487.80, 0.01);
  near('pgbl: caso 2, completa sem PGBL', s.completaHoje, 19345.24, 0.01);
  near('pgbl: caso 2, completa com PGBL', s.completaMax, 15385.24, 0.01);
  near('pgbl: caso 2, economia contra a melhor alternativa', s.economia, 2102.56, 0.01);
  // quem ganha pouco: simplificada continua melhor e o PGBL não compensa
  const k = C.computePgbl({ rendaAnual: 70000, contribui: true, inss: 2000, dependentes: 0, saude: 0, educacao: 0, pensao: 0, pgblFeito: 0, anos: 20, retorno: 10 });
  near('pgbl: renda baixa, simplificada (conta à mão)', k.simplificada, (56000 * 0.275 - 10904.76) - (8429.73 - 0.095575 * 70000), 0.001);
  near('pgbl: renda baixa, completa com PGBL (conta à mão)', k.completaMax, (59600 * 0.275 - 10904.76) - (8429.73 - 0.095575 * 70000), 0.001);
  ok('pgbl: renda baixa, simplificada vence', k.melhor === 'simplificada' && !k.vale && k.ideal === 0);
  // mesma renda com INSS maior: a completa com PGBL passa a ganhar por pouco
  const k2 = C.computePgbl({ rendaAnual: 70000, contribui: true, inss: 6000, dependentes: 0, saude: 0, educacao: 0, pensao: 0, pgblFeito: 0, anos: 20, retorno: 10 });
  near('pgbl: renda baixa com INSS de 6 mil, economia', k2.economia, 2755.76 - ((55600 * 0.225 - 8105.88) - 1739.48), 0.01);
  const n = C.computePgbl(Object.assign({}, i, { contribui: false }));
  ok('pgbl: sem previdência oficial não deduz', n.limite === 0 && n.economia === 0);
  const p = C.computePgbl(Object.assign({}, i, { pgblFeito: 20000 }));
  near('pgbl: espaço restante', p.espaco, 16000, 1e-9);
  near('pgbl: economia do espaço restante', p.economia, 16000 * 0.275, 0.001);
  // aporte ideal menor que o limite quando o imposto zera antes
  const zero = C.computePgbl({ rendaAnual: 100000, contribui: true, inss: 11000, dependentes: 3, saude: 45000, educacao: 7123, pensao: 0, pgblFeito: 0, anos: 20, retorno: 10 });
  ok('pgbl: não recomenda aportar além do ponto em que o imposto zera', zero.ideal < zero.limite - 1 && Math.abs(C.irCompleta({ rendaAnual: 100000, contribui: true, inss: 11000, dependentes: 3, saude: 45000, educacao: 7123, pensao: 0 }, zero.ideal) - zero.completaMax) < 1);
  // longo prazo, 1 ano (fórmula fechada)
  const l1 = C.previdenciaLongoPrazo(10000, 27.5, 1, 10);
  near('previdência 1 ano: PGBL', l1.pgbl, 11000 * 0.65 + 2750, 1e-6);
  near('previdência 1 ano: VGBL', l1.vgbl, 11000 - 1000 * 0.35, 1e-6);
  near('previdência 1 ano: fundo com come-cotas', l1.fundo, 10000 * Math.pow(1 + (Math.sqrt(1.1) - 1) * 0.85, 2), 1e-6);
  // longo prazo, 12 anos (soma direta)
  let pg = 0, vg = 0, fu = 0;
  const reg = a => a <= 2 ? 0.35 : a <= 4 ? 0.30 : a <= 6 ? 0.25 : a <= 8 ? 0.20 : a <= 10 ? 0.15 : 0.10;
  for (let y = 0; y < 12; y++) {
    const age = 12 - y, fv = 10000 * Math.pow(1.1, age);
    pg += fv * (1 - reg(age)); vg += fv - (fv - 10000) * reg(age);
    fu += 10000 * Math.pow(1 + (Math.sqrt(1.1) - 1) * 0.85, 2 * age);
    const c = 2750, a2 = age - 1;
    if (a2 > 0) { const f2 = c * Math.pow(1.1, a2); pg += f2 - (f2 - c) * reg(a2); } else pg += c;
  }
  const l12 = C.previdenciaLongoPrazo(10000, 27.5, 12, 10);
  rel('previdência 12 anos: PGBL com restituição reinvestida', l12.pgbl, pg, 1e-10);
  rel('previdência 12 anos: VGBL', l12.vgbl, vg, 1e-10);
  rel('previdência 12 anos: fundo', l12.fundo, fu, 1e-10);
  ok('previdência: com restituição de 27,5%, PGBL vence no longo prazo', C.previdenciaLongoPrazo(10000, 27.5, 20, 10).pgbl > C.previdenciaLongoPrazo(10000, 27.5, 20, 10).vgbl);
})();

/* ---------- 14. Reserva e seguro de vida ---------- */
(function () {
  const i = { despesas: 12000, tipoRenda: 'clt', reservaAtual: 30000, despesasFamilia: 10000, anosCobertura: 15, dividas: 280000, educacao: 300000, inventario: 100000, patrimonio: 250000, seguros: 200000, taxaReal: 3 };
  const r = C.computeProtecao(i);
  near('proteção: reserva ideal', r.reservaAlvo, 72000, 1e-9);
  near('proteção: quanto falta na reserva', r.reservaFalta, 42000, 1e-9);
  near('proteção: meses cobertos', r.reservaMeses, 2.5, 1e-9);
  const rm = Math.pow(1.03, 1 / 12) - 1; let pv = 0;
  for (let k = 0; k < 180; k++) pv += 10000 / Math.pow(1 + rm, k);
  rel('proteção: valor presente da renda da família (soma direta)', r.necessidades[0].v, pv, 1e-10);
  rel('proteção: total de necessidades', r.totalNec, pv + 680000, 1e-10);
  rel('proteção: seguro sugerido', r.seguro, pv + 680000 - 450000, 1e-10);
  near('proteção: autônomo, 12 meses', C.computeProtecao(Object.assign({}, i, { tipoRenda: 'autonomo' })).reservaAlvo, 144000, 1e-9);
  near('proteção: recursos sobrando, seguro zero', C.computeProtecao(Object.assign({}, i, { patrimonio: 9000000 })).seguro, 0, 0);
})();

/* ---------- 15. Sucessão ---------- */
(function () {
  const r = C.computeSucessao(defaults('sucessao'));
  near('sucessão: espólio', r.espolio, 4700000, 1e-6);
  near('sucessão: base após meação', r.base, 2350000, 1e-6);
  near('sucessão: ITCMD', r.itcmd, 94000, 1e-6);
  near('sucessão: honorários', r.honorarios, 141000, 1e-6);
  near('sucessão: custas', r.custas, 23500, 1e-6);
  near('sucessão: custo total', r.total, 258500, 1e-6);
  near('sucessão: custo em % da herança', r.pct, 11, 1e-9);
  near('sucessão: liquidez fora do inventário', r.liquidez, 400000, 1e-9);
  near('sucessão: sobra de liquidez', r.sobra, 141500, 1e-6);
  near('sucessão: não falta liquidez', r.falta, 0, 0);
  near('sucessão: ITCMD no teto de 8%', r.itcmdTeto, 188000, 1e-6);
  near('sucessão: aumento se for ao teto', r.aumentoTeto, 94000, 1e-6);
  near('sucessão: por herdeiro', r.porHerdeiro, (2350000 - 258500 + 400000) / 2, 1e-6);
  const s = C.computeSucessao(Object.assign(defaults('sucessao'), { meacao: 0, previdencia: 0, seguro: 0 }));
  near('sucessão: sem meação a base é o espólio', s.base, 4700000, 1e-6);
  near('sucessão: sem liquidez, falta o custo todo', s.falta, 4700000 * 0.11, 1e-6);
})();

/* ---------- 16. Imóvel e financiamento ---------- */
(function () {
  const i = defaults('imovel');
  const r = C.computeImovel(i);
  const im = Math.pow(1.115, 1 / 12) - 1, pv = 480000, n = 360;
  near('imóvel: valor financiado', r.financiado, pv, 1e-9);
  const pmt = pv * im / (1 - Math.pow(1 + im, -n));
  rel('imóvel: parcela Price (fórmula fechada)', r.price.primeira, pmt, 1e-10);
  rel('imóvel: Price tem parcela constante', r.price.ultima, pmt, 1e-8);
  rel('imóvel: juros totais Price', r.price.juros, pmt * n - pv, 1e-9);
  rel('imóvel: 1ª parcela SAC', r.sac.primeira, pv / n + pv * im, 1e-10);
  rel('imóvel: última parcela SAC', r.sac.ultima, pv / n * (1 + im), 1e-8);
  rel('imóvel: juros totais SAC (fórmula fechada)', r.sac.juros, pv * im * (n + 1) / 2, 1e-9);
  rel('imóvel: SAC amortiza exatamente o financiado', r.sac.pago - r.sac.juros, pv, 1e-9);
  rel('imóvel: Price amortiza exatamente o financiado', r.price.pago - r.price.juros, pv, 1e-9);
  near('imóvel: prazo sem extra', r.sac.meses, 360, 0);
  ok('imóvel: SAC paga menos juros que Price', r.sac.juros < r.price.juros);
  // amortização extra: simulação direta
  let b = pv, j = 0, m = 0;
  while (b > 0.005 && m < n) { const jj = b * im; const am = Math.min(b, pv / n + 500); b -= am; j += jj; m++; }
  near('imóvel: prazo com amortização extra', r.comExtra.meses, m, 0);
  rel('imóvel: juros com amortização extra', r.comExtra.juros, j, 1e-10);
  rel('imóvel: juros poupados', r.jurosPoupados, r.sac.juros - j, 1e-10);
  near('imóvel: meses poupados', r.mesesPoupados, 360 - m, 0);
  rel('imóvel: com extra também amortiza o financiado', r.comExtra.pago - r.comExtra.juros, pv, 1e-9);
  near('imóvel: saldo devedor no ano 10 (SAC)', r.sac.saldo[10], pv - 120 * pv / n, 1e-6);
  // comprar × alugar: identidade contábil com todas as taxas em zero
  const z = C.computeImovel({ valorImovel: 600000, entrada: 120000, taxa: 11.5, prazo: 360, sistema: 'price', extra: 0, aluguel: 2800, horizonte: 30, valorizacao: 0, reajuste: 0, retInvest: 0, custosProp: 0, custoCompra: 0 });
  rel('comprar × alugar: identidade com taxas zeradas', z.vantagem, 600000 - 120000 - (z.price.pago - 2800 * 360), 1e-9);
  // sem juros e com aluguel igual à parcela: comprar ganha exatamente o imóvel menos a entrada devolvida
  const y = C.computeImovel({ valorImovel: 360000, entrada: 0, taxa: 0, prazo: 360, sistema: 'price', extra: 0, aluguel: 1000, horizonte: 30, valorizacao: 0, reajuste: 0, retInvest: 0, custosProp: 0, custoCompra: 0 });
  near('comprar × alugar: juro zero e aluguel = parcela', y.vantagem, 360000, 1e-6);
  near('comprar × alugar: inquilino sem sobra não acumula', y.patAluguel, 0, 1e-6);
  // custo de compra entra como capital do inquilino
  const w = C.computeImovel(Object.assign({}, i, { horizonte: 1 }));
  near('comprar × alugar: série tem um ponto por ano', w.series.compra.length, 2, 0);
  near('comprar × alugar: ponto inicial do comprador é a entrada', w.series.compra[0], 120000, 1e-9);
  near('comprar × alugar: ponto inicial do inquilino inclui ITBI', w.series.aluguel[0], 120000 + 30000, 1e-9);
  // 1 ano, conta direta
  let invA = 150000, invC = 0, sal = pv, alug = 2800, imv = 600000; const ri = Math.pow(1.095, 1 / 12) - 1;
  for (let k = 1; k <= 12; k++) {
    const jj = sal * im, am = pv / n; sal -= am;
    const gasto = jj + am + imv * 0.015 / 12;
    invA *= 1 + ri; invC *= 1 + ri;
    if (gasto > alug) invA += gasto - alug; else invC += alug - gasto;
    imv *= Math.pow(1.05, 1 / 12);
  }
  rel('comprar × alugar: patrimônio do inquilino em 1 ano', w.patAluguel, invA, 1e-10);
  rel('comprar × alugar: patrimônio do comprador em 1 ano', w.patCompra, imv - sal + invC, 1e-10);
})();

/* ---------- 17. Todas as ferramentas rodam com os valores de exemplo ---------- */
(function () {
  const fns = { raiox: C.computeRaioX, risco: C.computeRisco, custos: C.computeCustos, juros: C.computeJuros, indep: C.computeIndep, renda: C.computeRenda, metas: C.computeMetas, rendafixa: C.computeRendaFixa, alocacao: C.computeAlocacao, pgbl: C.computePgbl, protecao: C.computeProtecao, sucessao: C.computeSucessao, imovel: C.computeImovel };
  const walk = (o, path) => {
    if (typeof o === 'number') { if (!isFinite(o)) return path; return null; }
    if (o && typeof o === 'object') { for (const k of Object.keys(o)) { const b = walk(o[k], path + '.' + k); if (b) return b; } }
    return null;
  };
  C.TOOL_DEFS.forEach(t => {
    const r = fns[t.id](defaults(t.id, ENV), ENV);
    ok('exemplo de ' + t.id + ' sem NaN/Infinity' + (walk(r, t.id) ? ' (' + walk(r, t.id) + ')' : ''), !walk(r, t.id));
    // entradas zeradas não podem quebrar
    const zero = defaults(t.id, ENV);
    Object.keys(zero).forEach(k => { if (typeof zero[k] === 'number') zero[k] = 0; if (Array.isArray(zero[k])) zero[k] = []; });
    let bad = null; try { bad = walk(fns[t.id](zero, ENV), t.id); } catch (e) { bad = 'exceção: ' + e.message; }
    ok('entradas zeradas em ' + t.id + (bad ? ' (' + bad + ')' : ''), !bad);
  });
})();

console.log('\n' + pass + ' testes passaram, ' + fail + ' falharam');
if (fail) { console.log('\nFALHAS:\n - ' + fails.join('\n - ')); process.exit(1); }
