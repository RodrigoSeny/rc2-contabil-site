// Testes do comparativo de regimes (node --test). Valores conferidos à mão.
const test = require('node:test');
const assert = require('node:assert/strict');
require('../public/calculadora-simples/assets/js/reforma.js');
require('../public/calculadora-simples/assets/js/regimes.js');
const RG = globalThis.RC2_REGIMES;

const base = {
  ano: 2027, anexo: 'I', receita: 150000, folha: 0, comprasRegular: 0, comprasSimples: 0,
  vendasEmpresas: 0, reducao: 0, icmsSaida: 20, icmsEntrada: 12, iss: 5, margemReal: 10,
  premissas: { cbsReferencia: 11.3, ibsPleno: 17.7 }
};
const cen = (r, id) => r.cenarios.find((c) => c.id === id);
const perto = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);

test('alíquotas de IBS/CBS na transição', () => {
  const p = { cbsReferencia: 11.3, ibsPleno: 17.7 };
  perto(RG.aliquotasIbsCbs(2027, p).cbs, 0.112, 1e-9);
  perto(RG.aliquotasIbsCbs(2028, p).ibs, 0.001, 1e-9);
  perto(RG.aliquotasIbsCbs(2030, p).ibs, 0.177 * 0.2, 1e-9);
  perto(RG.aliquotasIbsCbs(2033, p).ibs, 0.177, 1e-9);
  assert.equal(RG.fracaoIcmsIss(2031), 0.7);
  assert.equal(RG.fracaoIcmsIss(2033), 0);
});

test('Anexo I, 2027, 1ª faixa: DAS e partilha da LC 214', () => {
  const r = RG.comparar(base);
  const a = cen(r, 'A');
  assert.equal(a.total, 6000);
  const b = cen(r, 'B');
  // DAS sem CBS (15,33%) e IBS (0,17%) da partilha: 6.000 − 919,80 − 10,20
  assert.equal(b.das, 5070);
  assert.equal(b.total, 5070 + 16800 + 150); // CBS 11,2% e IBS 0,1% sem créditos
});

test('Lucro Presumido e Real, comércio, 2027', () => {
  const r = RG.comparar(base);
  // IRPJ 15% × 8% × 150k = 1.800; CSLL 9% × 12% × 150k = 1.620; CBS 16.800; IBS 150; ICMS 30.000
  assert.equal(cen(r, 'C').total, 50370);
  // Lucro 15.000: IRPJ 2.250; CSLL 1.350
  assert.equal(cen(r, 'D').total, 50550);
  assert.equal(r.melhor.id, 'A');
});

test('créditos de compras reduzem IBS/CBS e ICMS do regime regular', () => {
  const r = RG.comparar({ ...base, comprasRegular: 100000, comprasSimples: 10000 });
  const c = cen(r, 'C');
  const cbs = c.linhas.find((l) => l.nome === 'CBS').valor;
  // 16.800 − 100.000 × 11,2% − 10.000 × 1% × (11,2/11,3) = 16.800 − 11.200 − 99,12
  perto(cbs, 5500.88);
  const icms = c.linhas.find((l) => l.nome === 'ICMS').valor;
  assert.equal(icms, 30000 - 12000);
});

test('crédito repassado ao cliente empresa: DAS x por fora', () => {
  const r = RG.comparar({ ...base, vendasEmpresas: 1 });
  perto(cen(r, 'A').creditoCliente, 930); // só o CBS+IBS pago no DAS
  perto(cen(r, 'B').creditoCliente, 16950); // 11,3% cheio
});

test('Anexo III, 5ª faixa: teto de 5% do ISS não muda o total do DAS', () => {
  const r = RG.comparar({ ...base, anexo: 'III', receita: 3000000 });
  const s = cen(r, 'A').simples;
  perto(s.efetiva, 0.16812, 1e-9);
  perto(s.pcts.ISS, 0.05, 1e-12);
  assert.equal(cen(r, 'A').total, 504360);
  // Partilha da lei para essa situação: (efetiva − 5%) × 23,20% para a CBS (aprox.)
  perto(s.pcts.CBS, (0.16812 - 0.05) * 0.2320, 0.00001);
});

test('Fator R: folha abaixo de 28% vai para o Anexo V', () => {
  assert.equal(RG.comparar({ ...base, anexo: 'FR', folha: 20000 }).anexoEfetivo, 'V');
  assert.equal(RG.comparar({ ...base, anexo: 'FR', folha: 50000 }).anexoEfetivo, 'III');
});

test('acima de R$ 4,8 milhões o Simples não se aplica; LC 224 acima de R$ 5 milhões', () => {
  const r = RG.comparar({ ...base, receita: 6000000 });
  assert.equal(cen(r, 'A').aplicavel, false);
  assert.equal(cen(r, 'B').aplicavel, false);
  const irpj = cen(r, 'C').linhas.find((l) => l.nome === 'IRPJ').valor;
  // base = 6M × 8% + 1M × 8% × 10% = 488.000; IRPJ = 73.200 + (488.000 − 240.000) × 10% = 98.000
  assert.equal(irpj, 98000);
});

test('2033: sem ICMS; IBS pleno no regime regular e na partilha do Simples', () => {
  const r = RG.comparar({ ...base, ano: 2033 });
  const c = cen(r, 'C');
  assert.equal(c.linhas.find((l) => l.nome === 'ICMS').valor, 0);
  assert.equal(c.linhas.find((l) => l.nome === 'IBS').valor, 26550); // 150k × 17,7%
  assert.equal(cen(r, 'A').simples.pcts.ICMS, undefined);
  perto(cen(r, 'A').simples.pcts.IBS, 0.04 * 0.34, 1e-12);
});

test('compararAnos devolve 2027 a 2033', () => {
  assert.deepEqual(RG.compararAnos(base).map((r) => r.ano), [2027, 2028, 2029, 2030, 2031, 2032, 2033]);
});
