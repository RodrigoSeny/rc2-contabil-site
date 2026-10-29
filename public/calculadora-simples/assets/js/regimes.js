/*
 * RC2 Contábil — Comparativo de regimes tributários na Reforma Tributária (funções puras).
 *
 * Valores ANUAIS, supondo faturamento estável (a receita do ano é a RBT12 do Simples).
 * Cenários:
 *   A. Simples Nacional com IBS/CBS dentro do DAS (LC 123, art. 18; LC 214, art. 47, § 9º)
 *   B. Simples Nacional com IBS/CBS pelo regime regular (LC 123, art. 13, §§ 9º e 10; LC 214, art. 41, § 3º)
 *   C. Lucro Presumido (IRPJ/CSLL presumidos; IBS/CBS, ICMS e ISS pelo regime regular)
 *   D. Lucro Real (IRPJ/CSLL sobre o lucro informado; demais como no Presumido)
 * A partir de 2027 o PIS e a COFINS deixam de existir (substituídos pela CBS) e o IPI tem alíquota
 * zero, exceto produtos industrializados na Zona Franca de Manaus (EC 132/2023, ADCT art. 126).
 */
(function (root) {
  'use strict';

  var R = root.RC2_REFORMA;
  var LIMITE_SIMPLES = 4800000;
  var SUBLIMITE = 3600000; // ICMS, ISS e IBS fora do DAS acima disso (LC 123, art. 13-A)
  var FAIXAS = [180000, 360000, 720000, 1800000, 3600000, 4800000];
  var FATOR_R_MINIMO = 0.28;
  var ISS_TETO = 0.05;

  function arred(v) { return Math.round((v + Number.EPSILON) * 100) / 100; }
  function pos(v) { return v > 0 ? v : 0; }

  function premissas(p) {
    var out = {};
    Object.keys(R.PREMISSAS).forEach(function (k) { out[k] = R.PREMISSAS[k]; });
    Object.keys(p || {}).forEach(function (k) { if (p[k] !== undefined && p[k] !== null) out[k] = p[k]; });
    return out;
  }

  function tipoAtividade(anexo) { return anexo === 'I' || anexo === 'II' ? 'comercio' : 'servico'; }

  /* Alíquotas do regime regular de IBS e CBS no ano (frações). */
  function aliquotasIbsCbs(ano, p) {
    if (ano <= 2028) return { cbs: (p.cbsReferencia - 0.1) / 100, ibs: 0.001 };
    var fracaoIbs = 1 - (R.FRACAO_ICMS_ISS[ano] === undefined ? 0 : R.FRACAO_ICMS_ISS[ano]);
    return { cbs: p.cbsReferencia / 100, ibs: (p.ibsPleno / 100) * fracaoIbs };
  }

  function fracaoIcmsIss(ano) {
    var f = R.FRACAO_ICMS_ISS[ano];
    return f === undefined ? (ano < 2027 ? 1 : 0) : f;
  }

  /* Anexo efetivo: o Fator R decide entre III e V. */
  function resolverAnexo(anexo, receita, folha) {
    if (anexo !== 'FR') return { anexo: anexo, fatorR: null };
    var fator = receita > 0 ? folha / receita : 0;
    return { anexo: fator >= FATOR_R_MINIMO ? 'III' : 'V', fatorR: fator };
  }

  /* Alíquota efetiva e partilha do Simples no ano (frações da receita). */
  function simples(anexo, rbt12, ano) {
    if (!(rbt12 > 0) || rbt12 > LIMITE_SIMPLES) return null;
    var tab = R.ANEXOS_SIMPLES[anexo];
    var idx = 0;
    while (rbt12 > FAIXAS[idx]) idx++;
    var f = tab.aliquotas[R.periodoAliquotas(ano)][idx];
    var nominal = f[0] / 100, pd = f[1];
    var efetiva = (rbt12 * nominal - pd) / rbt12;
    var part = tab.partilha[R.periodoPartilha(ano)];
    var pcts = {};
    part.tributos.forEach(function (t, i) { pcts[t] = efetiva * part.faixas[idx][i] / 100; });
    // Teto de 5% para o ISS; o excedente vai, proporcionalmente, aos tributos federais e ao IBS
    // da mesma faixa (LC 123, art. 18, § 1º-B, I, na redação da LC 227/2026).
    if (pcts.ISS > ISS_TETO) {
      var excedente = pcts.ISS - ISS_TETO;
      pcts.ISS = ISS_TETO;
      var outros = part.tributos.filter(function (t) { return t !== 'ISS' && t !== 'ICMS'; });
      var base = outros.reduce(function (s, t) { return s + pcts[t]; }, 0);
      var copia = {};
      outros.forEach(function (t) { copia[t] = pcts[t]; });
      outros.forEach(function (t) { pcts[t] += excedente * copia[t] / base; });
    }
    return { faixa: idx + 1, nominal: nominal, pd: pd, efetiva: efetiva, pcts: pcts };
  }

  /*
   * IBS e CBS pelo regime regular: débito sobre as vendas menos créditos das compras.
   * Compras de fornecedores do regime regular dão crédito integral; de fornecedores do Simples que
   * recolhem tudo no DAS, só o valor pago no DAS (LC 214, art. 47, § 9º, II).
   * O saldo credor não reduz o custo aqui (pode ser ressarcido, mas depende de pedido e prazo).
   */
  function ibsCbsRegular(e, p, quais) {
    var a = aliquotasIbsCbs(e.ano, p);
    var red = 1 - (e.reducao || 0);
    var soma = a.cbs + a.ibs;
    var creditoSimples = (e.comprasSimples || 0) * p.creditoFornecedorSimples / 100;
    var out = { cbs: 0, ibs: 0, saldoCredor: 0, aliquotas: a };
    ['cbs', 'ibs'].forEach(function (t) {
      if (quais.indexOf(t) < 0) return;
      var debito = e.receita * a[t] * red;
      var credito = (e.comprasRegular || 0) * a[t] + (soma > 0 ? creditoSimples * a[t] / soma : 0);
      out[t] = pos(debito - credito);
      out.saldoCredor += pos(credito - debito);
    });
    return out;
  }

  /* ICMS (comércio/indústria) e ISS (serviços) pelas regras normais, reduzidos na transição. */
  function icmsIssRegular(e) {
    var f = fracaoIcmsIss(e.ano);
    if (tipoAtividade(e.anexo) === 'comercio') {
      var icms = pos(e.receita * (e.icmsSaida || 0) / 100 - (e.comprasRegular || 0) * (e.icmsEntrada || 0) / 100) * f;
      return { nome: 'ICMS', valor: icms };
    }
    return { nome: 'ISS', valor: e.receita * (e.iss || 0) / 100 * f };
  }

  function irpjCsll(baseIrpj, baseCsll, p) {
    var irpj = pos(baseIrpj) * p.irpj / 100 + pos(baseIrpj - p.limiteAdicional) * p.irpjAdicional / 100;
    return { irpj: irpj, csll: pos(baseCsll) * p.csll / 100 };
  }

  function linha(nome, valor, obs) { return { nome: nome, valor: arred(valor), obs: obs || '' }; }

  function fechar(c, e) {
    c.total = arred(c.linhas.reduce(function (s, l) { return s + l.valor; }, 0));
    c.carga = e.receita > 0 ? c.total / e.receita : 0;
    c.creditoCliente = arred(c.creditoCliente || 0);
    c.custoMenosCredito = arred(c.total - c.creditoCliente);
    return c;
  }

  /* ---------------- Cenários ---------------- */

  function cenarioSimples(e, p, porFora) {
    var c = {
      id: porFora ? 'B' : 'A',
      nome: porFora ? 'Simples + IBS/CBS por fora' : 'Simples Nacional (tudo no DAS)',
      aplicavel: true, linhas: [], avisos: [], creditoCliente: 0, saldoCredor: 0
    };
    if (e.rbt12 > LIMITE_SIMPLES) {
      c.aplicavel = false;
      c.motivo = 'RBT12 acima de R$ 4,8 milhões: a empresa não pode ficar no Simples Nacional.';
      return c;
    }
    // Faixa e alíquota efetiva saem da RBT12; o DAS incide sobre a receita do período.
    var s = simples(e.anexoEfetivo, e.rbt12, e.ano);
    c.simples = s;
    var acimaSublimite = e.rbt12 > SUBLIMITE;
    var das = 0, ibsCbsDas = 0;
    Object.keys(s.pcts).forEach(function (t) {
      var v = e.receita * s.pcts[t];
      if (porFora && (t === 'CBS' || t === 'IBS')) return;
      das += v;
      if (t === 'CBS' || t === 'IBS') ibsCbsDas += v;
    });
    c.das = arred(das);
    c.aliquotaDas = e.receita > 0 ? das / e.receita : 0;
    c.linhas.push(linha('DAS', das, 'Anexo ' + e.anexoEfetivo + ', ' + s.faixa + 'ª faixa, alíquota efetiva ' +
      (s.efetiva * 100).toFixed(2).replace('.', ',') + '%' + (porFora ? ', sem as parcelas de CBS e IBS' : '')));

    if (porFora) {
      var reg = ibsCbsRegular(e, p, ['cbs', 'ibs']);
      c.linhas.push(linha('CBS (regime regular)', reg.cbs, 'débito sobre as vendas menos créditos das compras'));
      c.linhas.push(linha('IBS (regime regular)', reg.ibs, 'débito sobre as vendas menos créditos das compras'));
      c.saldoCredor = reg.saldoCredor;
      c.creditoCliente = e.receita * e.vendasEmpresas * (reg.aliquotas.cbs + reg.aliquotas.ibs) * (1 - (e.reducao || 0));
    } else {
      c.creditoCliente = ibsCbsDas * e.vendasEmpresas;
      if (acimaSublimite) {
        // Acima do sublimite o IBS sai do DAS e segue o regime regular (LC 123, art. 13-A).
        var regIbs = ibsCbsRegular(e, p, ['ibs']);
        c.linhas.push(linha('IBS (fora do DAS, acima do sublimite)', regIbs.ibs));
        c.creditoCliente += e.receita * e.vendasEmpresas * regIbs.aliquotas.ibs * (1 - (e.reducao || 0));
        c.saldoCredor = regIbs.saldoCredor;
      }
    }
    if (acimaSublimite) {
      var ii = icmsIssRegular(e);
      c.linhas.push(linha(ii.nome + ' (fora do DAS, acima do sublimite)', ii.valor));
      c.avisos.push('RBT12 acima de R$ 3,6 milhões: ICMS, ISS e IBS saem do DAS e são pagos pelas regras normais.');
    }
    if (e.anexoEfetivo === 'IV') {
      c.linhas.push(linha('INSS patronal (CPP) sobre a folha', e.folha * p.inssPatronalRat / 100, 'Anexo IV: a CPP não está no DAS'));
    }
    return c;
  }

  function cenarioRegular(e, p, real) {
    var c = {
      id: real ? 'D' : 'C',
      nome: real ? 'Lucro Real' : 'Lucro Presumido',
      aplicavel: true, linhas: [], avisos: [], creditoCliente: 0, saldoCredor: 0
    };
    var ir;
    if (real) {
      var lucro = e.receita * (e.margemReal || 0) / 100;
      ir = irpjCsll(lucro, lucro, p);
      c.linhas.push(linha('IRPJ', ir.irpj, 'sobre o lucro de ' + (e.margemReal || 0).toString().replace('.', ',') + '% da receita'));
      c.linhas.push(linha('CSLL', ir.csll));
    } else {
      var pres = e.presuncao || p.presuncao[tipoAtividade(e.anexo)];
      var excedente = p.acrescimoLc224 ? pos(e.receita - p.limiteLc224) : 0;
      var baseI = e.receita * pres.irpj / 100 + excedente * pres.irpj / 100 * 0.1;
      var baseC = e.receita * pres.csll / 100 + excedente * pres.csll / 100 * 0.1;
      ir = irpjCsll(baseI, baseC, p);
      c.linhas.push(linha('IRPJ', ir.irpj, 'presunção de ' + pres.irpj + '% da receita'));
      c.linhas.push(linha('CSLL', ir.csll, 'presunção de ' + pres.csll + '% da receita'));
      if (excedente > 0) c.avisos.push('Inclui o acréscimo de 10% na presunção sobre a receita acima de R$ 5 milhões (LC 224/2025), questionado na Justiça.');
    }
    var reg = ibsCbsRegular(e, p, ['cbs', 'ibs']);
    c.linhas.push(linha('CBS', reg.cbs, 'débito sobre as vendas menos créditos das compras'));
    c.linhas.push(linha('IBS', reg.ibs, 'débito sobre as vendas menos créditos das compras'));
    var ii = icmsIssRegular(e);
    c.linhas.push(linha(ii.nome, ii.valor));
    c.linhas.push(linha('INSS patronal, RAT e terceiros sobre a folha', e.folha * (p.inssPatronalRat + p.terceiros) / 100));
    c.saldoCredor = reg.saldoCredor;
    c.creditoCliente = e.receita * e.vendasEmpresas * (reg.aliquotas.cbs + reg.aliquotas.ibs) * (1 - (e.reducao || 0));
    return c;
  }

  /*
   * entrada = {
   *   ano, anexo: 'I'|'II'|'III'|'IV'|'V'|'FR', receita, folha (anuais),
   *   rbt12? (receita dos 12 meses anteriores; define faixa, Fator R e limites do Simples),
   *   comprasRegular, comprasSimples (anuais), vendasEmpresas (0 a 1), reducao (0, 0.3 ou 0.6),
   *   icmsSaida, icmsEntrada, iss, margemReal (em %), presuncao?: { irpj, csll },
   *   premissas?: { ...sobrepõe RC2_REFORMA.PREMISSAS }
   * }
   */
  function comparar(entrada) {
    var p = premissas(entrada.premissas);
    var e = {};
    Object.keys(entrada).forEach(function (k) { e[k] = entrada[k]; });
    e.folha = e.folha || 0;
    e.vendasEmpresas = Math.min(1, Math.max(0, e.vendasEmpresas || 0));
    // Sem RBT12 informada, supõe faturamento estável: a receita anual é a própria RBT12.
    e.rbt12 = e.rbt12 > 0 ? e.rbt12 : e.receita;
    var ra = resolverAnexo(e.anexo, e.rbt12, e.folha);
    e.anexoEfetivo = ra.anexo;

    var cenarios = [cenarioSimples(e, p, false), cenarioSimples(e, p, true), cenarioRegular(e, p, false), cenarioRegular(e, p, true)];
    cenarios.forEach(function (c) { if (c.aplicavel) fechar(c, e); c.saldoCredor = arred(c.saldoCredor || 0); });

    var validos = cenarios.filter(function (c) { return c.aplicavel; });
    var porCusto = validos.slice().sort(function (a, b) { return a.total - b.total; });
    var porCustoMenosCredito = validos.slice().sort(function (a, b) { return a.custoMenosCredito - b.custoMenosCredito; });

    return {
      ano: e.ano,
      rbt12: e.rbt12,
      anexoEfetivo: ra.anexo,
      fatorR: ra.fatorR,
      aliquotasIbsCbs: aliquotasIbsCbs(e.ano, p),
      fracaoIcmsIss: fracaoIcmsIss(e.ano),
      premissas: p,
      cenarios: cenarios,
      melhor: porCusto[0] || null,
      melhorParaClienteEmpresa: porCustoMenosCredito[0] || null,
      recomendacao: recomendar(e, porCusto, porCustoMenosCredito)
    };
  }

  /* Recomendação em texto: menor custo; se vende muito para empresas, pesa o crédito que o cliente aproveita. */
  function recomendar(e, porCusto, porCredito) {
    if (!porCusto.length) return null;
    var melhor = porCusto[0];
    var r = { id: melhor.id, motivo: '' };
    var segundo = porCusto[1];
    r.motivo = melhor.nome + ' tem o menor custo tributário estimado' +
      (segundo ? ' (' + fmt(segundo.total - melhor.total) + ' a menos por ano que ' + segundo.nome + ')' : '') + '.';
    if (e.vendasEmpresas >= 0.5 && porCredito[0] && porCredito[0].id !== melhor.id) {
      var alt = porCredito[0];
      r.alternativa = alt.id;
      r.motivoAlternativa = 'Como ' + Math.round(e.vendasEmpresas * 100) + '% das vendas são para empresas, vale olhar ' +
        alt.nome + ': seus clientes aproveitam ' + fmt(alt.creditoCliente) + ' de crédito de IBS/CBS por ano, o que pode ' +
        'permitir preço mais competitivo, mesmo pagando ' + fmt(alt.total - melhor.total) + ' a mais de imposto.';
    }
    return r;
  }

  function fmt(v) {
    return 'R$ ' + arred(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /* O mesmo comparativo em todos os anos da transição (2027 a 2033). */
  function compararAnos(entrada) {
    return R.ANOS.map(function (ano) {
      var e = {};
      Object.keys(entrada).forEach(function (k) { e[k] = entrada[k]; });
      e.ano = ano;
      return comparar(e);
    });
  }

  root.RC2_REGIMES = {
    LIMITE_SIMPLES: LIMITE_SIMPLES,
    SUBLIMITE: SUBLIMITE,
    aliquotasIbsCbs: aliquotasIbsCbs,
    fracaoIcmsIss: fracaoIcmsIss,
    resolverAnexo: resolverAnexo,
    simples: simples,
    comparar: comparar,
    compararAnos: compararAnos
  };
})(typeof window !== 'undefined' ? window : globalThis);
