/*
 * RC2 Contábil — Motor de cálculo do Simples Nacional (funções puras).
 * Alíquota efetiva = (RBT12 × Alíquota nominal − Parcela a deduzir) ÷ RBT12
 */
(function (root) {
  'use strict';

  var T = root.RC2_TABELAS;

  function arred(v) {
    return Math.round((v + Number.EPSILON) * 100) / 100;
  }

  function faixaIndex(rbt12) {
    for (var i = 0; i < T.LIMITES.length; i++) {
      if (rbt12 <= T.LIMITES[i]) return i;
    }
    return -1;
  }

  function aliquotaEfetiva(anexoKey, rbt12) {
    var anexo = T.ANEXOS[anexoKey];
    var idx = faixaIndex(rbt12);
    if (!anexo || idx < 0) return null;
    var f = anexo.faixas[idx];
    var efetiva = rbt12 > 0 ? (rbt12 * f.aliq - f.pd) / rbt12 : f.aliq;
    return { faixa: idx, nominal: f.aliq, pd: f.pd, efetiva: efetiva };
  }

  /* Percentual efetivo de cada tributo, com teto de 5% para o ISS
   * (excedente redistribuído proporcionalmente aos tributos federais). */
  function percentuaisTributos(anexoKey, idx, efetiva) {
    var anexo = T.ANEXOS[anexoKey];
    var rep = anexo.reparticao[idx];
    var out = {};
    anexo.tributos.forEach(function (t) { out[t] = efetiva * (rep[t] || 0) / 100; });

    if (out.ISS && out.ISS > T.ISS_TETO) {
      var excedente = out.ISS - T.ISS_TETO;
      out.ISS = T.ISS_TETO;
      var federais = anexo.tributos.filter(function (t) { return t !== 'ISS' && t !== 'ICMS'; });
      var base = federais.reduce(function (s, t) { return s + (rep[t] || 0); }, 0);
      federais.forEach(function (t) { out[t] += excedente * (rep[t] || 0) / base; });
    }
    return out;
  }

  function fatorR(folha12, rbt12) {
    if (!(rbt12 > 0)) return null;
    var fator = folha12 / rbt12;
    return { fator: fator, anexo: fator >= T.FATOR_R_MINIMO ? 'III' : 'V' };
  }

  function calcularReceita(anexoKey, valor, tratamentoKey, rbt12) {
    var ae = aliquotaEfetiva(anexoKey, rbt12);
    if (!ae) return null;
    var trat = T.TRATAMENTOS[tratamentoKey] || T.TRATAMENTOS.normal;
    var pcts = percentuaisTributos(anexoKey, ae.faixa, ae.efetiva);
    var acimaSublimite = rbt12 > T.SUBLIMITE_ICMS_ISS;

    var tributos = [];
    var das = 0, fora = 0, retido = 0;
    T.ANEXOS[anexoKey].tributos.forEach(function (nome) {
      var pct = pcts[nome];
      var v = arred(valor * pct);
      var item = { nome: nome, pct: pct, valor: v, noDas: true, motivo: '' };
      if (trat.exclui.indexOf(nome) >= 0) {
        item.noDas = false;
        item.motivo = trat.retido ? 'retido' : 'excluido';
      } else if (acimaSublimite && (nome === 'ICMS' || nome === 'ISS')) {
        item.noDas = false;
        item.motivo = 'sublimite';
      }
      if (item.noDas) das += v;
      else if (item.motivo === 'retido') retido += v;
      else fora += v;
      tributos.push(item);
    });

    das = arred(das);
    return {
      anexo: anexoKey,
      faixa: ae.faixa + 1,
      nominal: ae.nominal,
      pd: ae.pd,
      efetiva: ae.efetiva,
      tratamento: tratamentoKey,
      valor: valor,
      tributos: tributos,
      das: das,
      aliquotaDas: valor > 0 ? das / valor : 0,
      excluido: arred(fora),
      retido: arred(retido)
    };
  }

  /* RBT12 e folha proporcionalizados para empresa em início de atividade
   * (LC 123/2006, art. 18, §§ 1º e 2º). */
  function proporcionalizar(mesesAnteriores, acumulado, valorMes) {
    if (mesesAnteriores <= 0) return valorMes * 12;
    return (acumulado / mesesAnteriores) * 12;
  }

  /*
   * entrada = {
   *   rbt12, folha12,
   *   receitas: [{ anexo: 'I'|'II'|'III'|'IV'|'V'|'FR', tratamento, valor, rotulo }]
   * }
   */
  function apurar(entrada) {
    var rbt12 = entrada.rbt12;
    var alertas = [];
    var res = { rbt12: rbt12, folha12: entrada.folha12, linhas: [], alertas: alertas, fatorR: null };

    if (rbt12 > T.LIMITE_SIMPLES) {
      res.erro = 'A receita bruta dos últimos 12 meses ultrapassa o limite de R$ 4.800.000,00 do Simples Nacional. A empresa está sujeita à exclusão do regime.';
      return res;
    }

    var precisaFatorR = entrada.receitas.some(function (r) { return r.anexo === 'FR'; });
    if (precisaFatorR) {
      res.fatorR = fatorR(entrada.folha12 || 0, rbt12);
      if (!res.fatorR) res.fatorR = { fator: 0, anexo: 'V' };
    }

    var totalReceita = 0, totalDas = 0, totalExcluido = 0, totalRetido = 0;
    var porTributo = {};

    entrada.receitas.forEach(function (r) {
      var anexoKey = r.anexo === 'FR' ? res.fatorR.anexo : r.anexo;
      var c = calcularReceita(anexoKey, r.valor, r.tratamento, rbt12);
      if (!c) return;
      c.rotulo = r.rotulo || '';
      c.viaFatorR = r.anexo === 'FR';
      res.linhas.push(c);
      totalReceita += r.valor;
      totalDas += c.das;
      totalExcluido += c.excluido;
      totalRetido += c.retido;
      c.tributos.forEach(function (t) {
        var p = porTributo[t.nome] || (porTributo[t.nome] = { das: 0, fora: 0 });
        if (t.noDas) p.das += t.valor; else p.fora += t.valor;
      });
    });

    Object.keys(porTributo).forEach(function (k) {
      porTributo[k].das = arred(porTributo[k].das);
      porTributo[k].fora = arred(porTributo[k].fora);
    });

    res.totalReceita = arred(totalReceita);
    res.totalDas = arred(totalDas);
    res.totalExcluido = arred(totalExcluido);
    res.totalRetido = arred(totalRetido);
    res.aliquotaMedia = totalReceita > 0 ? totalDas / totalReceita : 0;
    res.porTributo = porTributo;
    res.faixa = faixaIndex(rbt12) + 1;

    if (rbt12 > T.SUBLIMITE_ICMS_ISS) {
      alertas.push('RBT12 acima do sublimite de R$ 3.600.000,00: ICMS e ISS devem ser recolhidos fora do DAS, pelas regras normais do estado/município, e não estão incluídos neste total.');
    }
    if (res.linhas.some(function (l) { return l.anexo === 'IV'; })) {
      alertas.push('Anexo IV: a Contribuição Previdenciária Patronal (CPP, 20% + RAT sobre a folha) não está no DAS e é recolhida à parte via DCTFWeb.');
    }
    if (res.fatorR) {
      var fr = res.fatorR;
      fr.folhaNecessaria = arred(rbt12 * T.FATOR_R_MINIMO);
      fr.faltante = arred(Math.max(0, fr.folhaNecessaria - (entrada.folha12 || 0)));
      // Comparativo Anexo III x V para as receitas sujeitas ao Fator R
      var baseFR = entrada.receitas.filter(function (r) { return r.anexo === 'FR'; });
      var somaIII = 0, somaV = 0;
      baseFR.forEach(function (r) {
        var a = calcularReceita('III', r.valor, r.tratamento, rbt12);
        var b = calcularReceita('V', r.valor, r.tratamento, rbt12);
        if (a) somaIII += a.das;
        if (b) somaV += b.das;
      });
      fr.dasAnexoIII = arred(somaIII);
      fr.dasAnexoV = arred(somaV);
      fr.diferenca = arred(somaV - somaIII);
    }
    return res;
  }

  root.RC2_CALCULO = {
    arred: arred,
    faixaIndex: faixaIndex,
    aliquotaEfetiva: aliquotaEfetiva,
    percentuaisTributos: percentuaisTributos,
    fatorR: fatorR,
    calcularReceita: calcularReceita,
    proporcionalizar: proporcionalizar,
    apurar: apurar
  };
})(typeof window !== 'undefined' ? window : globalThis);
