// Testes do comparativo MEI × ME (node --test). Valores conferidos à mão, em centavos.
const test = require('node:test');
const assert = require('node:assert/strict');
globalThis.window = globalThis;
require('../public/calculadora-simples/assets/js/tabelas.js');
require('../public/calculadora-simples/assets/js/reforma.js');
require('../public/calculadora-simples/assets/js/calculo.js');
require('../public/calculadora-simples/assets/js/mei.js');
const M = globalThis.RC2_MEI;

const servico2026 = (fat, extra = {}) => M.simular({ ano: 2026, atividade: 'servico', anexoServico: 'III', faturamentoAnual: fat, ...extra });

test('MEI de serviços em 2026: DAS fixo de R$ 86,05 (5% de R$ 1.621 + R$ 5 de ISS)', () => {
  const r = servico2026(6000000);
  assert.equal(r.mei.dasMensal, 8605);
  assert.equal(r.mei.dasAnual, 103260);
  assert.equal(r.mei.situacao, 'dentro');
  assert.equal(r.veredito.nivel, 'ok');
});

test('comércio e "os dois" usam o DAS-MEI certo', () => {
  assert.equal(M.simular({ ano: 2026, atividade: 'comercio', faturamentoAnual: 100 }).mei.dasMensal, 8205);
  assert.equal(M.simular({ ano: 2026, atividade: 'ambos', faturamentoAnual: 100 }).mei.dasMensal, 8705);
});

test('ME no Anexo III a R$ 81 mil: DAS 6% + INSS 11% de 1 salário mínimo + contador R$ 350', () => {
  const me = servico2026(8100000).me;
  assert.equal(me.dasAnual, 486000);
  assert.equal(me.inssAnual, 213972); // 1.621 × 12 × 11%
  assert.equal(me.contadorAnual, 420000);
  assert.equal(me.totalAnual, 486000 + 213972 + 420000);
});

test('contador editável', () => {
  const me = servico2026(8100000, { contadorMensal: 50000 }).me;
  assert.equal(me.contadorAnual, 600000);
});

test('Anexo III na 2ª faixa (R$ 200 mil): alíquota efetiva 6,52%', () => {
  const me = servico2026(20000000).me;
  assert.equal(me.dasAnual, 1304000); // 200.000 × 11,2% − 9.360
  assert.equal(me.servico.aliquota.faixa, 2);
});

test('tolerância de 20%: DAS-MEI + DAS sobre o excesso; acima disso não pode ser MEI', () => {
  const t = servico2026(9000000).mei;
  assert.equal(t.situacao, 'tolerancia');
  assert.equal(t.excesso, 900000);
  assert.equal(t.dasExcesso, 54000); // 9.000 × 6%
  assert.equal(t.custoAnual, 103260 + 54000);
  assert.equal(servico2026(9720000).mei.situacao, 'tolerancia'); // exatamente 20%
  const a = servico2026(9720001);
  assert.equal(a.mei.situacao, 'acima');
  assert.equal(a.mei.custoAnual, null);
  assert.equal(a.veredito.nivel, 'alerta');
});

test('ponto de equilíbrio 2026 (serviços, contador R$ 350): ≈ R$ 91.816', () => {
  // 0,94·X − 2.139,72 − 4.200 = 81.000 − 1.032,60  →  X = 91.816,08
  const eq = servico2026(8100000).pontoEquilibrio;
  assert.ok(Math.abs(eq - 9181608) <= 1, String(eq));
  const me = M.custoME(eq, M.parametros({ ano: 2026, atividade: 'servico', anexoServico: 'III' }));
  assert.ok(eq - me.totalAnual >= 8100000 - 103260);
});

test('2027: limite de R$ 110 mil e 2 empregados', () => {
  const r = M.simular({ ano: 2027, atividade: 'servico', faturamentoAnual: 10000000, empregados: 2 });
  assert.equal(r.mei.situacao, 'dentro');
  assert.equal(r.mei.limiteAnual, 11000000);
  assert.notEqual(r.veredito.nivel, 'alerta');
  const r2026 = servico2026(5000000, { empregados: 2 });
  assert.equal(r2026.veredito.nivel, 'alerta');
});

test('Fator R: escolhe o mais barato entre Anexo III (pró-labore 28%) e Anexo V', () => {
  const p = M.parametros({ ano: 2026, atividade: 'servico', anexoServico: 'FR' });
  // R$ 81 mil: 28% = 22.680/ano = 1.890/mês → III: 4.860 + 2.494,80 + 4.200 ; V: 12.555 + 2.139,72 + 4.200
  const me = M.custoME(8100000, p);
  assert.equal(me.anexoServico, 'III');
  assert.equal(me.prolaboreMensal, 189000);
  assert.equal(me.inssAnual, 249480);
  assert.equal(me.totalAnual, 486000 + 249480 + 420000);
  assert.equal(me.alternativa.anexoServico, 'V');
  assert.equal(me.alternativa.totalAnual, 1255500 + 213972 + 420000);
});

test('comércio e serviços: alíquota pela receita total, DAS proporcional a cada parte', () => {
  const p = M.parametros({ ano: 2026, atividade: 'ambos', anexoServico: 'III', partServico: 4000 });
  const me = M.custoME(10000000, p);
  assert.equal(me.comercio.receita, 6000000);
  assert.equal(me.servico.receita, 4000000);
  assert.equal(me.dasAnual, 240000 + 240000); // 60.000 × 4% + 40.000 × 6%
});

test('curva inclui o faturamento informado e o ponto de equilíbrio', () => {
  const r = servico2026(7000000);
  assert.ok(r.curva.some((l) => l.atual && l.faturamentoAnual === 7000000));
  assert.ok(r.curva.some((l) => l.equilibrio));
  for (let i = 1; i < r.curva.length; i++) assert.ok(r.curva[i].faturamentoAnual > r.curva[i - 1].faturamentoAnual);
});

test('brl sem Intl', () => {
  assert.equal(M.brl(123456789), 'R$ 1.234.567,89');
  assert.equal(M.brl(5), 'R$ 0,05');
  assert.equal(M.brlInteiro(9181608), 'R$ 91.816');
});
