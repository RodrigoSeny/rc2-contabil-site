// Testes da calculadora do DAS (node --test). Até 2026: LC 123; a partir de 2027: LC 214.
const test = require('node:test');
const assert = require('node:assert/strict');
globalThis.window = globalThis; // tabelas.js publica em window
require('../public/calculadora-simples/assets/js/tabelas.js');
require('../public/calculadora-simples/assets/js/reforma.js');
require('../public/calculadora-simples/assets/js/calculo.js');
const C = globalThis.RC2_CALCULO;

const apurar = (ano, rbt12, valor, anexo = 'I', tratamento = 'normal') =>
  C.apurar({ ano, rbt12, folha12: 0, receitas: [{ anexo, tratamento, valor }] });
const perto = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);

test('2026 continua com as tabelas da LC 123 (PIS/COFINS)', () => {
  for (const ano of [2026, undefined]) {
    const r = apurar(ano, 150000, 10000);
    assert.equal(r.totalDas, 400);
    assert.ok(r.porTributo.PIS && r.porTributo.COFINS);
    assert.equal(r.porTributo.CBS, undefined);
  }
});

test('2027: mesma alíquota, partilha com CBS e IBS', () => {
  const r = apurar(2027, 150000, 10000);
  assert.equal(r.totalDas, 400);
  assert.equal(r.porTributo.PIS, undefined);
  perto(r.porTributo.CBS.das, 61.32); // 400 × 15,33%
  perto(r.porTributo.IBS.das, 0.68); // 400 × 0,17%
  assert.equal(r.reforma, true);
});

test('2027–2028: 6ª faixa com 0,1 ponto a menos; 2029 volta a 19%', () => {
  perto(apurar(2026, 4000000, 100000).totalDas, 9550, 0.02); // cada tributo é arredondado antes da soma
  perto(apurar(2027, 4000000, 100000).totalDas, 9450);
  perto(apurar(2029, 4000000, 100000).totalDas, 9550, 0.02);
});

test('monofásico a partir de 2027 tira CBS e IBS do DAS', () => {
  const r = apurar(2027, 150000, 10000, 'I', 'mono');
  perto(r.totalDas, 338);
  perto(r.totalExcluido, 62);
});

test('Anexo III, 5ª faixa: ISS limitado a 5% e total preservado (2027)', () => {
  const r = apurar(2027, 3000000, 100000, 'III');
  perto(r.totalDas, 16812);
  perto(r.porTributo.ISS.das, 5000);
});

test('2033: sem ISS no Anexo III; IBS ocupa a parcela', () => {
  const r = apurar(2033, 150000, 10000, 'III');
  assert.equal(r.porTributo.ISS, undefined);
  perto(r.totalDas, 600);
  perto(r.porTributo.IBS.das, 600 * 0.335);
});

test('anexoDoAno: faixas e deduções iguais; muda só a 6ª faixa em 2027', () => {
  const a26 = C.anexoDoAno('V', 2026), a27 = C.anexoDoAno('V', 2027);
  assert.deepEqual(a26.faixas.map((f) => f.pd), a27.faixas.map((f) => f.pd));
  perto(a27.faixas[5].aliq, 0.304, 1e-9);
  perto(a26.faixas[2].aliq, a27.faixas[2].aliq, 1e-9);
});

test('texto digitado vira centésimos inteiros, sem float', () => {
  assert.equal(C.textoParaCentesimos('1.741,00'), 174100);
  assert.equal(C.textoParaCentesimos('1741'), 174100);
  assert.equal(C.textoParaCentesimos('R$ 1.621,5'), 162150);
  assert.equal(C.textoParaCentesimos('5'), 500);
  assert.equal(C.textoParaCentesimos('5,5%'), 550);
  assert.equal(C.textoParaCentesimos('0,1'), 10);
  for (const ruim of ['', 'abc', '1,234', '-5', '12a']) assert.ok(Number.isNaN(C.textoParaCentesimos(ruim)), ruim);
});

test('MEI por ano (LC 238/2026): limite 81 mil → 110 mil (2027) → 140 mil (2028+)', () => {
  assert.equal(C.meiDoAno(2026).limiteAnual, 8100000);
  assert.equal(C.meiDoAno(2026).salarioOficial, true);
  assert.equal(C.meiDoAno(2027).limiteAnual, 11000000);
  assert.equal(C.meiDoAno(2027).empregados, 2);
  assert.equal(C.meiDoAno(2028).limiteAnual, 14000000);
  assert.equal(C.meiDoAno(2030).limiteAnual, 14000000);
  assert.equal(C.meiDoAno(2020).limiteAnual, 8100000);
});

test('DAS-MEI em centavos', () => {
  const d26 = C.dasMei(162100, 500, 100, 500);
  assert.deepEqual(d26, { inss: 8105, comercio: 8205, servicos: 8605, ambos: 8705 });
  const d27 = C.dasMei(174100, 500, 100, 500);
  assert.equal(d27.inss, 8705);
  assert.equal(C.dasMei(100001, 500, 0, 0).inss, 5000); // 50,0005 → 50,00
  assert.equal(C.dasMei(100010, 500, 0, 0).inss, 5001); // 50,005 → 50,01 (meio para cima)
});
